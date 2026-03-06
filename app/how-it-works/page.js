'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

import LeagueRail from '../components/LeagueRail';
import MobileNav from '../components/MobileNav';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function HowItWorks() {
  const [user, setUser] = useState(null);
  const [clientLeagues, setClientLeagues] = useState([]);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  // Stat Inputs
  const [sigStrikes, setSigStrikes] = useState(45);
  const [takedowns, setTakedowns] = useState(2);
  const [knockdowns, setKnockdowns] = useState(0);
  const [subAttempts, setSubAttempts] = useState(0);
  const [controlMins, setControlMins] = useState(3);
  const [controlSecs, setControlSecs] = useState(30);

  // Outcome Inputs
  const [vegasOdds, setVegasOdds] = useState(-150);
  const [winMethod, setWinMethod] = useState('Decision');
  const [finishRound, setFinishRound] = useState('3');
  const [specialty, setSpecialty] = useState('None');

  // --- DATA LOADING ---
  useEffect(() => {
      const loadUserAndLeagues = async () => {
          const { data: { user: currentUser } } = await supabase.auth.getUser();
          if (currentUser) {
              setUser(currentUser);
              const { data: memberships } = await supabase
                  .from('league_members')
                  .select('leagues ( id, name, image_url, invite_code )')
                  .eq('user_id', currentUser.email);
              
              if (memberships) {
                  setClientLeagues(memberships.map(m => m.leagues).filter(Boolean));
              }
          }
      };
      loadUserAndLeagues();
  }, []);

  // --- EXACT SCRAPER MATH ---
  const controlTimeTotalMins = (controlMins || 0) + ((controlSecs || 0) / 60);
  const baseStriking = ((sigStrikes || 0) * 0.25) + ((knockdowns || 0) * 5);
  const baseGrappling = ((takedowns || 0) * 2.5) + ((subAttempts || 0) * 3) + (controlTimeTotalMins * 1.8);
  const totalBasePoints = baseStriking + baseGrappling;

  let oddsMultiplier = 1;
  const numOdds = parseInt(vegasOdds) || 0;
  if (numOdds > 0) {
      oddsMultiplier = numOdds / 100;
  } else if (numOdds < 0) {
      oddsMultiplier = 100 / Math.abs(numOdds);
  }

  let baseBonus = 0;
  if (winMethod === 'Decision') {
      baseBonus = 10;
  } else if (winMethod === 'KO' || winMethod === 'Submission') {
      if (specialty === 'Last 10s' && finishRound === '5') {
          baseBonus = 100;
      } else if (specialty === 'Under 30s' && finishRound === '1') {
          baseBonus = winMethod === 'KO' ? 60 : 65;
      } else {
          if (finishRound === '1') baseBonus = 35;
          if (finishRound === '2') baseBonus = 25;
          if (finishRound === '3') baseBonus = 20;
          if (finishRound === '4') baseBonus = 25;
          if (finishRound === '5') baseBonus = 40;
      }
  }

  let finalBonus = parseFloat((baseBonus * oddsMultiplier).toFixed(2));
  let favoriteBonusApplied = false;
  if (numOdds < 0 && (winMethod === 'KO' || winMethod === 'Submission')) {
      finalBonus += 10;
      favoriteBonusApplied = true;
  }

  const finalScore = totalBasePoints + finalBonus;

  // --- THE 4 PILLARS (SYNCED WITH MODAL) ---
  const steps = [
      {
          icon: (
              <svg className="w-10 h-10 text-pink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
          ),
          title: "1. Global Feed",
          description: "Choose who will win every upcoming fight. The points system is based on a hypothetical $10 bet using Vegas odds. The more points you gain, the further you climb up the Global Leaderboard.",
          accent: "text-pink-500",
          border: "group-hover:border-pink-500/50",
          glow: "bg-pink-600/5 group-hover:bg-pink-600/10",
          shadow: "group-hover:shadow-[0_0_30px_rgba(236,72,153,0.15)]",
          link: "/",
          linkText: "Go to Dashboard"
      },
      {
          icon: (
              <svg className="w-10 h-10 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
          ),
          title: "2. Seasons & Ranks",
          description: "Your points from the Global Feed determine your rank against the entire community. The leaderboard resets every season (every 3 months), allowing new managers a chance to claim the throne.",
          accent: "text-yellow-500",
          border: "group-hover:border-yellow-500/50",
          glow: "bg-yellow-600/5 group-hover:bg-yellow-600/10",
          shadow: "group-hover:shadow-[0_0_30px_rgba(234,179,8,0.15)]",
          link: "/leaderboard",
          linkText: "View Leaderboards"
      },
      {
          icon: (
              <svg className="w-10 h-10 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
          ),
          title: "3. Fantasy Leagues",
          description: "Draft a 5-fighter roster. Fighters gain points based on their in-cage performance (strikes, takedowns, finishes), which are then scaled by Vegas odds to equalize unfair matchups. Taking a risk on an underdog pays off big!",
          accent: "text-teal-500",
          border: "group-hover:border-teal-500/50",
          glow: "bg-teal-600/5 group-hover:bg-teal-600/10",
          shadow: "group-hover:shadow-[0_0_30px_rgba(20,184,166,0.15)]",
          link: "/discover",
          linkText: "Discover Leagues"
      },
      {
          icon: (
              <svg className="w-10 h-10 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
          ),
          title: "4. 1v1 Showdowns",
          description: "Want to settle a debate? Challenge a friend directly to a 1 vs 1 format of the league. You both draft a roster and battle it out using the exact same performance and odds-scaled scoring format.",
          accent: "text-orange-500",
          border: "group-hover:border-orange-500/50",
          glow: "bg-orange-600/5 group-hover:bg-orange-600/10",
          shadow: "group-hover:shadow-[0_0_30px_rgba(249,115,22,0.15)]",
          link: "/",
          linkText: "Go to Dashboard (Click 1v1)"
      }
  ];

  return (
    <div className="flex min-h-screen bg-black text-white font-sans selection:bg-pink-500 overflow-hidden">
      
      {/* 🎯 DESKTOP LEAGUE RAIL */}
      <div className="hidden md:block transition-all duration-500 ml-0 z-[70]">
          <LeagueRail initialLeagues={clientLeagues} />
      </div>

      {/* 🎯 MOBILE MENU DRAWER */}
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
                          {clientLeagues && clientLeagues.length > 0 ? (
                              clientLeagues.map(league => (
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

      <main className="flex-1 h-screen overflow-y-auto scrollbar-hide relative flex flex-col pb-24 md:pb-0 w-full"> 
        
        {/* 🎯 GLOBAL TOP MENU */}
        <header className="sticky top-0 z-[60] w-full bg-black/80 backdrop-blur-xl border-b border-gray-800">
            <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between w-full">
                <div className="flex items-center gap-3 md:gap-4">
                    {/* TEAL HAMBURGER */}
                    <button 
                        onClick={() => setShowMobileMenu(true)} 
                        className="md:hidden p-1 text-teal-400 hover:text-teal-300 transition-colors drop-shadow-[0_0_5px_rgba(45,212,191,0.5)] animate-pulse"
                    >
                        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" /></svg>
                    </button>

                    <Link href="/" className="text-xl md:text-2xl font-black italic text-white tracking-tighter uppercase">
                        FIGHT<span className="text-pink-600">IQ</span>
                    </Link>
                    <div className="hidden md:block h-4 w-px bg-gray-800 mx-2"></div>
                    <nav className="hidden lg:flex gap-6 text-[10px] font-black uppercase tracking-widest text-gray-500">
                        <span className="text-white cursor-default">How It Works</span>
                        <Link href="/" className="hover:text-white transition-colors">Global Feed</Link>
                        <Link href="/leaderboard" className="hover:text-white transition-colors">Leaderboards</Link>
                        <Link href="/store" className="hover:text-pink-400 text-pink-600 transition-colors flex items-center gap-1">
                            <span>STORE</span>
                        </Link>
                    </nav>
                </div>
            </div>
        </header>

        {/* HERO HEADER */}
        <div className="pt-12 pb-10 px-4 text-center bg-gradient-to-b from-gray-900/50 to-black border-b border-gray-800/50">
          <h1 className="text-4xl md:text-6xl font-black italic uppercase tracking-tighter mb-3 text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-teal-400">
            Master the Octagon
          </h1>
          <p className="text-gray-400 font-bold tracking-widest uppercase text-[10px] md:text-xs max-w-2xl mx-auto">
            Your guide to climbing the ranks and building your Fight IQ legacy.
          </p>
        </div>

        <div className="max-w-5xl mx-auto w-full p-4 md:p-8">
          
          {/* =========================================
              PART 1: THE CORE PILLARS (2x2 GRID)
          ========================================= */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-16 mt-4">
              {steps.map((step, idx) => (
                  <Link 
                      href={step.link}
                      key={idx} 
                      className={`group relative bg-gray-950 border border-gray-800 rounded-3xl p-6 md:p-8 flex flex-col items-start text-left transition-all duration-300 hover:-translate-y-2 ${step.border} ${step.shadow} overflow-hidden outline-none`}
                  >
                      <div className={`absolute inset-0 transition-colors duration-500 ${step.glow}`}></div>
                      
                      <div className="relative z-10 flex flex-col h-full w-full">
                          <div className="flex items-center gap-4 mb-4">
                              <div className="transform transition-transform duration-500 group-hover:scale-110 drop-shadow-lg">
                                  {step.icon}
                              </div>
                              <h2 className="text-xl md:text-2xl font-black italic uppercase text-white tracking-tighter group-hover:text-white/80 transition-colors">
                                  {step.title}
                              </h2>
                          </div>

                          <p className="text-xs md:text-sm text-gray-400 font-medium leading-relaxed mb-6 flex-1">
                              {step.description}
                          </p>
                          
                          <div className={`mt-auto pt-4 border-t border-gray-800/50 w-full flex justify-between items-center ${step.accent}`}>
                              <span className="text-[10px] font-black uppercase tracking-widest">{step.linkText}</span>
                              <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                          </div>
                      </div>
                  </Link>
              ))}
          </div>

          {/* =========================================
              PART 2: THE STATIC CHEAT SHEET
          ========================================= */}
          <div className="border-t border-gray-800/50 pt-12">
            <div className="text-center mb-8">
                <h2 className="text-3xl md:text-4xl font-black italic uppercase tracking-tighter text-white mb-1">The Scoring System</h2>
                <p className="text-gray-500 uppercase font-bold tracking-widest text-[9px] md:text-[10px]">How your fighters earn points in the cage.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
                
                <div className="bg-[#0b0e14] border border-gray-800/60 rounded-xl p-6 shadow-lg relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-pink-600"></div>
                    <h2 className="text-lg font-black italic uppercase text-white mb-5 tracking-tight">Striking Metrics</h2>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center border-b border-gray-800/50 pb-3">
                            <span className="font-bold text-gray-400 uppercase tracking-wider text-xs">Significant Strike</span>
                            <span className="text-pink-500 font-black text-base">+ 0.25</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-gray-800/50 pb-3">
                            <span className="font-bold text-gray-400 uppercase tracking-wider text-xs">Knockdown</span>
                            <span className="text-pink-500 font-black text-base">+ 5.0</span>
                        </div>
                    </div>
                </div>

                <div className="bg-[#0b0e14] border border-gray-800/60 rounded-xl p-6 shadow-lg relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-teal-500"></div>
                    <h2 className="text-lg font-black italic uppercase text-white mb-5 tracking-tight">Grappling Metrics</h2>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center border-b border-gray-800/50 pb-3">
                            <span className="font-bold text-gray-400 uppercase tracking-wider text-xs">Takedown Landed</span>
                            <span className="text-teal-400 font-black text-base">+ 2.5</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-gray-800/50 pb-3">
                            <span className="font-bold text-gray-400 uppercase tracking-wider text-xs">Submission Attempt</span>
                            <span className="text-teal-400 font-black text-base">+ 3.0</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-gray-800/50 pb-3">
                            <span className="font-bold text-gray-400 uppercase tracking-wider text-xs">Control Time (Per Min)</span>
                            <span className="text-teal-400 font-black text-base">+ 1.8</span>
                        </div>
                    </div>
                </div>

                {/* OUTCOME BONUSES */}
                <div className="md:col-span-2 bg-[#0b0e14] border border-gray-800/60 rounded-xl p-6 shadow-lg">
                    <h2 className="text-lg font-black italic uppercase text-white mb-4 tracking-tight text-center">Base Outcome Bonuses</h2>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center">
                        <div className="bg-gray-900/50 p-3 rounded-lg border border-gray-800/50 flex flex-col justify-center">
                            <p className="text-gray-500 font-bold uppercase tracking-widest text-[9px] mb-1">Decision</p>
                            <p className="text-sm font-black text-white">10x Odds</p>
                        </div>
                        <div className="bg-gray-900/50 p-3 rounded-lg border border-gray-800/50 flex flex-col justify-center">
                            <p className="text-gray-500 font-bold uppercase tracking-widest text-[9px] mb-1">Round 1</p>
                            <p className="text-sm font-black text-white">+ 35 pts</p>
                        </div>
                        <div className="bg-gray-900/50 p-3 rounded-lg border border-gray-800/50 flex flex-col justify-center">
                            <p className="text-gray-500 font-bold uppercase tracking-widest text-[9px] mb-1">Round 2 / 3</p>
                            <p className="text-sm font-black text-white">+ 25 / 20 pts</p>
                        </div>
                        <div className="bg-gray-900/50 p-3 rounded-lg border border-gray-800/50 flex flex-col justify-center">
                            <p className="text-gray-500 font-bold uppercase tracking-widest text-[9px] mb-1">Round 4 / 5</p>
                            <p className="text-sm font-black text-white">+ 25 / 40 pts</p>
                        </div>
                        <div className="bg-gradient-to-br from-pink-900/20 to-teal-900/20 p-3 rounded-lg border border-gray-700 flex flex-col justify-center col-span-2 md:col-span-1">
                            <p className="text-gray-400 font-bold uppercase tracking-widest text-[9px] mb-1">Specialty</p>
                            <p className="text-[10px] font-black text-white leading-tight">U30s: <span className="text-pink-500">+60</span><br/>L10s: <span className="text-teal-400">+100</span></p>
                        </div>
                    </div>
                </div>

                {/* ADVANCED MECHANICS EXPLANATION */}
                <div className="md:col-span-2 bg-gradient-to-r from-[#0b0e14] via-gray-900/40 to-[#0b0e14] border border-gray-800/60 rounded-xl p-6 md:p-8 shadow-lg relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-pink-500/5 blur-[100px] rounded-full pointer-events-none"></div>
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-teal-500/5 blur-[100px] rounded-full pointer-events-none"></div>
                    
                    <h2 className="text-xl font-black italic uppercase text-white mb-6 tracking-tight text-center relative z-10">Advanced Match Engine Rules</h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 relative z-10">
                        <div>
                            <h3 className="text-xs font-black text-yellow-500 uppercase tracking-widest mb-2 flex items-center gap-2"><span className="text-base">⚖️</span> Odds Scaling</h3>
                            <p className="text-gray-400 text-[10px] leading-relaxed font-medium">
                                Finish bonuses are mathematically scaled by Vegas Odds. <strong>Underdogs</strong> (+150 = 1.5x) receive massive multipliers to their finish points. <strong>Favorites</strong> (-300 = 0.33x) have their finish bonuses heavily reduced to balance their safety. 
                            </p>
                        </div>
                        
                        <div>
                            <h3 className="text-xs font-black text-pink-500 uppercase tracking-widest mb-2 flex items-center gap-2"><span className="text-base">🛡️</span> Fav Flat Bonus</h3>
                            <p className="text-gray-400 text-[10px] leading-relaxed font-medium">
                                Because massive favorites get their finish multipliers crushed by the Odds Scaling rule, any betting Favorite that successfully finishes a fight (KO/Sub) is awarded a flat <strong>+10.00 point</strong> compensation bonus to ensure finishes are always rewarded.
                            </p>
                        </div>

                        <div>
                            <h3 className="text-xs font-black text-teal-400 uppercase tracking-widest mb-2 flex items-center gap-2"><span className="text-base">🔥</span> The Equalizer</h3>
                            <p className="text-gray-400 text-[10px] leading-relaxed font-medium">
                                A winning fighter is mathematically guaranteed to <strong>never score fewer points than the loser</strong>. If a fighter is dominated for 14 minutes but lands a miracle submission, their final score is automatically bumped up to match the loser's total.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
          </div>

          {/* =========================================
              PART 3: THE INTERACTIVE CALCULATOR
          ========================================= */}
          <div className="pt-8 border-t border-gray-800/50 mt-8">
              <div className="text-center mb-8">
                  <h2 className="text-2xl md:text-3xl font-black italic uppercase tracking-tighter text-white mb-1">Fantasy Simulator</h2>
                  <p className="text-gray-500 uppercase font-bold tracking-widest text-[9px] md:text-[10px]">Test the engine math below.</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
                  
                  {/* LEFT COLUMN: THE INPUTS */}
                  <div className="lg:col-span-7 space-y-4 md:space-y-5">
                      
                      <div className="bg-[#0b0e14] border border-gray-800/60 rounded-xl p-4 md:p-5 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
                          <div className="text-center sm:text-left">
                              <h3 className="text-base md:text-lg font-black italic uppercase text-white tracking-tight">Vegas Odds</h3>
                          </div>
                          <div className="flex items-center gap-3 w-full sm:w-auto">
                              <span className="text-gray-400 font-black text-sm md:text-base">Odds:</span>
                              <input type="number" value={vegasOdds} onChange={(e) => setVegasOdds(e.target.value)} className="bg-black border border-gray-700 focus:border-pink-500 text-white font-mono text-sm text-center rounded w-full sm:w-24 py-1.5 outline-none transition-colors" />
                          </div>
                      </div>

                      <div className="bg-[#0b0e14] border border-gray-800/60 rounded-xl overflow-hidden shadow-lg p-2 md:p-4">
                          <div className="divide-y divide-gray-800/40">
                              {[ 
                                { label: 'Sig. Strikes', val: sigStrikes, set: setSigStrikes, color: 'text-pink-500', pts: '0.25' },
                                { label: 'Knockdowns', val: knockdowns, set: setKnockdowns, color: 'text-pink-500', pts: '5.0' },
                                { label: 'Takedowns', val: takedowns, set: setTakedowns, color: 'text-teal-400', pts: '2.5' },
                                { label: 'Sub Attempts', val: subAttempts, set: setSubAttempts, color: 'text-teal-400', pts: '3.0' }
                              ].map((item, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3">
                                  <div className="flex flex-col"><span className="text-xs font-bold text-gray-300 uppercase tracking-wide">{item.label}</span><span className={`text-[9px] font-mono ${item.color}`}>{item.pts} pts</span></div>
                                  <input type="number" value={item.val} onChange={(e) => item.set(Number(e.target.value))} className="bg-black border border-gray-700 text-white font-mono rounded w-16 p-1.5 text-right outline-none focus:border-pink-500 text-xs" />
                                </div>
                              ))}
                              <div className="flex items-center justify-between p-3">
                                  <div className="flex flex-col"><span className="text-xs font-bold text-gray-300 uppercase tracking-wide">Control Time</span><span className="text-[9px] font-mono text-teal-400">1.8 pts/m</span></div>
                                  <div className="flex items-center gap-1">
                                      <input type="number" placeholder="M" value={controlMins} onChange={(e) => setControlMins(Number(e.target.value))} className="bg-black border border-gray-700 text-white font-mono rounded w-12 p-1.5 text-center outline-none focus:border-teal-500 text-xs" />
                                      <span className="text-gray-500 text-xs">:</span>
                                      <input type="number" placeholder="S" value={controlSecs} onChange={(e) => setControlSecs(Number(e.target.value))} className="bg-black border border-gray-700 text-white font-mono rounded w-12 p-1.5 text-center outline-none focus:border-teal-500 text-xs" />
                                  </div>
                              </div>
                          </div>
                      </div>

                      <div className="bg-[#0b0e14] border border-gray-800/60 rounded-xl p-4 shadow-lg">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              <select className="bg-black border border-gray-700 text-white text-[10px] rounded p-2 outline-none font-bold uppercase" value={winMethod} onChange={(e) => setWinMethod(e.target.value)}>
                                  <option value="None">Loss / Draw</option>
                                  <option value="Decision">Decision Win</option>
                                  <option value="KO">KO / TKO</option>
                                  <option value="Submission">Submission</option>
                              </select>
                              <select className="bg-black border border-gray-700 text-white text-[10px] rounded p-2 outline-none font-bold uppercase disabled:opacity-30" value={finishRound} onChange={(e) => setFinishRound(e.target.value)} disabled={winMethod === 'Decision' || winMethod === 'None'}>
                                  <option value="1">Round 1</option><option value="2">Round 2</option><option value="3">Round 3</option><option value="4">Round 4</option><option value="5">Round 5</option>
                              </select>
                              <select className="bg-black border border-gray-700 text-white text-[10px] rounded p-2 outline-none font-bold uppercase disabled:opacity-30" value={specialty} onChange={(e) => setSpecialty(e.target.value)} disabled={winMethod === 'Decision' || winMethod === 'None'}>
                                  <option value="None">Normal Time</option><option value="Under 30s">Under 30 Secs</option><option value="Last 10s">Last 10 Secs</option>
                              </select>
                          </div>
                      </div>
                  </div>

                  {/* RIGHT COLUMN: THE RECEIPT */}
                  <div className="lg:col-span-5">
                      <div className="bg-black border border-gray-800/60 rounded-xl p-5 shadow-2xl lg:sticky lg:top-24">
                          <h3 className="text-center text-[10px] font-black uppercase tracking-widest text-gray-500 border-b border-gray-800/50 pb-3 mb-4">Live Receipt</h3>
                          
                          <div className="space-y-2 mb-4">
                              <div className="flex justify-between text-[10px] md:text-xs"><span className="text-gray-400 font-bold uppercase">Base Striking</span><span className="font-mono text-pink-500">{baseStriking.toFixed(2)}</span></div>
                              <div className="flex justify-between text-[10px] md:text-xs"><span className="text-gray-400 font-bold uppercase">Base Grappling</span><span className="font-mono text-teal-400">{baseGrappling.toFixed(2)}</span></div>
                              <div className="flex justify-between text-[10px] md:text-xs border-t border-gray-800/50 pt-2"><span className="text-gray-300 font-bold uppercase">Total Base</span><span className="font-mono text-white">{totalBasePoints.toFixed(2)}</span></div>
                          </div>

                          <div className="space-y-2 mb-4 bg-gray-900/30 p-3 rounded-lg border border-gray-800/50">
                              <div className="flex justify-between text-[9px] uppercase font-bold"><span className="text-gray-500">Odds Multiplier</span><span className="font-mono text-yellow-500">x {oddsMultiplier.toFixed(2)}</span></div>
                              {favoriteBonusApplied && (
                                  <div className="flex justify-between text-[9px] uppercase font-bold"><span className="text-pink-500">Fav Flat Bonus</span><span className="font-mono text-pink-500">+10.00</span></div>
                              )}
                              <div className="flex justify-between text-[10px] md:text-xs border-t border-gray-800/50 pt-2"><span className="text-gray-300 font-bold uppercase">Finish Bonus</span><span className="font-mono text-green-400">+{finalBonus.toFixed(2)}</span></div>
                          </div>

                          <div className="mt-4 border-t-2 border-dashed border-gray-800/80 pt-4 text-center">
                              <p className="text-gray-500 font-bold uppercase tracking-widest text-[9px] mb-1">Total Score</p>
                              <p className="text-4xl md:text-5xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-teal-400">
                                  {finalScore.toFixed(2)}
                              </p>
                          </div>
                          
                          <div className="mt-4 text-[8px] text-gray-600 uppercase tracking-widest font-bold text-center leading-tight">
                              *Equalizer Rule: The winner is guaranteed to never score fewer points than the loser in head-to-head match logic.
                          </div>
                      </div>
                  </div>

              </div>
          </div>

        </div>
      </main>

      {/* 🎯 MOBILE NAVIGATION */}
      <div className="md:hidden">
          <MobileNav onToggleLeagues={() => setShowMobileMenu(true)} />
      </div>
      
    </div>
  );
}