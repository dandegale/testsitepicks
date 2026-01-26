import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic'; // Ensure this runs fresh every time

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const API_KEY = process.env.ODDS_API_KEY;
  const REGION = 'us'; 
  const MARKETS = 'h2h'; 
  const SPORT = 'mma_mixed_martial_arts'; 

  // 1. Fetch data
  const response = await fetch(
    `https://api.the-odds-api.com/v4/sports/${SPORT}/odds/?apiKey=${API_KEY}&regions=${REGION}&markets=${MARKETS}&oddsFormat=american`
  );

  const data = await response.json();

  if (!data || data.length === 0) {
    return NextResponse.json({ message: 'No fights found in API' });
  }

  // 2. Format
  const fightsToUpsert = data.map((event) => {
    const bookmaker = event.bookmakers.find(b => b.key === 'draftkings') || event.bookmakers[0];
    if (!bookmaker) return null;

    const outcome1 = bookmaker.markets[0].outcomes[0]; 
    const outcome2 = bookmaker.markets[0].outcomes[1]; 

    // --- NAMING LOGIC ---
    // Try to use the API's sport title, otherwise fallback to "UFC [Date]"
    const dateStr = new Date(event.commence_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const dynamicEventName = event.sport_title && event.sport_title !== 'Mixed Martial Arts' 
        ? event.sport_title 
        : `UFC Fight Night (${dateStr})`;

    return {
      event_name: dynamicEventName, 
      start_time: event.commence_time,
      fighter_1_name: outcome1.name,
      fighter_1_odds: outcome1.price,
      fighter_2_name: outcome2.name,
      fighter_2_odds: outcome2.price,
    };
  }).filter(Boolean);

  // 3. Upsert into Supabase
  const results = [];
  
  for (const fight of fightsToUpsert) {
    // Check for existing fight by Fighter Names
    const { data: existing } = await supabase
        .from('fights')
        .select('id')
        .or(`fighter_1_name.eq.${fight.fighter_1_name},fighter_1_name.eq.${fight.fighter_2_name}`)
        .single();

    if (existing) {
        // UPDATE
        await supabase
            .from('fights')
            .update({
                fighter_1_odds: fight.fighter_1_odds,
                fighter_2_odds: fight.fighter_2_odds,
                start_time: fight.start_time,
                event_name: fight.event_name // Update the name too!
            })
            .eq('id', existing.id);
        results.push(`Updated: ${fight.fighter_1_name}`);
    } else {
        // INSERT
        await supabase
            .from('fights')
            .insert(fight);
        results.push(`Added: ${fight.fighter_1_name}`);
    }
  }

  return NextResponse.json({ 
    message: 'Sync Complete', 
    details: results 
  });
}