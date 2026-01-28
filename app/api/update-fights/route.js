import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const API_KEY = process.env.ODDS_API_KEY; 
  const REGION = 'us'; 
  const MARKETS = 'h2h'; 
  const SPORT = 'mma_mixed_martial_arts'; 

  try {
    // 1. Fetch data from The Odds API
    const response = await fetch(
      `https://api.the-odds-api.com/v4/sports/${SPORT}/odds/?apiKey=${API_KEY}&regions=${REGION}&markets=${MARKETS}&oddsFormat=american`
    );

    const apiData = await response.json();

    if (!apiData || apiData.length === 0) {
      return NextResponse.json({ message: 'No fights found in API' });
    }

    // 2. Fetch ALL existing future fights from DB (To compare safely in memory)
    const { data: existingFights } = await supabase
        .from('fights')
        .select('*')
        .gt('start_time', new Date().toISOString());

    const results = [];

    // 3. Process each fight
    for (const event of apiData) {
        
        // --- BOOKMAKER LOGIC ---
        let bookmaker = event.bookmakers.find(b => b.key === 'fanduel');
        if (!bookmaker) {
            bookmaker = event.bookmakers.find(b => b.key === 'draftkings') || event.bookmakers[0];
        }

        if (!bookmaker) continue;

        const outcome1 = bookmaker.markets[0].outcomes[0]; 
        const outcome2 = bookmaker.markets[0].outcomes[1]; 

        // --- NAMING LOGIC ---
        const dateStr = new Date(event.commence_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const dynamicEventName = event.sport_title && event.sport_title !== 'Mixed Martial Arts' 
            ? event.sport_title 
            : `UFC Fight Night (${dateStr})`;

        const fightPayload = {
            event_name: dynamicEventName, 
            start_time: event.commence_time,
            fighter_1_name: outcome1.name,
            fighter_1_odds: outcome1.price,
            fighter_2_name: outcome2.name,
            fighter_2_odds: outcome2.price,
            source: bookmaker.key 
        };

        // --- MATCHING LOGIC (The Fix) ---
        // compare names in JavaScript to avoid SQL errors with "O'Malley"
        const match = existingFights.find(dbFight => {
            const dbF1 = dbFight.fighter_1_name.toLowerCase();
            const dbF2 = dbFight.fighter_2_name.toLowerCase();
            const newF1 = outcome1.name.toLowerCase();
            const newF2 = outcome2.name.toLowerCase();

            // Check matches (including flipped order)
            return (dbF1 === newF1 && dbF2 === newF2) || (dbF1 === newF2 && dbF2 === newF1);
        });

        if (match) {
            // UPDATE
            await supabase
                .from('fights')
                .update(fightPayload)
                .eq('id', match.id);
            results.push(`Updated: ${outcome1.name} vs ${outcome2.name}`);
        } else {
            // INSERT
            await supabase
                .from('fights')
                .insert(fightPayload);
            results.push(`Added: ${outcome1.name} vs ${outcome2.name}`);
        }
    }

    return NextResponse.json({ 
      message: 'Sync Complete', 
      count: results.length,
      details: results 
    });

  } catch (error) {
    console.error("Sync Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}