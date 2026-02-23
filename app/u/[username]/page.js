'use client';

import { createClient } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation'; // 🎯 NEW: Grabs the username from the URL

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
  const rawUsername = params.username; // Note: Next.js URLs might encode spaces
  const decodedUsername = decodeURIComponent(rawUsername);

  const [loading, setLoading] = useState(true);
  const [profileExists, setProfileExists] = useState(true);
  
  // Profile Data
  const [profile, setProfile] = useState(null);
  const [userBadges, setUserBadges] = useState([]);
  const [stats, setStats] = useState({ totalBets: 0, wins: 0, losses: 0, pending: 0, netProfit: 0 });
  const [history, setHistory] = useState([]);

  useEffect(() => {
    fetchPublicData();
  }, [decodedUsername]);

  const fetchPublicData = async () => {
    // 1. Fetch Profile by Username
    const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .ilike('username', decodedUsername) // Case insensitive search!
        .single();

    if (profileError || !profileData) {
        setProfileExists(false);
        setLoading(false);
        return;
    }

    setProfile(profileData);

    // 2. Stop here if the profile is set to Private!
    if (profileData.is_public === false) {
        setLoading(false);
        return;
    }

    // 3. We need their email to look up picks and badges.
    const userEmail = profileData.email;
    if (!userEmail) {
        console.warn("No email found on this profile to link stats.");
        setLoading(false);
        return;
    }

    // 4. Fetch Badges
    const { data: badgesData } = await supabase.from('user_badges').select('badge_id').eq('user_id', userEmail);
    if (badgesData) setUserBadges(badgesData.map(b => b.badge_id));

    // 5. Fetch Picks & Fights
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

  // Build the list of earned badges
  const earnedBadges = AVAILABLE_BADGES.filter(badge => userBadges.includes(badge.id));

  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-pink-600 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  if (!profileExists) return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-center p-6">
          <span className="text-4xl mb-4">👻</span>
          <h1 className="text-2xl font-black italic text-white uppercase tracking-tighter mb-2">Fighter Not Found</h1>
          <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-6">This profile does not exist or has been deleted.</p>
          <Link href="/" className="text-pink-600 text-xs font-black uppercase hover:text-pink-400">← Back to Dashboard</Link>
      </div>
  );

  // Default flags (assume true if not explicitly false)
  const isPublic = profile.is_public !== false;
  const showRecord = profile.show_record !== false;
  const showEarnings = profile.show_earnings !== false;
  const showHistory = profile.show_history === true;

  return (
    <main className="min-h-screen bg-black text-white pb-24 font-sans selection:bg-pink-500 selection:text-white">
      
      {/* 🎯 READ-ONLY HEADER HERO */}
      <div className="relative border-b border-gray-800 pt-10 pb-12 px-6">
        
        {/* Background Image Layer */}
        <div 
            className="absolute inset-0 bg-gray-900 bg-cover bg-center transition-all duration-500"
            style={{ backgroundImage: profile.background_url ? `url(${profile.background_url})` : 'none' }}
        >
            <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/80 to-black"></div>
        </div>

        {/* Top Nav */}
        <div className="relative z-10 max-w-4xl mx-auto flex justify-between items-center mb-8">
            <Link href="/" className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-white transition-colors group mt-1">
                <span className="group-hover:-translate-x-1 transition-transform">←</span> Back
            </Link>
        </div>

        <div className="relative z-10 max-w-xl mx-auto text-center mt-4">
            {/* AVATAR CIRCLE */}
            <div className="relative mx-auto w-32 h-32 mb-6">
                <div className="w-full h-full rounded-full overflow-hidden border-4 border-black shadow-[0_0_30px_rgba(0,0,0,0.8)] bg-gray-950">
                    {profile.avatar_url ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={profile.avatar_url} alt={`${profile.username}'s Avatar`} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-4xl font-black text-gray-700">
                            {profile.username.charAt(0).toUpperCase()}
                        </div>
                    )}
                </div>
            </div>

            {/* USERNAME */}
            <h1 className="text-3xl md:text-4xl font-black italic text-white uppercase tracking-tighter drop-shadow-lg mb-2">
                {profile.username}
            </h1>
            
            {!isPublic && (
                <span className="inline-block bg-pink-900/50 text-pink-500 border border-pink-900 px-3 py-1 rounded text-[10px] font-black uppercase tracking-widest">
                    🔒 Private Account
                </span>
            )}
        </div>
      </div>

      {/* 🛑 STOP RENDER IF PRIVATE */}
      {!isPublic ? (
          <div className="max-w-4xl mx-auto px-4 py-24 text-center">
              <span className="text-5xl mb-4 block opacity-50">🛡️</span>
              <h2 className="text-xl font-black text-gray-400 italic uppercase tracking-tighter mb-2">Access Denied</h2>
              <p className="text-gray-600 text-[10px] font-bold uppercase tracking-widest">This manager has hidden their profile from the public.</p>
          </div>
      ) : (
          /* ✅ MAIN CONTENT CONTAINER (IF PUBLIC) */
          <div className="max-w-4xl mx-auto px-4 py-8">
            
            {/* 🎯 PRIVACY-RESPECTING STATS CARDS */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
                <StatCard 
                    label="Record" 
                    value={showRecord ? `${stats.wins}-${stats.losses}` : 'HIDDEN 🔒'} 
                    sub={showRecord ? "W-L" : ""}
                    color={showRecord ? "text-white" : "text-gray-600 text-lg"} 
                />
                <StatCard 
                    label="Accuracy" 
                    value={showRecord ? `${stats.totalBets > 0 ? Math.round((stats.wins / (stats.wins + stats.losses)) * 100) : 0}%` : 'HIDDEN 🔒'} 
                    color={showRecord ? "text-teal-400" : "text-gray-600 text-lg"} 
                />
                <StatCard label="Pending" value={stats.pending} color="text-pink-500" />
                <StatCard 
                    label="Earnings" 
                    value={showEarnings ? `${stats.netProfit >= 0 ? '+' : ''}${stats.netProfit}` : 'HIDDEN 🔒'} 
                    color={showEarnings ? (stats.netProfit >= 0 ? 'text-green-400' : 'text-pink-500') : "text-gray-600 text-lg"} 
                />
            </div>

            {/* 🎯 TROPHY ROOM SECTION */}
            <div className="mb-12">
                <div className="flex items-center gap-3 mb-5 px-1">
                    <span className="text-xl">🏆</span>
                    <h2 className="text-sm font-black text-white italic uppercase tracking-tighter">Trophy Room</h2>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {earnedBadges.length === 0 ? (
                        <div className="col-span-full p-8 border border-gray-800 border-dashed rounded-xl text-center">
                            <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">
                                No badges earned yet.
                            </p>
                        </div>
                    ) : (
                        earnedBadges.map((badge) => (
                            <div 
                                key={badge.id} 
                                className={`relative rounded-xl p-4 flex flex-col items-center justify-center text-center transition-all duration-300 border bg-gray-900 border-gray-700 ${badge.glow}`}
                            >
                                <div className="w-16 h-16 mb-3 flex items-center justify-center opacity-100">
                                     {/* eslint-disable-next-line @next/next/no-img-element */}
                                     <img src={badge.imagePath} alt={badge.title} className="max-w-full max-h-full object-contain drop-shadow-xl" />
                                </div>
                                <h3 className="text-[10px] font-black uppercase tracking-widest mb-1 text-white">
                                    {badge.title}
                                </h3>
                                <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest leading-relaxed">
                                    {badge.description}
                                </p>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* 🎯 PRIVACY-RESPECTING HISTORY */}
            <div className="flex items-center gap-3 mb-5 px-1">
                <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse"></span>
                <h2 className="text-sm font-black text-white italic uppercase tracking-tighter">Fight History</h2>
            </div>

            <div className="bg-gray-950 border border-gray-900 rounded-xl overflow-hidden shadow-xl">
                {!showHistory ? (
                    <div className="p-12 text-center">
                        <span className="text-4xl mb-3 block opacity-50">🥷</span>
                        <p className="text-gray-600 text-[10px] font-bold uppercase tracking-widest">
                            This manager keeps their strategy hidden.
                        </p>
                    </div>
                ) : history.length === 0 ? (
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
      )}
    </main>
  );
}

// Clean Sub-component
function StatCard({ label, value, sub, color }) {
    return (
        <div className="bg-gray-950 border border-gray-900 rounded-xl p-5 text-center shadow-lg relative overflow-hidden">
            <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">{label}</div>
            <div className={`text-2xl md:text-3xl font-black italic tracking-tighter ${color}`}>{value}</div>
            {sub && <div className="text-[9px] text-gray-600 font-bold mt-1 uppercase tracking-widest">{sub}</div>}
        </div>
    );
}