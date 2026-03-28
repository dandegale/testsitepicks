// 🎯 Tell dotenv to look for both Next.js standard files
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

const axios = require('axios');
const cheerio = require('cheerio');
const { createClient } = require('@supabase/supabase-js');

console.log("🚀 Script started! If you see this, Node is reading the file.");

// 🎯 Catch the variables no matter what you named them in your .env file
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error("❌ ERROR: Missing Supabase Environment Variables!");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ============================================================================
// 🎯 BULLETPROOF NAME MATCHING ENGINE
// ============================================================================

const NAME_FIXES = {
    "roass": "rosas",         
    "sumudaerji": "mudaerji", 
    "weili": "zhang",         
    "stpreux": "st-preux",
    "sterling": "stirling",   // 🎯 Added fix for Navajo Stirling
    "simone": "simon"         // 🎯 Added fix for Ricky Simone/Simon
};

// 🎯 NEW: Safely removes accents (so Simón becomes Simon instead of Simn)
const removeAccents = (str) => {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

const getSearchKey = (name) => {
    if (!name) return "";
    let clean = removeAccents(name).toLowerCase().trim();
    clean = clean.replace(/\s+(jr\.?|sr\.?|ii|iii)$/g, '');
    const parts = clean.split(/\s+/);
    let lastName = parts[parts.length - 1].replace(/[^a-z]/g, '');
    return NAME_FIXES[lastName] || lastName;
};

const sanitizeForMatch = (str) => {
    return str ? removeAccents(str).toLowerCase().replace(/[^a-z]/g, '') : '';
};

const isFighterMatch = (name1, name2) => {
    if (!name1 || !name2) return false;
    const key1 = getSearchKey(name1);
    const key2 = getSearchKey(name2);
    const clean1 = sanitizeForMatch(name1);
    const clean2 = sanitizeForMatch(name2);
    return clean1.includes(key2) || clean2.includes(key1);
};

// ============================================================================
// 🎯 THE DFS SCORING ENGINE (Replicates your LeaguePage math perfectly)
// ============================================================================

const getCustomPoints = (pick, stats, fightInfo, format) => {
    if (!stats) return 0;
    if (format === 'MMA' || !format) return stats.fantasy_points || 0;

    let pts = 0;
    
    if (format === 'Striking') {
        pts = ((stats.sig_strikes || 0) * 0.25) + ((stats.knockdowns || 0) * 5);
    } else if (format === 'Grappling') {
        const ctrlMins = (stats.control_time_seconds || 0) / 60;
        pts = ((stats.takedowns || 0) * 2.5) + ((stats.sub_attempts || 0) * 3) + (ctrlMins * 1.8);
    }

    if (stats.is_winner && fightInfo && fightInfo.method) {
        const method = fightInfo.method.toLowerCase();
        const isKO = method.includes('ko');
        const isSub = method.includes('sub');

        if ((format === 'Striking' && isKO) || (format === 'Grappling' && isSub)) {
            let baseBonus = 0;
            const r = parseInt(fightInfo.round) || 1;
            if (r === 1) baseBonus = 35;
            else if (r === 2) baseBonus = 25;
            else if (r === 3) baseBonus = 20;
            else if (r === 4) baseBonus = 25;
            else if (r === 5) baseBonus = 40;
            else baseBonus = 10;

            let oddsMult = 1;
            const odds = parseInt(pick.odds_at_pick) || 0;
            if (odds > 0) oddsMult = odds / 100;
            else if (odds < 0) oddsMult = 100 / Math.abs(odds);

            let finBonus = baseBonus * oddsMult;
            if (odds < 0) finBonus += 10; 

            pts += finBonus;
        }
    }

    return parseFloat(pts.toFixed(1));
};

// ============================================================================

async function getLatestEventUrl() {
    try {
        console.log("🔍 Searching for the latest UFC event...");
        const { data } = await axios.get('http://ufcstats.com/statistics/events/completed', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        const $ = cheerio.load(data);
        const latestUrl = $('.b-link_style_black').first().attr('href');
        if (!latestUrl) throw new Error("Could not find the event link.");
        return latestUrl;
    } catch (error) {
        console.error("❌ Failed to fetch latest event URL:", error.message);
        return null;
    }
}

async function scrapeFullCard() {
    try {
        const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
        const { data: dbFights, error: dbError } = await supabase.from('fights').select('*').gte('start_time', fourteenDaysAgo);
        if (dbError) throw dbError;

        const UFC_EVENT_URL = await getLatestEventUrl();
        if (!UFC_EVENT_URL) return;

        console.log(`📡 Fetching event card data...`);
        const { data: eventData } = await axios.get(UFC_EVENT_URL, { 
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' } 
        });
        const $event = cheerio.load(eventData);
        
        const fightUrls = [];
        $event('.b-fight-details__table-row').each((i, el) => {
            const link = $event(el).attr('data-link');
            if (link) fightUrls.push(link); 
        });

        console.log(`🥊 Found ${fightUrls.length} fights. Commencing balanced scrape...`);

        for (const url of fightUrls) {
            await scrapeAndScoreFight(url, dbFights);
            await new Promise(r => setTimeout(r, 2000)); 
        }

        await updateAllUsersLifetimePoints();
        await processEconomyPayouts();

        console.log("🏆 Card update complete!");
    } catch (err) {
        console.error("❌ Fatal Event Error:", err.message);
    }
}

async function processEconomyPayouts() {
    try {
        console.log("\n💰 Processing Economy Payouts based on FANTASY POINTS...");

        const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
        const { data: recentFights, error: fightError } = await supabase
            .from('fights')
            .select('id, winner, method, round')
            .not('winner', 'is', null) 
            .gte('start_time', fourteenDaysAgo);

        if (fightError || !recentFights) throw new Error("Could not fetch recent fights.");

        const { data: unpaidPicks, error: picksError } = await supabase
            .from('picks')
            .select('id, user_id, fight_id, selected_fighter, odds_at_pick, league_id')
            .not('league_id', 'is', null)
            .is('paid_out', false);

        if (picksError) return console.error("❌ Error fetching picks.");
        if (!unpaidPicks || unpaidPicks.length === 0) return console.log("✅ No pending payouts found.");

        console.log(`🔎 Found ${unpaidPicks.length} unpaid LEAGUE picks to process. Analyzing matches...`);

        const fightIds = recentFights.map(f => f.id);
        const { data: statsData } = await supabase
            .from('fighter_stats')
            .select('*')
            .in('fight_id', fightIds);

        const leagueIds = [...new Set(unpaidPicks.map(p => p.league_id))];
        const { data: leaguesData } = await supabase
            .from('leagues')
            .select('id, scoring_format')
            .in('id', leagueIds);

        const userEarnings = {};
        const picksToMarkPaid = [];

        unpaidPicks.forEach(pick => {
            const fight = recentFights.find(f => f.id === pick.fight_id);
            
            if (fight) {
                const league = leaguesData?.find(l => String(l.id) === String(pick.league_id));
                const format = league?.scoring_format || 'MMA';

                const statRow = statsData?.find(s => 
                    String(s.fight_id) === String(pick.fight_id) && 
                    isFighterMatch(s.fighter_name, pick.selected_fighter)
                );

                let earnedPoints = 0;
                if (statRow) {
                    earnedPoints = getCustomPoints(pick, statRow, fight, format);
                }

                console.log(`   🎫 Pick: [${pick.selected_fighter}] | Format: [${format}] | DFS Points Scored: ${earnedPoints}`);

                if (!userEarnings[pick.user_id]) userEarnings[pick.user_id] = 0;
                userEarnings[pick.user_id] += earnedPoints;

                picksToMarkPaid.push(pick.id);
            }
        });

        let depositCount = 0;
        for (const [email, earnings] of Object.entries(userEarnings)) {
            const { data: profileData, error: profileErr } = await supabase
                .from('profiles')
                .select('coins')
                .eq('email', email)
                .limit(1);
            
            const profile = profileData && profileData.length > 0 ? profileData[0] : null;

            if (profileErr || !profile) {
                console.log(`   ❌ ERROR: Could not find profile for [${email}].`);
            } else {
                const newBalance = Math.round((profile.coins || 0) + earnings);
                
                const { error: updateErr } = await supabase.from('profiles').update({ coins: newBalance }).eq('email', email);
                
                if (updateErr) {
                    console.log(`   ❌ ERROR: Failed to update balance for [${email}]. Reason: ${updateErr.message}`);
                } else {
                    console.log(`   🏦 Deposited ${Math.round(earnings)} coins into ${email}'s account. (New Balance: ${newBalance})`);
                    depositCount++;
                }
            }
        }

        if (picksToMarkPaid.length > 0) {
            const { error } = await supabase
                .from('picks')
                .update({ paid_out: true })
                .in('id', picksToMarkPaid);
            
            if (error) console.error("❌ Failed to mark picks as paid.", error.message);
        }

        console.log(`✅ Economy Payout Complete! Processed ${depositCount} winning bettors.\n`);
    } catch (err) {
        console.error("❌ Failed during economy payout:", err.message);
    }
}

async function updateAllUsersLifetimePoints() {
    try {
        console.log("🔄 Recalculating Global Lifetime XP...");
        
        const { data: picks, error: picksError } = await supabase
            .from('picks')
            .select('user_id, fight_id, selected_fighter')
            .not('league_id', 'is', null);

        const { data: stats, error: statsError } = await supabase
            .from('fighter_stats')
            .select('fight_id, fighter_name, fantasy_points');

        if (picksError || statsError) throw new Error("Database fetch error during XP calculation");

        const statMap = {};
        stats.forEach(s => {
            const searchKey = getSearchKey(s.fighter_name);
            statMap[`${s.fight_id}-${searchKey}`] = s.fantasy_points || 0;
        });

        const userFightScores = {};
        
        picks.forEach(pick => {
            const pickKey = getSearchKey(pick.selected_fighter);
            const pointsScored = statMap[`${pick.fight_id}-${pickKey}`] || 0;
            
            if (!userFightScores[pick.user_id]) {
                userFightScores[pick.user_id] = {};
            }
            
            const currentBestForThisFight = userFightScores[pick.user_id][pick.fight_id] || 0;
            if (pointsScored > currentBestForThisFight) {
                userFightScores[pick.user_id][pick.fight_id] = pointsScored;
            }
        });

        const userXP = {};
        for (const [userId, fights] of Object.entries(userFightScores)) {
            userXP[userId] = Object.values(fights).reduce((sum, score) => sum + score, 0);
        }

        let updatedCount = 0;
        for (const [email, totalPoints] of Object.entries(userXP)) {
            const { error } = await supabase
                .from('profiles')
                .update({ lifetime_points: totalPoints })
                .eq('email', email);
            
            if (!error) updatedCount++;
        }

        console.log(`✅ XP Recalculation Complete! Updated ${updatedCount} profiles.`);
    } catch (err) {
        console.error("❌ Failed to update lifetime points:", err.message);
    }
}

async function scrapeAndScoreFight(fightUrl, dbFights) {
    try {
        const { data } = await axios.get(fightUrl, { 
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0' } 
        });
        const $ = cheerio.load(data);
        
        const fighters = [];
        $('.b-fight-details__person-name').each((i, el) => fighters.push($(el).text().trim()));
        if (fighters.length < 2) return;

        const statuses = [];
        $('.b-fight-details__person-status').each((i, el) => statuses.push($(el).text().trim().toUpperCase()));

        let isKO = false;
        let isSub = false;
        let isDec = false; 
        let finishRound = 1;
        let finishTimeSeconds = 999;
        let winMethodStr = ""; 

        $('.b-fight-details__text-item, .b-fight-details__text-item_first').each((i, el) => {
            const text = $(el).text().replace(/\s+/g, ' ').toUpperCase().trim();
            
            if (text.includes('METHOD:')) {
                const parts = text.split('METHOD:');
                if (parts.length > 1) {
                    winMethodStr = parts[1].trim(); 
                }
                if (text.includes('KO/TKO') || text.includes('TKO') || text.includes('KO')) isKO = true;
                if (text.includes('SUB') || text.includes('SUBMISSION')) isSub = true;
                if (text.includes('DEC') || text.includes('DECISION')) isDec = true; 
            }
            if (text.includes('ROUND:') && !text.includes('FORMAT')) {
                const parts = text.split('ROUND:');
                if (parts.length > 1) finishRound = parseInt(parts[1].trim()) || 1;
            }
            if (text.includes('TIME:') && !text.includes('FORMAT')) {
                const parts = text.split('TIME:');
                if (parts.length > 1) {
                    const [m, s] = parts[1].trim().split(':').map(Number);
                    if (!isNaN(m) && !isNaN(s)) finishTimeSeconds = (m * 60) + s;
                }
            }
        });

        const isFinished = statuses.includes('W') || statuses.includes('L') || statuses.includes('NC') || statuses.includes('DRAW') || statuses.includes('D') || winMethodStr.length > 2;

        const tableText = $('.b-fight-details__table').text() || '';
        const hasFightStats = tableText.includes('Sig. str') || tableText.includes('Ctrl') || tableText.includes('Td');

        if (!hasFightStats && !isFinished) {
            console.log(`⏳ Fight hasn't started yet: ${fighters[0]} vs ${fighters[1]} - Skipping...`);
            return; 
        }

        if (!isFinished) {
            console.log(`📡 Fight is Live/Pending: ${fighters[0]} vs ${fighters[1]} - Syncing live stats...`);
        }

        const key1 = getSearchKey(fighters[0]);
        const key2 = getSearchKey(fighters[1]);

        const dbFight = dbFights.find(f => {
            const combinedDbNames = sanitizeForMatch(f.fighter_1_name) + sanitizeForMatch(f.fighter_2_name);
            return combinedDbNames.includes(key1) && combinedDbNames.includes(key2);
        });

        if (!dbFight) return;

        const isUnder30s = finishRound === 1 && finishTimeSeconds <= 30;
        const isLast10sR5 = finishRound === 5 && finishTimeSeconds >= 290; 

        let baseBonus = 0;
        
        if (isLast10sR5 && (isKO || isSub)) {
            baseBonus = 100;
        } 
        else if (isKO) {
            if (isUnder30s) baseBonus = 60;
            else if (finishRound === 1) baseBonus = 35;
            else if (finishRound === 2) baseBonus = 25;
            else if (finishRound === 3) baseBonus = 20; 
            else if (finishRound === 4) baseBonus = 25;
            else if (finishRound === 5) baseBonus = 40; 
        } 
        else if (isSub) {
            if (isUnder30s) baseBonus = 65;
            else if (finishRound === 1) baseBonus = 35;
            else if (finishRound === 2) baseBonus = 25;
            else if (finishRound === 3) baseBonus = 20; 
            else if (finishRound === 4) baseBonus = 25;
            else if (finishRound === 5) baseBonus = 40; 
        }
        else if (isDec) {
            baseBonus = 10;
        }

        const rows = $('.b-fight-details__table-body').first().find('.b-fight-details__table-text');
        const parseStat = (index) => {
            const raw = rows.eq(index).text().trim().split(' of ')[0];
            return parseInt(raw) || 0; 
        };

        let results = fighters.map((name, i) => {
            const kd = parseStat(2 + i);
            const sig_str = parseStat(4 + i);
            const td = parseStat(10 + i);
            const sub_att = parseStat(14 + i);
            
            const ctrlRaw = rows.eq(18 + i).text().trim() || "0:00"; 
            const [m, s] = ctrlRaw.split(':').map(Number);
            const ctrlMinutes = (m || 0) + ((s || 0) / 60);

            let points = (sig_str * 0.25) + (td * 2.5) + (kd * 5) + (sub_att * 3) + (ctrlMinutes * 1.8);
            
            return {
                fight_id: dbFight.id,
                fighter_name: name,
                knockdowns: kd,
                sig_strikes: sig_str,
                takedowns: td,
                sub_attempts: sub_att, 
                control_time_seconds: ((m || 0) * 60) + (s || 0),
                is_winner: statuses[i] === 'W', 
                fantasy_points: points 
            };
        });

        // 🛑 FINISH BONUSES
        const winnerIndex = results.findIndex(r => r.is_winner);
        let finalBonus = 0;
        let wasEqualized = false; 

        if (isFinished && winnerIndex !== -1) {
            const loserIndex = winnerIndex === 0 ? 1 : 0;

            if (baseBonus > 0) {
                const winnerKey = getSearchKey(fighters[winnerIndex]);
                let winnerOdds = 0;

                const f1Clean = sanitizeForMatch(dbFight.fighter_1_name);
                const f2Clean = sanitizeForMatch(dbFight.fighter_2_name);

                if (f1Clean.includes(winnerKey)) {
                    winnerOdds = parseInt(dbFight.fighter_1_odds) || 0;
                } else if (f2Clean.includes(winnerKey)) {
                    winnerOdds = parseInt(dbFight.fighter_2_odds) || 0;
                }

                let oddsMultiplier = 1;

                if (winnerOdds > 0) {
                    oddsMultiplier = winnerOdds / 100;
                } else if (winnerOdds < 0) {
                    oddsMultiplier = 100 / Math.abs(winnerOdds);
                }

                finalBonus = parseFloat((baseBonus * oddsMultiplier).toFixed(2));
                
                if (winnerOdds < 0 && (isKO || isSub)) {
                    finalBonus += 10;
                }

                results[winnerIndex].fantasy_points += finalBonus;
            }

            if (results[winnerIndex].fantasy_points < results[loserIndex].fantasy_points) {
                results[winnerIndex].fantasy_points = results[loserIndex].fantasy_points;
                wasEqualized = true; 
            }
        }

        results.forEach(r => {
            r.fantasy_points = parseFloat(Math.min(r.fantasy_points, 999.99).toFixed(2));
        });

        const { error } = await supabase.from('fighter_stats').upsert(results, { onConflict: 'fight_id, fighter_name' });
        if (error) throw new Error(`Supabase Stats Error: ${error.message}`);
        
        let finalMethodString = winMethodStr; 
        if (isKO || isSub) {
            finalMethodString = `${winMethodStr} R${finishRound}`;
        }

        if (isFinished) {
            let exactDbWinnerName = 'Draw'; 
            let cleanMethod = winMethodStr ? winMethodStr.trim() : (isDec ? 'DEC' : 'UNKNOWN');

            if (statuses.includes('W')) {
                const winnerKey = getSearchKey(fighters[winnerIndex]);
                exactDbWinnerName = fighters[winnerIndex]; 
                
                const f1Clean = sanitizeForMatch(dbFight.fighter_1_name);
                const f2Clean = sanitizeForMatch(dbFight.fighter_2_name);
                
                if (f1Clean.includes(winnerKey)) {
                    exactDbWinnerName = dbFight.fighter_1_name;
                } else if (f2Clean.includes(winnerKey)) {
                    exactDbWinnerName = dbFight.fighter_2_name;
                }
            } else if (statuses.includes('NC') || winMethodStr.includes('NO CONTEST') || winMethodStr.includes('NC')) {
                exactDbWinnerName = 'No Contest';
                cleanMethod = 'NC';
            } else {
                exactDbWinnerName = 'Draw';
                if (!cleanMethod || cleanMethod === 'UNKNOWN') cleanMethod = 'DRAW';
            }

            const { error: updateError } = await supabase.from('fights').update({ 
                winner: exactDbWinnerName,
                method: cleanMethod,
                round: finishRound 
            }).eq('id', dbFight.id);

            if (updateError) {
                console.error(`❌ Failed to update winner for ${exactDbWinnerName}:`, updateError.message);
            }
        }

        let bonusLabel = finalBonus > 0 ? ` (+${finalBonus} True Odds Bonus)` : "";
        let eqLabel = wasEqualized ? ` ⚠️ [EQUALIZER APPLIED]` : "";
        
        if (isFinished) {
            console.log(`✅ Finalized: ${fighters[0]} vs ${fighters[1]} (${statuses.includes('W') ? fighters[winnerIndex] + ' won by ' + finalMethodString + bonusLabel + eqLabel : 'Draw/NC'})`);
        } else {
            console.log(`🔄 Live Stats Saved: ${fighters[0]} [${results[0].fantasy_points} pts] vs ${fighters[1]} [${results[1].fantasy_points} pts]`);
        }
        
    } catch (err) {
        console.error(`❌ Error:`, err.message);
    }
}

scrapeFullCard();