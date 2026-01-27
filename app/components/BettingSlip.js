'use client';

export default function BettingSlip({ picks, onCancelAll, onRemovePick, onConfirm, isSubmitting }) {
  if (!picks || picks.length === 0) return null;

  // Calculate Totals
  const stakePerPick = 10;
  const totalWager = picks.length * stakePerPick;
  
  let totalPotentialProfit = 0;
  
  const picksWithPayouts = picks.map(pick => {
    const odds = parseInt(pick.odds, 10);
    let payout = 0;
    if (odds > 0) {
        payout = ((odds / 100) * stakePerPick) + stakePerPick;
    } else {
        payout = ((100 / Math.abs(odds)) * stakePerPick) + stakePerPick;
    }
    const profit = payout - stakePerPick;
    totalPotentialProfit += profit;
    
    return { ...pick, profit };
  });

  return (
    <div className="h-full flex flex-col animate-in slide-in-from-right duration-300">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-6 border-b border-gray-800 pb-4">
        <div>
            <h2 className="text-xl font-black italic uppercase tracking-tighter text-white">YOUR SLIP</h2>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{picks.length} Selections</p>
        </div>
        <button onClick={onCancelAll} className="text-gray-500 hover:text-white text-xs font-bold uppercase transition-colors">
            Clear All ✕
        </button>
      </div>

      {/* Picks List */}
      <div className="flex-1 overflow-y-auto pr-2 space-y-4 mb-6">
        {picksWithPayouts.map((pick) => (
            <div key={pick.fightId} className="bg-gray-900 border border-gray-700 rounded-xl p-4 relative group hover:border-pink-600/50 transition-colors">
                
                {/* Remove Button */}
                <button 
                    onClick={() => onRemovePick(pick.fightId)}
                    className="absolute top-2 right-2 text-gray-600 hover:text-red-500 transition-colors"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                <div className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mb-1">
                    UFC Fight Night
                </div>
                <h3 className="text-lg font-black text-white italic uppercase mb-1">{pick.fighterName}</h3>
                <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-mono font-bold text-teal-400">{pick.odds > 0 ? '+' : ''}{pick.odds}</span>
                    <span className="text-[10px] text-gray-600 font-bold uppercase">Moneyline</span>
                </div>
                
                <div className="flex justify-between items-end border-t border-gray-800 pt-2">
                    <div>
                        <div className="text-[9px] text-gray-500 font-bold uppercase">Wager</div>
                        <div className="text-white font-bold text-xs">10 PTS</div>
                    </div>
                    <div className="text-right">
                        <div className="text-[9px] text-gray-500 font-bold uppercase">Est. Win</div>
                        <div className="text-teal-400 font-black text-sm">+{Math.round(pick.profit)} PTS</div>
                    </div>
                </div>
            </div>
        ))}
      </div>

      {/* Summary Footer */}
      <div className="mt-auto bg-gray-900/50 border border-gray-800 rounded-xl p-6">
        <div className="flex justify-between items-center mb-2">
            <span className="text-gray-400 font-bold uppercase text-xs">Total Wager</span>
            <span className="text-white font-black">{totalWager} PTS</span>
        </div>
        <div className="flex justify-between items-center mb-6">
            <span className="text-gray-400 font-bold uppercase text-xs">Total Return</span>
            <span className="text-2xl font-black text-teal-400">{(totalWager + totalPotentialProfit).toFixed(2)}</span>
        </div>
        
        <button 
            onClick={onConfirm}
            disabled={isSubmitting}
            className="w-full bg-pink-600 hover:bg-pink-500 text-white py-4 rounded-lg font-black uppercase italic text-xl tracking-wider shadow-lg shadow-pink-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
            {isSubmitting ? 'Locking In...' : `LOCK IN ${picks.length} PICKS`}
        </button>
      </div>

    </div>
  );
}