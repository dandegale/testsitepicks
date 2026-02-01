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
    if (!apiData || !Array.isArray(apiData)) return NextResponse.json({ message: 'No fights found in API' });

    // 1. Fetch ALL Active Fights (No winner yet)
    const { data: existingFights } = await supabase
        .from('fights')
        .select('*')
        .is('winner', null); 

    const logs = [];
    const bookedFighters = new Set();
    
    // NEW: Track which DB IDs were confirmed by this API update
    const confirmedDbIds = new Set();

    const PREFERRED_BOOKS = ['fanduel', 'draftkings', 'betmgm', 'bovada'];
    const MAX_DAYS_AHEAD = 120;
    const futureLimit = new Date();
    futureLimit.setDate(new Date().getDate() + MAX_DAYS_AHEAD);

    for (const event of apiData) {
        const fightDate = new Date(event.commence_time);

        // FILTER 1: Date Limit
        if (fightDate > futureLimit) continue;

        // Find best bookmaker
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

        // FILTER 2: No 'TBD' or 'TBA'
        if (f1Key.includes('tbd') || f2Key.includes('tbd') || f1Key.includes('tba') || f2Key.includes('tba')) {
            continue;
        }

        // FILTER 3: Prevent duplicate entries within THIS specific API pull
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

        // MATCHING LOGIC
        const match = existingFights.find(dbFight => {
            const dbF1 = dbFight.fighter_1_name.toLowerCase().trim();
            const dbF2 = dbFight.fighter_2_name.toLowerCase().trim();

            const matchDirect = (dbF1.includes(f1Key) || f1Key.includes(dbF1)) && 
                                (dbF2.includes(f2Key) || f2Key.includes(dbF2));
            
            const matchReverse = (dbF1.includes(f2Key) || f2Key.includes(dbF1)) && 
                                 (dbF2.includes(f1Key) || f1Key.includes(dbF2));

            return matchDirect || matchReverse;
        });

        if (match) {
            // ✅ MARK AS CONFIRMED (So we don't delete it later)
            confirmedDbIds.add(match.id);

            // Only update if something changed
            if (match.fighter_1_odds !== outcome1.price || match.fighter_2_odds !== outcome2.price) {
                await supabase.from('fights').update(fightPayload).eq('id', match.id);
                logs.push(`Updated Odds: ${outcome1.name} vs ${outcome2.name}`);
            }
        } else {
            // Insert New Fight
            // Only insert if it's in the future (prevents resurrecting old history)
            if (new Date(event.commence_time) > new Date()) {
                await supabase.from('fights').insert(fightPayload);
                logs.push(`✅ CREATED: ${outcome1.name} vs ${outcome2.name}`);
            }
        }
    }

    // --- NEW: CLEANUP PHASE (The Fix) ---
    // If a fight is in our DB, but was NOT found in the API response, it means it was cancelled or removed.
    // We only delete fights that haven't been marked as "Winner" yet.
    
    const ghostFights = existingFights.filter(f => !confirmedDbIds.has(f.id));

    if (ghostFights.length > 0) {
        const ghostIds = ghostFights.map(f => f.id);
        
        // Safety Check: We could add logic here to only delete future fights if you're worried about live glitching,
        // but generally, if the Odds API drops it, it's gone.
        const { error: deleteError } = await supabase
            .from('fights')
            .delete()
            .in('id', ghostIds);

        if (!deleteError) {
            logs.push(`🗑️ CLEANUP: Removed ${ghostFights.length} cancelled/ghost fights.`);
        } else {
            logs.push(`⚠️ CLEANUP ERROR: ${deleteError.message}`);
        }
    }

    return NextResponse.json({ message: 'Sync & Cleanup Complete', logs: logs });

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}