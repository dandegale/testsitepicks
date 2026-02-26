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
    // 1. Find ANY fight in the database that has been graded (winner is not null)
    // 🚨 Notice: We are selecting 'start_time' now, NOT 'event_id'
    const { data: recentFights, error: fightError } = await supabase
        .from('fights')
        .select('start_time, id, winner')
        .not('winner', 'is', null)
        .order('start_time', { ascending: false });

    if (fightError) {
        console.error("SUPABASE ERROR:", fightError);
        return NextResponse.json({ message: "Database Error", details: fightError });
    }

    if (!recentFights || recentFights.length === 0) {
        return NextResponse.json({ message: 'No graded fights found in the entire database. Run your scraper first!' });
    }

    // 2. Extract the exact DATE (YYYY-MM-DD) from the most recent graded fight
    const targetDate = recentFights[0].start_time.split('T')[0]; 

    // Filter recentFights to ONLY include fights that happened on that exact same day
    const targetEventFights = recentFights.filter(f => f.start_time.startsWith(targetDate));
    
    // 3. RUN THE EVENT BADGE ENGINE (Passing the Date instead of an ID)
    console.log(`🎯 Running Event Badges for Date: ${targetDate} (${targetEventFights.length} fights)`);
    const eventBadgeResult = await awardEventBadges(targetDate);

    // 4. Find all users who made picks on these specific fights
    const targetFightIds = targetEventFights.map(f => f.id);
    const { data: recentPicks } = await supabase
        .from('picks')
        .select('user_id')
        .in('fight_id', targetFightIds);

    const activeUsers = [...new Set(recentPicks?.map(p => p.user_id) || [])];

    // 5. RUN THE STREAK ENGINE FOR THOSE USERS
    console.log(`🔥 Running Streak Engine for ${activeUsers.length} active users...`);
    let totalStreaksProcessed = 0;
    
    for (const userEmail of activeUsers) {
        await evaluateUserStreaks(userEmail);
        totalStreaksProcessed++;
    }

    return NextResponse.json({ 
        message: '✅ Engine Run Complete!', 
        eventBadgesProcessed: eventBadgeResult?.count || 0,
        usersStreaksUpdated: totalStreaksProcessed
    });

  } catch (error) {
    console.error("❌ Engine Failure:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}