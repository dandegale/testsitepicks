import { createClient } from '@supabase/supabase-js';
import DashboardClient from './components/DashboardClient';

// --- CACHE FIXES ---
// This forces the page to be generated on every request
export const dynamic = 'force-dynamic';
// This prevents Next.js from caching the data for any amount of time
export const revalidate = 0; 

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default async function FightList() {
  const { data: { user } } = await supabase.auth.getUser();
  const currentUserEmail = user ? user.email : null;

  // 1. Fetch Fights
  const { data: fights } = await supabase
    .from('fights')
    .select('*')
    .order('start_time', { ascending: true });

  // 2. Fetch User's Leagues
  const { data: myMemberships } = await supabase
    .from('league_members')
    .select('leagues ( id, name, image_url, invite_code )')
    .eq('user_id', currentUserEmail);

  const myLeagues = myMemberships ? myMemberships.map(m => m.leagues).filter(Boolean) : [];

  // 3. Fetch User's Stats & Active Picks
  const { data: myPicksRaw } = await supabase
    .from('picks')
    .select('*, fight:fights(*)')
    .eq('user_id', currentUserEmail);

  const myPicks = myPicksRaw || [];
  
  // Calculate Stats
  const totalWins = myPicks.filter(p => p.result === 'Win').length;
  const totalLosses = myPicks.filter(p => p.result === 'Loss').length;

  const now = new Date();
  const myActivePicks = myPicks.filter(p => p.fight && new Date(p.fight.start_time) > now);

  // 4. Fetch Global Picks (This is the FEED of EVERYONE)
  const { data: allPicks } = await supabase
    .from('picks')
    .select('*')
    .is('league_id', null) 
    .order('id', { ascending: false })
    .limit(50); 

  // --- GROUPING LOGIC ---
  const groupFightsSmartly = (fights) => {
    if (!fights || fights.length === 0) return {};
    const groups = {};
    let currentGroupKey = null;
    let groupReferenceTime = null;

    fights.forEach((fight) => {
      const fightTime = new Date(fight.start_time);
      const dateStr = fightTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      let addToCurrent = false;
      if (groupReferenceTime) {
        const diffInHours = (fightTime - groupReferenceTime) / (1000 * 60 * 60);
        if (diffInHours < 48) addToCurrent = true;
      }

      if (addToCurrent && currentGroupKey) {
        groups[currentGroupKey].push(fight);
      } else {
        groupReferenceTime = fightTime;
        let header = fight.event_name;
        if (!header || header === 'UFC Fight Night' || header === 'Mixed Martial Arts') header = dateStr;
        if (groups[header]) header = `${header} (${dateStr})`;
        currentGroupKey = header;
        groups[currentGroupKey] = [fight];
      }
    });
    return groups;
  };

  const groupedFights = groupFightsSmartly(fights || []);
  const nextEventName = Object.keys(groupedFights)[0] || 'Upcoming Fights';
  const nextEventFights = groupedFights[nextEventName] || [];
  const mainEvent = nextEventFights.length > 0 ? nextEventFights[nextEventFights.length - 1] : null;

  return (
    <DashboardClient 
        fights={fights}
        groupedFights={groupedFights}
        allPicks={allPicks}         
        myPicks={myPicks}           
        userEmail={currentUserEmail}
        myLeagues={myLeagues}
        totalWins={totalWins}
        totalLosses={totalLosses}
        myActivePicks={myActivePicks}
        nextEventName={nextEventName}
        mainEvent={mainEvent}
    />
  );
}