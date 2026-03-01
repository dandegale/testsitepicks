import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Use Service Role for backend engine overrides
);

// 👇 CHANGED: Now accepts targetDate instead of eventId
export async function awardEventBadges(targetDate) {
  console.log(`🏆 Running Badge Engine for Date: ${targetDate}`);

  // 1. Get all graded fights for this date
  const { data: fights } = await supabase
    .from('fights')
    .select('*')
    .like('start_time', `${targetDate}%`) 
    .not('winner', 'is', null);

  if (!fights || fights.length === 0) return { success: true, message: 'No graded fights found.' };

  const fightIds = fights.map(f => f.id);
  const totalEventFights = fights.length;

  // 2. ADVANCED ODDS TRACKING: Find the biggest underdog AND all winning underdogs
  let biggestUnderdogFightId = null;
  let highestOdds = 0;
  const winningUnderdogFightIds = new Set();
  
  fights.forEach(f => {
      let f1Odds = parseInt(f.fighter_1_odds) || -9999;
      let f2Odds = parseInt(f.fighter_2_odds) || -9999;
      let isUnderdogWin = false;

      if (f.winner === f.fighter_1_name && f1Odds > 0) {
          isUnderdogWin = true;
          if (f1Odds > highestOdds) { highestOdds = f1Odds; biggestUnderdogFightId = f.id; }
      } else if (f.winner === f.fighter_2_name && f2Odds > 0) {
          isUnderdogWin = true;
          if (f2Odds > highestOdds) { highestOdds = f2Odds; biggestUnderdogFightId = f.id; }
      }

      if (isUnderdogWin) winningUnderdogFightIds.add(f.id);
  });

  // 3. Get all picks for these fights
  const { data: picks } = await supabase
    .from('picks')
    .select('*')
    .in('fight_id', fightIds);

  if (!picks || picks.length === 0) return { success: true, message: 'No picks found for this event.' };

  // 4. Group picks by user EMAIL (user_id)
  const userPicks = {};
  picks.forEach(pick => {
    if (!userPicks[pick.user_id]) userPicks[pick.user_id] = [];
    userPicks[pick.user_id].push(pick);
  });

  // 🎯 THE FIX: Fetch existing badges so we don't try to award them twice
  const userEmails = Object.keys(userPicks);
  const { data: existingBadgesData } = await supabase
    .from('user_badges')
    .select('user_id, badge_id')
    .in('user_id', userEmails);

  // Store existing badges in a quick-lookup Set (e.g., "dandegale@gmail.com-b1")
  const existingBadgesSet = new Set();
  if (existingBadgesData) {
      existingBadgesData.forEach(b => existingBadgesSet.add(`${b.user_id}-${b.badge_id}`));
  }

  const newlyEarnedBadges = [];

  // Helper function to safely add a badge only if they don't already have it
  const grantBadge = (email, badgeId) => {
      const lookupKey = `${email}-${badgeId}`;
      if (!existingBadgesSet.has(lookupKey)) {
          newlyEarnedBadges.push({ user_id: email, badge_id: badgeId });
          existingBadgesSet.add(lookupKey); // Add to set immediately to prevent duplicates in same run
      }
  };

  // 5. THE MATRIX: Evaluate each user's performance
  for (const [userEmail, uPicks] of Object.entries(userPicks)) {
    
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
          if (fight.winner === pick.selected_fighter) {
            totalWins++;
            
            const method = fight.method ? fight.method.toUpperCase() : '';
            const round = parseInt(fight.round, 10);

            if (method.includes('KO') || method.includes('TKO')) {
                koWins++;
                if (round === 1) hasRound1KO = true;
            }
            if (method.includes('SUB')) subWins++;
            if (method.includes('DEC')) decWins++;

            // Whale Hunter Check
            if (pick.fight_id === biggestUnderdogFightId) hasBiggestUnderdog = true;
            
            // The Underdog Check
            if (winningUnderdogFightIds.has(pick.fight_id)) pickedUnderdogWins++;

          } else {
              isPerfectCard = false;
          }
      }
    });

    // --- BADGE LOGIC CONDITIONS ---
    if (koWins >= 5) grantBadge(userEmail, 'b1'); // BMF
    if (subWins >= 5) grantBadge(userEmail, 'b2'); // Sub Artist
    if (hasRound1KO) grantBadge(userEmail, 'b3'); // Flashbang
    
    if (totalWins >= 3 && decWins === totalWins) {
        grantBadge(userEmail, 'b4'); // Decision Merchant
    }

    if (isPerfectCard && uPicks.length === totalEventFights && totalEventFights >= 5) {
        grantBadge(userEmail, 'b5'); // The Boss
    }

    if (hasBiggestUnderdog) {
        grantBadge(userEmail, 'b13'); // Whale Hunter
    }

    if (winningUnderdogFightIds.size >= 2 && pickedUnderdogWins === winningUnderdogFightIds.size) {
        grantBadge(userEmail, 'b14'); // The Underdog
    }
  }

  // 6. Save the earned badges to the database
  if (newlyEarnedBadges.length > 0) {
    console.log(`🏆 Found ${newlyEarnedBadges.length} Event Badges to award! Saving to DB...`);
    
    // 🎯 THE FIX: Changed from .upsert to a standard .insert
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
// 🎯 STREAK ENGINE (Checks Career History via Email)
// ----------------------------------------------------------------------------------

export async function evaluateUserStreaks(userEmail) {
  console.log(`🔥 Evaluating Streaks for User: ${userEmail}`);

  const { data: picksData, error } = await supabase
    .from('picks')
    .select('*, fights(*)')
    .eq('user_id', userEmail);

  if (error || !picksData || picksData.length === 0) return { success: true, message: 'No picks found.' };

  const gradedPicks = picksData.filter(p => p.fights && p.fights.winner !== null);
  if (gradedPicks.length === 0) return { success: true, message: 'No graded fights found for user.' };

  gradedPicks.sort((a, b) => new Date(a.fights.start_time) - new Date(b.fights.start_time));

  let currentWinStreak = 0;
  let maxWinStreak = 0; 
  const winningPicks = [];

  gradedPicks.forEach(pick => {
    if (pick.selected_fighter === pick.fights.winner) {
      currentWinStreak++;
      winningPicks.push(pick); 
      if (currentWinStreak > maxWinStreak) maxWinStreak = currentWinStreak;
    } else {
      currentWinStreak = 0;
    }
  });

  // 🎯 THE FIX: Fetch existing badges so we don't try to award them twice
  const { data: existingBadgesData } = await supabase
      .from('user_badges')
      .select('badge_id')
      .eq('user_id', userEmail);

  const existingBadgesSet = new Set(existingBadgesData?.map(b => b.badge_id) || []);
  const newlyEarnedBadges = [];

  const grantBadge = (badgeId) => {
      if (!existingBadgesSet.has(badgeId)) {
          newlyEarnedBadges.push({ user_id: userEmail, badge_id: badgeId });
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
    // 🎯 THE FIX: Changed from .upsert to a standard .insert
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