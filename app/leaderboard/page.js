import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default async function LeaderboardPage() {
  // 1. Fetch EVERYTHING (Fights and Picks)
  const { data: fights } = await supabase.from('fights').select('*');
  const { data: picks } = await supabase.from('picks').select('*');

  // 2. The Math Engine
  const userScores = {};

  // Helper to calculate points (Same math as the cards)
  const calculatePoints = (odds) => {
    const stake = 10;
    if (odds > 0) return (odds / 100) * stake;
    return (100 / Math.abs(odds)) * stake;
  };

  // 3. Loop through every pick and grade it
  if (picks && fights) {
    picks.forEach((pick) => {
      // Find the fight this pick belongs to
      const fight = fights.find((f) => f.id === pick.fight_id);

      // If the fight has a winner AND the user picked correctly
      if (fight && fight.winner && fight.winner === pick.selected_fighter) {
        const points = parseFloat(calculatePoints(pick.odds_at_pick));

        // Add points to user's total
        if (!userScores[pick.user_id]) {
          userScores[pick.user_id] = { name: pick.user_id, score: 0, wins: 0 };
        }
        userScores[pick.user_id].score += points;
        userScores[pick.user_id].wins += 1;
      }
    });
  }

  // 4. Sort the Leaderboard (Highest Score First)
  const leaderboard = Object.values(userScores).sort((a, b) => b.score - a.score);

  return (
    <main className="min-h-screen bg-black text-white p-8">
      <div className="max-w-2xl mx-auto">
        
        {/* Header with Back Button */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-yellow-500 uppercase">🏆 Official Standings</h1>
          <Link href="/" className="text-gray-400 hover:text-white border border-gray-600 px-4 py-2 rounded">
            Back to Fights
          </Link>
        </div>

        {/* The Table */}
        <div className="bg-gray-900 rounded-lg overflow-hidden border border-gray-700 shadow-2xl">
          <table className="w-full text-left">
            <thead className="bg-gradient-to-r from-yellow-700 to-yellow-900 text-white uppercase text-sm font-black tracking-wider">
              <tr>
                <th className="p-4 w-16 text-center">Rank</th>
                <th className="p-4">Player</th>
                <th className="p-4 text-center">Correct Picks</th>
                <th className="p-4 text-right">Total Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {leaderboard.map((user, index) => (
                <tr key={user.name} className="hover:bg-gray-800 transition-colors">
                  <td className="p-4 text-center font-bold text-gray-500 text-xl">
                    {index + 1}
                  </td>
                  <td className="p-4 font-bold text-white">
                    {user.name}
                    {index === 0 && <span className="ml-2 text-xl">👑</span>}
                  </td>
                  <td className="p-4 text-center text-gray-400 font-mono">
                    {user.wins}
                  </td>
                  <td className="p-4 text-right font-black text-green-400 text-xl">
                    {user.score.toFixed(2)}
                  </td>
                </tr>
              ))}
              {leaderboard.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-gray-500">
                    No results yet. Wait for the fights to finish!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}