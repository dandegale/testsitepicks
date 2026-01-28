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
      `https://api.the-odds-api.com/v4/sports/mma_mixed_martial_arts/odds/?apiKey=${API_KEY}&regions=us&markets=h2h&oddsFormat=american`
    );

    const apiData = await response.json();
    if (!apiData || apiData.length === 0) return NextResponse.json({ message: 'No fights found in API' });

    const { data: existingFights } = await supabase
        .from('fights')
        .select('*')
        .gt('start_time', new Date().toISOString());

    const logs = [];
    const bookedFighters = new Set();
    const PREFERRED_BOOKS = ['fanduel', 'draftkings', 'betmgm', 'bovada'];

    // --- CONFIG: REALITY FILTER (UPDATED) ---
    const MAX_DAYS_AHEAD = 120; // <--- CHANGED TO 4 MONTHS
    const today = new Date();
    const futureLimit = new Date();
    futureLimit.setDate(today.getDate() + MAX_DAYS_AHEAD);

    for (const event of apiData) {
        const fightDate = new Date(event.commence_time);

        // FILTER 1: THE DATE CHECK
        // If fight is > 4 months away, skip it.
        if (fightDate > futureLimit) {
            continue;
        }

        let bestBookmaker = null;
        for (const book of PREFERRED_BOOKS) {
            bestBookmaker = event.bookmakers.find(b => b.key === book);
            if (bestBookmaker) break;
        }
        if (!bestBookmaker && event.bookmakers.length > 0) bestBookmaker = event.bookmakers[0];
        
        if (!bestBookmaker) continue;

        const outcome1 = bestBookmaker.markets[0].outcomes[0];
        const outcome2 = bestBookmaker.markets[0].outcomes[1];
        
        const f1Key = outcome1.name.toLowerCase().trim();
        const f2Key = outcome2.name.toLowerCase().trim();

        // FILTER 2: NAME CHECK
        if (f1Key.includes('tbd') || f2Key.includes('tbd') || f1Key.includes('tba') || f2Key.includes('tba')) {
            continue;
        }

        // FILTER 3: DUPLICATE CHECK
        if (bookedFighters.has(f1Key) || bookedFighters.has(f2Key)) continue;

        bookedFighters.add(f1Key);
        bookedFighters.add(f2Key);

        const dynamicEventName = event.sport_title && event.sport_title !== 'Mixed Martial Arts' && event.sport_title !== 'UFC'
            ? event.sport_title 
            : `UFC Fight Night`; 

        const fightPayload = {
            event_name: dynamicEventName,
            start_time: event.commence_time,
            fighter_1_name: outcome1.name,
            fighter_1_odds: outcome1.price,
            fighter_2_name: outcome2.name,
            fighter_2_odds: outcome2.price,
            source: bestBookmaker.key
        };

        const match = existingFights.find(dbFight => {
            const dbF1 = dbFight.fighter_1_name.toLowerCase().trim();
            const dbF2 = dbFight.fighter_2_name.toLowerCase().trim();
            return (dbF1 === f1Key && dbF2 === f2Key) || (dbF1 === f2Key && dbF2 === f1Key);
        });

        if (match) {
            await supabase.from('fights').update(fightPayload).eq('id', match.id);
            logs.push(`Updated: ${outcome1.name} vs ${outcome2.name}`);
        } else {
            await supabase.from('fights').insert(fightPayload);
            logs.push(`✅ CREATED: ${outcome1.name} vs ${outcome2.name}`);
        }
    }

    return NextResponse.json({ message: 'Sync Attempted', logs: logs });

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}