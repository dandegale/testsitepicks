'use client';

import { createClient } from '@supabase/supabase-js';
import { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import FightDashboard from '../../components/FightDashboard';
import ChatBox from '../../components/ChatBox';
import LeagueRail from '../../components/LeagueRail';
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
  const searchParams = useSearchParams(); 
  const leagueId = params.id;

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('card'); 
  const [copySuccess, setCopySuccess] = useState(false);
  
  const [showMobileLeagues, setShowMobileLeagues] = useState(false);
  const [showMobileSlip, setShowMobileSlip] = useState(false);
  
  const [expandedUserRoster, setExpandedUserRoster] = useState(null); 
  const [showAllFighters, setShowAllFighters] = useState(false); 
  const [showGlobalBoxScore, setShowGlobalBoxScore] = useState(false);
  const [isRosterCollapsed, setIsRosterCollapsed] = useState(false);

  const [league, setLeague] = useState(null);
  const [members, setMembers] = useState([]); 
  
  const [allFights, setAllFights] = useState([]); 
  const [cardFilter, setCardFilter] = useState('full'); 
  const [fighterStats, setFighterStats] = useState([]); 

  const [showOdds, setShowOdds] = useState(false);

  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false); 
  
  const [myLeagues, setMyLeagues] = useState([]);
  const [allLeaguePicks, setAllLeaguePicks] = useState([]); 
  const [pendingPicks, setPendingPicks] = useState([]); 
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [toast, setToast] = useState(null); 
  const [deleteConfirm, setDeleteConfirm] = useState(false); 
  const [deleting, setDeleting] = useState(false);

  const fileInputRef = useRef(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [localLeagueImage, setLocalLeagueImage] = useState('');

  useEffect(() => {
    fetchLeagueData();
  }, [leagueId]);

  const isFighterMatch = (pickName, statName) => {
      if (!pickName || !statName) return false;
      const cleanName = (str) => str.toLowerCase().replace(/\b(jr\.?|sr\.?|iii|ii)\b/gi, '').trim();
      const getCore = (str) => {
          const parts = cleanName(str).split(' ');
          return parts[parts.length - 1].replace(/[^a-z]/g, '').substring(0, 4);
      };
      return getCore(pickName) === getCore(statName);
  };

  const { currentEventFights, visibleFights, groupedFights, isEventConcluded } = useMemo(() => {
      if (!allFights || allFights.length === 0) return { currentEventFights: [], visibleFights: [], groupedFights: {}, isEventConcluded: false };

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

      const allFinished = nextEventFights.length > 0 && nextEventFights.every(f => f.winner !== null && f.winner !== undefined && f.winner !== '');

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

      return { currentEventFights: nextEventFights, visibleFights: filtered, groupedFights: finalGroupedFights, isEventConcluded: allFinished };
  }, [allFights, cardFilter]);

  const activeLeaguePicks = useMemo(() => {
      const currentEventFightIds = currentEventFights.map(f => String(f.id));
      return allLeaguePicks.filter(p => currentEventFightIds.includes(String(p.fight_id)));
  }, [allLeaguePicks, currentEventFights]);

  const existingPicks = useMemo(() => {
      if (!user) return [];
      return activeLeaguePicks.filter(p => 
          p.user_id === user.email && 
          String(p.league_id) === String(leagueId)
      );
  }, [activeLeaguePicks, user, leagueId]);

  const hasLockedRoster = existingPicks.length >= 5;

  const feedItems = useMemo(() => {
      if (!activeLeaguePicks || !allFights || !members) return [];
      const feed = activeLeaguePicks.map(pick => {
          const member = members.find(m => m.user_id === pick.user_id);
          const fight = allFights.find(f => String(f.id) === String(pick.fight_id));
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
      return feed.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [activeLeaguePicks, allFights, members]);

  const allCardFightersRanked = useMemo(() => {
      if (!fighterStats || fighterStats.length === 0 || currentEventFights.length === 0) return [];
      const fightIds = currentEventFights.map(f => String(f.id));
      const filteredStats = fighterStats.filter(s => fightIds.includes(String(s.fight_id)));
      const mappedStats = filteredStats.map(s => {
          const fight = currentEventFights.find(f => String(f.id) === String(s.fight_id));
          return { ...s, method: fight?.method || '' };
      });
      return mappedStats.sort((a, b) => (b.fantasy_points || 0) - (a.fantasy_points || 0));
  }, [fighterStats, currentEventFights]);

  const leaderboard = useMemo(() => {
      if (!members || !allLeaguePicks || !fighterStats || !allFights) return [];

      let pastEvents = [];
      let currentBucket = [];
      let groupReferenceTime = allFights.length > 0 ? new Date(allFights[0].start_time).getTime() : 0;
      
      const sortedFights = [...allFights].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

      sortedFights.forEach((fight) => {
          const fightTime = new Date(fight.start_time).getTime();
          if (fightTime - groupReferenceTime < 72 * 60 * 60 * 1000) {
              currentBucket.push(fight);
          } else {
              pastEvents.push(currentBucket);
              currentBucket = [fight];
              groupReferenceTime = fightTime;
          }
      });
      if (currentBucket.length > 0) pastEvents.push(currentBucket);

      const historicalWinsMap = {};
      members.forEach(m => historicalWinsMap[m.user_id] = 0);

      // 🎯 NEW: Track who won the MOST RECENT event to award the Belt!
      let latestWinners = [];

      pastEvents.forEach(eventFights => {
          const isCompleted = eventFights.length > 0 && eventFights.every(f => f.winner !== null && f.winner !== undefined && f.winner !== '');
          if (!isCompleted) return;

          const eventFightIds = eventFights.map(f => String(f.id));
          const eventPicks = allLeaguePicks.filter(p => eventFightIds.includes(String(p.fight_id)));
          
          if (eventPicks.length === 0) return;

          let eventScores = {};
          eventPicks.forEach(pick => {
              const stats = fighterStats.find(s => String(s.fight_id) === String(pick.fight_id) && isFighterMatch(pick.selected_fighter, s.fighter_name));
              if (stats) {
                  eventScores[pick.user_id] = (eventScores[pick.user_id] || 0) + parseFloat(stats.fantasy_points || 0);
              }
          });

          let maxScore = -1;
          let winners = [];
          for (const [userId, score] of Object.entries(eventScores)) {
              if (score > maxScore) {
                  maxScore = score;
                  winners = [userId];
              } else if (score === maxScore && maxScore > 0) {
                  winners.push(userId); 
              }
          }

          if (maxScore > 0) {
              winners.forEach(w => {
                  if (historicalWinsMap[w] !== undefined) historicalWinsMap[w] += 1;
                  else historicalWinsMap[w] = 1; 
              });
              // Continuously updates so the last completed event sets the Reigning Champ
              latestWinners = winners; 
          }
      });

      const scores = members.map(member => {
          let totalScore = 0;
          const memberPicks = activeLeaguePicks.filter(p => p.user_id === member.user_id && String(p.league_id) === String(leagueId));

          memberPicks.forEach(pick => {
              const stats = fighterStats.find(s => String(s.fight_id) === String(pick.fight_id) && isFighterMatch(pick.selected_fighter, s.fighter_name));
              if (stats) totalScore += parseFloat(stats.fantasy_points || 0);
          });

          return {
              user_id: member.user_id,
              displayName: member.displayName,
              avatarUrl: member.avatarUrl,
              pickCount: memberPicks.length,
              totalScore: parseFloat(totalScore.toFixed(1)),
              cardsWon: historicalWinsMap[member.user_id] || 0,
              isReigningChamp: latestWinners.includes(member.user_id) // 🎯 Flag the champ
          };
      });

      return scores.sort((a, b) => b.totalScore - a.totalScore || b.cardsWon - a.cardsWon);
  }, [members, activeLeaguePicks, allLeaguePicks, fighterStats, allFights, leagueId]);

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
        setLocalLeagueImage(leagueData?.image_url || '');

        const inviteCode = searchParams.get('invite');
        if (currentUser && leagueData && inviteCode === leagueData.invite_code) {
            const { data: existingMember } = await supabase.from('league_members').select('*').eq('league_id', leagueId).eq('user_id', currentUser.email).single();
            if (!existingMember) {
                await supabase.from('league_members').insert({ league_id: leagueId, user_id: currentUser.email });
                setToast({ message: "Successfully joined the league! 👊", type: "success" });
                router.replace(`/league/${leagueId}`);
            }
        }

        if (currentUser && leagueData) {
            const isCreator = (leagueData.created_by === currentUser.email) || (leagueData.created_by === currentUser.id);
            setIsAdmin(isCreator);
        }

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

        const { data: statsData } = await supabase.from('fighter_stats').select('*');
        setFighterStats(statsData || []);

        const { data: leaguePicksData } = await supabase.from('picks').select('*');
        setAllLeaguePicks(leaguePicksData || []);

    } catch (error) { console.error("League Load Error:", error); } finally { setLoading(false); }
  };

  const handleImageUpload = async (e) => {
    try {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            setToast({ message: "Must be an image file", type: "error" });
            return;
        }
        if (file.size > 5 * 1024 * 1024) { 
            setToast({ message: "Image must be under 5MB", type: "error" });
            return;
        }

        setUploadingImage(true);
        setToast({ message: "Uploading image...", type: "info" });

        const fileExt = file.name.split('.').pop();
        const fileName = `${leagueId}-${Date.now()}.${fileExt}`;
        const filePath = `avatars/${fileName}`; 

        const { error: uploadError } = await supabase.storage
            .from('league-images')
            .upload(filePath, file, { cacheControl: '3600', upsert: true });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
            .from('league-images')
            .getPublicUrl(filePath);

        setLocalLeagueImage(publicUrl);
        setToast({ message: "Image uploaded! Click Save Changes.", type: "success" });

    } catch (error) {
        console.error("Upload Error:", error);
        setToast({ message: "Upload failed: " + error.message, type: "error" });
    } finally {
        setUploadingImage(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }
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
    if (hasLockedRoster) {
        alert("Your 5-man roster is already locked in!");
        return;
    }

    const safePick = { ...newPick, username: user?.user_metadata?.username || user?.email };

    setPendingPicks(currentPicks => {
        const existingIndex = currentPicks.findIndex(p => p.fightId === safePick.fightId);
        if (existingIndex >= 0 && currentPicks[existingIndex].fighterName === safePick.fighterName) {
            return currentPicks.filter((_, i) => i !== existingIndex);
        }
        if (currentPicks.length >= 5 && existingIndex === -1) {
            alert("Roster is full! You must unselect someone before adding another fighter.");
            return currentPicks;
        }
        if (existingIndex >= 0) {
            const updated = [...currentPicks];
            updated[existingIndex] = safePick;
            return updated;
        }
        return [...currentPicks, safePick];
    });
  };

  const handleRemovePick = (fightId) => setPendingPicks(c => c.filter(p => p.fightId !== fightId));

  const handleConfirmAllPicks = async () => {
    if (pendingPicks.length !== 5) return alert("You must fill all 5 roster slots!");
    if (!user) return alert("Log in to lock picks!");
    
    setIsSubmitting(true);
    const username = user.user_metadata?.username || user.email.split('@')[0];
    
    const picksToInsert = pendingPicks.map(p => ({
        user_id: user.email,
        username: username, 
        fight_id: p.fightId,
        selected_fighter: p.fighterName,
        odds_at_pick: parseInt(p.odds, 10) || 0,
        league_id: leagueId 
    }));

    const { error } = await supabase.from('picks').upsert(picksToInsert, { onConflict: 'league_id, user_id, fight_id' });

    if (error) {
        console.error("Submission Error:", error);
        setToast({ message: "Error saving picks", type: "error" });
    } else {
        setPendingPicks([]); 
        setToast({ message: "Picks Locked In!", type: "success" });
        setIsRosterCollapsed(true);
        setTimeout(() => window.location.reload(), 1500); 
    }
    setIsSubmitting(false);
  };

  const getStatsForPick = (pick) => {
      const stats = fighterStats.find(s => String(s.fight_id) === String(pick.fight_id) && isFighterMatch(pick.selected_fighter, s.fighter_name));
      return stats || { is_winner: null, sig_strikes: 0, takedowns: 0, knockdowns: 0, sub_attempts: 0, control_time_seconds: 0, fantasy_points: 0 };
  };

  // 🎯 Updated to accept isReigningChamp and display the belt in their Box Score header
  const renderTeamBoxScore = (email, playerName = null, totalScore = 0, showHeader = false, isReigningChamp = false) => {
      if (!email) return null; 
      const teamPicks = activeLeaguePicks.filter(p => p.user_id === email && String(p.league_id) === String(leagueId));
      
      return (
          <div className={`bg-black overflow-hidden w-full transition-all ${showHeader ? 'border border-gray-800 rounded-xl' : 'border-t border-gray-800'}`}>
              {showHeader && (
                  <div className="bg-gray-900 p-3 border-b border-gray-800 flex justify-between items-center">
                      <span className="text-xs font-black uppercase tracking-widest text-white flex items-center gap-2">
                          <Link href={`/u/${encodeURIComponent(playerName)}`} className="hover:text-pink-400 transition-colors">
                              {playerName}'s Roster
                          </Link>
                          {isReigningChamp && (
                              <img src="/champion.png" alt="Champ" className="w-5 h-5 drop-shadow-[0_0_10px_rgba(234,179,8,0.8)]" title="Reigning Champion" />
                          )}
                      </span>
                      <span className="text-pink-500 font-black text-xs">{totalScore} PTS</span>
                  </div>
              )}
              <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left text-[9px] sm:text-[10px] md:text-xs">
                      <thead className="bg-gray-950 text-gray-500 uppercase tracking-widest font-black text-[8px] sm:text-[9px]">
                          <tr>
                              <th className="px-1 py-2 sm:p-2 md:p-3 truncate max-w-[60px] sm:max-w-none">Fighter</th>
                              <th className="px-1 py-2 sm:p-2 md:p-3 text-center">Result</th>
                              <th className="px-1 py-2 sm:p-2 md:p-3 text-center">KD</th> 
                              <th className="px-1 py-2 sm:p-2 md:p-3 text-center">SS</th>
                              <th className="px-1 py-2 sm:p-2 md:p-3 text-center">TD</th>
                              <th className="px-1 py-2 sm:p-2 md:p-3 text-center">SUB</th>
                              <th className="px-1 py-2 sm:p-2 md:p-3 text-center">CTRL</th>
                              <th className="px-1 py-2 sm:p-2 md:p-3 text-right text-pink-500">PTS</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-900">
                          {teamPicks.map(pick => {
                              const isMe = user?.email === email;
                              const canSee = isMe || hasLockedRoster || isEventConcluded;
                              
                              if (!canSee) {
                                  return (
                                      <tr key={pick.id} className="bg-gray-950/50">
                                          <td className="px-1 py-2 sm:p-2 md:p-3 font-bold text-gray-600 truncate max-w-[60px] sm:max-w-[100px] md:max-w-none flex items-center gap-2">
                                              <img src="/lock.png" alt="Locked" className="w-6 h-6 object-contain opacity-50" />
                                              HIDDEN
                                          </td>
                                          <td className="px-1 py-2 sm:p-2 md:p-3 text-center text-gray-700">-</td>
                                          <td className="px-1 py-2 sm:p-2 md:p-3 text-center text-gray-700">-</td> 
                                          <td className="px-1 py-2 sm:p-2 md:p-3 text-center text-gray-700">-</td>
                                          <td className="px-1 py-2 sm:p-2 md:p-3 text-center text-gray-700">-</td>
                                          <td className="px-1 py-2 sm:p-2 md:p-3 text-center text-gray-700">-</td>
                                          <td className="px-1 py-2 sm:p-2 md:p-3 text-center text-gray-700">-</td>
                                          <td className="px-1 py-2 sm:p-2 md:p-3 text-right text-gray-700">-</td>
                                      </tr>
                                  );
                              }

                              const stats = getStatsForPick(pick);
                              const m = Math.floor((stats.control_time_seconds || 0) / 60);
                              const s = (stats.control_time_seconds || 0) % 60;
                              const ctrlStr = `${m}:${s.toString().padStart(2, '0')}`;
                              
                              const fightInfo = allFights.find(f => String(f.id) === String(pick.fight_id));
                              const winMethod = fightInfo?.method ? `\n(${fightInfo.method})` : '';
                              
                              return (
                                  <tr key={pick.id} className="hover:bg-gray-900/50 transition-colors">
                                      <td className="px-1 py-2 sm:p-2 md:p-3 font-bold text-white truncate max-w-[60px] sm:max-w-[100px] md:max-w-none" title={pick.selected_fighter}>{pick.selected_fighter}</td>
                                      <td className="px-1 py-2 sm:p-2 md:p-3 text-center font-black text-[8px] sm:text-[9px] md:text-[10px] leading-tight">
                                          {stats.is_winner === true ? (
                                              <span className="text-teal-400 whitespace-pre-wrap">W{winMethod}</span>
                                          ) : stats.is_winner === false ? (
                                              <span className="text-red-500 whitespace-pre-wrap">L{winMethod}</span>
                                          ) : (
                                              <span className="text-gray-600">-</span>
                                          )}
                                      </td>
                                      <td className="px-1 py-2 sm:p-2 md:p-3 text-center text-gray-300">{stats.knockdowns || 0}</td>
                                      <td className="px-1 py-2 sm:p-2 md:p-3 text-center text-gray-300">{stats.sig_strikes || 0}</td>
                                      <td className="px-1 py-2 sm:p-2 md:p-3 text-center text-gray-300">{stats.takedowns || 0}</td>
                                      <td className="px-1 py-2 sm:p-2 md:p-3 text-center text-gray-300">{stats.sub_attempts || 0}</td>
                                      <td className="px-1 py-2 sm:p-2 md:p-3 text-center text-gray-300">{ctrlStr}</td>
                                      <td className="px-1 py-2 sm:p-2 md:p-3 text-right font-black text-pink-500">{(stats.fantasy_points || 0).toFixed(1)}</td>
                                  </tr>
                              );
                          })}
                      </tbody>
                  </table>
              </div>
          </div>
      );
  };

  const renderRosterSlots = () => {
    if (hasLockedRoster) {
        return (
            <div className="space-y-3">
                {existingPicks.map((pick, index) => (
                    <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-teal-950/20 border border-teal-500/30">
                        <div>
                            <div className="text-[9px] font-black text-teal-400 uppercase tracking-widest mb-0.5">LOCKED SLOT {index + 1}</div>
                            <div className="text-sm font-black text-white uppercase truncate">{pick.selected_fighter}</div>
                        </div>
                        <img src="/lock.png" alt="Locked" className="w-10 h-10 object-contain animate-pulse drop-shadow-[0_0_15px_rgba(20,184,166,0.6)]" />
                    </div>
                ))}
                <div className="pt-4 mt-4 text-center">
                    <p className="text-[10px] font-black uppercase text-teal-400 tracking-widest border border-teal-500/50 bg-teal-950/30 py-2 rounded-lg">Roster Confirmed</p>
                </div>
            </div>
        );
    }

    const slots = [0, 1, 2, 3, 4];
    return (
        <div className="space-y-3">
            {slots.map(index => {
                const pick = pendingPicks[index];
                return (
                    <div key={index} className={`flex items-center justify-between p-3 rounded-lg border transition-all ${pick ? 'bg-gray-900 border-pink-500/50' : 'bg-gray-950 border-gray-800 border-dashed'}`}>
                        {pick ? (
                            <>
                                <div>
                                    <div className="text-[9px] font-black text-pink-500 uppercase tracking-widest mb-0.5">SLOT {index + 1}</div>
                                    <div className="text-sm font-black text-white uppercase truncate">{pick.fighterName}</div>
                                </div>
                                <button onClick={() => handleRemovePick(pick.fightId)} className="text-gray-500 hover:text-red-500 text-xs font-black p-2">✕</button>
                            </>
                        ) : (
                            <div className="flex items-center gap-3 w-full opacity-50">
                                <div className="w-6 h-6 rounded-full bg-gray-900 flex items-center justify-center text-[10px] font-black text-gray-500">{index + 1}</div>
                                <div className="text-xs font-bold text-gray-600 uppercase tracking-widest">Empty Slot</div>
                            </div>
                        )}
                    </div>
                );
            })}
            
            <div className="pt-4 border-t border-gray-900 mt-4">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Roster Status</span>
                    <span className={`text-[10px] font-black uppercase ${pendingPicks.length === 5 ? 'text-teal-400' : 'text-pink-500'}`}>{pendingPicks.length} / 5</span>
                </div>
                <div className="w-full h-1.5 bg-gray-900 rounded-full overflow-hidden mb-6">
                    <div className="h-full bg-pink-600 transition-all duration-300" style={{ width: `${(pendingPicks.length / 5) * 100}%` }}></div>
                </div>
                
                <button 
                    disabled={pendingPicks.length !== 5 || isSubmitting}
                    onClick={handleConfirmAllPicks}
                    className={`w-full py-4 rounded-xl font-black uppercase tracking-widest transition-all ${pendingPicks.length === 5 ? 'bg-pink-600 text-white shadow-[0_0_20px_rgba(236,72,153,0.4)] hover:scale-[1.02] active:scale-95' : 'bg-gray-900 text-gray-600 cursor-not-allowed'}`}
                >
                    {isSubmitting ? 'Locking...' : pendingPicks.length === 5 ? 'Lock In Roster' : `Select ${5 - pendingPicks.length} More`}
                </button>
            </div>
        </div>
    );
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
      <div className="hidden lg:block">
        <LeagueRail initialLeagues={myLeagues} />
      </div>

      <main className="flex-1 h-screen overflow-y-auto overflow-x-hidden scrollbar-hide relative flex flex-col pb-24 md:pb-0">
        
        <header className="sticky top-0 z-[60] w-full bg-black/80 backdrop-blur-xl border-b border-gray-800">
            <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/" className="text-xl md:text-2xl font-black italic text-white tracking-tighter uppercase">
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

        <div className="relative w-full bg-gray-900 overflow-hidden border-b border-gray-800 h-[180px] md:h-[200px]">
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent z-10" />
            {league?.image_url && (
                <img src={league.image_url} className="absolute inset-0 w-full h-full object-cover opacity-50" alt="League Banner" />
            )}
            <div className="absolute inset-0 flex flex-col justify-end p-4 md:p-10 z-20">
                <div className="max-w-7xl mx-auto w-full">
                    <span className="bg-pink-600 text-white text-[9px] font-black uppercase px-2 py-1 rounded inline-block mb-2 md:mb-3">
                        DFS League
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

        <div className="border-b border-gray-800 bg-gray-950 sticky top-16 z-40">
            <div className="max-w-7xl mx-auto px-4 md:px-6 flex gap-2 md:gap-0 overflow-x-auto scrollbar-hide">
                <button 
                    onClick={() => setActiveTab('card')}
                    className={`whitespace-nowrap px-4 md:px-6 py-4 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 ${activeTab === 'card' ? 'border-pink-600 text-white bg-gray-900' : 'border-transparent text-gray-500 hover:text-white hover:bg-gray-900/50'}`}
                >
                    Draft Card
                </button>
                <button 
                    onClick={() => setActiveTab('leaderboard')}
                    className={`whitespace-nowrap px-4 md:px-6 py-4 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 ${activeTab === 'leaderboard' ? 'border-pink-600 text-white bg-gray-900' : 'border-transparent text-gray-500 hover:text-white hover:bg-gray-900/50'}`}
                >
                    Leaderboard
                </button>
                <button 
                    onClick={() => setActiveTab('feed')}
                    className={`whitespace-nowrap px-4 md:px-6 py-4 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 ${activeTab === 'feed' ? 'border-pink-600 text-white bg-gray-900' : 'border-transparent text-gray-500 hover:text-white hover:bg-gray-900/50'}`}
                >
                    Activity Feed
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
            
            <div className="relative grid grid-cols-1 lg:grid-cols-3 w-full gap-6 lg:gap-10 items-start">
                
                <div className="lg:col-span-2 transition-all w-full min-w-0">
                    
                    {activeTab === 'card' && (
                        <>
                            <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
                                <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-start">
                                    <div className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-pink-600 animate-pulse"></span>
                                        <h2 className="text-xl font-black uppercase italic tracking-tighter text-white">
                                            {hasLockedRoster ? 'League Event Card' : 'Draft Your Roster'}
                                        </h2>
                                    </div>
                                    <button onClick={handleCopyCode} className="flex items-center gap-2 bg-gray-900 hover:bg-gray-800 border border-gray-700 px-3 py-1 rounded transition-all group">
                                        <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">
                                            <span className="hidden sm:inline">Share:</span>
                                            <span className="sm:hidden">Invite</span>
                                        </span>
                                        <span className="text-xs font-mono font-bold text-pink-500">{league?.invite_code}</span>
                                    </button>
                                </div>
                            </div>
                            
                            <div className="mb-6 space-y-6">
                                <div className="bg-gray-950 border border-gray-900 rounded-xl shadow-lg">
                                    <button onClick={() => setShowGlobalBoxScore(!showGlobalBoxScore)} className="w-full flex items-center justify-between p-4 hover:bg-gray-800 transition-colors focus:outline-none">
                                        <div className="flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-pink-500 animate-pulse"></span>
                                            <h3 className="text-[10px] md:text-xs font-black uppercase tracking-[0.2em] text-gray-400">League-Wide Live Box Score</h3>
                                        </div>
                                        <span className="text-pink-500 font-black text-[10px] uppercase tracking-widest bg-pink-950/30 px-3 py-1 rounded">{showGlobalBoxScore ? 'Hide ▲' : 'View ▼'}</span>
                                    </button>
                                    {showGlobalBoxScore && (
                                        <div className="p-4 border-t border-gray-900 max-h-[800px] overflow-y-auto custom-scrollbar flex flex-col gap-6">
                                            {leaderboard.map(player => (
                                                <div key={player.user_id}>
                                                    {renderTeamBoxScore(player.user_id, player.displayName, player.totalScore, true, player.isReigningChamp)}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="bg-gray-950 border border-gray-900 rounded-xl shadow-lg">
                                    <button onClick={() => setShowAllFighters(!showAllFighters)} className="w-full flex items-center justify-between p-4 hover:bg-gray-800 transition-colors focus:outline-none">
                                        <div className="flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse"></span>
                                            <h3 className="text-[10px] md:text-xs font-black uppercase tracking-[0.2em] text-gray-400">Live Fighter Stats (Optimal Lineup)</h3>
                                        </div>
                                        <span className="text-teal-500 font-black text-[10px] uppercase tracking-widest bg-teal-950/30 px-3 py-1 rounded">{showAllFighters ? 'Hide ▲' : 'View ▼'}</span>
                                    </button>
                                    {showAllFighters && (
                                        <div className="p-4 border-t border-gray-900 max-h-[600px] overflow-y-auto custom-scrollbar">
                                            <div className="bg-black border border-gray-800 rounded-xl overflow-hidden shadow-2xl">
                                                <div className="w-full overflow-x-auto">
                                                    <table className="w-full text-left text-[9px] sm:text-[10px] md:text-xs">
                                                        <thead className="bg-gray-950 text-gray-500 uppercase tracking-widest font-black text-[8px] sm:text-[9px]">
                                                            <tr>
                                                                <th className="px-1 py-2 sm:p-2 md:p-3 text-center">Rnk</th>
                                                                <th className="px-1 py-2 sm:p-2 md:p-3 truncate max-w-[60px] sm:max-w-none">Fighter</th>
                                                                <th className="px-1 py-2 sm:p-2 md:p-3 text-center">Result</th>
                                                                <th className="px-1 py-2 sm:p-2 md:p-3 text-center">KD</th>
                                                                <th className="px-1 py-2 sm:p-2 md:p-3 text-center">SS</th>
                                                                <th className="px-1 py-2 sm:p-2 md:p-3 text-center">TD</th>
                                                                <th className="px-1 py-2 sm:p-2 md:p-3 text-center">SUB</th>
                                                                <th className="px-1 py-2 sm:p-2 md:p-3 text-center">CTRL</th>
                                                                <th className="px-1 py-2 sm:p-2 md:p-3 text-right text-teal-400">PTS</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-900">
                                                            {allCardFightersRanked.map((stats, idx) => {
                                                                const m = Math.floor((stats.control_time_seconds || 0) / 60);
                                                                const s = (stats.control_time_seconds || 0) % 60;
                                                                const ctrlStr = `${m}:${s.toString().padStart(2, '0')}`;
                                                                const winMethod = stats.method ? `\n(${stats.method})` : '';

                                                                return (
                                                                    <tr key={stats.id || idx} className="hover:bg-gray-900/50 transition-colors">
                                                                        <td className="px-1 py-2 sm:p-2 md:p-3 font-black text-gray-500 text-center">{idx + 1}</td>
                                                                        <td className="px-1 py-2 sm:p-2 md:p-3 font-bold text-white truncate max-w-[60px] sm:max-w-[100px] md:max-w-none" title={stats.fighter_name}>{stats.fighter_name}</td>
                                                                        <td className="px-1 py-2 sm:p-2 md:p-3 text-center font-black text-[8px] sm:text-[9px] md:text-[10px] leading-tight">
                                                                            {stats.is_winner === true ? (
                                                                                <span className="text-teal-400 whitespace-pre-wrap">W{winMethod}</span>
                                                                            ) : stats.is_winner === false ? (
                                                                                <span className="text-red-500 whitespace-pre-wrap">L{winMethod}</span>
                                                                            ) : (
                                                                                <span className="text-gray-600">-</span>
                                                                            )}
                                                                        </td>
                                                                        <td className="px-1 py-2 sm:p-2 md:p-3 text-center text-gray-300">{stats.knockdowns || 0}</td>
                                                                        <td className="px-1 py-2 sm:p-2 md:p-3 text-center text-gray-300">{stats.sig_strikes || 0}</td>
                                                                        <td className="px-1 py-2 sm:p-2 md:p-3 text-center text-gray-300">{stats.takedowns || 0}</td>
                                                                        <td className="px-1 py-2 sm:p-2 md:p-3 text-center text-gray-300">{stats.sub_attempts || 0}</td>
                                                                        <td className="px-1 py-2 sm:p-2 md:p-3 text-center text-gray-300">{ctrlStr}</td>
                                                                        <td className="px-1 py-2 sm:p-2 md:p-3 text-right font-black text-teal-400">{(stats.fantasy_points || 0).toFixed(1)}</td>
                                                                    </tr>
                                                                );
                                                            })}
                                                            {allCardFightersRanked.length === 0 && (
                                                                <tr>
                                                                    <td colSpan="9" className="p-6 text-center text-gray-600 font-bold uppercase tracking-widest text-[10px]">No stats available for this event yet</td>
                                                                </tr>
                                                            )}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className={hasLockedRoster ? 'opacity-80' : ''}>
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
                            </div>
                        </>
                    )}

                    {activeTab === 'leaderboard' && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                             
                            <div className="bg-gray-950 border border-gray-900 rounded-xl shadow-lg mb-6">
                                <button onClick={() => setShowGlobalBoxScore(!showGlobalBoxScore)} className="w-full flex items-center justify-between p-4 hover:bg-gray-800 transition-colors focus:outline-none">
                                    <div className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-pink-500 animate-pulse"></span>
                                        <h3 className="text-[10px] md:text-xs font-black uppercase tracking-[0.2em] text-gray-400">League-Wide Live Box Score</h3>
                                    </div>
                                    <span className="text-pink-500 font-black text-[10px] uppercase tracking-widest bg-pink-950/30 px-3 py-1 rounded">{showGlobalBoxScore ? 'Hide ▲' : 'View ▼'}</span>
                                </button>
                                {showGlobalBoxScore && (
                                    <div className="p-4 border-t border-gray-900 max-h-[800px] overflow-y-auto custom-scrollbar flex flex-col gap-6">
                                        {leaderboard.map(player => (
                                            <div key={player.user_id}>
                                                {renderTeamBoxScore(player.user_id, player.displayName, player.totalScore, true, player.isReigningChamp)}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="bg-gray-950 border border-gray-900 rounded-xl shadow-lg mb-6">
                                <button onClick={() => setShowAllFighters(!showAllFighters)} className="w-full flex items-center justify-between p-4 hover:bg-gray-800 transition-colors focus:outline-none">
                                    <div className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse"></span>
                                        <h3 className="text-[10px] md:text-xs font-black uppercase tracking-[0.2em] text-gray-400">Live Fighter Stats (Optimal Lineup)</h3>
                                    </div>
                                    <span className="text-teal-500 font-black text-[10px] uppercase tracking-widest bg-teal-950/30 px-3 py-1 rounded">{showAllFighters ? 'Hide ▲' : 'View ▼'}</span>
                                </button>
                                
                                {showAllFighters && (
                                    <div className="p-4 border-t border-gray-900 max-h-[600px] overflow-y-auto custom-scrollbar">
                                        <div className="bg-black border border-gray-800 rounded-xl overflow-hidden shadow-2xl">
                                            <div className="w-full overflow-x-auto">
                                                <table className="w-full text-left text-[9px] sm:text-[10px] md:text-xs">
                                                    <thead className="bg-gray-950 text-gray-500 uppercase tracking-widest font-black text-[8px] sm:text-[9px]">
                                                        <tr>
                                                            <th className="px-1 py-2 sm:p-2 md:p-3 text-center">Rnk</th>
                                                            <th className="px-1 py-2 sm:p-2 md:p-3 truncate max-w-[60px] sm:max-w-none">Fighter</th>
                                                            <th className="px-1 py-2 sm:p-2 md:p-3 text-center">Result</th>
                                                            <th className="px-1 py-2 sm:p-2 md:p-3 text-center">KD</th>
                                                            <th className="px-1 py-2 sm:p-2 md:p-3 text-center">SS</th>
                                                            <th className="px-1 py-2 sm:p-2 md:p-3 text-center">TD</th>
                                                            <th className="px-1 py-2 sm:p-2 md:p-3 text-center">SUB</th>
                                                            <th className="px-1 py-2 sm:p-2 md:p-3 text-center">CTRL</th>
                                                            <th className="px-1 py-2 sm:p-2 md:p-3 text-right text-teal-400">PTS</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-900">
                                                        {allCardFightersRanked.map((stats, idx) => {
                                                            const m = Math.floor((stats.control_time_seconds || 0) / 60);
                                                            const s = (stats.control_time_seconds || 0) % 60;
                                                            const ctrlStr = `${m}:${s.toString().padStart(2, '0')}`;
                                                            const winMethod = stats.method ? `\n(${stats.method})` : '';

                                                            return (
                                                                <tr key={stats.id || idx} className="hover:bg-gray-900/50 transition-colors">
                                                                    <td className="px-1 py-2 sm:p-2 md:p-3 font-black text-gray-500 text-center">{idx + 1}</td>
                                                                    <td className="px-1 py-2 sm:p-2 md:p-3 font-bold text-white truncate max-w-[60px] sm:max-w-[100px] md:max-w-none" title={stats.fighter_name}>{stats.fighter_name}</td>
                                                                    <td className="px-1 py-2 sm:p-2 md:p-3 text-center font-black text-[8px] sm:text-[9px] md:text-[10px] leading-tight">
                                                                        {stats.is_winner === true ? (
                                                                            <span className="text-teal-400 whitespace-pre-wrap">W{winMethod}</span>
                                                                        ) : stats.is_winner === false ? (
                                                                            <span className="text-red-500 whitespace-pre-wrap">L{winMethod}</span>
                                                                        ) : (
                                                                            <span className="text-gray-600">-</span>
                                                                        )}
                                                                    </td>
                                                                    <td className="px-1 py-2 sm:p-2 md:p-3 text-center text-gray-300">{stats.knockdowns || 0}</td>
                                                                    <td className="px-1 py-2 sm:p-2 md:p-3 text-center text-gray-300">{stats.sig_strikes || 0}</td>
                                                                    <td className="px-1 py-2 sm:p-2 md:p-3 text-center text-gray-300">{stats.takedowns || 0}</td>
                                                                    <td className="px-1 py-2 sm:p-2 md:p-3 text-center text-gray-300">{stats.sub_attempts || 0}</td>
                                                                    <td className="px-1 py-2 sm:p-2 md:p-3 text-center text-gray-300">{ctrlStr}</td>
                                                                    <td className="px-1 py-2 sm:p-2 md:p-3 text-right font-black text-teal-400">{(stats.fantasy_points || 0).toFixed(1)}</td>
                                                                </tr>
                                                            );
                                                        })}
                                                        {allCardFightersRanked.length === 0 && (
                                                            <tr>
                                                                <td colSpan="9" className="p-6 text-center text-gray-600 font-bold uppercase tracking-widest text-[10px]">No stats available for this event yet</td>
                                                            </tr>
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                             <div className="flex items-center gap-3 mb-6">
                                <img src="/trophy.png" alt="Leaderboard" className="w-12 h-12 object-contain drop-shadow-[0_0_20px_rgba(234,179,8,0.6)]" />
                                <h2 className="text-2xl font-black uppercase italic tracking-tighter text-white">
                                    DFS Standings
                                </h2>
                            </div>

                            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-2xl mb-8">
                                <div className="overflow-x-auto custom-scrollbar">
                                    <div className="min-w-[500px]">
                                        <div className="grid grid-cols-12 gap-4 p-4 border-b border-gray-800 bg-black/40 text-[9px] font-black uppercase tracking-widest text-gray-500">
                                            <div className="col-span-2 text-center">Rank</div>
                                            <div className="col-span-4">Manager</div>
                                            <div className="col-span-2 text-center" title="Number of past events won">Record</div>
                                            <div className="col-span-2 text-center">Roster</div>
                                            <div className="col-span-2 text-right">Fantasy PTS</div>
                                        </div>
                                        <div className="divide-y divide-gray-800">
                                            {leaderboard.map((player, index) => (
                                                <div key={player.user_id}>
                                                    <div 
                                                        onClick={() => setExpandedUserRoster(expandedUserRoster === player.user_id ? null : player.user_id)}
                                                        className={`grid grid-cols-12 gap-4 p-4 items-center cursor-pointer hover:bg-gray-800/50 transition-colors ${user?.email === player.user_id ? 'bg-pink-900/10' : ''}`}
                                                    >
                                                        <div className="col-span-2 text-center font-black text-lg italic text-gray-600">
                                                            #{index + 1}
                                                        </div>
                                                        
                                                        <div className="col-span-4 flex items-center gap-3 overflow-hidden">
                                                            <Link 
                                                                href={`/u/${encodeURIComponent(player.displayName)}`} 
                                                                onClick={(e) => e.stopPropagation()} 
                                                                className="flex-shrink-0 hover:opacity-80 transition-opacity"
                                                            >
                                                                {player.avatarUrl ? (
                                                                    <img src={player.avatarUrl} alt={player.displayName} className="w-8 h-8 rounded-full object-cover border border-gray-700 shrink-0" />
                                                                ) : (
                                                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 flex items-center justify-center text-[10px] font-black text-gray-300 shrink-0">
                                                                        {player.displayName.charAt(0).toUpperCase()}
                                                                    </div>
                                                                )}
                                                            </Link>
                                                            <div className="min-w-0">
                                                                <Link 
                                                                    href={`/u/${encodeURIComponent(player.displayName)}`} 
                                                                    onClick={(e) => e.stopPropagation()}
                                                                    className={`font-bold text-sm block truncate hover:text-pink-400 transition-colors ${user?.email === player.user_id ? 'text-pink-500' : 'text-white'}`}
                                                                >
                                                                    {player.displayName}
                                                                </Link>
                                                                
                                                                {/* 🎯 REIGNING CHAMPION BELT */}
                                                                {player.isReigningChamp && (
                                                                    <span className="text-[9px] text-yellow-500 font-black uppercase tracking-widest flex items-center gap-1.5 mt-1">
                                                                        <img src="/champion.png" className="w-5 h-5 object-contain drop-shadow-[0_0_10px_rgba(234,179,8,0.8)]" alt="Reigning Champ" />
                                                                        Reigning Champ
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        
                                                        <div className="col-span-2 flex items-center justify-center gap-2">
                                                            <img src="/trophy.png" alt="Trophies" className="w-8 h-8 object-contain brightness-110 drop-shadow-[0_0_15px_rgba(234,179,8,0.4)]" />
                                                            <span className="text-white font-black text-sm">{player.cardsWon}</span>
                                                        </div>

                                                        <div className="col-span-2 text-center">
                                                            <span className={`text-[10px] font-black ${player.pickCount === 5 ? 'text-teal-400' : 'text-gray-500'}`}>
                                                                {player.pickCount} / 5
                                                            </span>
                                                        </div>
                                                        <div className="col-span-2 flex items-center justify-end gap-3">
                                                            <span className="text-base font-black italic text-pink-500">
                                                                {player.totalScore}
                                                            </span>
                                                            <span className="text-[10px] text-gray-500">{expandedUserRoster === player.user_id ? '▲' : '▼'}</span>
                                                        </div>
                                                    </div>

                                                    {expandedUserRoster === player.user_id && (
                                                        <div className="bg-black border-y border-gray-800 animate-in slide-in-from-top-2 duration-200">
                                                            {renderTeamBoxScore(player.user_id, player.displayName, player.totalScore, false, player.isReigningChamp)}
                                                        </div>
                                                    )}
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

                    {activeTab === 'feed' && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                             <div className="flex items-center gap-2 mb-6">
                                <span className="text-2xl">⚡</span>
                                <h2 className="text-xl font-black uppercase italic tracking-tighter text-white">
                                    Recent Draft Activity
                                </h2>
                            </div>
                            
                            <div className="space-y-4">
                                {feedItems.map(item => (
                                    <div key={item.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between hover:border-gray-700 transition-colors">
                                        
                                        <div className="flex items-center gap-3 md:gap-4 overflow-hidden">
                                            <Link href={`/u/${encodeURIComponent(item.user)}`} className="flex-shrink-0 hover:opacity-80 transition-opacity">
                                                {item.avatar ? (
                                                    <img src={item.avatar} alt={item.user} className="w-10 h-10 rounded-full object-cover border border-gray-700 shrink-0" />
                                                ) : (
                                                    <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center font-black text-gray-500 border border-gray-700 shrink-0">
                                                        {item.user.charAt(0).toUpperCase()}
                                                    </div>
                                                )}
                                            </Link>
                                            
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <Link href={`/u/${encodeURIComponent(item.user)}`} className="font-bold text-white hover:text-pink-400 transition-colors text-sm truncate">
                                                        {item.user}
                                                    </Link>
                                                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest hidden sm:inline">drafted</span>
                                                </div>
                                                <div className="text-base md:text-lg font-black italic text-pink-500 uppercase leading-none mt-1 truncate">
                                                    {item.fighter}
                                                </div>
                                                <div className="text-[10px] text-gray-500 font-mono mt-1 truncate">{item.fight_context}</div>
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0 ml-2">
                                            <div className="text-[9px] text-gray-600 font-bold uppercase tracking-widest mt-1">
                                                {new Date(item.timestamp).toLocaleDateString()}
                                            </div>
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

                    {activeTab === 'settings' && isAdmin && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 space-y-12">
                            
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
                                        
                                        const { error } = await supabase
                                            .from('leagues')
                                            .update({ name: newName, image_url: localLeagueImage }) 
                                            .eq('id', leagueId);

                                        if (error) setToast({ message: error.message, type: "error" });
                                        else {
                                            setToast({ message: "League updated!", type: "success" });
                                            setTimeout(() => window.location.reload(), 1000); 
                                        }
                                    }}
                                    className="bg-gray-900 border border-gray-800 rounded-3xl p-6 shadow-xl"
                                >
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                                        <div className="min-w-0">
                                            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">League Name</label>
                                            <input 
                                                name="leagueName"
                                                defaultValue={league?.name}
                                                className="w-full bg-black border border-gray-700 p-4 rounded-xl text-white font-bold focus:border-pink-500 outline-none transition-all"
                                            />
                                        </div>
                                        
                                        <div className="min-w-0">
                                            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">League Logo</label>
                                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                                                {localLeagueImage ? (
                                                    <div className="w-20 h-20 shrink-0 rounded-xl overflow-hidden border border-gray-700 bg-black">
                                                        <img src={localLeagueImage} alt="League Preview" className="w-full h-full object-cover" />
                                                    </div>
                                                ) : (
                                                    <div className="w-20 h-20 shrink-0 rounded-xl bg-black border border-gray-700 flex items-center justify-center text-[10px] text-gray-600 font-black">
                                                        NO IMG
                                                    </div>
                                                )}
                                                
                                                <div className="w-full sm:flex-1 min-w-0">
                                                    <input 
                                                        type="file" 
                                                        accept="image/*"
                                                        onChange={handleImageUpload}
                                                        ref={fileInputRef}
                                                        className="hidden" 
                                                    />
                                                    <button 
                                                        type="button"
                                                        onClick={() => fileInputRef.current?.click()}
                                                        disabled={uploadingImage}
                                                        className="w-full bg-black border border-gray-700 hover:border-pink-500 p-4 rounded-xl text-[10px] font-black uppercase tracking-widest text-white transition-all disabled:opacity-50 flex justify-center items-center gap-2 truncate"
                                                    >
                                                        {uploadingImage ? (
                                                            <>
                                                                <span className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin shrink-0"></span>
                                                                Uploading...
                                                            </>
                                                        ) : (
                                                            'Upload Custom Logo'
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="flex justify-end pt-4 border-t border-gray-800">
                                        <button 
                                            type="submit" 
                                            disabled={uploadingImage}
                                            className="bg-white text-black font-black uppercase text-xs px-8 py-4 rounded-xl hover:bg-pink-600 hover:text-white transition-all disabled:opacity-50"
                                        >
                                            Save Changes
                                        </button>
                                    </div>
                                </form>
                            </div>

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

                            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                                <div className="p-4 border-b border-gray-800 bg-black/20 flex justify-between items-center">
                                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Member Roster</h3>
                                    <span className="text-[10px] font-bold text-gray-600">{members.length} Users</span>
                                </div>
                                <div className="divide-y divide-gray-800">
                                    {members.map((member) => (
                                        <div key={member.user_id} className="p-4 flex items-center justify-between hover:bg-gray-800/30 transition-colors">
                                            
                                            <div className="flex items-center gap-4">
                                                <Link href={`/u/${encodeURIComponent(member.displayName)}`} className="flex-shrink-0 hover:opacity-80 transition-opacity">
                                                    {member.avatarUrl ? (
                                                        <img src={member.avatarUrl} alt={member.displayName} className="w-10 h-10 rounded-full object-cover border border-gray-700" />
                                                    ) : (
                                                        <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-xs font-black text-gray-400 border border-gray-700">
                                                            {member.displayName ? member.displayName.charAt(0).toUpperCase() : '?'}
                                                        </div>
                                                    )}
                                                </Link>
                                                <div>
                                                    <Link href={`/u/${encodeURIComponent(member.displayName)}`} className="text-sm font-bold text-white hover:text-pink-400 transition-colors">
                                                        {member.displayName}
                                                    </Link>
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

                <div className="hidden lg:block lg:col-span-1 sticky top-24 self-start w-full min-w-0 space-y-6">
                    
                    <div className="bg-gray-950 border border-gray-800 rounded-xl shadow-2xl overflow-hidden transition-all">
                        <button 
                            onClick={() => setIsRosterCollapsed(!isRosterCollapsed)}
                            className="w-full flex items-center justify-between p-6 bg-gray-950 hover:bg-gray-900 transition-colors focus:outline-none border-b border-gray-900"
                        >
                            <div className="flex items-center gap-3 text-left">
                                <img src={hasLockedRoster ? '/lock.png' : '/trophy.png'} alt="Icon" className="w-10 h-10 object-contain drop-shadow-[0_0_10px_rgba(20,184,166,0.5)]" />
                                <div>
                                    <h3 className="text-sm font-black text-white uppercase italic tracking-tighter">
                                        {hasLockedRoster ? 'Locked Roster' : 'Fantasy Roster'}
                                    </h3>
                                    <p className={`text-[10px] font-bold uppercase tracking-widest ${hasLockedRoster ? 'text-teal-400' : 'text-gray-500'}`}>
                                        {hasLockedRoster ? 'Your picks are secured' : 'Select exactly 5 fighters'}
                                    </p>
                                </div>
                            </div>
                            <span className="text-pink-500 font-black text-[10px] uppercase tracking-widest bg-pink-950/30 px-3 py-1 rounded">
                                {isRosterCollapsed ? 'Show ▼' : 'Hide ▲'}
                            </span>
                        </button>
                        
                        {!isRosterCollapsed && (
                            <div className="p-6 bg-gray-950 animate-in fade-in slide-in-from-top-4 duration-300">
                                {renderRosterSlots()}
                            </div>
                        )}
                    </div>

                    <div className="h-[400px] flex flex-col">
                        <div className="flex justify-between items-center mb-4 px-2">
                            <h3 className="text-[10px] font-black text-gray-600 uppercase tracking-[0.2em]">League Chat</h3>
                            <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse"></span>
                        </div>
                        <div className="flex-1 shadow-2xl shadow-black overflow-hidden rounded-xl border border-gray-900 bg-black">
                            <ChatBox league_id={leagueId} />
                        </div>
                    </div>

                </div>

            </div>
        </div>
      </main>

      {!hasLockedRoster && pendingPicks.length > 0 && (
          <div className="lg:hidden fixed bottom-20 left-4 right-4 z-50 animate-in slide-in-from-bottom-10 fade-in duration-300">
            <button 
              onClick={() => setShowMobileSlip(true)}
              className={`w-full text-white p-4 rounded-xl shadow-2xl flex justify-between items-center border active:scale-95 transition-all ${pendingPicks.length === 5 ? 'bg-pink-600 border-pink-400 shadow-[0_0_20px_rgba(236,72,153,0.4)]' : 'bg-gray-900 border-gray-700'}`}
            >
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-lg text-xs font-black ${pendingPicks.length === 5 ? 'bg-black/20 text-white' : 'bg-gray-800 text-pink-500'}`}>
                  {pendingPicks.length} / 5
                </span>
                <span className="text-sm font-black uppercase italic tracking-tighter">Your Roster</span>
              </div>
              <span className="text-xs font-bold uppercase tracking-widest">
                  {pendingPicks.length === 5 ? 'Lock In →' : 'Expand ↑'}
              </span>
            </button>
          </div>
      )}

      {showMobileSlip && !hasLockedRoster && (
          <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm lg:hidden flex items-end">
            <div className="w-full bg-gray-950 rounded-t-3xl border-t border-gray-800 flex flex-col shadow-2xl animate-in slide-in-from-bottom-full duration-300">
               <div className="p-6 border-b border-gray-800 flex justify-between items-center">
                  <div>
                    <h3 className="font-black italic text-xl text-white uppercase tracking-tighter">Fantasy Roster</h3>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Select exactly 5 fighters</p>
                  </div>
                  <button onClick={() => setShowMobileSlip(false)} className="text-gray-500 hover:text-white p-2 text-xs font-bold uppercase tracking-widest">✕ Close</button>
               </div>
               <div className="p-6">
                  {renderRosterSlots()}
               </div>
            </div>
          </div>
      )}

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
                        <img src="/trophy.png" className="w-8 h-8 object-contain brightness-125 drop-shadow-[0_0_10px_rgba(234,179,8,0.4)]" alt="Lead" />
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