import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { Resend } from 'resend';

export const dynamic = 'force-dynamic';

export async function GET(request) {
    // 🛑 THE BOUNCER: Check for the secret key from cron-job.org
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 🎯 FIX: Instantiate Resend INSIDE the function so it doesn't break the build!
    const resend = new Resend(process.env.RESEND_API_KEY);

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY // Need Admin key to read all profiles
    );

    try {
        // 1. Check if there are actually fights this weekend (next 48 hours)
        const now = new Date();
        const next48Hours = new Date(now.getTime() + (48 * 60 * 60 * 1000));
        
        const { data: upcomingFights, error: fightError } = await supabase
            .from('fights')
            .select('id, event_name')
            .gte('start_time', now.toISOString())
            .lte('start_time', next48Hours.toISOString());

        if (fightError || !upcomingFights || upcomingFights.length === 0) {
            return NextResponse.json({ message: 'No fights this weekend. Sleeping.' });
        }

        const fightIds = upcomingFights.map(f => f.id);
        const eventName = upcomingFights[0].event_name;

        // 2. Get EVERY active user email from profiles
        const { data: profiles, error: profileError } = await supabase
            .from('profiles')
            .select('email, username')
            .not('email', 'is', null);

        if (profileError || !profiles) throw new Error("Could not fetch profiles");

        // 3. Get ALL picks for this specific upcoming event
        const { data: picks, error: picksError } = await supabase
            .from('picks')
            .select('user_id')
            .in('fight_id', fightIds);

        if (picksError) throw new Error("Could not fetch picks");

        // 4. Find the slackers (Users who have 0 picks for this event)
        const usersWithPicks = new Set(picks.map(p => p.user_id));
        const slackers = profiles.filter(profile => !usersWithPicks.has(profile.email));

        if (slackers.length === 0) {
            return NextResponse.json({ message: 'Everyone has locked in their picks!' });
        }

        console.log(`Sending reminders to ${slackers.length} users...`);

        // 5. Send the emails (Batching them to avoid rate limits)
        const emailPromises = slackers.map(user => {
            const username = user.username || 'Manager';
            
            return resend.emails.send({
// To exactly this:
from: 'FightIQ <onboarding@resend.dev>',                to: user.email,
                subject: `🚨 Lock in your picks for ${eventName}!`,
                html: `
                    <div style="font-family: sans-serif; background-color: #050505; color: #ffffff; padding: 40px; text-align: center; border-radius: 10px;">
                        <h1 style="color: #db2777; font-style: italic; text-transform: uppercase;">FightIQ</h1>
                        <h2 style="text-transform: uppercase;">Fight Day is Here, ${username}!</h2>
                        <p style="color: #9ca3af; font-size: 16px; line-height: 1.5;">
                            You haven't locked in your 5-man fantasy roster for <strong>${eventName}</strong> yet. Don't leave free points and coins on the table!
                        </p>
                        <p style="color: #9ca3af; font-size: 16px; line-height: 1.5; margin-bottom: 30px;">
                            The prelims are starting soon. Jump in, scout the odds, and lock in your squad before the first bell rings.
                        </p>
                        <a href="https://yourwebsite.com" style="background-color: #db2777; color: #ffffff; padding: 15px 30px; text-decoration: none; font-weight: bold; border-radius: 8px; text-transform: uppercase; letter-spacing: 2px;">
                            Lock In Picks Now
                        </a>
                    </div>
                `
            });
        });

        await Promise.all(emailPromises);

        return NextResponse.json({ message: `Successfully reminded ${slackers.length} slackers.` });

    } catch (error) {
        console.error('Reminder Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}