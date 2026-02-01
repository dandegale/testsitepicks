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

export default function LeaderboardPage() {
  const [loading, setLoading] = useState(true);
  const [leaderboard, setLeaderboard] = useState([]);
  const [myLeagues, setMyLeagues] = useState([]);
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    setUser(currentUser);

    // 1. Fetch Leagues (for Sidebar)
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

    // 2. Fetch DATA (Fights, Picks, AND PROFILES)
    const { data: picks } = await supabase.from('picks').select('*');
    const { data: fights } = await supabase.from('fights').select('*');
    
    // NEW: Fetch Profiles so we can show real usernames
    const { data: profiles } = await supabase.from('profiles').select('email, username');

    if (picks && fights) {
      processLeaderboard(picks, fights, profiles || []);
    }

    setLoading(false);
  };

  // --- THE MATH ENGINE ---
  const calculatePoints = (odds) => {
    const numericOdds = parseInt(odds, 10);
    if (isNaN(numericOdds) || numericOdds === 0) return 0;

    let standardWin = 0;
    if (numericOdds > 0) {
        standardWin = numericOdds; // +150 = 150 win
    } else {
        standardWin = (100 / Math.abs(numericOdds)) * 100; // -200 = 50 win
    }
    
    // Scale to 10 point wager
    return Math.round(standardWin / 10);
  };

  // --- UPDATED LOGIC HERE ---
  const processLeaderboard = (picks, fights, profiles) => {
    const scores = {};

    picks.forEach((pick) => {
        // 1. Find the actual fight object for this pick
        const fight = fights.find(f => f.id === pick.fight_id);

        // 2. DYNAMIC CHECK: Does the fight have a winner? Does it match the pick?
        // We ignore 'pick.is_correct' because the database might not be updated yet.
        if (fight && fight.winner && fight.winner === pick.selected_fighter) {
            
            const points = calculatePoints(pick.odds_at_pick);
            const userId = pick.user_id; // This is the email

            if (!scores[userId]) {
                // Find the real username from the profiles table
                const userProfile = profiles.find(p => p.email === userId);
                const displayName = userProfile?.username || userId.split('@')[0];

                scores[userId] = { 
                    name: displayName, 
                    score: 0, 
                    wins: 0,
                    fullEmail: userId 
                };
            }
            scores[userId].score += points;
            scores[userId].wins += 1;
        }
    });

    // Convert to Array & Sort (Highest Score First)
    const sorted = Object.values(scores).sort((a, b) => b.score - a.score);
    setLeaderboard(sorted);
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
    <div className="flex min-h-screen bg-black text-white font-sans selection:bg-pink-500 selection:text-white">
      {/* Sidebar */}
      <div className="hidden md:block">
        <LeagueRail initialLeagues={myLeagues} />
      </div>

      <main className="flex-1 h-screen overflow-y-auto scrollbar-hide relative flex flex-col">
        
        {/* --- STICKY HEADER --- */}
        <header className="sticky top-0 z-[60] w-full bg-black/80 backdrop-blur-xl border-b border-gray-800">
            <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/" className="text-2xl font-black italic text-white tracking-tighter uppercase">
                        FIGHT<span className="text-pink-600">IQ</span>
                    </Link>
                    <div className="h-4 w-px bg-gray-800 mx-2"></div>
                    <nav className="hidden md:flex gap-6 text-[10px] font-black uppercase tracking-widest text-gray-500">
                        <Link href="/my-picks" className="hover:text-white transition-colors">My Picks</Link>
                        <Link href="/" className="hover:text-white transition-colors">Global Feed</Link>
                        <span className="text-pink-600 cursor-default">Leaderboards</span>
                    </nav>
                </div>
                <div className="flex items-center gap-4">
                     <Link href="/profile" className="bg-gray-900 hover:bg-gray-800 border border-gray-700 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-gray-300 hover:text-white transition-all">
                        MY PROFILE
                    </Link>
                    <LogOutButton />
                </div>
            </div>
        </header>

        <div className="p-6 md:p-12 max-w-5xl mx-auto w-full">
            {/* Page Title */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 border-b border-gray-800 pb-6 gap-4">
                <div>
                    <h1 className="text-4xl md:text-5xl font-black italic uppercase tracking-tighter mb-2">
                        GLOBAL <span className="text-teal-500">RANKINGS</span>
                    </h1>
                    <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Official Season Standings</p>
                </div>
                {/* User's Own Rank Badge (If logged in) */}
                {user && (
                    <div className="bg-gray-900 border border-gray-800 px-6 py-3 rounded-xl flex flex-col items-center">
                        <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mb-1">Your Rank</span>
                        <span className="text-2xl font-black text-white italic">
                            #{leaderboard.findIndex(p => p.fullEmail === user.email) + 1 > 0 ? leaderboard.findIndex(p => p.fullEmail === user.email) + 1 : '-'}
                        </span>
                    </div>
                )}
            </div>

            {/* Leaderboard Table */}
            <div className="bg-gray-950 border border-gray-800 rounded-2xl overflow-hidden shadow-2xl">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-900 border-b border-gray-800 text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">
                            <th className="p-6 w-24 text-center">Rank</th>
                            <th className="p-6">Fighter IQ Manager</th>
                            <th className="p-6 text-center">Wins</th>
                            <th className="p-6 text-right">Total Pts</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-900">
                        {leaderboard.map((player, index) => {
                            // Style top 3 differently
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
                                    <td className="p-6 text-center">
                                        <span className={`text-2xl font-black italic ${rankStyle}`}>
                                            {index + 1}
                                        </span>
                                    </td>
                                    <td className="p-6">
                                        <div className="font-bold text-white text-sm uppercase tracking-wider flex items-center gap-3">
                                            {/* Avatar Placeholder */}
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black ${index === 0 ? 'bg-yellow-500 text-black' : 'bg-gray-800 text-gray-500'}`}>
                                                {player.name ? player.name.substring(0, 2).toUpperCase() : '?'}
                                            </div>
                                            {player.name}
                                            {player.fullEmail === user?.email && (
                                                <span className="bg-pink-600 text-[8px] px-1.5 py-0.5 rounded text-white ml-2">YOU</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-6 text-center text-gray-400 font-mono font-bold">
                                        {player.wins}
                                    </td>
                                    <td className="p-6 text-right">
                                        <span className="text-teal-400 font-black text-xl italic tracking-tighter">
                                            {player.score} <span className="text-[10px] text-teal-700 not-italic ml-1">PTS</span>
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
    </div>
  );
}