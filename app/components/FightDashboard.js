'use client';

import { createClient } from '@supabase/supabase-js';
import { useState, useEffect } from 'react';
import FightCard from './FightCard';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function FightDashboard({ fights, initialPicks, groupedFights, league_id = null, onPickSuccess, onPicksCleared }) {
  const [pendingPicks, setPendingPicks] = useState({}); 
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [currentUsername, setCurrentUsername] = useState(null);
  const [lockedPicks, setLockedPicks] = useState(initialPicks || []);

  useEffect(() => {
    setLockedPicks(initialPicks || []);
  }, [initialPicks]);

  useEffect(() => {
    const pickCount = Object.keys(pendingPicks).length;
    
    if (pickCount === 0) {
      if (isDrawerOpen) setIsDrawerOpen(false);
      
      const timer = setTimeout(() => {
        if (onPicksCleared) onPicksCleared();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [pendingPicks, onPicksCleared, isDrawerOpen]);

  useEffect(() => {
    const getUser = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            setCurrentUser(user);
            const { data: profile } = await supabase.from('profiles').select('username').eq('id', user.id).single();
            if (profile) setCurrentUsername(profile.username);
        }
    };
    getUser();
  }, []);

  const calculatePayout = (odds) => {
    if (!odds) return 0;
    const stake = 10;
    return odds > 0 ? ((odds / 100) * stake) + stake : ((100 / Math.abs(odds)) * stake) + stake;
  };

  const handleTogglePick = (fightId, fighter, odds) => {
    setPendingPicks((prev) => {
      const newState = { ...prev };
      if (newState[fightId]?.fighter === fighter) {
        delete newState[fightId];
      } else {
        newState[fightId] = { fighter, odds };
        setIsDrawerOpen(true); 
      }
      return newState;
    });
  };

  const submitPicks = async () => {
    if (!currentUser) return alert("Please log in!");
    setIsSubmitting(true);

    const picksToInsert = Object.entries(pendingPicks).map(([fightId, selection]) => ({
      user_id: currentUser.email,
      username: currentUsername || currentUser.email.split('@')[0],
      fight_id: fightId,
      selected_fighter: selection.fighter,
      odds_at_pick: selection.odds,
      league_id: league_id 
    }));

    const { error } = await supabase.from('picks').upsert(picksToInsert, { onConflict: 'user_id, fight_id, league_id' });

    if (error) {
      alert("Error: " + error.message);
    } else {
      setLockedPicks([...lockedPicks, ...picksToInsert.map(p => ({...p, id: Date.now()}))]);
      setPendingPicks({});
      setIsDrawerOpen(false);
      if (onPickSuccess) {
          setTimeout(() => onPickSuccess(), 0);
      }
    }
    setIsSubmitting(false);
  };

  const getLockedPick = (fightId) => {
    if (!currentUser) return null;
    return lockedPicks.find(p => p.fight_id === fightId && p.user_id === currentUser.email);
  };

  const totalReturn = Object.values(pendingPicks).reduce((acc, curr) => acc + calculatePayout(curr.odds), 0);
  
  const isActuallyOpen = isDrawerOpen && Object.keys(pendingPicks).length > 0;

  return (
    <div className="relative">
      <div className="space-y-12">
        {Object.keys(groupedFights).map((dateHeader) => (
            <div key={dateHeader} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <h2 className="text-2xl font-bold text-gray-200 mb-6 border-l-4 border-red-600 pl-4 uppercase italic">{dateHeader}</h2>
                <div className="space-y-6">
                {groupedFights[dateHeader].map((fight) => (
                    <div key={fight.id} className="fight-card border border-transparent rounded-xl transition-all">
                        <FightCard fight={fight} existingPick={getLockedPick(fight.id)} pendingPick={pendingPicks[fight.id]} onPick={handleTogglePick} />
                    </div>
                ))}
                </div>
            </div>
        ))}
      </div>

      {/* --- DRAWER --- */}
      <div className={`fixed inset-y-0 right-0 w-80 bg-gray-950 border-l border-pink-500/30 shadow-[-20px_0_50px_rgba(0,0,0,0.9)] transform transition-transform duration-500 ease-in-out z-[999] ${isActuallyOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="p-6 h-full flex flex-col">
            <div className="flex justify-between items-center mb-6 border-b border-gray-800 pb-4">
                <h2 className="text-xl font-black text-white uppercase italic tracking-tighter">Your Slip</h2>
                <button onClick={() => setIsDrawerOpen(false)} className="text-gray-500 hover:text-white transition-colors">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-4 scrollbar-hide">
                {Object.entries(pendingPicks).map(([fightId, selection]) => {
                    const fight = fights.find(f => f.id == fightId);
                    return (
                        <div key={fightId} className="bg-gray-900 border border-gray-800 p-4 rounded-xl relative group">
                            <div className="text-[10px] text-gray-500 uppercase font-black mb-1">{fight?.fighter_1_name} vs {fight?.fighter_2_name}</div>
                            <div className="flex justify-between items-center">
                                <span className="font-bold text-white tracking-tight">{selection.fighter}</span>
                                {/* REMOVED $ SYMBOL AND ADDED 'pts' */}
                                <span className="text-green-400 font-mono">+{calculatePayout(selection.odds).toFixed(0)} pts</span>
                            </div>
                            <button onClick={() => handleTogglePick(fightId, selection.fighter, selection.odds)} className="absolute -top-2 -right-2 bg-gray-800 border border-gray-700 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                        </div>
                    );
                })}
            </div>
            <div className="mt-6 border-t border-gray-800 pt-6">
                <div className="flex justify-between text-lg font-black mb-6 text-white uppercase italic">
                    {/* CHANGED TERMINOLOGY TO FANTASY POINTS */}
                    <span>Est. Points</span>
                    <span className="text-green-400">{totalReturn.toFixed(0)}</span>
                </div>
                <button onClick={submitPicks} disabled={isSubmitting || Object.keys(pendingPicks).length === 0} className="w-full bg-pink-600 hover:bg-pink-500 text-white font-black uppercase py-4 rounded-xl shadow-[0_0_20px_rgba(219,39,119,0.4)] transition-all disabled:opacity-50">
                    {isSubmitting ? 'Locking...' : 'Lock In Picks'}
                </button>
            </div>
        </div>
      </div>
    </div>
  );
}