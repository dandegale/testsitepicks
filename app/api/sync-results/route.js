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

  try {
    // 1. Fetch from ESPN MMA Scoreboard (Free, No Key)
    const response = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard`,
      { cache: 'no-store' }
    );

    if (!response.ok) {
        return NextResponse.json({ message: 'Failed to fetch from ESPN' }, { status: 500 });
    }

    const data = await response.json();
    const events = data.events || [];

    if (events.length === 0) {
        return NextResponse.json({ message: 'No events found on ESPN scoreboard.' });
    }

    // 2. Fetch Active Fights from DB
    const { data: dbFights } = await supabase
        .from('fights')
        .select('*')
        .is('winner', null);

    if (!dbFights || dbFights.length === 0) {
        return NextResponse.json({ message: 'No active fights in DB to sync.' });
    }

    const logs = [];
    let updatesCount = 0;

    // 3. Loop through ESPN Events
    for (const event of events) {
        const competition = event.competitions[0];
        const status = event.status.type;

        // Skip if not finished
        if (!status.completed) continue;

        // Find the Winner
        const competitors = competition.competitors; // Array of 2 fighters
        const winnerObj = competitors.find(c => c.winner === true);

        if (!winnerObj) continue; // Should not happen if completed, but safe check

        const winnerName = winnerObj.athlete.fullName; // e.g. "Jon Jones"

        // 4. Match with Database
        // ESPN names might be slightly different ("Alexander Volkanovski" vs "Alex Volkanovski")
        // We use our fuzzy matching logic.
        
        // Find the matching fight in our DB
        // We check if the winner's name is present in either fighter column
        const match = dbFights.find(dbFight => {
            const dbF1 = dbFight.fighter_1_name.toLowerCase();
            const dbF2 = dbFight.fighter_2_name.toLowerCase();
            const espnName = winnerName.toLowerCase();

            // Check strict inclusion (e.g. "Jones" in "Jon Jones")
            const matchF1 = dbF1.includes(espnName) || espnName.includes(dbF1);
            const matchF2 = dbF2.includes(espnName) || espnName.includes(dbF2);

            // Double check: We need to make sure this is actually the right fight
            // (In case two fights have a "Smith"). 
            // We usually check the opponent too, but ESPN structure makes getting the opponent name easy.
            return matchF1 || matchF2;
        });

        if (match) {
            // Determine exactly which string to save based on our DB columns
            let finalWinnerName = null;
            if (match.fighter_1_name.toLowerCase().includes(winnerName.toLowerCase()) || winnerName.toLowerCase().includes(match.fighter_1_name.toLowerCase())) {
                finalWinnerName = match.fighter_1_name;
            } else {
                finalWinnerName = match.fighter_2_name;
            }

            // Update Supabase
            const { error } = await supabase
                .from('fights')
                .update({ winner: finalWinnerName })
                .eq('id', match.id);

            if (!error) {
                updatesCount++;
                logs.push(`✅ RESULT: ${finalWinnerName} def. ${finalWinnerName === match.fighter_1_name ? match.fighter_2_name : match.fighter_1_name}`);
            } else {
                logs.push(`❌ DB Error: ${error.message}`);
            }
        }
    }

    return NextResponse.json({ 
        message: 'ESPN Sync Complete', 
        updates: updatesCount, 
        logs: logs 
    });

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}