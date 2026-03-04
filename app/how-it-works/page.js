'use client';

import Link from 'next/link';
import { useState } from 'react';

// 🚀 FIXED: Using relative paths to point to your app/components folder!
import SideMenu from '../components/SideMenu';
import LeagueRail from '../components/LeagueRail';
import MobileNav from '../components/MobileNav';

export default function HowItWorks() {
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

  return (
    <div className="flex min-h-screen bg-black text-white font-sans selection:bg-pink-500 overflow-hidden">
      
      {/* APP SHELL COMPONENTS */}
      <SideMenu />
      <div className="hidden md:block">
        <LeagueRail />
      </div>

      <main className="flex-1 h-screen overflow-y-auto scrollbar-hide relative flex flex-col pb-24 md:pb-0"> 
        
        {/* 🚀 THE GLOBAL TOP MENU */}
        <header className="sticky top-0 z-[60] w-full bg-black/80 backdrop-blur-xl border-b border-gray-800">
            <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/" className="text-xl md:text-2xl font-black italic text-white tracking-tighter uppercase">
                        FIGHT<span className="text-pink-600">IQ</span>
                    </Link>
                    <div className="hidden md:block h-4 w-px bg-gray-800 mx-2"></div>
                    <nav className="hidden lg:flex gap-6 text-[10px] font-black uppercase tracking-widest text-gray-500">
                        <Link href="/how-it-works" className="text-white hover:text-pink-400 transition-colors">How It Works</Link>
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
        <div className="pt-12 pb-10 px-4 text-center bg-gradient-to-b from-gray-900/50 to-black">
          <h1 className="text-4xl md:text-6xl font-black italic uppercase tracking-tighter mb-4 text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-teal-400">
            The Scoring System
          </h1>
          <p className="text-gray-400 font-bold tracking-widest uppercase text-[10px] md:text-xs max-w-2xl mx-auto">
            How your fighters earn points in the octagon.
          </p>
        </div>

        <div className="max-w-5xl mx-auto w-full p-4 md:p-8">
          
          {/* =========================================
              PART 1: THE STATIC CHEAT SHEET
          ========================================= */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
              
              <div className="bg-[#0b0e14] border border-gray-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-pink-600"></div>
                  <h2 className="text-xl font-black italic uppercase text-white mb-6 tracking-tight">Striking Metrics</h2>
                  <div className="space-y-4">
                      <div className="flex justify-between items-center border-b border-gray-800/60 pb-4">
                          <span className="font-bold text-gray-400 uppercase tracking-wider text-xs">Significant Strike</span>
                          <span className="text-pink-500 font-black text-lg">+ 0.25</span>
                      </div>
                      <div className="flex justify-between items-center border-b border-gray-800/60 pb-4">
                          <span className="font-bold text-gray-400 uppercase tracking-wider text-xs">Knockdown</span>
                          <span className="text-pink-500 font-black text-lg">+ 5.0</span>
                      </div>
                  </div>
              </div>

              <div className="bg-[#0b0e14] border border-gray-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-teal-500"></div>
                  <h2 className="text-xl font-black italic uppercase text-white mb-6 tracking-tight">Grappling Metrics</h2>
                  <div className="space-y-4">
                      <div className="flex justify-between items-center border-b border-gray-800/60 pb-4">
                          <span className="font-bold text-gray-400 uppercase tracking-wider text-xs">Takedown Landed</span>
                          <span className="text-teal-400 font-black text-lg">+ 2.5</span>
                      </div>
                      <div className="flex justify-between items-center border-b border-gray-800/60 pb-4">
                          <span className="font-bold text-gray-400 uppercase tracking-wider text-xs">Submission Attempt</span>
                          <span className="text-teal-400 font-black text-lg">+ 3.0</span>
                      </div>
                      <div className="flex justify-between items-center border-b border-gray-800/60 pb-4">
                          <span className="font-bold text-gray-400 uppercase tracking-wider text-xs">Control Time (Per Min)</span>
                          <span className="text-teal-400 font-black text-lg">+ 1.8</span>
                      </div>
                  </div>
              </div>

              <div className="md:col-span-2 bg-gradient-to-r from-[#0b0e14] via-gray-900/50 to-[#0b0e14] border border-gray-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
                  <h2 className="text-xl font-black italic uppercase text-white mb-3 tracking-tight text-center">Vegas Odds Scaling</h2>
                  <p className="text-gray-400 text-center max-w-2xl mx-auto font-bold tracking-wide leading-relaxed text-[10px] md:text-xs">
                      Baseline scores are scaled by a Vegas Odds Multiplier. <span className="text-teal-400">Underdogs</span> receive a boost, while <span className="text-pink-500">Favorites</span> are scaled for safety. Decision wins award <span className="text-white">10 x the Vegas Multiplier</span>.
                  </p>
              </div>
          </div>

          {/* =========================================
              PART 2: THE INTERACTIVE CALCULATOR
          ========================================= */}
          <div className="pt-8 border-t border-gray-800/50">
              <div className="text-center mb-8">
                  <h2 className="text-3xl font-black italic uppercase tracking-tighter text-white mb-1">Fantasy Simulator</h2>
                  <p className="text-gray-500 uppercase font-bold tracking-widest text-[10px]">Test the engine math below.</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
                  
                  {/* LEFT COLUMN: THE INPUTS */}
                  <div className="lg:col-span-7 space-y-5">
                      
                      <div className="bg-[#0b0e14] border border-gray-800 rounded-xl p-5 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
                          <div className="text-center sm:text-left">
                              <h3 className="text-lg font-black italic uppercase text-white tracking-tight">Vegas Odds</h3>
                          </div>
                          <div className="flex items-center gap-3 w-full sm:w-auto">
                              <span className="text-gray-400 font-black text-base">Odds:</span>
                              <input type="number" value={vegasOdds} onChange={(e) => setVegasOdds(e.target.value)} className="bg-black border border-gray-700 focus:border-pink-500 text-white font-mono text-base text-center rounded w-full sm:w-28 py-2 outline-none transition-colors" />
                          </div>
                      </div>

                      <div className="bg-[#0b0e14] border border-gray-800 rounded-xl overflow-hidden shadow-lg p-3">
                          <div className="divide-y divide-gray-800/50">
                              {[ 
                                { label: 'Sig. Strikes', val: sigStrikes, set: setSigStrikes, color: 'text-pink-500', pts: '0.25' },
                                { label: 'Knockdowns', val: knockdowns, set: setKnockdowns, color: 'text-pink-500', pts: '5.0' },
                                { label: 'Takedowns', val: takedowns, set: setTakedowns, color: 'text-teal-400', pts: '2.5' },
                                { label: 'Sub Attempts', val: subAttempts, set: setSubAttempts, color: 'text-teal-400', pts: '3.0' }
                              ].map((item, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3">
                                  <div className="flex flex-col"><span className="text-xs font-bold text-gray-300 uppercase">{item.label}</span><span className={`text-[10px] font-mono ${item.color}`}>{item.pts} pts</span></div>
                                  <input type="number" value={item.val} onChange={(e) => item.set(Number(e.target.value))} className="bg-black border border-gray-700 text-white font-mono rounded w-16 p-1.5 text-right outline-none focus:border-pink-500 text-sm" />
                                </div>
                              ))}
                              <div className="flex items-center justify-between p-3">
                                  <div className="flex flex-col"><span className="text-xs font-bold text-gray-300 uppercase">Control Time</span><span className="text-[10px] font-mono text-teal-400">1.8 pts/m</span></div>
                                  <div className="flex items-center gap-2">
                                      <input type="number" placeholder="M" value={controlMins} onChange={(e) => setControlMins(Number(e.target.value))} className="bg-black border border-gray-700 text-white font-mono rounded w-12 p-1.5 text-center outline-none focus:border-teal-500 text-sm" />
                                      <span className="text-gray-500">:</span>
                                      <input type="number" placeholder="S" value={controlSecs} onChange={(e) => setControlSecs(Number(e.target.value))} className="bg-black border border-gray-700 text-white font-mono rounded w-12 p-1.5 text-center outline-none focus:border-teal-500 text-sm" />
                                  </div>
                              </div>
                          </div>
                      </div>

                      <div className="bg-[#0b0e14] border border-gray-800 rounded-xl p-4 shadow-lg">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <select className="bg-black border border-gray-700 text-white text-[10px] rounded p-2.5 outline-none font-bold uppercase" value={winMethod} onChange={(e) => setWinMethod(e.target.value)}>
                                  <option value="None">Loss / Draw</option>
                                  <option value="Decision">Decision Win</option>
                                  <option value="KO">KO / TKO</option>
                                  <option value="Submission">Submission</option>
                              </select>
                              <select className="bg-black border border-gray-700 text-white text-[10px] rounded p-2.5 outline-none font-bold uppercase disabled:opacity-30" value={finishRound} onChange={(e) => setFinishRound(e.target.value)} disabled={winMethod === 'Decision' || winMethod === 'None'}>
                                  <option value="1">Round 1</option><option value="2">Round 2</option><option value="3">Round 3</option><option value="4">Round 4</option><option value="5">Round 5</option>
                              </select>
                              <select className="bg-black border border-gray-700 text-white text-[10px] rounded p-2.5 outline-none font-bold uppercase disabled:opacity-30" value={specialty} onChange={(e) => setSpecialty(e.target.value)} disabled={winMethod === 'Decision' || winMethod === 'None'}>
                                  <option value="None">Normal Time</option><option value="Under 30s">Under 30 Secs</option><option value="Last 10s">Last 10 Secs</option>
                              </select>
                          </div>
                      </div>
                  </div>

                  {/* RIGHT COLUMN: THE RECEIPT */}
                  <div className="lg:col-span-5">
                      <div className="bg-black border border-gray-800 rounded-2xl p-6 shadow-2xl lg:sticky lg:top-24">
                          <h3 className="text-center text-[10px] font-black uppercase tracking-widest text-gray-500 border-b border-gray-800 pb-3 mb-5">Engine Calculation</h3>
                          
                          <div className="space-y-3 mb-5">
                              <div className="flex justify-between text-xs"><span className="text-gray-400 font-bold uppercase">Base Striking</span><span className="font-mono text-pink-500">{baseStriking.toFixed(2)}</span></div>
                              <div className="flex justify-between text-xs"><span className="text-gray-400 font-bold uppercase">Base Grappling</span><span className="font-mono text-teal-400">{baseGrappling.toFixed(2)}</span></div>
                              <div className="flex justify-between text-xs border-t border-gray-800 pt-2"><span className="text-gray-300 font-bold uppercase">Total Base</span><span className="font-mono text-white">{totalBasePoints.toFixed(2)}</span></div>
                          </div>

                          <div className="space-y-2 mb-5 bg-gray-900/50 p-3 rounded-xl border border-gray-800/80">
                              <div className="flex justify-between text-[9px] uppercase font-bold"><span className="text-gray-500">Odds Multiplier</span><span className="font-mono text-yellow-500">x {oddsMultiplier.toFixed(2)}</span></div>
                              <div className="flex justify-between text-[10px] border-t border-gray-800 pt-2"><span className="text-gray-300 font-bold uppercase">Finish Bonus</span><span className="font-mono text-green-400">+{finalBonus.toFixed(2)}</span></div>
                          </div>

                          <div className="mt-6 border-t-2 border-dashed border-gray-800 pt-5 text-center">
                              <p className="text-gray-500 font-bold uppercase tracking-widest text-[10px] mb-1">Total Score</p>
                              <p className="text-5xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-teal-400">
                                  {finalScore.toFixed(2)}
                              </p>
                          </div>
                      </div>
                  </div>

              </div>
          </div>

        </div>
      </main>

      {/* MOBILE NAVIGATION */}
      <div className="md:hidden">
        <MobileNav />
      </div>
      
    </div>
  );
}