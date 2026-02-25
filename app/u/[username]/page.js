'use client';

import { createClient } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// --- FULL MASTER BADGE DATA WITH IMAGES ---
const AVAILABLE_BADGES = [
  { id: 'b1', title: 'BMF', imagePath: '/badges/bmf.png', description: '5+ chosen fighters win by knockout on a single card.', glow: 'shadow-[0_0_15px_rgba(234,179,8,0.4)]' },
  { id: 'b2', title: 'The Sub Artist', imagePath: '/badges/sub-artist.png', description: '5+ chosen fighters win by submission on a single card.', glow: 'shadow-[0_0_15px_rgba(255,255,255,0.4)]' },
  { id: 'b3', title: 'Flashbang', imagePath: '/badges/flashbang.png', description: 'Correctly picked a fighter who won by round 1 knockout.', glow: 'shadow-[0_0_15px_rgba(249,115,22,0.4)]' },
  { id: 'b4', title: 'Decision Merchant', imagePath: '/badges/decision.png', description: 'All winners chosen won by decision.', glow: 'shadow-[0_0_15px_rgba(209,213,219,0.4)]' },
  { id: 'b5', title: 'The Boss', imagePath: '/badges/boss.png', description: 'Predicted every single winner on a fight card.', glow: 'shadow-[0_0_15px_rgba(34,197,94,0.4)]' },
  { id: 'b6', title: 'Undercard Assassin', imagePath: '/badges/assassin.png', description: 'Predicted all winners of the prelims.', glow: 'shadow-[0_0_15px_rgba(239,68,68,0.4)]' },
  { id: 'b7', title: 'Main Event Mafia', imagePath: '/badges/mafia.png', description: 'Correctly predicted the Main Event winner 5 events in a row.', glow: 'shadow-[0_0_15px_rgba(192,132,252,0.4)]' },
  { id: 'b8', title: 'Flawless Victory', imagePath: '/badges/fatality.png', description: 'Won a 1v1 Showdown where your opponent scored zero points.', glow: 'shadow-[0_0_15px_rgba(220,38,38,0.6)]' },
  { id: 'b9', title: 'On Fire (3)', imagePath: '/badges/streak-3.png', description: 'Awarded for 3 correct picks in a row.', glow: 'shadow-[0_0_15px_rgba(74,222,128,0.4)]' },
  { id: 'b10', title: 'Heating Up (5)', imagePath: '/badges/streak-5.png', description: 'Awarded for 5 correct picks in a row.', glow: 'shadow-[0_0_15px_rgba(96,165,250,0.4)]' },
  { id: 'b11', title: 'Unstoppable (10)', imagePath: '/badges/streak-10.png', description: 'Awarded for 10 correct picks in a row.', glow: 'shadow-[0_0_15px_rgba(236,72,153,0.4)]' },
  { id: 'b12', title: 'God Tier (25)', imagePath: '/badges/streak-25.png', description: 'Awarded for 25 correct picks in a row.', glow: 'shadow-[0_0_15px_rgba(239,68,68,0.6)]' },
  { id: 'b13', title: 'Whale Hunter', imagePath: '/badges/whale.png', description: 'Winning pick on the biggest betting underdog of a fight card.', glow: 'shadow-[0_0_15px_rgba(250,204,21,0.4)]' },
  { id: 'b14', title: 'The Underdog', imagePath: '/badges/underdog.png', description: 'Correctly picking every underdog who won on a fight card.', glow: 'shadow-[0_0_15px_rgba(217,119,6,0.4)]' },
  { id: 'b15', title: 'Chalk Eater', imagePath: '/badges/chalk.png', description: 'Your last 10 correct picks were all heavy favorites.', glow: 'shadow-[0_0_15px_rgba(191,219,254,0.4)]' },
  { id: 'b16', title: 'Hail Mary', imagePath: '/badges/hail-mary.png', description: 'Won your League week via a massive underdog in the Main Event.', glow: 'shadow-[0_0_15px_rgba(45,212,191,0.4)]' },
  { id: 'b17', title: '2-3 Years Needed', imagePath: '/badges/mountain.png', description: 'Most fighters lost by submission in a league event.', glow: 'shadow-[0_0_15px_rgba(148,163,184,0.4)]' },
  { id: 'b18', title: 'Event Master', imagePath: '/badges/calendar.png', description: 'Participated in every fight card for a full month.', glow: 'shadow-[0_0_15px_rgba(129,140,248,0.4)]' },
  { id: 'b19', title: 'Buzzer Beater', imagePath: '/badges/buzzer.png', description: 'Locked in your roster less than 15 minutes before prelims.', glow: 'shadow-[0_0_15px_rgba(251,113,133,0.4)]' },
  { id: 'b20', title: 'Showdown King', imagePath: '/badges/swords.png', description: 'Won 5 consecutive 1v1 Showdowns.', glow: 'shadow-[0_0_15px_rgba(34,211,238,0.4)]' },
  { id: 'b21', title: 'And New...', imagePath: '/badges/belt.png', description: 'Finished 1st place in your League for a specific event.', glow: 'shadow-[0_0_15px_rgba(253,224,71,0.5)]' }
];

export default function PublicProfile() {
  const params = useParams();
  const rawUsername = params.username; 
  const decodedUsername = decodeURIComponent(rawUsername);

  const [loading, setLoading] = useState(true);
  const [profileExists, setProfileExists] = useState(true);
  
  const [profile, setProfile] = useState(null);
  const [userBadges, setUserBadges] = useState([]);
  const [stats, setStats] = useState({ totalBets: 0, wins: 0, losses: 0, pending: 0, netProfit: 0 });
  const [history, setHistory] = useState([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  useEffect(() => {
    fetchPublicData();
  }, [decodedUsername]);

  const fetchPublicData = async () => {
    const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .ilike('username', decodedUsername) 
        .single();

    if (profileError || !profileData) {
        setProfileExists(false);
        setLoading(false);
        return;
    }

    setProfile(profileData);

    if (profileData.is_public === false) {
        setLoading(false);
        return;
    }

    const userEmail = profileData.email;
    if (!userEmail) {
        console.warn("No email found on this profile to link stats.");
        setLoading(false);
        return;
    }

    const { data: badgesData } = await supabase.from('user_badges').select('badge_id').eq('user_id', userEmail);
    if (badgesData) setUserBadges(badgesData.map(b => b.badge_id));

    const { data: picks } = await supabase.from('picks').select('*, leagues(name)').eq('user_id', userEmail).order('id', { ascending: false });
    const { data: fights } = await supabase.from('fights').select('*');
    
    calculateStats(picks || [], fights || []);
    setLoading(false);
  };

  const calculateStats = (picks, fights) => {
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
        if (pick.leagues) {
            if (Array.isArray(pick.leagues) && pick.leagues.length > 0) leagueName = pick.leagues[0].name;
            else if (typeof pick.leagues === 'object' && pick.leagues.name) leagueName = pick.leagues.name;
        }

        historyData.push({ id: pick.id, fightName, selection: pick.selected_fighter, odds: pick.odds_at_pick, result, profitChange, leagueName });
    });

    setStats({ totalBets: picks.length, wins, losses, pending, netProfit: parseFloat(netProfit.toFixed(1)) });
    setHistory(historyData);
  };

  // 🎯 ONLY Grab the earned badges to render on the public page
  const earnedBadgesToDisplay = AVAILABLE_BADGES.filter(badge => userBadges.includes(badge.id));
  const earnedCount = earnedBadgesToDisplay.length;

  if (loading) return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-pink-600/20 blur-[100px] rounded-full"></div>
        <div className="w-12 h-12 border-4 border-pink-600 border-t-transparent rounded-full animate-spin relative z-10"></div>
    </div>
  );

  if (!profileExists) return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center text-center p-6 relative overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-red-900/10 blur-[150px] rounded-full"></div>
          <span className="text-5xl mb-6 relative z-10 drop-shadow-xl">👻</span>
          <h1 className="text-3xl font-black italic text-white uppercase tracking-tighter mb-2 relative z-10">Fighter Not Found</h1>
          <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-8 relative z-10">This profile does not exist or has been deleted.</p>
          <Link href="/" className="bg-pink-950/30 border border-pink-900/50 hover:bg-pink-900/50 px-6 py-3 rounded-full text-pink-400 text-[10px] font-black uppercase tracking-widest transition-all relative z-10">
              ← Return to Base
          </Link>
      </div>
  );

  const isPublic = profile.is_public !== false;
  const showRecord = profile.show_record !== false;
  const showEarnings = profile.show_earnings !== false;
  const showHistory = profile.show_history === true;

  return (
    <main className="min-h-screen bg-[#050505] text-white pb-24 font-sans selection:bg-teal-500 selection:text-white relative overflow-hidden">
      
      {/* 🌟 AMBIENT THEME GLOWS */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
          <div className="absolute top-[10%] left-[5%] w-[400px] h-[400px] bg-pink-600/10 rounded-full blur-[150px]"></div>
          <div className="absolute top-[40%] right-[5%] w-[500px] h-[500px] bg-teal-500/10 rounded-full blur-[150px]"></div>
          <div className="absolute bottom-[-10%] left-[20%] w-[600px] h-[600px] bg-pink-900/10 rounded-full blur-[180px]"></div>
      </div>

      {/* 🚀 READ-ONLY CINEMATIC HERO */}
      <div className="relative h-[40vh] min-h-[300px] w-full border-b border-pink-500/10 flex flex-col z-10">
        <div 
            className="absolute inset-0 bg-gray-900 bg-cover bg-center transition-all duration-700"
            style={{ backgroundImage: profile.background_url ? `url(${profile.background_url})` : 'none' }}
        >
            <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/60 to-transparent"></div>
            <div className="absolute inset-0 bg-gradient-to-r from-[#050505] via-transparent to-transparent opacity-80"></div>
        </div>

        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 pt-6 flex justify-between items-center">
            <Link href="/" className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-white/50 hover:text-pink-400 transition-colors group bg-black/40 hover:bg-black/80 backdrop-blur-md border border-white/5 hover:border-pink-500/30 px-4 py-2 rounded-full">
                <span className="group-hover:-translate-x-1 transition-transform">←</span> Back
            </Link>
        </div>

        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 mt-auto pb-8 flex flex-col md:flex-row items-center md:items-end gap-6">
            <div className="relative w-32 h-32 md:w-40 md:h-40 shrink-0">
                <div className="w-full h-full rounded-2xl overflow-hidden border-4 border-[#050505] shadow-[0_0_30px_rgba(20,184,166,0.15)] bg-gray-900 relative transform md:translate-y-8">
                    {profile.avatar_url ? (
                        <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-5xl font-black text-teal-700 bg-gradient-to-br from-gray-900 to-black">
                            {profile.username.charAt(0).toUpperCase()}
                        </div>
                    )}
                </div>
            </div>

            <div className="text-center md:text-left mb-2 md:mb-0">
                <div className="flex flex-col md:flex-row items-center justify-center md:justify-start gap-4">
                    <h1 className="text-4xl md:text-5xl font-black italic text-white uppercase tracking-tighter drop-shadow-lg">
                        {profile.username}
                    </h1>
                    
                    {!isPublic && (
                        <span className="bg-pink-950/30 text-pink-400 border border-pink-500/30 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-1 shadow-[0_0_10px_rgba(219,39,119,0.1)]">
                            🔒 Private Account
                        </span>
                    )}
                </div>
                
                <div className="flex items-center justify-center md:justify-start gap-3 mt-3">
                    <span className="bg-gradient-to-r from-teal-500 to-teal-400 text-black border border-teal-400/50 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest shadow-[0_0_10px_rgba(20,184,166,0.3)]">
                        Fighter Profile
                    </span>
                </div>
            </div>
        </div>
      </div>

      {/* 🛑 STOP RENDER IF PRIVATE */}
      {!isPublic ? (
          <div className="relative z-10 max-w-4xl mx-auto px-6 py-24 text-center">
              <span className="text-6xl mb-6 block opacity-50 drop-shadow-[0_0_20px_rgba(219,39,119,0.4)]">🛡️</span>
              <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter mb-2">Classified Data</h2>
              <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">This manager has restricted public access to their record.</p>
          </div>
      ) : (
          /* 🚀 TWO-COLUMN GRID DASHBOARD (IF PUBLIC) */
          <div className="relative z-10 max-w-7xl mx-auto px-6 py-12 md:py-16 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
            
            {/* LEFT COLUMN: Tale of the Tape */}
            <div className="lg:col-span-4 space-y-8">
                
                <div className="bg-black/40 backdrop-blur-xl border border-teal-900/40 rounded-3xl p-6 shadow-2xl hover:border-teal-500/40 transition-colors">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-2 h-8 bg-gradient-to-b from-teal-400 to-pink-500 rounded-full"></div>
                        <h2 className="text-sm font-black text-white italic uppercase tracking-widest">Tale of the Tape</h2>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                        <StatGlass 
                            label="Record" 
                            value={showRecord ? `${stats.wins}-${stats.losses}` : '🔒'} 
                            color={showRecord ? "text-white" : "text-gray-700"} 
                        />
                        <StatGlass 
                            label="Accuracy" 
                            value={showRecord ? `${stats.totalBets > 0 ? Math.round((stats.wins / (stats.wins + stats.losses)) * 100) : 0}%` : '🔒'} 
                            color={showRecord ? "text-teal-400 glow-teal" : "text-gray-700"} 
                        />
                        <StatGlass 
                            label="Pending" 
                            value={stats.pending} 
                            color="text-white/80" 
                        />
                        <StatGlass 
                            label="Earnings" 
                            value={showEarnings ? `${stats.netProfit >= 0 ? '+' : ''}${stats.netProfit}` : '🔒'} 
                            color={showEarnings ? (stats.netProfit >= 0 ? 'text-teal-400' : 'text-pink-500') : "text-gray-700"} 
                        />
                    </div>
                </div>
            </div>

            {/* RIGHT COLUMN: Trophies & History */}
            <div className="lg:col-span-8 space-y-8">
                
                {/* Trophy Room */}
                <div className="bg-black/40 backdrop-blur-xl border border-teal-900/40 hover:border-teal-500/40 transition-colors rounded-3xl p-6 md:p-8 shadow-2xl">
                    <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <span className="text-2xl drop-shadow-[0_0_10px_rgba(234,179,8,0.5)]">🏆</span>
                                <h2 className="text-xl font-black text-white italic uppercase tracking-tighter">Trophy Room</h2>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-32 h-1.5 bg-gray-900 rounded-full overflow-hidden shadow-inner">
                                    <div className="h-full bg-gradient-to-r from-pink-600 to-teal-400" style={{ width: `${Math.round((earnedCount/AVAILABLE_BADGES.length)*100)}%` }}></div>
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-teal-500/70">{earnedCount} / {AVAILABLE_BADGES.length} Unlocked</span>
                            </div>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {/* 🎯 ONLY renders badges the user has actually earned */}
                        {earnedBadgesToDisplay.length > 0 ? (
                            earnedBadgesToDisplay.map((badge) => (
                                <div key={badge.id} className={`relative rounded-2xl p-4 flex flex-col items-center justify-center text-center transition-all duration-300 animate-in fade-in zoom-in-95 bg-teal-950/10 border border-pink-500/20 hover:border-pink-500/60 ${badge.glow}`}>
                                    <div className="w-20 h-20 md:w-24 md:h-24 mb-4 flex items-center justify-center transition-transform hover:scale-110 opacity-100">
                                         <img src={badge.imagePath} alt={badge.title} className="max-w-full max-h-full object-contain drop-shadow-2xl" />
                                    </div>
                                    <h3 className="text-[11px] font-black uppercase tracking-widest mb-1.5 text-white">{badge.title}</h3>
                                    <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest leading-relaxed">{badge.description}</p>
                                </div>
                            ))
                        ) : (
                            <div className="col-span-full py-12 border border-gray-800 border-dashed rounded-2xl text-center">
                                <p className="text-gray-600 text-[10px] font-bold uppercase tracking-widest">No badges earned yet.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Collapsible Fight History (Or Privacy Lock) */}
                <div className={`bg-black/40 backdrop-blur-xl transition-all duration-500 ease-in-out rounded-3xl shadow-2xl overflow-hidden border ${
                    isHistoryOpen && showHistory 
                    ? 'border-pink-500/40 shadow-[0_0_30px_rgba(219,39,119,0.1)]' 
                    : 'border-teal-900/40 hover:border-teal-500/50'
                }`}>
                    
                    {/* Clickable Header */}
                    <div 
                        className={`flex items-center justify-between p-6 md:p-8 select-none bg-transparent ${showHistory ? 'cursor-pointer group' : ''}`}
                        onClick={() => { if(showHistory) setIsHistoryOpen(!isHistoryOpen) }}
                    >
                        <div className="flex items-center gap-3">
                            <span className={`w-2.5 h-2.5 rounded-full animate-pulse transition-colors ${
                                isHistoryOpen && showHistory ? 'bg-pink-500 shadow-[0_0_10px_rgba(219,39,119,0.8)]' : 'bg-teal-500 shadow-[0_0_10px_rgba(20,184,166,0.8)]'
                            }`}></span>
                            <h2 className={`text-xl font-black italic uppercase tracking-tighter transition-colors ${
                                isHistoryOpen && showHistory ? 'text-pink-400' : 'text-white group-hover:text-teal-400'
                            }`}>Fight History</h2>
                        </div>
                        
                        {showHistory && (
                            <div className={`p-2 rounded-full transition-all duration-300 border ${
                                isHistoryOpen 
                                ? 'bg-pink-500/10 border-pink-500/40 rotate-180 text-pink-400' 
                                : 'bg-teal-950/20 border-teal-900/50 group-hover:bg-teal-500/20 group-hover:border-teal-500/50 text-teal-600 group-hover:text-teal-400'
                            }`}>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                                </svg>
                            </div>
                        )}
                    </div>

                    {/* Content Section */}
                    {!showHistory ? (
                        <div className="px-6 md:px-8 pb-8 pt-2">
                            <div className="py-12 text-center bg-gray-900/30 rounded-2xl border border-gray-800">
                                <span className="text-4xl mb-4 block opacity-50 drop-shadow-md">🥷</span>
                                <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">
                                    This manager keeps their strategy hidden.
                                </p>
                            </div>
                        </div>
                    ) : (
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
                    )}

                </div>

            </div>
          </div>
      )}
    </main>
  );
}

// --- NEW COMPONENT HELPERS WITH THEME BORDERS ---

function StatGlass({ label, value, color }) {
    return (
        <div className="bg-teal-950/10 border border-teal-900/40 rounded-2xl p-4 text-center hover:bg-teal-900/20 hover:border-teal-500/40 transition-all">
            <div className="text-[9px] font-black text-teal-500/60 uppercase tracking-widest mb-1">{label}</div>
            <div className={`text-xl md:text-2xl font-black italic tracking-tighter ${color}`}>{value}</div>
        </div>
    );
}