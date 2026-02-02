'use client';

import { createClient } from '@supabase/supabase-js';
import { useEffect, useState, useRef } from 'react';
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
  
  // --- PROFILE STATE ---
  const [username, setUsername] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  // --- PREFERENCES & STATS ---
  const [showOdds, setShowOdds] = useState(false); 
  const [stats, setStats] = useState({ totalBets: 0, wins: 0, losses: 0, pending: 0, netProfit: 0 });
  const [history, setHistory] = useState([]);
  const router = useRouter();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }
    setUser(user);

    // Get Profile
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    
    // Resolve Identity
    const finalName = profile?.username || user.user_metadata?.username || user.email?.split('@')[0] || 'Fighter';
    setUsername(finalName);
    setNewUsername(finalName); 
    setAvatarUrl(profile?.avatar_url || null);
    if (profile) setShowOdds(profile.show_odds === true);

    // Get Picks & Stats
    const { data: picks, error } = await supabase
      .from('picks')
      .select('*, leagues(name)') 
      .eq('user_id', user.email) 
      .order('id', { ascending: false });

    // Fallback if relation fails
    let finalPicks = picks;
    if (error) {
        const { data: fallback } = await supabase.from('picks').select('*').eq('user_id', user.email).order('id', { ascending: false });
        finalPicks = fallback;
    }

    const { data: fights } = await supabase.from('fights').select('*');
    calculateStats(finalPicks || [], fights || [], !!error);
    setLoading(false);
  };

  // --- AVATAR UPLOAD LOGIC ---
  const handleAvatarUpload = async (event) => {
    try {
      setUploading(true);
      if (!event.target.files || event.target.files.length === 0) {
        throw new Error('You must select an image to upload.');
      }

      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      // 1. Upload to Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // 2. Get Public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // 3. Update Profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl, updated_at: new Date() })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setAvatarUrl(publicUrl);
      alert('Avatar updated!');
    } catch (error) {
      alert('Error uploading avatar: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!newUsername.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('profiles').upsert({ id: user.id, username: newUsername, updated_at: new Date() });
    if (error) alert("Error: " + error.message);
    else {
        setUsername(newUsername);
        await supabase.auth.updateUser({ data: { username: newUsername } });
        setIsEditing(false);
    }
    setSaving(false);
  };

  const toggleOdds = async () => {
      const newValue = !showOdds;
      setShowOdds(newValue);
      await supabase.from('profiles').update({ show_odds: newValue }).eq('id', user.id);
  };

  const calculateStats = (picks, fights, missingLeagues) => {
    let wins = 0, losses = 0, pending = 0, netProfit = 0;
    const historyData = [];

    picks.forEach(pick => {
        const fight = fights.find(f => f.id == pick.fight_id);
        const fightName = fight ? `${fight.fighter_1_name} vs ${fight.fighter_2_name}` : `Fight #${pick.fight_id}`;
        let result = 'Pending', profitChange = 0;

        if (fight && fight.winner) {
            if (fight.winner === pick.selected_fighter) {
                result = 'Win'; wins++;
                const odds = parseInt(pick.odds_at_pick || -110, 10);
                const profit = odds > 0 ? (odds / 100) * 10 : (100 / Math.abs(odds)) * 10;
                profitChange = profit + 10; 
            } else {
                result = 'Loss'; losses++;
                profitChange = -10; 
            }
        } else { result = 'Pending'; pending++; }

        if (result !== 'Pending') netProfit += profitChange;

        let leagueName = 'Global';
        if (!missingLeagues && pick.leagues) {
            if (Array.isArray(pick.leagues) && pick.leagues.length > 0) leagueName = pick.leagues[0].name;
            else if (typeof pick.leagues === 'object' && pick.leagues.name) leagueName = pick.leagues.name;
        }

        historyData.push({ id: pick.id, fightName, selection: pick.selected_fighter, odds: pick.odds_at_pick, result, profitChange, leagueName });
    });

    setStats({ totalBets: picks.length, wins, losses, pending, netProfit: parseFloat(netProfit.toFixed(1)) });
    setHistory(historyData);
  };

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center"><div className="w-8 h-8 border-4 border-pink-600 border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <main className="min-h-screen bg-black text-white pb-24 font-sans">
      
      {/* HEADER HERO */}
      <div className="relative bg-gradient-to-b from-gray-900 to-black border-b border-gray-800 pt-12 pb-8 px-6">
        
        {/* Top Nav */}
        <div className="absolute top-6 left-6 right-6 flex justify-between items-center">
            <Link href="/" className="text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-white transition-colors">
                ← Dashboard
            </Link>
            <LogOutButton />
        </div>

        <div className="max-w-xl mx-auto text-center mt-8">
            {/* AVATAR CIRCLE */}
            <div className="relative group mx-auto w-32 h-32 mb-6">
                <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-32 h-32 rounded-full overflow-hidden border-4 border-gray-800 shadow-2xl bg-gray-900 cursor-pointer hover:border-pink-600 transition-all relative"
                >
                    {avatarUrl ? (
                        <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-4xl font-black text-gray-700">
                            {username.charAt(0).toUpperCase()}
                        </div>
                    )}
                    
                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-[10px] font-black uppercase text-white tracking-widest">
                            {uploading ? '...' : 'Upload'}
                        </span>
                    </div>
                </div>
                <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleAvatarUpload}
                    accept="image/*"
                    className="hidden"
                    disabled={uploading}
                />
            </div>

            {/* USERNAME & EDIT */}
            {isEditing ? (
                <div className="flex items-center justify-center gap-2 mb-2">
                    <input 
                        type="text" 
                        value={newUsername} 
                        onChange={(e) => setNewUsername(e.target.value)}
                        className="bg-black/50 border border-pink-600 text-white text-xl font-black italic uppercase p-2 rounded text-center w-full max-w-[200px] focus:outline-none"
                        autoFocus
                    />
                    <button onClick={handleSaveProfile} className="bg-pink-600 p-2 rounded text-xs font-bold hover:bg-pink-500">✓</button>
                    <button onClick={() => setIsEditing(false)} className="bg-gray-800 p-2 rounded text-xs font-bold hover:bg-gray-700">✕</button>
                </div>
            ) : (
                <div className="flex items-center justify-center gap-2 mb-2 group cursor-pointer" onClick={() => setIsEditing(true)}>
                    <h1 className="text-3xl md:text-4xl font-black italic text-white uppercase tracking-tighter">
                        {username}
                    </h1>
                    <span className="opacity-0 group-hover:opacity-100 text-gray-600 text-xs">✎</span>
                </div>
            )}
            <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">{user?.email}</p>
        </div>
      </div>

      {/* CONTENT CONTAINER */}
      <div className="max-w-4xl mx-auto px-4 -mt-6">
        
        {/* STATS CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            <StatCard label="Record" value={`${stats.wins}-${stats.losses}`} sub="W-L" color="text-white" />
            <StatCard 
                label="Accuracy" 
                value={`${stats.totalBets > 0 ? Math.round((stats.wins / (stats.wins + stats.losses)) * 100) : 0}%`} 
                color="text-teal-400" 
            />
            <StatCard label="Pending" value={stats.pending} color="text-yellow-500" />
            <StatCard 
                label="Earnings" 
                value={`${stats.netProfit >= 0 ? '+' : ''}${stats.netProfit}`} 
                color={stats.netProfit >= 0 ? 'text-green-500' : 'text-pink-500'} 
            />
        </div>

        {/* SETTINGS TOGGLE */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 flex items-center justify-between mb-10">
            <div>
                <h4 className="text-xs font-black text-white uppercase tracking-widest">Show Vegas Odds</h4>
                <p className="text-[10px] text-gray-500 font-bold mt-1">Reveal potential payouts on dashboard.</p>
            </div>
            <button onClick={toggleOdds} className={`w-10 h-5 rounded-full relative transition-colors ${showOdds ? 'bg-pink-600' : 'bg-gray-700'}`}>
                <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-transform ${showOdds ? 'left-6' : 'left-1'}`} />
            </button>
        </div>

        {/* HISTORY */}
        <h2 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4 px-1">Fight History</h2>
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            {history.length === 0 ? (
                <div className="p-12 text-center">
                    <p className="text-gray-600 text-xs font-bold uppercase tracking-widest">No fights recorded yet.</p>
                </div>
            ) : (
                <div className="divide-y divide-gray-800">
                    {history.map((item) => (
                        <div key={item.id} className="p-4 flex items-center justify-between hover:bg-gray-800/50 transition-colors">
                            <div>
                                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">{item.leagueName}</div>
                                <div className="font-bold text-white text-sm">{item.selection}</div>
                                <div className="text-[10px] text-gray-400">{item.fightName}</div>
                            </div>
                            <div className="text-right">
                                <span className={`text-[10px] font-black uppercase px-2 py-1 rounded border mb-1 inline-block ${
                                    item.result === 'Win' ? 'bg-green-900/20 text-green-400 border-green-900' : 
                                    item.result === 'Loss' ? 'bg-red-900/20 text-red-400 border-red-900' : 
                                    'bg-yellow-900/20 text-yellow-400 border-yellow-900'
                                }`}>
                                    {item.result}
                                </span>
                                <div className={`text-sm font-mono font-bold ${item.profitChange > 0 ? 'text-green-500' : item.profitChange < 0 ? 'text-red-500' : 'text-gray-500'}`}>
                                    {item.result === 'Pending' ? '--' : `${item.profitChange > 0 ? '+' : ''}${item.profitChange.toFixed(1)}`}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>

      </div>
    </main>
  );
}

// Sub-component for cleaner code
function StatCard({ label, value, sub, color }) {
    return (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center shadow-lg relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-gray-700 to-transparent opacity-0 group-hover:opacity-50 transition-opacity" />
            <div className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">{label}</div>
            <div className={`text-2xl md:text-3xl font-black italic tracking-tighter ${color}`}>{value}</div>
            {sub && <div className="text-[9px] text-gray-600 font-bold mt-1">{sub}</div>}
        </div>
    );
}