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
// If the UFC spells a name differently than your database, add it here!
const NAME_DICTIONARY = {
    "Javier Reyes Rugeles": "Javier Reyes",
    "Joseph Pyfer": "Joe Pyfer",
    "Long Xiao": "Xiao Long",
    "Sergey Spivak": "Serghei Spivac",
    "Sulangrangbo": "Sulangrangbo", 
    "Sumudaerji Sumudaerji": "Su Mudaerji",
    "Yi Zha": "Yizha"
};

// 1. GOD MODE PROFILE SEARCH 
async function searchFighterProfile(fighterName) {
    console.log(`🔍 Searching for ${fighterName.trim()}...`);
    
    const cleanName = fighterName.trim().toLowerCase().replace(/-/g, ' ').replace(/[łŁ]/g, 'l');
    const nameParts = cleanName.split(/\s+/); 
    
    const dbFirst = nameParts[0];
    const dbLast = nameParts[nameParts.length - 1]; 
    
    const url = `http://ufcstats.com/statistics/fighters/search?query=${encodeURIComponent(dbLast)}&page=all`;
    
    const { data } = await axios.get(url, REQUEST_HEADERS);
    const $ = cheerio.load(data);
    
    let profileUrl = null;
    
    $('.b-statistics__table-row').each((i, el) => {
        if (i === 0) return; 
        
        const fName = $(el).find('td').eq(0).text().toLowerCase().trim();
        const lName = $(el).find('td').eq(1).text().toLowerCase().trim();
        
        const cleanSiteLast = lName.replace(/[^a-z]/g, '');
        const cleanDbLast = dbLast.replace(/[^a-z]/g, '');
        
        const firstMatch = fName.substring(0, 3) === dbFirst.substring(0, 3);
        const lastMatch = cleanSiteLast.includes(cleanDbLast) || cleanDbLast.includes(cleanSiteLast);
        
        if (firstMatch && lastMatch) {
            profileUrl = $(el).find('.b-link_style_black').first().attr('href');
            return false; 
        }
    });

    if (!profileUrl) {
        const backupUrl = `http://ufcstats.com/statistics/fighters/search?query=${encodeURIComponent(dbFirst)}&page=all`;
        const { data: backupData } = await axios.get(backupUrl, REQUEST_HEADERS);
        const _$ = cheerio.load(backupData);
        
        _$('.b-statistics__table-row').each((i, el) => {
            if (i === 0) return;
            const fName = _$(el).find('td').eq(0).text().toLowerCase().trim();
            const lName = _$(el).find('td').eq(1).text().toLowerCase().trim();
            
            const cleanSiteLast = lName.replace(/[^a-z]/g, '');
            const cleanDbLast = dbLast.replace(/[^a-z]/g, '');
            
            const firstMatch = fName.substring(0, 3) === dbFirst.substring(0, 3);
            const lastMatch = cleanSiteLast.includes(cleanDbLast) || cleanDbLast.includes(cleanSiteLast);
            
            if (firstMatch && lastMatch) {
                profileUrl = _$(el).find('.b-link_style_black').first().attr('href');
                return false;
            }
        });
    }

    if (!profileUrl) {
        throw new Error(`Could not find a UFC Stats profile for ${fighterName}.`);
    }
    
    return profileUrl;
}

// 🎯 OFFICIAL HEADSHOT SCRAPER
async function getFighterImage(fighterName) {
    try {
        const formattedName = fighterName.trim().toLowerCase().replace(/\s+/g, '-').replace(/[łŁ]/g, 'l');
        const url = `https://www.ufc.com/athlete/${formattedName}`;
        
        const { data } = await axios.get(url, REQUEST_HEADERS);
        const $ = cheerio.load(data);
        
        let imageUrl = $('.hero-profile__image').attr('src');
        
        if (imageUrl) {
            return imageUrl;
        }
        return null;
    } catch (err) {
        console.log(`   ⚠️ No official image found for ${fighterName}`);
        return null;
    }
}

// 2. GET BIO STATS (Fight URL fetching removed for speed)
async function getFighterProfileData(profileUrl) {
    const { data } = await axios.get(profileUrl, REQUEST_HEADERS);
    const $ = cheerio.load(data);
    
    const nickname = $('.b-content__Nickname').text().trim().replace(/^["'](.+)["']$/, '$1') || null;
    const record = $('.b-content__title-record').text().replace('Record:', '').trim() || '0-0-0';
    
    let height = '--', weight = '--', reach = '--', dob = '--';
    let slpm = 0, tdAvg = 0, subAvg = 0; // 🎯 Swapped KD for Sub

    $('.b-list__box-list-item').each((i, el) => {
        const text = $(el).text().replace(/\s+/g, ' ').trim();
        if (text.includes('Height:')) height = text.replace('Height:', '').trim();
        if (text.includes('Weight:')) weight = text.replace('Weight:', '').trim();
        if (text.includes('Reach:')) reach = text.replace('Reach:', '').trim();
        if (text.includes('DOB:')) dob = text.replace('DOB:', '').trim();
        
        if (text.includes('SLpM:')) slpm = parseFloat(text.replace('SLpM:', '').trim()) || 0;
        if (text.includes('TD Avg.:')) tdAvg = parseFloat(text.replace('TD Avg.:', '').trim()) || 0;
        if (text.includes('Sub. Avg.:')) subAvg = parseFloat(text.replace('Sub. Avg.:', '').trim()) || 0;
    });

    let age = null;
    if (dob && dob !== '--') {
        const birthDate = new Date(dob);
        const today = new Date();
        age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--; 
        }
    }

    return { 
        stats: { nickname, record, age, height, weight, reach, slpm, tdAvg, subAvg } 
    };
}

// 3. PROCESS FIGHTER (Scoring disabled)
async function processFighter(fighterName) {
    try {
        const trimmedName = fighterName.trim();
        
        // 🎯 THE DICTIONARY INTERCEPT
        let searchName = trimmedName;
        if (NAME_DICTIONARY[trimmedName]) {
            console.log(`🔀 Dictionary Match: Translating "${trimmedName}" to "${NAME_DICTIONARY[trimmedName]}"`);
            searchName = NAME_DICTIONARY[trimmedName];
        }

        const profileUrl = await searchFighterProfile(searchName);
        console.log(`✅ Found profile: ${profileUrl}`);

        const { stats } = await getFighterProfileData(profileUrl);
        
        console.log(`📸 Hunting for image...`);
        const imageUrl = await getFighterImage(searchName);
        if (imageUrl) console.log(`   ✅ Image secured!`);
        
        console.log(`📊 Scraped bio: ${stats.record} | TD Avg: ${stats.tdAvg} | Sub Avg: ${stats.subAvg}`);

        // 🛑 SCORING LOOP TEMPORARILY REMOVED FOR SPEED 🛑

        // 🎯 UPDATE DATABASE (Using UPDATE instead of UPSERT to protect existing points)
        const { error } = await supabase
            .from('fighter_historical_stats')
            .update({
                nickname: stats.nickname,
                record: stats.record,
                age: stats.age,
                height: stats.height,
                weight: stats.weight,
                reach: stats.reach,
                sig_strikes_per_min: stats.slpm,
                takedown_avg: stats.tdAvg,
                submission_avg: stats.subAvg, 
                image_url: imageUrl,
                last_updated: new Date().toISOString()
            })
            .eq('fighter_name', trimmedName);

        if (error) {
            console.error(`❌ Supabase Save Error for ${trimmedName}:`, error.message);
        } else {
            console.log(`💾 Successfully updated bio for ${trimmedName}!\n`);
        }

    } catch (error) {
        console.error(`❌ Process Failed for ${fighterName}:`, error.message);
    }
}

// 4. BATCH RUNNER
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

    // 🎯 THE NEW OPTIMIZATION: Check who already has a height!
    console.log("📥 Checking which fighters already have bio stats...");
    const { data: existingStats, error: statsError } = await supabase
        .from('fighter_historical_stats')
        .select('fighter_name, height');

    if (statsError) {
        console.error("❌ Failed to fetch existing stats:", statsError.message);
        return;
    }

    const alreadyUpdated = new Set();
    existingStats.forEach(stat => {
        // If they have a height saved, and it's not our default '--' fallback, they are good!
        if (stat.height && stat.height !== '--') {
            alreadyUpdated.add(stat.fighter_name.trim());
        }
    });

    // Filter our main list to ONLY include fighters who aren't in the alreadyUpdated set
    const fightersToProcess = Array.from(fighterSet).filter(fighter => !alreadyUpdated.has(fighter));

    const skippedCount = fighterSet.size - fightersToProcess.length;
    console.log(`⏭️  Skipping ${skippedCount} fighters who already have their bio stats.`);
    console.log(`📋 ${fightersToProcess.length} fighters left to process. Starting fast-scrape...\n`);

    if (fightersToProcess.length === 0) {
        console.log("🎉 ALL CAUGHT UP! No new bios to scrape.");
        return;
    }

    for (const fighter of fightersToProcess) {
        await processFighter(fighter);
        console.log("⏳ Resting 3 seconds before next fighter...");
        await new Promise(r => setTimeout(r, 3000)); 
    }
    
    console.log("🎉 ALL MISSING FIGHTERS UPDATED WITH NEW BIO STATS AND IMAGES!");
}

runBatch();