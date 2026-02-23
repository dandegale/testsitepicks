import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

// 🚨 CRITICAL FIX: Ensure we use "export async function GET" (No default exports!)
export async function GET(request, { params }) {
    
    // Next.js 15+ requires params to be awaited
    const { slug } = await params;
    
    if (!slug) return NextResponse.json({ error: 'No slug provided' }, { status: 400 });

    const searchName = slug.replace(/-/g, ' '); 
    const cleanSlug = slug.replace(/[^a-z0-9]/gi, '').toLowerCase();
    const searchParts = slug.split('-');
    const searchLastName = searchParts[searchParts.length - 1];

    // Data Buckets
    let espn = null;
    let tsdb = null;
    let ufcStats = { height: null, weight: null, reach: null, stance: null, age: null, record: null, nickname: null, history: [], winStats: null };
    let ufcCom = { ranking: '', nextFight: null };
    let wiki = { history: [], winStats: null };

    // 🚀 FIRE ALL 5 DATA SOURCES CONCURRENTLY
    await Promise.allSettled([
        
        // 1. ESPN API (Primary for Image & Bio)
        (async () => {
            const espnUrl = `https://site.api.espn.com/apis/site/v2/sports/mma/ufc/athletes?limit=1&q=${encodeURIComponent(searchName)}`;
            const res = await fetch(espnUrl);
            if (res.ok) {
                const data = await res.json();
                // Safely handle ESPN's unpredictable JSON structure
                const athletes = data.items || data.athletes || data.sports?.[0]?.leagues?.[0]?.athletes;
                if (athletes && athletes.length > 0) espn = athletes[0];
            }
        })(),

        // 2. THE SPORTS DB (Fallback for Image & Country)
        (async () => {
            const res = await fetch(`https://www.thesportsdb.com/api/v1/json/3/searchplayers.php?p=${encodeURIComponent(searchName)}`);
            if (res.ok) {
                const data = await res.json();
                if (data.player && data.player.length > 0) {
                    tsdb = data.player.find(p => p.strSport === 'MMA' || (p.strDescriptionEN && p.strDescriptionEN.includes('UFC')) || p.strTeam === 'UFC') || data.player[0];
                }
            }
        })(),

        // 3. UFC STATS (Primary for Physicals, Nickname, Fallback for History)
        (async () => {
            const searchUrl = `http://ufcstats.com/statistics/fighters/search?query=${encodeURIComponent(searchLastName)}`;
            const searchRes = await fetch(searchUrl);
            const searchHtml = await searchRes.text();
            
            const $search = cheerio.load(searchHtml);
            let fighterLink = null;

            // Fuzzy match to handle names with punctuation (e.g. Lone'er)
            $search('.b-statistics__table-row').each((i, el) => {
                const cols = $search(el).find('td');
                if (cols.length >= 2) {
                    const fName = $search(cols[0]).text().trim();
                    const lName = $search(cols[1]).text().trim();
                    const combinedScraped = (fName + lName).replace(/[^a-z0-9]/gi, '').toLowerCase();
                    if (combinedScraped === cleanSlug) {
                        fighterLink = $search(cols[0]).find('a').attr('href');
                    }
                }
            });

            if (fighterLink) {
                const profileRes = await fetch(fighterLink);
                const profileHtml = await profileRes.text();
                const $ = cheerio.load(profileHtml);
                
                // Get physicals & nickname
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
                });

                const recordText = $('.b-content__title-record').text().trim();
                const recMatch = recordText.match(/Record:\s*([\d\-\sNC]+)/);
                if (recMatch) ufcStats.record = recMatch[1].trim();
                
                const nickText = $('.b-content__nickname').text().trim();
                if (nickText) ufcStats.nickname = nickText;

                // Fallback History parsing
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
                            opponent = (f1.replace(/[^a-z0-9]/gi, '').toLowerCase() === cleanSlug) ? f2 : f1;
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

        // 4. UFC.COM (Primary for Official Ranking & Next Fight)
        (async () => {
            const ufcRes = await fetch(`https://www.ufc.com/athlete/${slug.toLowerCase()}`);
            if (ufcRes.ok) {
                const ufcHtml = await ufcRes.text();
                const $ = cheerio.load(ufcHtml);
                
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
            let searchRes = await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(searchName + " fighter")}&format=json&origin=*`);
            let searchData = await searchRes.json();
            
            if (!searchData.query?.search?.length) {
                 searchRes = await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(searchName)}&format=json&origin=*`);
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

    // 🧠 THE MERGE: Intelligently combine data, prioritizing ESPN, then UFC Stats, then TSDB
    let bio = {
        image: (espn?.headshot?.href) || (tsdb?.strCutout) || (tsdb?.strThumb) || null,
        height: (espn?.displayHeight) || ufcStats.height || '—',
        weight: (espn?.displayWeight) || ufcStats.weight || '—',
        age: (espn?.age?.toString()) || ufcStats.age || '—',
        reach: ufcStats.reach || '—',
        stance: ufcStats.stance || '—',
        record: (espn?.displayRecord) || ufcStats.record || '—',
        ranking: ufcCom.ranking || '',
        country: (espn?.citizenship) || (tsdb?.strNationality) || '—',
        nickname: (espn?.nickname) || ufcStats.nickname || '',
        history: wiki.history.length > 0 ? wiki.history : ufcStats.history,
        winStats: wiki.winStats || ufcStats.winStats || { ko: 0, koPct: 0, sub: 0, subPct: 0, dec: 0, decPct: 0, totalWins: 0 }
    };

    // Inject upcoming fight at the top if it exists
    if (ufcCom.nextFight) {
        bio.history.unshift(ufcCom.nextFight);
    }

    return NextResponse.json(bio);
}