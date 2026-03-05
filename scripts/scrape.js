require('dotenv').config();
const axios = require('axios');
const cheerio = require('cheerio');
const { createClient } = require('@supabase/supabase-js');

console.log("🚀 Script started! If you see this, Node is reading the file.");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

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

        // 1. Scrape Results & Stats
        for (const url of fightUrls) {
            await scrapeAndScoreFight(url, dbFights);
            await new Promise(r => setTimeout(r, 2000)); 
        }

        // 2. Update League Leaderboard XP (Now supports LIVE updating!)
        await updateAllUsersLifetimePoints();

        // 3. 🎯 PROCESS COIN PAYOUTS
        await processEconomyPayouts();

        console.log("🏆 Card update complete!");
    } catch (err) {
        console.error("❌ Fatal Event Error:", err.message);
    }
}

// 🎯 The Global Coin Payout Engine
async function processEconomyPayouts() {
    try {
        console.log("💰 Processing Global Economy Payouts...");

        const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
        const { data: recentFights, error: fightError } = await supabase
            .from('fights')
            .select('id, winner')
            .not('winner', 'is', null) // Only grabs fights that are officially FINISHED
            .gte('start_time', fourteenDaysAgo);

        if (fightError || !recentFights) throw new Error("Could not fetch recent fights.");

        const { data: unpaidPicks, error: picksError } = await supabase
            .from('picks')
            .select('id, user_id, fight_id, selected_fighter, odds_at_pick')
            .is('league_id', null)
            .is('paid_out', false);

        if (picksError) {
            console.error("❌ Error fetching picks. Did you add the 'paid_out' boolean column to your 'picks' table?");
            return;
        }

        if (!unpaidPicks || unpaidPicks.length === 0) {
            console.log("✅ No pending payouts found.");
            return;
        }

        const userEarnings = {};
        const picksToMarkPaid = [];

        unpaidPicks.forEach(pick => {
            const fight = recentFights.find(f => f.id === pick.fight_id);
            if (fight && fight.winner && fight.winner === pick.selected_fighter) {
                const numericOdds = parseInt(pick.odds_at_pick, 10);
                if (!isNaN(numericOdds) && numericOdds !== 0) {
                    let profit = 0;
                    if (numericOdds > 0) {
                        profit = (numericOdds / 100) * 10;
                    } else {
                        profit = (100 / Math.abs(numericOdds)) * 10;
                    }
                    const totalPayout = parseFloat((profit + 10).toFixed(1));

                    if (!userEarnings[pick.user_id]) userEarnings[pick.user_id] = 0;
                    userEarnings[pick.user_id] += totalPayout;
                }
            }
            
            if (fight && fight.winner) {
                picksToMarkPaid.push(pick.id);
            }
        });

        let depositCount = 0;
        for (const [email, earnings] of Object.entries(userEarnings)) {
            const { data: profile } = await supabase.from('profiles').select('coins').eq('email', email).single();
            if (profile) {
                const newBalance = (profile.coins || 0) + earnings;
                const { error } = await supabase.from('profiles').update({ coins: newBalance }).eq('email', email);
                if (!error) {
                    console.log(`   💸 Paid ${earnings} coins to ${email}`);
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

        console.log(`✅ Economy Payout Complete! Processed ${depositCount} winning bettors.`);
    } catch (err) {
        console.error("❌ Failed during economy payout:", err.message);
    }
}

// 🎯 The Idempotent XP Engine
async function updateAllUsersLifetimePoints() {
    try {
        console.log("🔄 Recalculating Lifetime XP for all users...");
        
        const { data: picks, error: picksError } = await supabase
            .from('picks')
            .select('user_id, fight_id, selected_fighter')
            .not('league_id', 'is', null);

        const { data: stats, error: statsError } = await supabase
            .from('fighter_stats')
            .select('fight_id, fighter_name, fantasy_points');

        if (picksError || statsError) throw new Error("Database fetch error during XP calculation");

        const getCoreName = (name) => {
            if (!name) return "";
            const parts = name.trim().split(' ');
            return parts[parts.length - 1].replace(/[^a-zA-Z]/g, '').toLowerCase().substring(0, 4);
        };

        const statMap = {};
        stats.forEach(s => {
            const coreName = getCoreName(s.fighter_name);
            statMap[`${s.fight_id}-${coreName}`] = s.fantasy_points || 0;
        });

        const userFightScores = {};
        
        picks.forEach(pick => {
            const corePick = getCoreName(pick.selected_fighter);
            const pointsScored = statMap[`${pick.fight_id}-${corePick}`] || 0;
            
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
        
        const isFinished = statuses.includes('W') || statuses.includes('L') || statuses.includes('NC') || statuses.includes('D');

        // 🎯 THE FIX: Instead of returning early, we let the script continue so it can grab live stats
        if (!isFinished) {
            console.log(`📡 Fight is Live/Pending: ${fighters[0]} vs ${fighters[1]} - Syncing live stats...`);
        }

        const getCoreName = (name) => {
            const parts = name.trim().split(' ');
            const last = parts[parts.length - 1].replace(/[^a-zA-Z]/g, '').toLowerCase();
            return last.substring(0, 4); 
        };

        const core1 = getCoreName(fighters[0]);
        const core2 = getCoreName(fighters[1]);

        const dbFight = dbFights.find(f => {
            const dbNamesStr = `${f.fighter_1_name} ${f.fighter_2_name}`.toLowerCase().replace(/[^a-z ]/g, '');
            return dbNamesStr.includes(core1) && dbNamesStr.includes(core2);
        });

        if (!dbFight) return;

        // 🛑 FINISH DETECTION & ROUND TIMING
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
                if (parts.length > 1) {
                    finishRound = parseInt(parts[1].trim()) || 1;
                }
            }
            if (text.includes('TIME:') && !text.includes('FORMAT')) {
                const parts = text.split('TIME:');
                if (parts.length > 1) {
                    const [m, s] = parts[1].trim().split(':').map(Number);
                    if (!isNaN(m) && !isNaN(s)) {
                        finishTimeSeconds = (m * 60) + s;
                    }
                }
            }
        });

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
            return parseInt(raw) || 0; // Gracefully handles empty tables (0 points)
        };

        // Calculate points based on what has happened so far
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

        // 🛑 FINISH BONUSES - Only trigger if the fight is actually over
        const winnerIndex = results.findIndex(r => r.is_winner);
        let finalBonus = 0;
        let wasEqualized = false; 

        if (isFinished && winnerIndex !== -1) {
            const loserIndex = winnerIndex === 0 ? 1 : 0;

            if (baseBonus > 0) {
                const winnerCore = getCoreName(fighters[winnerIndex]);
                let winnerOdds = 0;

                if (dbFight.fighter_1_name && dbFight.fighter_1_name.toLowerCase().includes(winnerCore)) {
                    winnerOdds = parseInt(dbFight.fighter_1_odds) || 0;
                } else if (dbFight.fighter_2_name && dbFight.fighter_2_name.toLowerCase().includes(winnerCore)) {
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

            // The Equalizer (Only applies at the end of the fight)
            if (results[winnerIndex].fantasy_points < results[loserIndex].fantasy_points) {
                results[winnerIndex].fantasy_points = results[loserIndex].fantasy_points;
                wasEqualized = true; 
            }
        }

        results.forEach(r => {
            r.fantasy_points = parseFloat(Math.min(r.fantasy_points, 999.99).toFixed(2));
        });

        // Upsert the live (or final) stats into the database
        const { error } = await supabase.from('fighter_stats').upsert(results, { onConflict: 'fight_id, fighter_name' });
        if (error) throw new Error(`Supabase Stats Error: ${error.message}`);
        
        let finalMethodString = winMethodStr; 
        if (isKO || isSub) {
            finalMethodString = `${winMethodStr} R${finishRound}`;
        }

        // Only update the actual fight winner if it's over
        if (isFinished && statuses.includes('W')) {
            const winnerCore = getCoreName(fighters[winnerIndex]);
            let exactDbWinnerName = fighters[winnerIndex]; 
            
            if (dbFight.fighter_1_name && dbFight.fighter_1_name.toLowerCase().includes(winnerCore)) {
                exactDbWinnerName = dbFight.fighter_1_name;
            } else if (dbFight.fighter_2_name && dbFight.fighter_2_name.toLowerCase().includes(winnerCore)) {
                exactDbWinnerName = dbFight.fighter_2_name;
            }

            const cleanMethod = winMethodStr ? winMethodStr.trim() : (isDec ? 'DEC' : 'UNKNOWN');

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