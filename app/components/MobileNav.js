'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function MobileNav({ onToggleLeagues }) {
  const pathname = usePathname();

  const isActive = (path) => pathname === path;

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-gray-950 border-t border-gray-800 z-50 pb-safe">
      <div className="grid grid-cols-4 h-full">
        
        {/* 1. HOME / FEED */}
        <Link 
            href="/" 
            className={`flex flex-col items-center justify-center gap-1 ${isActive('/') ? 'text-pink-500' : 'text-gray-500'}`}
        >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>
            <span className="text-[9px] font-bold uppercase tracking-wider">Feed</span>
        </Link>

        {/* 2. LEAGUES (Trigger Sidebar) */}
        <button 
            onClick={onToggleLeagues}
            className="flex flex-col items-center justify-center gap-1 text-gray-500 hover:text-white"
        >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
            <span className="text-[9px] font-bold uppercase tracking-wider">Leagues</span>
        </button>

        {/* 3. MY PICKS */}
        <Link 
            href="/my-picks" 
            className={`flex flex-col items-center justify-center gap-1 ${isActive('/my-picks') ? 'text-pink-500' : 'text-gray-500'}`}
        >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg>
            <span className="text-[9px] font-bold uppercase tracking-wider">Picks</span>
        </Link>

        {/* 4. PROFILE */}
        <Link 
            href="/profile" 
            className={`flex flex-col items-center justify-center gap-1 ${isActive('/profile') ? 'text-pink-500' : 'text-gray-500'}`}
        >
             <div className="w-5 h-5 rounded-full bg-gray-800 border border-gray-600 flex items-center justify-center text-[8px] font-black text-white">
                ME
            </div>
            <span className="text-[9px] font-bold uppercase tracking-wider">Profile</span>
        </Link>

      </div>
    </div>
  );
}