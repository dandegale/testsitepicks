'use client';

import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import LeagueRail from '../components/LeagueRail';
import LogOutButton from '../components/LogOutButton'; 

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function MyPicksPage() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [activePicks, setActivePicks] = useState([]);
  const [myLeagues, setMyLeagues] = useState([]);
  
  // Stats for the HUD
  const [stats, setStats] = useState({ wins: 0, losses: 0, winPercentage: 0 });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    // 1. Check Login
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    setUser(currentUser);

    if (currentUser) {
      // 2. Fetch Leagues (Sidebar)
      const { data: memberships } = await supabase
        .from('league_members')
        .select('leagues ( id, name, image_url, invite_code )')
        .eq('user_id', currentUser.email);
      
      if (memberships) {
        setMyLeagues(memberships.map(m => m.leagues).filter(Boolean));
      }

      // 3. Fetch All Picks (for Stats & Active List)
      const { data: picks } = await supabase
        .from('picks')
        .select('*')
        .eq('user_id', currentUser.email);

      if (picks && picks.length > 0) {
        
        // --- CALCULATE HUD STATS ---
        const wins = picks.filter(p => p.result === 'Win').length;
        const losses = picks.filter(p => p.result === 'Loss').length;
        const total = wins + losses;
        const percentage = total > 0 ? (wins / total) * 100 : 0;
        setStats({ wins, losses, winPercentage: percentage });

        // --- FETCH DETAILS FOR ACTIVE PICKS ---
        // 4. Fetch Fights & Leagues manually
        const fightIds = picks.map(p => p.fight_id);
        const leagueIds = picks.map(p => p.league_id).filter(Boolean);

        const [fightsResult, leaguesResult] = await Promise.all([
            supabase.from('fights').select('*').in('id', fightIds),
            leagueIds.length > 0 ? supabase.from('leagues').select('*').in('id', leagueIds) : { data: [] }
        ]);

        const fights = fightsResult.data || [];
        const leagues = leaguesResult.data || [];

        // 5. Merge Data
        const picksWithDetails = picks.map(pick => {
            const fight = fights.find(f => f.id === pick.fight_id) || {};
            const league = pick.league_id 
                ? leagues.find(l => l.id === pick.league_id) 
                : { name: 'Global League', isGlobal: true };
            
            return { ...pick, fight, league };
        });

        // 6. Sort (Newest ID first)
        picksWithDetails.sort((a, b) => b.id - a.id);

        // 7. Filter: Show anything pending
        // UPDATED: Now filters out if pick is resolved OR if fight has a winner declared
        const active = picksWithDetails.filter(p => {
             const isPickResolved = ['Win', 'Loss', 'Draw'].includes(p.result);
             const isFightEnded = p.fight && p.fight.winner; // Check if the fight has a winner
             
             // Keep pick only if it's NOT resolved AND the fight is NOT ended
             return !isPickResolved && !isFightEnded;
        });
        
        setActivePicks(active);
      } else {
        setActivePicks([]);
        setStats({ wins: 0, losses: 0, winPercentage: 0 });
      }
    }
    
    setLoading(false);
  };

  // --- HELPER: CALCULATE POTENTIAL GAIN (10 PTS WAGER) ---
  const getPotentialGain = (odds) => {
    if (!odds) return 0;
    const numericOdds = parseInt(odds, 10);
    if (isNaN(numericOdds)) return 0;
    let standardWin = 0;
    if (numericOdds > 0) {
        standardWin = numericOdds; 
    } else {
        standardWin = (100 / Math.abs(numericOdds)) * 100;
    }
    return Math.round(standardWin / 10);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center">
            <span className="w-12 h-12 rounded-full border-4 border-pink-600 border-t-transparent animate-spin mb-4"></span>
            <div className="text-xs font-black uppercase tracking-widest text-pink-600">Loading Picks...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center p-8 border border-gray-800 rounded-xl bg-gray-950">
          <h1 className="text-2xl font-black italic mb-2 uppercase text-white">Access Denied</h1>
          <p className="text-gray-500 text-sm mb-6">Please log in to view your picks.</p>
          <Link href="/" className="px-6 py-3 bg-pink-600 hover:bg-pink-500 text-white font-bold uppercase rounded text-xs transition-colors">
             Return Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-black text-white font-sans selection:bg-pink-500 selection:text-white">
      {/* Sidebar */}
      <div className="hidden md:block">
        <LeagueRail initialLeagues={myLeagues} />
      </div>

      <main className="flex-1 h-screen overflow-y-auto scrollbar-hide relative flex flex-col">
        
        {/* --- STICKY TOP HUD (COPIED FROM DASHBOARD) --- */}
        <header className="sticky top-0 z-[60] w-full bg-black/80 backdrop-blur-xl border-b border-gray-800">
            <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    {/* Header Logo */}
                    <Link href="/" className="text-2xl font-black italic text-white tracking-tighter uppercase">
                        FIGHT<span className="text-pink-600">IQ</span>
                    </Link>

                    <div className="h-4 w-px bg-gray-800 mx-2"></div>
                    
                    <nav className="hidden md:flex gap-6 text-[10px] font-black uppercase tracking-widest text-gray-500">
                        {/* Current Page Indicator */}
                        <span className="text-pink-600 cursor-default">My Picks</span>
                        <Link href="/" className="hover:text-white transition-colors">Global Feed</Link>
                        <Link href="/leaderboard" className="hover:text-white transition-colors">Leaderboards</Link>
                    </nav>
                </div>

                <div className="flex items-center gap-4 md:gap-6">
                    {/* Career Record Stats */}
                    <div className="flex items-center gap-3 pr-4 border-r border-gray-800">
                        <div className="text-right">
                            <p className="text-[9px] font-black text-gray-600 uppercase tracking-tighter leading-none mb-1">Career Record</p>
                            <p className="text-sm font-black italic text-white leading-none">{stats.wins}W - {stats.losses}L</p>
                        </div>
                        <div className="w-8 h-8 rounded-full border border-gray-800 flex items-center justify-center relative text-[8px] font-black">
                            {Math.round(stats.winPercentage)}%
                            <svg className="absolute inset-0 w-full h-full -rotate-90">
                                <circle cx="16" cy="16" r="14" fill="none" stroke="#111" strokeWidth="1.5" />
                                <circle cx="16" cy="16" r="14" fill="none" stroke="#db2777" strokeWidth="1.5" strokeDasharray="88" strokeDashoffset={88 - (88 * stats.winPercentage) / 100} />
                            </svg>
                        </div>
                    </div>

                    <Link 
                        href="/profile" 
                        className="bg-gray-900 hover:bg-gray-800 border border-gray-700 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-gray-300 hover:text-white transition-all flex items-center gap-2"
                    >
                        <span className="hidden sm:inline">My Profile</span>
                        <span className="sm:hidden">👤</span>
                    </Link>

                    <LogOutButton />
                </div>
            </div>
        </header>

        {/* --- MAIN CONTENT --- */}
        <div className="p-6 md:p-12">
            
            {/* Page Title Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 border-b border-gray-800 pb-6 gap-4">
                <div>
                    <h1 className="text-4xl md:text-5xl font-black italic uppercase tracking-tighter mb-2">
                        MY <span className="text-pink-600">PICKS</span>
                    </h1>
                    <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Active Selections & Pending Results</p>
                </div>
                <Link href="/" className="px-6 py-2 border border-gray-700 rounded hover:bg-white hover:text-black transition-all text-xs font-black uppercase">
                    ← Back to Fight Card
                </Link>
            </div>

            {/* Content Area */}
            {activePicks.length === 0 ? (
                <div className="p-12 border-2 border-dashed border-gray-900 rounded-2xl text-center bg-gray-950/50">
                    <h3 className="text-2xl font-black text-gray-700 uppercase italic mb-4">No Active Picks</h3>
                    <p className="text-gray-600 mb-6 text-sm">You haven't locked in any picks for upcoming fights yet.</p>
                    <Link href="/" className="inline-block bg-pink-600 text-white px-8 py-3 rounded-lg font-black uppercase hover:bg-pink-500 transition-colors text-xs tracking-wider">
                        View Fight Card
                    </Link>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {activePicks.map((pick) => {
                        const fight = pick.fight || {};
                        const opponent = fight.fighter_1_name === pick.selected_fighter 
                            ? fight.fighter_2_name 
                            : fight.fighter_1_name;

                        const isLive = fight.start_time && new Date(fight.start_time) < new Date();
                        const potentialGain = getPotentialGain(pick.odds_at_pick);
                        const leagueName = pick.league?.name || 'Unknown League';
                        const isGlobal = pick.league?.isGlobal;

                        return (
                            <div key={pick.id} className="bg-gray-950 border border-gray-800 rounded-xl p-6 hover:border-pink-600/50 transition-all group relative overflow-hidden flex flex-col">
                                
                                {/* TOP BADGES */}
                                <div className="flex justify-between items-start mb-6">
                                    <span className={`text-[9px] font-black uppercase px-2 py-1 rounded border ${isGlobal ? 'bg-teal-900/20 text-teal-400 border-teal-900' : 'bg-gray-800 text-gray-300 border-gray-700'}`}>
                                        {leagueName}
                                    </span>

                                    {isLive && (
                                        <span className="bg-red-600 text-white text-[9px] font-black uppercase px-2 py-1 rounded animate-pulse ml-auto mr-2">
                                            Live
                                        </span>
                                    )}
                                </div>

                                {/* MAIN STATS */}
                                <div className="flex justify-between items-end mb-6">
                                    <div>
                                        <div className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">
                                            Selection
                                        </div>
                                        <div className="text-2xl font-black italic text-white uppercase group-hover:text-pink-500 transition-colors leading-none">
                                            {pick.selected_fighter}
                                        </div>
                                        <div className="text-[10px] text-gray-600 font-bold mt-2">
                                            Odds: {pick.odds_at_pick > 0 ? `+${pick.odds_at_pick}` : pick.odds_at_pick}
                                        </div>
                                    </div>

                                    <div className="text-right">
                                        <div className="text-[9px] text-gray-500 font-bold uppercase tracking-wider mb-1">Potential Gain</div>
                                        <span className="text-xl font-mono font-black text-teal-400">
                                            +{potentialGain} <span className="text-[10px] text-teal-600">PTS</span>
                                        </span>
                                    </div>
                                </div>

                                {/* FOOTER */}
                                <div className="flex items-center gap-4 border-t border-gray-900 pt-4 mt-auto">
                                    <div className="text-right flex-1">
                                        <span className="text-[9px] text-gray-600 font-bold uppercase block">Opponent</span>
                                        <span className="text-sm font-bold text-gray-400 uppercase">
                                            {opponent || 'TBD'}
                                        </span>
                                    </div>
                                    <div className="w-px h-8 bg-gray-900"></div>
                                    <div className="flex-1">
                                        <span className="text-[9px] text-gray-600 font-bold uppercase block">Event</span>
                                        <span className="text-[10px] font-bold text-gray-400 uppercase truncate block">
                                            {fight.event_name || 'UFC Fight Night'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
      </main>
    </div>
  );
}