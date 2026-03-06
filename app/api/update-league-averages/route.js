import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
    // 1. Initialize Supabase with the Service Role Key to bypass RLS policies for background tasks
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return NextResponse.json({ error: 'Missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 });
    }

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    try {
        const logs = [];

        // 2. Fetch all required data
        const { data: leagues } = await supabase.from('leagues').select('id, name');
        const { data: picks } = await supabase.from('picks').select('league_id, user_id, selected_fighter').not('league_id', 'is', null);
        const { data: stats } = await supabase.from('fighter_historical_stats').select('fighter_name, average_fantasy_points');

        if (!leagues || !picks || !stats) {
            return NextResponse.json({ error: "Missing data from database." }, { status: 400 });
        }

        // 3. Create a quick lookup dictionary for fighter stats
        const statsMap = {};
        stats.forEach(stat => {
            const cleanName = stat.fighter_name.toLowerCase().replace(/[^a-z]/g, '');
            statsMap[cleanName] = stat.average_fantasy_points || 0;
        });

        // 4. Calculate the average for each league
        for (const league of leagues) {
            // Get all picks for this specific league
            const leaguePicks = picks.filter(p => String(p.league_id) === String(league.id));
            
            if (leaguePicks.length === 0) {
                logs.push(`Skipped ${league.name} (0 picks)`);
                continue;
            }

            // Group picks by user to calculate each user's total roster projection
            const userRosters = {};
            leaguePicks.forEach(pick => {
                if (!userRosters[pick.user_id]) userRosters[pick.user_id] = 0;
                
                const cleanPickName = pick.selected_fighter.toLowerCase().replace(/[^a-z]/g, '');
                const points = statsMap[cleanPickName] || 0;
                
                userRosters[pick.user_id] += points;
            });

            // Calculate the league's overall average based on the users' rosters
            const userTotals = Object.values(userRosters);
            const leagueTotalPoints = userTotals.reduce((sum, pts) => sum + pts, 0);
            const leagueAverage = leagueTotalPoints / userTotals.length;

            // Round to 1 decimal place (e.g., 345.6)
            const finalScore = parseFloat(leagueAverage.toFixed(1));

            // 5. Save back to the database
            const { error } = await supabase
                .from('leagues')
                .update({ average_score: finalScore })
                .eq('id', league.id);

            if (error) {
                logs.push(`❌ Error updating ${league.name}: ${error.message}`);
            } else {
                logs.push(`✅ Updated ${league.name}: ${finalScore} pts`);
            }
        }

        return NextResponse.json({ message: "League averages updated successfully!", logs });

    } catch (error) {
        console.error("Calculation Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}