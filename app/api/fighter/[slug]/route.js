import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { createClient } from '@supabase/supabase-js';

// 🎯 INIT SUPABASE
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// 🎯 THE NAME DICTIONARY
const NAME_DICTIONARY = {
    "Javier Reyes Rugeles": "Javier Reyes",
    "Joseph Pyfer": "Joe Pyfer",
    "Long Xiao": "Xiao Long",
    "Sergey Spivak": "Serghei Spivac",
    "Sulangrangbo": "Sulangrangbo", 
    "Sumudaerji Sumudaerji": "Su Mudaerji",
    "Sumerdaji Sumerdaji": "Su Mudaerji", // Catching alternate spellings
    "Yi Zha": "Yizha"
};

// 🎯 REVERSE DICTIONARY: Maps clean names BACK to the raw database names
const REVERSE_DICT = Object.fromEntries(
    Object.entries(NAME_DICTIONARY).map(([dbName, cleanName]) => [cleanName.toLowerCase(), dbName])
);

// 🎯 HELPER: SQUASH NAMES FOR FLAWLESS MATCHING
const squashName = (name) => name ? name.toLowerCase().replace(/[^a-z]/g, '') : '';

export async function GET(request, { params }) {
    
    // Next.js 15+ requires params to be awaited
    const { slug } = await params;
    
    if (!slug) return NextResponse.json({ error: 'No slug provided' }, { status: 400 });

    // 1. Format the basic name
    const rawName = slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    
    // 2. Identify the "Clean Name" (e.g. "Su Mudaerji") and "DB Name" (e.g. "Sumudaerji Sumudaerji")
    const cleanName = NAME_DICTIONARY[rawName] || rawName;
    const dbName = REVERSE_DICT[cleanName.toLowerCase()] || cleanName;
    
    const targetClean = squashName(cleanName);
    const dbParts = dbName.split(' ');
    const searchFirst = dbParts[0]; 
    const searchLast = dbParts[dbParts.length - 1];

    // 🎯 1. CHECK SUPABASE FIRST (Looking for BOTH clean and weird names)
    let { data: dbData } = await supabase
        .from('fighter_historical_stats')
        .select('*')
        .in('fighter_name', [cleanName, dbName]) // Checks both "Su Mudaerji" and "Sumudaerji Sumudaerji"
        .limit(1)
        .maybeSingle();

    // Data Buckets
    let espn = null;
    let tsdb = null;
    let ufcStats = { height: null, weight: null, reach: null, stance: null, age: null, record: null, nickname: null, history: [], winStats: null, slpm: 0, tdAvg: 0, subAvg: 0, strAcc: 0, tdAcc: 0, tdDef: 0 };
    let ufcCom = { ranking: '', nextFight: null, image: null };
    let wiki = { history: [], winStats: null };

    // 🚀 2. FIRE ALL 5 DATA SOURCES CONCURRENTLY
    await Promise.allSettled([
        
        // 1. ESPN API (Primary for Image & Bio)
        (async () => {
            const espnUrl = `https://site.api.espn.com/apis/site/v2/sports/mma/ufc/athletes?limit=1&q=${encodeURIComponent(cleanName)}`;
            const res = await fetch(espnUrl);
            if (res.ok) {
                const data = await res.json();
                const athletes = data.items || data.athletes || data.sports?.[0]?.leagues?.[0]?.athletes;
                if (athletes && athletes.length > 0) espn = athletes[0];
            }
        })(),

        // 2. THE SPORTS DB (Fallback for Image & Country)
        (async () => {
            const res = await fetch(`https://www.thesportsdb.com/api/v1/json/3/searchplayers.php?p=${encodeURIComponent(cleanName)}`);
            if (res.ok) {
                const data = await res.json();
                if (data.player && data.player.length > 0) {
                    tsdb = data.player.find(p => p.strSport === 'MMA' || (p.strDescriptionEN && p.strDescriptionEN.includes('UFC')) || p.strTeam === 'UFC') || data.player[0];
                }
            }
        })(),

        // 3. UFC STATS (Primary for Physicals, Nickname, Fallback for History)
        (async () => {
            const checkRows = (html) => {
                const $search = cheerio.load(html);
                let link = null;
                $search('.b-statistics__table-row').each((i, el) => {
                    if (i === 0) return;
                    const cols = $search(el).find('td');
                    if (cols.length >= 2) {
                        const fName = $search(cols[0]).text().trim();
                        const lName = $search(cols[1]).text().trim();
                        const siteClean = squashName(fName + lName);
                        
                        if (siteClean === targetClean || 
                           (siteClean.length > 4 && targetClean.includes(siteClean)) || 
                           (targetClean.length > 4 && siteClean.includes(targetClean)) ||
                           (siteClean === squashName(dbName))) { // Fallback match
                            link = $search(cols[0]).find('a').attr('href');
                            return false; 
                        }
                    }
                });
                return link;
            };

            // First Pass: Search by Last Name (Using the DB's weird last name)
            let searchUrl = `http://ufcstats.com/statistics/fighters/search?query=${encodeURIComponent(searchLast)}&page=all`;
            let searchRes = await fetch(searchUrl);
            let fighterLink = checkRows(await searchRes.text());

            // Second Pass (The Sumudaerji Fix): Search by First Name
            if (!fighterLink) {
                searchUrl = `http://ufcstats.com/statistics/fighters/search?query=${encodeURIComponent(searchFirst)}&page=all`;
                searchRes = await fetch(searchUrl);
                fighterLink = checkRows(await searchRes.text());
            }

            if (fighterLink) {
                const profileRes = await fetch(fighterLink);
                const profileHtml = await profileRes.text();
                const $ = cheerio.load(profileHtml);
                
                $('.b-list__box-list-item').each((i, el) => {
                    const text = $(el).text().replace(/\s\s+/g, ' ').trim();
                    if (text.includes('Height:')) ufcStats.height = text.replace('Height:', '').trim();
                    if (text.includes('Weight:')) ufcStats.weight = text.replace('Weight:', '').trim();
                    if (text.includes('Reach:')) ufcStats.reach = text.replace('Reach:', '').trim();
                    if (text.includes('STANCE:')) ufcStats.stance = text.replace('STANCE:', '').trim();
                    if (text.includes('DOB:')) {
                        const dobStr = text.replace('DOB:', '').trim();
                        if (dobStr !== '--') {
                            const birthYear = new Date(dobStr).getFullYear();
                            ufcStats.age = (new Date().getFullYear() - birthYear).toString();
                        }
                    }
                    if (text.includes('SLpM:')) ufcStats.slpm = parseFloat(text.replace('SLpM:', '').trim()) || 0;
                    if (text.includes('TD Avg.:')) ufcStats.tdAvg = parseFloat(text.replace('TD Avg.:', '').trim()) || 0;
                    if (text.includes('Sub. Avg.:')) ufcStats.subAvg = parseFloat(text.replace('Sub. Avg.:', '').trim()) || 0;
                    if (text.includes('Str. Acc.:')) ufcStats.strAcc = parseFloat(text.replace('Str. Acc.:', '').replace('%', '').trim()) || 0;
                    if (text.includes('TD Acc.:') || text.includes('Td. Acc.:')) ufcStats.tdAcc = parseFloat(text.replace(/TD Acc\.:|Td\. Acc\.:/i, '').replace('%', '').trim()) || 0;
                    if (text.includes('TD Def.:') || text.includes('Td. Def.:')) ufcStats.tdDef = parseFloat(text.replace(/TD Def\.:|Td\. Def\.:/i, '').replace('%', '').trim()) || 0;
                });

                const recordText = $('.b-content__title-record').text().trim();
                const recMatch = recordText.match(/Record:\s*([\d\-\sNC]+)/);
                if (recMatch) ufcStats.record = recMatch[1].trim();
                
                const nickText = $('.b-content__nickname').text().trim();
                if (nickText) ufcStats.nickname = nickText;

                let fw = 0, fko = 0, fsub = 0, fdec = 0;
                $('.b-fight-details__table-row').slice(1).each((i, row) => {
                    const cols = $(row).find('td');
                    if (cols.length >= 8) {
                        const flag = $(cols[0]).text().toLowerCase();
                        let outcome = "—";
                        if (flag.includes('win')) { outcome = "Win"; fw++; }
                        else if (flag.includes('loss')) outcome = "Loss";
                        else if (flag.includes('draw')) outcome = "Draw";
                        else if (flag.includes('nc')) outcome = "NC";

                        const fighters = $(cols[1]).find('a');
                        let opponent = "Unknown";
                        if (fighters.length >= 2) {
                            const f1 = $(fighters[0]).text().trim();
                            const f2 = $(fighters[1]).text().trim();
                            const f1Squash = squashName(f1);
                            opponent = (f1Squash === targetClean || targetClean.includes(f1Squash) || squashName(dbName).includes(f1Squash)) ? f2 : f1;
                        }

                        const event = $(cols[6]).find('a').text().trim() || "UFC Event";
                        const date = $(cols[6]).find('p').eq(1).text().trim() || "";
                        const method = $(cols[7]).find('p').eq(0).text().trim() || "Decision";

                        if (outcome !== "—" && opponent !== "Unknown") {
                            ufcStats.history.push({ outcome, opponent, method, event, date });
                            if (outcome === "Win") {
                                const m = method.toLowerCase();
                                if (m.includes('ko')) fko++;
                                else if (m.includes('sub')) fsub++;
                                else fdec++;
                            }
                        }
                    }
                });

                if (fw > 0) {
                    ufcStats.winStats = {
                        ko: fko, koPct: Math.round((fko/fw)*100),
                        sub: fsub, subPct: Math.round((fsub/fw)*100), 
                        dec: fdec, decPct: Math.round((fdec/fw)*100), 
                        totalWins: fw
                    };
                }
            }
        })(),

        // 4. UFC.COM (Primary for Official Ranking, Next Fight, & Hero Image)
        (async () => {
            // 🎯 THE FIX: Force UFC.com to use squashed URLs for mononyms
            const ufcComSlug = (targetClean.includes('sumudaerji')) ? 'sumudaerji' : slug.toLowerCase();

            const ufcRes = await fetch(`https://www.ufc.com/athlete/${ufcComSlug}`);
            if (ufcRes.ok) {
                const ufcHtml = await ufcRes.text();
                const $ = cheerio.load(ufcHtml);
                
                // Extract Image
                const img = $('.hero-profile__image').attr('src');
                if (img) ufcCom.image = img;

                const heroText = $('.hero-profile__division-title').text().toLowerCase();
                if (heroText.includes('champion')) {
                    ufcCom.ranking = 'C';
                } else {
                    const rankTag = $('.hero-profile__tag').toArray().find(t => $(t).text().includes('#'));
                    if (rankTag) ufcCom.ranking = $(rankTag).text().trim();
                }

                const firstCard = $('.c-card-event--result').first();
                if (firstCard.length > 0) {
                    const outcome = firstCard.find('.c-card-event--result__outcome').text().trim();
                    if (!outcome || outcome === "") {
                        const opponent = firstCard.find('.c-card-event--result__fighter').text().trim();
                        const date = firstCard.find('.c-card-event--result__date').text().trim();
                        const headline = firstCard.find('.c-card-event--result__headline').text().trim();
                        if (opponent) {
                            ufcCom.nextFight = {
                                outcome: "Upcoming", opponent: opponent.replace(/vs\.?/i, '').trim(),
                                method: headline || "Scheduled", date: date || "Upcoming", event: "UFC Event"
                            };
                        }
                    }
                }
            }
        })(),

        // 5. WIKIPEDIA (Primary for Detailed History)
        (async () => {
            let searchRes = await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(cleanName + " fighter")}&format=json&origin=*`);
            let searchData = await searchRes.json();
            
            if (!searchData.query?.search?.length) {
                 searchRes = await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(cleanName)}&format=json&origin=*`);
                 searchData = await searchRes.json();
            }

            if (searchData.query?.search?.length) {
                const title = searchData.query.search[0].title;
                const htmlRes = await fetch(`https://en.wikipedia.org/api/rest_v1/page/html/${encodeURIComponent(title)}`);
                const htmlText = await htmlRes.text();
                const $ = cheerio.load(htmlText);

                let bestTable = null; let maxScore = 0;
                $('table.wikitable').each((i, table) => {
                    const text = $(table).text().toLowerCase();
                    let score = 0;
                    if (text.includes("res")) score += 2;
                    if (text.includes("opponent")) score += 3;
                    if (text.includes("kickboxing")) score -= 5;
                    if (score > maxScore) { maxScore = score; bestTable = table; }
                });

                if (bestTable) {
                    let wins = 0; let winsKO = 0, winsSub = 0, winsDec = 0;
                    
                    $(bestTable).find('tbody tr').each((i, row) => {
                        const cells = $(row).find('td');
                        if (cells.length > 5) {
                            const resText = $(cells[0]).text().trim();
                            if (!['Win', 'Loss', 'Draw', 'NC'].some(r => resText.includes(r))) return;
                            
                            const opponent = $(cells[2]).text().replace(/\n/g, '').trim();
                            const method = $(cells[3]).text().split('[')[0].trim();
                            const event = $(cells[4]).text().trim();
                            const date = $(cells[5]).text().trim();
                            let outcome = "—";
                            
                            if ($(row).hasClass("table-yes2") || resText.includes("Win")) {
                                outcome = "Win"; wins++;
                                const m = method.toLowerCase();
                                if (m.includes('ko') || m.includes('tko')) winsKO++;
                                else if (m.includes('sub')) winsSub++;
                                else if (m.includes('dec')) winsDec++;
                            } else if (resText.includes("Loss")) outcome = "Loss";
                            else if (resText.includes("Draw")) outcome = "Draw";

                            if (opponent) wiki.history.push({ outcome, opponent, method, event, date });
                        }
                    });
                    
                    if (wins > 0) {
                        wiki.winStats = {
                            ko: winsKO, koPct: Math.round((winsKO/wins)*100),
                            sub: winsSub, subPct: Math.round((winsSub/wins)*100),
                            dec: winsDec, decPct: Math.round((winsDec/wins)*100), totalWins: wins
                        };
                    }
                }
            }
        })()
    ]);

    // 🧠 3. THE MERGE: Intelligently combine Supabase, ESPN, UFC Stats, etc.
    let bio = {
        image_url: ufcCom.image || dbData?.image_url || (espn?.headshot?.href) || (tsdb?.strCutout) || (tsdb?.strThumb) || null,
        height: dbData?.height || (espn?.displayHeight) || ufcStats.height || '—',
        weight: dbData?.weight || (espn?.displayWeight) || ufcStats.weight || '—',
        age: dbData?.age?.toString() || (espn?.age?.toString()) || ufcStats.age || '—',
        reach: dbData?.reach || ufcStats.reach || '—',
        stance: ufcStats.stance || '—',
        record: dbData?.record || (espn?.displayRecord) || ufcStats.record || '—',
        ranking: ufcCom.ranking || '',
        country: (espn?.citizenship) || (tsdb?.strNationality) || '—',
        nickname: dbData?.nickname || (espn?.nickname) || ufcStats.nickname || '',
        history: wiki.history.length > 0 ? wiki.history : ufcStats.history,
        winStats: wiki.winStats || ufcStats.winStats || { ko: 0, koPct: 0, sub: 0, subPct: 0, dec: 0, decPct: 0, totalWins: 0 },
        sig_strikes_per_min: dbData?.sig_strikes_per_min || ufcStats.slpm || 0,
        takedown_avg: dbData?.takedown_avg || ufcStats.tdAvg || 0,
        submission_avg: dbData?.submission_avg || ufcStats.subAvg || 0,
        striking_accuracy: dbData?.striking_accuracy || ufcStats.strAcc || 0,
        takedown_accuracy: dbData?.takedown_accuracy || ufcStats.tdAcc || 0,
        takedown_defense: dbData?.takedown_defense || ufcStats.tdDef || 0,
        average_fantasy_points: dbData?.average_fantasy_points || 0
    };

    if (ufcCom.nextFight) {
        bio.history.unshift(ufcCom.nextFight);
    }

    // 🎯 4. AUTO-SAVE TO SUPABASE
    if (!dbData || !dbData.height || dbData.height === '--') {
        const targetDbName = dbData?.fighter_name || dbName; // Respect the DB's current name to prevent duplicates
        const newDbEntry = {
            fighter_name: targetDbName,
            nickname: bio.nickname,
            record: bio.record,
            age: parseInt(bio.age) || null,
            height: bio.height,
            weight: bio.weight,
            reach: bio.reach,
            sig_strikes_per_min: bio.sig_strikes_per_min,
            takedown_avg: bio.takedown_avg,
            submission_avg: bio.submission_avg,
            striking_accuracy: bio.striking_accuracy,
            takedown_accuracy: bio.takedown_accuracy,
            takedown_defense: bio.takedown_defense,
            image_url: bio.image_url,
            last_updated: new Date().toISOString()
        };
        
        supabase.from('fighter_historical_stats').upsert(newDbEntry, { onConflict: 'fighter_name' }).then(({error}) => {
            if (error) console.error("Auto-save failed:", error.message);
        });
    }

    return NextResponse.json(bio);
}