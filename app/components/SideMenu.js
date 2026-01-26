'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function SideMenu() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* 1. THE TOGGLE BUTTON (Visible always) */}
      <button 
        onClick={() => setIsOpen(true)}
        className="mr-4 p-2 text-pink-500 hover:text-pink-400 border border-pink-900 hover:border-pink-500 rounded transition-colors"
      >
        {/* Hamburger Icon */}
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
        </svg>
      </button>

      {/* 2. THE OVERLAY (Darkens the background) */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/80 z-40 backdrop-blur-sm transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* 3. THE SIDEBAR DRAWER */}
      <div className={`fixed inset-y-0 left-0 w-72 bg-gray-950 border-r border-pink-900 shadow-2xl shadow-pink-900/20 transform transition-transform duration-300 ease-in-out z-50 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        
        <div className="p-6 h-full flex flex-col">
            {/* Header */}
            <div className="flex justify-between items-center mb-8">
                <h2 className="text-xl font-black text-white italic tracking-tighter uppercase">
                    <span className="text-pink-500">Fight</span> Leagues
                </h2>
                <button onClick={() => setIsOpen(false)} className="text-gray-500 hover:text-white">
                    ✕
                </button>
            </div>

            {/* League List */}
            <div className="flex-1 space-y-4">
                <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">My Leagues</div>
                
                {/* Active League */}
                <div className="p-3 bg-pink-900/20 border border-pink-500/50 rounded flex items-center gap-3 cursor-pointer hover:bg-pink-900/40 transition-colors">
                    <div className="w-8 h-8 rounded-full bg-pink-600 flex items-center justify-center font-bold text-black text-xs">
                        GL
                    </div>
                    <div>
                        <div className="text-white font-bold text-sm">Global League</div>
                        <div className="text-pink-400 text-xs">24 Members</div>
                    </div>
                </div>

                {/* Inactive League (Example) */}
                <div className="p-3 bg-gray-900 border border-gray-800 rounded flex items-center gap-3 cursor-pointer hover:border-gray-600 transition-colors opacity-50 hover:opacity-100">
                    <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center font-bold text-gray-400 text-xs">
                        WF
                    </div>
                    <div>
                        <div className="text-gray-400 font-bold text-sm">Work Friends</div>
                        <div className="text-gray-600 text-xs">8 Members</div>
                    </div>
                </div>

                {/* Create New */}
                <button className="w-full py-3 border border-dashed border-gray-700 text-gray-500 rounded hover:text-teal-400 hover:border-teal-500 hover:bg-teal-900/10 transition-all text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2">
                    <span>+</span> Create League
                </button>
            </div>

            {/* Footer Links */}
            <div className="mt-auto border-t border-gray-800 pt-6 space-y-3">
                <Link href="/profile" className="block text-gray-400 hover:text-white text-sm font-bold flex items-center gap-2">
                    👤 My Profile
                </Link>
                <Link href="/settings" className="block text-gray-400 hover:text-white text-sm font-bold flex items-center gap-2">
                    ⚙️ Settings
                </Link>
            </div>
        </div>
      </div>
    </>
  );
}