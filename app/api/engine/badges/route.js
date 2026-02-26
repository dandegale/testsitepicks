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
    // We order by start_time descending to grab the most recent graded event.
    const { data: recentFights, error: fightError } = await supabase
        .from('fights')
        .select('event_id, id')
        .not('winner', 'is', null)
        .order('start_time', { ascending: false });

    if (fightError || !recentFights || recentFights.length === 0) {
        return NextResponse.json({ message: 'No graded fights found in the entire database. Run your scraper first!' });
    }

    // 2. Extract the unique event_id from the absolute most recent graded fight
    const targetEventId = recentFights[0].event_id; 

    // Filter recentFights to ONLY include fights from that specific event
    const targetEventFights = recentFights.filter(f => f.event_id === targetEventId);
    
    // 3. RUN THE EVENT BADGE ENGINE
    console.log(`🎯 Running Event Badges for Event ID: ${targetEventId}`);
    const eventBadgeResult = await awardEventBadges(targetEventId);

    // 4. Find all users who made picks on these specific event fights
    const targetFightIds = targetEventFights.map(f => f.id);
    const { data: recentPicks } = await supabase
        .from('picks')
        .select('user_id')
        .in('fight_id', targetFightIds);

    // Get a unique list of user emails who participated in this event
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