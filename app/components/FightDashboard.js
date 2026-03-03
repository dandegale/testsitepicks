'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import FightCard from './FightCard'; 

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export default function FightDashboard({ 
    groupedFights, 
    userPicks = [], 
    onInteractionStart, 
    onPickSelect,
    pendingPicks = [],
    showOdds = true,
    league_id = null,    // 🎯 NEW: Grab the league_id prop 
    isShowdown = false   // 🎯 NEW: Grab a showdown flag
}) {

  const [fighterStats, setFighterStats] = useState({});

  useEffect(() => {
    const fetchHistoricalStats = async () => {
      const { data, error } = await supabase
        .from('fighter_historical_stats')
        .select('fighter_name, average_fantasy_points');

      if (data && !error) {
        const statsMap = {};
        data.forEach(stat => {
          statsMap[stat.fighter_name] = stat.average_fantasy_points;
        });
        setFighterStats(statsMap);
      }
    };

    fetchHistoricalStats();

    // Setup the Real-Time Subscription
    const statsChannel = supabase.channel('fighter-stats-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'fighter_historical_stats' },
        (payload) => {
            fetchHistoricalStats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(statsChannel);
    };

  }, []);

  const handlePickClick = (fightId, fighterName, odds) => {
    if (onInteractionStart) onInteractionStart();
    
    let fightEventName = '';
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

  if (!groupedFights || Object.keys(groupedFights).length === 0) {
      return (
        <div className="text-zinc-500 text-center py-20 font-bold uppercase tracking-widest text-xs">
            No active fights found.
        </div>
      );
  }

  // 🎯 THE LOGIC: Only show averages if we are in a League OR a 1v1 Showdown
  const shouldShowAverages = league_id !== null || isShowdown === true;

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
                  // 🎯 THE TOGGLE: Pass null if we are on the Global page
                  fighterStats={shouldShowAverages ? fighterStats : null} 
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}