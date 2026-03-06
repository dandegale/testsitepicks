'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js'; 
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import LogOutButton from './LogOutButton';
import ChatBox from './ChatBox'; 
import FightDashboard from './FightDashboard';
import LeagueRail from './LeagueRail'; 
import BettingSlip from './BettingSlip'; 
import MobileNav from './MobileNav'; 
import CreateLeagueModal from './CreateLeagueModal';
import ShowdownModal from './ShowdownModal';
import OnboardingModal from './OnboardingModal'; 

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const CountdownDisplay = ({ targetDate }) => {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    if (!targetDate) return; 
    const rawTime = targetDate;
    const timeString = rawTime && !rawTime.endsWith('Z') ? `${rawTime}Z` : rawTime;
    const eventTime = new Date(timeString).getTime();

    const timer = setInterval(() => {
      const now = new Date().getTime();
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
  fights, groupedFights, publicLeagues, myPicks, userEmail, myLeagues, totalWins, totalLosses, nextEventName, mainEvent 
}) {
  const router = useRouter();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [pendingPicks, setPendingPicks] = useState([]); 
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false); 
  const [showMobileSlip, setShowMobileSlip] = useState(false);
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showShowdown, setShowShowdown] = useState(false);
  
  const [showOdds, setShowOdds] = useState(false); 
  const [clientPicks, setClientPicks] = useState(myPicks || []);
  
  const [clientLeagues, setClientLeagues] = useState(myLeagues || []);
  const [careerStats, setCareerStats] = useState({ wins: 0, losses: 0 });

  const [joiningLeagueId, setJoiningLeagueId] = useState(null);

  const [customAlert, setCustomAlert] = useState(null);

  const liveWinPercentage = (careerStats.wins + careerStats.losses) > 0 ? (careerStats.wins / (careerStats.wins + careerStats.losses)) * 100 : 0;
  const eventDate = mainEvent?.start_time || "2026-02-01T22:00:00"; 
  const safeEventName = nextEventName || "Upcoming Event";

  const showAlert = (title, message) => {
      setCustomAlert({ type: 'alert', title, message });
  };

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace('/login');
      }
    };
    checkAuth();
  }, [router]);

  useEffect(() => { if (myLeagues && myLeagues.length > 0) setClientLeagues(myLeagues); }, [myLeagues]);

  const { cleanFights, cleanGroups } = useMemo(() => {
      if (!fights) return { cleanFights: [], cleanGroups: {} };
      const now = new Date().getTime();
      const TWELVE_HOURS = 12 * 60 * 60 * 1000;
      
      const validFights = fights.filter(f => {
          if (!f || !f.start_time) return false; 
          if (f.winner) return true; 
          return new Date(f.start_time).getTime() > (now - TWELVE_HOURS);
      });

      validFights.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

      let finalGroupedFights = {};
      const tempGroups = [];
      let currentBucket = [];
      let groupReferenceTime = validFights.length > 0 ? new Date(validFights[0].start_time).getTime() : 0;
      const THREE_DAYS_MS = 72 * 60 * 60 * 1000;

      validFights.forEach((fight) => {
          const fightTime = new Date(fight.start_time).getTime();
          if (fightTime - groupReferenceTime < THREE_DAYS_MS) currentBucket.push(fight);
          else { tempGroups.push(currentBucket); currentBucket = [fight]; groupReferenceTime = fightTime; }
      });
      if (currentBucket.length > 0) tempGroups.push(currentBucket);

      tempGroups.forEach(bucket => {
          if (bucket.length === 0) return;
          const mainEventFight = bucket[bucket.length - 1];
          const dateStr = new Date(mainEventFight.start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' });
          const title = `${mainEventFight.fighter_1_name} vs ${mainEventFight.fighter_2_name} (${dateStr})`;
          finalGroupedFights[title] = [...bucket].reverse();
      });

      return { cleanFights: validFights, cleanGroups: finalGroupedFights };
  }, [fights]);

  const currentEventName = cleanFights.length > 0 && cleanFights[0].event_name 
      ? cleanFights[0].event_name 
      : (mainEvent?.event_name || safeEventName.split('(')[0] || "Upcoming Event");

  const fetchUserData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
        router.replace('/login');
        return; 
    }

    if (user && user.email) {
        const savedPicks = localStorage.getItem(`draft_pending_global_${user.email}`);
        if (savedPicks) {
            try {
                const parsed = JSON.parse(savedPicks);
                if (parsed.length > 0) {
                    setPendingPicks(parsed);
                    setIsFocusMode(true);
                }
            } catch(e) {}
        }

        const { data: picksData } = await supabase.from('picks').select('*').eq('user_id', user.email).is('league_id', null); 
        if (picksData) {
            setClientPicks(picksData); 
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

        const { data: memberships } = await supabase.from('league_members').select('leagues ( id, name, image_url, invite_code )').eq('user_id', user.email);
        if (memberships) setClientLeagues(memberships.map(m => m.leagues).filter(Boolean));

        const { data: profile } = await supabase.from('profiles').select('show_odds').eq('id', user.id).single();
        if (profile && profile.show_odds === true) setShowOdds(true);
    }
    setIsCheckingAuth(false);
  };

  useEffect(() => { fetchUserData(); }, []);

  const handleInteraction = () => setIsFocusMode(true);

  const handleDropPick = (pickDbId, fightId) => {
      const fightInfo = cleanFights.find(f => String(f.id) === String(fightId));
      const hasStarted = fightInfo ? new Date(fightInfo.start_time) <= new Date() : false;
      
      if (hasStarted) {
          return showAlert("Too Late", "This fight has already started! You cannot drop this pick.");
      }

      setCustomAlert({
          type: 'confirm',
          title: 'Drop Fighter',
          message: 'Are you sure you want to drop this fighter from your global picks?',
          confirmText: 'Drop',
          onConfirm: async () => {
              setCustomAlert(null);
              const { error } = await supabase.from('picks').delete().eq('id', pickDbId);
              if (error) {
                  showAlert("Error", "Failed to drop pick.");
              } else {
                  setClientPicks(prev => prev.filter(p => p.id !== pickDbId));
              }
          }
      });
  };

  const handlePickSelect = async (newPick) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        router.push('/login');
        return;
    }

    const hasDbPickForFight = clientPicks.some(p => String(p.fight_id) === String(newPick.fightId));
    if (hasDbPickForFight) {
        return showAlert("Duplicate Fight", "You already drafted a fighter from this match. Drop them first.");
    }

    setPendingPicks(currentPicks => {
        let newPicks = [...currentPicks];
        const existingIndex = currentPicks.findIndex(p => p.fightId === newPick.fightId);
        
        if (existingIndex >= 0) {
            const existingPick = currentPicks[existingIndex];
            if (existingPick.fighterName === newPick.fighterName) {
                newPicks = currentPicks.filter((_, i) => i !== existingIndex);
            } else { 
                newPicks[existingIndex] = newPick; 
            }
        } else {
            newPicks = [...currentPicks, newPick];
        }
        
        // 🎯 FIX: Instantly close Focus Mode if we just un-toggled our only pick!
        if (newPicks.length === 0) {
            setIsFocusMode(false);
            setShowMobileSlip(false);
        } else {
            setIsFocusMode(true); 
        }

        localStorage.setItem(`draft_pending_global_${user.email}`, JSON.stringify(newPicks));
        return newPicks;
    });
  };

  // 🎯 FIX: Smartly close the UI when the array hits 0 inside the state setter
  const handleRemovePick = (fightId) => {
    setPendingPicks(current => {
        const updated = current.filter(p => p.fightId !== fightId);
        
        if (updated.length === 0) {
            setShowMobileSlip(false);
            setIsFocusMode(false);
        }
        
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (user) localStorage.setItem(`draft_pending_global_${user.email}`, JSON.stringify(updated));
        });
        
        return updated;
    });
  };

  const handleConfirmAllPicks = async () => {
    if (pendingPicks.length === 0) return;
    setIsSubmitting(true);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user || !user.email) { router.push('/login'); setIsSubmitting(false); return; }
    
    const username = user.user_metadata?.username || user.email.split('@')[0];
    const picksToInsert = pendingPicks.map(p => ({
        user_id: user.email, 
        username: username, 
        fight_id: p.fightId, 
        selected_fighter: p.fighterName, 
        odds_at_pick: parseInt(p.odds, 10), 
        league_id: p.leagueId || null
    }));
    
    const { error } = await supabase.from('picks').upsert(picksToInsert, { onConflict: 'user_id, fight_id' }); 

    if (error) { 
        console.error("Submission Error:", error); 
        showAlert("Error", `Error saving picks: ${error.message}`); 
        setIsSubmitting(false); 
    }
    else { 
        setPendingPicks([]); 
        localStorage.removeItem(`draft_pending_global_${user.email}`);
        setIsSubmitting(false); 
        setIsFocusMode(false); 
        setShowMobileSlip(false); 
        window.location.reload(); 
    }
  };

  const handleJoinPublicLeague = async (leagueId, leagueName) => {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user || !user.email) {
          router.push('/login');
          return;
      }

      setJoiningLeagueId(leagueId);

      const { error: joinError } = await supabase.from('league_members').insert([{ league_id: leagueId, user_id: user.email }]);

      if (joinError) {
          if (joinError.code === '23505') {
              showAlert("Already Joined", `You are already in "${leagueName}"!`);
              router.push(`/league/${leagueId}`);
          } else {
              showAlert("Error", "Error joining: " + joinError.message);
          }
          setJoiningLeagueId(null);
      } else {
          router.push(`/league/${leagueId}`);
      }
  };

  const openCreateModalAuthGate = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) router.push('/login');
      else { setShowMobileMenu(false); setShowCreateModal(true); }
  }

  const openShowdownAuthGate = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) router.push('/login');
      else setShowShowdown(true);
  }

  if (isCheckingAuth) {
      return (
          <div className="min-h-screen bg-black flex flex-col items-center justify-center font-sans">
              <span className="w-12 h-12 rounded-full border-4 border-pink-600 border-t-transparent animate-spin mb-4"></span>
              <div className="text-xs font-black uppercase tracking-widest text-pink-600">Verifying Access...</div>
          </div>
      );
  }

  return (
    <div className="flex min-h-screen bg-black text-white overflow-hidden font-sans selection:bg-pink-500 selection:text-white">
      <OnboardingModal />

      <div className={`hidden md:block transition-all duration-500 ${isFocusMode ? '-ml-20' : 'ml-0'}`}>
        <LeagueRail initialLeagues={clientLeagues} />
      </div>

      <div className={`fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm transition-opacity duration-300 md:hidden ${showMobileMenu ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={() => setShowMobileMenu(false)}>
         <div className={`absolute left-0 top-0 bottom-0 w-[80%] max-w-[300px] bg-[#0b0e14] border-r border-gray-800/60 shadow-2xl transform transition-transform duration-300 flex flex-col ${showMobileMenu ? 'translate-x-0' : '-translate-x-full'}`} onClick={e => e.stopPropagation()}>
            
            <div className="p-5 border-b border-gray-800/60 flex justify-between items-center bg-black/20">
                <span className="text-xl font-black italic text-white tracking-tighter uppercase">
                    FIGHT<span className="text-pink-600">IQ</span>
                </span>
                <button onClick={() => setShowMobileMenu(false)} className="text-gray-500 hover:text-white transition-colors p-2 -mr-2">✕</button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-6 custom-scrollbar">
                <div>
                    <p className="text-[10px] font-black text-pink-500 uppercase tracking-widest mb-4">Your Leagues</p>
                    <div className="flex flex-col gap-2">
                        {clientLeagues && clientLeagues.length > 0 ? (
                            clientLeagues.map(league => (
                                <Link key={league.id} href={`/league/${league.id}`} className="flex items-center gap-4 p-3 rounded-xl bg-[#12161f] hover:bg-gray-800 border border-gray-800/60 hover:border-pink-500/50 transition-all group">
                                    <div className="w-10 h-10 rounded-full bg-black border border-gray-700 flex items-center justify-center text-[10px] font-black text-gray-400 group-hover:text-pink-500 group-hover:border-pink-500 transition-all shrink-0 overflow-hidden relative">
                                        {league.image_url ? <img src={league.image_url} alt={league.name} className="w-full h-full object-cover" /> : (league.name ? league.name.substring(0,2).toUpperCase() : 'LG')}
                                    </div>
                                    <span className="font-bold text-sm text-gray-300 group-hover:text-white truncate">{league.name}</span>
                                </Link>
                            ))
                        ) : (
                            <div className="p-4 border border-dashed border-gray-800 rounded-xl text-center bg-black/20">
                                <p className="text-gray-600 text-[10px] font-bold uppercase tracking-widest mb-2">No Leagues Joined</p>
                                <button onClick={openCreateModalAuthGate} className="text-pink-500 text-xs font-black uppercase hover:underline">+ Create One</button>
                            </div>
                        )}
                        <button onClick={openCreateModalAuthGate} className="w-full py-3 mt-2 border border-dashed border-gray-800 text-gray-500 rounded-xl hover:text-teal-400 hover:border-teal-500/50 hover:bg-teal-500/5 transition-all text-xs font-bold uppercase">
                            + Create / Join
                        </button>
                    </div>
                </div>
                
                <div className="border-t border-gray-800/60 pt-6 mt-2 pb-6">
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3">Main Menu</p>
                    <Link href="/how-it-works" className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-800/40 border border-transparent hover:border-gray-800/60 transition-all mb-1 group">
                        <svg className="w-5 h-5 text-gray-500 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                        <span className="text-sm font-bold text-gray-300 group-hover:text-white transition-colors">How It Works</span>
                    </Link>
                    <Link href="/leaderboard" className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-800/40 border border-transparent hover:border-gray-800/60 transition-all mb-1 group">
                        <svg className="w-5 h-5 text-gray-500 group-hover:text-yellow-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v1a5 5 0 01-5 5h-1v2h4v2H5v-2h4v-2H8a5 5 0 01-5-5v-1a2 2 0 012-2m14 0V5a2 2 0 00-2-2H5a2 2 0 00-2 2v6" /></svg>
                        <span className="text-sm font-bold text-gray-300 group-hover:text-white transition-colors">Global Leaderboard</span>
                    </Link>
                    <Link href="/profile" className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-800/40 border border-transparent hover:border-gray-800/60 transition-all mb-1 group">
                        <svg className="w-5 h-5 text-gray-500 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                        <span className="text-sm font-bold text-gray-300 group-hover:text-white transition-colors">My Profile</span>
                    </Link>
                    <Link href="/store" className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-800/40 border border-transparent hover:border-pink-500/30 transition-all group">
                        <svg className="w-5 h-5 text-gray-500 group-hover:text-pink-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                        <span className="text-sm font-bold text-gray-300 group-hover:text-pink-500 transition-colors">Item Store</span>
                    </Link>
                </div>
            </div>
         </div>
      </div>

      <main className="flex-1 h-screen overflow-y-auto overflow-x-hidden scrollbar-hide relative flex flex-col pb-24 md:pb-0 w-full max-w-[100vw]"> 
        <header className={`sticky top-0 z-[60] w-full bg-black/80 backdrop-blur-xl border-b border-gray-800 transition-all duration-500 ${isFocusMode ? '-translate-y-full' : 'translate-y-0'}`}>
            <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between w-full">
                
                <div className="flex items-center gap-3 md:gap-4">
                    <button 
                        onClick={() => setShowMobileMenu(true)} 
                        className="md:hidden p-1 text-teal-400 hover:text-teal-300 transition-colors drop-shadow-[0_0_5px_rgba(45,212,191,0.5)] animate-pulse"
                    >
                        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" /></svg>
                    </button>
                    
                    <Link href="/" className="text-xl md:text-2xl font-black italic text-white tracking-tighter uppercase">FIGHT<span className="text-pink-600">IQ</span></Link>
                    <div className="hidden md:block h-4 w-px bg-gray-800 mx-2"></div>
                    <nav className="hidden lg:flex gap-6 text-[10px] font-black uppercase tracking-widest text-gray-500">
                        <Link href="/how-it-works" className="text-white hover:text-pink-400 transition-colors">How It Works</Link>
                        <Link href="/my-picks" className="hover:text-white transition-colors">My Picks</Link>
                        <span className="text-gray-300 cursor-default">Global Feed</span>
                        <Link href="/leaderboard" className="hover:text-white transition-colors">Leaderboards</Link>
                        <Link href="/store" className="hover:text-pink-400 text-pink-600 transition-colors flex items-center gap-1"><span>STORE</span></Link>
                    </nav>
                </div>

                <div className="flex items-center gap-3 md:gap-6">
                    <button 
                        onClick={openShowdownAuthGate}
                        className="flex bg-gradient-to-r from-pink-600 to-teal-600 hover:from-pink-500 hover:to-teal-500 border border-gray-700 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-white shadow-[0_0_15px_rgba(219,39,119,0.2)] hover:shadow-[0_0_20px_rgba(20,184,166,0.4)] transition-all items-center gap-2 active:scale-95"
                    >
                        <span>⚔️</span><span className="hidden sm:inline">1v1 Showdown</span><span className="sm:hidden">1v1</span>
                    </button>

                    <div className="hidden md:flex items-center gap-3 px-4 border-x border-gray-800">
                        <div className="text-right">
                            <p className="text-[9px] font-black text-gray-600 uppercase tracking-tighter leading-none mb-1">Career Record</p>
                            <p className="text-sm font-black italic text-white leading-none">{careerStats.wins}W - {careerStats.losses}L</p>
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

        {isFocusMode && (
             <button onClick={() => { setIsFocusMode(false); setPendingPicks([]); localStorage.removeItem(`draft_pending_global_${user?.email}`); }} className="fixed top-6 right-6 z-[70] bg-gray-950 text-white px-6 py-3 rounded-full font-bold uppercase text-xs border border-pink-500 shadow-[0_0_20px_rgba(236,72,153,0.3)] hover:bg-pink-600 transition-all hidden md:block">
                ✕ Close Picks
             </button>
        )}

        <div className={`relative w-full bg-gray-900 overflow-hidden border-b border-gray-800 transition-all duration-700 ${isFocusMode ? 'h-0 opacity-0' : 'h-[15vh] min-h-[120px]'}`}>
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent z-10" />
            <div className="absolute inset-0 flex flex-col justify-end p-4 md:p-6 z-20">
                <div className="max-w-7xl mx-auto w-full flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <h1 className="text-4xl md:text-5xl font-black italic uppercase tracking-tighter mb-1 leading-none">CHOOSE YOUR FIGHTER</h1>
                        <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">{currentEventName}</p>
                    </div>
                    <div className="pb-1">
                        <p className="text-[9px] font-black text-gray-500 uppercase tracking-[0.2em] mb-2 md:text-right">Lock In Deadline</p>
                        <CountdownDisplay targetDate={eventDate} />
                    </div>
                </div>
            </div>
        </div>

        <div className="p-4 md:p-10 max-w-7xl mx-auto min-h-screen w-full">
            <div className={`mb-8 transition-all duration-500 origin-top ${isFocusMode ? 'scale-y-0 h-0 opacity-0 mb-0' : 'scale-y-100'}`}>
                
                <div className="md:hidden mt-4 mb-2 w-full overflow-hidden">
                    <div className="flex justify-between items-center mb-3 px-1">
                        <div>
                            <h3 className="text-xs font-black text-white uppercase tracking-[0.2em] flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse"></span>
                                Public Leagues
                            </h3>
                        </div>
                        <button onClick={openCreateModalAuthGate} className="text-[10px] font-black text-pink-500 uppercase tracking-widest bg-pink-500/10 px-2 py-1 rounded border border-pink-500/20">
                            + Create
                        </button>
                    </div>
                    
                    <div className="flex overflow-x-auto gap-3 pb-4 snap-x scrollbar-hide w-full" style={{ msOverflowStyle: 'none', scrollbarWidth: 'none' }}>
                        {publicLeagues && publicLeagues.length > 0 ? (
                            publicLeagues.map(league => {
                                const isAlreadyMember = clientLeagues.some(l => l.id === league.id);
                                return (
                                    <div key={league.id} className="min-w-[260px] w-[260px] shrink-0 snap-center bg-black border border-gray-800 p-4 rounded-xl flex flex-col justify-between shadow-lg">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="w-12 h-12 rounded-full bg-gray-900 border border-gray-700 flex items-center justify-center overflow-hidden shrink-0">
                                                {league.imageUrl ? <img src={league.imageUrl} alt={league.name} className="w-full h-full object-cover shrink-0" /> : <span className="text-[12px] font-black text-gray-500">LG</span>}
                                            </div>
                                            <div className="min-w-0">
                                                <h4 className="font-bold text-sm text-white truncate w-full">{league.name}</h4>
                                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{league.memberCount} Members</p>
                                            </div>
                                        </div>
                                        
                                        {isAlreadyMember ? (
                                            <Link href={`/league/${league.id}`} className="w-full text-center text-[10px] font-black uppercase text-gray-400 bg-gray-900 py-2.5 rounded border border-gray-800 hover:text-white transition-colors block">
                                                View League
                                            </Link>
                                        ) : (
                                            <button onClick={() => handleJoinPublicLeague(league.id, league.name)} disabled={joiningLeagueId === league.id} className="w-full text-[10px] font-black uppercase text-black bg-teal-500 hover:bg-teal-400 py-2.5 rounded transition-colors disabled:opacity-50">
                                                {joiningLeagueId === league.id ? 'Joining...' : 'Join Now'}
                                            </button>
                                        )}
                                    </div>
                                );
                            })
                        ) : (
                            <div className="min-w-[260px] w-[260px] shrink-0 p-4 border border-dashed border-gray-800 rounded-xl flex items-center justify-center text-center">
                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">No public leagues found.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="relative flex w-full">
                <div className={`transition-all duration-700 ease-in-out w-full xl:w-[66%] ${isFocusMode ? 'xl:w-full xl:max-w-4xl xl:mx-auto' : ''}`}>
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
                            userPicks={clientPicks} 
                            league_id={null} 
                            onInteractionStart={handleInteraction}
                            onPickSelect={handlePickSelect} 
                            pendingPicks={pendingPicks}
                            showOdds={showOdds} 
                        />
                    </div>
                </div>

                <div className={`hidden xl:block ml-10 space-y-8 transition-all duration-700 w-[33%] relative ${isFocusMode ? 'opacity-0 w-0 ml-0 overflow-hidden absolute' : 'opacity-100'}`}>
                    {pendingPicks.length > 0 ? (
                         <div className="sticky top-24 max-h-[calc(100vh-120px)] min-w-[350px] w-full bg-gray-950 border border-gray-800 rounded-xl p-6 shadow-2xl overflow-y-auto">
                             <BettingSlip 
                                picks={pendingPicks} 
                                // 🎯 FIXED: Properly resets Focus Mode when you hit Clear All
                                onCancelAll={() => { 
                                    setPendingPicks([]); 
                                    localStorage.removeItem(`draft_pending_global_${user?.email}`); 
                                    setIsFocusMode(false); 
                                }} 
                                onRemovePick={handleRemovePick} 
                                onConfirm={handleConfirmAllPicks} 
                                isSubmitting={isSubmitting} 
                             />
                         </div>
                    ) : (
                         <div>
                            {/* 🎯 THE GLOBAL ROSTER DRAWER */}
                            {clientPicks.length > 0 && (
                                <div className="min-w-[350px] mb-8 bg-gray-950 border border-gray-900 rounded-xl overflow-hidden shadow-lg transition-all">
                                    <div className="p-4 border-b border-gray-800 bg-black/20 flex justify-between items-center">
                                        <div>
                                            <h3 className="text-xs font-black text-white uppercase tracking-[0.2em] flex items-center gap-2">
                                                <span className="w-2 h-2 rounded-full bg-pink-600 animate-pulse"></span>
                                                Global Roster
                                            </h3>
                                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Your active picks</p>
                                        </div>
                                    </div>
                                    <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar">
                                        {clientPicks.map((pick, index) => {
                                            const fightInfo = cleanFights.find(f => String(f.id) === String(pick.fight_id));
                                            const hasStarted = fightInfo ? new Date(fightInfo.start_time) <= new Date() : false;
                                            
                                            return (
                                                <div key={pick.id} className="flex items-center justify-between p-3 rounded-lg bg-teal-950/20 border border-teal-500/30">
                                                    <div>
                                                        <div className="text-[9px] font-black text-teal-400 uppercase tracking-widest mb-0.5">SLOT {index + 1}</div>
                                                        <div className="text-sm font-black text-white uppercase truncate">{pick.selected_fighter}</div>
                                                    </div>
                                                    {hasStarted ? (
                                                        <img src="/lock.png" alt="Locked" className="w-8 h-8 object-contain opacity-80 drop-shadow-[0_0_10px_rgba(20,184,166,0.6)]" title="Fight has started" />
                                                    ) : (
                                                        <button onClick={() => handleDropPick(pick.id, pick.fight_id)} className="text-gray-500 hover:text-red-500 text-xs font-black px-3 py-1.5 bg-gray-900 rounded-lg border border-gray-800 transition-colors" title="Drop Fighter">
                                                            DROP
                                                        </button>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}

                            <div className="min-w-[350px] mb-8 bg-gray-950 border border-gray-900 rounded-xl overflow-hidden p-6 shadow-lg">
                                <div className="flex justify-between items-center mb-6">
                                    <div>
                                        <h3 className="text-xs font-black text-white uppercase tracking-[0.2em] flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse"></span>
                                            Public Leagues
                                        </h3>
                                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Join the community</p>
                                    </div>
                                    <button onClick={openCreateModalAuthGate} className="bg-gray-900 hover:bg-gray-800 border border-gray-800 text-pink-500 hover:text-pink-400 px-3 py-1.5 rounded text-[10px] font-black uppercase tracking-widest transition-colors shrink-0 ml-4">
                                        + Create
                                    </button>
                                </div>
                                
                                <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-2 pb-2">
                                    {publicLeagues && publicLeagues.length > 0 ? (
                                        publicLeagues.map(league => {
                                            const isAlreadyMember = clientLeagues.some(l => l.id === league.id);
                                            return (
                                                <div key={league.id} className="bg-black border border-gray-800 p-4 rounded-xl flex items-center justify-between group hover:border-teal-500/50 transition-colors">
                                                    <div className="flex items-center gap-3 min-w-0 pr-4">
                                                        <div className="w-10 h-10 rounded-full bg-gray-900 border border-gray-700 flex items-center justify-center overflow-hidden shrink-0">
                                                            {league.imageUrl ? <img src={league.imageUrl} alt={league.name} className="w-full h-full object-cover" /> : <span className="text-[10px] font-black text-gray-500">LG</span>}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <h4 className="font-bold text-sm text-white truncate max-w-[120px]" title={league.name}>{league.name}</h4>
                                                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{league.memberCount} Members</p>
                                                        </div>
                                                    </div>
                                                    <div className="shrink-0">
                                                        {isAlreadyMember ? (
                                                            <Link href={`/league/${league.id}`} className="text-[10px] font-black uppercase text-gray-500 bg-gray-900 px-3 py-1.5 rounded border border-gray-800 hover:text-white transition-colors block text-center min-w-[60px]">View</Link>
                                                        ) : (
                                                            <button onClick={() => handleJoinPublicLeague(league.id, league.name)} disabled={joiningLeagueId === league.id} className="text-[10px] font-black uppercase text-black bg-teal-500 hover:bg-teal-400 px-3 py-1.5 rounded transition-colors disabled:opacity-50 min-w-[60px]">
                                                                {joiningLeagueId === league.id ? '...' : 'Join'}
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className="text-center p-6 border border-dashed border-gray-800 rounded-xl">
                                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">No public leagues found.</p>
                                        </div>
                                    )}
                                </div>
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

      {pendingPicks.length > 0 && (
          <div className="md:hidden fixed bottom-20 left-4 right-4 z-50 animate-in slide-in-from-bottom-10 fade-in duration-300">
            <button onClick={() => setShowMobileSlip(true)} className="w-full bg-pink-600 text-white p-4 rounded-xl shadow-2xl shadow-pink-900/50 flex justify-between items-center border border-pink-400 active:scale-95 transition-transform">
              <div className="flex items-center gap-3">
                <span className="bg-black/20 px-3 py-1 rounded-lg text-xs font-black">{pendingPicks.length}</span>
                <span className="text-sm font-black uppercase italic tracking-tighter">Picks in Slip</span>
              </div>
              <span className="text-xs font-bold uppercase tracking-widest">Review & Submit →</span>
            </button>
          </div>
      )}

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
                    // 🎯 FIXED: Properly resets Focus Mode on mobile too
                    onCancelAll={() => { 
                        setPendingPicks([]); 
                        localStorage.removeItem(`draft_pending_global_${user?.email}`); 
                        setShowMobileSlip(false); 
                        setIsFocusMode(false); 
                    }} 
                    onRemovePick={handleRemovePick} 
                    onConfirm={handleConfirmAllPicks} 
                    isSubmitting={isSubmitting} 
                  />
               </div>
            </div>
          </div>
      )}

      {/* 🎯 REUSABLE CUSTOM MODAL FOR ALERTS & CONFIRMATIONS */}
      {customAlert && (
          <div className="fixed inset-0 z-[300] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
              <div className="bg-gray-950 border border-gray-800 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="p-6">
                      <h3 className="text-xl font-black italic uppercase tracking-tighter text-white mb-2">
                          {customAlert.title}
                      </h3>
                      <p className="text-gray-400 text-sm font-medium leading-relaxed">
                          {customAlert.message}
                      </p>
                  </div>
                  <div className="p-4 bg-black/50 border-t border-gray-900 flex gap-3 justify-end">
                      {customAlert.type === 'confirm' && (
                          <button
                              onClick={() => setCustomAlert(null)}
                              className="px-5 py-2.5 rounded-lg font-bold text-xs uppercase tracking-widest text-gray-500 hover:text-white hover:bg-gray-900 transition-colors"
                          >
                              Cancel
                          </button>
                      )}
                      <button
                          onClick={() => {
                              if (customAlert.onConfirm) customAlert.onConfirm();
                              else setCustomAlert(null);
                          }}
                          className="px-5 py-2.5 rounded-lg font-black text-xs uppercase tracking-widest bg-pink-600 text-white hover:bg-pink-500 transition-colors shadow-[0_0_15px_rgba(236,72,153,0.3)]"
                      >
                          {customAlert.confirmText || 'OK'}
                      </button>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
}