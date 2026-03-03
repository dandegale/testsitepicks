// Tell dotenv to check both .env and .env.local just in case
require('dotenv').config({ path: '.env.local' });
require('dotenv').config(); 

const axios = require('axios');
const cheerio = require('cheerio');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("❌ ERROR: Missing Supabase URL or Key.");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const REQUEST_HEADERS = {
    headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' 
    }
};

// 1. BULLETPROOF PROFILE SEARCH
async function searchFighterProfile(fighterName) {
    console.log(`🔍 Searching for ${fighterName.trim()}...`);
    
    const cleanName = fighterName.trim().toLowerCase().replace(/-/g, ' ').replace(/[łŁ]/g, 'l');
    const nameParts = cleanName.split(/\s+/); 
    
    const firstInitial = nameParts[0][0]; 
    const lastWord1 = nameParts.length > 1 ? nameParts[1].substring(0, 4) : '';
    const lastWord2 = nameParts.length > 2 ? nameParts[2].substring(0, 4) : '';
    
    const url = `http://ufcstats.com/statistics/fighters/search?query=${encodeURIComponent(nameParts[1] || nameParts[0])}`;
    
    const { data } = await axios.get(url, REQUEST_HEADERS);
    const $ = cheerio.load(data);
    
    let profileUrl = null;
    
    $('.b-statistics__table-row').each((i, el) => {
        if (i === 0) return; 
        const rowText = $(el).text().toLowerCase().replace(/-/g, ' ').replace(/[łŁ]/g, 'l');
        
        const hasFirst = rowText.includes(firstInitial);
        const hasLast = (lastWord1 && rowText.includes(lastWord1)) || (lastWord2 && rowText.includes(lastWord2));
        
        if (hasFirst && hasLast) {
            profileUrl = $(el).find('.b-link_style_black').attr('href');
            return false; 
        }
    });

    if (!profileUrl) {
        profileUrl = $('.b-link_style_black').first().attr('href');
    }

    if (!profileUrl) {
        throw new Error(`Could not find a UFC Stats profile for ${fighterName}.`);
    }
    
    return profileUrl;
}

// 2. GET FIGHT URLS
async function getFighterFightUrls(profileUrl) {
    const { data } = await axios.get(profileUrl, REQUEST_HEADERS);
    const $ = cheerio.load(data);
    
    const fightUrls = [];
    $('.b-fight-details__table-row').each((i, el) => {
        const link = $(el).attr('data-link');
        if (link) fightUrls.push(link);
    });
    
    return fightUrls;
}

// 3. SCORE FIGHT WITH BULLETPROOF NAME MATCHING
async function scoreHistoricalFight(fightUrl, targetFighterName) {
    try {
        const { data } = await axios.get(fightUrl, REQUEST_HEADERS);
        const $ = cheerio.load(data);
        
        const fighters = [];
        $('.b-fight-details__person-name').each((i, el) => fighters.push($(el).text().trim()));
        if (fighters.length < 2) return null;

        const cleanName = targetFighterName.trim().toLowerCase().replace(/-/g, ' ').replace(/[łŁ]/g, 'l');
        const nameParts = cleanName.split(/\s+/);
        
        const targetFirstInitial = nameParts[0][0];
        const lastWord1 = nameParts.length > 1 ? nameParts[1].substring(0, 4) : '';
        const lastWord2 = nameParts.length > 2 ? nameParts[2].substring(0, 4) : '';

        const targetIndex = fighters.findIndex(f => {
            const fLower = f.toLowerCase().replace(/-/g, ' ').replace(/[łŁ]/g, 'l');
            const hasFirst = fLower.includes(targetFirstInitial);
            const hasLast = (lastWord1 && fLower.includes(lastWord1)) || (lastWord2 && fLower.includes(lastWord2));
            return hasFirst && hasLast;
        });

        if (targetIndex === -1) {
            console.log(`   ⚠️ Mismatch in bout: Looking for ${targetFighterName.trim()}, but found [${fighters.join(' vs ')}]`);
            return null; 
        }
        
        const opponentIndex = targetIndex === 0 ? 1 : 0;
        const statuses = [];
        $('.b-fight-details__person-status').each((i, el) => statuses.push($(el).text().trim().toUpperCase()));
        
        const isFinished = statuses.includes('W') || statuses.includes('L') || statuses.includes('NC') || statuses.includes('D');
        if (!isFinished) return null;

        let isKO = false, isSub = false, isDec = false;
        let finishRound = 1, finishTimeSeconds = 999;

        $('.b-fight-details__text-item, .b-fight-details__text-item_first').each((i, el) => {
            const text = $(el).text().replace(/\s+/g, ' ').toUpperCase().trim();
            if (text.includes('METHOD:')) {
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

        const isUnder30s = finishRound === 1 && finishTimeSeconds <= 30;
        const isLast10sR5 = finishRound === 5 && finishTimeSeconds >= 290; 
        let baseBonus = 0;
        
        if (isLast10sR5 && (isKO || isSub)) baseBonus = 100;
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
        else if (isDec) baseBonus = 10;

        const rows = $('.b-fight-details__table-body').first().find('.b-fight-details__table-text');
        const parseStat = (index) => parseInt(rows.eq(index).text().trim().split(' of ')[0]) || 0;

        let results = fighters.map((name, i) => {
            const kd = parseStat(2 + i);
            const sig_str = parseStat(4 + i);
            const td = parseStat(10 + i);
            const sub_att = parseStat(14 + i);
            
            const ctrlRaw = rows.eq(18 + i).text().trim() || "0:00"; 
            const [m, s] = ctrlRaw.split(':').map(Number);
            const ctrlMinutes = (m || 0) + ((s || 0) / 60);

            let points = (sig_str * 0.25) + (td * 2.5) + (kd * 5) + (sub_att * 3) + (ctrlMinutes * 1.8);
            
            return { is_winner: statuses[i] === 'W', fantasy_points: points };
        });

        const winnerIndex = results.findIndex(r => r.is_winner);
        if (winnerIndex !== -1) {
            const loserIndex = winnerIndex === 0 ? 1 : 0;
            results[winnerIndex].fantasy_points += baseBonus;
            
            if (results[winnerIndex].fantasy_points < results[loserIndex].fantasy_points) {
                results[winnerIndex].fantasy_points = results[loserIndex].fantasy_points;
            }
        }

        return parseFloat(Math.min(results[targetIndex].fantasy_points, 999.99).toFixed(2));

    } catch (err) {
        console.error(`❌ Fight Error:`, err.message);
        return null;
    }
}

// 4. PROCESS FIGHTER
async function processFighter(fighterName) {
    try {
        const trimmedName = fighterName.trim();
        const profileUrl = await searchFighterProfile(trimmedName);
        console.log(`✅ Found profile: ${profileUrl}`);

        const fightUrls = await getFighterFightUrls(profileUrl);
        console.log(`🥊 Found ${fightUrls.length} career fights. Commencing scrape...`);

        let totalPoints = 0;
        let fightsScored = 0;

        for (let i = 0; i < fightUrls.length; i++) {
            const points = await scoreHistoricalFight(fightUrls[i], trimmedName);
            if (points !== null) {
                console.log(`   ↳ Fight ${i + 1}: Scored ${points} pts`);
                totalPoints += points;
                fightsScored++;
            }
            await new Promise(r => setTimeout(r, 1500)); 
        }

        const average = fightsScored === 0 ? 0 : parseFloat((totalPoints / fightsScored).toFixed(2));
        
        console.log(`\n📊 FINAL: ${trimmedName.toUpperCase()} -> AVG: ${average} (across ${fightsScored} fights)`);

        const { error } = await supabase
            .from('fighter_historical_stats')
            .upsert({
                fighter_name: trimmedName,
                average_fantasy_points: average,
                total_fights_scored: fightsScored,
                total_points: parseFloat(totalPoints.toFixed(2)),
                last_updated: new Date().toISOString()
            }, { onConflict: 'fighter_name' });

        if (error) {
            console.error(`❌ Supabase Save Error for ${trimmedName}:`, error.message);
        } else {
            console.log(`💾 Successfully saved to database!\n`);
        }

    } catch (error) {
        console.error(`❌ Process Failed for ${fighterName}:`, error.message);
    }
}

// 5. BATCH RUNNER
async function runBatch() {
    console.log("📥 Fetching current fighters from your database...");
    
    const { data: fights, error: fightsError } = await supabase
        .from('fights')
        .select('fighter_1_name, fighter_2_name');

    if (fightsError || !fights) {
        console.error("❌ Failed to fetch fights from Supabase:", fightsError?.message);
        return;
    }

    const fighterSet = new Set();
    fights.forEach(fight => {
        if (fight.fighter_1_name) fighterSet.add(fight.fighter_1_name.trim());
        if (fight.fighter_2_name) fighterSet.add(fight.fighter_2_name.trim());
    });

    console.log("📥 Checking which fighters we've already scraped...");
    const { data: existingStats, error: statsError } = await supabase
        .from('fighter_historical_stats')
        .select('fighter_name, average_fantasy_points');

    if (statsError) {
        console.error("❌ Failed to fetch existing stats:", statsError.message);
        return;
    }

    const alreadyScraped = new Set();
    
    // 🎯 THE FIX: Explicitly parse as float and check if > 0
    existingStats.forEach(stat => {
        const avg = parseFloat(stat.average_fantasy_points);
        if (!isNaN(avg) && avg > 0) {
            alreadyScraped.add(stat.fighter_name.trim());
        }
    });

    const fightersToProcess = Array.from(fighterSet).filter(fighter => !alreadyScraped.has(fighter));

    const skippedCount = fighterSet.size - fightersToProcess.length;
    console.log(`⏭️  Skipping ${skippedCount} fighters who already have a valid score > 0.`);
    console.log(`📋 ${fightersToProcess.length} fighters left to process (including zeroes). Starting scrape...\n`);

    if (fightersToProcess.length === 0) {
        console.log("🎉 ALL CAUGHT UP! No new fighters to scrape.");
        return;
    }

    for (const fighter of fightersToProcess) {
        await processFighter(fighter);
        console.log("⏳ Resting 5 seconds before next fighter to avoid IP bans...");
        await new Promise(r => setTimeout(r, 5000));
    }
    
    console.log("🎉 ALL NEW FIGHTERS PROCESSED AND SAVED TO DB!");
}

runBatch();