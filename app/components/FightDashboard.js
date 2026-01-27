'use client';

import { useState } from 'react';
import FightCard from './FightCard';

export default function FightDashboard({ 
    fights, 
    groupedFights, 
    initialPicks, 
    league_id, 
    onInteractionStart, 
    onPickSelect,
    pendingPicks = [] // New Prop
}) {
  // activePicks are ones already saved in DB
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
              const existingPick = activePicks.find(p => p.fight_id === fight.id);
              // Find if this fight is currently in our pending slip
              const pendingForThisFight = pendingPicks.find(p => p.fightId === fight.id);
              
              return (
                <FightCard 
                  key={fight.id} 
                  fight={fight} 
                  existingPick={existingPick}
                  pendingPick={pendingForThisFight} // Pass the specific pending pick
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