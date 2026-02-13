import { createClient } from '@supabase/supabase-js';
import DashboardClient from './components/DashboardClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0; 

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default async function FightList() {
  const { data: { user } } = await supabase.auth.getUser();
  const currentUserEmail = user ? user.email : null;

  // 1. Fetch Fights
  // FIX APPLIED: Added secondary sort .order('id', { ascending: true })
  // This ensures that if times are identical, they sort by ID (Prelims -> Main).
  const { data: fights } = await supabase
    .from('fights')
    .select('*')
    .is('winner', null) 
    .order('start_time', { ascending: true }) 
    .order('id', { ascending: true }); // <--- THE TIE-BREAKER FIX

  // 2. Fetch User Data
  const { data: myMemberships } = await supabase.from('league_members').select('leagues ( id, name, image_url, invite_code )').eq('user_id', currentUserEmail);
  const myLeagues = myMemberships ? myMemberships.map(m => m.leagues).filter(Boolean) : [];

  const { data: myPicksRaw } = await supabase.from('picks').select('*, fight:fights(*)').eq('user_id', currentUserEmail);
  const myPicks = myPicksRaw || [];
  
  const totalWins = myPicks.filter(p => p.result === 'Win').length;
  const totalLosses = myPicks.filter(p => p.result === 'Loss').length;

  const { data: allPicks } = await supabase.from('picks').select('*').is('league_id', null).order('id', { ascending: false }).limit(50); 

  // --- LOGIC: 3-DAY CLUSTERING + REVERSE ORDER ---
  let finalGroupedFights = {};
  
  if (fights && fights.length > 0) {
      // Step A: Cluster them into temporary "buckets" based on 3-day windows
      const tempGroups = [];
      let currentBucket = [];
      let groupReferenceTime = new Date(fights[0].start_time).getTime();
      const THREE_DAYS_MS = 72 * 60 * 60 * 1000;

      fights.forEach((fight) => {
          const fightTime = new Date(fight.start_time).getTime();
          
          if (fightTime - groupReferenceTime < THREE_DAYS_MS) {
              currentBucket.push(fight);
          } else {
              tempGroups.push(currentBucket);
              currentBucket = [fight];
              groupReferenceTime = fightTime;
          }
      });
      if (currentBucket.length > 0) tempGroups.push(currentBucket);

      // Step B: Name the group & Reverse the order
      tempGroups.forEach(bucket => {
          if (bucket.length === 0) return;

          // 1. Identify the Main Event
          // Since the bucket is currently Oldest -> Newest, the Main Event is the LAST item.
          const mainEventFight = bucket[bucket.length - 1];
          
          const dateStr = new Date(mainEventFight.start_time).toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric',
              timeZone: 'America/New_York'
          });

          const title = `${mainEventFight.fighter_1_name} vs ${mainEventFight.fighter_2_name} (${dateStr})`;

          // 2. THE FLIP: Reverse the bucket so the Main Event appears FIRST in the UI
          finalGroupedFights[title] = bucket.reverse(); 
      });
  }

  // Hero Section Logic
  const nextEventKey = Object.keys(finalGroupedFights)[0] || 'Upcoming Fights';
  const nextEventFights = finalGroupedFights[nextEventKey] || [];
  
  // Update Hero Logic: Since we reversed the list, the Main Event is now at INDEX 0!
  const mainEvent = nextEventFights.length > 0 ? nextEventFights[0] : null;

  return (
    <DashboardClient 
        fights={fights}
        groupedFights={finalGroupedFights}
        allPicks={allPicks}         
        myPicks={myPicks}           
        userEmail={currentUserEmail}
        myLeagues={myLeagues}
        totalWins={totalWins}
        totalLosses={totalLosses}
        nextEventName={nextEventKey}
        mainEvent={mainEvent}
    />
  );
}