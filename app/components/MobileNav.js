'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

export default function MobileNav() {
  const pathname = usePathname();
  const [avatarUrl, setAvatarUrl] = useState(null);

  const isActive = (path) => pathname === path;

  useEffect(() => {
    async function fetchUserAvatar() {
      // Initialize Supabase inside the effect
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL, 
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      );

      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // First check if they logged in with Google/Discord and have a metadata avatar
        if (user.user_metadata?.avatar_url) {
          setAvatarUrl(user.user_metadata.avatar_url);
        } else {
          // If not, check if they uploaded a custom one to your profiles table
          const { data } = await supabase
            .from('profiles')
            .select('avatar_url')
            .eq('id', user.id)
            .single();
            
          if (data?.avatar_url) {
            setAvatarUrl(data.avatar_url);
          }
        }
      }
    }

    fetchUserAvatar();
  }, []);

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 h-20 bg-black/90 backdrop-blur-lg border-t border-gray-800/60 z-[90] pb-safe">
      <div className="grid grid-cols-4 h-full max-w-md mx-auto">
        
        {/* 1. HOME / FEED */}
        <Link 
            href="/" 
            className={`flex flex-col items-center justify-center gap-1.5 transition-all ${isActive('/') ? 'text-pink-500' : 'text-gray-500 hover:text-gray-300'}`}
        >
            <div className={`p-1.5 rounded-xl transition-all ${isActive('/') ? 'bg-pink-500/10' : ''}`}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest">Feed</span>
        </Link>

        {/* 2. STORE (Replaced Leaderboards) */}
        <Link 
            href="/store" 
            className={`flex flex-col items-center justify-center gap-1.5 transition-all ${isActive('/store') ? 'text-pink-500' : 'text-gray-500 hover:text-gray-300'}`}
        >
            <div className={`p-1.5 rounded-xl transition-all ${isActive('/store') ? 'bg-pink-500/10' : ''}`}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest">Store</span>
        </Link>

        {/* 3. MY PICKS */}
        <Link 
            href="/my-picks" 
            className={`flex flex-col items-center justify-center gap-1.5 transition-all ${isActive('/my-picks') ? 'text-teal-400' : 'text-gray-500 hover:text-gray-300'}`}
        >
            <div className={`p-1.5 rounded-xl transition-all ${isActive('/my-picks') ? 'bg-teal-400/10' : ''}`}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg>
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest">Picks</span>
        </Link>

        {/* 4. PROFILE WITH AVATAR FETCH */}
        <Link 
            href="/profile" 
            className={`flex flex-col items-center justify-center gap-1.5 transition-all ${isActive('/profile') ? 'text-pink-500' : 'text-gray-500 hover:text-gray-300'}`}
        >
             <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-[8px] font-black overflow-hidden transition-all ${isActive('/profile') ? 'border-pink-500 text-pink-500 ring-2 ring-pink-500/20' : 'border-gray-600 bg-gray-800 text-gray-400'}`}>
                {avatarUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                    "ME"
                )}
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest mt-0.5">Profile</span>
        </Link>

      </div>
    </div>
  );
}