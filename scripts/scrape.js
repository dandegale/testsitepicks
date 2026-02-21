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

        console.log(`🥊 Found ${fightUrls.length} fights. Checking results...`);

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

        // 🛑 WINNER DETECTION 🛑
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

        const rows = $('.b-fight-details__table-body').first().find('.b-fight-details__table-text');
        const parseStat = (index) => {
            const raw = rows.eq(index).text().trim().split(' of ')[0];
            return parseInt(raw) || 0;
        };

        const results = fighters.map((name, i) => {
            const kd = parseStat(2 + i);
            const sig_str = parseStat(4 + i);
            const td = parseStat(10 + i);
            const ctrlRaw = rows.eq(18 + i).text().trim() || "0:00"; 
            const [m, s] = ctrlRaw.split(':').map(Number);
            const ctrlMinutes = (m || 0) + ((s || 0) / 60);

            let points = (sig_str * 0.5) + (td * 5) + (kd * 10) + (ctrlMinutes * 3);
            
            return {
                fight_id: dbFight.id,
                fighter_name: name,
                knockdowns: kd,
                sig_strikes: sig_str,
                takedowns: td,
                control_time_seconds: ((m || 0) * 60) + (s || 0),
                is_winner: statuses[i] === 'W', // 🎯 SETS WINNER BOOLEAN
                fantasy_points: parseFloat(Math.min(points, 999).toFixed(2))
            };
        });

        const { error } = await supabase.from('fighter_stats').upsert(results, { onConflict: 'fight_id, fighter_name' });
        
        // 🎯 ALSO UPDATE THE MAIN FIGHTS TABLE WITH THE WINNER NAME
        if (!error && statuses.includes('W')) {
            const winnerIndex = statuses.indexOf('W');
            const winnerName = fighters[winnerIndex];
            await supabase.from('fights').update({ winner: winnerName }).eq('id', dbFight.id);
        }

        console.log(`✅ Synced: ${fighters[0]} vs ${fighters[1]} (${statuses.includes('W') ? fighters[statuses.indexOf('W')] + ' won' : 'Draw/NC'})`);

    } catch (err) {
        console.error(`❌ Error:`, err.message);
    }
}

scrapeFullCard();