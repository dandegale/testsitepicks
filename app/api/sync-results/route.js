import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const API_KEY = process.env.ODDS_API_KEY; 

  try {
    const response = await fetch(
      `https://api.the-odds-api.com/v4/sports/mma_mixed_martial_arts/scores/?daysFrom=3&apiKey=${API_KEY}`
    );

    const apiData = await response.json();

    // --- SAFETY CHECK 1: Handle API Errors ---
    // If apiData is not an array, it's likely an error message (e.g. { message: 'Quota exceeded' })
    if (!Array.isArray(apiData)) {
        return NextResponse.json({ 
            message: 'Sync Failed: Provider returned an error.', 
            provider_response: apiData 
        }, { status: 400 });
    }

    if (apiData.length === 0) {
        return NextResponse.json({ message: 'No recent results found in API.' });
    }

    const logs = [];
    let updatesCount = 0;

    // Fetch active fights from DB to compare
    const { data: dbFights } = await supabase
        .from('fights')
        .select('*')
        .is('winner', null); 

    for (const event of apiData) {
        // Skip logic if data is incomplete
        if (!event.scores || event.scores.length === 0) continue;

        const isCompleted = event.completed;
        
        // --- DETERMINE WINNER FROM API ---
        let winnerName = null;
        const p1 = event.scores[0]; // Home
        const p2 = event.scores[1]; // Away

        // Check for explicit "W" or score comparison
        if (p1.score === 'W' || parseInt(p1.score) > parseInt(p2.score)) winnerName = p1.name;
        else if (p2.score === 'W' || parseInt(p2.score) > parseInt(p1.score)) winnerName = p2.name;

        // If the API says it's not completed, but we found a winner score anyway, we can arguably proceed.
        // But usually safer to respect 'completed'. 
        // We will proceed IF we found a clear winner name.
        if (!winnerName) continue;

        // --- MATCH WITH DATABASE ---
        // Normalize names for fuzzy matching
        const apiF1 = event.home_team.toLowerCase().trim();
        const apiF2 = event.away_team.toLowerCase().trim();

        const match = dbFights?.find(dbFight => {
            const dbF1 = dbFight.fighter_1_name.toLowerCase().trim();
            const dbF2 = dbFight.fighter_2_name.toLowerCase().trim();
            // Match A vs B OR B vs A
            return (dbF1 === apiF1 || dbF1 === apiF2) && (dbF2 === apiF1 || dbF2 === apiF2);
        });

        if (!match) continue;

        // --- DETERMINE DB WINNER NAME ---
        let dbWinnerName = null;
        const normWinner = winnerName.toLowerCase();
        const normDbF1 = match.fighter_1_name.toLowerCase();
        const normDbF2 = match.fighter_2_name.toLowerCase();

        // 1. Exact Match
        if (normWinner === normDbF1) dbWinnerName = match.fighter_1_name;
        else if (normWinner === normDbF2) dbWinnerName = match.fighter_2_name;
        
        // 2. Partial Match (e.g. "Jones" in "Jon Jones")
        if (!dbWinnerName) {
            if (normDbF1.includes(normWinner) || normWinner.includes(normDbF1)) dbWinnerName = match.fighter_1_name;
            else if (normDbF2.includes(normWinner) || normWinner.includes(normDbF2)) dbWinnerName = match.fighter_2_name;
        }

        if (dbWinnerName) {
            const { error } = await supabase
                .from('fights')
                .update({ winner: dbWinnerName })
                .eq('id', match.id);

            if (!error) {
                updatesCount++;
                logs.push(`✅ UPDATED: ${dbWinnerName} won (DB ID: ${match.id})`);
            } else {
                logs.push(`❌ Error updating DB: ${error.message}`);
            }
        }
    }

    return NextResponse.json({ 
      message: 'Sync Run Complete', 
      updates_made: updatesCount,
      logs: logs 
    });

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}