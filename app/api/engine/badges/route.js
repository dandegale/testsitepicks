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

    // 🎯 THE MIDNIGHT BUG FIX: Use a 48-hour time window instead of a strict Date string
    const latestFightTime = new Date(recentFights[0].start_time).getTime();
    
    const targetEventFights = recentFights.filter(f => {
        const fightTime = new Date(f.start_time).getTime();
        // If the fight happened within 48 hours of the most recent fight, it's part of the same event!
        return Math.abs(latestFightTime - fightTime) < (48 * 60 * 60 * 1000);
    });
    
    // We extract the IDs of all the fights in this event
    const targetFightIds = targetEventFights.map(f => f.id);

    // 3. RUN THE EVENT BADGE ENGINE (Passing the Array of IDs instead of a date string)
    console.log(`🎯 Running Event Badges for ${targetFightIds.length} fights in this event window.`);
    const eventBadgeResult = await awardEventBadges(targetFightIds);

    // 4. Find all users who made picks on these specific fights
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