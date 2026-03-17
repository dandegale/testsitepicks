'use client';

import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import LeagueRail from '../components/LeagueRail';
import LogOutButton from '../components/LogOutButton';
import MobileNav from '../components/MobileNav'; 

// 🎯 IMPORT STORE CASES FOR RARITY LOOKUP
import { STORE_CASES } from '@/lib/cases';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// 🎯 HELPER TO COLORIZE LEADERBOARD TITLES
const getRarityTextStyle = (rarity) => {
    switch (rarity) {
        case 'Legendary': return 'text-yellow-500 drop-shadow-[0_0_5px_rgba(234,179,8,0.8)]';
        case 'Epic': return 'text-pink-500 drop-shadow-[0_0_5px_rgba(219,39,119,0.8)]';
        case 'Rare': return 'text-teal-400 drop-shadow-[0_0_5px_rgba(20,184,166,0.8)]';
        default: return 'text-gray-500'; 
    }
};

export default function LeaderboardPage() {
  const [loading, setLoading] = useState(true);
  const [leaderboard, setLeaderboard] = useState([]);
  const [myLeagues, setMyLeagues] = useState([]);
  const [user, setUser] = useState(null);
  
  // 🎯 Replaced with our standard menu state
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    setUser(currentUser);

    // 1. Fetch Leagues
    let userLeagues = [];
    if (currentUser) {
      const { data: memberships } = await supabase
        .from('league_members')
        .select('leagues ( id, name, image_url, invite_code )')
        .eq('user_id', currentUser.email);
      
      if (memberships) {
        userLeagues = memberships.map(m => m.leagues).filter(Boolean);
        setMyLeagues(userLeagues);
      }
    }

    // 2. Fetch DATA
    const { data: picks } = await supabase.from('picks').select('*');
    const { data: fights } = await supabase.from('fights').select('*');
    
    // 🎯 Include lifetime_points AND equipped_title
    const { data: profiles } = await supabase
        .from('profiles')
        .select('email, username, avatar_url, lifetime_points, equipped_title');

    if (picks && fights) {
      processLeaderboard(picks, fights, profiles || []);
    }

    setLoading(false);
  };

  const calculatePoints = (odds) => {
    const numericOdds = parseInt(odds, 10);
    if (isNaN(numericOdds) || numericOdds === 0) return 20;

    let profit = 0;
    if (numericOdds > 0) {
        profit = (numericOdds / 100) * 10;
    } else {
        profit = (100 / Math.abs(numericOdds)) * 10;
    }
    return parseFloat((profit + 10).toFixed(1));
  };

  const processLeaderboard = (picks, fights, profiles) => {
    const scores = {};

    picks.forEach((pick) => {
        // STRICT FILTER: Global picks only
        if (pick.league_id) return;

        const fight = fights.find(f => f.id === pick.fight_id);

        if (fight && fight.winner) {
            const userId = pick.user_id; 

            if (!scores[userId]) {
                const userProfile = profiles.find(p => p.email === userId);
                const displayName = userProfile?.username || pick.username || userId.split('@')[0];
                const avatarUrl = userProfile?.avatar_url || null;
                const lifetimePoints = userProfile?.lifetime_points || 0;
                const equippedTitle = userProfile?.equipped_title || null; 

                scores[userId] = { 
                    name: displayName, 
                    avatarUrl: avatarUrl,
                    lifetimePoints: lifetimePoints,
                    equippedTitle: equippedTitle,
                    score: 0, 
                    wins: 0,
                    fullEmail: userId 
                };
            }

            // --- WIN / LOSS LOGIC ---
            if (fight.winner === pick.selected_fighter) {
                const points = calculatePoints(pick.odds_at_pick);
                scores[userId].score += points;
                scores[userId].wins += 1;
            } else {
                scores[userId].score -= 10;
            }
        }
    });

    const sorted = Object.values(scores).sort((a, b) => b.score - a.score);
    
    // 🎯 FIX: Added .slice(0, 25) so the leaderboard physically cannot render more than 25 players
    const cleaned = sorted.slice(0, 25).map(p => ({
        ...p,
        score: parseFloat(p.score.toFixed(1))
    }));

    setLeaderboard(cleaned);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center">
            <span className="w-12 h-12 rounded-full border-4 border-pink-600 border-t-transparent animate-spin mb-4"></span>
            <div className="text-xs font-black uppercase tracking-widest text-pink-600">Calculating Ranks...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-black text-white font-sans selection:bg-pink-500 selection:text-white pb-20 md:pb-0">
      
      {/* Sidebar */}
      <div className="hidden md:block">
        <LeagueRail initialLeagues={myLeagues} />
      </div>

      {/* 🎯 THE FULL DARK MOBILE DRAWER */}
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

      <main className="flex-1 h-screen overflow-y-auto scrollbar-hide relative flex flex-col">
        <header className="sticky top-0 z-[60] w-full bg-black/80 backdrop-blur-xl border-b border-gray-800">
            <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    {/* 🎯 THE TEAL HAMBURGER BUTTON */}
                    <button 
                        onClick={() => setShowMobileMenu(true)} 
                        className="md:hidden p-1 text-teal-400 hover:text-teal-300 transition-colors drop-shadow-[0_0_5px_rgba(45,212,191,0.5)] animate-pulse"
                    >
                        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" /></svg>
                    </button>

                    <Link href="/" className="text-2xl font-black italic text-white tracking-tighter uppercase">
                        FIGHT<span className="text-pink-600">IQ</span>
                    </Link>
                    <div className="hidden md:block h-4 w-px bg-gray-800 mx-2"></div>
                    <nav className="hidden md:flex gap-6 text-[10px] font-black uppercase tracking-widest text-gray-500">
                        <Link href="/my-picks" className="hover:text-white transition-colors">My Picks</Link>
                        <Link href="/" className="hover:text-white transition-colors">Global Feed</Link>
                        <span className="text-pink-600 cursor-default">Leaderboards</span>
                    </nav>
                </div>
                <div className="flex items-center gap-4">
                     <Link href="/profile" className="hidden md:flex bg-gray-900 hover:bg-gray-800 border border-gray-700 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-gray-300 hover:text-white transition-all">
                        MY PROFILE
                    </Link>
                    <div className="hidden md:block">
                        <LogOutButton />
                    </div>
                </div>
            </div>
        </header>

        <div className="p-4 md:p-12 max-w-5xl mx-auto w-full">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 md:mb-12 border-b border-gray-800 pb-6 gap-4">
                <div>
                    <h1 className="text-3xl md:text-5xl font-black italic uppercase tracking-tighter mb-2">
                        GLOBAL <span className="text-teal-500">RANKINGS</span>
                    </h1>
                    <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Official Season Standings (Top 25)</p>
                </div>
                {user && (
                    <div className="bg-gray-900 border border-gray-800 px-6 py-3 rounded-xl flex flex-col items-center w-full md:w-auto">
                        <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mb-1">Your Rank</span>
                        <span className="text-2xl font-black text-white italic">
                            #{leaderboard.findIndex(p => p.fullEmail === user.email) + 1 > 0 ? leaderboard.findIndex(p => p.fullEmail === user.email) + 1 : '-'}
                        </span>
                    </div>
                )}
            </div>

            <div className="bg-gray-950 border border-gray-800 rounded-2xl overflow-hidden shadow-2xl overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[600px] md:min-w-0">
                    <thead>
                        <tr className="bg-gray-900 border-b border-gray-800 text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">
                            <th className="p-4 md:p-6 w-16 md:w-24 text-center">Rank</th>
                            <th className="p-4 md:p-6">Fighter IQ Manager</th>
                            <th className="p-4 md:p-6 text-center">Wins</th>
                            <th className="p-4 md:p-6 text-right">Total Pts</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-900">
                        {leaderboard.map((player, index) => {
                            let rankStyle = "text-gray-500";
                            let rowStyle = "hover:bg-gray-900/50 transition-colors group";
                            
                            if (index === 0) {
                                rankStyle = "text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.5)]";
                                rowStyle = "bg-yellow-950/10 hover:bg-yellow-900/20 border-l-2 border-yellow-500 transition-colors";
                            } else if (index === 1) {
                                rankStyle = "text-gray-300";
                                rowStyle = "bg-gray-900/20 border-l-2 border-gray-400 hover:bg-gray-900/40 transition-colors";
                            } else if (index === 2) {
                                rankStyle = "text-amber-700";
                                rowStyle = "bg-orange-950/10 border-l-2 border-orange-700 hover:bg-orange-900/20 transition-colors";
                            }

                            // 🎯 Determine Rarity of the player's title dynamically
                            let titleRarity = 'Common';
                            if (player.equippedTitle) {
                                for (const crate of STORE_CASES) {
                                    const item = crate.visualItems.find(i => i.name === player.equippedTitle);
                                    if (item) {
                                        titleRarity = item.rarity;
                                        break;
                                    }
                                }
                            }

                            return (
                                <tr key={index} className={rowStyle}>
                                    <td className="p-4 md:p-6 text-center">
                                        <span className={`text-2xl font-black italic ${rankStyle}`}>
                                            {index + 1}
                                        </span>
                                    </td>
                                    <td className="p-4 md:p-6">
                                        <div className="flex items-center gap-3">
                                            
                                            <div className="relative flex-shrink-0">
                                                <Link href={`/u/${encodeURIComponent(player.name)}`} className="block hover:opacity-80 transition-opacity">
                                                    {player.avatarUrl ? (
                                                        <img 
                                                            src={player.avatarUrl} 
                                                            alt={player.name} 
                                                            className="w-10 h-10 rounded-full object-cover border border-gray-700"
                                                        />
                                                    ) : (
                                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-black ${index === 0 ? 'bg-yellow-500 text-black' : 'bg-gray-800 text-gray-500'}`}>
                                                            {player.name ? player.name.substring(0, 2).toUpperCase() : '?'}
                                                        </div>
                                                    )}
                                                </Link>
                                                <div className="absolute -bottom-1 -right-1 bg-gradient-to-br from-pink-600 to-teal-500 text-white w-5 h-5 flex items-center justify-center rounded-full text-[9px] font-black border border-black shadow-sm pointer-events-none">
                                                    {calculateLevel(player.lifetimePoints)}
                                                </div>
                                            </div>
                                            
                                            <div className="flex flex-col justify-center">
                                                <div className="font-bold text-white text-sm uppercase tracking-wider flex items-center gap-2">
                                                    <Link href={`/u/${encodeURIComponent(player.name)}`} className="hover:text-pink-400 transition-colors">
                                                        {player.name}
                                                    </Link>
                                                    {player.fullEmail === user?.email && (
                                                        <span className="bg-pink-600 text-[8px] px-1.5 py-0.5 rounded text-white cursor-default">YOU</span>
                                                    )}
                                                </div>
                                                
                                                {player.equippedTitle && (
                                                    <span className={`text-[9px] font-black uppercase tracking-widest mt-0.5 ${getRarityTextStyle(titleRarity)}`}>
                                                        "{player.equippedTitle}"
                                                    </span>
                                                )}
                                            </div>
                                            
                                        </div>
                                    </td>
                                    <td className="p-4 md:p-6 text-center text-gray-400 font-mono font-bold">
                                        {player.wins}
                                    </td>
                                    <td className="p-4 md:p-6 text-right">
                                        <span className={`font-black text-xl italic tracking-tighter ${player.score < 0 ? 'text-red-500' : 'text-teal-400'}`}>
                                            {player.score > 0 ? '+' : ''}{player.score} <span className="text-[10px] text-teal-700 not-italic ml-1">PTS</span>
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
                        
                        {leaderboard.length === 0 && (
                            <tr>
                                <td colSpan={4} className="p-12 text-center text-gray-500 italic">
                                    No ranked players yet. Lock in some picks to claim the throne!
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
      </main>

      <MobileNav onToggleLeagues={() => setShowMobileMenu(true)} />

    </div>
  );
}

// ----------------------------------------------------------------------
// 🎯 THE XP MATH ENGINE
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
    
    return level;
}