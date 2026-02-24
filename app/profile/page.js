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

// --- FULL MASTER BADGE DATA WITH IMAGES ---
const AVAILABLE_BADGES = [
  // 🥊 Method of Victory
  { id: 'b1', title: 'BMF', imagePath: '/badges/bmf.png', description: '5+ chosen fighters win by knockout on a single card.', earned: false, glow: 'shadow-[0_0_15px_rgba(234,179,8,0.4)]' },
  { id: 'b2', title: 'The Sub Artist', imagePath: '/badges/sub-artist.png', description: '5+ chosen fighters win by submission on a single card.', earned: false, glow: 'shadow-[0_0_15px_rgba(255,255,255,0.4)]' },
  { id: 'b3', title: 'Flashbang', imagePath: '/badges/flashbang.png', description: 'Correctly picked a fighter who won by round 1 knockout.', earned: false, glow: 'shadow-[0_0_15px_rgba(249,115,22,0.4)]' },
  { id: 'b4', title: 'Decision Merchant', imagePath: '/badges/decision.png', description: 'All winners chosen won by decision.', earned: false, glow: 'shadow-[0_0_15px_rgba(209,213,219,0.4)]' },

  // 🎯 Accuracy & Prediction
  { id: 'b5', title: 'The Boss', imagePath: '/badges/boss.png', description: 'Predicted every single winner on a fight card.', earned: false, glow: 'shadow-[0_0_15px_rgba(34,197,94,0.4)]' },
  { id: 'b6', title: 'Undercard Assassin', imagePath: '/badges/assassin.png', description: 'Predicted all winners of the prelims.', earned: false, glow: 'shadow-[0_0_15px_rgba(239,68,68,0.4)]' },
  { id: 'b7', title: 'Main Event Mafia', imagePath: '/badges/mafia.png', description: 'Correctly predicted the Main Event winner 5 events in a row.', earned: false, glow: 'shadow-[0_0_15px_rgba(192,132,252,0.4)]' },
  { id: 'b8', title: 'Flawless Victory', imagePath: '/badges/fatality.png', description: 'Won a 1v1 Showdown where your opponent scored zero points.', earned: false, glow: 'shadow-[0_0_15px_rgba(220,38,38,0.6)]' },

  // 🔥 Pick Streaks
  { id: 'b9', title: 'On Fire (3)', imagePath: '/badges/streak-3.png', description: 'Awarded for 3 correct picks in a row.', earned: false, glow: 'shadow-[0_0_15px_rgba(74,222,128,0.4)]' },
  { id: 'b10', title: 'Heating Up (5)', imagePath: '/badges/streak-5.png', description: 'Awarded for 5 correct picks in a row.', earned: false, glow: 'shadow-[0_0_15px_rgba(96,165,250,0.4)]' },
  { id: 'b11', title: 'Unstoppable (10)', imagePath: '/badges/streak-10.png', description: 'Awarded for 10 correct picks in a row.', earned: false, glow: 'shadow-[0_0_15px_rgba(236,72,153,0.4)]' },
  { id: 'b12', title: 'God Tier (25)', imagePath: '/badges/streak-25.png', description: 'Awarded for 25 correct picks in a row.', earned: false, glow: 'shadow-[0_0_15px_rgba(239,68,68,0.6)]' },

  // 🎲 Risk & Odds
  { id: 'b13', title: 'Whale Hunter', imagePath: '/badges/whale.png', description: 'Winning pick on the biggest betting underdog of a fight card.', earned: false, glow: 'shadow-[0_0_15px_rgba(250,204,21,0.4)]' },
  { id: 'b14', title: 'The Underdog', imagePath: '/badges/underdog.png', description: 'Correctly picking every underdog who won on a fight card.', earned: false, glow: 'shadow-[0_0_15px_rgba(217,119,6,0.4)]' },
  { id: 'b15', title: 'Chalk Eater', imagePath: '/badges/chalk.png', description: 'Your last 10 correct picks were all heavy favorites.', earned: false, glow: 'shadow-[0_0_15px_rgba(191,219,254,0.4)]' },
  { id: 'b16', title: 'Hail Mary', imagePath: '/badges/hail-mary.png', description: 'Won your League week via a massive underdog in the Main Event.', earned: false, glow: 'shadow-[0_0_15px_rgba(45,212,191,0.4)]' },

  // 🏔️ Hall of Shame
  { id: 'b17', title: '2-3 Years Needed', imagePath: '/badges/mountain.png', description: 'Most fighters lost by submission in a league event.', earned: false, glow: 'shadow-[0_0_15px_rgba(148,163,184,0.4)]' },

  // ⏳ Grinder / Status
  { id: 'b18', title: 'Event Master', imagePath: '/badges/calendar.png', description: 'Participated in every fight card for a full month.', earned: false, glow: 'shadow-[0_0_15px_rgba(129,140,248,0.4)]' },
  { id: 'b19', title: 'Buzzer Beater', imagePath: '/badges/buzzer.png', description: 'Locked in your roster less than 15 minutes before prelims.', earned: false, glow: 'shadow-[0_0_15px_rgba(251,113,133,0.4)]' },
  { id: 'b20', title: 'Showdown King', imagePath: '/badges/swords.png', description: 'Won 5 consecutive 1v1 Showdowns.', earned: false, glow: 'shadow-[0_0_15px_rgba(34,211,238,0.4)]' },
  { id: 'b21', title: 'And New...', imagePath: '/badges/belt.png', description: 'Finished 1st place in your League for a specific event.', earned: false, glow: 'shadow-[0_0_15px_rgba(253,224,71,0.5)]' }
];

export default function Profile() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  
  // --- PROFILE STATE ---
  const [username, setUsername] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [backgroundUrl, setBackgroundUrl] = useState(null); 
  const [uploading, setUploading] = useState(false);
  const [uploadingBg, setUploadingBg] = useState(false);    
  
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const fileInputRef = useRef(null);
  const bgInputRef = useRef(null); 

  // --- PRIVACY & PREFERENCES STATE ---
  const [showOdds, setShowOdds] = useState(false); 
  const [showLockedBadges, setShowLockedBadges] = useState(false);
  
  const [privacy, setPrivacy] = useState({
      isPublic: true,
      showRecord: true,
      showEarnings: true,
      showHistory: false,
      pinnedBadgeId: null
  });

  const [userBadges, setUserBadges] = useState([]);
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
    setBackgroundUrl(profile?.background_url || null); 
    
    if (profile) {
        setShowOdds(profile.show_odds === true);
        setPrivacy({
            isPublic: profile.is_public !== false, 
            showRecord: profile.show_record !== false,
            showEarnings: profile.show_earnings !== false,
            showHistory: profile.show_history === true, 
            pinnedBadgeId: profile.pinned_badge_id || null
        });
    }

    // Fetch earned badges
    const { data: badgesData } = await supabase.from('user_badges').select('badge_id').eq('user_id', user.email);
    if (badgesData) {
        setUserBadges(badgesData.map(b => b.badge_id));
    }

    // Get Picks & Stats
    const { data: picks, error } = await supabase
      .from('picks')
      .select('*, leagues(name)') 
      .eq('user_id', user.email) 
      .order('id', { ascending: false });

    let finalPicks = picks;
    if (error) {
        const { data: fallback } = await supabase.from('picks').select('*').eq('user_id', user.email).order('id', { ascending: false });
        finalPicks = fallback;
    }

    const { data: fights } = await supabase.from('fights').select('*');
    calculateStats(finalPicks || [], fights || [], !!error);
    setLoading(false);
  };

  const handleImageUpload = async (event, bucketName, dbField, setLoadState, setUrlState) => {
    try {
      setLoadState(true);
      if (!event.target.files || event.target.files.length === 0) {
        throw new Error('You must select an image to upload.');
      }

      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${bucketName}-${Math.random()}.${fileExt}`;

      // Upload to Storage Bucket
      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get Public URL
      const { data: { publicUrl } } = supabase.storage
        .from(bucketName)
        .getPublicUrl(fileName);

      // Update Profile Table
      const { error: updateError } = await supabase
        .from('profiles')
        .upsert({ id: user.id, [dbField]: publicUrl, updated_at: new Date() });

      if (updateError) throw updateError;

      setUrlState(publicUrl);
    } catch (error) {
      alert(`Error uploading to ${bucketName}: ` + error.message);
    } finally {
      setLoadState(false);
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
      const { error } = await supabase.from('profiles').upsert({ id: user.id, show_odds: newValue, updated_at: new Date() });
      if (error) setShowOdds(!newValue);
  };

  const togglePrivacySetting = async (field) => {
    const newValue = !privacy[field];
    setPrivacy(prev => ({ ...prev, [field]: newValue })); 
    
    const dbField = field.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    
    const { error } = await supabase.from('profiles').upsert({ 
        id: user.id, 
        [dbField]: newValue, 
        updated_at: new Date() 
    });
    
    if (error) {
        console.error(`Failed to save ${field}:`, error);
        setPrivacy(prev => ({ ...prev, [field]: !newValue })); 
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

  const badgesWithStatus = AVAILABLE_BADGES.map(badge => ({
      ...badge,
      earned: userBadges.includes(badge.id)
  }));

  const visibleBadges = badgesWithStatus.filter(badge => showLockedBadges || badge.earned);

  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-pink-600 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  return (
    <main className="min-h-screen bg-black text-white pb-24 font-sans selection:bg-pink-500 selection:text-white">
      
      {/* 🎯 HEADER HERO WITH CUSTOM BACKGROUND */}
      <div className="relative border-b border-gray-800 pt-10 pb-12 px-6">
        
        {/* Background Image Layer */}
        <div 
            className="absolute inset-0 bg-gray-900 bg-cover bg-center transition-all duration-500"
            style={{ backgroundImage: backgroundUrl ? `url(${backgroundUrl})` : 'none' }}
        >
            <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/80 to-black"></div>
        </div>

        {/* 🎯 NEW: PERSISTENT EDIT COVER BUTTON */}
        <button 
            onClick={() => bgInputRef.current?.click()}
            disabled={uploadingBg}
            className="absolute top-4 right-4 z-20 bg-black/60 hover:bg-black/90 backdrop-blur-sm border border-white/20 px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest text-white transition-all flex items-center gap-2 shadow-lg"
        >
            <span className="text-sm">📷</span> {uploadingBg ? 'Uploading...' : 'Edit Cover'}
        </button>

        {/* Hidden Input for Backgrounds */}
        <input 
            type="file" 
            ref={bgInputRef} 
            onChange={(e) => handleImageUpload(e, 'backgrounds', 'background_url', setUploadingBg, setBackgroundUrl)} 
            accept="image/*" 
            className="hidden" 
            disabled={uploadingBg} 
        />

        {/* Top Nav (Z-10 keeps it above background) */}
        <div className="relative z-10 max-w-4xl mx-auto flex justify-between items-center mb-8">
            <Link href="/" className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-white transition-colors group mt-1">
                <span className="group-hover:-translate-x-1 transition-transform">←</span> Dashboard
            </Link>
            {/* Offset the logout button slightly so it doesn't crowd the Edit Cover button on mobile */}
            <div className="mr-32 sm:mr-0">
                <LogOutButton />
            </div>
        </div>

        <div className="relative z-10 max-w-xl mx-auto text-center mt-4">
            {/* AVATAR CIRCLE */}
            <div className="relative group mx-auto w-32 h-32 mb-6">
                <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-full rounded-full overflow-hidden border-4 border-black shadow-[0_0_30px_rgba(0,0,0,0.8)] bg-gray-950 cursor-pointer group-hover:border-pink-600 transition-colors relative"
                >
                    {avatarUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
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
                    onChange={(e) => handleImageUpload(e, 'avatars', 'avatar_url', setUploading, setAvatarUrl)}
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
                <div className="flex items-center justify-center gap-3 mb-2 group cursor-pointer drop-shadow-lg" onClick={() => setIsEditing(true)}>
                    <h1 className="text-3xl md:text-4xl font-black italic text-white uppercase tracking-tighter">
                        {username}
                    </h1>
                    <span className="opacity-0 group-hover:opacity-100 text-pink-600 text-sm transition-opacity">✎</span>
                </div>
            )}
            <p className="text-gray-400 text-[10px] font-bold uppercase tracking-[0.2em] drop-shadow-md">{user?.email}</p>
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

        {/* 🎯 NEW: VISIBILITY SETTINGS SECTION */}
        <div className="mb-12 bg-gray-950 border border-gray-900 rounded-xl p-5 md:p-6 shadow-xl relative overflow-hidden">
            <div className="flex items-center gap-3 mb-6 border-b border-gray-800 pb-4 relative z-10">
                <span className="text-xl">👁️</span>
                <div>
                    <h2 className="text-sm font-black text-white italic uppercase tracking-tighter">Public Visibility</h2>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Control what rivals see on your public page.</p>
                </div>
            </div>

            <div className="space-y-3 relative z-10">
                <ToggleRow 
                    label="Make Profile Public" 
                    desc="Allow others to view your profile page." 
                    state={privacy.isPublic} 
                    onToggle={() => togglePrivacySetting('isPublic')} 
                    color="bg-teal-500" 
                />
                
                <div className={`space-y-3 transition-all duration-300 ${privacy.isPublic ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
                    <ToggleRow 
                        label="Show Record & Accuracy" 
                        desc="Display your Win/Loss ratio publicly." 
                        state={privacy.showRecord} 
                        onToggle={() => togglePrivacySetting('showRecord')} 
                    />
                    <ToggleRow 
                        label="Show Total Earnings" 
                        desc="Let people see your net profit points." 
                        state={privacy.showEarnings} 
                        onToggle={() => togglePrivacySetting('showEarnings')} 
                    />
                    <ToggleRow 
                        label="Show Pick History" 
                        desc="WARNING: Sharp players keep this hidden to avoid being sniped." 
                        state={privacy.showHistory} 
                        onToggle={() => togglePrivacySetting('showHistory')} 
                        color="bg-pink-600" 
                    />
                </div>
            </div>
            {/* Ambient accent glow */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/5 blur-[80px] rounded-full pointer-events-none"></div>
        </div>

        {/* 🎯 TROPHY ROOM SECTION */}
        <div className="mb-12">
            <div className="flex items-center justify-between mb-5 px-1">
                <div className="flex items-center gap-3">
                    <span className="text-xl">🏆</span>
                    <h2 className="text-sm font-black text-white italic uppercase tracking-tighter">Trophy Room</h2>
                </div>
                
                <button 
                    onClick={() => setShowLockedBadges(!showLockedBadges)}
                    className="flex items-center gap-2 group focus:outline-none"
                >
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 group-hover:text-white transition-colors">
                        Show Locked
                    </span>
                    <div className={`relative w-8 h-4 rounded-full p-0.5 transition-colors duration-300 ${showLockedBadges ? 'bg-gray-500' : 'bg-gray-800'}`}>
                        <div 
                            className="w-3 h-3 bg-white rounded-full transition-transform duration-300 ease-in-out"
                            style={{ transform: showLockedBadges ? 'translateX(16px)' : 'translateX(0px)' }}
                        />
                    </div>
                </button>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {visibleBadges.map((badge) => (
                    <div 
                        key={badge.id} 
                        className={`relative rounded-xl p-4 flex flex-col items-center justify-center text-center transition-all duration-300 border animate-in fade-in zoom-in-95
                            ${badge.earned 
                                ? `bg-gray-900 border-gray-700 hover:border-gray-500 ${badge.glow}` 
                                : 'bg-gray-950/50 border-gray-900 opacity-50 grayscale hover:grayscale-0'
                            }
                        `}
                    >
                        {!badge.earned && (
                            <div className="absolute top-2 right-2 text-gray-700 text-[10px]">
                                🔒
                            </div>
                        )}
                        
                        {/* 🎯 UPDATED IMAGE RENDERER: Larger size (w-24 h-24), hover effect, deeper shadow */}
                        <div className={`w-24 h-24 mb-4 flex items-center justify-center transition-transform hover:scale-110 ${badge.earned ? 'opacity-100' : 'opacity-40'}`}>
                             {/* eslint-disable-next-line @next/next/no-img-element */}
                             <img src={badge.imagePath} alt={badge.title} className="max-w-full max-h-full object-contain drop-shadow-2xl" />
                        </div>

                        <h3 className={`text-[10px] font-black uppercase tracking-widest mb-1 ${badge.earned ? 'text-white' : 'text-gray-500'}`}>
                            {badge.title}
                        </h3>
                        <p className="text-[8px] font-bold text-gray-500 uppercase tracking-widest leading-relaxed">
                            {badge.description}
                        </p>
                    </div>
                ))}

                {visibleBadges.length === 0 && (
                    <div className="col-span-full p-8 border border-gray-800 border-dashed rounded-xl text-center">
                        <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">
                            No badges earned yet. Enable "Show Locked" to view targets.
                        </p>
                    </div>
                )}
            </div>
        </div>

        {/* SETTINGS TOGGLE */}
        <div className="bg-gray-950 border border-gray-900 rounded-xl p-5 flex items-center justify-between mb-12 shadow-lg">
            <div>
                <h4 className="text-xs font-black text-white uppercase tracking-widest">Show Vegas Odds</h4>
                <p className="text-[10px] text-gray-500 font-bold mt-1 max-w-[200px] md:max-w-none">Reveal potential payouts and betting lines on the dashboard.</p>
            </div>
            
            <button 
                onClick={toggleOdds}
                className={`relative w-12 h-6 rounded-full p-1 cursor-pointer transition-colors duration-300 shrink-0 border-2 border-transparent focus:outline-none ${showOdds ? 'bg-pink-600' : 'bg-gray-800'}`}
            >
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

// 🎯 NEW HELPER: Reusable Toggle Switch Row for Privacy Settings
function ToggleRow({ label, desc, state, onToggle, color = 'bg-white' }) {
    return (
        <div className="flex items-center justify-between p-3 bg-black/40 rounded-lg hover:bg-gray-900 border border-transparent hover:border-gray-800 transition-colors">
            <div>
                <h4 className="text-[11px] font-black text-white uppercase tracking-widest">{label}</h4>
                <p className="text-[9px] text-gray-500 font-bold mt-1">{desc}</p>
            </div>
            <button 
                onClick={onToggle}
                className={`relative w-10 h-5 rounded-full p-0.5 cursor-pointer transition-colors duration-300 shrink-0 border-2 border-transparent focus:outline-none ${state ? color : 'bg-gray-800'}`}
            >
                <div 
                    className="w-3.5 h-3.5 bg-black rounded-full shadow-md transition-transform duration-300 ease-in-out"
                    style={{ transform: state ? 'translateX(20px)' : 'translateX(0px)', backgroundColor: state ? 'black' : 'white' }}
                />
            </button>
        </div>
    );
}

function StatCard({ label, value, sub, color }) {
    return (
        <div className="bg-gray-950 border border-gray-900 rounded-xl p-5 text-center shadow-lg relative overflow-hidden group hover:border-gray-700 transition-colors">
            <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">{label}</div>
            <div className={`text-2xl md:text-3xl font-black italic tracking-tighter ${color}`}>{value}</div>
            {sub && <div className="text-[9px] text-gray-600 font-bold mt-1 uppercase tracking-widest">{sub}</div>}
        </div>
    );
}