import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  // 1. Check for Service Key
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const API_KEY = process.env.ODDS_API_KEY; 

  try {
    // 2. Fetch from Odds API
    const response = await fetch(
      `https://api.the-odds-api.com/v4/sports/mma_mixed_martial_arts/scores/?daysFrom=3&apiKey=${API_KEY}`
    );

    const apiData = await response.json();

    // Safety Check: Ensure API returned a list
    if (!Array.isArray(apiData)) {
        return NextResponse.json({ message: 'Error from Odds Provider', provider_response: apiData }, { status: 400 });
    }

    const logs = [];
    let updatesCount = 0;

    // 3. Fetch active fights from DB (SAFETY FIX ADDED HERE)
    const { data: rawDbFights, error: dbError } = await supabase
        .from('fights')
        .select('*')
        .is('winner', null); 

    if (dbError) {
        return NextResponse.json({ error: 'Database Error', details: dbError.message }, { status: 500 });
    }

    // --- THE FIX: Default to empty array if null ---
    const dbFights = rawDbFights || [];

    logs.push(`Found ${apiData.length} events in API. Checking against ${dbFights.length} pending fights in DB.`);

    // 4. Loop through API Events
    for (const event of apiData) {
        const title = `${event.home_team} vs ${event.away_team}`;

        // Check A: Scores exist?
        if (!event.scores || event.scores.length === 0) {
             logs.push(`SKIP: ${title} -> No scores data available yet.`);
             continue;
        }

        // Check B: Is completed?
        if (!event.completed) {
             logs.push(`SKIP: ${title} -> API says fight is NOT completed yet.`);
             continue; 
        }

        // Check C: Determine Winner
        let winnerName = null;
        const p1 = event.scores[0]; 
        const p2 = event.scores[1]; 

        // Handle scores (sometimes strings "W", sometimes numbers)
        if (p1.score === 'W') winnerName = p1.name;
        else if (p2.score === 'W') winnerName = p2.name;
        else if (parseInt(p1.score) > parseInt(p2.score)) winnerName = p1.name;
        else if (parseInt(p2.score) > parseInt(p1.score)) winnerName = p2.name;

        if (!winnerName) {
            logs.push(`SKIP: ${title} -> Scores found (${p1.score}-${p2.score}) but winner unclear.`);
            continue;
        }

        // Check D: Match with DB
        const apiF1 = event.home_team.toLowerCase().trim();
        const apiF2 = event.away_team.toLowerCase().trim();

        const match = dbFights.find(dbFight => {
            const dbF1 = dbFight.fighter_1_name.toLowerCase().trim();
            const dbF2 = dbFight.fighter_2_name.toLowerCase().trim();
            return (dbF1 === apiF1 || dbF1 === apiF2) && (dbF2 === apiF1 || dbF2 === apiF2);
        });

        if (!match) {
            logs.push(`SKIP: ${title} -> No matching fight found in Database.`);
            continue;
        }

        // Check E: Update DB
        // Fuzzy match the winner name to our DB columns
        let dbWinnerName = null;
        const normWinner = winnerName.toLowerCase();
        
        if (normWinner === match.fighter_1_name.toLowerCase()) dbWinnerName = match.fighter_1_name;
        else if (normWinner === match.fighter_2_name.toLowerCase()) dbWinnerName = match.fighter_2_name;
        
        // Fuzzy backup
        if (!dbWinnerName) {
            if (match.fighter_1_name.toLowerCase().includes(normWinner)) dbWinnerName = match.fighter_1_name;
            else if (match.fighter_2_name.toLowerCase().includes(normWinner)) dbWinnerName = match.fighter_2_name;
        }

        if (dbWinnerName) {
            const { error } = await supabase.from('fights').update({ winner: dbWinnerName }).eq('id', match.id);
            if (!error) {
                updatesCount++;
                logs.push(`✅ SUCCESS: Updated ${dbWinnerName} as winner.`);
            } else {
                logs.push(`❌ ERROR: DB Update failed for ${dbWinnerName} - ${error.message}`);
            }
        } else {
             logs.push(`SKIP: ${title} -> Winner '${winnerName}' did not fuzz-match DB names.`);
        }
    }

    return NextResponse.json({ 
      message: 'Sync Debug Complete', 
      updates_made: updatesCount,
      logs: logs 
    });

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}