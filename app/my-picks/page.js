'use client';

import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import LeagueRail from '../components/LeagueRail';
import LogOutButton from '../components/LogOutButton'; 
import MobileNav from '../components/MobileNav'; 

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function MyPicksPage() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [activePicks, setActivePicks] = useState([]);
  const [myLeagues, setMyLeagues] = useState([]);
  
  // 🎯 NEW: Using the state for the teal menu!
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [stats, setStats] = useState({ wins: 0, losses: 0, winPercentage: 0 });
  const [activeFilter, setActiveFilter] = useState('ALL');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    setUser(currentUser);

    if (currentUser) {
      const { data: memberships } = await supabase
        .from('league_members')
        .select('leagues ( id, name, image_url, invite_code )')
        .eq('user_id', currentUser.email);
      
      if (memberships) {
        setMyLeagues(memberships.map(m => m.leagues).filter(Boolean));
      }

      const { data: picks } = await supabase
        .from('picks')
        .select('*')
        .eq('user_id', currentUser.email);

      if (picks && picks.length > 0) {
        const wins = picks.filter(p => p.result === 'Win').length;
        const losses = picks.filter(p => p.result === 'Loss').length;
        const total = wins + losses;
        const percentage = total > 0 ? (wins / total) * 100 : 0;
        setStats({ wins, losses, winPercentage: percentage });

        const fightIds = picks.map(p => p.fight_id);
        const leagueIds = picks.map(p => p.league_id).filter(Boolean);

        const [fightsResult, leaguesResult] = await Promise.all([
            supabase.from('fights').select('*').in('id', fightIds),
            leagueIds.length > 0 ? supabase.from('leagues').select('*').in('id', leagueIds) : { data: [] }
        ]);

        const fights = fightsResult.data || [];
        const leagues = leaguesResult.data || [];

        const picksWithDetails = picks.map(pick => {
            const fight = fights.find(f => f.id === pick.fight_id) || {};
            const league = pick.league_id 
                ? leagues.find(l => l.id === pick.league_id) 
                : { name: 'Global League', isGlobal: true };
            
            return { ...pick, fight, league };
        });

        picksWithDetails.sort((a, b) => b.id - a.id);

        const active = picksWithDetails.filter(p => {
             const isPickResolved = ['Win', 'Loss', 'Draw'].includes(p.result);
             const isFightEnded = p.fight && p.fight.winner; 
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

  const getPotentialGain = (odds) => {
    const numericOdds = parseInt(odds, 10);
    if (!odds || isNaN(numericOdds) || numericOdds === 0) return 20;

    let profit = 0;
    if (numericOdds > 0) {
        profit = (numericOdds / 100) * 10;
    } else {
        profit = (100 / Math.abs(numericOdds)) * 10;
    }
    return parseFloat((profit + 10).toFixed(1));
  };

  const renderPickCard = (pick) => {
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

  const globalPicks = activePicks.filter(p => p.league?.isGlobal);
  const leaguePicks = activePicks.filter(p => !p.league?.isGlobal);

  const displayedGlobal = (activeFilter === 'ALL' || activeFilter === 'GLOBAL') ? globalPicks : [];
  const displayedLeague = activeFilter === 'ALL' 
      ? leaguePicks 
      : (activeFilter !== 'GLOBAL' ? leaguePicks.filter(p => p.league?.id === activeFilter) : []);

  return (
    <div className="flex min-h-screen bg-black text-white font-sans selection:bg-pink-500 selection:text-white">
      
      {/* 🎯 DESKTOP LEAGUE RAIL */}
      <div className="hidden md:block transition-all duration-500 ml-0 z-[70]">
          <LeagueRail initialLeagues={myLeagues} />
      </div>

      {/* 🎯 THE DARK MOBILE DRAWER YOU LIKE */}
      <div className={`fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm transition-opacity duration-300 md:hidden ${showMobileMenu ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={() => setShowMobileMenu(false)}>
          <div className={`absolute left-0 top-0 bottom-0 w-[80%] max-w-[300px] bg-[#0b0e14] border-r border-gray-800/60 shadow-2xl transform transition-transform duration-300 flex flex-col ${showMobileMenu ? 'translate-x-0' : '-translate-x-full'}`} onClick={e => e.stopPropagation()}>
              <div className="p-5 border-b border-gray-800/60 flex justify-between items-center bg-black/20">
                  <span className="text-xl font-black italic text-white tracking-tighter uppercase">
                      FIGHT<span className="text-pink-600">IQ</span>
                  </span>
                  <button onClick={() => setShowMobileMenu(false)} className="text-gray-500 hover:text-white transition-colors p-2 -mr-2">✕</button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-6 custom-scrollbar">
                  <div>
                      <p className="text-[10px] font-black text-pink-500 uppercase tracking-widest mb-4">Your Leagues</p>
                      <div className="flex flex-col gap-2">
                          {myLeagues && myLeagues.length > 0 ? (
                              myLeagues.map(league => (
                                  <Link key={league.id} href={`/league/${league.id}`} className="flex items-center gap-4 p-3 rounded-xl bg-[#12161f] hover:bg-gray-800 border border-gray-800/60 hover:border-pink-500/50 transition-all group">
                                      <div className="w-10 h-10 rounded-full bg-black border border-gray-700 flex items-center justify-center text-[10px] font-black text-gray-400 group-hover:text-pink-500 group-hover:border-pink-500 transition-all shrink-0 overflow-hidden relative">
                                          {league.image_url ? <img src={league.image_url} alt={league.name} className="w-full h-full object-cover" /> : (league.name ? league.name.substring(0,2).toUpperCase() : 'LG')}
                                      </div>
                                      <span className="font-bold text-sm text-gray-300 group-hover:text-white truncate">{league.name}</span>
                                  </Link>
                              ))
                          ) : (
                              <div className="p-4 border border-dashed border-gray-800 rounded-xl text-center bg-black/20">
                                  <p className="text-gray-600 text-[10px] font-bold uppercase tracking-widest mb-2">No Leagues Joined</p>
                              </div>
                          )}
                      </div>
                  </div>
                  
                  <div className="border-t border-gray-800/60 pt-6 mt-2 pb-6">
                      <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3">Main Menu</p>
                      <Link href="/" className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-800/40 border border-transparent hover:border-gray-800/60 transition-all mb-1 group">
                          <svg className="w-5 h-5 text-gray-500 group-hover:text-yellow-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                          <span className="text-sm font-bold text-gray-300 group-hover:text-white transition-colors">Dashboard</span>
                      </Link>
                      <Link href="/leaderboard" className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-800/40 border border-transparent hover:border-gray-800/60 transition-all mb-1 group">
                          <svg className="w-5 h-5 text-gray-500 group-hover:text-yellow-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v1a5 5 0 01-5 5h-1v2h4v2H5v-2h4v-2H8a5 5 0 01-5-5v-1a2 2 0 012-2m14 0V5a2 2 0 00-2-2H5a2 2 0 00-2 2v6" /></svg>
                          <span className="text-sm font-bold text-gray-300 group-hover:text-white transition-colors">Global Leaderboard</span>
                      </Link>
                      <Link href="/profile" className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-800/40 border border-transparent hover:border-gray-800/60 transition-all mb-1 group">
                          <svg className="w-5 h-5 text-gray-500 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                          <span className="text-sm font-bold text-gray-300 group-hover:text-white transition-colors">My Profile</span>
                      </Link>
                      <Link href="/store" className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-800/40 border border-transparent hover:border-pink-500/30 transition-all group">
                          <svg className="w-5 h-5 text-gray-500 group-hover:text-pink-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                          <span className="text-sm font-bold text-gray-300 group-hover:text-pink-500 transition-colors">Item Store</span>
                      </Link>
                  </div>
              </div>
          </div>
      </div>

      <main className="flex-1 h-screen overflow-y-auto scrollbar-hide relative flex flex-col pb-24 md:pb-0 w-full">
        
        {/* --- HEADER --- */}
        <header className="sticky top-0 z-[60] w-full bg-black/80 backdrop-blur-xl border-b border-gray-800">
            <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between w-full">
                <div className="flex items-center gap-3 md:gap-4">
                    {/* 🎯 THE TEAL HAMBURGER BUTTON */}
                     <button 
                        onClick={() => setShowMobileMenu(true)} 
                        className="md:hidden p-1 text-teal-400 hover:text-teal-300 transition-colors drop-shadow-[0_0_5px_rgba(45,212,191,0.5)] animate-pulse"
                    >
                        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" /></svg>
                    </button>

                    <Link href="/" className="text-xl md:text-2xl font-black italic text-white tracking-tighter uppercase">
                        FIGHT<span className="text-pink-600">IQ</span>
                    </Link>
                    <div className="hidden md:block h-4 w-px bg-gray-800 mx-2"></div>
                    <nav className="hidden lg:flex gap-6 text-[10px] font-black uppercase tracking-widest text-gray-500">
                        <span className="text-white cursor-default">How It Works</span>
                        <Link href="/" className="hover:text-white transition-colors">Global Feed</Link>
                        <Link href="/leaderboard" className="hover:text-white transition-colors">Leaderboards</Link>
                        <Link href="/store" className="hover:text-pink-400 text-pink-600 transition-colors flex items-center gap-1">
                            <span>STORE</span>
                        </Link>
                    </nav>
                </div>
            </div>
        </header>

        {/* --- MAIN CONTENT --- */}
        <div className="p-6 md:p-12 max-w-7xl mx-auto w-full">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 border-b border-gray-800 pb-6 gap-4">
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

            {/* NEW: FILTER BAR */}
            {activePicks.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-4 mb-8 scrollbar-hide">
                    <button 
                        onClick={() => setActiveFilter('ALL')}
                        className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all whitespace-nowrap ${activeFilter === 'ALL' ? 'bg-pink-600 text-white' : 'bg-gray-900 text-gray-500 hover:bg-gray-800 hover:text-white border border-gray-800'}`}
                    >
                        All Picks
                    </button>
                    <button 
                        onClick={() => setActiveFilter('GLOBAL')}
                        className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all whitespace-nowrap ${activeFilter === 'GLOBAL' ? 'bg-teal-700 text-white' : 'bg-gray-900 text-gray-500 hover:bg-gray-800 hover:text-white border border-gray-800'}`}
                    >
                        Global
                    </button>
                    {myLeagues.map(league => (
                        <button 
                            key={league.id}
                            onClick={() => setActiveFilter(league.id)}
                            className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all whitespace-nowrap ${activeFilter === league.id ? 'bg-gray-200 text-black' : 'bg-gray-900 text-gray-500 hover:bg-gray-800 hover:text-white border border-gray-800'}`}
                        >
                            {league.name}
                        </button>
                    ))}
                </div>
            )}

            {activePicks.length === 0 ? (
                <div className="p-12 border-2 border-dashed border-gray-900 rounded-2xl text-center bg-gray-950/50">
                    <h3 className="text-2xl font-black text-gray-700 uppercase italic mb-4">No Active Picks</h3>
                    <p className="text-gray-600 mb-6 text-sm">You haven't locked in any picks for upcoming fights yet.</p>
                    <Link href="/" className="inline-block bg-pink-600 text-white px-8 py-3 rounded-lg font-black uppercase hover:bg-pink-500 transition-colors text-xs tracking-wider">
                        View Fight Card
                    </Link>
                </div>
            ) : (
                <div className="space-y-12">
                    {/* GLOBAL PICKS SECTION */}
                    {displayedGlobal.length > 0 && (
                        <div>
                            {(activeFilter === 'ALL' || activeFilter === 'GLOBAL') && (
                                <h2 className="text-xl font-black italic text-teal-500 uppercase tracking-tighter mb-4 flex items-center gap-3">
                                    Global Picks
                                    <div className="h-px bg-gray-800 flex-1"></div>
                                </h2>
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {displayedGlobal.map(pick => renderPickCard(pick))}
                            </div>
                        </div>
                    )}

                    {/* LEAGUE PICKS SECTION */}
                    {displayedLeague.length > 0 && (
                        <div>
                             {(activeFilter === 'ALL' || activeFilter !== 'GLOBAL') && (
                                <h2 className="text-xl font-black italic text-white uppercase tracking-tighter mb-4 flex items-center gap-3">
                                    {activeFilter === 'ALL' ? 'League Picks' : myLeagues.find(l => l.id === activeFilter)?.name}
                                    <div className="h-px bg-gray-800 flex-1"></div>
                                </h2>
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {displayedLeague.map(pick => renderPickCard(pick))}
                            </div>
                        </div>
                    )}

                    {/* EMPTY STATE FOR SPECIFIC FILTER */}
                    {displayedGlobal.length === 0 && displayedLeague.length === 0 && (
                        <div className="p-8 border border-dashed border-gray-800 rounded-xl text-center">
                            <p className="text-gray-500 text-sm font-bold uppercase tracking-widest">No active picks found for this filter.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
      </main>

      {/* 🎯 BOTTOM NAVIGATION */}
      <div className="md:hidden">
          <MobileNav onToggleLeagues={() => setShowMobileMenu(true)} />
      </div>
      
    </div>
  );
}