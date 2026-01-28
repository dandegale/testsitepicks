'use client';

import { createClient } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import FightDashboard from '../../components/FightDashboard';
import ChatBox from '../../components/ChatBox';
import LeagueRail from '../../components/LeagueRail';
import BettingSlip from '../../components/BettingSlip'; 
import LogOutButton from '../../components/LogOutButton';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function LeaguePage() {
  const params = useParams();
  const router = useRouter();
  const leagueId = params.id;

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('card'); 
  const [copySuccess, setCopySuccess] = useState(false);
  
  // Data State
  const [league, setLeague] = useState(null);
  const [members, setMembers] = useState([]); 
  const [leaderboard, setLeaderboard] = useState([]); 
  
  // Fight Data
  const [allFights, setAllFights] = useState([]); 
  const [visibleFights, setVisibleFights] = useState([]); 
  const [cardFilter, setCardFilter] = useState('full'); 
  const [groupedFights, setGroupedFights] = useState({});

  // Champion Logic
  const [isEventConcluded, setIsEventConcluded] = useState(false);

  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false); 
  
  const [myLeagues, setMyLeagues] = useState([]);
  const [existingPicks, setExistingPicks] = useState([]); 
  const [pendingPicks, setPendingPicks] = useState([]); 
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchLeagueData();
  }, [leagueId]);

  useEffect(() => {
      applyCardFilter();
  }, [cardFilter, allFights]);

  // --- UPDATED GROUPING LOGIC ---
  const applyCardFilter = () => {
      if (allFights.length === 0) return;
      
      let filtered = [...allFights];
      
      // Ensure strict ascending order first for the logic to work
      filtered.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

      if (cardFilter === 'main') filtered = filtered.slice(-5);
      
      setVisibleFights(filtered);

      const allFinished = filtered.length > 0 && filtered.every(f => f.winner !== null && f.winner !== undefined && f.winner !== '');
      setIsEventConcluded(allFinished);

      // --- 3-DAY CLUSTERING + REVERSE ORDER LOGIC ---
      let finalGroupedFights = {};
      const tempGroups = [];
      let currentBucket = [];
      
      // Safety check for start time
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
      // Push final bucket
      if (currentBucket.length > 0) tempGroups.push(currentBucket);

      // Name groups & Reverse order
      tempGroups.forEach(bucket => {
          if (bucket.length === 0) return;

          // Main Event is the LAST fight in the sorted bucket
          const mainEventFight = bucket[bucket.length - 1];
          const dateStr = new Date(mainEventFight.start_time).toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric' 
          });
          
          const title = `${mainEventFight.fighter_1_name} vs ${mainEventFight.fighter_2_name} (${dateStr})`;

          // REVERSE the bucket so Main Event is at index 0 (Top of UI)
          finalGroupedFights[title] = [...bucket].reverse();
      });

      setGroupedFights(finalGroupedFights);
  };

  const fetchLeagueData = async () => {
    try {
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        setUser(currentUser);

        // 1. Fetch League
        const { data: leagueData } = await supabase
          .from('leagues')
          .select('*')
          .eq('id', leagueId)
          .single();
        setLeague(leagueData);

        if (currentUser && leagueData) {
            const isCreator = (leagueData.created_by === currentUser.email) || (leagueData.created_by === currentUser.id);
            setIsAdmin(isCreator);
        }

        // 2. Fetch Members (Emails/IDs)
        const { data: membersData } = await supabase
            .from('league_members')
            .select('user_id, joined_at') 
            .eq('league_id', leagueId);
        
        let processedMembers = membersData || [];

        // --- FETCH REAL USERNAMES ---
        if (processedMembers.length > 0) {
            const memberIds = processedMembers.map(m => m.user_id);
            
            const { data: profiles, error: profileError } = await supabase
                .from('profiles')
                .select('email, username') 
                .in('email', memberIds);   

            if (profileError) console.error("Profile Fetch Error:", profileError);

            processedMembers = processedMembers.map(member => {
                const profile = profiles?.find(p => p.email === member.user_id);
                const displayName = (profile && profile.username) 
                    ? profile.username 
                    : member.user_id.split('@')[0]; 

                return { ...member, displayName };
            });
        }

        setMembers(processedMembers);

        // 3. Sidebar
        if (currentUser) {
            const { data: memberships } = await supabase
              .from('league_members')
              .select('leagues ( id, name, image_url, invite_code )')
              .eq('user_id', currentUser.email);
            if (memberships) {
              setMyLeagues(memberships.map(m => m.leagues).filter(Boolean));
            }
        }

        // 4. Fetch Fights (Fetch ALL future fights, we filter later)
        const { data: allFutureFights } = await supabase
            .from('fights')
            .select('*')
            .is('winner', null) // Only active fights
            .order('start_time', { ascending: true }); // Must be ascending for grouping logic

        setAllFights(allFutureFights || []);

        // 5. Fetch User Picks
        if (currentUser) {
            const { data: picksData } = await supabase
                .from('picks')
                .select('*')
                .eq('user_id', currentUser.email)
                .eq('league_id', leagueId); 
            setExistingPicks(picksData || []);
        }

        // 6. --- GENERATE LEADERBOARD ---
        const { data: completedFights } = await supabase
            .from('fights')
            .select('id, winner')
            .not('winner', 'is', null);

        const { data: allLeaguePicks } = await supabase
            .from('picks')
            .select('user_id, fight_id, selected_fighter')
            .eq('league_id', leagueId);

        if (processedMembers && allLeaguePicks) {
            const scores = processedMembers.map(member => {
                let wins = 0;
                let losses = 0;
                const memberPicks = allLeaguePicks.filter(p => p.user_id === member.user_id);

                memberPicks.forEach(pick => {
                    const fight = completedFights?.find(f => f.id === pick.fight_id);
                    if (fight && fight.winner) {
                        if (fight.winner === pick.selected_fighter) wins++;
                        else losses++;
                    }
                });

                return {
                    user_id: member.user_id,
                    displayName: member.displayName, 
                    wins,
                    losses,
                    total: wins + losses,
                    winRate: (wins + losses) > 0 ? Math.round((wins / (wins + losses)) * 100) : 0
                };
            });

            scores.sort((a, b) => b.wins - a.wins || b.winRate - a.winRate);
            setLeaderboard(scores);
        }

    } catch (error) {
        console.error("League Load Error:", error);
    } finally {
        setLoading(false);
    }
  };

  // --- ACTIONS ---
  
  const handleCopyCode = () => {
    if (league?.invite_code) {
        navigator.clipboard.writeText(league.invite_code);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  const handleKickMember = async (memberUserId) => {
    if (!confirm(`Are you sure you want to KICK ${memberUserId}?`)) return;
    const { error } = await supabase.from('league_members').delete().eq('league_id', leagueId).eq('user_id', memberUserId);
    if (error) alert('Error: ' + error.message);
    else setMembers(members.filter(m => m.user_id !== memberUserId));
  };

  const handleDeleteLeague = async () => {
      if (!confirm('WARNING: This will permanently DELETE this league. Continue?')) return;
      const { error } = await supabase.from('leagues').delete().eq('id', leagueId);
      if (error) alert(error.message);
      else router.push('/');
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
  };

  const handleRemovePick = (fightId) => {
    setPendingPicks(current => current.filter(p => p.fightId !== fightId));
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
        league_id: leagueId 
    }));

    const { error } = await supabase.from('picks').insert(picksToInsert);

    setIsSubmitting(false);

    if (error) {
        alert('Error saving picks: ' + error.message);
    } else {
        setPendingPicks([]); 
        window.location.reload(); 
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
      
      {/* Sidebar */}
      <div className="hidden md:block">
        <LeagueRail initialLeagues={myLeagues} />
      </div>

      <main className="flex-1 h-screen overflow-y-auto scrollbar-hide relative flex flex-col">
        
        {/* Header */}
        <header className="sticky top-0 z-[60] w-full bg-black/80 backdrop-blur-xl border-b border-gray-800">
            <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/" className="text-2xl font-black italic text-white tracking-tighter uppercase">
                        FIGHT<span className="text-pink-600">IQ</span>
                    </Link>
                    <div className="h-4 w-px bg-gray-800 mx-2"></div>
                    <nav className="hidden md:flex gap-6 text-[10px] font-black uppercase tracking-widest text-gray-500">
                        <Link href="/" className="hover:text-white transition-colors">Global Feed</Link>
                        <span className="text-pink-600 cursor-default truncate max-w-[150px]">
                            {league?.name}
                        </span>
                    </nav>
                </div>
                <div className="flex items-center gap-4">
                     <Link href="/profile" className="bg-gray-900 hover:bg-gray-800 border border-gray-700 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-gray-300 hover:text-white transition-all">
                        MY PROFILE
                    </Link>
                    <LogOutButton />
                </div>
            </div>
        </header>

        {/* League Hero */}
        <div className="relative w-full bg-gray-900 overflow-hidden border-b border-gray-800 h-[200px]">
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent z-10" />
            {league?.image_url && (
                <img src={league.image_url} className="absolute inset-0 w-full h-full object-cover opacity-50" />
            )}
            <div className="absolute inset-0 flex flex-col justify-end p-6 md:p-10 z-20">
                <div className="max-w-7xl mx-auto w-full">
                    <span className="bg-pink-600 text-white text-[9px] font-black uppercase px-2 py-1 rounded inline-block mb-3">
                        Private League
                    </span>
                    <h1 className="text-4xl md:text-6xl font-black italic uppercase tracking-tighter mb-2 leading-none">
                        {league?.name}
                    </h1>
                    
                    {/* Invite Code */}
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
                                {copySuccess ? 'COPIED!' : '❐ COPY'}
                            </span>
                        </button>
                    </div>

                </div>
            </div>
        </div>

        {/* --- TABS --- */}
        <div className="border-b border-gray-800 bg-gray-950">
            <div className="max-w-7xl mx-auto px-6 py-0 flex gap-0">
                <button 
                    onClick={() => setActiveTab('card')}
                    className={`px-6 py-4 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 ${activeTab === 'card' ? 'border-pink-600 text-white bg-gray-900' : 'border-transparent text-gray-500 hover:text-white hover:bg-gray-900/50'}`}
                >
                    Fight Card
                </button>
                <button 
                    onClick={() => setActiveTab('leaderboard')}
                    className={`px-6 py-4 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 ${activeTab === 'leaderboard' ? 'border-pink-600 text-white bg-gray-900' : 'border-transparent text-gray-500 hover:text-white hover:bg-gray-900/50'}`}
                >
                    Leaderboard
                </button>
                {isAdmin && (
                    <button 
                        onClick={() => setActiveTab('settings')}
                        className={`px-6 py-4 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 ${activeTab === 'settings' ? 'border-pink-600 text-white bg-gray-900' : 'border-transparent text-gray-500 hover:text-white hover:bg-gray-900/50'}`}
                    >
                        Admin Settings
                    </button>
                )}
            </div>
        </div>

        <div className="p-4 md:p-10 max-w-7xl mx-auto min-h-screen w-full">
            <div className="relative flex w-full">
                
                {/* LEFT COLUMN */}
                <div className="w-full xl:w-[66%] pr-0 xl:pr-10 transition-all">
                    
                    {activeTab === 'card' && (
                        <>
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-pink-600 animate-pulse"></span>
                                        <h2 className="text-xl font-black uppercase italic tracking-tighter text-white">
                                            League Fight Card
                                        </h2>
                                    </div>
                                    <button 
                                        onClick={handleCopyCode}
                                        className="hidden md:flex items-center gap-2 bg-gray-900 hover:bg-gray-800 border border-gray-700 px-3 py-1 rounded transition-all group"
                                    >
                                        <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Code:</span>
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
                                />
                            ) : (
                                <div className="p-12 border border-gray-800 rounded-xl text-center text-gray-500 font-bold uppercase tracking-widest">
                                    No fights scheduled.
                                </div>
                            )}
                        </>
                    )}

                    {activeTab === 'leaderboard' && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                             <div className="flex items-center gap-2 mb-6">
                                <span className="text-2xl">🏆</span>
                                <h2 className="text-xl font-black uppercase italic tracking-tighter text-white">
                                    League Standings
                                </h2>
                            </div>

                            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-2xl">
                                <div className="grid grid-cols-12 gap-4 p-4 border-b border-gray-800 bg-black/40 text-[9px] font-black uppercase tracking-widest text-gray-500">
                                    <div className="col-span-1 text-center">Rank</div>
                                    <div className="col-span-6">Manager</div>
                                    <div className="col-span-2 text-center">Record</div>
                                    <div className="col-span-3 text-right">Win %</div>
                                </div>
                                <div className="divide-y divide-gray-800">
                                    {leaderboard.map((player, index) => (
                                        <div key={player.user_id} className={`grid grid-cols-12 gap-4 p-4 items-center hover:bg-gray-800/30 transition-colors ${user?.email === player.user_id ? 'bg-pink-900/10' : ''}`}>
                                            <div className="col-span-1 text-center font-black text-lg italic text-gray-600">
                                                #{index + 1}
                                            </div>
                                            <div className="col-span-6 flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 flex items-center justify-center text-[10px] font-black text-gray-300">
                                                    {player.displayName.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className={`font-bold text-sm ${user?.email === player.user_id ? 'text-pink-500' : 'text-white'}`}>
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
                                            <div className="col-span-3 text-right">
                                                <span className="bg-gray-800 text-white px-2 py-1 rounded text-[10px] font-black">
                                                    {player.winRate}%
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
                    )}

                    {activeTab === 'settings' && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 space-y-8">
                            <div>
                                <h2 className="text-xs font-black text-white uppercase tracking-widest mb-4">
                                    Step 1: Configure Fight Card
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

                            <div className="flex items-center justify-between gap-2 border-b border-gray-800 pb-4">
                                <h2 className="text-xl font-black uppercase italic tracking-tighter text-white">
                                    Danger Zone
                                </h2>
                                <button 
                                    onClick={handleDeleteLeague}
                                    className="bg-red-950/20 text-red-500 hover:bg-red-950/40 border border-red-900/50 px-4 py-2 rounded text-[10px] font-black uppercase tracking-widest transition-all"
                                >
                                    ⚠ Delete League
                                </button>
                            </div>

                            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                                <div className="p-4 border-b border-gray-800 bg-black/20 flex justify-between items-center">
                                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Member Roster</h3>
                                    <span className="text-[10px] font-bold text-gray-600">{members.length} Users</span>
                                </div>
                                <div className="divide-y divide-gray-800">
                                    {members.map((member) => (
                                        <div key={member.user_id} className="p-4 flex items-center justify-between hover:bg-gray-800/30 transition-colors">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-xs font-black text-gray-400 border border-gray-700">
                                                    {member.displayName ? member.displayName.charAt(0).toUpperCase() : '?'}
                                                </div>
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
    </div>
  );
}