'use client';

import { createClient } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
// FIX: Added useSearchParams to read the URL
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import FightDashboard from '../../components/FightDashboard';
import ChatBox from '../../components/ChatBox';
import LeagueRail from '../../components/LeagueRail';
import BettingSlip from '../../components/BettingSlip'; 
import LogOutButton from '../../components/LogOutButton';
import MobileNav from '../../components/MobileNav'; 
import Toast from '../../components/Toast'; 

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function LeaguePage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams(); // <-- ADDED THIS
  const leagueId = params.id;

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('card'); 
  const [copySuccess, setCopySuccess] = useState(false);
  
  // Mobile States
  const [showMobileLeagues, setShowMobileLeagues] = useState(false);
  const [showMobileSlip, setShowMobileSlip] = useState(false);

  // Data State
  const [league, setLeague] = useState(null);
  const [members, setMembers] = useState([]); 
  const [leaderboard, setLeaderboard] = useState([]); 
  const [feedItems, setFeedItems] = useState([]); 
  
  // Fight Data
  const [allFights, setAllFights] = useState([]); 
  const [visibleFights, setVisibleFights] = useState([]); 
  const [cardFilter, setCardFilter] = useState('full'); 
  const [groupedFights, setGroupedFights] = useState({});

  // Odds State
  const [showOdds, setShowOdds] = useState(false);

  // Champion Logic
  const [isEventConcluded, setIsEventConcluded] = useState(false);

  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false); 
  
  const [myLeagues, setMyLeagues] = useState([]);
  const [existingPicks, setExistingPicks] = useState([]); 
  const [pendingPicks, setPendingPicks] = useState([]); 
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Toast & Delete States
  const [toast, setToast] = useState(null); 
  const [deleteConfirm, setDeleteConfirm] = useState(false); 
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchLeagueData();
  }, [leagueId]);

  useEffect(() => {
      applyCardFilter();
  }, [cardFilter, allFights]);

  const applyCardFilter = () => {
      if (allFights.length === 0) return;
      const now = new Date().getTime();
      const TWELVE_HOURS = 12 * 60 * 60 * 1000;
      
      const validFights = allFights.filter(f => {
          if (!f || !f.start_time) return false;
          const fTime = new Date(f.start_time).getTime();
          return (fTime > (now - TWELVE_HOURS)) || (f.winner === null);
      });

      let sorted = [...validFights].sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
      
      let nextEventFights = [];
      if (sorted.length > 0) {
          const firstFightTime = new Date(sorted[0].start_time).getTime();
          const EVENT_WINDOW = 4 * 24 * 60 * 60 * 1000; 
          nextEventFights = sorted.filter(f => {
              const fTime = new Date(f.start_time).getTime();
              return fTime < (firstFightTime + EVENT_WINDOW);
          });
      }

      let filtered = [...nextEventFights];
      if (cardFilter === 'main') filtered = filtered.slice(-5);
      
      setVisibleFights(filtered);

      const allFinished = filtered.length > 0 && filtered.every(f => f.winner !== null && f.winner !== undefined && f.winner !== '');
      setIsEventConcluded(allFinished);

      let finalGroupedFights = {};
      const tempGroups = [];
      let currentBucket = [];
      let groupReferenceTime = filtered.length > 0 ? new Date(filtered[0].start_time).getTime() : 0;
      const THREE_DAYS_MS = 72 * 60 * 60 * 1000;

      filtered.forEach((fight) => {
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
          const dateStr = new Date(mainEventFight.start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' });
          const title = `${mainEventFight.fighter_1_name} vs ${mainEventFight.fighter_2_name} (${dateStr})`;
          finalGroupedFights[title] = [...bucket].reverse();
      });

      setGroupedFights(finalGroupedFights);
  };

  const fetchLeagueData = async () => {
    try {
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        setUser(currentUser);

        if (currentUser) {
            const { data: profile } = await supabase.from('profiles').select('show_odds').eq('id', currentUser.id).single();
            if (profile && profile.show_odds === true) setShowOdds(true);
        }

        const { data: leagueData } = await supabase.from('leagues').select('*').eq('id', leagueId).single();
        setLeague(leagueData);

        // ---------------------------------------------------------
        // THE FIX: AUTO-JOIN LOGIC FOR INVITE LINKS
        // ---------------------------------------------------------
        const inviteCode = searchParams.get('invite');
        
        if (currentUser && leagueData && inviteCode === leagueData.invite_code) {
            // Check if they are already in the league
            const { data: existingMember } = await supabase
                .from('league_members')
                .select('*')
                .eq('league_id', leagueId)
                .eq('user_id', currentUser.email)
                .single();

            // If not a member, insert them!
            if (!existingMember) {
                await supabase.from('league_members').insert({
                    league_id: leagueId,
                    user_id: currentUser.email
                });
                
                // Show a success message
                setToast({ message: "Successfully joined the league! 👊", type: "success" });
                
                // Clean the URL so they don't rejoin on refresh
                router.replace(`/league/${leagueId}`);
            }
        }
        // ---------------------------------------------------------

        if (currentUser && leagueData) {
            const isCreator = (leagueData.created_by === currentUser.email) || (leagueData.created_by === currentUser.id);
            setIsAdmin(isCreator);
        }

        // Fetch Members & Avatars
        const { data: membersData } = await supabase.from('league_members').select('user_id, joined_at').eq('league_id', leagueId);
        let processedMembers = membersData || [];

        if (processedMembers.length > 0) {
            const memberIds = processedMembers.map(m => m.user_id);
            const { data: profiles } = await supabase.from('profiles').select('email, username, avatar_url').in('email', memberIds);   

            processedMembers = processedMembers.map(member => {
                const profile = profiles?.find(p => p.email === member.user_id);
                const displayName = (profile && profile.username) ? profile.username : member.user_id.split('@')[0]; 
                const avatarUrl = profile?.avatar_url || null;
                return { ...member, displayName, avatarUrl };
            });
        }
        setMembers(processedMembers);

        const { data: globalFights } = await supabase.from('fights').select('*').order('start_time', { ascending: true });
        setAllFights(globalFights || []);

        if (currentUser) {
            const { data: picksData } = await supabase.from('picks').select('*').eq('user_id', currentUser.email).eq('league_id', leagueId); 
            setExistingPicks(picksData || []);
        }

        const { data: completedFights } = await supabase.from('fights').select('id, winner').not('winner', 'is', null);

        const { data: allLeaguePicks } = await supabase
            .from('picks')
            .select('user_id, fight_id, selected_fighter, odds_at_pick, created_at')
            .eq('league_id', leagueId);

        // Build Feed
        if (allLeaguePicks && globalFights && processedMembers) {
            const feed = allLeaguePicks.map(pick => {
                const member = processedMembers.find(m => m.user_id === pick.user_id);
                const fight = globalFights.find(f => f.id === pick.fight_id);
                return {
                    id: `${pick.user_id}-${pick.fight_id}`,
                    user: member?.displayName || "Unknown",
                    avatar: member?.avatarUrl,
                    user_id: pick.user_id,
                    fighter: pick.selected_fighter,
                    odds: pick.odds_at_pick,
                    timestamp: pick.created_at,
                    fight_context: fight ? `${fight.fighter_1_name} vs ${fight.fighter_2_name}` : 'Unknown Fight',
                    result: fight?.winner ? (fight.winner === pick.selected_fighter ? 'WIN' : 'LOSS') : 'PENDING'
                };
            });
            feed.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            setFeedItems(feed);
        }

        // Leaderboard
        if (processedMembers && allLeaguePicks) {
            const scores = processedMembers.map(member => {
                let wins = 0; let losses = 0; let totalScore = 0;
                const memberPicks = allLeaguePicks.filter(p => p.user_id === member.user_id);

                memberPicks.forEach(pick => {
                    const fight = completedFights?.find(f => f.id === pick.fight_id);
                    if (fight && fight.winner) {
                        if (fight.winner === pick.selected_fighter) {
                            wins++;
                            const numericOdds = parseInt(pick.odds_at_pick, 10);
                            let profit = 0;
                            if (!isNaN(numericOdds) && numericOdds !== 0) {
                                if (numericOdds > 0) profit = (numericOdds / 100) * 10;
                                else profit = (100 / Math.abs(numericOdds)) * 10;
                            } else { profit = 10; }
                            totalScore += (profit + 10);
                        } else {
                            losses++;
                            totalScore -= 10;
                        }
                    }
                });

                return {
                    user_id: member.user_id,
                    displayName: member.displayName,
                    avatarUrl: member.avatarUrl,
                    wins, losses,
                    totalScore: parseFloat(totalScore.toFixed(1)),
                    winRate: (wins + losses) > 0 ? Math.round((wins / (wins + losses)) * 100) : 0
                };
            });
            scores.sort((a, b) => b.totalScore - a.totalScore || b.wins - a.wins);
            setLeaderboard(scores);
        }

    } catch (error) { console.error("League Load Error:", error); } finally { setLoading(false); }
  };

  const handleCopyCode = () => {
    if (league?.invite_code) {
        const inviteUrl = `${window.location.origin}/league/${leagueId}?invite=${league.invite_code}`;
        const shareMessage = `Join my fight league on FightIQ! 👊\n${inviteUrl}`;
        navigator.clipboard.writeText(shareMessage).then(() => {
            setToast({ message: "Invite Link Copied!", type: "success" });
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 2000);
        });
    }
  };

  const handleKickMember = async (memberUserId) => {
    if (!confirm(`Are you sure you want to KICK ${memberUserId}?`)) return;
    const { error } = await supabase.from('league_members').delete().eq('league_id', leagueId).eq('user_id', memberUserId);
    if (error) alert('Error: ' + error.message);
    else {
        setMembers(members.filter(m => m.user_id !== memberUserId));
        setToast({ message: "Member Removed", type: "success" });
    }
  };

  const handleDeleteLeague = async () => {
      if (!deleteConfirm) {
          setDeleteConfirm(true);
          setToast({ message: "⚠️ Click DELETE again to confirm!", type: "error" });
          setTimeout(() => setDeleteConfirm(false), 3000);
          return;
      }
      setDeleting(true);
      const { error } = await supabase.from('leagues').delete().eq('id', leagueId);
      if (error) {
          setToast({ message: "Delete Failed: " + error.message, type: "error" });
          setDeleting(false);
          setDeleteConfirm(false);
      } else {
          setToast({ message: "League Deleted", type: "success" });
          router.push('/');
      }
  };

  const handlePickSelect = (newPick) => {
    setPendingPicks(currentPicks => {
        const existingIndex = currentPicks.findIndex(p => p.fightId === newPick.fightId);
        if (existingIndex >= 0) {
            const existingPick = currentPicks[existingIndex];
            if (existingPick.fighterName === newPick.fighterName) return currentPicks.filter((_, i) => i !== existingIndex);
            const updated = [...currentPicks]; updated[existingIndex] = newPick; return updated;
        }
        return [...currentPicks, newPick];
    });
  };

  const handleRemovePick = (fightId) => setPendingPicks(c => c.filter(p => p.fightId !== fightId));

  const handleConfirmAllPicks = async () => {
    if (pendingPicks.length === 0) return;
    setIsSubmitting(true);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user || !user.email) {
        setToast({ message: "Please log in first", type: "error" });
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
        league_id: leagueId 
    }));

    const { error } = await supabase.from('picks').insert(picksToInsert);
    setIsSubmitting(false);

    if (error) setToast({ message: "Error saving picks", type: "error" });
    else {
        setPendingPicks([]); 
        setToast({ message: "Picks Locked In!", type: "success" });
        setTimeout(() => window.location.reload(), 1500); 
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center">
            <span className="w-12 h-12 rounded-full border-4 border-pink-600 border-t-transparent animate-spin mb-4"></span>
            <div className="text-xs font-black uppercase tracking-widest text-pink-600">Loading League...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-black text-white font-sans selection:bg-pink-500 selection:text-white">
      {/* Sidebar - HIDDEN ON MOBILE */}
      <div className="hidden lg:block">
        <LeagueRail initialLeagues={myLeagues} />
      </div>

      {/* Main Content Area - overflow-x-hidden ensures no horizontal sliding */}
      <main className="flex-1 h-screen overflow-y-auto overflow-x-hidden scrollbar-hide relative flex flex-col pb-24 md:pb-0">
        
        {/* Header */}
        <header className="sticky top-0 z-[60] w-full bg-black/80 backdrop-blur-xl border-b border-gray-800">
            <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/" className="text-2xl font-black italic text-white tracking-tighter uppercase">
                        FIGHT<span className="text-pink-600">IQ</span>
                    </Link>
                    <div className="hidden md:block h-4 w-px bg-gray-800 mx-2"></div>
                    <nav className="hidden md:flex gap-6 text-[10px] font-black uppercase tracking-widest text-gray-500">
                        <Link href="/" className="hover:text-white transition-colors">Global Feed</Link>
                        <span className="text-pink-600 cursor-default truncate max-w-[100px] md:max-w-[150px]">
                            {league?.name}
                        </span>
                    </nav>
                </div>
                <div className="flex items-center gap-4">
                     <Link href="/profile" className="hidden md:flex bg-gray-900 hover:bg-gray-800 border border-gray-700 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-gray-300 hover:text-white transition-all">
                        MY PROFILE
                    </Link>
                    <div className="hidden md:block">
                        <LogOutButton />
                    </div>
                </div>
            </div>
        </header>

        {/* League Hero */}
        <div className="relative w-full bg-gray-900 overflow-hidden border-b border-gray-800 h-[180px] md:h-[200px]">
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent z-10" />
            {league?.image_url && (
                <img src={league.image_url} className="absolute inset-0 w-full h-full object-cover opacity-50" alt="League Banner" />
            )}
            <div className="absolute inset-0 flex flex-col justify-end p-4 md:p-10 z-20">
                <div className="max-w-7xl mx-auto w-full">
                    <span className="bg-pink-600 text-white text-[9px] font-black uppercase px-2 py-1 rounded inline-block mb-2 md:mb-3">
                        Private League
                    </span>
                    <h1 className="text-3xl md:text-6xl font-black italic uppercase tracking-tighter mb-2 leading-none">
                        {league?.name}
                    </h1>
                    
                    <div className="flex items-center gap-4 text-gray-400 text-xs font-bold uppercase tracking-widest">
                        <button 
                            onClick={handleCopyCode}
                            className="group flex items-center gap-2 hover:text-white transition-colors"
                        >
                            <span>Invite Code:</span>
                            <span className="text-white bg-gray-800 border border-gray-700 group-hover:border-pink-500 px-3 py-1 rounded select-all font-mono">
                                {league?.invite_code}
                            </span>
                            <span className="text-pink-500 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">
                                {copySuccess ? 'LINK COPIED!' : '❐ SHARE LINK'}
                            </span>
                        </button>
                    </div>
                </div>
            </div>
        </div>

        {/* Tabs - Scrollable on mobile */}
        <div className="border-b border-gray-800 bg-gray-950 sticky top-16 z-40">
            <div className="max-w-7xl mx-auto px-4 md:px-6 flex gap-2 md:gap-0 overflow-x-auto scrollbar-hide">
                <button 
                    onClick={() => setActiveTab('card')}
                    className={`whitespace-nowrap px-4 md:px-6 py-4 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 ${activeTab === 'card' ? 'border-pink-600 text-white bg-gray-900' : 'border-transparent text-gray-500 hover:text-white hover:bg-gray-900/50'}`}
                >
                    Fight Card
                </button>
                <button 
                    onClick={() => setActiveTab('feed')}
                    className={`whitespace-nowrap px-4 md:px-6 py-4 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 ${activeTab === 'feed' ? 'border-pink-600 text-white bg-gray-900' : 'border-transparent text-gray-500 hover:text-white hover:bg-gray-900/50'}`}
                >
                    Activity Feed
                </button>
                <button 
                    onClick={() => setActiveTab('leaderboard')}
                    className={`whitespace-nowrap px-4 md:px-6 py-4 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 ${activeTab === 'leaderboard' ? 'border-pink-600 text-white bg-gray-900' : 'border-transparent text-gray-500 hover:text-white hover:bg-gray-900/50'}`}
                >
                    Leaderboard
                </button>
                {isAdmin && (
                    <button 
                        onClick={() => setActiveTab('settings')}
                        className={`whitespace-nowrap px-4 md:px-6 py-4 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 ${activeTab === 'settings' ? 'border-pink-600 text-white bg-gray-900' : 'border-transparent text-gray-500 hover:text-white hover:bg-gray-900/50'}`}
                    >
                        Admin Settings
                    </button>
                )}
            </div>
        </div>

        <div className="p-4 md:p-10 max-w-7xl mx-auto min-h-screen w-full">
            <div className="relative flex flex-col xl:flex-row w-full gap-6 xl:gap-10">
                
                {/* LEFT COLUMN */}
                <div className="w-full xl:w-[66%] transition-all">
                    
                    {activeTab === 'card' && (
                        <>
                            <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
                                <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-start">
                                    <div className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-pink-600 animate-pulse"></span>
                                        <h2 className="text-xl font-black uppercase italic tracking-tighter text-white">
                                            League Fight Card
                                        </h2>
                                    </div>
                                    
                                    <button 
                                        onClick={handleCopyCode}
                                        className="flex items-center gap-2 bg-gray-900 hover:bg-gray-800 border border-gray-700 px-3 py-1 rounded transition-all group"
                                    >
                                        <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">
                                            <span className="hidden sm:inline">Share:</span>
                                            <span className="sm:hidden">Invite</span>
                                        </span>
                                        <span className="text-xs font-mono font-bold text-pink-500">{league?.invite_code}</span>
                                        <span className="text-[10px] text-gray-500 group-hover:text-white">
                                            {copySuccess ? '✓' : '❐'}
                                        </span>
                                    </button>
                                </div>
                                <div className="text-[10px] font-black uppercase text-gray-500 tracking-widest">
                                    Showing: <span className="text-pink-600">{cardFilter === 'full' ? 'Full Card' : 'Main Card (Last 5)'}</span>
                                </div>
                            </div>
                            
                            {visibleFights.length > 0 ? (
                                <FightDashboard 
                                    fights={visibleFights} 
                                    groupedFights={groupedFights} 
                                    initialPicks={existingPicks} 
                                    userPicks={existingPicks} 
                                    league_id={leagueId} 
                                    onPickSelect={handlePickSelect} 
                                    pendingPicks={pendingPicks} 
                                    showOdds={showOdds} 
                                />
                            ) : (
                                <div className="p-12 border border-gray-800 rounded-xl text-center text-gray-500 font-bold uppercase tracking-widest">
                                    No fights scheduled.
                                </div>
                            )}
                        </>
                    )}

                    {/* ACTIVITY FEED TAB */}
                    {activeTab === 'feed' && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                             <div className="flex items-center gap-2 mb-6">
                                <span className="text-2xl">⚡</span>
                                <h2 className="text-xl font-black uppercase italic tracking-tighter text-white">
                                    Recent Activity
                                </h2>
                            </div>
                            
                            <div className="space-y-4">
                                {feedItems.map(item => (
                                    <div key={item.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between hover:border-gray-700 transition-colors">
                                        <div className="flex items-center gap-3 md:gap-4 overflow-hidden">
                                            {item.avatar ? (
                                                <img src={item.avatar} alt={item.user} className="w-10 h-10 rounded-full object-cover border border-gray-700 shrink-0" />
                                            ) : (
                                                <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center font-black text-gray-500 border border-gray-700 shrink-0">
                                                    {item.user.charAt(0).toUpperCase()}
                                                </div>
                                            )}
                                            
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-white text-sm truncate">{item.user}</span>
                                                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest hidden sm:inline">locked in</span>
                                                </div>
                                                <div className="text-base md:text-lg font-black italic text-pink-500 uppercase leading-none mt-1 truncate">
                                                    {item.fighter}
                                                </div>
                                                <div className="text-[10px] text-gray-500 font-mono mt-1 truncate">{item.fight_context}</div>
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0 ml-2">
                                            {showOdds && <div className="text-xs font-mono font-bold text-teal-400">{item.odds > 0 ? `+${item.odds}` : item.odds}</div>}
                                            <div className="text-[9px] text-gray-600 font-bold uppercase tracking-widest mt-1">
                                                {new Date(item.timestamp).toLocaleDateString()}
                                            </div>
                                            {item.result !== 'PENDING' && (
                                                <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[8px] font-black uppercase ${item.result === 'WIN' ? 'bg-green-900 text-green-400' : 'bg-red-900 text-red-400'}`}>
                                                    {item.result}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {feedItems.length === 0 && (
                                    <div className="p-12 border border-gray-800 rounded-xl text-center text-gray-500 font-bold uppercase tracking-widest">
                                        No activity yet. Be the first to make a pick!
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* LEADERBOARD TAB */}
                    {activeTab === 'leaderboard' && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                             <div className="flex items-center gap-2 mb-6">
                                <span className="text-2xl">🏆</span>
                                <h2 className="text-xl font-black uppercase italic tracking-tighter text-white">
                                    League Standings
                                </h2>
                            </div>

                            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-2xl">
                                <div className="overflow-x-auto">
                                    <div className="min-w-[500px]">
                                        <div className="grid grid-cols-12 gap-4 p-4 border-b border-gray-800 bg-black/40 text-[9px] font-black uppercase tracking-widest text-gray-500">
                                            <div className="col-span-2 text-center">Rank</div>
                                            <div className="col-span-6">Manager</div>
                                            <div className="col-span-2 text-center">Record</div>
                                            <div className="col-span-2 text-right">Points</div>
                                        </div>
                                        <div className="divide-y divide-gray-800">
                                            {leaderboard.map((player, index) => (
                                                <div key={player.user_id} className={`grid grid-cols-12 gap-4 p-4 items-center hover:bg-gray-800/30 transition-colors ${user?.email === player.user_id ? 'bg-pink-900/10' : ''}`}>
                                                    <div className="col-span-2 text-center font-black text-lg italic text-gray-600">
                                                        #{index + 1}
                                                    </div>
                                                    <div className="col-span-6 flex items-center gap-3 overflow-hidden">
                                                        {player.avatarUrl ? (
                                                            <img src={player.avatarUrl} alt={player.displayName} className="w-8 h-8 rounded-full object-cover border border-gray-700 shrink-0" />
                                                        ) : (
                                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 flex items-center justify-center text-[10px] font-black text-gray-300 shrink-0">
                                                                {player.displayName.charAt(0).toUpperCase()}
                                                            </div>
                                                        )}
                                                        <div className="min-w-0">
                                                            <div className={`font-bold text-sm truncate ${user?.email === player.user_id ? 'text-pink-500' : 'text-white'}`}>
                                                                {player.displayName}
                                                            </div>
                                                            {isEventConcluded && index === 0 && (
                                                                <span className="text-[9px] text-yellow-500 font-black uppercase tracking-widest block mt-1">
                                                                    👑 Champion
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="col-span-2 text-center font-bold text-gray-400 text-xs">
                                                        <span className="text-white">{player.wins}</span> - {player.losses}
                                                    </div>
                                                    
                                                    <div className="col-span-2 text-right">
                                                        <span className={`px-2 py-1 rounded text-[10px] font-black ${player.totalScore >= 0 ? 'bg-teal-950 text-teal-400 border border-teal-900' : 'bg-red-950 text-red-400 border border-red-900'}`}>
                                                            {player.totalScore}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                            {leaderboard.length === 0 && (
                                                <div className="p-8 text-center text-gray-500 text-xs font-bold uppercase tracking-widest">
                                                    No ranked members yet.
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* SETTINGS TAB (RESTORED) */}
                    {activeTab === 'settings' && isAdmin && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 space-y-12">
                            
                            {/* 1. EDIT LEAGUE DETAILS */}
                            <div>
                                <h2 className="text-xs font-black text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-pink-600"></span>
                                    Edit League Details
                                </h2>
                                <form 
                                    onSubmit={async (e) => {
                                        e.preventDefault();
                                        const form = e.target;
                                        const newName = form.leagueName.value;
                                        const newImage = form.leagueImage.value;

                                        const { error } = await supabase
                                            .from('leagues')
                                            .update({ name: newName, image_url: newImage })
                                            .eq('id', leagueId);

                                        if (error) setToast({ message: error.message, type: "error" });
                                        else {
                                            setToast({ message: "League updated!", type: "success" });
                                            setTimeout(() => window.location.reload(), 1000); 
                                        }
                                    }}
                                    className="bg-gray-900 border border-gray-800 rounded-xl p-6"
                                >
                                    <div className="grid md:grid-cols-2 gap-6 mb-6">
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-2">League Name</label>
                                            <input 
                                                name="leagueName"
                                                defaultValue={league?.name}
                                                className="w-full bg-black border border-gray-700 p-3 rounded text-white text-sm font-bold focus:border-pink-500 outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-2">Logo Image URL</label>
                                            <input 
                                                name="leagueImage"
                                                defaultValue={league?.image_url}
                                                className="w-full bg-black border border-gray-700 p-3 rounded text-white text-xs font-mono focus:border-pink-500 outline-none"
                                                placeholder="https://..."
                                            />
                                        </div>
                                    </div>
                                    <div className="flex justify-end">
                                        <button type="submit" className="bg-white text-black text-[10px] font-black uppercase px-6 py-3 rounded hover:bg-pink-600 hover:text-white transition-all">
                                            Save Changes
                                        </button>
                                    </div>
                                </form>
                            </div>

                            {/* 2. CONFIGURE FIGHT CARD */}
                            <div>
                                <h2 className="text-xs font-black text-white uppercase tracking-widest mb-4">
                                    Configure Fight Card
                                </h2>
                                <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-4">
                                        Select which fights are visible to league members.
                                    </p>
                                    <div className="flex gap-4">
                                        <button 
                                            onClick={() => setCardFilter('full')}
                                            className={`flex-1 py-3 px-4 rounded border text-[10px] font-black uppercase tracking-widest transition-all ${cardFilter === 'full' ? 'bg-pink-600 border-pink-600 text-white' : 'bg-black border-gray-700 text-gray-500 hover:text-white'}`}
                                        >
                                            Show Full Card
                                        </button>
                                        <button 
                                            onClick={() => setCardFilter('main')}
                                            className={`flex-1 py-3 px-4 rounded border text-[10px] font-black uppercase tracking-widest transition-all ${cardFilter === 'main' ? 'bg-pink-600 border-pink-600 text-white' : 'bg-black border-gray-700 text-gray-500 hover:text-white'}`}
                                        >
                                            Main Card Only
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* 3. ROSTER */}
                            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                                <div className="p-4 border-b border-gray-800 bg-black/20 flex justify-between items-center">
                                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Member Roster</h3>
                                    <span className="text-[10px] font-bold text-gray-600">{members.length} Users</span>
                                </div>
                                <div className="divide-y divide-gray-800">
                                    {members.map((member) => (
                                        <div key={member.user_id} className="p-4 flex items-center justify-between hover:bg-gray-800/30 transition-colors">
                                            <div className="flex items-center gap-4">
                                                {member.avatarUrl ? (
                                                    <img src={member.avatarUrl} alt={member.displayName} className="w-10 h-10 rounded-full object-cover border border-gray-700" />
                                                ) : (
                                                    <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-xs font-black text-gray-400 border border-gray-700">
                                                        {member.displayName ? member.displayName.charAt(0).toUpperCase() : '?'}
                                                    </div>
                                                )}
                                                <div>
                                                    <p className="text-sm font-bold text-white">{member.displayName}</p>
                                                    <p className="text-[10px] text-gray-500 uppercase font-mono">
                                                        Joined: {new Date(member.joined_at).toLocaleDateString()}
                                                    </p>
                                                </div>
                                            </div>
                                            
                                            {(member.user_id !== user?.email && member.user_id !== user?.id) ? (
                                                <button 
                                                    onClick={() => handleKickMember(member.user_id)}
                                                    className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded text-[10px] font-black uppercase tracking-widest shadow-lg shadow-red-900/20 transition-all active:scale-95"
                                                >
                                                    KICK
                                                </button>
                                            ) : (
                                                <span className="text-[9px] font-black uppercase text-teal-500 bg-teal-950/30 px-3 py-1 rounded border border-teal-900/50">
                                                    You
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* 4. DANGER ZONE - UPDATED DELETE BUTTON */}
                            <div className="pt-8 border-t border-gray-800">
                                <div className="flex items-center justify-between gap-2 mb-4">
                                    <h2 className="text-xl font-black uppercase italic tracking-tighter text-red-600">
                                        Danger Zone
                                    </h2>
                                    <button 
                                        onClick={handleDeleteLeague}
                                        disabled={deleting}
                                        className={`px-6 py-3 rounded text-[10px] font-black uppercase tracking-widest transition-all ${
                                            deleteConfirm 
                                            ? "bg-red-600 text-white animate-pulse shadow-[0_0_15px_rgba(220,38,38,0.5)]" 
                                            : "bg-red-950/20 text-red-500 hover:bg-red-950/40 border border-red-900/50 hover:text-white"
                                        }`}
                                    >
                                        {deleting ? 'Deleting...' : (deleteConfirm ? '⚠️ Confirm Delete?' : 'Delete League')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* RIGHT COLUMN */}
                <div className="hidden xl:block w-[33%] relative">
                    {pendingPicks.length > 0 ? (
                        <div className="sticky top-24 max-h-[calc(100vh-120px)] bg-gray-950 border border-gray-800 rounded-xl p-6 shadow-2xl overflow-y-auto">
                             <BettingSlip 
                                picks={pendingPicks} 
                                onCancelAll={() => setPendingPicks([])}
                                onRemovePick={handleRemovePick}
                                onConfirm={handleConfirmAllPicks}
                                isSubmitting={isSubmitting}
                             />
                        </div>
                    ) : (
                        <div className="sticky top-24 h-[600px] flex flex-col">
                            <div className="flex justify-between items-center mb-4 px-2">
                                <h3 className="text-[10px] font-black text-gray-600 uppercase tracking-[0.2em]">League Chat</h3>
                                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                            </div>
                            <div className="flex-1 shadow-2xl shadow-black overflow-hidden rounded-xl border border-gray-900 bg-black">
                                <ChatBox league_id={leagueId} />
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

      {/* --- MOBILE LEAGUE DRAWER --- */}
      <div className={`fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm transition-opacity duration-300 md:hidden ${showMobileLeagues ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={() => setShowMobileLeagues(false)}>
         <div className={`absolute left-0 top-0 bottom-0 w-[80%] max-w-[300px] bg-gray-900 border-r border-gray-800 transform transition-transform duration-300 ${showMobileLeagues ? 'translate-x-0' : '-translate-x-full'}`} onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-800 flex justify-between items-center">
                <span className="font-black italic text-xl">YOUR LEAGUES</span>
                <button onClick={() => setShowMobileLeagues(false)} className="text-gray-500 hover:text-white transition-colors">✕</button>
            </div>
            
            <div className="p-4 space-y-6">
                <div className="flex flex-col gap-4">
                    {myLeagues.length > 0 ? (
                        <LeagueRail initialLeagues={myLeagues} />
                    ) : (
                        <p className="text-gray-500 text-xs italic">No leagues joined yet.</p>
                    )}
                </div>
                
                <div className="border-t border-gray-800 pt-6">
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3">Menu</p>
                    <Link href="/leaderboard" className="flex items-center gap-3 p-3 rounded-lg bg-gray-900/50 border border-gray-800 hover:bg-gray-800 transition-all mb-2">
                        <span className="text-xl">🏆</span>
                        <span className="text-sm font-bold text-gray-300">Global Leaderboard</span>
                    </Link>
                     <Link href="/profile" className="flex items-center gap-3 p-3 rounded-lg bg-gray-900/50 border border-gray-800 hover:bg-gray-800 transition-all">
                        <span className="text-xl">👤</span>
                        <span className="text-sm font-bold text-gray-300">My Profile</span>
                    </Link>
                </div>
            </div>
         </div>
      </div>

      <MobileNav onToggleLeagues={() => setShowMobileLeagues(true)} />

      {/* --- RENDER TOAST --- */}
      {toast && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast(null)} 
        />
      )}

    </div>
  );
}