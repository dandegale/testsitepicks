'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function OnboardingModal({ onOpenShowdown }) {
  const router = useRouter();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const hasSeenOnboarding = localStorage.getItem('hasSeenOnboarding');
    if (!hasSeenOnboarding) {
      setIsVisible(true);
    }
  }, []);

  const handleClose = () => {
    localStorage.setItem('hasSeenOnboarding', 'true');
    setIsVisible(false);
  };

  const handleGoToGuide = () => {
    localStorage.setItem('hasSeenOnboarding', 'true');
    setIsVisible(false);
    router.push('/how-it-works');
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 font-sans">
      
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/90 backdrop-blur-md animate-in fade-in duration-500"></div>

      {/* The Modal Container */}
      <div className="relative w-full max-w-4xl bg-[#050505] border border-gray-800 rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.8)] flex flex-col max-h-[95vh] animate-in zoom-in-95 duration-300">
          
          {/* Header */}
          <div className="p-6 md:p-8 border-b border-gray-800/60 text-center relative bg-gradient-to-b from-gray-900/30 to-transparent shrink-0">
              <h2 className="text-3xl md:text-4xl font-black italic uppercase tracking-tighter text-white mb-2">
                  Welcome to FIGHT<span className="text-pink-600">IQ</span>
              </h2>
              <p className="text-gray-400 text-xs md:text-sm font-bold uppercase tracking-widest">
                  Two Ways to Play. One Ultimate Champion.
              </p>
          </div>

          {/* 2x2 Interactive Content Grid */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                  
                  {/* 1. Global Feed */}
                  <button 
                      onClick={() => { handleClose(); router.push('/'); }}
                      className="w-full text-left bg-gray-950/50 border border-pink-500/30 rounded-2xl p-5 hover:border-pink-500 hover:-translate-y-1 hover:bg-gray-900 transition-all shadow-[0_0_20px_rgba(219,39,119,0.05)] hover:shadow-[0_10px_30px_rgba(219,39,119,0.15)] flex flex-col group outline-none"
                  >
                      <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 rounded-full bg-pink-500/10 flex items-center justify-center text-pink-500 shrink-0 group-hover:bg-pink-500 group-hover:text-white transition-all">
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          </div>
                          <h3 className="text-lg md:text-xl font-black italic uppercase text-white tracking-tighter group-hover:text-pink-400 transition-colors">1. Global Feed</h3>
                      </div>
                      <p className="text-xs md:text-sm text-gray-400 leading-relaxed font-medium">
                          Choose who will win every upcoming fight. The points system is based on a <span className="text-pink-400 font-bold group-hover:text-pink-300">hypothetical $10 bet using Vegas odds</span>. The more points you gain, the further you climb up the Global Leaderboard.
                      </p>
                  </button>

                  {/* 2. Leaderboards */}
                  <button 
                      onClick={() => { handleClose(); router.push('/leaderboard'); }}
                      className="w-full text-left bg-gray-950/50 border border-yellow-500/30 rounded-2xl p-5 hover:border-yellow-500 hover:-translate-y-1 hover:bg-gray-900 transition-all shadow-[0_0_20px_rgba(234,179,8,0.05)] hover:shadow-[0_10px_30px_rgba(234,179,8,0.15)] flex flex-col group outline-none"
                  >
                      <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center text-yellow-500 shrink-0 group-hover:bg-yellow-500 group-hover:text-black transition-all">
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                          </div>
                          <h3 className="text-lg md:text-xl font-black italic uppercase text-white tracking-tighter group-hover:text-yellow-400 transition-colors">2. Seasons & Ranks</h3>
                      </div>
                      <p className="text-xs md:text-sm text-gray-400 leading-relaxed font-medium">
                          Your points from the Global Feed determine your rank against the entire community. The leaderboard <span className="text-yellow-500 font-bold group-hover:text-yellow-400">resets every season (every 3 months)</span>, allowing new managers a chance to claim the throne.
                      </p>
                  </button>

                  {/* 3. Leagues */}
                  <button 
                      onClick={() => { handleClose(); router.push('/discover'); }}
                      className="w-full text-left bg-gray-950/50 border border-teal-500/30 rounded-2xl p-5 hover:border-teal-500 hover:-translate-y-1 hover:bg-gray-900 transition-all shadow-[0_0_20px_rgba(20,184,166,0.05)] hover:shadow-[0_10px_30px_rgba(20,184,166,0.15)] flex flex-col group outline-none"
                  >
                      <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 rounded-full bg-teal-500/10 flex items-center justify-center text-teal-500 shrink-0 group-hover:bg-teal-500 group-hover:text-black transition-all">
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                          </div>
                          <h3 className="text-lg md:text-xl font-black italic uppercase text-white tracking-tighter group-hover:text-teal-400 transition-colors">3. Fantasy Leagues</h3>
                      </div>
                      <p className="text-xs md:text-sm text-gray-400 leading-relaxed font-medium">
                          Draft a 5-fighter roster. Fighters gain points based on their <span className="text-teal-400 font-bold group-hover:text-teal-300">in-cage performance</span> (strikes, takedowns, finishes), which are then <span className="text-teal-400 font-bold group-hover:text-teal-300">scaled by Vegas odds</span> to equalize unfair matchups. Taking a risk on an underdog pays off big!
                      </p>
                  </button>

                  {/* 4. 1v1 Showdowns */}
                  <button 
                      onClick={() => { 
                          handleClose(); 
                          if (onOpenShowdown) onOpenShowdown(); 
                      }}
                      className="w-full text-left bg-gray-950/50 border border-orange-500/30 rounded-2xl p-5 hover:border-orange-500 hover:-translate-y-1 hover:bg-gray-900 transition-all shadow-[0_0_20px_rgba(249,115,22,0.05)] hover:shadow-[0_10px_30px_rgba(249,115,22,0.15)] flex flex-col group outline-none"
                  >
                      <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-500 shrink-0 group-hover:bg-orange-500 group-hover:text-black transition-all">
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                          </div>
                          <h3 className="text-lg md:text-xl font-black italic uppercase text-white tracking-tighter group-hover:text-orange-400 transition-colors">4. 1v1 Showdowns</h3>
                      </div>
                      <p className="text-xs md:text-sm text-gray-400 leading-relaxed font-medium">
                          Want to settle a debate? Challenge a friend directly to a <span className="text-orange-500 font-bold group-hover:text-orange-400">1 vs 1 format of the league</span>. You both draft a roster and battle it out using the exact same performance and odds-scaled scoring format.
                      </p>
                  </button>

              </div>
          </div>

          {/* Footer Actions */}
          <div className="p-4 md:p-6 border-t border-gray-800 bg-black/40 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
              <button 
                  onClick={handleGoToGuide}
                  className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-teal-500 hover:text-teal-400 transition-colors order-2 sm:order-1"
              >
                  Read Full Scoring Guide
              </button>
              
              <button 
                  onClick={handleClose}
                  className="w-full sm:w-auto px-10 py-3.5 bg-pink-600 hover:bg-pink-500 text-white rounded-xl font-black uppercase tracking-widest text-xs md:text-sm shadow-[0_0_20px_rgba(236,72,153,0.3)] transition-all active:scale-95 order-1 sm:order-2"
              >
                  Close Tutorial
              </button>
          </div>

      </div>
    </div>
  );
}