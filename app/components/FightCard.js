'use client';

import Link from 'next/link';
import { createFighterSlug } from '@/utils/slugify';

export default function FightCard({ 
  fight, 
  existingPick, 
  pendingPick, 
  onPick, 
  showOdds = true,
  fighterStats,
  isGlobalFeed = false,
  isDraftMode = false
}) {
  
  if (!fight || !fight.start_time) {
      return null; 
  }

  const rawTime = fight.start_time;
  let startTime = new Date(rawTime);

  if (isNaN(startTime.getTime())) {
      startTime = new Date(`${rawTime}Z`);
  }

  const isValidDate = !isNaN(startTime.getTime());
  const hasStarted = isValidDate && startTime < new Date();
  const isLocked = !!existingPick || hasStarted; 
  
  const isSelected = pendingPick?.fighterName === fight.fighter_1_name || pendingPick?.fighterName === fight.fighter_2_name;
  
  // 🎯 Cleaned up logic: Buttons only show in leagues OR if Draft Mode is ON
  const showPickControls = !isGlobalFeed || isDraftMode;

  const formatFightTime = (date) => {
    if (!isValidDate) return 'TBD';
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

    const avgPoints = fighterStats && fighterStats[name] !== undefined ? fighterStats[name] : null;
    
    // 🎯 THE FIX: Check if this fighter is the existing pick AND if we are in draft mode
    const isThisFighterLocked = existingPick?.selected_fighter === name;
    const isTeal = isDraftMode && isThisFighterLocked;

    return (
      <div className="flex flex-col items-center justify-start w-full text-center">
        <div className="flex flex-wrap items-center justify-center gap-1 w-full">
          {/* Text turns teal if in draft mode and locked */}
          <h3 className={`text-sm sm:text-lg md:text-xl font-black uppercase leading-tight line-clamp-2 break-words transition-colors ${isTeal ? 'text-teal-400' : 'text-white'}`}>
            <Link 
              href={`/fighter/${createFighterSlug(name)}`}
              className="hover:text-pink-500 hover:underline decoration-pink-500 decoration-2 underline-offset-2 transition-all"
            >
              {name}
            </Link>
          </h3>
          {badgeLabel && (
            <span 
              className={`${badgeStyle} text-[8px] font-black px-1.5 py-0.5 rounded flex items-center justify-center min-w-[24px] h-4 tracking-tighter shrink-0`} 
              title={isBMF ? "BMF Champion" : "Champion"}
            >
              {badgeLabel}
            </span>
          )}
        </div>
        
        {/* The small teal text right under the name */}
        {isTeal && (
            <div className="mt-1 text-[9px] font-black text-teal-400 uppercase tracking-widest flex items-center gap-1 bg-teal-950/40 px-2 py-0.5 rounded border border-teal-500/30 animate-in fade-in slide-in-from-bottom-1 duration-300">
                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                Locked Pick
            </div>
        )}

        {avgPoints !== null && (
            <div className="mt-1.5 bg-teal-500/10 border border-teal-500/30 px-1.5 py-[1px] rounded shadow-[0_0_5px_rgba(20,184,166,0.15)] inline-block">
                <span className="text-[9px] font-black text-teal-400 uppercase tracking-widest leading-none">
                    Avg: {avgPoints} pts
                </span>
            </div>
        )}
      </div>
    );
  };

  if (fight.winner) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-3 flex justify-between items-center opacity-75 grayscale mb-2">
        <div className="text-gray-500 font-bold text-xs sm:text-sm truncate pr-2 w-[35%]">{fight.fighter_1_name}</div>
        <div className="text-pink-600 font-black uppercase text-xs sm:text-lg italic shrink-0 text-center">
            {fight.winner === fight.fighter_1_name ? 'VICTORY' : ''}
            {fight.winner === fight.fighter_2_name ? 'VICTORY' : ''}
        </div>
        <div className="text-gray-500 font-bold text-xs sm:text-sm truncate pl-2 w-[35%] text-right">{fight.fighter_2_name}</div>
      </div>
    );
  }

  return (
    <div className={`
        bg-gray-900 rounded-xl p-3 md:p-5 shadow-sm transition-all duration-200 border-2 flex flex-col h-full
        ${isSelected 
            ? 'border-pink-600 shadow-[0_0_10px_rgba(219,39,119,0.2)]' 
            : 'border-gray-800 hover:border-gray-600'
        }
    `}>
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4 text-gray-500 text-[9px] sm:text-[10px] uppercase tracking-widest font-bold border-b border-gray-800/50 pb-2">
        <span className="line-clamp-1">{fight.event_name || 'UFC Fight Night'}</span>
        <span className="text-gray-300 font-mono tracking-tighter bg-gray-950 px-2 py-1 rounded border border-gray-800 self-start sm:self-auto shrink-0">
            {formatFightTime(startTime)}
        </span>
      </div>

      {/* 🎯 Layout changes: Centers items if no pick controls are showing */}
      <div className={`grid grid-cols-[1fr_auto_1fr] gap-1 sm:gap-4 flex-1 w-full ${showPickControls ? 'items-stretch h-full' : 'items-center py-2'}`}>
        
        {/* FIGHTER 1 COLUMN */}
        <div className={`flex flex-col w-full ${showPickControls ? 'h-full justify-between' : 'justify-center gap-2'}`}>
          <div className={`flex flex-col items-center w-full ${showPickControls ? 'justify-start' : 'justify-center'}`}>
              {renderFighterName(fight.fighter_1_name, fight.fighter_1_badge)}
          </div>
          
          <div className={`w-full flex flex-col ${showPickControls ? 'mt-auto pt-3' : 'pt-1'}`}>
              <div className={`text-yellow-500 font-mono text-[10px] sm:text-xs leading-none text-center ${showPickControls ? 'mb-2 sm:mb-3 min-h-[16px]' : ''}`}>
                {renderOddsText(fight.fighter_1_odds)}
              </div>
              
              {showPickControls && (
                <button
                    onClick={() => onPick(fight.id, fight.fighter_1_name, fight.fighter_1_odds)}
                    disabled={isLocked}
                    className={`w-full py-2 mt-2 sm:mt-0 rounded font-bold uppercase text-[9px] sm:text-xs tracking-wide transition-all animate-in fade-in zoom-in duration-200
                    ${isLocked 
                        ? (existingPick?.selected_fighter === fight.fighter_1_name ? 'bg-green-800/80 text-white' : 'bg-gray-950 text-gray-700 cursor-not-allowed')
                        : (pendingPick?.fighterName === fight.fighter_1_name 
                            ? 'bg-gray-800 text-white border border-gray-600 shadow-inner' 
                            : 'bg-pink-600/90 hover:bg-pink-500 text-white shadow-sm shadow-pink-900/20' 
                        )
                    }`}
                >
                    {isLocked && existingPick?.selected_fighter === fight.fighter_1_name && 'LOCKED IN'}
                    {isLocked && existingPick?.selected_fighter !== fight.fighter_1_name && existingPick && 'LOCKED'}
                    {isLocked && !existingPick && hasStarted && 'CLOSED'}
                    
                    {!isLocked && pendingPick?.fighterName === fight.fighter_1_name && 'SELECTED'}
                    
                    {!isLocked && !pendingPick && (
                    <div className="flex flex-col leading-none">
                        <span className="mb-[2px]">Draft</span>
                        <span className="text-[7px] sm:text-[8px] opacity-75 font-medium normal-case">
                        Ret: {calculatePayout(fight.fighter_1_odds).toFixed(2)}
                        </span>
                    </div>
                    )}
                </button>
              )}
          </div>
        </div>

        {/* VS */}
        {/* 🎯 Removes the huge bottom padding when not in draft mode */}
        <div className={`flex flex-col justify-center items-center px-1 sm:px-2 ${showPickControls ? 'pb-8' : ''}`}>
            <div className="text-gray-700 font-black text-xs sm:text-lg italic opacity-40 select-none text-center">VS</div>
        </div>

        {/* FIGHTER 2 COLUMN */}
        <div className={`flex flex-col w-full ${showPickControls ? 'h-full justify-between' : 'justify-center gap-2'}`}>
           <div className={`flex flex-col items-center w-full ${showPickControls ? 'justify-start' : 'justify-center'}`}>
               {renderFighterName(fight.fighter_2_name, fight.fighter_2_badge)}
           </div>
          
          <div className={`w-full flex flex-col ${showPickControls ? 'mt-auto pt-3' : 'pt-1'}`}>
              <div className={`text-yellow-500 font-mono text-[10px] sm:text-xs leading-none text-center ${showPickControls ? 'mb-2 sm:mb-3 min-h-[16px]' : ''}`}>
                 {renderOddsText(fight.fighter_2_odds)}
              </div>
              
              {showPickControls && (
                <button
                    onClick={() => onPick(fight.id, fight.fighter_2_name, fight.fighter_2_odds)}
                    disabled={isLocked}
                    className={`w-full py-2 mt-2 sm:mt-0 rounded font-bold uppercase text-[9px] sm:text-xs tracking-wide transition-all animate-in fade-in zoom-in duration-200
                    ${isLocked 
                        ? (existingPick?.selected_fighter === fight.fighter_2_name ? 'bg-green-800/80 text-white' : 'bg-gray-950 text-gray-700 cursor-not-allowed')
                        : (pendingPick?.fighterName === fight.fighter_2_name 
                            ? 'bg-gray-800 text-white border border-gray-600 shadow-inner' 
                            : 'bg-teal-600/90 hover:bg-teal-500 text-white shadow-sm shadow-teal-900/20' 
                        )
                    }`}
                >
                    {isLocked && existingPick?.selected_fighter === fight.fighter_2_name && 'LOCKED IN'}
                    {isLocked && existingPick?.selected_fighter !== fight.fighter_2_name && existingPick && 'LOCKED'}
                    {isLocked && !existingPick && hasStarted && 'CLOSED'}

                    {!isLocked && pendingPick?.fighterName === fight.fighter_2_name && 'SELECTED'}
                    
                    {!isLocked && !pendingPick && (
                    <div className="flex flex-col leading-none">
                        <span className="mb-[2px]">Draft</span>
                        <span className="text-[7px] sm:text-[8px] opacity-75 font-medium normal-case">
                        Ret: {calculatePayout(fight.fighter_2_odds).toFixed(2)}
                        </span>
                    </div>
                    )}
                </button>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}