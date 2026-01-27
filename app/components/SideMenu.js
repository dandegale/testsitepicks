'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function SideMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [myLeagues, setMyLeagues] = useState([]);
  const [myActivePicks, setMyActivePicks] = useState([]);
  const [userEmail, setUserEmail] = useState(null);

  // --- FETCH DATA WHEN DRAWER OPENS ---
  useEffect(() => {
    if (isOpen) {
      fetchUserData();
    }
  }, [isOpen]);

  const fetchUserData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserEmail(user.email);

    // 1. Fetch User's Leagues
    const { data: memberships } = await supabase
      .from('league_members')
      .select('leagues ( id, name, image_url, invite_code )')
      .eq('user_id', user.email);

    if (memberships) {
      setMyLeagues(memberships.map(m => m.leagues).filter(Boolean));
    }

    // 2. Fetch User's Active Picks
    const { data: picks } = await supabase
      .from('picks')
      .select('*, fight:fights(*)')
      .eq('user_id', user.email)
      .order('created_at', { ascending: false });

    // Filter for fights in the future
    const now = new Date();
    const active = (picks || []).filter(p => p.fight && new Date(p.fight.start_time) > now);
    setMyActivePicks(active);
  };

  return (
    <>
      {/* 1. THE TOGGLE BUTTON (Mobile Only) */}
      <button 
        onClick={() => setIsOpen(true)}
        className="md:hidden fixed top-4 left-4 z-50 p-2 bg-black/50 border border-gray-800 rounded text-pink-500 backdrop-blur-md shadow-lg"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
        </svg>
      </button>

      {/* 2. THE OVERLAY */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/90 z-[60] backdrop-blur-sm transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* 3. THE SIDEBAR DRAWER */}
      <div className={`fixed inset-y-0 left-0 w-80 bg-gray-950 border-r border-gray-800 shadow-2xl transform transition-transform duration-300 ease-in-out z-[70] ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        
        <div className="p-6 h-full flex flex-col overflow-y-auto scrollbar-hide">
            {/* Header */}
            <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase">
                    CHOOSE YOUR <span className="text-pink-600">FIGHTER</span>
                </h2>
                <button onClick={() => setIsOpen(false)} className="text-gray-500 hover:text-white text-xl">✕</button>
            </div>

            {/* --- NEW: MY ACTIVE PICKS (Replaces the Live Ticker) --- */}
            {myActivePicks.length > 0 && (
                <div className="mb-8 border-b border-gray-800 pb-6 animate-in slide-in-from-left duration-500">
                    <div className="flex items-center justify-between mb-3">
                        <div className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">My Active Picks</div>
                        <span className="w-1.5 h-1.5 rounded-full bg-pink-500 animate-pulse"></span>
                    </div>
                    <div className="space-y-2">
                        {myActivePicks.map((pick) => {
                             const opponent = pick.fight.fighter_1_name === pick.selected_fighter 
                             ? pick.fight.fighter_2_name 
                             : pick.fight.fighter_1_name;

                             return (
                                <div key={pick.id} className="bg-gray-900 border border-gray-800 p-3 rounded flex justify-between items-center group">
                                    <div>
                                        <div className="text-teal-400 font-bold text-xs uppercase italic group-hover:text-pink-500 transition-colors">{pick.selected_fighter}</div>
                                        <div className="text-[10px] text-gray-600 uppercase font-bold">vs {opponent}</div>
                                    </div>
                                    <span className="text-xs font-mono font-black text-white">{pick.odds_at_pick > 0 ? `+${pick.odds_at_pick}` : pick.odds_at_pick}</span>
                                </div>
                             );
                        })}
                    </div>
                </div>
            )}

            {/* League List */}
            <div className="flex-1 space-y-3">
                <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">My Leagues</div>
                
                {/* Global League Link */}
                <Link href="/" onClick={() => setIsOpen(false)} className="p-2 rounded flex items-center gap-3 hover:bg-gray-900 transition-colors group">
                    <div className="w-8 h-8 rounded-full bg-teal-900/20 border border-teal-500/50 flex items-center justify-center font-bold text-teal-500 text-xs group-hover:bg-teal-500 group-hover:text-black transition-all">GL</div>
                    <div className="text-gray-300 font-bold text-sm group-hover:text-white">Global Feed</div>
                </Link>

                {/* Dynamic User Leagues */}
                {myLeagues.map(league => (
                    <Link key={league.id} href={`/league/${league.id}`} onClick={() => setIsOpen(false)} className="p-2 rounded flex items-center gap-3 hover:bg-gray-900 transition-colors group">
                        <div className="w-8 h-8 rounded-full bg-gray-900 border border-gray-700 flex items-center justify-center overflow-hidden shrink-0 group-hover:border-pink-500 transition-colors">
                            {league.image_url ? (
                                <img src={league.image_url} alt={league.name} className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-[10px] font-bold text-gray-500 group-hover:text-white">{league.name.substring(0,2).toUpperCase()}</span>
                            )}
                        </div>
                        <div className="text-gray-300 font-bold text-sm group-hover:text-white truncate">{league.name}</div>
                    </Link>
                ))}

                {/* Create New */}
                <Link href="/create-league" onClick={() => setIsOpen(false)} className="block w-full py-3 mt-4 border border-dashed border-gray-700 text-gray-500 rounded hover:text-pink-500 hover:border-pink-500 hover:bg-pink-900/10 transition-all text-xs font-bold uppercase text-center tracking-wider">
                    + Create / Join League
                </Link>
            </div>

            {/* Footer Links */}
            <div className="mt-8 border-t border-gray-800 pt-6 space-y-4">
                <Link href="/profile" className="block text-gray-400 hover:text-white text-sm font-bold uppercase tracking-wide">👤 My Profile</Link>
                <Link href="/leaderboard" className="block text-gray-400 hover:text-white text-sm font-bold uppercase tracking-wide">🏆 Global Standings</Link>
            </div>
        </div>
      </div>
    </>
  );
}