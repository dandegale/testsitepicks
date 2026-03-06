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
  
  // Controls if we are in the clean view or active picking view
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

  // 🎯 Upgraded renderer: Now handles Red (Pink) vs Blue (Teal) corners and Records
  const renderFighterName = (name, badgeLabel, record, cornerColor) => {
    const isBMF = badgeLabel === 'BMF';
    const badgeStyle = isBMF 
      ? "bg-zinc-800 text-white border border-zinc-500 shadow-[0_0_10px_rgba(255,255,255,0.2)]" 
      : "bg-yellow-500 text-black shadow-[0_0_10px_rgba(234,179,8,0.5)]"; 

    const avgPoints = fighterStats && fighterStats[name] !== undefined ? fighterStats[name] : null;
    
    // Check if this fighter is locked while outside of draft mode
    const isThisFighterLocked = existingPick?.selected_fighter === name;
    const showLockedState = !showPickControls && isThisFighterLocked;

    // Set corner-specific theme colors
    const isPink = cornerColor === 'pink';
    const colorClass = isPink ? 'text-pink-500' : 'text-teal-400';
    const borderClass = isPink ? 'border-pink-500/30' : 'border-teal-500/30';
    const bgClass = isPink ? 'bg-pink-950/40' : 'bg-teal-950/40';
    const hoverClass = isPink ? 'hover:text-pink-500 decoration-pink-500' : 'hover:text-teal-400 decoration-teal-400';

    return (
      <div className="flex flex-col items-center justify-center w-full text-center relative z-10">
        <div className="flex flex-wrap items-center justify-center gap-1 w-full">
          <h3 className={`text-sm sm:text-lg md:text-xl font-black uppercase leading-tight line-clamp-2 break-words transition-colors duration-300 ${showLockedState ? colorClass : 'text-white'}`}>
            <Link 
              href={`/fighter/${createFighterSlug(name)}`}
              className={`${hoverClass} hover:underline decoration-2 underline-offset-2 transition-all`}
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

        {/* 🎯 NEW: Fighter Record displays here if available */}
        {record && (
            <span className="text-[9px] sm:text-[10px] font-mono text-gray-500 tracking-widest mt-0.5 opacity-80">
                {record}
            </span>
        )}

        {/* 🎯 Locked Pick Badge: Now matches the corner color! */}
        {showLockedState && (
            <div className={`mt-1 text-[9px] font-black uppercase tracking-widest flex items-center gap-1 px-2 py-0.5 rounded border animate-in fade-in slide-in-from-bottom-1 duration-300 shadow-lg ${colorClass} ${bgClass} ${borderClass}`}>
                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                Locked
            </div>
        )}
        
        {avgPoints !== null && (
            <div className={`bg-gray-800/50 border border-gray-700 px-1.5 py-[1px] rounded shadow-sm inline-block ${showLockedState ? 'mt-1' : 'mt-1.5'}`}>
                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none">
                    Avg: <span className="text-white">{avgPoints}</span> pts
                </span>
            </div>
        )}
      </div>
    );
  };

  if (fight.winner) {
    // Kept standard victory display exactly the same
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
        relative overflow-hidden bg-gray-900 rounded-xl shadow-md transition-all duration-300 border-2 flex flex-col group
        ${showPickControls ? 'p-3 md:p-5 h-full' : 'p-3 md:p-5'} 
        ${isSelected 
            ? 'border-pink-600 shadow-[0_0_15px_rgba(219,39,119,0.2)]' 
            : 'border-gray-800 hover:border-gray-700'
        }
    `}>
      
      {/* 🎯 NEW: The Ambient Red vs Blue Background Glow */}
      <div className="absolute inset-0 bg-gradient-to-r from-pink-600/10 via-gray-900/50 to-teal-600/10 z-0 pointer-events-none opacity-60 group-hover:opacity-100 transition-opacity duration-500"></div>

      <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4 text-gray-500 text-[9px] sm:text-[10px] uppercase tracking-widest font-bold border-b border-gray-800/50 pb-2">
        <span className="line-clamp-1">{fight.event_name || 'UFC Fight Night'}</span>
        <span className="text-gray-300 font-mono tracking-tighter bg-gray-950 px-2 py-1 rounded border border-gray-800 self-start sm:self-auto shrink-0">
            {formatFightTime(startTime)}
        </span>
      </div>

      <div className={`relative z-10 grid grid-cols-[1fr_auto_1fr] gap-2 sm:gap-4 w-full ${showPickControls ? 'items-stretch flex-1' : 'items-center'}`}>
        
        {/* FIGHTER 1 COLUMN (PINK CORNER) */}
        <div className={`flex flex-col w-full ${showPickControls ? 'h-full justify-between' : 'justify-center items-center'}`}>
          <div className={`flex flex-col items-center w-full ${showPickControls ? 'justify-start' : 'justify-center'}`}>
              {/* Passed 'pink' and fighter record into renderer */}
              {renderFighterName(fight.fighter_1_name, fight.fighter_1_badge, fight.fighter_1_record, 'pink')}
          </div>
          
          <div className={`w-full flex flex-col ${showPickControls ? 'mt-auto pt-4' : 'pt-2'}`}>
              <div className={`text-yellow-500 font-mono text-center leading-none ${showPickControls ? 'text-[10px] sm:text-xs mb-2 sm:mb-3 min-h-[16px]' : 'text-[9px] sm:text-[10px] opacity-70'}`}>
                {renderOddsText(fight.fighter_1_odds)}
              </div>
              
              {showPickControls && (
                <button
                    onClick={() => onPick(fight.id, fight.fighter_1_name, fight.fighter_1_odds)}
                    disabled={isLocked}
                    className={`w-full py-2.5 mt-2 sm:mt-0 rounded font-black uppercase text-[9px] sm:text-xs tracking-wide transition-all animate-in fade-in zoom-in duration-200
                    ${isLocked 
                        ? (existingPick?.selected_fighter === fight.fighter_1_name ? 'bg-pink-600/20 border border-pink-500/50 text-pink-500' : 'bg-gray-950 text-gray-700 cursor-not-allowed')
                        : (pendingPick?.fighterName === fight.fighter_1_name 
                            ? 'bg-gray-100 text-black border border-white shadow-[0_0_15px_rgba(255,255,255,0.3)]' 
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
                        <span className="text-[7px] sm:text-[8px] opacity-75 font-bold normal-case">
                        Ret: {calculatePayout(fight.fighter_1_odds).toFixed(2)}
                        </span>
                    </div>
                    )}
                </button>
              )}
          </div>
        </div>

        {/* 🎯 NEW: Upgraded VS Focal Point Badge */}
        <div className={`flex flex-col justify-center items-center px-1 sm:px-3 z-10 ${showPickControls ? 'pb-8' : ''}`}>
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gray-950 border border-gray-800 rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(0,0,0,0.5)] relative">
                {/* Subtle inner glow for the VS circle */}
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-pink-500/10 to-teal-500/10"></div>
                <span className="text-gray-400 font-black text-[9px] sm:text-[11px] italic select-none relative z-10">VS</span>
            </div>
        </div>

        {/* FIGHTER 2 COLUMN (TEAL CORNER) */}
        <div className={`flex flex-col w-full ${showPickControls ? 'h-full justify-between' : 'justify-center items-center'}`}>
           <div className={`flex flex-col items-center w-full ${showPickControls ? 'justify-start' : 'justify-center'}`}>
               {/* Passed 'teal' and fighter record into renderer */}
               {renderFighterName(fight.fighter_2_name, fight.fighter_2_badge, fight.fighter_2_record, 'teal')}
           </div>
          
          <div className={`w-full flex flex-col ${showPickControls ? 'mt-auto pt-4' : 'pt-2'}`}>
              <div className={`text-yellow-500 font-mono text-center leading-none ${showPickControls ? 'text-[10px] sm:text-xs mb-2 sm:mb-3 min-h-[16px]' : 'text-[9px] sm:text-[10px] opacity-70'}`}>
                 {renderOddsText(fight.fighter_2_odds)}
              </div>
              
              {showPickControls && (
                <button
                    onClick={() => onPick(fight.id, fight.fighter_2_name, fight.fighter_2_odds)}
                    disabled={isLocked}
                    className={`w-full py-2.5 mt-2 sm:mt-0 rounded font-black uppercase text-[9px] sm:text-xs tracking-wide transition-all animate-in fade-in zoom-in duration-200
                    ${isLocked 
                        ? (existingPick?.selected_fighter === fight.fighter_2_name ? 'bg-teal-600/20 border border-teal-500/50 text-teal-400' : 'bg-gray-950 text-gray-700 cursor-not-allowed')
                        : (pendingPick?.fighterName === fight.fighter_2_name 
                            ? 'bg-gray-100 text-black border border-white shadow-[0_0_15px_rgba(255,255,255,0.3)]' 
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
                        <span className="text-[7px] sm:text-[8px] opacity-75 font-bold normal-case">
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