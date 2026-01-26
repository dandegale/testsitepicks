'use client';

export default function FightCard({ fight, existingPick, pendingPick, onPick }) {
  
  // Determine the display state
  const isLocked = !!existingPick; // Already saved in DB
  const isSelected = pendingPick?.fighter === fight.fighter_1_name || pendingPick?.fighter === fight.fighter_2_name;
  
  // Helper for payout math
  const calculatePayout = (odds) => {
    if (!odds) return 0;
    const stake = 10;
    return odds > 0 
      ? ((odds / 100) * stake) + stake 
      : ((100 / Math.abs(odds)) * stake) + stake;
  };

  // If fight is finished, show result
  if (fight.winner) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 flex justify-between items-center opacity-75 grayscale mb-4">
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
    <div className={`bg-gray-900 border rounded-lg p-6 mb-4 shadow-lg transition-colors ${isSelected ? 'border-yellow-500 ring-1 ring-yellow-500' : 'border-gray-700 hover:border-gray-500'}`}>
      
      <div className="flex justify-between items-center mb-6 text-gray-400 text-xs uppercase tracking-widest font-bold">
        <span>UFC Fight Night</span>
        <span>{new Date(fight.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
      </div>

      <div className="flex justify-between items-center gap-4">
        
        {/* FIGHTER 1 */}
        <div className="flex-1 text-center">
          <h3 className="text-xl md:text-2xl font-black text-white uppercase leading-none mb-2">
            {fight.fighter_1_name}
          </h3>
          <div className="text-yellow-500 font-mono text-sm mb-4">
            {fight.fighter_1_odds > 0 ? '+' : ''}{fight.fighter_1_odds}
          </div>
          
          <button
            onClick={() => onPick(fight.id, fight.fighter_1_name, fight.fighter_1_odds)}
            disabled={isLocked}
            className={`w-full py-3 rounded font-bold uppercase text-sm tracking-wider transition-all
              ${isLocked 
                ? (existingPick?.selected_fighter === fight.fighter_1_name ? 'bg-green-800 text-white' : 'bg-gray-800 text-gray-600 cursor-not-allowed')
                : (pendingPick?.fighter === fight.fighter_1_name ? 'bg-yellow-500 text-black' : 'bg-pink-600 hover:bg-pink-500 text-white shadow-lg shadow-red-900/50')
              }`}
          >
            {isLocked && existingPick?.selected_fighter === fight.fighter_1_name && 'LOCKED IN'}
            {isLocked && existingPick?.selected_fighter !== fight.fighter_1_name && 'LOCKED'}
            {!isLocked && pendingPick?.fighter === fight.fighter_1_name && 'SELECTED'}
            {!isLocked && !pendingPick && (
              <div className="flex flex-col">
                <span>Pick to Win</span>
                <span className="text-[10px] opacity-80 normal-case">
                   Returns {calculatePayout(fight.fighter_1_odds).toFixed(2)}
                </span>
              </div>
            )}
          </button>
        </div>

        <div className="text-gray-600 font-black text-2xl italic opacity-30">VS</div>

        {/* FIGHTER 2 */}
        <div className="flex-1 text-center">
          <h3 className="text-xl md:text-2xl font-black text-white uppercase leading-none mb-2">
            {fight.fighter_2_name}
          </h3>
          <div className="text-yellow-500 font-mono text-sm mb-4">
            {fight.fighter_2_odds > 0 ? '+' : ''}{fight.fighter_2_odds}
          </div>
          
          <button
            onClick={() => onPick(fight.id, fight.fighter_2_name, fight.fighter_2_odds)}
            disabled={isLocked}
            className={`w-full py-3 rounded font-bold uppercase text-sm tracking-wider transition-all
              ${isLocked 
                ? (existingPick?.selected_fighter === fight.fighter_2_name ? 'bg-green-800 text-white' : 'bg-gray-800 text-gray-600 cursor-not-allowed')
                : (pendingPick?.fighter === fight.fighter_2_name ? 'bg-yellow-500 text-black' : 'bg-teal-600 hover:bg-teal-500 text-white shadow-lg shadow-blue-900/50')
              }`}
          >
             {isLocked && existingPick?.selected_fighter === fight.fighter_2_name && 'LOCKED IN'}
             {isLocked && existingPick?.selected_fighter !== fight.fighter_2_name && 'LOCKED'}
             {!isLocked && pendingPick?.fighter === fight.fighter_2_name && 'SELECTED'}
             {!isLocked && !pendingPick && (
              <div className="flex flex-col">
                <span>Pick to Win</span>
                <span className="text-[10px] opacity-80 normal-case">
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