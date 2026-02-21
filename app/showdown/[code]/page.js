'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';

import FightDashboard from '../../components/FightDashboard';
import BettingSlip from '../../components/BettingSlip';
import LeagueRail from '../../components/LeagueRail';
import MobileNav from '../../components/MobileNav';
import LogOutButton from '../../components/LogOutButton';
import ShowdownModal from '../../components/ShowdownModal';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export default function ShowdownPage() {
  const { code } = useParams();
  const [match, setMatch] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fights, setFights] = useState([]);
  const [h2hPicks, setH2hPicks] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // States matching DashboardClient exactly
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [pendingPicks, setPendingPicks] = useState([]); 
  const [showMobileLeagues, setShowMobileLeagues] = useState(false); 
  const [showMobileSlip, setShowMobileSlip] = useState(false);
  const [showShowdown, setShowShowdown] = useState(false);
  const [clientLeagues, setClientLeagues] = useState([]);
  
  const [creatorName, setCreatorName] = useState('');
  const [opponentName, setOpponentName] = useState('');
  const [currentUsername, setCurrentUsername] = useState('');
  const [showComparisons, setShowComparisons] = useState(false);
  
  // Career Stats for Header
  const [careerStats, setCareerStats] = useState({ wins: 0, losses: 0 });
  const liveWinPercentage = (careerStats.wins + careerStats.losses) > 0 
      ? (careerStats.wins / (careerStats.wins + careerStats.losses)) * 100 
      : 0;

  useEffect(() => {
    loadShowdown();
  }, [code]);

  const loadShowdown = async () => {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    setUser(currentUser);

    const { data: matchData } = await supabase.from('h2h_matches').select('*').eq('invite_code', code).single();
    if (!matchData) return setLoading(false);
    
    let currentMatchData = matchData;

    if (currentUser && matchData.creator_email !== currentUser.email && !matchData.opponent_email) {
      await supabase.from('h2h_matches').update({ opponent_email: currentUser.email, status: 'active' }).eq('id', matchData.id);
      currentMatchData = { ...matchData, opponent_email: currentUser.email, status: 'active' };
    }
    
    setMatch(currentMatchData);

    const emailsToFetch = [currentMatchData.creator_email];
    if (currentMatchData.opponent_email) emailsToFetch.push(currentMatchData.opponent_email);

    const { data: profiles } = await supabase.from('profiles').select('email, username').in('email', emailsToFetch);

    if (profiles) {
        const creatorProfile = profiles.find(p => p.email === currentMatchData.creator_email);
        setCreatorName(creatorProfile?.username || currentMatchData.creator_email.split('@')[0]);

        if (currentMatchData.opponent_email) {
            const oppProfile = profiles.find(p => p.email === currentMatchData.opponent_email);
            setOpponentName(oppProfile?.username || currentMatchData.opponent_email.split('@')[0]);
        }
        
        if (currentUser) {
            const myProfile = profiles.find(p => p.email === currentUser.email);
            setCurrentUsername(myProfile?.username || currentUser.user_metadata?.username || currentUser.email.split('@')[0]);
            
            // Fetch User Leagues
            const { data: memberships } = await supabase
                .from('league_members')
                .select('leagues ( id, name, image_url, invite_code )')
                .eq('user_id', currentUser.email);
            
            if (memberships) {
                const validLeagues = memberships.map(m => m.leagues).filter(Boolean);
                setClientLeagues(validLeagues);
            }

            // Fetch Career Stats
            const { data: picksData } = await supabase.from('picks').select('*').eq('user_id', currentUser.email);
            if (picksData) {
                const { data: results } = await supabase.from('fights').select('id, winner').not('winner', 'is', null);
                if (results) {
                    let w = 0; let l = 0;
                    const processedFightIds = new Set();
                    picksData.forEach(p => {
                        if (processedFightIds.has(p.fight_id)) return;
                        const fight = results.find(f => f.id === p.fight_id);
                        if (fight && fight.winner) {
                            if (fight.winner === p.selected_fighter) w++; else l++;
                            processedFightIds.add(p.fight_id);
                        }
                    });
                    setCareerStats({ wins: w, losses: l });
                }
            }
        }
    } else {
        setCreatorName(currentMatchData.creator_email.split('@')[0]);
        if (currentMatchData.opponent_email) setOpponentName(currentMatchData.opponent_email.split('@')[0]);
        if (currentUser) setCurrentUsername(currentUser.user_metadata?.username || currentUser.email.split('@')[0]);
    }

    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const { data: fightData } = await supabase.from('fights').select('*').gte('start_time', fourteenDaysAgo).order('start_time', { ascending: true });
    const { data: picksData } = await supabase.from('h2h_picks').select('*').eq('match_id', currentMatchData.id);
    
    setFights(fightData || []);
    setH2hPicks(picksData || []);
    setLoading(false);
  };

  const handleInteraction = () => setIsFocusMode(true);

  const handlePickSelect = (newPick) => {
    const safePick = {
        ...newPick,
        odds: newPick.odds || -110,
        username: currentUsername 
    };

    setPendingPicks(currentPicks => {
        const existingIndex = currentPicks.findIndex(p => p.fightId === safePick.fightId);
        if (existingIndex >= 0) {
            const existingPick = currentPicks[existingIndex];
            if (existingPick.fighterName === safePick.fighterName) return currentPicks.filter((_, i) => i !== existingIndex);
            else { const updated = [...currentPicks]; updated[existingIndex] = safePick; return updated; }
        }
        return [...currentPicks, safePick];
    });
    setIsFocusMode(true);
  };

  const handleRemovePick = (fightId) => {
    setPendingPicks(current => {
        const updated = current.filter(p => p.fightId !== fightId);
        if (updated.length === 0) {
            setShowMobileSlip(false);
            setIsFocusMode(false);
        }
        return updated;
    });
  };

  const handleConfirmAllPicks = async () => {
    if (pendingPicks.length === 0) return;
    if (!user) return alert("Log in to lock picks!");
    
    setIsSubmitting(true);
    
    const picksToInsert = pendingPicks.map(p => ({
        match_id: match.id,
        user_email: user.email,
        fight_id: p.fightId,
        selected_fighter: p.fighterName
    }));

    const { error } = await supabase.from('h2h_picks').upsert(
        picksToInsert, 
        { onConflict: 'match_id, user_email, fight_id' } 
    );

    if (error) {
        console.error("Submission Error:", error);
        alert("Failed to lock in picks. Please try again.");
    } else {
        const { data: updated } = await supabase.from('h2h_picks').select('*').eq('match_id', match.id);
        setH2hPicks(updated);
        setPendingPicks([]);
        setShowMobileSlip(false);
        setIsFocusMode(false);
    }
    
    setIsSubmitting(false);
  };

  const getOpponentPick = (fightId) => {
    const opponentEmail = user?.email === match?.creator_email ? match?.opponent_email : match?.creator_email;
    return h2hPicks.find(p => p.fight_id === fightId && p.user_email === opponentEmail);
  };

  let creatorScore = 0;
  let opponentScore = 0;

  fights.forEach(fight => {
      if (fight.winner) {
          const cPick = h2hPicks.find(p => p.fight_id === fight.id && p.user_email === match?.creator_email);
          const oPick = h2hPicks.find(p => p.fight_id === fight.id && p.user_email === match?.opponent_email);
          
          if (cPick && cPick.selected_fighter === fight.winner) creatorScore++;
          if (oPick && oPick.selected_fighter === fight.winner) opponentScore++;
      }
  });

  // 🎯 NEW LOGIC: strictly isolates only THIS WEEKEND'S EVENT
  const { thisWeekendAllFights, upcomingFights, groupedFights } = useMemo(() => {
      if (!fights || fights.length === 0) return { thisWeekendAllFights: [], upcomingFights: [], groupedFights: {} };
      
      const now = new Date().getTime();
      const TWO_DAYS = 2 * 24 * 60 * 60 * 1000;
      
      // 1. Filter out old events, keep anything from 2 days ago onward
      let validFights = fights.filter(f => f?.start_time && new Date(f.start_time).getTime() > (now - TWO_DAYS));
      validFights.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
      
      if (validFights.length === 0) return { thisWeekendAllFights: [], upcomingFights: [], groupedFights: {} };

      // 2. Group into 72-hour event buckets
      const tempGroups = [];
      let currentBucket = [];
      let groupReferenceTime = new Date(validFights[0].start_time).getTime();
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

      // 3. STRICTLY ISOLATE "THIS WEEKEND" (The very first bucket)
      const thisWeekendBucket = tempGroups[0] || [];
      const incompleteFights = thisWeekendBucket.filter(f => !f.winner);

      let finalGroups = {};
      if (thisWeekendBucket.length > 0) {
          const mainEventFight = thisWeekendBucket[thisWeekendBucket.length - 1];
          const dateStr = new Date(mainEventFight.start_time).toLocaleDateString('en-US', { 
              month: 'short', day: 'numeric', timeZone: 'America/New_York' 
          });
          const title = `${mainEventFight.fighter_1_name} vs ${mainEventFight.fighter_2_name} (${dateStr})`;
          
          if (incompleteFights.length > 0) {
              finalGroups[title] = [...incompleteFights].reverse();
          }
      }

      return { 
          thisWeekendAllFights: thisWeekendBucket, 
          upcomingFights: incompleteFights, 
          groupedFights: finalGroups 
      };
  }, [fights]);

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-pink-500 font-black italic">ENTERING THE OCTAGON...</div>;

  return (
    <div className="flex min-h-screen bg-black text-white overflow-hidden font-sans selection:bg-pink-500 selection:text-white">
      
      {/* DESKTOP RAIL */}
      <div className={`hidden md:block transition-all duration-500 shrink-0 border-r border-gray-800 relative z-50 ${isFocusMode ? '-ml-20' : 'ml-0'}`}>
        <LeagueRail initialLeagues={clientLeagues} />
      </div>

      {/* MOBILE DRAWER */}
      <div className={`fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm transition-opacity duration-300 md:hidden ${showMobileLeagues ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={() => setShowMobileLeagues(false)}>
         <div className={`absolute left-0 top-0 bottom-0 w-[80%] max-w-[300px] bg-gray-900 border-r border-gray-800 transform transition-transform duration-300 ${showMobileLeagues ? 'translate-x-0' : '-translate-x-full'}`} onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-800 flex justify-between items-center">
                <span className="font-black italic text-xl">YOUR LEAGUES</span>
                <button onClick={() => setShowMobileLeagues(false)} className="text-gray-500 hover:text-white transition-colors">✕</button>
            </div>
            <div className="p-4 space-y-6">
                <div className="flex flex-col gap-3">
                    {clientLeagues && clientLeagues.length > 0 ? (
                        clientLeagues.map(league => (
                            <Link key={league.id} href={`/league/${league.id}`} className="flex items-center gap-4 p-3 rounded-xl bg-gray-800/40 hover:bg-gray-800 border border-gray-700/50 hover:border-pink-500/50 transition-all group">
                                <div className="w-10 h-10 rounded-full bg-gray-900 border border-gray-600 flex items-center justify-center text-[10px] font-black text-gray-400 group-hover:text-pink-500 group-hover:border-pink-500 transition-all shrink-0">
                                     {league.name ? league.name.substring(0,2).toUpperCase() : 'LG'}
                                </div>
                                <span className="font-bold text-sm text-gray-300 group-hover:text-white truncate">
                                    {league.name}
                                </span>
                            </Link>
                        ))
                    ) : (
                        <div className="p-4 border border-dashed border-gray-800 rounded-xl text-center">
                            <p className="text-gray-600 text-[10px] font-bold uppercase tracking-widest mb-2">No Leagues Joined</p>
                        </div>
                    )}
                </div>
            </div>
         </div>
      </div>

      <main className="flex-1 h-screen overflow-y-auto scrollbar-hide relative flex flex-col pb-24 md:pb-0"> 
        
        {/* HEADER */}
        <header className={`sticky top-0 z-[60] w-full bg-black/80 backdrop-blur-xl border-b border-gray-800 transition-all duration-500 ${isFocusMode ? '-translate-y-full' : 'translate-y-0'}`}>
            <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/" className="text-xl md:text-2xl font-black italic text-white tracking-tighter uppercase">
                        FIGHT<span className="text-pink-600">IQ</span>
                    </Link>
                    <div className="hidden md:block h-4 w-px bg-gray-800 mx-2"></div>
                    <nav className="hidden lg:flex gap-6 text-[10px] font-black uppercase tracking-widest text-gray-500">
                        <Link href="/my-picks" className="hover:text-white transition-colors">My Picks</Link>
                        <Link href="/" className="hover:text-white transition-colors">Global Feed</Link>
                        <Link href="/leaderboard" className="hover:text-white transition-colors">Leaderboards</Link>
                    </nav>
                </div>
                <div className="flex items-center gap-3 md:gap-6">
                    <button 
                        onClick={() => setShowShowdown(true)}
                        className="flex bg-gradient-to-r from-pink-600 to-teal-600 hover:from-pink-500 hover:to-teal-500 border border-gray-700 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-white shadow-[0_0_15px_rgba(219,39,119,0.2)] hover:shadow-[0_0_20px_rgba(20,184,166,0.4)] transition-all items-center gap-2 active:scale-95"
                    >
                        <span>⚔️</span>
                        <span className="hidden sm:inline">1v1 Showdown</span>
                        <span className="sm:hidden">1v1</span>
                    </button>
                    <div className="hidden md:flex items-center gap-3 px-4 border-x border-gray-800">
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
                    <Link href="/profile" className="hidden lg:flex bg-gray-900 hover:bg-gray-800 border border-gray-700 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-gray-300 hover:text-white transition-all items-center gap-2">
                        <span>My Profile</span>
                    </Link>
                    <div className="hidden md:block">
                        <LogOutButton />
                    </div>
                </div>
            </div>
        </header>

        {/* CLOSE PICKS BUTTON */}
        {isFocusMode && (
             <button onClick={() => { setIsFocusMode(false); setPendingPicks([]); }} className="fixed top-6 right-6 z-[70] bg-gray-950 text-white px-6 py-3 rounded-full font-bold uppercase text-xs border border-pink-500 shadow-[0_0_20px_rgba(236,72,153,0.3)] hover:bg-pink-600 transition-all hidden md:block">
                ✕ Close Picks
             </button>
        )}

        {/* HERO BANNER */}
        <div className={`relative w-full bg-gray-900 overflow-hidden border-b border-gray-800 transition-all duration-700 ${isFocusMode ? 'h-0 opacity-0 min-h-0 border-transparent' : 'h-[250px] min-h-[250px]'}`}>
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent z-10" />
            <div className="absolute inset-0 flex flex-col justify-center p-4 md:p-6 z-20">
                <div className="max-w-7xl mx-auto w-full flex flex-row items-center justify-center gap-4 md:gap-16">
                    <div className="text-center group flex flex-col items-center w-28 md:w-48">
                      <img src="/pink-gloves.png" className="w-16 md:w-32 drop-shadow-[0_0_30px_rgba(219,39,119,0.4)] transition-transform group-hover:scale-110 duration-500" />
                      <p className="text-pink-500 font-black uppercase text-[10px] md:text-xs mt-3 tracking-widest w-full truncate">{creatorName}</p>
                    </div>
                    <div className="flex flex-col items-center shrink-0">
                        <div className="flex items-center gap-2 md:gap-6 text-3xl md:text-5xl font-black italic tracking-tighter mb-1">
                            <span className="text-pink-500">{creatorScore}</span>
                            <span className="text-gray-700">-</span>
                            <span className="text-teal-400">{opponentScore}</span>
                        </div>
                        <div className="text-lg md:text-2xl font-black italic text-gray-700 uppercase tracking-tighter">VS</div>
                    </div>
                    <div className="text-center group flex flex-col items-center w-28 md:w-48">
                      <img src="/teal-gloves.png" className="w-16 md:w-32 drop-shadow-[0_0_30px_rgba(20,184,166,0.4)] transition-transform group-hover:scale-110 duration-500" />
                      <p className="text-teal-400 font-black uppercase text-[10px] md:text-xs mt-3 tracking-widest w-full truncate">{opponentName || 'WAITING...'}</p>
                    </div>
                </div>
            </div>
        </div>

        {/* 🥊 MAIN CONTENT AREA */}
        <div className="p-4 md:p-10 max-w-7xl mx-auto min-h-screen w-full">
            
            <div className={`transition-all duration-500 origin-top ${isFocusMode ? 'scale-y-0 h-0 opacity-0 mb-0' : 'scale-y-100 mb-8'}`}>
                <div className="bg-gray-950 border border-gray-900 rounded-xl shadow-lg">
                    <button 
                       onClick={() => setShowComparisons(!showComparisons)} 
                       className="w-full flex items-center justify-between p-4 hover:bg-gray-800 transition-colors focus:outline-none"
                    >
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-pink-500 animate-pulse"></span>
                            <h3 className="text-[10px] md:text-xs font-black uppercase tracking-[0.2em] text-gray-400">Pick Comparisons</h3>
                        </div>
                        <span className="text-pink-500 font-black text-[10px] uppercase tracking-widest bg-pink-950/30 px-3 py-1 rounded">
                            {showComparisons ? 'Hide ▲' : 'View ▼'}
                        </span>
                    </button>
                    
                    {showComparisons && (
                        <div className="p-4 border-t border-gray-900 grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-top-4 duration-300">
                            {thisWeekendAllFights.slice().reverse().map(fight => {
                                const myPick = h2hPicks.find(p => p.fight_id === fight.id && p.user_email === user?.email);
                                const oppPick = getOpponentPick(fight.id);
                                let oppPickDisplay = oppPick ? (myPick || fight.winner ? oppPick.selected_fighter : '🔒 LOCKED') : '???';
                                let isContested = oppPick && myPick && myPick.selected_fighter !== oppPick.selected_fighter;
                                const fightFinished = !!fight.winner;

                                return (
                                    <div key={fight.id} className={`p-3 rounded-lg border transition-all ${isContested && !fightFinished ? 'bg-pink-950/20 border-pink-500/50' : 'bg-gray-900/50 border-gray-800'}`}>
                                        <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-tighter mb-2">
                                            <span className={myPick ? 'text-pink-500' : 'text-gray-600'}>YOU</span>
                                            <span className="text-gray-500">VS</span>
                                            <span className={oppPick ? 'text-teal-400' : 'text-gray-600'}>OPPONENT</span>
                                        </div>
                                        <div className="flex justify-between items-center gap-2">
                                            <span className={`text-[10px] md:text-[11px] font-bold truncate w-[40%] ${fightFinished && myPick?.selected_fighter === fight.winner ? 'text-green-400' : (fightFinished && myPick ? 'text-red-500 line-through' : (myPick ? 'text-white' : 'text-gray-700'))}`}>
                                                {myPick?.selected_fighter || '???'}
                                            </span>
                                            {isContested && !fightFinished && <span className="text-[9px] bg-white text-black px-2 py-0.5 rounded italic font-black">FIRE</span>}
                                            <span className={`text-[10px] md:text-[11px] font-bold truncate w-[40%] text-right ${fightFinished && oppPick?.selected_fighter === fight.winner ? 'text-green-400' : (fightFinished && oppPick ? 'text-red-500 line-through' : (oppPick ? 'text-white' : 'text-gray-700'))}`}>
                                                {oppPickDisplay}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            <div className="relative flex w-full">
                
                <div className={`transition-all duration-700 ease-in-out w-full lg:w-[66%] ${isFocusMode ? 'lg:mx-auto' : ''}`}>
                    <div className="flex items-center gap-2 mb-6">
                        <span className={`w-2 h-2 rounded-full bg-teal-500 animate-pulse ${isFocusMode ? 'opacity-0' : ''}`}></span>
                        <h2 className={`text-xl font-black uppercase italic tracking-tighter ${isFocusMode ? 'text-pink-600' : ''}`}>
                            {isFocusMode ? 'Lock Your Picks' : 'Showdown Fights'}
                        </h2>
                    </div>
                    
                    <div className={`transition-all ${isFocusMode ? '[&_button]:animate-pulse' : ''}`}>
                         <FightDashboard 
                            fights={upcomingFights} 
                            groupedFights={groupedFights} 
                            onPickSelect={handlePickSelect} 
                            pendingPicks={pendingPicks} 
                            onInteractionStart={handleInteraction} 
                            userPicks={h2hPicks.filter(p => p.user_email === user?.email).map(p => ({ ...p, user_id: p.user_email, username: currentUsername }))} 
                            initialPicks={h2hPicks.map(p => ({ ...p, user_id: p.user_email, username: p.user_email === match?.creator_email ? creatorName : opponentName }))} 
                            league_id={null} 
                            showOdds={false} 
                         />
                    </div>
                </div>

                <div className={`hidden lg:block ml-10 space-y-8 transition-all duration-700 w-[33%] relative`}>
                    {pendingPicks.length > 0 ? (
                         <div className="sticky top-24 max-h-[calc(100vh-120px)] min-w-[320px] bg-gray-950 border border-gray-800 rounded-xl p-6 shadow-2xl overflow-y-auto custom-scrollbar">
                             <BettingSlip 
                                picks={pendingPicks} 
                                onCancelAll={() => { setPendingPicks([]); setIsFocusMode(false); }}
                                onRemovePick={handleRemovePick}
                                onConfirm={handleConfirmAllPicks}
                                isSubmitting={isSubmitting}
                             />
                         </div>
                    ) : (
                         <div className={`transition-opacity duration-300 sticky top-24 ${isFocusMode ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                            <div className="min-w-[320px] bg-gray-950/50 border border-gray-900 border-dashed rounded-xl p-8 shadow-lg flex flex-col items-center justify-center text-center">
                                <span className="text-4xl mb-3 opacity-50">⚔️</span>
                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Awaiting Picks</p>
                                <p className="text-xs text-gray-600 mt-2 font-bold">Select a fighter to start building your showdown slip.</p>
                            </div>
                         </div>
                    )}
                </div>
            </div>
        </div>
      </main>

      {/* MOBILE UI - Strictly hidden when desktop sidebar (lg) is active */}
      {pendingPicks.length > 0 && (
          <div className="lg:hidden fixed bottom-20 left-4 right-4 z-50 animate-in slide-in-from-bottom-10 fade-in duration-300">
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

      {/* MOBILE UI Modal */}
      {showMobileSlip && (
          <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm lg:hidden flex items-end">
            <div className="w-full h-[85vh] bg-gray-950 rounded-t-2xl border-t border-gray-800 flex flex-col shadow-2xl animate-in slide-in-from-bottom-full duration-300">
               <div className="p-4 border-b border-gray-800 flex justify-between items-center">
                  <h3 className="font-black italic text-xl text-white uppercase tracking-tighter">Your Slip</h3>
                  <button onClick={() => setShowMobileSlip(false)} className="text-gray-500 hover:text-white p-2 text-xs font-bold uppercase tracking-widest">✕ Close</button>
               </div>
               <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                  <BettingSlip 
                     picks={pendingPicks} 
                     onCancelAll={() => { setPendingPicks([]); setShowMobileSlip(false); setIsFocusMode(false); }}
                     onRemovePick={handleRemovePick}
                     onConfirm={handleConfirmAllPicks}
                     isSubmitting={isSubmitting}
                  />
               </div>
            </div>
          </div>
      )}

      <ShowdownModal 
        isOpen={showShowdown} 
        onClose={() => setShowShowdown(false)} 
      />

      <MobileNav onToggleLeagues={() => setShowMobileLeagues(true)} />

    </div>
  );
}