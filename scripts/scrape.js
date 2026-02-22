require('dotenv').config();
const axios = require('axios');
const cheerio = require('cheerio');
const { createClient } = require('@supabase/supabase-js');

console.log("🚀 Script started! If you see this, Node is reading the file.");

// 🛑 REPLACE THESE TWO STRINGS WITH YOUR ACTUAL SUPABASE KEYS
const SUPABASE_URL = 'https://drbegbkxlebmufbnundg.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRyYmVnYmt4bGVibXVmYm51bmRnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTM2MTQxMCwiZXhwIjoyMDg0OTM3NDEwfQ.HRl3MuGLd88XAWXnsLKxvql2e452mfUtkuq1qjAvtbY';
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

        for (const url of fightUrls) {
            await scrapeAndScoreFight(url, dbFights);
            await new Promise(r => setTimeout(r, 2000)); 
        }

        console.log("🏆 Card update complete!");
    } catch (err) {
        console.error("❌ Fatal Event Error:", err.message);
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

        if (!isFinished) {
            console.log(`⏳ Pending: ${fighters[0]} vs ${fighters[1]}`);
            return;
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
        let finishRound = 1;
        let finishTimeSeconds = 999;
        let winMethodStr = ""; // 🎯 NEW: Hold the exact method text

        $('.b-fight-details__text-item, .b-fight-details__text-item_first').each((i, el) => {
            const text = $(el).text().replace(/\s+/g, ' ').toUpperCase().trim();
            
            if (text.includes('METHOD:')) {
                const parts = text.split('METHOD:');
                if (parts.length > 1) {
                    winMethodStr = parts[1].trim(); // e.g., "KO/TKO", "U-DEC", "SUB"
                }
                if (text.includes('KO/TKO') || text.includes('TKO') || text.includes('KO')) isKO = true;
                if (text.includes('SUB') || text.includes('SUBMISSION')) isSub = true;
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

        // 🎯 BASE GRANULAR BONUS MATH
        let baseFinishBonus = 0;
        
        if (isLast10sR5 && (isKO || isSub)) {
            baseFinishBonus = 100;
        } 
        else if (isKO) {
            if (isUnder30s) baseFinishBonus = 60;
            else if (finishRound === 1) baseFinishBonus = 35;
            else if (finishRound === 2) baseFinishBonus = 25;
            else if (finishRound === 3) baseFinishBonus = 20;
            else if (finishRound === 4) baseFinishBonus = 25;
            else if (finishRound === 5) baseFinishBonus = 40; 
        } 
        else if (isSub) {
            if (isUnder30s) baseFinishBonus = 65;
            else if (finishRound === 1) baseFinishBonus = 35;
            else if (finishRound === 2) baseFinishBonus = 25;
            else if (finishRound === 3) baseFinishBonus = 20;
            else if (finishRound === 4) baseFinishBonus = 25;
            else if (finishRound === 5) baseFinishBonus = 40; 
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

        // 🎯 THE FAIR PLAY ODDS ENGINE
        const winnerIndex = results.findIndex(r => r.is_winner);
        let finalFinishBonus = 0;

        if (winnerIndex !== -1) {
            const loserIndex = winnerIndex === 0 ? 1 : 0;

            if (baseFinishBonus > 0) {
                const winnerCore = getCoreName(fighters[winnerIndex]);
                let winnerOdds = 0;

                if (dbFight.fighter_1_name && dbFight.fighter_1_name.toLowerCase().includes(winnerCore)) {
                    winnerOdds = parseInt(dbFight.fighter_1_odds) || 0;
                } else if (dbFight.fighter_2_name && dbFight.fighter_2_name.toLowerCase().includes(winnerCore)) {
                    winnerOdds = parseInt(dbFight.fighter_2_odds) || 0;
                }

                let oddsMultiplier = 1;

                if (winnerOdds > 0) {
                    oddsMultiplier = 1 + (winnerOdds / 1000);
                } else if (winnerOdds < 0) {
                    oddsMultiplier = Math.max(0.5, 1 - (Math.abs(winnerOdds) / 1000));
                }

                finalFinishBonus = parseFloat((baseFinishBonus * oddsMultiplier).toFixed(2));
                results[winnerIndex].fantasy_points += finalFinishBonus;
            }

            // Equalizer
            if (results[winnerIndex].fantasy_points < results[loserIndex].fantasy_points) {
                results[winnerIndex].fantasy_points = results[loserIndex].fantasy_points;
            }
        }

        results.forEach(r => {
            r.fantasy_points = parseFloat(Math.min(r.fantasy_points, 999.99).toFixed(2));
        });

        const { error } = await supabase.from('fighter_stats').upsert(results, { onConflict: 'fight_id, fighter_name' });
        if (error) throw new Error(`Supabase Stats Error: ${error.message}`);
        
        // 🎯 NEW: Save the actual method to the Fights table
        if (statuses.includes('W')) {
            const winnerName = fighters[winnerIndex];
            await supabase.from('fights').update({ 
                winner: winnerName,
                method: winMethodStr 
            }).eq('id', dbFight.id);
        }

        let finishLabel = finalFinishBonus > 0 ? ` (+${finalFinishBonus} Bonus)` : "";
        console.log(`✅ Synced: ${fighters[0]} vs ${fighters[1]} (${statuses.includes('W') ? fighters[winnerIndex] + ' won by ' + winMethodStr + finishLabel : 'Draw/NC'})`);
        
        if (isKO || isSub) {
            console.log(`   ➔ Detected: ${isKO ? 'KO' : 'SUB'} in Round ${finishRound} at ${finishTimeSeconds}s`);
            if (isLast10sR5) console.log(`   🚨 BUZZER BEATER JACKPOT TRIGGERED! 🚨`);
        }

    } catch (err) {
        console.error(`❌ Error:`, err.message);
    }
}

scrapeFullCard();