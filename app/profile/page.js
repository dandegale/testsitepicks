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
        .upsert({ id: user.id, avatar_url: publicUrl, updated_at: new Date() });

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
      // Optimistic UI Update for instant visual feedback
      const newValue = !showOdds;
      setShowOdds(newValue);
      
      const { error } = await supabase.from('profiles').upsert({ 
          id: user.id, 
          show_odds: newValue,
          updated_at: new Date()
      });
      
      // Revert if database fails
      if (error) {
          console.error("Failed to save odds preference:", error);
          setShowOdds(!newValue);
      }
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

  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-pink-600 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  return (
    <main className="min-h-screen bg-black text-white pb-24 font-sans selection:bg-pink-500 selection:text-white">
      
      {/* HEADER HERO */}
      <div className="bg-gradient-to-b from-gray-900 to-black border-b border-gray-800 pt-10 pb-12 px-6">
        
        {/* Top Nav */}
        <div className="max-w-4xl mx-auto flex justify-between items-center mb-8">
            <Link href="/" className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-white transition-colors group">
                <span className="group-hover:-translate-x-1 transition-transform">←</span> Dashboard
            </Link>
            <LogOutButton />
        </div>

        <div className="max-w-xl mx-auto text-center">
            {/* AVATAR CIRCLE */}
            <div className="relative group mx-auto w-32 h-32 mb-6">
                <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-full rounded-full overflow-hidden border-4 border-gray-900 shadow-2xl bg-gray-950 cursor-pointer group-hover:border-pink-600 transition-colors relative"
                >
                    {avatarUrl ? (
                        <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-4xl font-black text-gray-700">
                            {username.charAt(0).toUpperCase()}
                        </div>
                    )}
                    
                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
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
                        className="bg-gray-950 border border-pink-600 text-white text-xl font-black italic uppercase p-2 rounded-lg text-center w-full max-w-[200px] focus:outline-none focus:ring-1 focus:ring-pink-500"
                        autoFocus
                    />
                    <button onClick={handleSaveProfile} className="bg-pink-600 w-10 h-10 rounded-lg text-white font-black hover:bg-pink-500 transition-colors">✓</button>
                    <button onClick={() => setIsEditing(false)} className="bg-gray-800 w-10 h-10 rounded-lg text-gray-400 font-black hover:text-white hover:bg-gray-700 transition-colors">✕</button>
                </div>
            ) : (
                <div className="flex items-center justify-center gap-3 mb-2 group cursor-pointer" onClick={() => setIsEditing(true)}>
                    <h1 className="text-3xl md:text-4xl font-black italic text-white uppercase tracking-tighter">
                        {username}
                    </h1>
                    <span className="opacity-0 group-hover:opacity-100 text-pink-600 text-sm transition-opacity">✎</span>
                </div>
            )}
            <p className="text-gray-500 text-[10px] font-bold uppercase tracking-[0.2em]">{user?.email}</p>
        </div>
      </div>

      {/* MAIN CONTENT CONTAINER */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        
        {/* STATS CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
            <StatCard label="Record" value={`${stats.wins}-${stats.losses}`} sub="W-L" color="text-white" />
            <StatCard 
                label="Accuracy" 
                value={`${stats.totalBets > 0 ? Math.round((stats.wins / (stats.wins + stats.losses)) * 100) : 0}%`} 
                color="text-teal-400" 
            />
            <StatCard label="Pending" value={stats.pending} color="text-pink-500" />
            <StatCard 
                label="Earnings" 
                value={`${stats.netProfit >= 0 ? '+' : ''}${stats.netProfit}`} 
                color={stats.netProfit >= 0 ? 'text-green-400' : 'text-pink-500'} 
            />
        </div>

        {/* 🎯 ULTRA-BULLETPROOF SETTINGS TOGGLE */}
        <div className="bg-gray-950 border border-gray-900 rounded-xl p-5 flex items-center justify-between mb-12 shadow-lg">
            <div>
                <h4 className="text-xs font-black text-white uppercase tracking-widest">Show Vegas Odds</h4>
                <p className="text-[10px] text-gray-500 font-bold mt-1 max-w-[200px] md:max-w-none">Reveal potential payouts and betting lines on the dashboard.</p>
            </div>
            
            <button 
                onClick={toggleOdds}
                className={`relative w-12 h-6 rounded-full p-1 cursor-pointer transition-colors duration-300 shrink-0 border-2 border-transparent focus:outline-none ${showOdds ? 'bg-pink-600' : 'bg-gray-800'}`}
            >
                {/* We use an inline style transform here so it physically CANNOT fail to compile! */}
                <div 
                    className="w-4 h-4 bg-white rounded-full shadow-md transition-transform duration-300 ease-in-out"
                    style={{ transform: showOdds ? 'translateX(24px)' : 'translateX(0px)' }}
                />
            </button>
        </div>

        {/* HISTORY */}
        <div className="flex items-center gap-3 mb-5 px-1">
            <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse"></span>
            <h2 className="text-sm font-black text-white italic uppercase tracking-tighter">Fight History</h2>
        </div>

        <div className="bg-gray-950 border border-gray-900 rounded-xl overflow-hidden shadow-xl">
            {history.length === 0 ? (
                <div className="p-12 text-center">
                    <p className="text-gray-600 text-[10px] font-bold uppercase tracking-widest">No fights recorded yet.</p>
                </div>
            ) : (
                <div className="divide-y divide-gray-900">
                    {history.map((item) => (
                        <div key={item.id} className="p-4 md:p-5 flex items-center justify-between bg-black/20 hover:bg-gray-900 transition-colors border-l-2 border-transparent hover:border-pink-600 group">
                            <div>
                                <div className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mb-1.5">{item.leagueName}</div>
                                <div className="font-black text-white text-sm md:text-base uppercase tracking-tighter group-hover:text-pink-100 transition-colors">{item.selection}</div>
                                <div className="text-[10px] text-gray-500 font-bold uppercase mt-1">{item.fightName}</div>
                            </div>
                            <div className="text-right flex flex-col items-end">
                                <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded border mb-2 ${
                                    item.result === 'Win' ? 'bg-green-950/30 text-green-400 border-green-900/50' : 
                                    item.result === 'Loss' ? 'bg-red-950/30 text-red-400 border-red-900/50' : 
                                    'bg-pink-950/30 text-pink-400 border-pink-900/50'
                                }`}>
                                    {item.result}
                                </span>
                                <div className={`text-sm md:text-base font-black italic tracking-tighter ${item.profitChange > 0 ? 'text-green-500' : item.profitChange < 0 ? 'text-red-500' : 'text-gray-600'}`}>
                                    {item.result === 'Pending' ? '---' : `${item.profitChange > 0 ? '+' : ''}${item.profitChange.toFixed(1)} PTS`}
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

// Clean Sub-component
function StatCard({ label, value, sub, color }) {
    return (
        <div className="bg-gray-950 border border-gray-900 rounded-xl p-5 text-center shadow-lg relative overflow-hidden group hover:border-gray-700 transition-colors">
            <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">{label}</div>
            <div className={`text-2xl md:text-3xl font-black italic tracking-tighter ${color}`}>{value}</div>
            {sub && <div className="text-[9px] text-gray-600 font-bold mt-1 uppercase tracking-widest">{sub}</div>}
        </div>
    );
}