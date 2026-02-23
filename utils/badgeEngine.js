import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function awardEventBadges(eventId) {
  console.log(`🏆 Running Badge Engine for Event: ${eventId}`);

  // 1. Get all fights for this event
  const { data: fights } = await supabase
    .from('fights')
    .select('*')
    .eq('event_id', eventId)
    .not('winner', 'is', null);

  if (!fights || fights.length === 0) return { success: true, message: 'No graded fights found.' };

  const fightIds = fights.map(f => f.id);

  // Find the biggest underdog on the card (highest positive odds)
  let biggestUnderdogFightId = null;
  let highestOdds = 0;
  
  fights.forEach(f => {
      // Determine if fighter 1 or 2 was the underdog and won
      if (f.winner === f.fighter_1_name && parseInt(f.fighter_1_odds) > highestOdds) {
          highestOdds = parseInt(f.fighter_1_odds);
          biggestUnderdogFightId = f.id;
      } else if (f.winner === f.fighter_2_name && parseInt(f.fighter_2_odds) > highestOdds) {
          highestOdds = parseInt(f.fighter_2_odds);
          biggestUnderdogFightId = f.id;
      }
  });

  // 2. Get all picks for these fights
  const { data: picks } = await supabase
    .from('picks')
    .select('*')
    .in('fight_id', fightIds);

  if (!picks || picks.length === 0) return { success: true, message: 'No picks found for this event.' };

  // 3. Group picks by user email
  const userPicks = {};
  picks.forEach(pick => {
    if (!userPicks[pick.user_id]) userPicks[pick.user_id] = [];
    userPicks[pick.user_id].push(pick);
  });

  const newlyEarnedBadges = [];

  // 4. THE MATRIX: Evaluate each user's performance
  for (const [userId, uPicks] of Object.entries(userPicks)) {
    
    let koWins = 0;
    let subWins = 0;
    let decWins = 0;
    let totalWins = 0;
    let hasRound1KO = false;
    let hasBiggestUnderdog = false;
    let isPerfectCard = true;

    // We only care about global picks for "Perfect Card", or you can allow league picks.
    // For this engine, we look at their performance across the event.
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

            // Did they pick the biggest underdog?
            if (pick.fight_id === biggestUnderdogFightId) {
                hasBiggestUnderdog = true;
            }

          } else {
              // They got a pick wrong on this card
              isPerfectCard = false;
          }
      }
    });

    // --- BADGE LOGIC CONDITIONS ---

    if (koWins >= 5) newlyEarnedBadges.push({ user_id: userId, badge_id: 'b1' }); // BMF
    if (subWins >= 5) newlyEarnedBadges.push({ user_id: userId, badge_id: 'b2' }); // Sub Artist
    if (hasRound1KO) newlyEarnedBadges.push({ user_id: userId, badge_id: 'b3' }); // Flashbang
    
    if (totalWins >= 3 && decWins === totalWins) {
        newlyEarnedBadges.push({ user_id: userId, badge_id: 'b4' }); // Decision Merchant
    }

    if (isPerfectCard && uPicks.length >= 3) {
        newlyEarnedBadges.push({ user_id: userId, badge_id: 'b5' }); // The Boss
    }

    if (hasBiggestUnderdog) {
        newlyEarnedBadges.push({ user_id: userId, badge_id: 'b13' }); // Whale Hunter
    }
  }

  // 5. Save the earned badges to the database
  if (newlyEarnedBadges.length > 0) {
    console.log(`🏆 Found ${newlyEarnedBadges.length} badges to award! Saving to DB...`);
    
    // Upsert avoids duplicate errors because of the UNIQUE(user_id, badge_id) constraint in Supabase
    const { error } = await supabase
        .from('user_badges')
        .upsert(newlyEarnedBadges, { onConflict: 'user_id, badge_id' });

    if (error) {
        console.error("Error saving badges:", error);
        return { success: false, error };
    }
  } 
  
  return { success: true, count: newlyEarnedBadges.length };
}

// ----------------------------------------------------------------------------------
// 🎯 NEW: STREAK ENGINE (Checks Career History)
// ----------------------------------------------------------------------------------

export async function evaluateUserStreaks(userId) {
  console.log(`🔥 Evaluating Streaks for User: ${userId}`);

  // 1. Fetch all picks for this user, including the fight data
  const { data: picksData, error } = await supabase
    .from('picks')
    .select('*, fights(*)')
    .eq('user_id', userId);

  if (error || !picksData || picksData.length === 0) return { success: true, message: 'No picks found.' };

  // 2. Filter out pending fights (we only want graded fights where winner is not null)
  const gradedPicks = picksData.filter(p => p.fights && p.fights.winner !== null);

  if (gradedPicks.length === 0) return { success: true, message: 'No graded fights found for user.' };

  // 3. Sort chronologically by the time the fight started
  gradedPicks.sort((a, b) => new Date(a.fights.start_time) - new Date(b.fights.start_time));

  // --- STREAK MATH ---
  let currentWinStreak = 0;
  let maxWinStreak = 0; // Tracks their all-time best streak
  const winningPicks = [];

  gradedPicks.forEach(pick => {
    if (pick.selected_fighter === pick.fights.winner) {
      // It's a win!
      currentWinStreak++;
      winningPicks.push(pick); // Save for Chalk Eater logic
      if (currentWinStreak > maxWinStreak) {
        maxWinStreak = currentWinStreak;
      }
    } else {
      // It's a loss, reset the streak counter
      currentWinStreak = 0;
    }
  });

  const newlyEarnedBadges = [];

  // --- AWARD STREAK BADGES ---
  if (maxWinStreak >= 3) newlyEarnedBadges.push({ user_id: userId, badge_id: 'b9' });  // On Fire
  if (maxWinStreak >= 5) newlyEarnedBadges.push({ user_id: userId, badge_id: 'b10' }); // Heating Up
  if (maxWinStreak >= 10) newlyEarnedBadges.push({ user_id: userId, badge_id: 'b11' }); // Unstoppable
  if (maxWinStreak >= 25) newlyEarnedBadges.push({ user_id: userId, badge_id: 'b12' }); // God Tier

  // --- AWARD "CHALK EATER" BADGE ---
  // Logic: "Last 10 correct picks were all heavy favorites (<= -250)"
  if (winningPicks.length >= 10) {
    const last10Wins = winningPicks.slice(-10); // Grab exactly the last 10 wins
    
    const isChalkEater = last10Wins.every(pick => {
      const odds = parseInt(pick.odds_at_pick, 10);
      // Validates odds exist, and are worse than or equal to -250 (e.g. -300, -450)
      return !isNaN(odds) && odds <= -250; 
    });

    if (isChalkEater) {
      newlyEarnedBadges.push({ user_id: userId, badge_id: 'b15' }); // Chalk Eater
    }
  }

  // --- SAVE TO DATABASE ---
  if (newlyEarnedBadges.length > 0) {
    const { error: upsertError } = await supabase
      .from('user_badges')
      .upsert(newlyEarnedBadges, { onConflict: 'user_id, badge_id' });

    if (upsertError) {
      console.error(`Error saving streak badges for ${userId}:`, upsertError);
      return { success: false, error: upsertError };
    } else {
      console.log(`✅ Granted ${newlyEarnedBadges.length} streak/history badges to ${userId}!`);
    }
  }

  return { success: true, maxStreak: maxWinStreak, badgesAwarded: newlyEarnedBadges.length };
}