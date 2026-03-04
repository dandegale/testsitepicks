'use client';

import Link from 'next/link';
import { useState } from 'react';

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
  const [winMethod, setWinMethod] = useState('Decision'); // None, Decision, KO, Submission
  const [finishRound, setFinishRound] = useState('3'); // 1, 2, 3, 4, 5
  const [specialty, setSpecialty] = useState('None'); // None, Under 30s, Last 10s

  // --- EXACT SCRAPER MATH ---
  const controlTimeTotalMins = (controlMins || 0) + ((controlSecs || 0) / 60);
  const baseStriking = ((sigStrikes || 0) * 0.25) + ((knockdowns || 0) * 5);
  const baseGrappling = ((takedowns || 0) * 2.5) + ((subAttempts || 0) * 3) + (controlTimeTotalMins * 1.8);
  const totalBasePoints = baseStriking + baseGrappling;
  
  // 1. Calculate Multiplier from Raw Vegas Odds
  let oddsMultiplier = 1;
  const numOdds = parseInt(vegasOdds) || 0;
  if (numOdds > 0) {
      oddsMultiplier = numOdds / 100; // Underdog: +150 = 1.5x
  } else if (numOdds < 0) {
      oddsMultiplier = 100 / Math.abs(numOdds); // Favorite: -200 = 0.5x
  }

  // 2. Determine Base Finish Bonus
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

  // 3. Apply Vegas Multiplier to the Finish Bonus
  let finalBonus = parseFloat((baseBonus * oddsMultiplier).toFixed(2));

  // 4. The "Favorite Flat Bonus" Rule (From your scraper line 232)
  let favoriteBonusApplied = false;
  if (numOdds < 0 && (winMethod === 'KO' || winMethod === 'Submission')) {
      finalBonus += 10;
      favoriteBonusApplied = true;
  }

  const finalScore = totalBasePoints + finalBonus;

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-pink-500 pb-20">
      
      {/* HEADER */}
      <div className="pt-20 pb-12 px-6 text-center border-b border-gray-900 bg-gradient-to-b from-gray-900/50 to-black">
        <h1 className="text-5xl md:text-7xl font-black italic uppercase tracking-tighter mb-4 text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-teal-400">
          The Scoring System
        </h1>
        <p className="text-gray-400 font-bold tracking-widest uppercase text-sm md:text-base max-w-2xl mx-auto">
          How your fighters earn points in the octagon.
        </p>
      </div>

      <div className="max-w-6xl mx-auto p-6 md:p-10 mt-8">
        
        {/* =========================================
            PART 1: THE STATIC CHEAT SHEET
        ========================================= */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-20">
            
            {/* STRIKING COLUMN */}
            <div className="bg-gray-950 border border-gray-800 rounded-2xl p-8 shadow-2xl relative overflow-hidden group hover:border-pink-500/50 transition-colors">
                <div className="absolute top-0 left-0 w-full h-1 bg-pink-600"></div>
                <h2 className="text-2xl font-black italic uppercase text-white mb-6 tracking-tight">Striking Metrics</h2>
                
                <div className="space-y-4">
                    <div className="flex justify-between items-center border-b border-gray-800 pb-4">
                        <span className="font-bold text-gray-300 uppercase tracking-wider text-sm">Significant Strike</span>
                        <span className="text-pink-500 font-black text-xl">+ 0.25</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-gray-800 pb-4">
                        <span className="font-bold text-gray-300 uppercase tracking-wider text-sm">Knockdown</span>
                        <span className="text-pink-500 font-black text-xl">+ 5.0</span>
                    </div>
                </div>
            </div>

            {/* GRAPPLING COLUMN */}
            <div className="bg-gray-950 border border-gray-800 rounded-2xl p-8 shadow-2xl relative overflow-hidden group hover:border-teal-500/50 transition-colors">
                <div className="absolute top-0 left-0 w-full h-1 bg-teal-500"></div>
                <h2 className="text-2xl font-black italic uppercase text-white mb-6 tracking-tight">Grappling Metrics</h2>
                
                <div className="space-y-4">
                    <div className="flex justify-between items-center border-b border-gray-800 pb-4">
                        <span className="font-bold text-gray-300 uppercase tracking-wider text-sm">Takedown Landed</span>
                        <span className="text-teal-400 font-black text-xl">+ 2.5</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-gray-800 pb-4">
                        <span className="font-bold text-gray-300 uppercase tracking-wider text-sm">Submission Attempt</span>
                        <span className="text-teal-400 font-black text-xl">+ 3.0</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-gray-800 pb-4">
                        <span className="font-bold text-gray-300 uppercase tracking-wider text-sm">Control Time (Per Min)</span>
                        <span className="text-teal-400 font-black text-xl">+ 1.8</span>
                    </div>
                </div>
            </div>

            {/* FINISH BONUSES */}
            <div className="md:col-span-2 bg-gray-900/50 border border-gray-800 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
                <h2 className="text-2xl font-black italic uppercase text-white mb-6 tracking-tight text-center">Outcome Bonuses</h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
                    <div className="bg-black/50 p-4 rounded-xl border border-gray-800">
                        <p className="text-gray-500 font-bold uppercase tracking-widest text-[10px] mb-2">Decision Win</p>
                        <p className="text-2xl font-black italic text-white">10x <span className="text-sm text-gray-500 not-italic">Odds</span></p>
                    </div>
                    <div className="bg-black/50 p-4 rounded-xl border border-gray-800">
                        <p className="text-gray-500 font-bold uppercase tracking-widest text-[10px] mb-2">Round 1 Finish</p>
                        <p className="text-2xl font-black italic text-white">+ 35 <span className="text-sm text-gray-500 not-italic">pts</span></p>
                    </div>
                    <div className="bg-black/50 p-4 rounded-xl border border-gray-800">
                        <p className="text-gray-500 font-bold uppercase tracking-widest text-[10px] mb-2">Round 2/3 Finish</p>
                        <p className="text-2xl font-black italic text-white">+ 25 / 20 <span className="text-sm text-gray-500 not-italic">pts</span></p>
                    </div>
                    <div className="bg-black/50 p-4 rounded-xl border border-gray-800">
                        <p className="text-gray-500 font-bold uppercase tracking-widest text-[10px] mb-2">Round 4/5 Finish</p>
                        <p className="text-2xl font-black italic text-white">+ 25 / 40 <span className="text-sm text-gray-500 not-italic">pts</span></p>
                    </div>
                </div>
            </div>

            {/* VEGAS ODDS MULTIPLIER EXPLANATION */}
            <div className="md:col-span-2 bg-gradient-to-r from-gray-950 via-gray-900 to-gray-950 border border-gray-800 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
                <h2 className="text-2xl font-black italic uppercase text-white mb-4 tracking-tight text-center">The Vegas Odds Multiplier</h2>
                <p className="text-gray-400 text-center max-w-3xl mx-auto font-bold tracking-wide leading-relaxed">
                    Every fighter&apos;s baseline score is dynamically scaled by a Vegas Odds Multiplier. <span className="text-teal-400">Underdogs</span> receive a higher multiplier that significantly boosts their total, while <span className="text-pink-500">Favorites</span> have a lower scaling factor to balance out their safety. If a fighter wins by <span className="text-white">Decision</span>, their finish bonus is exactly <span className="text-white">10 x their Vegas Multiplier</span>!
                </p>
            </div>
        </div>

        {/* =========================================
            PART 2: THE INTERACTIVE CALCULATOR
        ========================================= */}
        <div className="pt-10 border-t border-gray-800/50">
            <div className="text-center mb-10">
                <h2 className="text-4xl font-black italic uppercase tracking-tighter text-white mb-2">Fantasy Simulator</h2>
                <p className="text-gray-500 uppercase font-bold tracking-widest text-xs">Input stats below to see the exact match engine calculations.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                
                {/* LEFT COLUMN: THE INPUT TABLE */}
                <div className="lg:col-span-8 space-y-8">
                    
                    {/* Vegas Odds Section */}
                    <div className="bg-gray-950 border border-gray-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
                        <div>
                            <h3 className="text-xl font-black italic uppercase text-white tracking-tight">Vegas Odds</h3>
                            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Sets your finish bonus multiplier.</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-gray-400 font-black text-xl">Odds:</span>
                            <input 
                                type="number" 
                                value={vegasOdds} 
                                onChange={(e) => setVegasOdds(e.target.value)} 
                                className="bg-gray-900 border-2 border-gray-700 focus:border-pink-500 text-white font-mono text-xl text-center rounded-lg w-32 py-2 outline-none transition-colors"
                            />
                        </div>
                    </div>

                    {/* Base Stats Table */}
                    <div className="bg-gray-950 border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-900 border-b border-gray-800 text-gray-500 text-[10px] font-bold uppercase tracking-widest">
                                    <th className="p-4 w-1/2">Action</th>
                                    <th className="p-4 text-center">Value</th>
                                    <th className="p-4 text-right">Input</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800">
                                <tr className="hover:bg-gray-900/30 transition-colors">
                                    <td className="p-4 text-sm font-bold text-gray-300">Significant Strikes</td>
                                    <td className="p-4 text-center font-mono text-pink-500 text-sm">0.25 pts</td>
                                    <td className="p-4 text-right">
                                        <input type="number" value={sigStrikes} onChange={(e) => setSigStrikes(Number(e.target.value))} className="bg-black border border-gray-700 text-white font-mono rounded w-20 p-2 text-right outline-none focus:border-pink-500" />
                                    </td>
                                </tr>
                                <tr className="hover:bg-gray-900/30 transition-colors">
                                    <td className="p-4 text-sm font-bold text-gray-300">Knockdowns</td>
                                    <td className="p-4 text-center font-mono text-pink-500 text-sm">5.0 pts</td>
                                    <td className="p-4 text-right">
                                        <input type="number" value={knockdowns} onChange={(e) => setKnockdowns(Number(e.target.value))} className="bg-black border border-gray-700 text-white font-mono rounded w-20 p-2 text-right outline-none focus:border-pink-500" />
                                    </td>
                                </tr>
                                <tr className="hover:bg-gray-900/30 transition-colors">
                                    <td className="p-4 text-sm font-bold text-gray-300">Takedowns</td>
                                    <td className="p-4 text-center font-mono text-teal-400 text-sm">2.5 pts</td>
                                    <td className="p-4 text-right">
                                        <input type="number" value={takedowns} onChange={(e) => setTakedowns(Number(e.target.value))} className="bg-black border border-gray-700 text-white font-mono rounded w-20 p-2 text-right outline-none focus:border-teal-500" />
                                    </td>
                                </tr>
                                <tr className="hover:bg-gray-900/30 transition-colors">
                                    <td className="p-4 text-sm font-bold text-gray-300">Sub Attempts</td>
                                    <td className="p-4 text-center font-mono text-teal-400 text-sm">3.0 pts</td>
                                    <td className="p-4 text-right">
                                        <input type="number" value={subAttempts} onChange={(e) => setSubAttempts(Number(e.target.value))} className="bg-black border border-gray-700 text-white font-mono rounded w-20 p-2 text-right outline-none focus:border-teal-500" />
                                    </td>
                                </tr>
                                <tr className="hover:bg-gray-900/30 transition-colors">
                                    <td className="p-4 text-sm font-bold text-gray-300">Control Time</td>
                                    <td className="p-4 text-center font-mono text-teal-400 text-sm">1.8 pts / min</td>
                                    <td className="p-4 flex justify-end gap-2">
                                        <input type="number" placeholder="Min" value={controlMins} onChange={(e) => setControlMins(Number(e.target.value))} className="bg-black border border-gray-700 text-white font-mono rounded w-16 p-2 text-right outline-none focus:border-teal-500" />
                                        <span className="text-gray-500 self-center">:</span>
                                        <input type="number" placeholder="Sec" value={controlSecs} onChange={(e) => setControlSecs(Number(e.target.value))} className="bg-black border border-gray-700 text-white font-mono rounded w-16 p-2 text-right outline-none focus:border-teal-500" />
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* Outcome Controls */}
                    <div className="bg-gray-950 border border-gray-800 rounded-2xl p-6 shadow-xl">
                        <h3 className="text-sm font-black uppercase tracking-widest text-gray-400 border-b border-gray-800 pb-4 mb-6">Match Outcome</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <select className="bg-gray-900 border border-gray-700 text-white text-sm rounded-lg focus:ring-pink-500 p-3 outline-none font-bold uppercase tracking-wider" value={winMethod} onChange={(e) => setWinMethod(e.target.value)}>
                                <option value="None">No Finish (Loss)</option>
                                <option value="Decision">Decision Win</option>
                                <option value="KO">KO / TKO</option>
                                <option value="Submission">Submission</option>
                            </select>
                            <select className="bg-gray-900 border border-gray-700 text-white text-sm rounded-lg focus:ring-pink-500 p-3 outline-none font-bold uppercase tracking-wider disabled:opacity-50" value={finishRound} onChange={(e) => setFinishRound(e.target.value)} disabled={winMethod === 'Decision' || winMethod === 'None'}>
                                <option value="1">Round 1</option>
                                <option value="2">Round 2</option>
                                <option value="3">Round 3</option>
                                <option value="4">Round 4</option>
                                <option value="5">Round 5</option>
                            </select>
                            <select className="bg-gray-900 border border-gray-700 text-white text-sm rounded-lg focus:ring-pink-500 p-3 outline-none font-bold uppercase tracking-wider disabled:opacity-50" value={specialty} onChange={(e) => setSpecialty(e.target.value)} disabled={winMethod === 'Decision' || winMethod === 'None'}>
                                <option value="None">Normal Time</option>
                                <option value="Under 30s">Under 30 Secs (R1)</option>
                                <option value="Last 10s">Last 10 Secs (R5)</option>
                            </select>
                        </div>
                    </div>

                </div>

                {/* RIGHT COLUMN: THE RECEIPT */}
                <div className="lg:col-span-4">
                    <div className="bg-black border border-gray-800 rounded-3xl p-6 md:p-8 shadow-[0_0_50px_rgba(236,72,153,0.05)] relative overflow-hidden sticky top-24">
                        <div className="absolute top-0 right-0 w-48 h-48 bg-teal-500/10 blur-3xl rounded-full pointer-events-none"></div>
                        <div className="absolute bottom-0 left-0 w-48 h-48 bg-pink-600/10 blur-3xl rounded-full pointer-events-none"></div>
                        
                        <h3 className="text-center text-xs font-black uppercase tracking-widest text-gray-500 border-b border-gray-800 pb-4 mb-6">Engine Calculation</h3>
                        
                        <div className="space-y-3 mb-6">
                            <div className="flex justify-between text-sm"><span className="text-gray-400 font-bold uppercase">Striking Base</span><span className="font-mono text-pink-500">{baseStriking.toFixed(2)}</span></div>
                            <div className="flex justify-between text-sm"><span className="text-gray-400 font-bold uppercase">Grappling Base</span><span className="font-mono text-teal-400">{baseGrappling.toFixed(2)}</span></div>
                            <div className="flex justify-between text-sm border-t border-gray-800 pt-3"><span className="text-gray-300 font-bold uppercase">Total Base Pts</span><span className="font-mono text-white">{totalBasePoints.toFixed(2)}</span></div>
                        </div>

                        <div className="space-y-3 mb-6 bg-gray-900/50 p-4 rounded-xl border border-gray-800">
                            <div className="flex justify-between text-[10px]"><span className="text-gray-500 font-bold uppercase">Raw Bonus Rule</span><span className="font-mono text-gray-400">{baseBonus} pts</span></div>
                            <div className="flex justify-between text-[10px]"><span className="text-gray-500 font-bold uppercase">Odds Multiplier</span><span className="font-mono text-yellow-500">x {oddsMultiplier.toFixed(2)}</span></div>
                            {favoriteBonusApplied && (
                                <div className="flex justify-between text-[10px]"><span className="text-pink-500 font-bold uppercase">Fav Finish Flat Bonus</span><span className="font-mono text-pink-500">+10.00</span></div>
                            )}
                            <div className="flex justify-between text-sm border-t border-gray-800 pt-3"><span className="text-gray-300 font-bold uppercase">Final Finish Bonus</span><span className="font-mono text-green-400">+{finalBonus.toFixed(2)}</span></div>
                        </div>

                        <div className="mt-6 border-t-2 border-dashed border-gray-700 pt-6 text-center">
                            <p className="text-gray-500 font-bold uppercase tracking-widest text-[10px] mb-1">Total Fantasy Score</p>
                            <p className="text-5xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-teal-400 drop-shadow-md">
                                {finalScore.toFixed(2)}
                            </p>
                        </div>

                        <div className="mt-6 text-[9px] text-gray-600 uppercase tracking-widest font-bold text-center">
                            *Equalizer Rule: The winner is guaranteed to never score fewer points than the loser.
                        </div>
                    </div>
                </div>

            </div>
        </div>

        <div className="mt-12 text-center relative z-20">
            <Link href="/" className="inline-block px-8 py-4 bg-white text-black font-black uppercase tracking-widest text-sm hover:bg-pink-500 hover:text-white transition-all rounded">
                Back to Dashboard
            </Link>
        </div>
      </div>
    </div>
  );
}