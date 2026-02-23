import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

// 🎯 Temporarily set to 0 to clear the bad cache on your live server. 
// Once you confirm images are loading, change this back to 86400!
export const revalidate = 0; 

export async function GET(request, { params }) {
    const { slug } = await params;
    if (!slug) return NextResponse.json({ error: 'No slug provided' }, { status: 400 });

    const cleanSlug = slug.replace(/[^a-z0-9]/gi, '').toLowerCase(); // "loneerkavanagh"
    const searchParts = slug.split('-');
    const searchLastName = searchParts[searchParts.length - 1];      // "kavanagh"

    let bio = {
        image: null, height: '—', weight: '—', age: '—', reach: '—',
        stance: '—', record: '—', ranking: '', country: '—', nickname: '',
        history: [], winStats: { ko: 0, koPct: 0, sub: 0, subPct: 0, dec: 0, decPct: 0, totalWins: 0 }
    };

    let nextFight = null;
    let fallbackHistory = [];
    let fallbackWinStats = null;

    // 🛡️ THE FAKE BROWSER HEADERS (Bypasses Datacenter Bot Protection)
    const spoofHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/json,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
    };

    // 🚀 FIRE ALL 5 DATA SOURCES CONCURRENTLY
    await Promise.allSettled([
        
        // 1. ESPN API
        (async () => {
            const espnUrl = `https://site.api.espn.com/apis/site/v2/sports/mma/ufc/athletes?limit=10&q=${encodeURIComponent(searchLastName)}`;
            const res = await fetch(espnUrl, { headers: spoofHeaders });
            if (res.ok) {
                const data = await res.json();
                const athletes = data.items || data.athletes || data.sports?.[0]?.leagues?.[0]?.athletes;
                if (athletes && athletes.length > 0) {
                    // Fuzzy Match the clean slug
                    const match = athletes.find(a => {
                        const fullName = (a.firstName + a.lastName).replace(/[^a-z0-9]/gi, '').toLowerCase();
                        return fullName === cleanSlug || fullName.includes(cleanSlug) || cleanSlug.includes(fullName);
                    });
                    
                    if (match) {
                        bio.image = match.headshot?.href || bio.image;
                        bio.height = match.displayHeight || bio.height;
                        bio.weight = match.displayWeight || bio.weight;
                        bio.age = match.age?.toString() || bio.age;
                        bio.country = match.citizenship || bio.country;
                        bio.nickname = match.nickname || bio.nickname;
                        bio.record = match.displayRecord || bio.record;
                    }
                }
            }
        })(),

        // 2. THE SPORTS DB
        (async () => {
            const url = `https://www.thesportsdb.com/api/v1/json/3/searchplayers.php?p=${encodeURIComponent(searchLastName)}`;
            const res = await fetch(url, { headers: spoofHeaders });
            if (res.ok) {
                const data = await res.json();
                if (data.player && data.player.length > 0) {
                    const match = data.player.find(p => {
                        const pName = p.strPlayer.replace(/[^a-z0-9]/gi, '').toLowerCase();
                        return (pName === cleanSlug || pName.includes(cleanSlug)) && 
                               (p.strSport === 'MMA' || p.strTeam === 'UFC');
                    });
                    if (match) {
                        bio.image = bio.image || match.strCutout || match.strThumb || null;
                        bio.country = bio.country !== '—' ? bio.country : (match.strNationality || '—');
                    }
                }
            }
        })(),

        // 3. UFC STATS
        (async () => {
            const searchUrl = `http://ufcstats.com/statistics/fighters/search?query=${encodeURIComponent(searchLastName)}`;
            const searchRes = await fetch(searchUrl, { headers: spoofHeaders });
            const searchHtml = await searchRes.text();
            
            const $search = cheerio.load(searchHtml);
            let fighterLink = null;

            $search('.b-statistics__table-row').each((i, el) => {
                const cols = $search(el).find('td');
                if (cols.length >= 2) {
                    const fName = $search(cols[0]).text().trim();
                    const lName = $search(cols[1]).text().trim();
                    const combinedScraped = (fName + lName).replace(/[^a-z0-9]/gi, '').toLowerCase();
                    if (combinedScraped === cleanSlug || combinedScraped.includes(cleanSlug)) {
                        fighterLink = $search(cols[0]).find('a').attr('href');
                    }
                }
            });

            if (fighterLink) {
                const profileRes = await fetch(fighterLink, { headers: spoofHeaders });
                const profileHtml = await profileRes.text();
                const $ = cheerio.load(profileHtml);
                
                $('.b-list__box-list-item').each((i, el) => {
                    const text = $(el).text().replace(/\s\s+/g, ' ').trim();
                    if (text.includes('Height:')) bio.height = bio.height !== '—' ? bio.height : text.replace('Height:', '').trim();
                    if (text.includes('Weight:')) bio.weight = bio.weight !== '—' ? bio.weight : text.replace('Weight:', '').trim();
                    if (text.includes('Reach:')) bio.reach = text.replace('Reach:', '').trim();
                    if (text.includes('STANCE:')) bio.stance = text.replace('STANCE:', '').trim();
                });

                const nickText = $('.b-content__nickname').text().trim();
                if (nickText) bio.nickname = bio.nickname || nickText;

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
                            fallbackHistory.push({ outcome, opponent, method, event, date });
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
                    fallbackWinStats = { ko: fko, koPct: Math.round((fko/fw)*100), sub: fsub, subPct: Math.round((fsub/fw)*100), dec: fdec, decPct: Math.round((fdec/fw)*100), totalWins: fw };
                }
            }
        })(),

        // 4. UFC.COM
        (async () => {
            const url = `https://www.ufc.com/athlete/${slug.toLowerCase()}`;
            const ufcRes = await fetch(url, { headers: spoofHeaders });
            if (ufcRes.ok) {
                const ufcHtml = await ufcRes.text();
                const $ = cheerio.load(ufcHtml);
                
                const heroText = $('.hero-profile__division-title').text().toLowerCase();
                if (heroText.includes('champion')) {
                    bio.ranking = 'C';
                } else {
                    const rankTag = $('.hero-profile__tag').toArray().find(t => $(t).text().includes('#'));
                    if (rankTag) bio.ranking = $(rankTag).text().trim();
                }

                const firstCard = $('.c-card-event--result').first();
                if (firstCard.length > 0) {
                    const outcome = firstCard.find('.c-card-event--result__outcome').text().trim();
                    if (!outcome || outcome === "") {
                        const opponent = firstCard.find('.c-card-event--result__fighter').text().trim();
                        const date = firstCard.find('.c-card-event--result__date').text().trim();
                        const headline = firstCard.find('.c-card-event--result__headline').text().trim();
                        if (opponent) {
                            nextFight = { outcome: "Upcoming", opponent: opponent.replace(/vs\.?/i, '').trim(), method: headline || "Scheduled", date: date || "Upcoming", event: "UFC Event" };
                        }
                    }
                }
            }
        })(),

        // 5. WIKIPEDIA
        (async () => {
            let searchRes = await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(slug.replace(/-/g, ' ') + " fighter")}&format=json&origin=*`, { headers: spoofHeaders });
            let searchData = await searchRes.json();
            
            if (!searchData.query?.search?.length) {
                 searchRes = await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(slug.replace(/-/g, ' '))}&format=json&origin=*`, { headers: spoofHeaders });
                 searchData = await searchRes.json();
            }

            if (searchData.query?.search?.length) {
                const title = searchData.query.search[0].title;
                const htmlRes = await fetch(`https://en.wikipedia.org/api/rest_v1/page/html/${encodeURIComponent(title)}`, { headers: spoofHeaders });
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

                            if (opponent) bio.history.push({ outcome, opponent, method, event, date });
                        }
                    });
                    if (wins > 0) bio.winStats = { ko: winsKO, koPct: Math.round((winsKO/wins)*100), sub: winsSub, subPct: Math.round((winsSub/wins)*100), dec: winsDec, decPct: Math.round((winsDec/wins)*100), totalWins: wins };
                }
            }
        })()
    ]);

    // Consolidate data
    if (bio.history.length === 0 && fallbackHistory.length > 0) {
        bio.history = fallbackHistory;
        if (fallbackWinStats) bio.winStats = fallbackWinStats;
    }

    if (nextFight) {
        bio.history.unshift(nextFight);
    }

    return NextResponse.json(bio);
}