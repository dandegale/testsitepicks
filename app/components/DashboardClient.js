'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js'; 
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import LogOutButton from './LogOutButton';
import ChatBox from './ChatBox'; 
import FightDashboard from './FightDashboard';
import GlobalActivityFeed from './GlobalActivityFeed'; 
import LeagueRail from './LeagueRail'; 
import BettingSlip from './BettingSlip'; 
import MobileNav from './MobileNav'; 

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

// --- Countdown Timer ---
const CountdownDisplay = ({ targetDate }) => {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [isExpired, setIsExpired] = useState(false);
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date().getTime();
      const eventTime = new Date(targetDate).getTime();
      const distance = eventTime - now;
      if (distance <= 0) { setIsExpired(true); clearInterval(timer); } 
      else { setIsExpired(false); setTimeLeft({ days: Math.floor(distance / (86400000)), hours: Math.floor((distance % (86400000)) / (3600000)), minutes: Math.floor((distance % (3600000)) / (60000)), seconds: Math.floor((distance % (60000)) / 1000) }); }
    }, 1000);
    return () => clearInterval(timer);
  }, [targetDate]);
  const Unit = ({ value, label }) => ( <div className="flex flex-col items-center px-3 py-1 bg-black/60 border border-gray-800 rounded-lg min-w-[55px]"> <span className="text-lg font-black text-pink-500 tabular-nums leading-none">{value}</span> <span className="text-[7px] font-black uppercase text-gray-500 tracking-tighter mt-1">{label}</span> </div> );
  if (isExpired) return ( <div className="flex items-center gap-2 px-4 py-3 bg-red-950/20 border border-red-900/50 rounded-lg"> <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></span> <span className="text-red-500 font-black uppercase italic text-[10px] tracking-widest">Picks Locked</span> </div> );
  return ( <div className="flex gap-2"> <Unit value={timeLeft.days} label="Days" /> <Unit value={timeLeft.hours} label="Hrs" /> <Unit value={timeLeft.minutes} label="Min" /> <Unit value={timeLeft.seconds} label="Sec" /> </div> );
};

export default function DashboardClient({ 
  fights, groupedFights: initialGroupedFights, allPicks, myPicks, userEmail, myLeagues, totalWins, totalLosses, nextEventName, mainEvent 
}) {
  const router = useRouter();
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [pendingPicks, setPendingPicks] = useState([]); 
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showMobileLeagues, setShowMobileLeagues] = useState(false); 
  const [showMobileSlip, setShowMobileSlip] = useState(false);
  
  const [showOdds, setShowOdds] = useState(false); 
  
  const [clientPicks, setClientPicks] = useState(myPicks || []);
  const [careerStats, setCareerStats] = useState({ wins: 0, losses: 0 });

  const liveWinPercentage = (careerStats.wins + careerStats.losses) > 0 
      ? (careerStats.wins / (careerStats.wins + careerStats.losses)) * 100 
      : 0;

  const eventDate = mainEvent?.start_time || "2026-02-01T22:00:00"; 
  const safeEventName = nextEventName || "Upcoming Event";

  // --- GHOST FILTER LOGIC ---
  const { cleanFights, cleanGroups } = useMemo(() => {
      if (!fights) return { cleanFights: [], cleanGroups: {} };

      const now = new Date().getTime();
      const TWELVE_HOURS = 12 * 60 * 60 * 1000;

      const validFights = fights.filter(f => {
          if (f.winner) return true; 
          const fTime = new Date(f.start_time).getTime();
          return fTime > (now - TWELVE_HOURS);
      });

      validFights.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

      let finalGroupedFights = {};
      const tempGroups = [];
      let currentBucket = [];
      
      let groupReferenceTime = validFights.length > 0 ? new Date(validFights[0].start_time).getTime() : 0;
      const THREE_DAYS_MS = 72 * 60 * 60 * 1000;

      validFights.forEach((fight) => {
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

      tempGroups.forEach(bucket => {
          if (bucket.length === 0) return;
          const mainEventFight = bucket[bucket.length - 1];
          const dateStr = new Date(mainEventFight.start_time).toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric' 
          });
          const title = `${mainEventFight.fighter_1_name} vs ${mainEventFight.fighter_2_name} (${dateStr})`;
          finalGroupedFights[title] = [...bucket].reverse();
      });

      return { cleanFights: validFights, cleanGroups: finalGroupedFights };
  }, [fights]);


  const fetchUserData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user && user.email) {
        
        // 1. Fetch Picks
        const { data: picksData } = await supabase
            .from('picks')
            .select('*')
            .eq('user_id', user.email);
        
        if (picksData) {
            setClientPicks(picksData); 
        
            // 2. Fetch ALL completed fights
            const { data: results } = await supabase
                .from('fights')
                .select('id, winner')
                .not('winner', 'is', null);

            if (results) {
                let w = 0;
                let l = 0;
                
                // --- FIX: DEDUPLICATION LOGIC ---
                // We use a Set to track fight IDs we have already counted for this user.
                const processedFightIds = new Set();

                picksData.forEach(p => {
                    // Skip if we already counted this fight (e.g. same pick in 2 leagues)
                    if (processedFightIds.has(p.fight_id)) return;

                    const fight = results.find(f => f.id === p.fight_id);
                    if (fight && fight.winner) {
                        if (fight.winner === p.selected_fighter) w++;
                        else l++;
                        
                        // Mark this fight as counted
                        processedFightIds.add(p.fight_id);
                    }
                });
                setCareerStats({ wins: w, losses: l });
            }
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('show_odds')
            .eq('id', user.id)
            .single();

        if (profile && profile.show_odds === true) {
            setShowOdds(true);
        }
    }
  };

  useEffect(() => {
    fetchUserData();
  }, []);

  const handleInteraction = () => {
    setIsFocusMode(true);
  };

  const handlePickSelect = (newPick) => {
    setPendingPicks(currentPicks => {
        const existingIndex = currentPicks.findIndex(p => p.fightId === newPick.fightId);
        if (existingIndex >= 0) {
            const existingPick = currentPicks[existingIndex];
            if (existingPick.fighterName === newPick.fighterName) {
                return currentPicks.filter((_, i) => i !== existingIndex);
            } else {
                const updated = [...currentPicks];
                updated[existingIndex] = newPick;
                return updated;
            }
        }
        return [...currentPicks, newPick];
    });
    setIsFocusMode(true); 
  };

  const handleRemovePick = (fightId) => {
    setPendingPicks(current => {
        const updated = current.filter(p => p.fightId !== fightId);
        if (updated.length === 0) setShowMobileSlip(false);
        return updated;
    });
    if (pendingPicks.length <= 1) setIsFocusMode(false);
  };

  const handleConfirmAllPicks = async () => {
    if (pendingPicks.length === 0) return;
    setIsSubmitting(true);

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user || !user.email) {
        alert("You must be logged in to lock picks.");
        setIsSubmitting(false);
        return;
    }

    const username = user.user_metadata?.username || user.email.split('@')[0];

    const picksToInsert = pendingPicks.map(p => ({
        user_id: user.email,
        username: username, 
        fight_id: p.fightId,
        selected_fighter: p.fighterName,
        odds_at_pick: parseInt(p.odds, 10),
        league_id: p.leagueId || null
    }));

    const { error } = await supabase.from('picks').insert(picksToInsert);

    if (error) {
        console.error("Submission Error:", error);
        alert(`Error saving picks: ${error.message}`);
        setIsSubmitting(false);
    } else {
        setPendingPicks([]); 
        setIsSubmitting(false);
        setIsFocusMode(false);
        setShowMobileSlip(false);
        window.location.reload(); 
    }
  };

  return (
    <div className="flex min-h-screen bg-black text-white overflow-hidden font-sans selection:bg-pink-500 selection:text-white">
      
      {/* --- DESKTOP RAIL --- */}
      <div className={`hidden md:block transition-all duration-500 ${isFocusMode ? '-ml-20' : 'ml-0'}`}>
        <LeagueRail initialLeagues={myLeagues} />
      </div>

      {/* --- MOBILE LEAGUE DRAWER --- */}
      <div className={`fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm transition-opacity duration-300 md:hidden ${showMobileLeagues ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={() => setShowMobileLeagues(false)}>
         <div className={`absolute left-0 top-0 bottom-0 w-[80%] max-w-[300px] bg-gray-900 border-r border-gray-800 transform transition-transform duration-300 ${showMobileLeagues ? 'translate-x-0' : '-translate-x-full'}`} onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-800 flex justify-between items-center">
                <span className="font-black italic text-xl">YOUR LEAGUES</span>
                <button onClick={() => setShowMobileLeagues(false)} className="text-gray-500 hover:text-white transition-colors">✕</button>
            </div>
            <div className="p-4">
                <LeagueRail initialLeagues={myLeagues} />
            </div>
         </div>
      </div>

      <main className="flex-1 h-screen overflow-y-auto scrollbar-hide relative flex flex-col pb-24 md:pb-0"> 
        
        <header className={`sticky top-0 z-[60] w-full bg-black/80 backdrop-blur-xl border-b border-gray-800 transition-all duration-500 ${isFocusMode ? '-translate-y-full' : 'translate-y-0'}`}>
            <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/" className="text-2xl font-black italic text-white tracking-tighter uppercase">
                        FIGHT<span className="text-pink-600">IQ</span>
                    </Link>
                    <div className="h-4 w-px bg-gray-800 mx-2"></div>
                    <nav className="hidden md:flex gap-6 text-[10px] font-black uppercase tracking-widest text-gray-500">
                        <Link href="/my-picks" className="hover:text-white transition-colors">My Picks</Link>
                        <span className="text-pink-600 cursor-default">Global Feed</span>
                        <Link href="/leaderboard" className="hover:text-white transition-colors">Leaderboards</Link>
                    </nav>
                </div>
                <div className="flex items-center gap-4 md:gap-6">
                    <div className="flex items-center gap-3 pr-4 border-r border-gray-800">
                        <div className="text-right">
                            <p className="text-[9px] font-black text-gray-600 uppercase tracking-tighter leading-none mb-1">Career Record</p>
                            <p className="text-sm font-black italic text-white leading-none">
                                {careerStats.wins}W - {careerStats.losses}L
                            </p>
                        </div>
                        <div className="w-8 h-8 rounded-full border border-gray-800 flex items-center justify-center relative text-[8px] font-black">
                            {Math.round(liveWinPercentage)}%
                            <svg className="absolute inset-0 w-full h-full -rotate-90">
                                <circle cx="16" cy="16" r="14" fill="none" stroke="#111" strokeWidth="1.5" />
                                <circle cx="16" cy="16" r="14" fill="none" stroke="#db2777" strokeWidth="1.5" strokeDasharray="88" strokeDashoffset={88 - (88 * liveWinPercentage) / 100} />
                            </svg>
                        </div>
                    </div>
                    <Link href="/profile" className="hidden md:flex bg-gray-900 hover:bg-gray-800 border border-gray-700 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-gray-300 hover:text-white transition-all items-center gap-2">
                        <span>My Profile</span>
                    </Link>
                    <div className="hidden md:block">
                        <LogOutButton />
                    </div>
                </div>
            </div>
        </header>

        {isFocusMode && (
             <button onClick={() => { setIsFocusMode(false); setPendingPicks([]); }} className="fixed top-6 right-6 z-[70] bg-gray-950 text-white px-6 py-3 rounded-full font-bold uppercase text-xs border border-pink-500 shadow-[0_0_20px_rgba(236,72,153,0.3)] hover:bg-pink-600 transition-all hidden md:block">
                ✕ Close Picks
             </button>
        )}

        <div className={`relative w-full bg-gray-900 overflow-hidden border-b border-gray-800 transition-all duration-700 ${isFocusMode ? 'h-0 opacity-0' : 'h-[15vh] min-h-[120px]'}`}>
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent z-10" />
            <div className="absolute inset-0 flex flex-col justify-end p-4 md:p-6 z-20">
                <div className="max-w-7xl mx-auto w-full flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <h1 className="text-4xl md:text-5xl font-black italic uppercase tracking-tighter mb-1 leading-none">CHOOSE YOUR FIGHTER</h1>
                        <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">{safeEventName.split('(')[0]}</p>
                    </div>
                    <div className="pb-1">
                        <p className="text-[9px] font-black text-gray-500 uppercase tracking-[0.2em] mb-2 md:text-right">Lock In Deadline</p>
                        <CountdownDisplay targetDate={eventDate} />
                    </div>
                </div>
            </div>
        </div>

        <div className="p-4 md:p-10 max-w-7xl mx-auto min-h-screen">
            <div className={`mb-8 transition-all duration-500 origin-top ${isFocusMode ? 'scale-y-0 h-0 opacity-0 mb-0' : 'scale-y-100'}`}>
                <div className="flex overflow-x-auto pb-4 gap-4 md:flex-wrap scrollbar-hide">
                    {(myLeagues || []).map(league => (
                        <Link key={league.id} href={`/league/${league.id}`} className="group flex flex-col items-center shrink-0" title={league.name}>
                            <div className="w-12 h-12 rounded-full bg-gray-950 border border-gray-800 group-hover:border-pink-600 flex items-center justify-center text-[10px] font-bold text-gray-500 group-hover:text-pink-600 transition-all shadow-lg overflow-hidden shrink-0">
                                {league.name.substring(0,2).toUpperCase()}
                            </div>
                        </Link>
                    ))}
                </div>
            </div>

            <div className="relative flex w-full">
                <div className={`transition-all duration-700 ease-in-out w-full xl:w-[66%] ${isFocusMode ? 'xl:mx-auto' : ''}`}>
                    <div className="flex items-center gap-2 mb-6">
                        <span className={`w-2 h-2 rounded-full bg-teal-500 animate-pulse ${isFocusMode ? 'opacity-0' : ''}`}></span>
                        <h2 className={`text-xl font-black uppercase italic tracking-tighter ${isFocusMode ? 'text-pink-600' : ''}`}>
                            {isFocusMode ? 'Lock Your Picks' : 'Global Fight Card'}
                        </h2>
                    </div>
                    
                    <div className={`transition-all ${isFocusMode ? '[&_button]:animate-pulse' : ''}`}>
                        <FightDashboard 
                            fights={cleanFights} 
                            groupedFights={cleanGroups} 
                            initialPicks={allPicks} 
                            userPicks={clientPicks} 
                            league_id={null} 
                            onInteractionStart={handleInteraction}
                            onPickSelect={handlePickSelect} 
                            pendingPicks={pendingPicks}
                            showOdds={showOdds} 
                        />
                    </div>
                </div>

                <div className={`hidden xl:block ml-10 space-y-8 transition-all duration-700 w-[33%] relative`}>
                    {pendingPicks.length > 0 ? (
                         <div className="sticky top-24 max-h-[calc(100vh-120px)] min-w-[350px] bg-gray-950 border border-gray-800 rounded-xl p-6 shadow-2xl overflow-y-auto">
                             <BettingSlip 
                                picks={pendingPicks} 
                                onCancelAll={() => setPendingPicks([])}
                                onRemovePick={handleRemovePick}
                                onConfirm={handleConfirmAllPicks}
                                isSubmitting={isSubmitting}
                             />
                         </div>
                    ) : (
                         <div className={`transition-opacity duration-300 ${isFocusMode ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                            <div className="min-w-[350px] mb-8 bg-gray-950 border border-gray-900 rounded-xl overflow-hidden p-4 shadow-lg">
                                <div className="flex justify-between items-center mb-4 px-2">
                                    <h3 className="text-[10px] font-black text-gray-600 uppercase tracking-[0.2em]">Live Feed</h3>
                                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                                </div>
                                <GlobalActivityFeed initialPicks={allPicks} currentUserEmail={userEmail} />
                            </div>

                            <div className="h-[600px] min-w-[350px] flex flex-col">
                                <div className="flex justify-between items-center mb-4 px-2">
                                    <h3 className="text-[10px] font-black text-gray-600 uppercase tracking-[0.2em]">Global Trash Talk</h3>
                                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                </div>
                                <div className="flex-1 shadow-2xl shadow-black overflow-hidden rounded-xl border border-gray-900">
                                    <ChatBox league_id={null} />
                                </div>
                            </div>
                         </div>
                    )}
                </div>
            </div>
        </div>
      </main>

      {/* --- MOBILE: BOTTOM FLOATING BAR --- */}
      {pendingPicks.length > 0 && (
          <div className="md:hidden fixed bottom-20 left-4 right-4 z-50 animate-in slide-in-from-bottom-10 fade-in duration-300">
            <button 
              onClick={() => setShowMobileSlip(true)}
              className="w-full bg-pink-600 text-white p-4 rounded-xl shadow-2xl shadow-pink-900/50 flex justify-between items-center border border-pink-400 active:scale-95 transition-transform"
            >
              <div className="flex items-center gap-3">
                <span className="bg-black/20 px-3 py-1 rounded-lg text-xs font-black">
                  {pendingPicks.length}
                </span>
                <span className="text-sm font-black uppercase italic tracking-tighter">
                  Picks in Slip
                </span>
              </div>
              <span className="text-xs font-bold uppercase tracking-widest">Review & Submit →</span>
            </button>
          </div>
      )}

      {/* --- MOBILE: FULL SCREEN SLIP MODAL --- */}
      {showMobileSlip && (
          <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm md:hidden flex items-end">
            <div className="w-full h-[85vh] bg-gray-950 rounded-t-2xl border-t border-gray-800 flex flex-col shadow-2xl animate-in slide-in-from-bottom-full duration-300">
               <div className="p-4 border-b border-gray-800 flex justify-between items-center">
                  <h3 className="font-black italic text-xl text-white uppercase tracking-tighter">Your Slip</h3>
                  <button onClick={() => setShowMobileSlip(false)} className="text-gray-500 hover:text-white p-2 text-xs font-bold uppercase tracking-widest">✕ Close</button>
               </div>
               <div className="flex-1 overflow-y-auto p-4">
                  <BettingSlip 
                     picks={pendingPicks} 
                     onCancelAll={() => { setPendingPicks([]); setShowMobileSlip(false); }}
                     onRemovePick={handleRemovePick}
                     onConfirm={handleConfirmAllPicks}
                     isSubmitting={isSubmitting}
                  />
               </div>
            </div>
          </div>
      )}

      {/* --- MOBILE BOTTOM NAV --- */}
      <MobileNav onToggleLeagues={() => setShowMobileLeagues(true)} />

    </div>
  );
}