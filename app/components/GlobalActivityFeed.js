'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function GlobalActivityFeed({ initialPicks = [] }) {
  const [picks, setPicks] = useState([]);

  useEffect(() => {
    if (initialPicks && initialPicks.length > 0) {
      const latestThree = initialPicks.slice(0, 3).map(p => ({
        id: p.id,
        // Now we just use the username column, fallback to email if old data
        username: p.username || p.user_id?.split('@')[0] || 'Unknown Fighter'
      }));
      setPicks(latestThree);
    }
  }, [initialPicks]);

  return (
    <div className="w-full relative">
      <div className="flex items-center justify-between mb-4 px-2">
         <h2 className="text-[10px] font-black text-gray-600 uppercase tracking-[0.2em]">Global Activity</h2>
         <div className="flex items-center gap-2">
            <span className="text-[8px] font-bold text-gray-500 uppercase tracking-widest">Static Feed</span>
         </div>
      </div>

      <div className="min-h-[350px] flex flex-col gap-4 overflow-hidden relative">
        <AnimatePresence mode="popLayout" initial={false}>
          {picks.map((pick) => (
            <motion.div
              key={pick.id}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative bg-gray-950 border border-gray-800 p-6 rounded-xl shadow-2xl overflow-hidden border-l-4 border-l-pink-600"
            >
              <div className="flex justify-between items-start mb-2">
                <span className="text-white font-black uppercase italic tracking-tighter text-lg leading-none">
                  {pick.username}
                </span>
              </div>
              
              <div className="flex flex-col">
                <span className="text-pink-500 font-black text-xl leading-tight uppercase italic tracking-tighter">
                    LOCKED IN
                </span>
                <span className="text-[9px] font-black text-gray-500 uppercase tracking-[0.3em] mt-2">
                    Fight Choice Confirmed
                </span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {picks.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center opacity-10">
            <span className="text-[10px] font-black uppercase tracking-[0.4em] italic text-gray-500">No Recent Activity</span>
          </div>
        )}
      </div>
    </div>
  );
}