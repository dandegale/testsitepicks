'use client';

import Link from 'next/link';
import { createFighterSlug } from '@/utils/slugify';

export default function FightCard({ 
  fight, 
  existingPick, 
  pendingPick, 
  onPick, 
  showOdds = true 
}) {
  
  // 1. SAFETY GUARD
  if (!fight || !fight.start_time) {
      return null; 
  }

  // 2. FIXED TIME PARSING
  // We parse the Supabase string directly. The browser handles ISO strings better natively.
  // We only add 'Z' as a fallback if the date is completely invalid without it.
  const rawTime = fight.start_time;
  let startTime = new Date(rawTime);

  // Fallback: If parsing failed (Invalid Date), try appending Z (assuming it was a raw UTC string)
  if (isNaN(startTime.getTime())) {
      startTime = new Date(`${rawTime}Z`);
  }

  const isValidDate = !isNaN(startTime.getTime());
  const hasStarted = isValidDate && startTime < new Date();
  const isLocked = !!existingPick || hasStarted; 
  
  const isSelected = pendingPick?.fighterName === fight.fighter_1_name || pendingPick?.fighterName === fight.fighter_2_name;
  
  // 3. FORMATTING HELPERS
  const formatFightTime = (date) => {
    if (!isValidDate) return 'TBD';
    
    // Shows distinct time for EVERY card (e.g., 6:00 PM, 6:30 PM) in the user's local time
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short', 
      hour: 'numeric', 
      minute: '2-digit', 
      timeZoneName: 'short'
    }).format(date);
  };

  const calculatePayout = (odds) => {
    if (!odds) return 0;
    const stake = 10;
    return odds > 0 
      ? ((odds / 100) * stake) + stake 
      : ((100 / Math.abs(odds)) * stake) + stake;
  };

  const renderOddsText = (odds) => {
      if (!showOdds) return <span className="opacity-0">---</span>; 
      return <>{odds > 0 ? '+' : ''}{odds}</>;
  };

  const renderFighterName = (name, badgeLabel) => {
    const isBMF = badgeLabel === 'BMF';
    const badgeStyle = isBMF 
      ? "bg-zinc-800 text-white border border-zinc-500 shadow-[0_0_10px_rgba(255,255,255,0.2)]" 
      : "bg-yellow-500 text-black shadow-[0_0_10px_rgba(234,179,8,0.5)]"; 

    return (
      <div className="flex flex-col items-center justify-center mb-2">
        <div className="flex items-center justify-center gap-2">
          <h3 className="text-xl md:text-2xl font-black text-white uppercase leading-none">
            <Link 
              href={`/fighter/${createFighterSlug(name)}`}
              className="hover:text-pink-500 hover:underline decoration-pink-500 decoration-2 underline-offset-4 transition-all"
            >
              {name}
            </Link>
          </h3>
          {badgeLabel && (
            <span 
              className={`${badgeStyle} text-[9px] font-black px-1.5 py-0.5 rounded flex items-center justify-center min-w-[24px] h-5 tracking-tighter transform translate-y-[-1px]`} 
              title={isBMF ? "BMF Champion" : "Champion"}
            >
              {badgeLabel}
            </span>
          )}
        </div>
      </div>
    );
  };

  if (fight.winner) {
    return (
      <div className="bg-gray-900 border-2 border-gray-800 rounded-lg p-4 flex justify-between items-center opacity-75 grayscale mb-4">
        <div className="text-gray-500 font-bold">{fight.fighter_1_name}</div>
        <div className="text-pink-600 font-black uppercase text-xl italic">
            {fight.winner === fight.fighter_1_name ? 'VICTORY' : ''}
            {fight.winner === fight.fighter_2_name ? 'VICTORY' : ''}
        </div>
        <div className="text-gray-500 font-bold">{fight.fighter_2_name}</div>
      </div>
    );
  }

  return (
    <div className={`
        bg-gray-900 rounded-lg p-6 mb-4 shadow-lg transition-all duration-200 border-2
        ${isSelected 
            ? 'border-pink-600 shadow-[0_0_15px_rgba(219,39,119,0.3)]' 
            : 'border-gray-800 hover:border-gray-500'
        }
    `}>
      
      {/* HEADER SECTION */}
      <div className="flex justify-between items-center mb-6 text-gray-400 text-xs uppercase tracking-widest font-bold">
        <span>{fight.event_name || 'UFC Fight Night'}</span>
        <span className="text-white font-mono tracking-tighter bg-gray-800 px-2 py-1 rounded">
            {formatFightTime(startTime)}
        </span>
      </div>

      <div className="flex justify-between items-center gap-4">
        
        {/* FIGHTER 1 */}
        <div className="flex-1 text-center group">
          {renderFighterName(fight.fighter_1_name, fight.fighter_1_badge)}
          
          <div className="text-yellow-500 font-mono text-sm mb-4 min-h-[20px]">
            {renderOddsText(fight.fighter_1_odds)}
          </div>
          
          <button
            onClick={() => onPick(fight.id, fight.fighter_1_name, fight.fighter_1_odds)}
            disabled={isLocked}
            className={`w-full py-3 rounded font-bold uppercase text-sm tracking-wider transition-all
              ${isLocked 
                ? (existingPick?.selected_fighter === fight.fighter_1_name ? 'bg-green-800 text-white' : 'bg-gray-800 text-gray-600 cursor-not-allowed')
                : (pendingPick?.fighterName === fight.fighter_1_name 
                    ? 'bg-gray-700 text-white border border-gray-500 shadow-inner' 
                    : 'bg-pink-600 hover:bg-pink-500 text-white shadow-lg shadow-pink-900/20' 
                  )
              }`}
          >
            {isLocked && existingPick?.selected_fighter === fight.fighter_1_name && 'LOCKED IN'}
            {isLocked && existingPick?.selected_fighter !== fight.fighter_1_name && existingPick && 'LOCKED'}
            {isLocked && !existingPick && hasStarted && 'CLOSED'}
            
            {!isLocked && pendingPick?.fighterName === fight.fighter_1_name && 'SELECTED'}
            
            {!isLocked && !pendingPick && (
              <div className="flex flex-col leading-tight">
                <span>Pick to Win</span>
                <span className="text-[9px] opacity-75 font-medium normal-case mt-0.5">
                   Returns {calculatePayout(fight.fighter_1_odds).toFixed(2)}
                </span>
              </div>
            )}
          </button>
        </div>

        <div className="text-gray-700 font-black text-2xl italic opacity-50 select-none">VS</div>

        {/* FIGHTER 2 */}
        <div className="flex-1 text-center group">
           {renderFighterName(fight.fighter_2_name, fight.fighter_2_badge)}
          
          <div className="text-yellow-500 font-mono text-sm mb-4 min-h-[20px]">
             {renderOddsText(fight.fighter_2_odds)}
          </div>
          
          <button
            onClick={() => onPick(fight.id, fight.fighter_2_name, fight.fighter_2_odds)}
            disabled={isLocked}
            className={`w-full py-3 rounded font-bold uppercase text-sm tracking-wider transition-all
              ${isLocked 
                ? (existingPick?.selected_fighter === fight.fighter_2_name ? 'bg-green-800 text-white' : 'bg-gray-800 text-gray-600 cursor-not-allowed')
                : (pendingPick?.fighterName === fight.fighter_2_name 
                    ? 'bg-gray-700 text-white border border-gray-500 shadow-inner' 
                    : 'bg-teal-600 hover:bg-teal-500 text-white shadow-lg shadow-teal-900/20' 
                  )
              }`}
          >
             {isLocked && existingPick?.selected_fighter === fight.fighter_2_name && 'LOCKED IN'}
             {isLocked && existingPick?.selected_fighter !== fight.fighter_2_name && existingPick && 'LOCKED'}
             {isLocked && !existingPick && hasStarted && 'CLOSED'}

             {!isLocked && pendingPick?.fighterName === fight.fighter_2_name && 'SELECTED'}
             
             {!isLocked && !pendingPick && (
              <div className="flex flex-col leading-tight">
                <span>Pick to Win</span>
                <span className="text-[9px] opacity-75 font-medium normal-case mt-0.5">
                   Returns {calculatePayout(fight.fighter_2_odds).toFixed(2)}
                </span>
              </div>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}