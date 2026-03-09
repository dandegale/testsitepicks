"use client";

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

// ⚠️ Make sure to use your ANON key for the frontend!
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function LiveFightTracker({ initialFights, initialStats = [] }) {
  const [fights, setFights] = useState(initialFights || []);
  const [stats, setStats] = useState(initialStats || []);

  useEffect(() => {
    console.log("📡 Connecting to Supabase Realtime for Fights & Stats...");

    const liveChannel = supabase.channel('fight-night-live')
      // Listener 1: The Fights Table
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'fights' },
        (payload) => {
          console.log("🥊 FIGHT UPDATED LIVE:", payload.new);
          setFights((currentFights) => 
            currentFights.map((fight) => 
              fight.id === payload.new.id ? payload.new : fight
            )
          );
        }
      )
      // Listener 2: The Fighter Stats Table
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'fighter_stats' },
        (payload) => {
          console.log("📊 STATS UPDATED LIVE:", payload.new);
          setStats((currentStats) => {
            const exists = currentStats.find(s => s.id === payload.new.id);
            if (exists) {
              return currentStats.map((stat) => stat.id === payload.new.id ? payload.new : stat);
            } else {
              return [...currentStats, payload.new];
            }
          });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') console.log("✅ Successfully listening for live UFC action!");
      });

    return () => {
      supabase.removeChannel(liveChannel);
    };
  }, []);

  // Match the stats to the correct fighter and fight
  const getFighterStats = (fightId, fighterName) => {
    return stats.find(s => s.fight_id === fightId && s.fighter_name.includes(fighterName.split(' ')[0]));
  };

  return (
    <div className="space-y-6">
      {fights.map((fight) => {
        const f1Stats = getFighterStats(fight.id, fight.fighter_1_name);
        const f2Stats = getFighterStats(fight.id, fight.fighter_2_name);

        return (
          <div key={fight.id} className="p-5 bg-gray-800 rounded-xl border border-gray-700 text-white shadow-lg">
            
            {/* Header: Weightclass & Live Status */}
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-700">
              <span className="text-sm font-semibold text-gray-400 tracking-wider uppercase">{fight.weightclass}</span>
              {fight.winner ? (
                <span className="text-xs font-black bg-green-900/50 text-green-400 px-3 py-1 rounded-full">
                  FINAL • {fight.method} (R{fight.round})
                </span>
              ) : (
                <span className="text-xs font-black bg-red-900/50 text-red-500 px-3 py-1 rounded-full animate-pulse">
                  🔴 LIVE
                </span>
              )}
            </div>

            {/* Fighter 1 vs Fighter 2 Layout */}
            <div className="flex justify-between items-start">
              
              {/* Fighter 1 */}
              <div className={`flex flex-col w-[40%] ${fight.winner === fight.fighter_1_name ? 'text-green-400' : ''}`}>
                <span className="font-bold text-lg truncate">{fight.fighter_1_name}</span>
                {f1Stats ? (
                  <div className="text-sm text-gray-400 mt-2 space-y-1.5 bg-gray-900/50 p-3 rounded-lg border border-gray-700/50">
                    <p className="font-bold text-yellow-500 border-b border-gray-700 pb-1 mb-2">
                      🏆 Fantasy Pts: <span className="text-white font-mono float-right">{f1Stats.fantasy_points || 0}</span>
                    </p>
                    <p>🥊 Sig. Strikes: <span className="text-white font-mono float-right">{f1Stats.sig_strikes || 0}</span></p>
                    <p>💥 Knockdowns: <span className="text-white font-mono float-right">{f1Stats.knockdowns || 0}</span></p>
                    <p>🥋 Sub Attempts: <span className="text-white font-mono float-right">{f1Stats.sub_attempts || 0}</span></p>
                    <p>⏱️ Control: <span className="text-white font-mono float-right">{f1Stats.control_time_seconds || 0}s</span></p>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 mt-2 italic">Awaiting live stats...</p>
                )}
              </div>

              {/* VS Divider */}
              <div className="w-[20%] flex justify-center items-center mt-6">
                <span className="text-2xl font-black text-gray-600 italic">VS</span>
              </div>

              {/* Fighter 2 */}
              <div className={`flex flex-col w-[40%] text-right ${fight.winner === fight.fighter_2_name ? 'text-green-400' : ''}`}>
                <span className="font-bold text-lg truncate">{fight.fighter_2_name}</span>
                {f2Stats ? (
                  <div className="text-sm text-gray-400 mt-2 space-y-1.5 bg-gray-900/50 p-3 rounded-lg border border-gray-700/50 text-left">
                    <p className="font-bold text-yellow-500 border-b border-gray-700 pb-1 mb-2">
                      🏆 Fantasy Pts: <span className="text-white font-mono float-right">{f2Stats.fantasy_points || 0}</span>
                    </p>
                    <p>🥊 Sig. Strikes: <span className="text-white font-mono float-right">{f2Stats.sig_strikes || 0}</span></p>
                    <p>💥 Knockdowns: <span className="text-white font-mono float-right">{f2Stats.knockdowns || 0}</span></p>
                    <p>🥋 Sub Attempts: <span className="text-white font-mono float-right">{f2Stats.sub_attempts || 0}</span></p>
                    <p>⏱️ Control: <span className="text-white font-mono float-right">{f2Stats.control_time_seconds || 0}s</span></p>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 mt-2 italic text-right">Awaiting live stats...</p>
                )}
              </div>

            </div>
          </div>
        );
      })}
    </div>
  );
}