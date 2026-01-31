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
    if (!apiData || apiData.length === 0) return NextResponse.json({ message: 'No recent results found in API.' });

    const logs = [];
    let updatesCount = 0;

    // Fetch active fights from DB to compare
    const { data: dbFights } = await supabase
        .from('fights')
        .select('*')
        .is('winner', null); 

    for (const event of apiData) {
        // LOGGING: Helps you see if the API actually knows the fight is over
        const isCompleted = event.completed;
        const hasScores = event.scores && event.scores.length > 0;
        
        // Debug Log (Visible in the response)
        const debugMsg = `Checking: ${event.home_team} vs ${event.away_team} | Completed: ${isCompleted}`;
        
        if (!isCompleted && !hasScores) {
            logs.push(`${debugMsg} -> Skipped (No status/scores)`);
            continue; 
        }

        // --- DETERMINE WINNER FROM API ---
        let winnerName = null;
        if (hasScores) {
            const p1 = event.scores[0]; // Home
            const p2 = event.scores[1]; // Away

            // Check for explicit "W" or score comparison
            // Sometimes APIs send strings "15" vs "10", sometimes "W" vs "L"
            if (p1.score === 'W' || p1.score > p2.score) winnerName = p1.name;
            else if (p2.score === 'W' || p2.score > p1.score) winnerName = p2.name;
        }

        if (!winnerName) {
            logs.push(`${debugMsg} -> Skipped (No clear winner in scores)`);
            continue;
        }

        // --- MATCH WITH DATABASE ---
        const apiF1 = event.home_team.toLowerCase().trim();
        const apiF2 = event.away_team.toLowerCase().trim();

        const match = dbFights?.find(dbFight => {
            const dbF1 = dbFight.fighter_1_name.toLowerCase().trim();
            const dbF2 = dbFight.fighter_2_name.toLowerCase().trim();
            // Match A vs B OR B vs A
            return (dbF1 === apiF1 || dbF1 === apiF2) && (dbF2 === apiF1 || dbF2 === apiF2);
        });

        if (!match) {
            logs.push(`${debugMsg} -> Skipped (No match found in DB for '${event.home_team}')`);
            continue;
        }

        // --- DETERMINE DB WINNER NAME ---
        // We have the winner from API, but we must use the EXACT string from our DB
        let dbWinnerName = null;

        // Normalize for comparison
        const normWinner = winnerName.toLowerCase();
        const normDbF1 = match.fighter_1_name.toLowerCase();
        const normDbF2 = match.fighter_2_name.toLowerCase();

        // 1. Exact Match Check
        if (normWinner === normDbF1) dbWinnerName = match.fighter_1_name;
        else if (normWinner === normDbF2) dbWinnerName = match.fighter_2_name;
        
        // 2. Fuzzy Last Name Check (Safe Version)
        // If exact match failed, check if one contains the other
        if (!dbWinnerName) {
            if (normDbF1.includes(normWinner) || normWinner.includes(normDbF1)) {
                dbWinnerName = match.fighter_1_name;
            } else if (normDbF2.includes(normWinner) || normWinner.includes(normDbF2)) {
                dbWinnerName = match.fighter_2_name;
            }
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
        } else {
            logs.push(`${debugMsg} -> Skipped (Could not match winner string '${winnerName}' to DB names)`);
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