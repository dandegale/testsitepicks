import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { awardEventBadges, evaluateUserStreaks } from '@/utils/badgeEngine';

export const dynamic = 'force-dynamic';

export async function GET() {
  console.log("🚀 INITIALIZING BADGE & STREAK ENGINE...");

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    // 1. Find the fights that happened in the last 14 days that HAVE a winner
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    
    const { data: recentFights, error: fightError } = await supabase
        .from('fights')
        .select('event_id, id')
        .gte('start_time', fourteenDaysAgo) // <--- Now looking back 14 days
        .not('winner', 'is', null);

    if (fightError || !recentFights || recentFights.length === 0) {
        return NextResponse.json({ message: 'No recently graded fights found to process.' });
    }

    // 2. Extract the unique event_id from those recent fights
    // (Assuming all fights this weekend share the same event_id)
    const targetEventId = recentFights[0].event_id; 
    
    // 3. RUN THE EVENT BADGE ENGINE
    console.log(`🎯 Running Event Badges for Event ID: ${targetEventId}`);
    const eventBadgeResult = await awardEventBadges(targetEventId);

    // 4. Find all users who made picks on these recent fights
    const recentFightIds = recentFights.map(f => f.id);
    const { data: recentPicks } = await supabase
        .from('picks')
        .select('user_id')
        .in('fight_id', recentFightIds);

    // Get a unique list of user emails who participated this weekend
    const activeUsers = [...new Set(recentPicks.map(p => p.user_id))];

    // 5. RUN THE STREAK ENGINE FOR THOSE USERS
    console.log(`🔥 Running Streak Engine for ${activeUsers.length} active users...`);
    let totalStreaksProcessed = 0;
    
    for (const userEmail of activeUsers) {
        await evaluateUserStreaks(userEmail);
        totalStreaksProcessed++;
    }

    return NextResponse.json({ 
        message: '✅ Engine Run Complete!', 
        eventBadgesProcessed: eventBadgeResult.count,
        usersStreaksUpdated: totalStreaksProcessed
    });

  } catch (error) {
    console.error("❌ Engine Failure:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}