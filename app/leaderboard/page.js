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

export default function LeaderboardPage() {
  const [loading, setLoading] = useState(true);
  const [leaderboard, setLeaderboard] = useState([]);
  const [myLeagues, setMyLeagues] = useState([]);
  const [user, setUser] = useState(null);
  
  const [showMobileLeagues, setShowMobileLeagues] = useState(false);

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
    
    // Fetch avatar_url
    const { data: profiles } = await supabase
        .from('profiles')
        .select('email, username, avatar_url');

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

                scores[userId] = { 
                    name: displayName, 
                    avatarUrl: avatarUrl,
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
    
    const cleaned = sorted.map(p => ({
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

      {/* Mobile Drawer */}
      <div className={`fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm transition-opacity duration-300 md:hidden ${showMobileLeagues ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={() => setShowMobileLeagues(false)}>
         <div className={`absolute left-0 top-0 bottom-0 w-[80%] max-w-[300px] bg-gray-900 border-r border-gray-800 transform transition-transform duration-300 ${showMobileLeagues ? 'translate-x-0' : '-translate-x-full'}`} onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-800 flex justify-between items-center">
                <span className="font-black italic text-xl">YOUR LEAGUES</span>
                <button onClick={() => setShowMobileLeagues(false)} className="text-gray-500 hover:text-white transition-colors">✕</button>
            </div>
            <div className="p-4 space-y-6">
                <div className="flex flex-col gap-4">
                    {myLeagues.length > 0 ? (
                        <LeagueRail initialLeagues={myLeagues} />
                    ) : (
                        <div className="p-4 border border-dashed border-gray-800 rounded-xl text-center">
                            <p className="text-gray-600 text-[10px] font-bold uppercase tracking-widest">No Leagues Joined</p>
                        </div>
                    )}
                </div>
                <div className="border-t border-gray-800 pt-6">
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3">Menu</p>
                    <span className="flex items-center gap-3 p-3 rounded-lg bg-gray-900 border border-gray-800 text-pink-500 cursor-default mb-2">
                        <span className="text-xl">🏆</span>
                        <span className="text-sm font-bold">Global Leaderboard</span>
                    </span>
                     <Link href="/profile" className="flex items-center gap-3 p-3 rounded-lg bg-gray-900/50 border border-gray-800 hover:bg-gray-800 transition-all">
                        <span className="text-xl">👤</span>
                        <span className="text-sm font-bold text-gray-300">My Profile</span>
                    </Link>
                </div>
            </div>
         </div>
      </div>

      <main className="flex-1 h-screen overflow-y-auto scrollbar-hide relative flex flex-col">
        <header className="sticky top-0 z-[60] w-full bg-black/80 backdrop-blur-xl border-b border-gray-800">
            <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
                <div className="flex items-center gap-4">
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
                    <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Official Season Standings (Global Only)</p>
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

                            return (
                                <tr key={index} className={rowStyle}>
                                    <td className="p-4 md:p-6 text-center">
                                        <span className={`text-2xl font-black italic ${rankStyle}`}>
                                            {index + 1}
                                        </span>
                                    </td>
                                    <td className="p-4 md:p-6">
                                        {/* 🎯 WRAPPED AVATAR AND USERNAME IN LINK TO PUBLIC PROFILE */}
                                        <div className="font-bold text-white text-sm uppercase tracking-wider flex items-center gap-3">
                                            <Link href={`/u/${encodeURIComponent(player.name)}`} className="flex-shrink-0 hover:opacity-80 transition-opacity">
                                                {player.avatarUrl ? (
                                                    <img 
                                                        src={player.avatarUrl} 
                                                        alt={player.name} 
                                                        className="w-8 h-8 rounded-full object-cover border border-gray-700"
                                                    />
                                                ) : (
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black ${index === 0 ? 'bg-yellow-500 text-black' : 'bg-gray-800 text-gray-500'}`}>
                                                        {player.name ? player.name.substring(0, 2).toUpperCase() : '?'}
                                                    </div>
                                                )}
                                            </Link>
                                            
                                            <Link href={`/u/${encodeURIComponent(player.name)}`} className="hover:text-pink-400 transition-colors">
                                                {player.name}
                                            </Link>

                                            {player.fullEmail === user?.email && (
                                                <span className="bg-pink-600 text-[8px] px-1.5 py-0.5 rounded text-white ml-2 cursor-default">YOU</span>
                                            )}
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

      <MobileNav onToggleLeagues={() => setShowMobileLeagues(true)} />

    </div>
  );
}