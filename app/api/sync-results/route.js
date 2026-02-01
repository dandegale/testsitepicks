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
    // 1. Fetch ESPN Data
    const response = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard`,
      { cache: 'no-store' }
    );
    const data = await response.json();
    const events = data.events || [];
    
    const logs = [];
    logs.push(`ESPN returned ${events.length} events.`);

    // 2. Fetch DB Fights
    const { data: dbFights } = await supabase.from('fights').select('*').is('winner', null);
    logs.push(`Checking against ${dbFights.length} active DB fights.`);

    let updatesCount = 0;

    for (const event of events) {
        const competition = event.competitions[0];
        const status = event.status.type;
        const f1 = competition.competitors[0].athlete.fullName;
        const f2 = competition.competitors[1].athlete.fullName;
        
        // LOG EVERY FIGHT FOUND
        let logMsg = `ESPN Found: ${f1} vs ${f2} [Status: ${status.description}, Completed: ${status.completed}]`;
        
        if (!status.completed) {
            logs.push(`SKIP: ${logMsg} -> Fight not finished.`);
            continue;
        }

        // Find Winner
        const winnerObj = competition.competitors.find(c => c.winner === true);
        if (!winnerObj) {
             logs.push(`SKIP: ${logMsg} -> Completed, but no winner marked in data.`);
             continue;
        }
        
        const winnerName = winnerObj.athlete.fullName;
        
        // Match with DB
        const match = dbFights.find(dbFight => {
            const dbF1 = dbFight.fighter_1_name.toLowerCase();
            const dbF2 = dbFight.fighter_2_name.toLowerCase();
            const w = winnerName.toLowerCase();
            return dbF1.includes(w) || w.includes(dbF1) || dbF2.includes(w) || w.includes(dbF2);
        });

        if (match) {
             // Determine Name to Save
             let finalWinnerName = null;
             if (match.fighter_1_name.toLowerCase().includes(winnerName.toLowerCase()) || winnerName.toLowerCase().includes(match.fighter_1_name.toLowerCase())) {
                 finalWinnerName = match.fighter_1_name;
             } else {
                 finalWinnerName = match.fighter_2_name;
             }
             
             // Update
             const { error } = await supabase.from('fights').update({ winner: finalWinnerName }).eq('id', match.id);
             if (!error) {
                 updatesCount++;
                 logs.push(`✅ SUCCESS: Updated ${finalWinnerName} as winner.`);
             } else {
                 logs.push(`❌ DB ERROR: ${error.message}`);
             }
        } else {
            logs.push(`⚠️ NO MATCH: Found result for ${winnerName}, but could not find '${f1}' or '${f2}' in your Database.`);
        }
    }

    return NextResponse.json({ message: 'Debug Run Complete', updates: updatesCount, logs: logs });

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}