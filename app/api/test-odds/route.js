import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const API_KEY = process.env.ODDS_API_KEY;

  if (!API_KEY) {
      return NextResponse.json({ error: 'Missing ODDS_API_KEY in environment variables.' }, { status: 500 });
  }

  try {
    // 1. Fetch raw data from The Odds API
    const response = await fetch(
      `https://api.the-odds-api.com/v4/sports/mma_mixed_martial_arts/odds/?apiKey=${API_KEY}&regions=us&markets=h2h&oddsFormat=american`
    );

    const apiData = await response.json();

    // Catch if the API limit was reached or returned an error
    if (!apiData || !Array.isArray(apiData)) {
        return NextResponse.json({ 
            error: 'API returned a non-array response. Check your API usage/limits.', 
            raw_response: apiData 
        });
    }

    const fightsList = [];
    let turciosFound = false;

    // 2. Parse the payload for readability
    for (const event of apiData) {
        let f1Name = "Unknown";
        let f2Name = "Unknown";
        
        // Grab the first available bookmaker to see the fighters
        const firstBook = event.bookmakers.length > 0 ? event.bookmakers[0] : null;

        if (firstBook && firstBook.markets && firstBook.markets[0].outcomes.length >= 2) {
            f1Name = firstBook.markets[0].outcomes[0].name;
            f2Name = firstBook.markets[0].outcomes[1].name;
        }

        // Check specifically for Turcios
        if (f1Name.toLowerCase().includes('turcios') || f2Name.toLowerCase().includes('turcios')) {
            turciosFound = true;
        }

        fightsList.push({
            event_title: event.sport_title,
            time: event.commence_time,
            fighter_1: f1Name,
            fighter_2: f2Name,
            books_offering_odds: event.bookmakers.map(b => b.key).join(', ')
        });
    }

    // 3. Return the diagnostic report
    return NextResponse.json({ 
        message: "API Data Fetch Successful (No DB writes performed)", 
        total_fights_found: fightsList.length,
        isTurciosInPayload: turciosFound,
        fights: fightsList
    });

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}