'use client';

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
    <div className="w-full min-h-screen text-white font-sans selection:bg-pink-500 pb-20 overflow-x-hidden">
      {/* HEADER */}
      <div className="pt-12 pb-8 px-4 text-center border-b border-gray-800/50 bg-gradient-to-b from-gray-900/20 to-transparent">
        <h1 className="text-4xl md:text-6xl font-black italic uppercase tracking-tighter mb-2 text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-teal-400">
          The Scoring System
        </h1>
        <p className="text-gray-400 font-bold tracking-widest uppercase text-[10px] md:text-xs max-w-2xl mx-auto px-4">
          How your fighters earn points in the octagon.
        </p>
      </div>

      <div className="max-w-5xl mx-auto p-4 md:p-8 mt-2">

        {/* STATIC CHEAT SHEET */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
            {/* STRIKING */}
            <div className="bg-[#0b0e14] border border-gray-800/60 rounded-xl p-6 shadow-lg relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-pink-600"></div>
                <h2 className="text-lg md:text-xl font-black italic uppercase text-white mb-5 tracking-tight">Striking Metrics</h2>
                <div className="space-y-3">
                    <div className="flex justify-between items-center border-b border-gray-800/50 pb-3">
                        <span className="font-bold text-gray-400 uppercase tracking-wider text-[10px] md:text-xs">Significant Strike</span>
                        <span className="text-pink-500 font-black text-base md:text-lg">+ 0.25</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-gray-800/50 pb-3">
                        <span className="font-bold text-gray-400 uppercase tracking-wider text-[10px] md:text-xs">Knockdown</span>
                        <span className="text-pink-500 font-black text-base md:text-lg">+ 5.0</span>
                    </div>
                </div>
            </div>

            {/* GRAPPLING */}
            <div className="bg-[#0b0e14] border border-gray-800/60 rounded-xl p-6 shadow-lg relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-teal-500"></div>
                <h2 className="text-lg md:text-xl font-black italic uppercase text-white mb-5 tracking-tight">Grappling Metrics</h2>
                <div className="space-y-3">
                    <div className="flex justify-between items-center border-b border-gray-800/50 pb-3">
                        <span className="font-bold text-gray-400 uppercase tracking-wider text-[10px] md:text-xs">Takedown Landed</span>
                        <span className="text-teal-400 font-black text-base md:text-lg">+ 2.5</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-gray-800/50 pb-3">
                        <span className="font-bold text-gray-400 uppercase tracking-wider text-[10px] md:text-xs">Submission Attempt</span>
                        <span className="text-teal-400 font-black text-base md:text-lg">+ 3.0</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-gray-800/50 pb-3">
                        <span className="font-bold text-gray-400 uppercase tracking-wider text-[10px] md:text-xs">Control Time (Per Min)</span>
                        <span className="text-teal-400 font-black text-base md:text-lg">+ 1.8</span>
                    </div>
                </div>
            </div>

            {/* ODDS SCALING */}
            <div className="md:col-span-2 bg-gradient-to-r from-[#0b0e14] via-gray-900/40 to-[#0b0e14] border border-gray-800/60 rounded-xl p-6 shadow-lg relative overflow-hidden">
                <h2 className="text-lg md:text-xl font-black italic uppercase text-white mb-3 tracking-tight text-center">Vegas Odds Scaling</h2>
                <p className="text-gray-400 text-center max-w-2xl mx-auto font-medium tracking-wide leading-relaxed text-[10px] md:text-xs">
                    Baseline scores are scaled by a Vegas Odds Multiplier. <span className="text-teal-400 font-bold">Underdogs</span> receive a boost, while <span className="text-pink-500 font-bold">Favorites</span> are scaled down for safety. Decision wins award <span className="text-white font-bold">10 x the Vegas Multiplier</span>.
                </p>
            </div>
        </div>

        {/* SIMULATOR */}
        <div className="pt-8 border-t border-gray-800/50">
            <div className="text-center mb-8">
                <h2 className="text-2xl md:text-3xl font-black italic uppercase tracking-tighter text-white">Fantasy Simulator</h2>
                <p className="text-gray-500 uppercase font-bold tracking-widest text-[9px] md:text-[10px] mt-1">Test the engine math below.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* INPUTS */}
                <div className="lg:col-span-7 space-y-4">
                    <div className="bg-[#0b0e14] border border-gray-800/60 rounded-xl p-4 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
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

                {/* RECEIPT */}
                <div className="lg:col-span-5">
                    <div className="bg-black border border-gray-800/60 rounded-xl p-5 shadow-2xl lg:sticky lg:top-8">
                        <h3 className="text-center text-[10px] font-black uppercase tracking-widest text-gray-500 border-b border-gray-800/50 pb-3 mb-4">Live Receipt</h3>
                        <div className="space-y-2 mb-4">
                            <div className="flex justify-between text-[10px] md:text-xs"><span className="text-gray-400 font-bold uppercase">Base Striking</span><span className="font-mono text-pink-500">{baseStriking.toFixed(2)}</span></div>
                            <div className="flex justify-between text-[10px] md:text-xs"><span className="text-gray-400 font-bold uppercase">Base Grappling</span><span className="font-mono text-teal-400">{baseGrappling.toFixed(2)}</span></div>
                            <div className="flex justify-between text-[10px] md:text-xs border-t border-gray-800/50 pt-2"><span className="text-gray-300 font-bold uppercase">Total Base</span><span className="font-mono text-white">{totalBasePoints.toFixed(2)}</span></div>
                        </div>
                        <div className="space-y-2 mb-4 bg-gray-900/30 p-3 rounded-lg border border-gray-800/50">
                            <div className="flex justify-between text-[9px] uppercase font-bold"><span className="text-gray-500">Odds Multiplier</span><span className="font-mono text-yellow-500">x {oddsMultiplier.toFixed(2)}</span></div>
                            <div className="flex justify-between text-[10px] md:text-xs border-t border-gray-800/50 pt-2"><span className="text-gray-300 font-bold uppercase">Finish Bonus</span><span className="font-mono text-green-400">+{finalBonus.toFixed(2)}</span></div>
                        </div>
                        <div className="mt-4 border-t-2 border-dashed border-gray-800/80 pt-4 text-center">
                            <p className="text-gray-500 font-bold uppercase tracking-widest text-[9px] mb-1">Total Score</p>
                            <p className="text-4xl md:text-5xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-teal-400">
                                {finalScore.toFixed(2)}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}