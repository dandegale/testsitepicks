'use client';

export default function FightCard({ 
  fight, 
  existingPick, 
  pendingPick, 
  onPick, 
  showOdds = true 
}) {
  
  // 1. NEW: Check if the fight has started based on local time
  const hasStarted = new Date(fight.start_time) < new Date();

  // 2. UPDATE: Lock the card if a pick exists OR if the fight has started
  const isLocked = !!existingPick || hasStarted; 
  
  const isSelected = pendingPick?.fighterName === fight.fighter_1_name || pendingPick?.fighterName === fight.fighter_2_name;
  
  const calculatePayout = (odds) => {
    if (!odds) return 0;
    const stake = 10;
    return odds > 0 
      ? ((odds / 100) * stake) + stake 
      : ((100 / Math.abs(odds)) * stake) + stake;
  };

  const renderOddsText = (odds) => {
      if (!showOdds) return <span className="opacity-0">---</span>; 
      return (
          <>
            {odds > 0 ? '+' : ''}{odds}
          </>
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
      
      <div className="flex justify-between items-center mb-6 text-gray-400 text-xs uppercase tracking-widest font-bold">
        <span>{fight.event_name || 'UFC Fight Night'}</span>
        <span>{new Date(fight.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
      </div>

      <div className="flex justify-between items-center gap-4">
        
        {/* FIGHTER 1 */}
        <div className="flex-1 text-center">
          <h3 className="text-xl md:text-2xl font-black text-white uppercase leading-none mb-2">
            {fight.fighter_1_name}
          </h3>
          
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
            {/* LOGIC FOR BUTTON TEXT */}
            {isLocked && existingPick?.selected_fighter === fight.fighter_1_name && 'LOCKED IN'}
            
            {/* Case: Locked, I picked the OTHER guy */}
            {isLocked && existingPick?.selected_fighter && existingPick?.selected_fighter !== fight.fighter_1_name && 'LOCKED'}
            
            {/* Case: Locked because fight started, but I made NO pick */}
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

        <div className="text-gray-700 font-black text-2xl italic opacity-50">VS</div>

        {/* FIGHTER 2 */}
        <div className="flex-1 text-center">
          <h3 className="text-xl md:text-2xl font-black text-white uppercase leading-none mb-2">
            {fight.fighter_2_name}
          </h3>
          
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
             {isLocked && existingPick?.selected_fighter && existingPick?.selected_fighter !== fight.fighter_2_name && 'LOCKED'}
             
             {/* Case: Locked because fight started, but I made NO pick */}
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