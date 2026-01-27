'use client';

import { useState } from 'react';
import FightCard from './FightCard';

export default function FightDashboard({ 
    fights, 
    groupedFights, 
    initialPicks,     // This is the GLOBAL feed (everyone's picks)
    userPicks = [],   // <--- NEW: This is YOUR picks only
    league_id, 
    onInteractionStart, 
    onPickSelect,
    pendingPicks = [] 
}) {
  
  // activePicks is still useful if you want to show "% of people picked X" later
  const [activePicks, setActivePicks] = useState(initialPicks || []);

  const handlePickClick = (fightId, fighterName, odds) => {
    if (onInteractionStart) onInteractionStart();
    if (onPickSelect) {
        onPickSelect({
            fightId,
            fighterName,
            odds,
            leagueId: league_id
        });
    }
  };

  return (
    <div className="space-y-12 pb-24">
      {Object.entries(groupedFights).map(([groupName, groupFights]) => (
        <div key={groupName} className="animate-in fade-in slide-in-from-bottom-4 duration-700">
          
          <div className="flex items-center gap-4 mb-6">
            <h3 className="text-lg font-black italic uppercase text-gray-700 tracking-tighter">
              {groupName}
            </h3>
            <div className="h-px flex-1 bg-gradient-to-r from-gray-800 to-transparent"></div>
          </div>

          <div className="grid grid-cols-1 gap-6">
            {groupFights.map((fight) => {
              
              // --- THE FIX IS HERE ---
              // Check userPicks (YOU) instead of activePicks (EVERYONE)
              const existingPick = userPicks.find(p => p.fight_id === fight.id);
              
              // Find if this fight is currently in our pending slip
              const pendingForThisFight = pendingPicks.find(p => p.fightId === fight.id);
              
              return (
                <FightCard 
                  key={fight.id} 
                  fight={fight} 
                  existingPick={existingPick} // Now this only locks if YOU picked it
                  pendingPick={pendingForThisFight} 
                  onPick={handlePickClick} 
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}