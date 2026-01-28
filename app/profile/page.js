'use client';

import { createClient } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import LogOutButton from '../components/LogOutButton'; 

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function Profile() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  
  // --- PROFILE EDIT STATE ---
  const [username, setUsername] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // --- NEW: ODDS PREFERENCE STATE ---
  const [showOdds, setShowOdds] = useState(false); // Default OFF
  const [savingPref, setSavingPref] = useState(false);

  const [stats, setStats] = useState({
    totalBets: 0,
    wins: 0,
    losses: 0,
    pending: 0,
    netProfit: 0,
  });
  const [history, setHistory] = useState([]);
  const router = useRouter();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    // 1. Get Auth User
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
        router.push('/login');
        return;
    }
    setUser(user);

    // 2. Get Profile from DB (if exists)
    const { data: profile } = await supabase
      .from('profiles')
      .select('*') // Select ALL so we get show_odds
      .eq('id', user.id)
      .single();
    
    // 3. RESOLVE USERNAME:
    const dbName = profile?.username;
    const metaName = user.user_metadata?.username; 
    const emailName = user.email?.split('@')[0];
    const finalName = dbName || metaName || emailName || 'Unknown Fighter';

    setUsername(finalName);
    setNewUsername(finalName); 

    // 4. RESOLVE PREFERENCES (Default to FALSE if null or false)
    if (profile) {
        setShowOdds(profile.show_odds === true);
    }

    // Get User's Picks
    const { data: picks, error } = await supabase
      .from('picks')
      .select('*, leagues(name)') 
      .eq('user_id', user.email) 
      .order('id', { ascending: false });

    // Fallback logic for missing relations
    let finalPicks = picks;
    if (error) {
        const { data: fallback } = await supabase
            .from('picks')
            .select('*')
            .eq('user_id', user.email)
            .order('id', { ascending: false });
        finalPicks = fallback;
    }

    // Get Fights
    const { data: fights } = await supabase.from('fights').select('*');
    calculateStats(finalPicks || [], fights || [], !!error);
    setLoading(false);
  };

  // --- SAVE PROFILE NAME ---
  const handleSaveProfile = async () => {
    if (!newUsername.trim()) return;
    setSaving(true);

    const { error } = await supabase
        .from('profiles')
        .upsert({ id: user.id, username: newUsername, updated_at: new Date() });

    if (error) {
        alert("Error updating name: " + error.message);
    } else {
        setUsername(newUsername);
        await supabase.auth.updateUser({ data: { username: newUsername } });
        setIsEditing(false);
    }
    setSaving(false);
  };

  // --- TOGGLE ODDS PREFERENCE ---
  const toggleOdds = async () => {
      const newValue = !showOdds;
      setShowOdds(newValue);
      setSavingPref(true);

      const { error } = await supabase
          .from('profiles')
          .update({ show_odds: newValue })
          .eq('id', user.id);

      if (error) {
          alert("Error saving setting");
          setShowOdds(!newValue); // Revert UI on error
      }
      setSavingPref(false);
  };

  const calculateStats = (picks, fights, missingLeagues) => {
    let wins = 0;
    let losses = 0;
    let pending = 0;
    let netProfit = 0;
    const historyData = [];

    picks.forEach(pick => {
        const fight = fights.find(f => f.id == pick.fight_id);
        const fightName = fight 
            ? `${fight.fighter_1_name} vs ${fight.fighter_2_name}` 
            : `Fight #${pick.fight_id}`;

        let result = 'Pending';
        let profitChange = 0;

        if (fight && fight.winner) {
            if (fight.winner === pick.selected_fighter) {
                result = 'Win';
                wins++;
                const odds = pick.odds_at_pick || -110;
                const stake = 10;
                const totalPayout = odds > 0 
                  ? ((odds / 100) * stake) + stake 
                  : ((100 / Math.abs(odds)) * stake) + stake;
                
                profitChange = totalPayout - stake; 
            } else {
                result = 'Loss';
                losses++;
                profitChange = -10; 
            }
        } else {
            result = 'Pending';
            pending++;
        }

        if (result !== 'Pending') {
            netProfit += profitChange;
        }

        let leagueName = 'Global Feed';
        if (!missingLeagues && pick.leagues) {
            if (Array.isArray(pick.leagues) && pick.leagues.length > 0) {
                leagueName = pick.leagues[0].name;
            } else if (typeof pick.leagues === 'object' && pick.leagues.name) {
                leagueName = pick.leagues.name;
            }
        }

        historyData.push({
            id: pick.id,
            fightName: fightName,
            selection: pick.selected_fighter,
            odds: pick.odds_at_pick,
            result,
            profitChange,
            leagueName
        });
    });

    setStats({
        totalBets: picks.length,
        wins,
        losses,
        pending,
        netProfit
    });

    setHistory(historyData);
  };

  if (loading) return <div className="min-h-screen bg-black text-teal-500 p-10 text-center font-bold uppercase animate-pulse">Loading Profile...</div>;

  return (
    <main className="min-h-screen bg-black text-white p-4 md:p-8 pb-24">
      
      {/* HEADER WITH EDIT FUNCTIONALITY */}
      <div className="max-w-4xl mx-auto mb-8 border-b border-gray-800 pb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        
        {/* Left Side: Name Display / Edit Form */}
        <div className="flex-1 w-full md:w-auto">
            {isEditing ? (
                <div className="flex items-center gap-2 w-full">
                    <input 
                        type="text" 
                        value={newUsername} 
                        onChange={(e) => setNewUsername(e.target.value)}
                        className="bg-gray-900 border border-pink-500 text-white text-2xl font-black italic uppercase p-2 rounded w-full max-w-xs focus:outline-none"
                        placeholder="Enter Fighter Name"
                        autoFocus
                    />
                    <button 
                        onClick={handleSaveProfile} 
                        disabled={saving}
                        className="bg-green-600 text-white px-3 py-2 rounded font-bold uppercase text-xs hover:bg-green-500 disabled:opacity-50"
                    >
                        {saving ? '...' : 'Save'}
                    </button>
                    <button 
                        onClick={() => setIsEditing(false)} 
                        className="text-gray-500 px-2 font-bold uppercase text-xs hover:text-white"
                    >
                        Cancel
                    </button>
                </div>
            ) : (
                <div className="group flex items-center gap-3">
                    <h1 className="text-4xl font-black text-white uppercase italic tracking-tighter">
                        {username}
                    </h1>
                    <button 
                        onClick={() => setIsEditing(true)}
                        className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-pink-500 transition-all text-xs font-bold uppercase border border-gray-800 hover:border-pink-500 px-2 py-1 rounded"
                    >
                        ✎ Edit Name
                    </button>
                </div>
            )}
            
            <p className="text-gray-500 text-sm uppercase tracking-widest font-bold mt-1">
                {user?.email}
            </p>
        </div>
        
        {/* Right Side: Nav Buttons */}
        <div className="flex items-center gap-3">
            <Link href="/" className="text-gray-400 hover:text-white font-bold uppercase text-xs border border-gray-700 px-4 py-2 rounded transition-colors">
                ← Dashboard
            </Link>
            <LogOutButton />
        </div>
      </div>

      {/* STATS GRID */}
      <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-gray-900 p-6 rounded border border-gray-800 text-center">
            <div className="text-gray-500 text-xs uppercase font-bold mb-2">Record</div>
            <div className="text-3xl font-black text-white">
                {stats.wins} - {stats.losses}
            </div>
            <div className="text-xs text-gray-600 font-mono mt-1">W - L</div>
        </div>
        <div className="bg-gray-900 p-6 rounded border border-gray-800 text-center">
            <div className="text-gray-500 text-xs uppercase font-bold mb-2">Accuracy</div>
            <div className="text-3xl font-black text-teal-500">
                {stats.totalBets > 0 && (stats.wins + stats.losses) > 0
                    ? Math.round((stats.wins / (stats.wins + stats.losses)) * 100) 
                    : 0}%
            </div>
        </div>
        <div className="bg-gray-900 p-6 rounded border border-gray-800 text-center">
            <div className="text-gray-500 text-xs uppercase font-bold mb-2">Active Bets</div>
            <div className="text-3xl font-black text-yellow-500">
                {stats.pending}
            </div>
        </div>
        <div className="bg-gray-900 p-6 rounded border border-gray-800 text-center">
            <div className="text-gray-500 text-xs uppercase font-bold mb-2">Career Earnings</div>
            <div className={`text-3xl font-black ${stats.netProfit >= 0 ? 'text-green-500' : 'text-pink-500'}`}>
                {stats.netProfit >= 0 ? '+' : ''}{stats.netProfit.toFixed(2)}
            </div>
        </div>
      </div>

      {/* --- NEW: PREFERENCES SECTION --- */}
      <div className="max-w-4xl mx-auto mb-12">
          <h2 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4">Preferences</h2>
          
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between shadow-lg">
              <div>
                  <h4 className="font-bold text-white text-sm">Vegas Odds</h4>
                  <p className="text-[10px] text-gray-500 mt-1">
                      Show payouts on the fight dashboard. Keep OFF to play blind.
                  </p>
              </div>
              
              <div className="flex flex-col items-end">
                <button 
                    onClick={toggleOdds}
                    className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${showOdds ? 'bg-green-600' : 'bg-gray-700'}`}
                >
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-md transition-transform duration-300 ${showOdds ? 'left-7' : 'left-1'}`} />
                </button>
                <span className="text-[9px] font-bold text-gray-500 mt-2 uppercase tracking-widest">
                    {showOdds ? 'ON' : 'OFF'}
                </span>
              </div>
          </div>
      </div>

      {/* BET HISTORY LIST */}
      <div className="max-w-4xl mx-auto">
        <h2 className="text-xl font-bold mb-4 text-gray-400 uppercase tracking-widest text-sm">
            Fight History
        </h2>
        <div className="bg-gray-900 rounded-lg overflow-hidden border border-gray-700">
            {history.length === 0 ? (
                <div className="p-8 text-center text-gray-500 italic">No fights recorded yet. Go make some picks!</div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-950 text-gray-500 uppercase text-xs font-bold tracking-wider">
                            <tr>
                                <th className="p-4">Fight</th>
                                <th className="p-4">Pick</th>
                                <th className="p-4">League</th>
                                <th className="p-4">Result</th>
                                <th className="p-4 text-right">P/L</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800 text-sm">
                            {history.map((item) => {
                                const isGlobal = item.leagueName === 'Global Feed';
                                const leagueStyle = isGlobal 
                                    ? 'bg-gray-800 text-gray-400 border-gray-700' 
                                    : 'bg-teal-900/30 text-teal-400 border-teal-800';

                                return (
                                    <tr key={item.id} className="hover:bg-gray-800 transition-colors">
                                        <td className="p-4 font-medium text-gray-300">
                                            {item.fightName}
                                        </td>
                                        <td className="p-4">
                                            <span className="font-bold text-white block">{item.selection}</span>
                                            {/* Only show historical odds if you want, or respect the toggle here too. Currently showing history regardless. */}
                                            <span className="text-xs text-yellow-600 font-mono">({item.odds > 0 ? '+' : ''}{item.odds})</span>
                                        </td>
                                        <td className="p-4">
                                            <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded border ${leagueStyle}`}>
                                                {item.leagueName}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <span className={`uppercase font-bold text-xs px-2 py-1 rounded 
                                                ${item.result === 'Win' ? 'text-green-400' : ''}
                                                ${item.result === 'Loss' ? 'text-pink-500' : ''}
                                                ${item.result === 'Pending' ? 'text-yellow-500' : ''}
                                            `}>
                                                {item.result}
                                            </span>
                                        </td>
                                        <td className={`p-4 text-right font-mono font-bold 
                                            ${item.profitChange > 0 ? 'text-green-400' : ''}
                                            ${item.profitChange < 0 ? 'text-pink-500' : ''}
                                            ${item.profitChange === 0 ? 'text-gray-500' : ''}
                                        `}>
                                            {item.result === 'Pending' ? '-' : (
                                                <>
                                                    {item.profitChange > 0 ? '+' : ''}{item.profitChange.toFixed(2)}
                                                </>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
      </div>
    </main>
  );
}