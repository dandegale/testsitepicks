import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

// Connect to the database
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// NOTICE: No "default" word here. Just "export async function GET"
export async function GET() {
  const API_KEY = process.env.ODDS_API_KEY;

  try {
    // 1. Get odds from the API
    const response = await axios.get(`https://api.the-odds-api.com/v4/sports/mma_mixed_martial_arts/odds`, {
      params: {
        apiKey: API_KEY,
        regions: 'us',
        markets: 'h2h',
        bookmakers: 'draftkings',
        oddsFormat: 'american',
      }
    });

    // 2. Format the data for our database
    const dbRows = response.data.map(fight => {
      const dk = fight.bookmakers.find(b => b.key === 'draftkings');
      if (!dk) return null;

      return {
        id: fight.id,
        start_time: fight.commence_time,
        fighter_1_name: dk.markets[0].outcomes[0].name,
        fighter_1_odds: dk.markets[0].outcomes[0].price,
        fighter_2_name: dk.markets[0].outcomes[1].name,
        fighter_2_odds: dk.markets[0].outcomes[1].price,
        updated_at: new Date().toISOString(),
      };
    }).filter(row => row !== null);

    // 3. Save to Supabase
    const { error } = await supabase
      .from('fights')
      .upsert(dbRows, { onConflict: 'id' });

    if (error) throw error;

    return Response.json({ success: true, count: dbRows.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}