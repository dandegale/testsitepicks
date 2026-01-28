import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  // 1. SECURITY CHECK (Service Role Key Required)
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const API_KEY = process.env.ODDS_API_KEY; 

  try {
    // 2. FETCH SCORES (Look back 3 days for completed fights)
    const response = await fetch(
      `https://api.the-odds-api.com/v4/sports/mma_mixed_martial_arts/scores/?daysFrom=3&apiKey=${API_KEY}`
    );

    const apiData = await response.json();
    if (!apiData || apiData.length === 0) return NextResponse.json({ message: 'No recent results found.' });

    const logs = [];

    // 3. PROCESS COMPLETED FIGHTS
    for (const event of apiData) {
        if (!event.completed) continue; // Skip if fight is still live or pending

        // Deduce the winner from the API scores
        // The API usually returns: scores: [{name: "Jones", score: "1"}, {name: "Stipe", score: "0"}]
        // Or sometimes score is "W"/"L" depending on the provider.
        // We logic: If one score > other, that's the winner.
        let winnerName = null;
        if (event.scores && event.scores.length === 2) {
            const f1 = event.scores[0];
            const f2 = event.scores[1];
            
            // Clean scores to numbers if possible, or string compare
            // Note: Use a loose check because sometimes they send strings "1" vs "0"
            if (f1.score > f2.score) winnerName = f1.name;
            else if (f2.score > f1.score) winnerName = f2.name;
        }

        if (!winnerName) continue; // Couldn't determine winner

        // 4. FIND FIGHT IN DB
        const f1Name = event.home_team.toLowerCase().trim();
        const f2Name = event.away_team.toLowerCase().trim();

        // Use our trusty JavaScript matching logic again
        const { data: matches } = await supabase
            .from('fights')
            .select('*')
            // Only fetch fights that don't have a winner yet
            .is('winner', null); 

        const match = matches?.find(dbFight => {
            const dbF1 = dbFight.fighter_1_name.toLowerCase().trim();
            const dbF2 = dbFight.fighter_2_name.toLowerCase().trim();
            // Check A vs B OR B vs A
            return (dbF1 === f1Name || dbF1 === f2Name) && (dbF2 === f1Name || dbF2 === f2Name);
        });

        if (match) {
            // 5. UPDATE DATABASE
            // We verify matches to ensure the "winnerName" matches exactly how it's stored in DB
            // (e.g. if API says "Jon Jones" but DB has "Jonny Jones", we need to be careful.
            // But usually API winner name matches API event name).
            
            // Safe Check: Ensure winner matches one of the DB columns exactly
            let dbWinnerName = match.fighter_1_name; 
            // If winner matches fighter 2 loosely, set to fighter 2
            if (winnerName.toLowerCase().includes(match.fighter_2_name.toLowerCase().split(' ')[1])) {
                dbWinnerName = match.fighter_2_name;
            } else if (winnerName.toLowerCase().includes(match.fighter_1_name.toLowerCase().split(' ')[1])) {
                 dbWinnerName = match.fighter_1_name;
            }

            const { error } = await supabase
                .from('fights')
                .update({ winner: dbWinnerName })
                .eq('id', match.id);

            if (!error) logs.push(`🏆 Winner Set: ${dbWinnerName} (vs ${match.fighter_1_name === dbWinnerName ? match.fighter_2_name : match.fighter_1_name})`);
        }
    }

    return NextResponse.json({ 
      message: 'Settlement Complete', 
      updates: logs 
    });

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}