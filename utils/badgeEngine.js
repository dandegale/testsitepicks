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
// 🎯 DFS POINTS ENGINE (Needed to determine League Winners for Badges)
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
        if ((format === 'Striking' && method.includes('ko')) || (format === 'Grappling' && method.includes('sub'))) {
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
// 🏆 EVENT BADGE ENGINE
// ============================================================================

export async function awardEventBadges(targetFightIds) {
  console.log(`🏆 Running Badge Engine for ${targetFightIds.length} event fights...`);

  const { data: fights } = await supabase.from('fights').select('*').in('id', targetFightIds).not('winner', 'is', null);
  if (!fights || fights.length === 0) return { success: true, message: 'No graded fights found.' };

  // 🎯 CARD POSITIONING (Main Event vs Prelims)
  const sortedFights = [...fights].sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
  const mainEventFight = sortedFights[sortedFights.length - 1];
  const prelimFightIds = sortedFights.slice(0, -5).map(f => f.id); // Everything before the last 5 is a prelim
  const firstFightTime = new Date(sortedFights[0].start_time).getTime();
  const totalEventFights = fights.length;

  let biggestUnderdogFightId = null;
  let highestOdds = 0;
  const winningUnderdogFightIds = new Set();
  
  fights.forEach(f => {
      let f1Odds = parseInt(f.fighter_1_odds) || -9999;
      let f2Odds = parseInt(f.fighter_2_odds) || -9999;

      if (isFighterMatch(f.winner, f.fighter_1_name) && f1Odds > 0) {
          winningUnderdogFightIds.add(f.id);
          if (f1Odds > highestOdds) { highestOdds = f1Odds; biggestUnderdogFightId = f.id; }
      } else if (isFighterMatch(f.winner, f.fighter_2_name) && f2Odds > 0) {
          winningUnderdogFightIds.add(f.id);
          if (f2Odds > highestOdds) { highestOdds = f2Odds; biggestUnderdogFightId = f.id; }
      }
  });

  // 🎯 MASSIVE MAIN EVENT UNDERDOG CHECK (For Hail Mary)
  let mainEventUnderdogName = null;
  let meF1Odds = parseInt(mainEventFight.fighter_1_odds) || 0;
  let meF2Odds = parseInt(mainEventFight.fighter_2_odds) || 0;
  if (meF1Odds >= 200 && isFighterMatch(mainEventFight.winner, mainEventFight.fighter_1_name)) mainEventUnderdogName = mainEventFight.fighter_1_name;
  if (meF2Odds >= 200 && isFighterMatch(mainEventFight.winner, mainEventFight.fighter_2_name)) mainEventUnderdogName = mainEventFight.fighter_2_name;

  const { data: picks } = await supabase.from('picks').select('*').in('fight_id', targetFightIds);
  if (!picks || picks.length === 0) return { success: true, message: 'No picks found.' };

  // 🎯 FETCH DFS STATS TO SCORE LEAGUES
  const { data: statsData } = await supabase.from('fighter_stats').select('*').in('fight_id', targetFightIds);
  const { data: leaguesData } = await supabase.from('leagues').select('id, scoring_format');

  const leagueScores = {}; 
  const leagueSubLosses = {}; 
  
  picks.forEach(pick => {
      if (!pick.league_id) return; 

      const fight = fights.find(f => f.id === pick.fight_id);
      const statRow = statsData?.find(s => s.fight_id === pick.fight_id && isFighterMatch(s.fighter_name, pick.selected_fighter));
      const format = leaguesData?.find(l => String(l.id) === String(pick.league_id))?.scoring_format || 'MMA';
      
      // Calculate DFS Points for League Winner Badge
      const pts = getCustomPoints(pick, statRow, fight, format);
      if (!leagueScores[pick.league_id]) leagueScores[pick.league_id] = {};
      if (!leagueScores[pick.league_id][pick.user_id]) leagueScores[pick.league_id][pick.user_id] = 0;
      leagueScores[pick.league_id][pick.user_id] += pts;

      // Track Submission Losses for "2-3 Years Needed" Badge
      if (fight && fight.winner && !isFighterMatch(fight.winner, pick.selected_fighter)) {
          const method = fight.method ? fight.method.toUpperCase() : '';
          if (method.includes('SUB') || method.includes('SUBMISSION')) {
              if (!leagueSubLosses[pick.league_id]) leagueSubLosses[pick.league_id] = {};
              if (!leagueSubLosses[pick.league_id][pick.user_id]) leagueSubLosses[pick.league_id][pick.user_id] = 0;
              leagueSubLosses[pick.league_id][pick.user_id]++;
          }
      }
  });

  // 🎯 DETERMINE LEAGUE WINNERS
  const leagueWinners = {}; 
  for (const [leagueId, scores] of Object.entries(leagueScores)) {
      let maxScore = -1;
      for (const score of Object.values(scores)) { if (score > maxScore) maxScore = score; }
      if (maxScore > 0) {
          for (const [uid, score] of Object.entries(scores)) {
              if (score === maxScore) leagueWinners[uid] = true;
          }
      }
  }

  // Deduplicate picks per user for global badges
  const userPicks = {};
  picks.forEach(pick => {
    if (!userPicks[pick.user_id]) userPicks[pick.user_id] = {};
    userPicks[pick.user_id][pick.fight_id] = pick;
  });

  const userEmails = Object.keys(userPicks);
  const { data: existingBadgesData } = await supabase.from('user_badges').select('user_id, badge_id').in('user_id', userEmails);
  const existingBadgesSet = new Set(existingBadgesData?.map(b => `${b.user_id}-${b.badge_id}`) || []);
  const newlyEarnedBadges = [];

  const grantBadge = (email, badgeId) => {
      const lookupKey = `${email}-${badgeId}`;
      if (!existingBadgesSet.has(lookupKey)) {
          newlyEarnedBadges.push({ id: crypto.randomUUID(), user_id: email, badge_id: badgeId });
          existingBadgesSet.add(lookupKey); 
      }
  };

  // THE MATRIX: Evaluate each user
  for (const [userEmail, uPicksObject] of Object.entries(userPicks)) {
    const uPicks = Object.values(uPicksObject); 

    let koWins = 0, subWins = 0, decWins = 0, totalWins = 0, pickedUnderdogWins = 0;
    let hasRound1KO = false, hasBiggestUnderdog = false, isPerfectCard = true, isBuzzerBeater = false;

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

          // Buzzer Beater Check: Pick made < 15 mins before the first fight started
          const pickTime = new Date(pick.created_at).getTime();
          const diffMins = (firstFightTime - pickTime) / (1000 * 60);
          if (diffMins > 0 && diffMins <= 15) isBuzzerBeater = true;
      }
    });

    // 🏆 AWARD GENERAL EVENT BADGES
    if (koWins >= 5) grantBadge(userEmail, 'b1'); 
    if (subWins >= 5) grantBadge(userEmail, 'b2'); 
    if (hasRound1KO) grantBadge(userEmail, 'b3'); 
    if (totalWins >= 3 && decWins === totalWins) grantBadge(userEmail, 'b4'); 
    if (isPerfectCard && totalWins === totalEventFights && totalEventFights >= 5) grantBadge(userEmail, 'b5'); 
    if (hasBiggestUnderdog) grantBadge(userEmail, 'b13'); 
    if (pickedUnderdogWins >= 2) grantBadge(userEmail, 'b14'); 
    if (isBuzzerBeater) grantBadge(userEmail, 'b19'); 

    // 🏆 AWARD CARD POSITION BADGES
    const pickedOnlyPrelims = uPicks.length >= 3 && uPicks.every(p => prelimFightIds.includes(p.fight_id));
    if (pickedOnlyPrelims && isPerfectCard) {
        grantBadge(userEmail, 'b6'); // Undercard Assassin
    }

    // 🏆 AWARD LEAGUE PLACEMENT BADGES
    if (leagueWinners[userEmail]) {
        grantBadge(userEmail, 'b21'); // And New (1st Place)

        // Hail Mary (Won league + Main Event massive underdog)
        if (mainEventUnderdogName) {
            const pickedME = uPicks.find(p => p.fight_id === mainEventFight.id);
            if (pickedME && isFighterMatch(pickedME.selected_fighter, mainEventUnderdogName)) {
                grantBadge(userEmail, 'b16'); 
            }
        }
    }
  }

  // 🏆 AWARD 2-3 YEARS NEEDED (Most Sub Losses in a League)
  for (const [leagueId, userCounts] of Object.entries(leagueSubLosses)) {
      let maxLeagueSubs = 0;
      for (const count of Object.values(userCounts)) { if (count > maxLeagueSubs) maxLeagueSubs = count; }
      if (maxLeagueSubs >= 3) {
          for (const [userEmail, count] of Object.entries(userCounts)) {
              if (count === maxLeagueSubs) grantBadge(userEmail, 'b17'); 
          }
      }
  }

  if (newlyEarnedBadges.length > 0) {
      await supabase.from('user_badges').insert(newlyEarnedBadges);
  }
  
  return { success: true, count: newlyEarnedBadges.length };
}

// ==================================================================================
// 🎯 CAREER HISTORY & STREAK ENGINE
// ==================================================================================

export async function evaluateUserStreaks(userEmail) {
  
  // 1. Fetch Picks
  const { data: picksData } = await supabase.from('picks').select('*, fights(*)').eq('user_id', userEmail);
  if (!picksData || picksData.length === 0) return { success: true };

  const gradedPicks = picksData.filter(p => p.fights && p.fights.winner !== null);
  if (gradedPicks.length === 0) return { success: true };

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

  let currentWinStreak = 0, maxWinStreak = 0; 
  const winningPicks = [];

  uniqueGradedPicks.forEach(pick => {
    if (isFighterMatch(pick.fights.winner, pick.selected_fighter)) {
      currentWinStreak++;
      winningPicks.push(pick); 
      if (currentWinStreak > maxWinStreak) maxWinStreak = currentWinStreak;
    } else {
      currentWinStreak = 0; 
    }
  });

  const { data: existingBadgesData } = await supabase.from('user_badges').select('badge_id').eq('user_id', userEmail);
  const existingBadgesSet = new Set(existingBadgesData?.map(b => b.badge_id) || []);
  const newlyEarnedBadges = [];

  const grantBadge = (badgeId) => {
      if (!existingBadgesSet.has(badgeId)) {
          newlyEarnedBadges.push({ id: crypto.randomUUID(), user_id: userEmail, badge_id: badgeId });
          existingBadgesSet.add(badgeId);
      }
  };

  // 🏆 STREAK BADGES
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

  // 🏆 EVENT MASTER (Participated in all events in the last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentAllFights } = await supabase.from('fights').select('start_time').gte('start_time', thirtyDaysAgo);
  
  if (recentAllFights && recentAllFights.length > 0) {
      const uniqueEventDates = new Set(recentAllFights.map(f => f.start_time.split('T')[0]));
      const userPickedDates = new Set(uniqueGradedPicks.map(p => p.fights.start_time.split('T')[0]));
      
      let participatedInAll = true;
      uniqueEventDates.forEach(date => { if (!userPickedDates.has(date)) participatedInAll = false; });
      if (participatedInAll && uniqueEventDates.size >= 3) grantBadge('b18');
  }

  // 🏆 MAIN EVENT MAFIA (5 Main Events Correct in a row)
  const { data: allGradedFights } = await supabase.from('fights').select('id, start_time').not('winner', 'is', null);
  if (allGradedFights) {
      const groupedByDate = {};
      allGradedFights.forEach(f => {
          const d = f.start_time.split('T')[0];
          if (!groupedByDate[d]) groupedByDate[d] = [];
          groupedByDate[d].push(f);
      });
      
      const dateToMainEventId = {};
      for (const [date, dayFights] of Object.entries(groupedByDate)) {
          dayFights.sort((a,b) => new Date(a.start_time) - new Date(b.start_time));
          dateToMainEventId[date] = dayFights[dayFights.length - 1].id;
      }

      let meStreak = 0;
      uniqueGradedPicks.forEach(pick => {
          const pickDate = pick.fights.start_time.split('T')[0];
          if (pick.fight_id === dateToMainEventId[pickDate]) {
               if (isFighterMatch(pick.fights.winner, pick.selected_fighter)) {
                   meStreak++;
                   if (meStreak >= 5) grantBadge('b7');
               } else {
                   meStreak = 0;
               }
          }
      });
  }

  // 🏆 1V1 SHOWDOWN BADGES (Flawless Victory & Showdown King)
  // 🏆 1V1 SHOWDOWN BADGES (Flawless Victory & Showdown King)
  const { data: userShowdowns } = await supabase
      .from('h2h_matches') 
      .select('*')
      .or(`user1_id.eq.${userEmail},user2_id.eq.${userEmail}`)
      .order('created_at', { ascending: true })
      .catch(() => ({ data: [] })); 
      
  if (userShowdowns && userShowdowns.length > 0) {
      // Step 1: Get all match IDs so we can fetch the picks
      const matchIds = userShowdowns.map(m => m.id);

      // Step 2: Fetch all picks associated with these matches
      const { data: h2hPicks } = await supabase
          .from('h2h_picks')
          .select('*')
          .in('match_id', matchIds)
          .catch(() => ({ data: [] }));

      if (h2hPicks && h2hPicks.length > 0) {
          let sdStreak = 0;

          userShowdowns.forEach(match => {
              // Get all picks for this specific match
              const matchPicks = h2hPicks.filter(p => p.match_id === match.id);

              // If there are no picks yet, the match hasn't started. Skip it!
              if (matchPicks.length === 0) return;

              let user1Score = 0;
              let user2Score = 0;

              // Step 3: Tally up the points
              // ⚠️ NOTE: Change 'p.points' if your points column is named something else (e.g., p.score or p.fantasy_points)
              matchPicks.forEach(p => {
                  const pts = parseFloat(p.points || p.score || p.fantasy_points) || 0;
                  if (p.user_id === match.user1_id) user1Score += pts;
                  if (p.user_id === match.user2_id) user2Score += pts;
              });

              // 🛡️ SAFETY CHECK: If both are exactly 0, the fights likely haven't happened/been graded yet.
              if (user1Score === 0 && user2Score === 0) return;

              // Step 4: Determine the winner
              const isUser1 = match.user1_id === userEmail;
              const myScore = isUser1 ? user1Score : user2Score;
              const oppScore = isUser1 ? user2Score : user1Score;

              const isWinner = myScore > oppScore;

              if (isWinner) {
                  sdStreak++;
                  if (sdStreak >= 5) grantBadge('b20'); // Showdown King
                  
                  // If you scored points and they got an absolute goose egg
                  if (myScore > 0 && oppScore === 0) grantBadge('b8'); // Flawless Victory
              } else {
                  // A loss or a tie breaks the streak!
                  sdStreak = 0;
              }
          });
      }
  }

  if (newlyEarnedBadges.length > 0) {
      await supabase.from('user_badges').insert(newlyEarnedBadges);
  }

  return { success: true, maxStreak: maxWinStreak, badgesAwarded: newlyEarnedBadges.length };
}