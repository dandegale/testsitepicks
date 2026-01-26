'use client';

import { useState } from 'react';
import Link from 'next/link';
import LogOutButton from './LogOutButton';
import ChatBox from './ChatBox'; 
import FightDashboard from './FightDashboard';
import LeagueActivity from './LeagueActivity'; 
import LeagueRail from './LeagueRail'; 

export default function DashboardClient({ 
  fights, groupedFights, allPicks, userEmail, myLeagues, totalWins, totalLosses, nextEventName, mainEvent 
}) {
  const [isFocusMode, setIsFocusMode] = useState(false);
  const winPercentage = (totalWins + totalLosses) > 0 ? (totalWins / (totalWins + totalLosses)) * 100 : 0;

  return (
    <div className="flex min-h-screen bg-black text-white overflow-hidden font-sans selection:bg-pink-500 selection:text-white">
      
      {/* 1. LEFT RAIL */}
      <div className={`hidden md:block transition-all duration-500 ${isFocusMode ? '-ml-20' : 'ml-0'}`}>
        <LeagueRail />
      </div>

      <main className="flex-1 h-screen overflow-y-auto scrollbar-hide relative flex flex-col">
        
        {/* --- TOP BAR HUD --- */}
        <header className={`sticky top-0 z-[60] w-full bg-black/80 backdrop-blur-xl border-b border-gray-800 transition-all duration-500 ${isFocusMode ? '-translate-y-full' : 'translate-y-0'}`}>
            <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <span className="text-pink-600 font-black italic text-xl tracking-tighter">'EM</span>
                    <div className="h-4 w-px bg-gray-800 mx-2"></div>
                    <nav className="hidden md:flex gap-6 text-[10px] font-black uppercase tracking-widest text-gray-500">
                        <Link href="/" className="text-white">Global Feed</Link>
                        <Link href="/leaderboard" className="hover:text-white transition-colors">Leaderboards</Link>
                    </nav>
                </div>

                <div className="flex items-center gap-4 md:gap-6">
                    {/* Career Record HUD */}
                    <div className="flex items-center gap-3 pr-4 border-r border-gray-800">
                        <div className="text-right">
                            <p className="text-[9px] font-black text-gray-600 uppercase tracking-tighter leading-none mb-1">Career Record</p>
                            <p className="text-sm font-black italic text-white leading-none">{totalWins}W - {totalLosses}L</p>
                        </div>
                        <div className="w-8 h-8 rounded-full border border-gray-800 flex items-center justify-center relative text-[8px] font-black">
                            {Math.round(winPercentage)}%
                            <svg className="absolute inset-0 w-full h-full -rotate-90">
                                <circle cx="16" cy="16" r="14" fill="none" stroke="#111" strokeWidth="1.5" />
                                <circle cx="16" cy="16" r="14" fill="none" stroke="#db2777" strokeWidth="1.5" strokeDasharray="88" strokeDashoffset={88 - (88 * winPercentage) / 100} />
                            </svg>
                        </div>
                    </div>

                    {/* --- PROFILE LINK --- */}
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

        {isFocusMode && (
             <button onClick={() => setIsFocusMode(false)} className="fixed top-6 right-6 z-[70] bg-gray-950 text-white px-6 py-3 rounded-full font-bold uppercase text-xs border border-pink-500 shadow-[0_0_20px_rgba(236,72,153,0.3)] hover:bg-pink-600 transition-all">
                ✕ Close Picks
             </button>
        )}

        {/* HERO SECTION */}
        <div className={`relative w-full bg-gray-900 overflow-hidden border-b border-gray-800 transition-all duration-700 ${isFocusMode ? 'h-0 opacity-0' : 'h-[35vh] min-h-[250px]'}`}>
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent z-10" />
            <div className="absolute inset-0 flex flex-col justify-end p-6 md:p-12 z-20">
                <div className="flex items-center gap-2 mb-2">
                    <span className="bg-red-600 text-white text-[10px] font-black uppercase px-2 py-1 rounded tracking-widest animate-pulse">Live Event</span>
                </div>
                <h1 className="text-4xl md:text-5xl font-black italic uppercase tracking-tighter mb-2">CHOOSE YOUR FIGHTER</h1>
                <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">{nextEventName.split('(')[0]}</p>
            </div>
        </div>

        <div className="p-4 md:p-10 max-w-7xl mx-auto min-h-screen">
            <div className={`mb-12 transition-all duration-500 origin-top ${isFocusMode ? 'scale-y-0 h-0 opacity-0 mb-0' : 'scale-y-100'}`}>
                <h2 className="text-[10px] font-black text-gray-600 uppercase tracking-[0.2em] mb-4">Active Leagues</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {myLeagues.map(league => (
                        <Link key={league.id} href={`/league/${league.id}`} className="group bg-gray-950/50 border border-gray-900 hover:border-pink-600 rounded-xl p-4 transition-all hover:-translate-y-1">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-8 h-8 rounded-full bg-gray-900 border border-gray-800 group-hover:text-pink-600 flex items-center justify-center text-[10px] font-bold text-gray-500 transition-colors">{league.name.substring(0,2).toUpperCase()}</div>
                                <div className="text-xs font-bold text-gray-400 group-hover:text-white truncate">{league.name}</div>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>

            {/* --- LOCKED WIDTH CONTAINER --- */}
            <div className="relative flex w-full">
                
                <div 
                    className={`transition-all duration-700 ease-in-out w-full xl:w-[66%] ${isFocusMode ? 'xl:mx-auto' : ''}`} 
                    onClickCapture={() => !isFocusMode && setIsFocusMode(true)}
                >
                    <div className="flex items-center gap-2 mb-6">
                        <span className={`w-2 h-2 rounded-full bg-teal-500 animate-pulse ${isFocusMode ? 'opacity-0' : ''}`}></span>
                        <h2 className={`text-xl font-black uppercase italic tracking-tighter ${isFocusMode ? 'text-pink-600' : ''}`}>
                            {isFocusMode ? 'Lock Your Picks' : 'Global Fight Card'}
                        </h2>
                    </div>
                    
                    <div className={`[&_.fight-card]:hover:border-pink-600/50 transition-all ${isFocusMode ? '[&_button]:animate-pulse' : ''}`}>
                        <FightDashboard 
                            fights={fights} 
                            groupedFights={groupedFights} 
                            initialPicks={allPicks} 
                            league_id={null} 
                            onPickSuccess={() => setIsFocusMode(false)} 
                            onPicksCleared={() => setIsFocusMode(false)} 
                        />
                    </div>
                </div>

                <div className={`
                    hidden xl:block ml-10 space-y-8 transition-all duration-700
                    ${isFocusMode 
                        ? 'opacity-0 translate-x-[100px] pointer-events-none absolute right-0 top-0 w-0' 
                        : 'opacity-100 translate-x-0 w-[33%] relative'}
                `}>
                    <div className="min-w-[350px]">
                        <h2 className="text-[10px] font-black text-gray-600 uppercase tracking-[0.2em] mb-4">Live Activity</h2>
                        <LeagueActivity initialPicks={allPicks} fights={fights} currentUserEmail={userEmail} />
                    </div>
                    <div className="h-[600px] min-w-[350px] flex flex-col">
                        <div className="flex justify-between items-center mb-4 px-2">
                            <h3 className="text-[10px] font-black text-gray-600 uppercase tracking-[0.2em]">Global Trash Talk</h3>
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                        </div>
                        <div className="flex-1 shadow-2xl shadow-black overflow-hidden rounded-xl border border-gray-900">
                            <ChatBox league_id={null} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
      </main>
    </div>
  );
}