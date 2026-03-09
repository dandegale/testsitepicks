import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ============================================================================
// 🎯 BULLETPROOF NAME MATCHING ENGINE
// ============================================================================
const NAME_FIXES = {
    "roass": "rosas",         
    "sumudaerji": "mudaerji", 
    "weili": "zhang",         
    "stpreux": "st-preux"     
};

const getSearchKey = (name) => {
    if (!name) return "";
    let clean = name.toLowerCase().trim();
    clean = clean.replace(/\s+(jr\.?|sr\.?|ii|iii)$/g, '');
    const parts = clean.split(/\s+/);
    let lastName = parts[parts.length - 1].replace(/[^a-z]/g, '');
    return NAME_FIXES[lastName] || lastName;
};

const sanitizeForMatch = (str) => {
    return str ? str.toLowerCase().replace(/[^a-z]/g, '') : '';
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

export async function awardEventBadges(targetFightIds) {
  console.log(`🏆 Running Badge Engine for ${targetFightIds.length} event fights...`);

  // 1. Get all graded fights for these IDs
  const { data: fights } = await supabase
    .from('fights')
    .select('*')
    .in('id', targetFightIds) 
    .not('winner', 'is', null);

  if (!fights || fights.length === 0) return { success: true, message: 'No graded fights found.' };

  const totalEventFights = fights.length;

  let biggestUnderdogFightId = null;
  let highestOdds = 0;
  const winningUnderdogFightIds = new Set();
  
  fights.forEach(f => {
      let f1Odds = parseInt(f.fighter_1_odds) || -9999;
      let f2Odds = parseInt(f.fighter_2_odds) || -9999;
      let isUnderdogWin = false;

      if (isFighterMatch(f.winner, f.fighter_1_name) && f1Odds > 0) {
          isUnderdogWin = true;
          if (f1Odds > highestOdds) { highestOdds = f1Odds; biggestUnderdogFightId = f.id; }
      } else if (isFighterMatch(f.winner, f.fighter_2_name) && f2Odds > 0) {
          isUnderdogWin = true;
          if (f2Odds > highestOdds) { highestOdds = f2Odds; biggestUnderdogFightId = f.id; }
      }

      if (isUnderdogWin) winningUnderdogFightIds.add(f.id);
  });

  const { data: picks } = await supabase
    .from('picks')
    .select('*')
    .in('fight_id', targetFightIds);

  if (!picks || picks.length === 0) return { success: true, message: 'No picks found for this event.' };

  // 🎯 THE LEAGUE-SPECIFIC TRACKER: Track submission losses strictly by League ID
  const leagueSubLosses = {}; 
  
  picks.forEach(pick => {
      if (!pick.league_id) return; // Skip Global Feed picks for this specific badge
      
      const fight = fights.find(f => f.id === pick.fight_id);
      if (fight && fight.winner) {
          const isWin = isFighterMatch(fight.winner, pick.selected_fighter);
          if (!isWin) {
              const method = fight.method ? fight.method.toUpperCase() : '';
              if (method.includes('SUB') || method.includes('SUBMISSION')) {
                  // Initialize the nested objects if they don't exist yet
                  if (!leagueSubLosses[pick.league_id]) leagueSubLosses[pick.league_id] = {};
                  if (!leagueSubLosses[pick.league_id][pick.user_id]) leagueSubLosses[pick.league_id][pick.user_id] = 0;
                  
                  // Add 1 submission loss to this user in this league
                  leagueSubLosses[pick.league_id][pick.user_id]++;
              }
          }
      }
  });

  // Group picks by user EMAIL for standard global badges
  const userPicks = {};
  picks.forEach(pick => {
    if (!userPicks[pick.user_id]) userPicks[pick.user_id] = {};
    userPicks[pick.user_id][pick.fight_id] = pick;
  });

  const userEmails = Object.keys(userPicks);
  const { data: existingBadgesData } = await supabase
    .from('user_badges')
    .select('user_id, badge_id')
    .in('user_id', userEmails);

  const existingBadgesSet = new Set();
  if (existingBadgesData) {
      existingBadgesData.forEach(b => existingBadgesSet.add(`${b.user_id}-${b.badge_id}`));
  }

  const newlyEarnedBadges = [];

  const grantBadge = (email, badgeId) => {
      const lookupKey = `${email}-${badgeId}`;
      if (!existingBadgesSet.has(lookupKey)) {
          newlyEarnedBadges.push({ 
              id: crypto.randomUUID(), 
              user_id: email, 
              badge_id: badgeId 
          });
          existingBadgesSet.add(lookupKey); 
      }
  };

  // Evaluate the STANDARD event badges
  for (const [userEmail, uPicksObject] of Object.entries(userPicks)) {
    
    const uPicks = Object.values(uPicksObject); 

    let koWins = 0;
    let subWins = 0;
    let decWins = 0;
    let totalWins = 0;
    let hasRound1KO = false;
    let hasBiggestUnderdog = false;
    let pickedUnderdogWins = 0;
    let isPerfectCard = true;

    uPicks.forEach(pick => {
      const fight = fights.find(f => f.id === pick.fight_id);
      if (fight) {
          if (isFighterMatch(fight.winner, pick.selected_fighter)) {
            totalWins++;
            
            const method = fight.method ? fight.method.toUpperCase() : '';
            const round = parseInt(fight.round, 10) || 0; 

            if (method.includes('KO') || method.includes('TKO') || method.includes('KNOCKOUT')) {
                koWins++;
                if (round === 1) hasRound1KO = true;
            }
            if (method.includes('SUB')) subWins++;
            if (method.includes('DEC')) decWins++;

            if (pick.fight_id === biggestUnderdogFightId) hasBiggestUnderdog = true;
            if (winningUnderdogFightIds.has(pick.fight_id)) pickedUnderdogWins++;

          } else {
              isPerfectCard = false;
          }
      }
    });

    if (koWins >= 5) grantBadge(userEmail, 'b1'); // BMF
    if (subWins >= 5) grantBadge(userEmail, 'b2'); // Sub Artist
    if (hasRound1KO) grantBadge(userEmail, 'b3'); // Flashbang
    
    if (totalWins >= 3 && decWins === totalWins) {
        grantBadge(userEmail, 'b4'); // Decision Merchant
    }

    if (isPerfectCard && totalWins === totalEventFights && totalEventFights >= 5) {
        grantBadge(userEmail, 'b5'); // The Boss
    }

    if (hasBiggestUnderdog) {
        grantBadge(userEmail, 'b13'); // Whale Hunter
    }

    if (pickedUnderdogWins >= 2) {
        grantBadge(userEmail, 'b14'); // The Underdog
    }
  }

  // 🎯 EVALUATE THE "2-3 YEARS NEEDED" LEAGUE BADGE
  for (const [leagueId, userCounts] of Object.entries(leagueSubLosses)) {
      let maxLeagueSubs = 0;
      
      // Find what the highest number of sub losses was in this specific league
      for (const count of Object.values(userCounts)) {
          if (count > maxLeagueSubs) maxLeagueSubs = count;
      }

      // If someone actually got submitted (max > 0), give the badge to the highest scorer(s)
      if (maxLeagueSubs > 0) {
          for (const [userEmail, count] of Object.entries(userCounts)) {
              if (count === maxLeagueSubs) {
                  grantBadge(userEmail, 'b17'); // 2-3 Years Needed
              }
          }
      }
  }

  if (newlyEarnedBadges.length > 0) {
    console.log(`🏆 Found ${newlyEarnedBadges.length} Event Badges to award! Saving to DB...`);
    
    const { error } = await supabase
        .from('user_badges')
        .insert(newlyEarnedBadges);

    if (error) {
        console.error("❌ Error saving badges:", error);
        return { success: false, error };
    }
  } else {
      console.log(`🏆 No new event badges earned today.`);
  }
  
  return { success: true, count: newlyEarnedBadges.length };
}

// ----------------------------------------------------------------------------------
// 🎯 STREAK ENGINE 
// ----------------------------------------------------------------------------------

export async function evaluateUserStreaks(userEmail) {
  console.log(`🔥 Evaluating Streaks for User: ${userEmail}`);

  const { data: picksData, error } = await supabase
    .from('picks')
    .select('*, fights(*)')
    .eq('user_id', userEmail);

  if (error) {
      console.log(`🚨 DB ERROR for ${userEmail}:`, error.message);
      return { success: true, message: 'DB Error.' };
  }

  if (!picksData || picksData.length === 0) {
      console.log(`⚠️ No picks found in DB for ${userEmail}`);
      return { success: true, message: 'No picks found.' };
  }

  const gradedPicks = picksData.filter(p => p.fights && p.fights.winner !== null);
  
  if (gradedPicks.length === 0) {
      console.log(`⚠️ WARNING: Found picks, but NO graded fights for ${userEmail}.`);
      return { success: true, message: 'No graded fights found for user.' };
  }

  gradedPicks.sort((a, b) => {
    const timeDiff = new Date(a.fights.start_time) - new Date(b.fights.start_time);
    if (timeDiff !== 0) return timeDiff;
    return String(a.fight_id).localeCompare(String(b.fight_id)); 
  });

  const uniqueGradedPicks = [];
  const seenFightIds = new Set();
  
  gradedPicks.forEach(pick => {
      if (!seenFightIds.has(pick.fight_id)) {
          uniqueGradedPicks.push(pick);
          seenFightIds.add(pick.fight_id);
      }
  });

  let currentWinStreak = 0;
  let maxWinStreak = 0; 
  const winningPicks = [];

  uniqueGradedPicks.forEach(pick => {
    const isWin = isFighterMatch(pick.fights.winner, pick.selected_fighter);

    if (isWin) {
      currentWinStreak++;
      winningPicks.push(pick); 
      if (currentWinStreak > maxWinStreak) maxWinStreak = currentWinStreak;
    } else {
      currentWinStreak = 0; 
    }
  });

  console.log(`   ➔ ${userEmail} | Unique Real-World Fights Picked: ${uniqueGradedPicks.length} | True Max Streak: ${maxWinStreak}`);

  const { data: existingBadgesData } = await supabase
      .from('user_badges')
      .select('badge_id')
      .eq('user_id', userEmail);

  const existingBadgesSet = new Set(existingBadgesData?.map(b => b.badge_id) || []);
  const newlyEarnedBadges = [];

  const grantBadge = (badgeId) => {
      if (!existingBadgesSet.has(badgeId)) {
          newlyEarnedBadges.push({ 
              id: crypto.randomUUID(), 
              user_id: userEmail, 
              badge_id: badgeId 
          });
          existingBadgesSet.add(badgeId);
      }
  };

  if (maxWinStreak >= 3) grantBadge('b9');  
  if (maxWinStreak >= 5) grantBadge('b10'); 
  if (maxWinStreak >= 10) grantBadge('b11'); 
  if (maxWinStreak >= 25) grantBadge('b12'); 

  if (winningPicks.length >= 10) {
    const last10Wins = winningPicks.slice(-10); 
    const isChalkEater = last10Wins.every(pick => {
      const odds = parseInt(pick.odds_at_pick, 10);
      return !isNaN(odds) && odds <= -250; 
    });

    if (isChalkEater) grantBadge('b15'); 
  }

  if (newlyEarnedBadges.length > 0) {
    const { error: insertError } = await supabase
      .from('user_badges')
      .insert(newlyEarnedBadges);

    if (insertError) {
      console.error(`❌ Error saving streak badges for ${userEmail}:`, insertError);
      return { success: false, error: insertError };
    } else {
      console.log(`✅ Granted ${newlyEarnedBadges.length} streak/history badges to ${userEmail}!`);
    }
  }

  return { success: true, maxStreak: maxWinStreak, badgesAwarded: newlyEarnedBadges.length };
}