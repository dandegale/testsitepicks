'use client';

import { useState } from 'react';
import FightCard from './FightCard'; 

export default function FightDashboard({ 
    groupedFights, 
    userPicks = [], 
    onInteractionStart, 
    onPickSelect,
    pendingPicks = [],
    showOdds = true 
}) {

  const handlePickClick = (fightId, fighterName, odds) => {
    if (onInteractionStart) onInteractionStart();
    
    let fightEventName = '';
    // Safely look for the event name
    Object.values(groupedFights).forEach(group => {
        const found = group.find(f => f && f.id === fightId);
        if (found) fightEventName = found.event_name;
    });

    if (onPickSelect) {
        onPickSelect({
            fightId,
            fighterName,
            odds,
            fightName: fightEventName
        });
    }
  };

  // 1. Handle Empty State Gracefully
  if (!groupedFights || Object.keys(groupedFights).length === 0) {
      return (
        <div className="text-zinc-500 text-center py-20 font-bold uppercase tracking-widest text-xs">
            No active fights found.
        </div>
      );
  }

  return (
    <div className="space-y-12 pb-24">
      {Object.entries(groupedFights).map(([groupName, groupFights]) => (
        <div key={groupName} className="animate-in fade-in slide-in-from-bottom-4 duration-700">
          
          {/* HEADER */}
          <div className="flex items-center gap-4 mb-6 sticky top-[64px] md:top-0 bg-gray-900/95 backdrop-blur z-30 py-4 border-b border-gray-800 shadow-xl -mx-4 px-4 md:mx-0 md:px-0 md:rounded-xl">
             <div className="w-1.5 h-10 bg-pink-600 rounded-r-full shadow-[0_0_15px_rgba(236,72,153,0.5)]"></div>
             <div>
                 <h2 className="text-lg md:text-xl font-black italic uppercase text-white tracking-tighter leading-none">
                   {groupName}
                 </h2>
                 <p className="text-[8px] md:text-[9px] font-bold text-gray-500 uppercase tracking-[0.2em] mt-1">
                   {groupFights.length} Bouts Scheduled
                 </p>
             </div>
          </div>

          {/* FIGHT LIST */}
          <div className="grid grid-cols-1 gap-4">
            {groupFights.map((fight) => {
              
              // --- CRITICAL FIX: SAFETY CHECK ---
              // If the data is bad/undefined, skip this card to prevent the crash
              if (!fight) return null;

              const existingPick = userPicks.find(p => p.fight_id === fight.id);
              const pendingForThisFight = pendingPicks.find(p => p.fightId === fight.id);
              
              return (
                <FightCard 
                  key={fight.id} 
                  fight={fight} 
                  existingPick={existingPick} 
                  pendingPick={pendingForThisFight} 
                  onPick={handlePickClick}
                  showOdds={showOdds} 
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}