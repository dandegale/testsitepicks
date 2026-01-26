'use client';

import { createClient } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function LeagueActivity({ initialPicks, fights, currentUserEmail }) {
  const [picks, setPicks] = useState(initialPicks || []);

  // Listen for NEW picks in real-time
  useEffect(() => {
    const channel = supabase
      .channel('picks-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'picks' }, (payload) => {
        // Add the new pick to the list instantly
        setPicks((prev) => [payload.new, ...prev]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // --- GROUPING LOGIC ---
  const groupedPicks = picks.reduce((acc, pick) => {
    if (!acc[pick.user_id]) {
        acc[pick.user_id] = {
            user_id: pick.user_id,
            username: pick.username || pick.user_id.split('@')[0], 
            picks: []
        };
    }
    acc[pick.user_id].picks.push(pick);
    return acc;
  }, {});

  const getReturn = (odds) => {
      const stake = 10;
      return odds > 0 ? ((odds / 100) * stake) + stake : ((100 / Math.abs(odds)) * stake) + stake;
  };

  return (
    <div className="bg-gray-900 rounded-lg overflow-hidden border border-gray-700 shadow-xl">
      <table className="w-full text-left">
        <thead className="bg-gray-950 text-gray-500 uppercase text-xs font-bold tracking-wider">
          <tr>
            <th className="p-4">Fighter</th>
            <th className="p-4">Active Picks</th>
            <th className="p-4 text-right">Potential Payout</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800 text-sm md:text-base">
          {Object.values(groupedPicks).map((userGroup) => {
            
            // Check visibility for this user's group
            // We need to know if ALL their picks are hidden or visible to decide layout
            // But actually, we process per-pick.
            
            // Let's filter visible vs hidden picks
            const visiblePicks = [];
            const hiddenPicks = [];
            let totalUserPayout = 0;

            userGroup.picks.forEach(pick => {
                const fight = fights.find(f => f.id === pick.fight_id);
                // If fight not found (rare sync issue), assume hidden
                const isFinished = fight && fight.winner; 
                const isMe = pick.user_id === currentUserEmail;
                
                if (isFinished || isMe) {
                    visiblePicks.push(pick);
                    totalUserPayout += getReturn(pick.odds_at_pick);
                } else {
                    hiddenPicks.push(pick);
                }
            });

            return (
              <tr key={userGroup.user_id} className="hover:bg-gray-800 transition-colors align-top">
                {/* 1. USERNAME */}
                <td className="p-4 font-bold text-blue-400 whitespace-nowrap">
                  {userGroup.username}
                </td>

                {/* 2. PICKS SUMMARY */}
                <td className="p-4 w-full">
                  <div className="flex flex-col gap-2">
                    {/* Render Hidden Summary */}
                    {hiddenPicks.length > 0 && (
                         <div className="flex items-center bg-gray-950 p-3 rounded border border-gray-800 text-gray-500 italic">
                            🔒 {hiddenPicks.length} Fights Locked
                         </div>
                    )}

                    {/* Render Visible Picks */}
                    {visiblePicks.map(pick => (
                        <div key={pick.id} className="flex justify-between items-center bg-gray-800 p-2 rounded border border-gray-700">
                            <span className="font-medium text-gray-200">
                                {pick.selected_fighter}
                            </span>
                            <span className="text-xs font-mono text-yellow-500 ml-2">
                                {pick.odds_at_pick}
                            </span>
                        </div>
                    ))}
                  </div>
                </td>

                {/* 3. TOTAL PAYOUT */}
                <td className="p-4 text-right text-green-400 font-black font-mono text-lg">
                   {/* Only show payout for what is visible. If they have hidden picks, the total is partial or hidden. */}
                   {/* Logic: If ANY picks are hidden, maybe hide total? Or show visible total? */}
                   {/* Usually cleaner to show "Locked" if they have hidden bets pending */}
                   {hiddenPicks.length > 0 && visiblePicks.length === 0 ? (
                       <span className="text-gray-600 text-sm">Locked</span>
                   ) : (
                       `$${totalUserPayout.toFixed(2)}`
                   )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}