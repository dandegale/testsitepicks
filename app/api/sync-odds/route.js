import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function shiftToEST(utcDateString) {
    const date = new Date(utcDateString);
    date.setHours(date.getHours() - 5);
    return date.toISOString(); 
}

// 🎯 NEW: Strips accents (ř -> r, á -> a) so international names match perfectly!
const removeAccents = (str) => {
    return str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "") : '';
};

// Helper to squash names for clean matching
const squashFullName = (name) => {
    if (!name) return '';
    return removeAccents(name).toLowerCase().replace(/[^a-z]/g, '');
};

const isAnchorMatch = (clean1, clean2) => {
    if (!clean1 || !clean2) return false;
    if (clean1 === clean2) return true;
    if (clean1.length > 5 && clean2.includes(clean1)) return true;
    if (clean2.length > 5 && clean1.includes(clean2)) return true;
    return false;
};

// 🎯 UPDATED: Added the Stirling/Simon fixes to the core search key generator
const NAME_FIXES = {
    "roass": "rosas",
    "sumudaerji": "mudaerji",
    "weili": "zhang",
    "stpreux": "st-preux",
    "preux": "st-preux",
    "saintpreux": "st-preux",
    "sterling": "stirling", // Fix for Navajo
    "simone": "simon"       // Fix for Ricky
};

const getSearchKey = (name) => {
    if (!name) return "";
    let clean = removeAccents(name).toLowerCase().trim();
    clean = clean.replace(/\s+(jr\.?|sr\.?|ii|iii)$/g, ''); 
    const parts = clean.split(/\s+/);
    let lastName = parts[parts.length - 1].replace(/[^a-z]/g, '');
    return NAME_FIXES[lastName] || lastName;
};

// 🎯 UPDATED: Added direct translations for the sportsbook weirdness
const NAME_DICTIONARY = {
    "Javier Reyes Rugeles": "Javier Reyes",
    "Joseph Pyfer": "Joe Pyfer",
    "Long Xiao": "Xiao Long",
    "Sergey Spivak": "Serghei Spivac",
    "Sulangrangbo": "Sulangrangbo", 
    "Sumudaerji Sumudaerji": "Su Mudaerji",
    "Sumerdaji Sumerdaji": "Su Mudaerji",
    "Richard Turcios": "Ricky Turcios", 
    "Yi Zha": "Yizha",
    "Navajo Sterling": "Navajo Stirling", // Fix sportsbook typo
    "Ricky Simone": "Ricky Simon",
    "Darya Zheleznyakova": "Daria Zhelezniakova"         // Fix sportsbook typo
};

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
    let espnMatchups = [];

    // 1. Fetch ESPN Data (The Absolute Source of Truth)
    try {
        const today = new Date();
        const future = new Date();
        future.setDate(today.getDate() + 180); 

        const formatDt = (d) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
        const espnUrl = `https://site.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard?dates=${formatDt(today)}-${formatDt(future)}`;

        const espnRes = await fetch(espnUrl);
        const espnData = await espnRes.json();
        
        if (espnData && espnData.events) {
            espnData.events.forEach(event => {
                const realEventName = event.name || event.shortName; 
                event.competitions?.forEach(comp => {
                    const fighters = comp.competitors;
                    if (fighters && fighters.length === 2) {
                        const name1 = fighters[0].athlete?.displayName;
                        const name2 = fighters[1].athlete?.displayName;
                        if (name1 && name2) {
                            espnMatchups.push({
                                f1: { original: name1, clean: squashFullName(name1), key: getSearchKey(name1) },
                                f2: { original: name2, clean: squashFullName(name2), key: getSearchKey(name2) },
                                eventName: realEventName
                            });
                        }
                    }
                });
            });
        }
    } catch (e) {
        console.error("ESPN Fetch Error:", e);
    }

    // 2. Fetch Odds API
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

    if (espnMatchups.length === 0) {
        logs.push("⚠️ WARNING: ESPN API returned 0 active matchups. Sync may be degraded.");
    }

    const PREFERRED_BOOKS = ['fanduel', 'draftkings', 'betmgm', 'bovada'];
    const futureLimit = new Date();
    futureLimit.setDate(new Date().getDate() + 180);

    for (const event of apiData) {
        const fightDate = new Date(event.commence_time);
        if (fightDate > futureLimit || fightDate < new Date()) continue;

        let bestBookmaker = null;
        for (const book of PREFERRED_BOOKS) {
            bestBookmaker = event.bookmakers.find(b => b.key === book);
            if (bestBookmaker) break;
        }
        if (!bestBookmaker && event.bookmakers.length > 0) bestBookmaker = event.bookmakers[0];
        if (!bestBookmaker) continue;

        const outcome1 = bestBookmaker.markets[0].outcomes[0];
        const outcome2 = bestBookmaker.markets[0].outcomes[1];
        
        let f1Name = NAME_DICTIONARY[outcome1.name] || outcome1.name;
        let f2Name = NAME_DICTIONARY[outcome2.name] || outcome2.name;

        const b1 = { clean: squashFullName(f1Name), key: getSearchKey(f1Name) };
        const b2 = { clean: squashFullName(f2Name), key: getSearchKey(f2Name) };

        if (b1.clean.includes('tbd') || b2.clean.includes('tbd') || b1.clean.includes('tba') || b2.clean.includes('tba')) continue;
        if (bookedFighters.has(b1.clean) || bookedFighters.has(b2.clean)) continue;

        let isConfirmedUfc = false;
        let dynamicEventName = null;

        for (const match of espnMatchups) {
            const validDirect = 
                (isAnchorMatch(b1.clean, match.f1.clean) && b2.key === match.f2.key) || 
                (isAnchorMatch(b2.clean, match.f2.clean) && b1.key === match.f1.key) ||
                (b1.key === match.f1.key && b2.key === match.f2.key);

            const validReverse = 
                (isAnchorMatch(b1.clean, match.f2.clean) && b2.key === match.f1.key) || 
                (isAnchorMatch(b2.clean, match.f1.clean) && b1.key === match.f2.key) ||
                (b1.key === match.f2.key && b2.key === match.f1.key);

            if (validDirect || validReverse) {
                isConfirmedUfc = true;
                dynamicEventName = match.eventName;
                break;
            }
        }

        if (!isConfirmedUfc) {
            logs.push(`🚫 BLOCKED FAKE/UNVERIFIED MATCHUP: ${f1Name} vs ${f2Name}`);
            continue;
        }

        const dateStr = fightDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' });
        
        if (!dynamicEventName) {
            dynamicEventName = event.sport_title !== 'Mixed Martial Arts' ? event.sport_title : `UFC Fight Night (${dateStr})`;
        }

        const match = existingFights.find(dbFight => {
            const dbF1_clean = squashFullName(dbFight.fighter_1_name);
            const dbF2_clean = squashFullName(dbFight.fighter_2_name);
            const dbF1_key = getSearchKey(dbFight.fighter_1_name);
            const dbF2_key = getSearchKey(dbFight.fighter_2_name);

            const direct = (isAnchorMatch(dbF1_clean, b1.clean) && dbF2_key === b2.key) ||
                           (isAnchorMatch(dbF2_clean, b2.clean) && dbF1_key === b1.key) ||
                           (dbF1_key === b1.key && dbF2_key === b2.key);

            const reverse = (isAnchorMatch(dbF1_clean, b2.clean) && dbF2_key === b1.key) ||
                            (isAnchorMatch(dbF2_clean, b1.clean) && dbF1_key === b2.key) ||
                            (dbF1_key === b2.key && dbF2_key === b1.key);

            return direct || reverse;
        });

        const adjustedEstTime = shiftToEST(event.commence_time);

        if (match) {
            confirmedDbIds.add(match.id);
            bookedFighters.add(b1.clean);
            bookedFighters.add(b2.clean);

            const dbF1 = squashFullName(match.fighter_1_name);
            const isReversedMatch = isAnchorMatch(dbF1, b2.clean) || getSearchKey(match.fighter_1_name) === b2.key;

            const newFighter1Odds = isReversedMatch ? outcome2.price : outcome1.price;
            const newFighter2Odds = isReversedMatch ? outcome1.price : outcome2.price;

            if (match.fighter_1_odds !== newFighter1Odds || match.fighter_2_odds !== newFighter2Odds || match.event_name !== dynamicEventName || match.start_time !== adjustedEstTime) {
                await supabase
                    .from('fights')
                    .update({
                        event_name: dynamicEventName, 
                        start_time: adjustedEstTime,
                        fighter_1_odds: newFighter1Odds,
                        fighter_2_odds: newFighter2Odds,
                        source: bestBookmaker.key
                    })
                    .eq('id', match.id);
                
                logs.push(`Updated Odds/Event: ${match.fighter_1_name} vs ${match.fighter_2_name}`);
            }
        } else {
            bookedFighters.add(b1.clean);
            bookedFighters.add(b2.clean);

            const { error: insertError } = await supabase.from('fights').insert({
                event_name: dynamicEventName, 
                start_time: adjustedEstTime,
                fighter_1_name: f1Name,
                fighter_1_odds: outcome1.price,
                fighter_2_name: f2Name,
                fighter_2_odds: outcome2.price,
                source: bestBookmaker.key
            });

            if (insertError) {
                logs.push(`❌ DB REJECTED ${f1Name}: ${insertError.message}`);
            } else {
                logs.push(`✅ CREATED UFC FIGHT: ${f1Name} vs ${f2Name}`);
            }
        }
    }

    const ghostFights = existingFights.filter(f => !confirmedDbIds.has(f.id));

    if (ghostFights.length > 0) {
        const ghostIds = ghostFights.map(f => f.id);
        await supabase.from('picks').delete().in('fight_id', ghostIds);
        await supabase.from('fighter_stats').delete().in('fight_id', ghostIds);
        const { error: deleteError } = await supabase.from('fights').delete().in('id', ghostIds);
        if (!deleteError) {
            logs.push(`🗑️ CLEANUP: Erased ${ghostFights.length} speculative/cancelled fights.`);
        }
    }

    return NextResponse.json({ message: 'Sync Complete', matchups_verified_via_espn: espnMatchups.length, logs });

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}