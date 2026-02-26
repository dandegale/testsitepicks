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
    // ---------------------------------------------------------
    // 1. FETCH ESPN UFC SCOREBOARD (The Ultimate Whitelist)
    // ---------------------------------------------------------
    let ufcNames = [];
    try {
        const espnRes = await fetch('https://site.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard');
        const espnData = await espnRes.json();
        
        if (espnData && espnData.events) {
            espnData.events.forEach(event => {
                event.competitions?.forEach(comp => {
                    comp.competitors?.forEach(c => {
                        if (c.athlete?.displayName) {
                            ufcNames.push(c.athlete.displayName);
                        }
                    });
                });
            });
        }
    } catch (e) {
        console.error("ESPN Fetch Error:", e);
    }

    // ---------------------------------------------------------
    // 2. FETCH THE ODDS API
    // ---------------------------------------------------------
    const response = await fetch(
      `https://api.the-odds-api.com/v4/sports/mma_mixed_martial_arts/odds/?apiKey=${API_KEY}&regions=us&markets=h2h&oddsFormat=american`
    );

    const apiData = await response.json();
    if (!apiData || !Array.isArray(apiData)) return NextResponse.json({ message: 'No fights found in API' });

    const { data: existingFights } = await supabase
        .from('fights')
        .select('*')
        .is('winner', null); 

    const logs = [];
    const bookedFighters = new Set();
    const confirmedDbIds = new Set();

    const PREFERRED_BOOKS = ['fanduel', 'draftkings', 'betmgm', 'bovada'];
    const futureLimit = new Date();
    futureLimit.setDate(new Date().getDate() + 120);

    for (const event of apiData) {
        const fightDate = new Date(event.commence_time);
        if (fightDate > futureLimit) continue;

        // ---------------------------------------------------------
        // 🎯 NEW: WEEKEND FILTER (Ghost Fight Prevention)
        // ---------------------------------------------------------
        // Get the short weekday name ('Sat', 'Sun', 'Mon', etc.) in Eastern Time
        const estDayStr = new Intl.DateTimeFormat('en-US', { 
            timeZone: 'America/New_York', 
            weekday: 'short' 
        }).format(fightDate);

        // If it is NOT Saturday or Sunday, skip it entirely
        if (estDayStr !== 'Sat' && estDayStr !== 'Sun') {
            continue; 
        }
        // ---------------------------------------------------------

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

        if (f1Key.includes('tbd') || f2Key.includes('tbd') || f1Key.includes('tba') || f2Key.includes('tba')) {
            continue;
        }

        if (bookedFighters.has(f1Key) || bookedFighters.has(f2Key)) continue;

        const match = existingFights.find(dbFight => {
            const dbF1 = dbFight.fighter_1_name.toLowerCase().trim();
            const dbF2 = dbFight.fighter_2_name.toLowerCase().trim();

            const isDirect = (dbF1.includes(f1Key) || f1Key.includes(dbF1)) && 
                             (dbF2.includes(f2Key) || f2Key.includes(dbF2));
            
            const isReverse = (dbF1.includes(f2Key) || f2Key.includes(dbF1)) && 
                              (dbF2.includes(f1Key) || f1Key.includes(dbF2));

            return isDirect || isReverse;
        });

        if (match) {
            // Update Existing Fight
            confirmedDbIds.add(match.id);
            bookedFighters.add(f1Key);
            bookedFighters.add(f2Key);

            const dbF1 = match.fighter_1_name.toLowerCase().trim();
            const isReversedMatch = dbF1.includes(f2Key) || f2Key.includes(dbF1);

            const newFighter1Odds = isReversedMatch ? outcome2.price : outcome1.price;
            const newFighter2Odds = isReversedMatch ? outcome1.price : outcome2.price;

            if (match.fighter_1_odds !== newFighter1Odds || match.fighter_2_odds !== newFighter2Odds) {
                await supabase
                    .from('fights')
                    .update({
                        fighter_1_odds: newFighter1Odds,
                        fighter_2_odds: newFighter2Odds,
                        source: bestBookmaker.key
                    })
                    .eq('id', match.id);
                
                logs.push(`Updated Odds: ${match.fighter_1_name} vs ${match.fighter_2_name}`);
            }
        } else {
            // ---------------------------------------------------------
            // 3. THE GATEKEEPER: Check Odds API against ESPN UFC List
            // ---------------------------------------------------------
            const clean = (str) => str.toLowerCase().replace(/['".,-]/g, '').trim();
            const c1 = clean(f1Key);
            const c2 = clean(f2Key);
            
            const isConfirmedUfc = ufcNames.some(name => {
                const cn = clean(name);
                return c1 === cn || c2 === cn || c1.includes(cn) || c2.includes(cn);
            });

            // If the fighter is on the ESPN list, automatically insert them into your database
            if (isConfirmedUfc && new Date(event.commence_time) > new Date()) {
                bookedFighters.add(f1Key);
                bookedFighters.add(f2Key);

                // --- NEW: THE TIMEZONE FIX ---
                // Convert pure UTC to Eastern Time (EST/EDT) in a database-friendly string
                const utcDate = new Date(event.commence_time);
                const estString = utcDate.toLocaleString("sv-SE", { timeZone: "America/New_York" }).replace(" ", "T");

                await supabase.from('fights').insert({
                    event_name: `UFC Fight Night`, 
                    start_time: estString, // <--- NOW USING EASTERN TIME
                    fighter_1_name: outcome1.name,
                    fighter_1_odds: outcome1.price,
                    fighter_2_name: outcome2.name,
                    fighter_2_odds: outcome2.price,
                    source: bestBookmaker.key
                });
                logs.push(`✅ CREATED UFC FIGHT: ${outcome1.name} vs ${outcome2.name}`);
            }
        }
    }

    const ghostFights = existingFights.filter(f => !confirmedDbIds.has(f.id));

    if (ghostFights.length > 0) {
        const ghostIds = ghostFights.map(f => f.id);
        const { error: deleteError } = await supabase
            .from('fights')
            .delete()
            .in('id', ghostIds);

        if (!deleteError) {
            logs.push(`🗑️ CLEANUP: Removed ${ghostFights.length} cancelled or junk fights.`);
        }
    }

    return NextResponse.json({ message: 'Sync Complete', ufc_fighters_found_via_espn: ufcNames.length, logs });

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}