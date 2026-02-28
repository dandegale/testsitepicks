'use client';

import { createClient } from '@supabase/supabase-js';
import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import LogOutButton from '../components/LogOutButton'; 
import Cropper from 'react-easy-crop'; 

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// --- FULL MASTER BADGE DATA ---
const AVAILABLE_BADGES = [
  { id: 'b1', title: 'BMF', imagePath: '/badges/bmf.png', description: '5+ chosen fighters win by knockout on a single card.', earned: false, glow: 'shadow-[0_0_15px_rgba(234,179,8,0.4)]' },
  { id: 'b2', title: 'The Sub Artist', imagePath: '/badges/sub-artist.png', description: '5+ chosen fighters win by submission on a single card.', earned: false, glow: 'shadow-[0_0_15px_rgba(255,255,255,0.4)]' },
  { id: 'b3', title: 'Flashbang', imagePath: '/badges/flashbang.png', description: 'Correctly picked a fighter who won by round 1 knockout.', earned: false, glow: 'shadow-[0_0_15px_rgba(249,115,22,0.4)]' },
  { id: 'b4', title: 'Decision Merchant', imagePath: '/badges/decision.png', description: 'All winners chosen won by decision.', earned: false, glow: 'shadow-[0_0_15px_rgba(209,213,219,0.4)]' },
  { id: 'b5', title: 'The Boss', imagePath: '/badges/boss.png', description: 'Predicted every single winner on a fight card.', earned: false, glow: 'shadow-[0_0_15px_rgba(34,197,94,0.4)]' },
  { id: 'b6', title: 'Undercard Assassin', imagePath: '/badges/assassin.png', description: 'Predicted all winners of the prelims.', earned: false, glow: 'shadow-[0_0_15px_rgba(239,68,68,0.4)]' },
  { id: 'b7', title: 'Main Event Mafia', imagePath: '/badges/mafia.png', description: 'Correctly predicted the Main Event winner 5 events in a row.', earned: false, glow: 'shadow-[0_0_15px_rgba(192,132,252,0.4)]' },
  { id: 'b8', title: 'Flawless Victory', imagePath: '/badges/fatality.png', description: 'Won a 1v1 Showdown where your opponent scored zero points.', earned: false, glow: 'shadow-[0_0_15px_rgba(220,38,38,0.6)]' },
  { id: 'b9', title: 'On Fire (3)', imagePath: '/badges/streak-3.png', description: 'Awarded for 3 correct picks in a row.', earned: false, glow: 'shadow-[0_0_15px_rgba(74,222,128,0.4)]' },
  { id: 'b10', title: 'Heating Up (5)', imagePath: '/badges/streak-5.png', description: 'Awarded for 5 correct picks in a row.', earned: false, glow: 'shadow-[0_0_15px_rgba(96,165,250,0.4)]' },
  { id: 'b11', title: 'Unstoppable (10)', imagePath: '/badges/streak-10.png', description: 'Awarded for 10 correct picks in a row.', earned: false, glow: 'shadow-[0_0_15px_rgba(236,72,153,0.4)]' },
  { id: 'b12', title: 'God Tier (25)', imagePath: '/badges/streak-25.png', description: 'Awarded for 25 correct picks in a row.', earned: false, glow: 'shadow-[0_0_15px_rgba(239,68,68,0.6)]' },
  { id: 'b13', title: 'Whale Hunter', imagePath: '/badges/whale.png', description: 'Winning pick on the biggest betting underdog of a fight card.', earned: false, glow: 'shadow-[0_0_15px_rgba(250,204,21,0.4)]' },
  { id: 'b14', title: 'The Underdog', imagePath: '/badges/underdog.png', description: 'Correctly picking every underdog who won on a fight card.', earned: false, glow: 'shadow-[0_0_15px_rgba(217,119,6,0.4)]' },
  { id: 'b15', title: 'Chalk Eater', imagePath: '/badges/chalk.png', description: 'Your last 10 correct picks were all heavy favorites.', earned: false, glow: 'shadow-[0_0_15px_rgba(191,219,254,0.4)]' },
  { id: 'b16', title: 'Hail Mary', imagePath: '/badges/hail-mary.png', description: 'Won your League week via a massive underdog in the Main Event.', earned: false, glow: 'shadow-[0_0_15px_rgba(45,212,191,0.4)]' },
  { id: 'b17', title: '2-3 Years Needed', imagePath: '/badges/mountain.png', description: 'Most fighters lost by submission in a league event.', earned: false, glow: 'shadow-[0_0_15px_rgba(148,163,184,0.4)]' },
  { id: 'b18', title: 'Event Master', imagePath: '/badges/calendar.png', description: 'Participated in every fight card for a full month.', earned: false, glow: 'shadow-[0_0_15px_rgba(129,140,248,0.4)]' },
  { id: 'b19', title: 'Buzzer Beater', imagePath: '/badges/buzzer.png', description: 'Locked in your roster less than 15 minutes before prelims.', earned: false, glow: 'shadow-[0_0_15px_rgba(251,113,133,0.4)]' },
  { id: 'b20', title: 'Showdown King', imagePath: '/badges/swords.png', description: 'Won 5 consecutive 1v1 Showdowns.', earned: false, glow: 'shadow-[0_0_15px_rgba(34,211,238,0.4)]' },
  { id: 'b21', title: 'And New...', imagePath: '/badges/belt.png', description: 'Finished 1st place in your League for a specific event.', earned: false, glow: 'shadow-[0_0_15px_rgba(253,224,71,0.5)]' }
];

export default function Profile() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  
  const [username, setUsername] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [backgroundUrl, setBackgroundUrl] = useState(null); 
  const [uploading, setUploading] = useState(false);
  const [uploadingBg, setUploadingBg] = useState(false);    
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // 🎯 NEW: XP State
  const [lifetimePoints, setLifetimePoints] = useState(0);

  const fileInputRef = useRef(null);
  const bgInputRef = useRef(null); 

  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [imageToCrop, setImageToCrop] = useState(null);
  const [cropType, setCropType] = useState('backgrounds'); 
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  const [showOdds, setShowOdds] = useState(false); 
  const [showLockedBadges, setShowLockedBadges] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const [privacy, setPrivacy] = useState({
      isPublic: true, showRecord: true, showEarnings: true, showHistory: false, pinnedBadgeId: null
  });

  const [userBadges, setUserBadges] = useState([]);
  const [stats, setStats] = useState({ totalBets: 0, wins: 0, losses: 0, pending: 0, netProfit: 0 });
  const [history, setHistory] = useState([]);
  const router = useRouter();

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }
    setUser(user);

    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    const finalName = profile?.username || user.user_metadata?.username || user.email?.split('@')[0] || 'Fighter';
    setUsername(finalName);
    setNewUsername(finalName); 
    setAvatarUrl(profile?.avatar_url || null);
    setBackgroundUrl(profile?.background_url || null); 
    
    // 🎯 Set Lifetime Points
    setLifetimePoints(profile?.lifetime_points || 0);
    
    if (profile) {
        setShowOdds(profile.show_odds === true);
        setPrivacy({
            isPublic: profile.is_public !== false, showRecord: profile.show_record !== false,
            showEarnings: profile.show_earnings !== false, showHistory: profile.show_history === true, 
            pinnedBadgeId: profile.pinned_badge_id || null
        });
    }

    const { data: badgesData } = await supabase.from('user_badges').select('badge_id').eq('user_id', user.email);
    if (badgesData) setUserBadges(badgesData.map(b => b.badge_id));

    const { data: picks, error } = await supabase.from('picks').select('*, leagues(name)').eq('user_id', user.email).order('id', { ascending: false });
    let finalPicks = picks;
    if (error) {
        const { data: fallback } = await supabase.from('picks').select('*').eq('user_id', user.email).order('id', { ascending: false });
        finalPicks = fallback;
    }

    const { data: fights } = await supabase.from('fights').select('*');
    calculateStats(finalPicks || [], fights || [], !!error);
    setLoading(false);
  };

  const handleSaveProfile = async () => {
    if (!newUsername.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('profiles').upsert({ id: user.id, username: newUsername, updated_at: new Date() });
    if (!error) {
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
    const { error } = await supabase.from('profiles').upsert({ id: user.id, [dbField]: newValue, updated_at: new Date() });
    if (error) setPrivacy(prev => ({ ...prev, [field]: !newValue })); 
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
                profitChange = (odds > 0 ? (odds / 100) * 10 : (100 / Math.abs(odds)) * 10) + 10; 
            } else {
                result = 'Loss'; losses++;
                profitChange = -10; 
            }
        } else { result = 'Pending'; pending++; }
        if (result !== 'Pending') netProfit += profitChange;
        
        let leagueName = 'Global';
        if (!missingLeagues && pick.leagues) {
            leagueName = Array.isArray(pick.leagues) ? pick.leagues[0]?.name : pick.leagues.name;
        }
        historyData.push({ id: pick.id, fightName, selection: pick.selected_fighter, odds: pick.odds_at_pick, result, profitChange, leagueName });
    });
    setStats({ totalBets: picks.length, wins, losses, pending, netProfit: parseFloat(netProfit.toFixed(1)) });
    setHistory(historyData);
  };

  const onFileChange = async (e, type) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      let imageDataUrl = await readFile(file);
      setImageToCrop(imageDataUrl);
      setCropType(type); 
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCropModalOpen(true);
      
      if (bgInputRef.current) bgInputRef.current.value = '';
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleCropSave = async () => {
    try {
      if (cropType === 'backgrounds') setUploadingBg(true);
      else setUploading(true);
      
      setCropModalOpen(false); 

      const croppedImageBlob = await getCroppedImg(imageToCrop, croppedAreaPixels);
      const fileName = `${user.id}-${cropType}-${Math.random()}.jpg`;

      const { error: uploadError } = await supabase.storage.from(cropType).upload(fileName, croppedImageBlob, { contentType: 'image/jpeg' });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from(cropType).getPublicUrl(fileName);
      const dbField = cropType === 'backgrounds' ? 'background_url' : 'avatar_url';

      const { error: updateError } = await supabase.from('profiles').upsert({ id: user.id, [dbField]: publicUrl, updated_at: new Date() });
      if (updateError) throw updateError;

      if (cropType === 'backgrounds') setBackgroundUrl(publicUrl);
      else setAvatarUrl(publicUrl);

    } catch (error) {
      alert(`Error uploading image: ` + error.message);
    } finally {
      setUploadingBg(false);
      setUploading(false);
      setImageToCrop(null);
    }
  };

  const badgesWithStatus = AVAILABLE_BADGES.map(badge => ({ ...badge, earned: userBadges.includes(badge.id) }));
  const visibleBadges = badgesWithStatus.filter(badge => showLockedBadges || badge.earned);
  const earnedCount = badgesWithStatus.filter(b => b.earned).length;

  // 🎯 Calculate Level dynamically using useMemo
  const levelStats = useMemo(() => calculateLevel(lifetimePoints), [lifetimePoints]);

  if (loading) return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-pink-600/20 blur-[100px] rounded-full"></div>
        <div className="w-12 h-12 border-4 border-pink-600 border-t-transparent rounded-full animate-spin relative z-10"></div>
    </div>
  );

  return (
    <main className="min-h-screen bg-[#050505] text-white pb-24 font-sans selection:bg-teal-500 selection:text-white relative overflow-hidden">
      
      {/* CROPPING MODAL */}
      {cropModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-xl p-4 md:p-12">
              <div className="w-full max-w-4xl bg-gray-950 border border-teal-500/30 rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(20,184,166,0.15)] flex flex-col h-[80vh] md:h-auto md:aspect-[4/3] max-h-screen animate-in fade-in zoom-in-95">
                  <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50">
                      <h3 className="font-black italic uppercase text-teal-400 tracking-widest">
                          Adjust {cropType === 'backgrounds' ? 'Cover Photo' : 'Avatar'}
                      </h3>
                      <button onClick={() => setCropModalOpen(false)} className="text-gray-500 hover:text-white transition-colors">✕</button>
                  </div>
                  <div className="relative flex-grow bg-black">
                      <Cropper
                          image={imageToCrop}
                          crop={crop}
                          zoom={zoom}
                          aspect={cropType === 'backgrounds' ? 21 / 9 : 1}
                          cropShape={cropType === 'avatars' ? 'round' : 'rect'}
                          onCropChange={setCrop}
                          onCropComplete={onCropComplete}
                          onZoomChange={setZoom}
                      />
                  </div>
                  <div className="p-4 md:p-6 border-t border-gray-800 bg-gray-900/50 flex flex-col md:flex-row items-center justify-between gap-4">
                      <div className="flex items-center gap-4 w-full md:w-1/2">
                          <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Zoom</span>
                          <input 
                              type="range" min={1} max={3} step={0.1} value={zoom} onChange={(e) => setZoom(e.target.value)} 
                              className="w-full accent-teal-500 bg-gray-800 h-1.5 rounded-lg appearance-none cursor-pointer"
                          />
                      </div>
                      <div className="flex items-center gap-3 w-full md:w-auto">
                          <button onClick={() => setCropModalOpen(false)} className="flex-1 md:flex-none px-6 py-2.5 rounded-full text-xs font-black uppercase tracking-widest text-gray-400 hover:bg-gray-800 transition-colors">Cancel</button>
                          <button onClick={handleCropSave} className="flex-1 md:flex-none px-6 py-2.5 rounded-full text-xs font-black uppercase tracking-widest bg-teal-500 text-black hover:bg-teal-400 transition-colors shadow-[0_0_15px_rgba(20,184,166,0.3)]">Save Image</button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* AMBIENT THEME GLOWS */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
          <div className="absolute top-[10%] left-[5%] w-[400px] h-[400px] bg-pink-600/10 rounded-full blur-[150px]"></div>
          <div className="absolute top-[40%] right-[5%] w-[500px] h-[500px] bg-teal-500/10 rounded-full blur-[150px]"></div>
          <div className="absolute bottom-[-10%] left-[20%] w-[600px] h-[600px] bg-pink-900/10 rounded-full blur-[180px]"></div>
      </div>

      {/* HERO SECTION */}
      <div className="relative min-h-[45vh] w-full border-b border-pink-500/10 flex flex-col z-10 pb-8">
        <div 
            className="absolute inset-0 bg-gray-900 bg-cover bg-center transition-all duration-700"
            style={{ backgroundImage: backgroundUrl ? `url(${backgroundUrl})` : 'none' }}
        >
            <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/80 to-transparent"></div>
            <div className="absolute inset-0 bg-gradient-to-r from-[#050505] via-[#050505]/50 to-transparent opacity-90"></div>
        </div>

        <input type="file" ref={bgInputRef} onChange={(e) => onFileChange(e, 'backgrounds')} accept="image/*" className="hidden" />

        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 pt-6 flex justify-between items-center">
            <Link href="/" className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-white/50 hover:text-pink-400 transition-colors group">
                <span className="group-hover:-translate-x-1 transition-transform">←</span> Dashboard
            </Link>
            <div className="flex items-center gap-3">
                <button 
                    onClick={() => bgInputRef.current?.click()}
                    disabled={uploadingBg || cropModalOpen}
                    className="bg-black/40 hover:bg-black/80 backdrop-blur-md border border-teal-500/30 px-3 py-1.5 md:px-4 md:py-2 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-widest text-teal-400 hover:text-teal-300 hover:border-teal-500/60 transition-all flex items-center gap-1 md:gap-2"
                >
                    <span>📷</span> <span className="hidden sm:inline">{uploadingBg ? 'Saving...' : 'Edit Cover'}</span>
                </button>
                <LogOutButton />
            </div>
        </div>

        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 mt-auto flex flex-col md:flex-row items-center md:items-start gap-6 pt-16">
            <div className="relative group w-32 h-32 md:w-40 md:h-40 shrink-0">
                <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-full rounded-2xl overflow-hidden border-4 border-[#050505] shadow-[0_0_30px_rgba(20,184,166,0.15)] bg-gray-900 cursor-pointer group-hover:border-teal-400 transition-all relative transform md:translate-y-4"
                >
                    {avatarUrl ? (
                        <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-5xl font-black text-teal-700 bg-gradient-to-br from-gray-900 to-black">
                            {username.charAt(0).toUpperCase()}
                        </div>
                    )}
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
                        <span className="text-xs font-black uppercase text-teal-400 tracking-widest">{uploading ? '...' : 'Upload'}</span>
                    </div>
                </div>
                <input type="file" ref={fileInputRef} onChange={(e) => onFileChange(e, 'avatars')} accept="image/*" className="hidden" />
            </div>

            <div className="text-center md:text-left flex-1 w-full max-w-md">
                {isEditing ? (
                    <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
                        <input 
                            type="text" 
                            value={newUsername} 
                            onChange={(e) => setNewUsername(e.target.value)}
                            className="bg-black/50 backdrop-blur-md border border-teal-500 text-white text-2xl md:text-4xl font-black italic uppercase px-4 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400 w-[250px]"
                            autoFocus
                        />
                        <button onClick={handleSaveProfile} className="bg-teal-500 h-12 w-12 rounded-xl text-black font-black hover:bg-teal-400 transition-colors">✓</button>
                    </div>
                ) : (
                    <div className="flex items-center justify-center md:justify-start gap-3 group cursor-pointer mb-2" onClick={() => setIsEditing(true)}>
                        <h1 className="text-4xl md:text-5xl font-black italic text-white uppercase tracking-tighter drop-shadow-lg">
                            {username}
                        </h1>
                        <span className="opacity-0 group-hover:opacity-100 text-teal-400 text-lg transition-opacity">✎</span>
                    </div>
                )}
                
                <div className="flex items-center justify-center md:justify-start gap-3 mb-6">
                    <span className="bg-pink-950/30 text-pink-400 border border-pink-500/30 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest shadow-[0_0_10px_rgba(219,39,119,0.1)]">
                        Manager
                    </span>
                    <p className="text-white/40 text-[10px] font-bold uppercase tracking-[0.2em]">{user?.email}</p>
                </div>

                {/* 🎯 NEW: XP & LEVEL BAR */}
                <div className="w-full bg-black/40 backdrop-blur-sm border border-gray-800/50 p-4 rounded-2xl shadow-xl">
                    <div className="flex items-end justify-between mb-2">
                        <div className="flex items-center gap-2.5">
                            <div className="bg-gradient-to-br from-pink-600 to-teal-500 border border-teal-400/50 text-white w-7 h-7 flex items-center justify-center rounded-lg text-xs font-black shadow-[0_0_15px_rgba(20,184,166,0.3)]">
                                {levelStats.level}
                            </div>
                            <span className="text-xs font-black text-gray-300 uppercase tracking-widest drop-shadow-md">Level {levelStats.level}</span>
                        </div>
                        <span className="text-[10px] font-bold text-teal-400 font-mono tracking-wider">
                            {levelStats.currentXP} <span className="text-gray-500">/ {levelStats.nextLevelXP} XP</span>
                        </span>
                    </div>
                    
                    <div className="w-full h-2.5 bg-gray-900 rounded-full overflow-hidden border border-gray-800 shadow-inner">
                        <div 
                            className="h-full bg-gradient-to-r from-pink-600 via-pink-500 to-teal-400 transition-all duration-1000 ease-out relative"
                            style={{ width: `${levelStats.progressPercentage}%` }}
                        >
                            <div className="absolute right-0 top-0 bottom-0 w-3 bg-white/60 blur-[2px]"></div>
                        </div>
                    </div>
                    <div className="text-right mt-1.5">
                        <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Total Lifetime: {Math.floor(lifetimePoints)} PTS</span>
                    </div>
                </div>

            </div>
        </div>
      </div>

      {/* DASHBOARD GRID */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
        
        {/* LEFT COLUMN */}
        <div className="lg:col-span-4 space-y-8">
            <div className="bg-black/40 backdrop-blur-xl border border-teal-900/40 rounded-3xl p-6 shadow-2xl hover:border-teal-500/40 transition-colors">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-2 h-8 bg-gradient-to-b from-teal-400 to-pink-500 rounded-full"></div>
                    <h2 className="text-sm font-black text-white italic uppercase tracking-widest">Tale of the Tape</h2>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <StatGlass label="Record" value={`${stats.wins}-${stats.losses}`} color="text-white" />
                    <StatGlass label="Accuracy" value={`${stats.totalBets > 0 ? Math.round((stats.wins / (stats.wins + stats.losses)) * 100) : 0}%`} color="text-teal-400 glow-teal" />
                    <StatGlass label="Pending" value={stats.pending} color="text-white/80" />
                    <StatGlass label="Earnings" value={`${stats.netProfit >= 0 ? '+' : ''}${stats.netProfit}`} color={stats.netProfit >= 0 ? 'text-teal-400' : 'text-pink-500'} />
                </div>
            </div>

            <div className="bg-black/40 backdrop-blur-xl border border-teal-900/40 rounded-3xl p-6 shadow-2xl relative overflow-hidden hover:border-teal-500/40 transition-colors">
                <div className="flex items-center gap-3 mb-6 relative z-10">
                    <span className="text-xl drop-shadow-[0_0_10px_rgba(20,184,166,0.8)]">👁️</span>
                    <div>
                        <h2 className="text-sm font-black text-white italic uppercase tracking-widest">Visibility</h2>
                        <p className="text-[9px] text-teal-500/60 font-bold uppercase tracking-widest mt-1">Control public data.</p>
                    </div>
                </div>
                <div className="space-y-2 relative z-10">
                    <ToggleRow label="Public Profile" state={privacy.isPublic} onToggle={() => togglePrivacySetting('isPublic')} color="bg-teal-500" />
                    <div className={`space-y-2 transition-all duration-300 ${privacy.isPublic ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
                        <ToggleRow label="Show Record" state={privacy.showRecord} onToggle={() => togglePrivacySetting('showRecord')} color="bg-pink-500" />
                        <ToggleRow label="Show Earnings" state={privacy.showEarnings} onToggle={() => togglePrivacySetting('showEarnings')} color="bg-pink-500" />
                        <ToggleRow label="Show History" state={privacy.showHistory} onToggle={() => togglePrivacySetting('showHistory')} color="bg-pink-500" />
                    </div>
                </div>
            </div>

            <div className="bg-black/40 backdrop-blur-xl border border-pink-900/40 rounded-3xl p-6 shadow-2xl flex items-center justify-between hover:border-pink-500/40 transition-colors">
                <div>
                    <h4 className="text-xs font-black text-white uppercase tracking-widest">Vegas Odds</h4>
                    <p className="text-[9px] text-pink-400/60 font-bold mt-1 uppercase tracking-widest">Show betting lines globally.</p>
                </div>
                <button onClick={toggleOdds} className={`relative w-12 h-6 rounded-full p-1 transition-colors duration-300 focus:outline-none shadow-[0_0_10px_rgba(219,39,119,0.2)] ${showOdds ? 'bg-pink-600' : 'bg-gray-800'}`}>
                    <div className="w-4 h-4 bg-black rounded-full shadow-md transition-transform duration-300" style={{ transform: showOdds ? 'translateX(24px)' : 'translateX(0px)' }} />
                </button>
            </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="lg:col-span-8 space-y-8">
            <div className="bg-black/40 backdrop-blur-xl border border-teal-900/40 hover:border-teal-500/40 transition-colors rounded-3xl p-6 md:p-8 shadow-2xl">
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <img src="/trophy.png" alt="Trophies" className="w-10 h-10 md:w-12 md:h-12 object-contain drop-shadow-[0_0_15px_rgba(234,179,8,0.6)] hover:scale-110 transition-transform" />
                            <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter">Trophy Room</h2>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-32 h-1.5 bg-gray-900 rounded-full overflow-hidden shadow-inner">
                                <div className="h-full bg-gradient-to-r from-pink-600 to-teal-400" style={{ width: `${Math.round((earnedCount/AVAILABLE_BADGES.length)*100)}%` }}></div>
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-teal-500/70">{earnedCount} / {AVAILABLE_BADGES.length} Unlocked</span>
                        </div>
                    </div>
                    <button onClick={() => setShowLockedBadges(!showLockedBadges)} className="flex items-center gap-2 group bg-teal-950/20 hover:bg-teal-900/40 border border-teal-900/50 hover:border-teal-500/50 px-4 py-2 rounded-xl transition-colors">
                        <span className="text-[10px] font-black uppercase tracking-widest text-teal-500/70 group-hover:text-teal-400 transition-colors">Reveal Locked</span>
                        <div className={`relative w-6 h-3 rounded-full p-0.5 transition-colors ${showLockedBadges ? 'bg-teal-500' : 'bg-gray-800'}`}>
                            <div className="w-2 h-2 bg-black rounded-full transition-transform" style={{ transform: showLockedBadges ? 'translateX(12px)' : 'translateX(0px)' }} />
                        </div>
                    </button>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {visibleBadges.map((badge) => (
                        <div key={badge.id} className={`relative rounded-2xl p-4 flex flex-col items-center justify-center text-center transition-all duration-300 animate-in fade-in zoom-in-95
                            ${badge.earned ? `bg-teal-950/10 border border-pink-500/20 hover:border-pink-500/60 ${badge.glow}` : 'bg-black/60 border border-gray-800 opacity-40 grayscale hover:grayscale-0'}`}>
                            {!badge.earned && <div className="absolute top-3 right-3 text-gray-600 text-xs">🔒</div>}
                            <div className={`w-20 h-20 md:w-24 md:h-24 mb-4 flex items-center justify-center transition-transform hover:scale-110 ${badge.earned ? 'opacity-100' : 'opacity-50'}`}>
                                 <img src={badge.imagePath} alt={badge.title} className="max-w-full max-h-full object-contain drop-shadow-2xl" />
                            </div>
                            <h3 className={`text-[11px] font-black uppercase tracking-widest mb-1.5 ${badge.earned ? 'text-white' : 'text-gray-500'}`}>{badge.title}</h3>
                            <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest leading-relaxed">{badge.description}</p>
                        </div>
                    ))}
                    {visibleBadges.length === 0 && (
                        <div className="col-span-full py-12 border border-gray-800 border-dashed rounded-2xl text-center">
                            <p className="text-gray-600 text-[10px] font-bold uppercase tracking-widest">No badges earned. Enable "Reveal Locked" to view targets.</p>
                        </div>
                    )}
                </div>
            </div>

            <div className={`bg-black/40 backdrop-blur-xl transition-all duration-500 ease-in-out rounded-3xl shadow-2xl overflow-hidden border ${
                isHistoryOpen 
                ? 'border-pink-500/40 shadow-[0_0_30px_rgba(219,39,119,0.1)]' 
                : 'border-teal-900/40 hover:border-teal-500/50'
            }`}>
                <div 
                    className="flex items-center justify-between p-6 md:p-8 cursor-pointer group select-none bg-transparent"
                    onClick={() => setIsHistoryOpen(!isHistoryOpen)}
                >
                    <div className="flex items-center gap-3">
                        <span className={`w-2.5 h-2.5 rounded-full animate-pulse transition-colors ${
                            isHistoryOpen ? 'bg-pink-500 shadow-[0_0_10px_rgba(219,39,119,0.8)]' : 'bg-teal-500 shadow-[0_0_10px_rgba(20,184,166,0.8)]'
                        }`}></span>
                        <h2 className={`text-xl font-black italic uppercase tracking-tighter transition-colors ${
                            isHistoryOpen ? 'text-pink-400' : 'text-white group-hover:text-teal-400'
                        }`}>Fight History</h2>
                    </div>
                    
                    <div className={`p-2 rounded-full transition-all duration-300 border ${
                        isHistoryOpen 
                        ? 'bg-pink-500/10 border-pink-500/40 rotate-180 text-pink-400' 
                        : 'bg-teal-950/20 border-teal-900/50 group-hover:bg-teal-500/20 group-hover:border-teal-500/50 text-teal-600 group-hover:text-teal-400'
                    }`}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                        </svg>
                    </div>
                </div>

                <div className={`grid transition-all duration-500 ease-in-out ${isHistoryOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                    <div className="overflow-hidden min-h-0">
                        <div className="px-6 md:px-8 pb-6 md:pb-8">
                            {history.length === 0 ? (
                                <div className="py-12 text-center bg-gray-900/30 rounded-2xl border border-gray-800">
                                    <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">No history recorded yet.</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {history.map((item) => (
                                        <div key={item.id} className="p-4 rounded-2xl bg-black/60 hover:bg-black/80 border border-gray-800 hover:border-pink-500/30 transition-all flex items-center justify-between group">
                                            <div>
                                                <div className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mb-1">{item.leagueName}</div>
                                                <div className="font-black text-white text-sm md:text-lg uppercase tracking-tighter group-hover:text-pink-400 transition-colors">{item.selection}</div>
                                                <div className="text-[10px] text-gray-600 font-bold uppercase mt-1">{item.fightName}</div>
                                            </div>
                                            <div className="text-right flex flex-col items-end">
                                                <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg mb-2 border ${
                                                    item.result === 'Win' ? 'bg-teal-950/30 text-teal-400 border-teal-900/50 shadow-[0_0_10px_rgba(20,184,166,0.1)]' : 
                                                    item.result === 'Loss' ? 'bg-pink-950/30 text-pink-400 border-pink-900/50 shadow-[0_0_10px_rgba(219,39,119,0.1)]' : 
                                                    'bg-gray-900 text-gray-500 border-gray-800'
                                                }`}>
                                                    {item.result}
                                                </span>
                                                <div className={`text-sm md:text-base font-black italic tracking-tighter ${item.profitChange > 0 ? 'text-teal-400' : item.profitChange < 0 ? 'text-pink-400' : 'text-gray-600'}`}>
                                                    {item.result === 'Pending' ? '---' : `${item.profitChange > 0 ? '+' : ''}${item.profitChange.toFixed(1)} PTS`}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

            </div>

        </div>
      </div>
    </main>
  );
}

// ----------------------------------------------------------------------
// 🎯 LEVELING MATH ENGINE
// ----------------------------------------------------------------------
function calculateLevel(totalPoints) {
    let level = 1;
    let xpNeededForNext = 100;
    let currentXP = totalPoints || 0;

    while (currentXP >= xpNeededForNext) {
        currentXP -= xpNeededForNext;
        level++;
        xpNeededForNext += 10;
    }

    const progressPercentage = Math.min(100, Math.max(0, (currentXP / xpNeededForNext) * 100));

    return {
        level,
        currentXP: Math.floor(currentXP),
        nextLevelXP: xpNeededForNext,
        progressPercentage
    };
}

// ----------------------------------------------------------------------
// UTILITY FUNCTIONS FOR CANVAS CROPPING
// ----------------------------------------------------------------------

function readFile(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(reader.result), false);
    reader.readAsDataURL(file);
  });
}

const createImage = (url) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.setAttribute('crossOrigin', 'anonymous'); 
    image.src = url;
  });

async function getCroppedImg(imageSrc, pixelCrop) {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) return null;

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob((file) => {
      if (file) resolve(file);
      else reject(new Error('Canvas is empty'));
    }, 'image/jpeg', 0.9);
  });
}

// --- STANDARD COMPONENTS ---

function StatGlass({ label, value, color }) {
    return (
        <div className="bg-teal-950/10 border border-teal-900/40 rounded-2xl p-4 text-center hover:bg-teal-900/20 hover:border-teal-500/40 transition-all">
            <div className="text-[9px] font-black text-teal-500/60 uppercase tracking-widest mb-1">{label}</div>
            <div className={`text-xl md:text-2xl font-black italic tracking-tighter ${color}`}>{value}</div>
        </div>
    );
}

function ToggleRow({ label, state, onToggle, color = 'bg-teal-500' }) {
    return (
        <div className="flex items-center justify-between py-3 px-4 bg-black/40 rounded-xl border border-transparent hover:border-teal-500/30 transition-colors">
            <h4 className="text-[10px] font-black text-white/80 uppercase tracking-widest">{label}</h4>
            <button onClick={onToggle} className={`relative w-10 h-5 rounded-full p-0.5 transition-all shadow-inner focus:outline-none ${state ? color : 'bg-gray-800'}`}>
                <div className="w-4 h-4 rounded-full shadow-md transition-transform" style={{ transform: state ? 'translateX(20px)' : 'translateX(0px)', backgroundColor: state ? '#0a0a0a' : 'white' }} />
            </button>
        </div>
    );
}