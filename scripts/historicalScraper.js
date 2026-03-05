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

// 🎯 THE NAME DICTIONARY
const NAME_DICTIONARY = {
    "Javier Reyes Rugeles": "Javier Reyes",
    "Joseph Pyfer": "Joe Pyfer",
    "Long Xiao": "Xiao Long",
    "Sergey Spivak": "Serghei Spivac",
    "Sulangrangbo": "Sulangrangbo", 
    "Sumudaerji Sumudaerji": "Su Mudaerji",
    "Yi Zha": "Yizha"
};

// 🎯 THE FIX: SQUASH NAMES TO IGNORE SPACES AND PUNCTUATION
const squashName = (name) => {
    if (!name) return "";
    return name.toLowerCase().replace(/[^a-z]/g, '');
};

// 1. GOD MODE PROFILE SEARCH 
async function searchFighterProfile(fighterName) {
    console.log(`🔍 Searching for ${fighterName.trim()}...`);
    
    const targetClean = squashName(fighterName);
    const nameParts = fighterName.trim().toLowerCase().split(/\s+/); 
    
    const dbFirst = nameParts[0];
    const dbLast = nameParts[nameParts.length - 1]; 
    
    // Helper to evaluate rows regardless of which URL we are checking
    const checkRows = (html) => {
        const $ = cheerio.load(html);
        let foundUrl = null;
        $('.b-statistics__table-row').each((i, el) => {
            if (i === 0) return; 
            
            const fName = $(el).find('td').eq(0).text().trim();
            const lName = $(el).find('td').eq(1).text().trim();
            const siteClean = squashName(fName + lName);
            
            // 🎯 If the names match perfectly when squashed, we found them!
            if (siteClean === targetClean || 
               (siteClean.length > 5 && targetClean.includes(siteClean)) || 
               (targetClean.length > 5 && siteClean.includes(targetClean))) {
                foundUrl = $(el).find('.b-link_style_black').first().attr('href');
                return false; // Break loop
            }
        });
        return foundUrl;
    };

    // First attempt: Search by Last Name
    const url = `http://ufcstats.com/statistics/fighters/search?query=${encodeURIComponent(dbLast)}&page=all`;
    const { data } = await axios.get(url, REQUEST_HEADERS);
    let profileUrl = checkRows(data);

    // Second attempt: Search by First Name (Catches fighters like Sumudaerji where last name is blank)
    if (!profileUrl) {
        const backupUrl = `http://ufcstats.com/statistics/fighters/search?query=${encodeURIComponent(dbFirst)}&page=all`;
        const { data: backupData } = await axios.get(backupUrl, REQUEST_HEADERS);
        profileUrl = checkRows(backupData);
    }

    if (!profileUrl) {
        throw new Error(`Could not find a UFC Stats profile for ${fighterName}.`);
    }
    
    return profileUrl;
}

// 🎯 Grab the official headshot
async function getFighterImage(fighterName) {
    try {
        const formattedName = fighterName.trim().toLowerCase().replace(/\s+/g, '-').replace(/[łŁ]/g, 'l');
        const url = `https://www.ufc.com/athlete/${formattedName}`;
        
        const { data } = await axios.get(url, REQUEST_HEADERS);
        const $ = cheerio.load(data);
        
        return $('.hero-profile__image').attr('src') || null;
    } catch (err) {
        return null;
    }
}

// 2. GET FIGHT URLS AND EXTRACT PROFILE STATS
async function getFighterProfileData(profileUrl) {
    const { data } = await axios.get(profileUrl, REQUEST_HEADERS);
    const $ = cheerio.load(data);
    
    const fightUrls = [];
    $('.b-fight-details__table-row').each((i, el) => {
        const link = $(el).attr('data-link');
        if (link) fightUrls.push(link);
    });
    
    const nickname = $('.b-content__Nickname').text().trim().replace(/^["'](.+)["']$/, '$1') || null;
    const record = $('.b-content__title-record').text().replace('Record:', '').trim() || '0-0-0';
    
    let height = '--', weight = '--', reach = '--', dob = '--';
    let slpm = 0, tdAvg = 0, kdAvg = 0;
    let strAcc = 0, tdAcc = 0, tdDef = 0;

    $('.b-list__box-list-item').each((i, el) => {
        const text = $(el).text().replace(/\s+/g, ' ').trim();
        if (text.includes('Height:')) height = text.replace('Height:', '').trim();
        if (text.includes('Weight:')) weight = text.replace('Weight:', '').trim(); 
        if (text.includes('Reach:')) reach = text.replace('Reach:', '').trim();
        if (text.includes('DOB:')) dob = text.replace('DOB:', '').trim();
        
        if (text.includes('SLpM:')) slpm = parseFloat(text.replace('SLpM:', '').trim()) || 0;
        if (text.includes('Td. Avg.:') || text.includes('TD Avg.:')) tdAvg = parseFloat(text.replace(/Td\. Avg\.:|TD Avg\.:/i, '').trim()) || 0;
        if (text.includes('KD Avg.:')) kdAvg = parseFloat(text.replace('KD Avg.:', '').trim()) || 0;
        
        if (text.includes('Str. Acc.:')) strAcc = parseFloat(text.replace('Str. Acc.:', '').replace('%', '').trim()) || 0;
        if (text.includes('TD Acc.:')) tdAcc = parseFloat(text.replace('TD Acc.:', '').replace('%', '').trim()) || 0;
        if (text.includes('TD Def.:')) tdDef = parseFloat(text.replace('TD Def.:', '').replace('%', '').trim()) || 0;
    });

    let age = null;
    if (dob && dob !== '--') {
        const birthDate = new Date(dob);
        const today = new Date();
        age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--; 
    }

    return { 
        fightUrls, 
        stats: { nickname, record, age, height, weight, reach, slpm, tdAvg, kdAvg, strAcc, tdAcc, tdDef } 
    };
}

// 3. SCORE FIGHT (NOW RETURNS SEPARATED BUCKETS)
async function scoreHistoricalFight(fightUrl, targetFighterName) {
    try {
        const { data } = await axios.get(fightUrl, REQUEST_HEADERS);
        const $ = cheerio.load(data);
        
        const fighters = [];
        $('.b-fight-details__person-name').each((i, el) => fighters.push($(el).text().trim()));
        if (fighters.length < 2) return null;

        const targetClean = squashName(targetFighterName);

        // 🎯 THE FIX: Applying the squash match to the scorecard check
        const targetIndex = fighters.findIndex(f => {
            const siteClean = squashName(f);
            return siteClean === targetClean || 
                   (siteClean.length > 4 && targetClean.includes(siteClean)) || 
                   (targetClean.length > 4 && siteClean.includes(targetClean));
        });

        if (targetIndex === -1) return null; 
        
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

            // 🎯 SPLITTING THE BUCKETS HERE
            let strPts = (sig_str * 0.25) + (kd * 5);
            let grapPts = (td * 2.5) + (sub_att * 3) + (ctrlMinutes * 1.8);
            let totalBase = strPts + grapPts;
            
            return { 
                is_winner: statuses[i] === 'W', 
                fantasy_points: totalBase,
                striking_points: strPts,
                grappling_points: grapPts
            };
        });

        const winnerIndex = results.findIndex(r => r.is_winner);
        if (winnerIndex !== -1) {
            const loserIndex = winnerIndex === 0 ? 1 : 0;
            // Note: In historical tracking, we apply the base bonus as 1x since odds aren't easily scraped here.
            results[winnerIndex].fantasy_points += baseBonus; 
            
            if (results[winnerIndex].fantasy_points < results[loserIndex].fantasy_points) {
                results[winnerIndex].fantasy_points = results[loserIndex].fantasy_points;
            }
        }

        // 🎯 RETURN ALL THREE METRICS
        return {
            total: parseFloat(Math.min(results[targetIndex].fantasy_points, 999.99).toFixed(2)),
            striking: parseFloat(results[targetIndex].striking_points.toFixed(2)),
            grappling: parseFloat(results[targetIndex].grappling_points.toFixed(2))
        };

    } catch (err) {
        console.error(`❌ Fight Error:`, err.message);
        return null;
    }
}

// 4. PROCESS FIGHTER
async function processFighter(fighterName) {
    try {
        const trimmedName = fighterName.trim();
        
        let searchName = trimmedName;
        if (NAME_DICTIONARY[trimmedName]) {
            searchName = NAME_DICTIONARY[trimmedName];
        }

        const profileUrl = await searchFighterProfile(searchName);
        const { fightUrls, stats } = await getFighterProfileData(profileUrl);
        const imageUrl = await getFighterImage(searchName);
        
        console.log(`🥊 Scoring ${fightUrls.length} career fights for ${trimmedName}...`);

        let totalPoints = 0;
        let totalStriking = 0;
        let totalGrappling = 0;
        let fightsScored = 0;

        for (let i = 0; i < fightUrls.length; i++) {
            const scoreData = await scoreHistoricalFight(fightUrls[i], searchName);
            if (scoreData !== null) {
                totalPoints += scoreData.total;
                totalStriking += scoreData.striking;
                totalGrappling += scoreData.grappling;
                fightsScored++;
            }
            await new Promise(r => setTimeout(r, 1500)); 
        }

        // 🎯 CALCULATE THE AVERAGES
        const avgTotal = fightsScored === 0 ? 0 : parseFloat((totalPoints / fightsScored).toFixed(2));
        const avgStriking = fightsScored === 0 ? 0 : parseFloat((totalStriking / fightsScored).toFixed(2));
        const avgGrappling = fightsScored === 0 ? 0 : parseFloat((totalGrappling / fightsScored).toFixed(2));
        
        console.log(`🏆 ${trimmedName.toUpperCase()} -> AVG TOTAL: ${avgTotal} | STR: ${avgStriking} | GRAP: ${avgGrappling}\n`);

        const { error } = await supabase
            .from('fighter_historical_stats')
            .upsert({
                fighter_name: trimmedName,
                average_fantasy_points: avgTotal,
                avg_striking_points: avgStriking,
                avg_grappling_points: avgGrappling,
                total_fights_scored: fightsScored,
                total_points: parseFloat(totalPoints.toFixed(2)),
                nickname: stats.nickname,
                record: stats.record,
                age: stats.age,
                height: stats.height,
                weight: stats.weight,
                reach: stats.reach,
                sig_strikes_per_min: stats.slpm,
                takedown_avg: stats.tdAvg,
                knockdown_avg: stats.kdAvg,
                striking_accuracy: stats.strAcc, 
                takedown_accuracy: stats.tdAcc,  
                takedown_defense: stats.tdDef,   
                image_url: imageUrl,
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
    
    // 1. Get all fighters from scheduled/past fights
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

    const allFighters = Array.from(fighterSet);

    // 2. Fetch existing stats to see who is missing an age
    console.log("📥 Checking existing historical stats for missing ages...");
    const { data: existingStats, error: statsError } = await supabase
        .from('fighter_historical_stats')
        .select('fighter_name, age'); // 🎯 Fetching age this time

    if (statsError) {
        console.error("❌ Failed to fetch historical stats:", statsError.message);
        return;
    }

    // 3. Filter: Only keep fighters with null/undefined age, or who are completely missing
    const fightersToProcess = allFighters.filter(fighterName => {
        const statRecord = existingStats.find(s => s.fighter_name.toLowerCase() === fighterName.toLowerCase());
        
        // If they don't exist yet, OR if their age is null/missing, we need to scrape them
        return !statRecord || statRecord.age === null || statRecord.age === undefined;
    });

    console.log(`📋 Found ${allFighters.length} total fighters attached to fights.`);
    console.log(`⏩ Skipping fighters with existing age data...`);
    console.log(`🎯 ${fightersToProcess.length} fighters missing age data. Commencing Historical Backfill...\n`);

    for (const fighter of fightersToProcess) {
        await processFighter(fighter);
        console.log("⏳ Resting 3 seconds before next fighter to avoid IP bans...");
        await new Promise(r => setTimeout(r, 3000));
    }
    
    console.log("🎉 ALL FIGHTERS UPDATED WITH MISSING DATA!");
}

runBatch();