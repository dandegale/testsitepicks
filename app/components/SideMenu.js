'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { motion, AnimatePresence } from 'framer-motion';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function SideMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [globalPicks, setGlobalPicks] = useState([]);

  // --- REALTIME LISTENER FOR GLOBAL PICKS ---
  useEffect(() => {
    const channel = supabase
      .channel('global-activity')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'picks' }, (payload) => {
        const id = Math.random().toString(36).substring(7);
        const newPick = { ...payload.new, tempId: id };

        // Add to list, limit to 2 most recent for the sidebar space
        setGlobalPicks((prev) => [newPick, ...prev].slice(0, 2));

        // Remove after 3 seconds
        setTimeout(() => {
          setGlobalPicks((prev) => prev.filter((p) => p.tempId !== id));
        }, 3000);
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  return (
    <>
      {/* 1. THE TOGGLE BUTTON */}
      <button 
        onClick={() => setIsOpen(true)}
        className="mr-4 p-2 text-pink-500 hover:text-pink-400 border border-pink-900 hover:border-pink-500 rounded transition-colors relative"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
        </svg>
        {/* Little pulse dot if there's activity */}
        {globalPicks.length > 0 && (
          <span className="absolute top-0 right-0 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-pink-500"></span>
          </span>
        )}
      </button>

      {/* 2. THE OVERLAY */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/80 z-40 backdrop-blur-sm transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* 3. THE SIDEBAR DRAWER */}
      <div className={`fixed inset-y-0 left-0 w-72 bg-gray-950 border-r border-pink-900 shadow-2xl transform transition-transform duration-300 ease-in-out z-50 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        
        <div className="p-6 h-full flex flex-col">
            {/* Header */}
            <div className="flex justify-between items-center mb-8">
                <h2 className="text-xl font-black text-white italic tracking-tighter uppercase">
                    <span className="text-pink-500">Fight</span> Leagues
                </h2>
                <button onClick={() => setIsOpen(false)} className="text-gray-500 hover:text-white">✕</button>
            </div>

            {/* --- NEW: GLOBAL ACTIVITY TICKER --- */}
            <div className="mb-8 min-h-[100px]">
                <div className="text-[10px] font-black text-pink-500 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-pink-500 animate-pulse"></span>
                    Live Action
                </div>
                <div className="space-y-2">
                    <AnimatePresence mode="popLayout">
                        {globalPicks.map((pick) => (
                            <motion.div
                                key={pick.tempId}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className="bg-gray-900 border border-gray-800 p-2 rounded text-[11px]"
                            >
                                <div className="text-gray-500 font-bold mb-1">@{pick.user_id.split('@')[0]}</div>
                                <div className="text-white font-black uppercase italic">{pick.selected_fighter}</div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                    {globalPicks.length === 0 && (
                        <div className="text-[10px] text-gray-700 italic border border-dashed border-gray-900 p-4 text-center rounded">
                            Scanning for picks...
                        </div>
                    )}
                </div>
            </div>

            {/* League List (Original) */}
            <div className="flex-1 space-y-4 overflow-y-auto pr-2 scrollbar-hide">
                <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">My Leagues</div>
                
                <div className="p-3 bg-pink-900/20 border border-pink-500/50 rounded flex items-center gap-3 cursor-pointer hover:bg-pink-900/40 transition-colors">
                    <div className="w-8 h-8 rounded-full bg-pink-600 flex items-center justify-center font-bold text-black text-xs">GL</div>
                    <div>
                        <div className="text-white font-bold text-sm">Global League</div>
                        <div className="text-pink-400 text-xs">24 Members</div>
                    </div>
                </div>

                {/* Create New */}
                <button className="w-full py-3 border border-dashed border-gray-700 text-gray-500 rounded hover:text-teal-400 hover:border-teal-500 hover:bg-teal-900/10 transition-all text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2">
                    <span>+</span> Create League
                </button>
            </div>

            {/* Footer Links */}
            <div className="mt-auto border-t border-gray-800 pt-6 space-y-3">
                <Link href="/profile" className="block text-gray-400 hover:text-white text-sm font-bold">👤 My Profile</Link>
                <Link href="/settings" className="block text-gray-400 hover:text-white text-sm font-bold">⚙️ Settings</Link>
            </div>
        </div>
      </div>
    </>
  );
}