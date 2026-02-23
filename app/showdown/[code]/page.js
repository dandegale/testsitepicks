'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';

import FightDashboard from '../../components/FightDashboard';
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
  const [fighterStats, setFighterStats] = useState([]); 
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isFocusMode, setIsFocusMode] = useState(false);
  const [pendingPicks, setPendingPicks] = useState([]); 
  const [showMobileLeagues, setShowMobileLeagues] = useState(false); 
  const [showMobileSlip, setShowMobileSlip] = useState(false);
  const [showShowdown, setShowShowdown] = useState(false);
  const [clientLeagues, setClientLeagues] = useState([]);
  
  const [showComparisons, setShowComparisons] = useState(false);
  const [showAllFighters, setShowAllFighters] = useState(false); 
  
  const [creatorName, setCreatorName] = useState('');
  const [opponentName, setOpponentName] = useState('');
  const [currentUsername, setCurrentUsername] = useState('');
  
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
            
            const { data: memberships } = await supabase.from('league_members').select('leagues ( id, name, image_url, invite_code )').eq('user_id', currentUser.email);
            if (memberships) setClientLeagues(memberships.map(m => m.leagues).filter(Boolean));
        }
    } else {
        setCreatorName(currentMatchData.creator_email.split('@')[0]);
        if (currentMatchData.opponent_email) setOpponentName(currentMatchData.opponent_email.split('@')[0]);
        if (currentUser) setCurrentUsername(currentUser.user_metadata?.username || currentUser.email.split('@')[0]);
    }

    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const { data: fightData } = await supabase.from('fights').select('*').gte('start_time', fourteenDaysAgo).order('start_time', { ascending: true });
    const { data: picksData } = await supabase.from('h2h_picks').select('*').eq('match_id', currentMatchData.id);
    const { data: statsData } = await supabase.from('fighter_stats').select('*');

    setFights(fightData || []);
    setH2hPicks(picksData || []);
    setFighterStats(statsData || []);
    
    if (currentUser && picksData?.filter(p => p.user_email === currentUser.email).length >= 5) {
        setShowComparisons(true);
    }

    setLoading(false);
  };

  const myLockedPicks = h2hPicks.filter(p => p.user_email === user?.email);
  const hasLockedRoster = myLockedPicks.length >= 5;

  const handleInteraction = () => setIsFocusMode(true);

  const handlePickSelect = (newPick) => {
    if (hasLockedRoster) {
        alert("Your 5-man roster is already locked in!");
        return;
    }

    const safePick = { ...newPick, username: currentUsername };

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
    if (pendingPicks.length !== 5) return alert("You must fill all 5 roster slots!");
    if (!user) return alert("Log in to lock picks!");
    
    setIsSubmitting(true);
    
    const picksToInsert = pendingPicks.map(p => ({
        match_id: match.id,
        user_email: user.email,
        fight_id: p.fightId,
        selected_fighter: p.fighterName
    }));

    const { error } = await supabase.from('h2h_picks').upsert(picksToInsert, { onConflict: 'match_id, user_email, fight_id' });

    if (error) {
        console.error("Submission Error:", error);
        alert("Failed to lock in picks.");
    } else {
        const { data: updated } = await supabase.from('h2h_picks').select('*').eq('match_id', match.id);
        setH2hPicks(updated);
        setPendingPicks([]);
        setShowMobileSlip(false);
        setIsFocusMode(false);
        setShowComparisons(true); 
    }
    
    setIsSubmitting(false);
  };

  const isFighterMatch = (pickName, statName) => {
      if (!pickName || !statName) return false;
      const cleanName = (str) => str.toLowerCase().replace(/\b(jr\.?|sr\.?|iii|ii)\b/gi, '').trim();
      const getCore = (str) => {
          const parts = cleanName(str).split(' ');
          return parts[parts.length - 1].replace(/[^a-z]/g, '').substring(0, 4);
      };
      return getCore(pickName) === getCore(statName);
  };

  let creatorScore = 0;
  let opponentScore = 0;

  h2hPicks.forEach(pick => {
      const stats = fighterStats.find(s => 
          String(s.fight_id) === String(pick.fight_id) && 
          isFighterMatch(pick.selected_fighter, s.fighter_name)
      );
      
      if (stats) {
          const points = parseFloat(stats.fantasy_points || 0);
          if (pick.user_email === match?.creator_email) creatorScore += points;
          else if (pick.user_email === match?.opponent_email) opponentScore += points;
      }
  });

  const displayCreatorScore = creatorScore.toFixed(1);
  const displayOpponentScore = opponentScore.toFixed(1);

  const { thisWeekendAllFights, upcomingFights, groupedFights } = useMemo(() => {
      if (!fights || fights.length === 0) return { thisWeekendAllFights: [], upcomingFights: [], groupedFights: {} };
      
      const now = new Date().getTime();
      const TWO_DAYS = 2 * 24 * 60 * 60 * 1000;
      let validFights = fights.filter(f => f?.start_time && new Date(f.start_time).getTime() > (now - TWO_DAYS));
      validFights.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
      if (validFights.length === 0) return { thisWeekendAllFights: [], upcomingFights: [], groupedFights: {} };

      const tempGroups = [];
      let currentBucket = [];
      let groupReferenceTime = new Date(validFights[0].start_time).getTime();
      validFights.forEach((fight) => {
          const fightTime = new Date(fight.start_time).getTime();
          if (fightTime - groupReferenceTime < 72 * 60 * 60 * 1000) currentBucket.push(fight);
          else { tempGroups.push(currentBucket); currentBucket = [fight]; groupReferenceTime = fightTime; }
      });
      if (currentBucket.length > 0) tempGroups.push(currentBucket);

      const thisWeekendBucket = tempGroups[0] || [];
      const incompleteFights = thisWeekendBucket.filter(f => !f.winner);

      let finalGroups = {};
      if (thisWeekendBucket.length > 0) {
          const mainEventFight = thisWeekendBucket[thisWeekendBucket.length - 1];
          const dateStr = new Date(mainEventFight.start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' });
          const title = `${mainEventFight.fighter_1_name} vs ${mainEventFight.fighter_2_name} (${dateStr})`;
          if (incompleteFights.length > 0) finalGroups[title] = [...incompleteFights].reverse();
      }

      return { thisWeekendAllFights: thisWeekendBucket, upcomingFights: incompleteFights, groupedFights: finalGroups };
  }, [fights]);

  const isCardComplete = thisWeekendAllFights.length > 0 && thisWeekendAllFights.every(f => f.winner);

  let showdownWinner = null;
  if (isCardComplete) {
      if (creatorScore > opponentScore) showdownWinner = 'creator';
      else if (opponentScore > creatorScore) showdownWinner = 'opponent';
      else showdownWinner = 'tie';
  }

  useEffect(() => {
      const settleMatch = async () => {
          if (isCardComplete && match && match.status !== 'completed') {
              await supabase.from('h2h_matches').update({ status: 'completed' }).eq('id', match.id);
          }
      };
      settleMatch();
  }, [isCardComplete, match]);

  const allCardFightersRanked = useMemo(() => {
      if (!fighterStats || fighterStats.length === 0 || thisWeekendAllFights.length === 0) return [];
      
      const weekendFightIds = thisWeekendAllFights.map(f => String(f.id));
      const filteredStats = fighterStats.filter(s => weekendFightIds.includes(String(s.fight_id)));

      const mappedStats = filteredStats.map(s => {
          const fight = thisWeekendAllFights.find(f => String(f.id) === String(s.fight_id));
          return { ...s, method: fight?.method || '' };
      });

      return mappedStats.sort((a, b) => (b.fantasy_points || 0) - (a.fantasy_points || 0));
  }, [fighterStats, thisWeekendAllFights]);

  const getStatsForPick = (pick) => {
      const stats = fighterStats.find(s => 
          String(s.fight_id) === String(pick.fight_id) && 
          isFighterMatch(pick.selected_fighter, s.fighter_name)
      );
      return stats || { is_winner: null, sig_strikes: 0, takedowns: 0, knockdowns: 0, sub_attempts: 0, control_time_seconds: 0, fantasy_points: 0 };
  };

  const renderTeamBoxScore = (playerName, email, totalScore) => {
      if (!email) return null; 
      
      const teamPicks = h2hPicks.filter(p => p.user_email === email);
      
      if (teamPicks.length === 0) {
          return (
              <div className="bg-gray-950 border border-gray-900 rounded-xl p-6 flex flex-col items-center justify-center text-center h-full min-h-[200px]">
                  <p className="text-gray-600 text-[10px] font-bold uppercase tracking-widest">Waiting for {playerName} to lock picks...</p>
              </div>
          );
      }

      return (
          <div className="bg-black border border-gray-800 rounded-xl overflow-hidden shadow-2xl">
              <div className="bg-gray-900 p-3 border-b border-gray-800 flex justify-between items-center">
                  {/* 🎯 LINK ADDED TO BOX SCORE HEADER */}
                  <span className="text-xs font-black uppercase tracking-widest text-white">
                      <Link href={`/u/${encodeURIComponent(playerName)}`} className="hover:text-pink-400 transition-colors">
                          {playerName}'s Roster
                      </Link>
                  </span>
                  <span className="text-pink-500 font-black text-xs">{totalScore} PTS</span>
              </div>
              <div className="w-full">
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
                              const canSee = isMe || hasLockedRoster || isCardComplete;
                              
                              if (!canSee) {
                                  return (
                                      <tr key={pick.id} className="bg-gray-950/50">
                                          <td className="px-1 py-2 sm:p-2 md:p-3 font-bold text-gray-600 truncate max-w-[60px] sm:max-w-[100px] md:max-w-none">🔒 HIDDEN</td>
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
                              
                              const fightInfo = fights.find(f => String(f.id) === String(pick.fight_id));
                              const winMethod = fightInfo?.method ? `\n(${fightInfo.method})` : '';
                              
                              return (
                                  <tr key={pick.id} className="hover:bg-gray-900/50 transition-colors">
                                      <td className="px-1 py-2 sm:p-2 md:p-3 font-bold text-white truncate max-w-[60px] sm:max-w-[100px] md:max-w-none" title={pick.selected_fighter}>{pick.selected_fighter}</td>
                                      <td className="px-1 py-2 sm:p-2 md:p-3 text-center font-black text-[8px] sm:text-[9px] md:text-[10px] leading-tight">
                                          {stats.is_winner === true ? (
                                              <span className="text-green-500 whitespace-pre-wrap">W{winMethod}</span>
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
                {myLockedPicks.map((pick, index) => (
                    <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-green-950/20 border border-green-500/30">
                        <div>
                            <div className="text-[9px] font-black text-green-500 uppercase tracking-widest mb-0.5">LOCKED SLOT {index + 1}</div>
                            <div className="text-sm font-black text-white uppercase truncate">{pick.selected_fighter}</div>
                        </div>
                        <span className="text-xl">🔒</span>
                    </div>
                ))}
                <div className="pt-4 mt-4 text-center">
                    <p className="text-[10px] font-black uppercase text-green-500 tracking-widest border border-green-500/50 bg-green-950/30 py-2 rounded-lg">Roster Confirmed</p>
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
                    <span className={`text-[10px] font-black uppercase ${pendingPicks.length === 5 ? 'text-green-500' : 'text-pink-500'}`}>{pendingPicks.length} / 5</span>
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

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-pink-500 font-black italic">ENTERING THE OCTAGON...</div>;

  return (
    <div className="flex min-h-screen bg-black text-white overflow-hidden font-sans selection:bg-pink-500 selection:text-white">
      
      <div className={`hidden md:block transition-all duration-500 shrink-0 border-r border-gray-800 relative z-50 ${isFocusMode ? '-ml-20' : 'ml-0'}`}>
        <LeagueRail initialLeagues={clientLeagues} />
      </div>

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
                                <span className="font-bold text-sm text-gray-300 group-hover:text-white truncate">{league.name}</span>
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
                    <button onClick={() => setShowShowdown(true)} className="flex bg-gradient-to-r from-pink-600 to-teal-600 hover:from-pink-500 hover:to-teal-500 border border-gray-700 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-white shadow-[0_0_15px_rgba(219,39,119,0.2)] hover:shadow-[0_0_20px_rgba(20,184,166,0.4)] transition-all items-center gap-2 active:scale-95">
                        <span>⚔️</span>
                        <span className="hidden sm:inline">1v1 Showdown</span>
                        <span className="sm:hidden">1v1</span>
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
                    <div className="hidden md:block"><LogOutButton /></div>
                </div>
            </div>
        </header>

        {isFocusMode && !hasLockedRoster && (
             <button onClick={() => { setIsFocusMode(false); setPendingPicks([]); }} className="fixed top-6 right-6 z-[70] bg-gray-950 text-white px-6 py-3 rounded-full font-bold uppercase text-xs border border-pink-500 shadow-[0_0_20px_rgba(236,72,153,0.3)] hover:bg-pink-600 transition-all hidden md:block">
                ✕ Reset Roster
             </button>
        )}

        <div className={`relative w-full bg-gray-900 overflow-hidden border-b border-gray-800 transition-all duration-700 ${isFocusMode && !hasLockedRoster ? 'h-0 opacity-0 min-h-0 border-transparent' : 'h-[250px] min-h-[250px]'}`}>
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent z-10" />
            
            {isCardComplete && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-pink-600 text-white px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-[0_0_15px_rgba(236,72,153,0.5)]">
                    Showdown Final
                </div>
            )}

            <div className="absolute inset-0 flex flex-col justify-center p-4 md:p-6 z-20">
                <div className="max-w-7xl mx-auto w-full flex flex-row items-center justify-center gap-4 md:gap-16">
                    
                    {/* 🎯 LINK ADDED TO CREATOR BANNER NAME */}
                    <Link href={`/u/${encodeURIComponent(creatorName)}`} className="text-center group flex flex-col items-center w-28 md:w-48 relative hover:opacity-80 transition-opacity">
                      {showdownWinner === 'creator' && <div className="absolute -top-8 text-3xl animate-bounce">👑</div>}
                      <img src="/pink-gloves.png" className={`w-16 md:w-32 transition-transform duration-500 ${showdownWinner === 'creator' ? 'scale-110 drop-shadow-[0_0_40px_rgba(219,39,119,0.8)]' : 'drop-shadow-[0_0_30px_rgba(219,39,119,0.4)] group-hover:drop-shadow-[0_0_40px_rgba(219,39,119,0.6)]'}`} />
                      <p className={`font-black uppercase text-[10px] md:text-xs mt-3 tracking-widest w-full truncate ${showdownWinner === 'creator' ? 'text-white' : 'text-pink-500 group-hover:text-pink-400'}`}>{creatorName}</p>
                    </Link>

                    <div className="flex flex-col items-center shrink-0">
                        <div className="flex items-center gap-2 md:gap-6 text-3xl md:text-5xl font-black italic tracking-tighter mb-1">
                            <span className={showdownWinner === 'creator' ? 'text-white drop-shadow-[0_0_15px_rgba(219,39,119,0.5)]' : 'text-pink-500'}>{displayCreatorScore}</span>
                            <span className="text-gray-700">-</span>
                            <span className={showdownWinner === 'opponent' ? 'text-white drop-shadow-[0_0_15px_rgba(20,184,166,0.5)]' : 'text-teal-400'}>{displayOpponentScore}</span>
                        </div>
                        <div className="text-[10px] font-black text-gray-600 uppercase tracking-widest italic mt-1">Fantasy Points</div>
                    </div>

                    {/* 🎯 LINK ADDED TO OPPONENT BANNER NAME (IF EXISTS) */}
                    {opponentName ? (
                        <Link href={`/u/${encodeURIComponent(opponentName)}`} className="text-center group flex flex-col items-center w-28 md:w-48 relative hover:opacity-80 transition-opacity">
                            {showdownWinner === 'opponent' && <div className="absolute -top-8 text-3xl animate-bounce">👑</div>}
                            <img src="/teal-gloves.png" className={`w-16 md:w-32 transition-transform duration-500 ${showdownWinner === 'opponent' ? 'scale-110 drop-shadow-[0_0_40px_rgba(20,184,166,0.8)]' : 'drop-shadow-[0_0_30px_rgba(20,184,166,0.4)] group-hover:drop-shadow-[0_0_40px_rgba(20,184,166,0.6)]'}`} />
                            <p className={`font-black uppercase text-[10px] md:text-xs mt-3 tracking-widest w-full truncate ${showdownWinner === 'opponent' ? 'text-white' : 'text-teal-400 group-hover:text-teal-300'}`}>{opponentName}</p>
                        </Link>
                    ) : (
                        <div className="text-center group flex flex-col items-center w-28 md:w-48 relative">
                          {showdownWinner === 'opponent' && <div className="absolute -top-8 text-3xl animate-bounce">👑</div>}
                          <img src="/teal-gloves.png" className={`w-16 md:w-32 transition-transform duration-500 ${showdownWinner === 'opponent' ? 'scale-110 drop-shadow-[0_0_40px_rgba(20,184,166,0.8)]' : 'drop-shadow-[0_0_30px_rgba(20,184,166,0.4)]'}`} />
                          <p className={`font-black uppercase text-[10px] md:text-xs mt-3 tracking-widest w-full truncate ${showdownWinner === 'opponent' ? 'text-white' : 'text-teal-400'}`}>WAITING...</p>
                        </div>
                    )}

                </div>
            </div>
        </div>

        <div className="p-4 md:p-10 max-w-7xl mx-auto min-h-screen w-full">
            
            <div className={`transition-all duration-500 origin-top ${isFocusMode && !hasLockedRoster ? 'scale-y-0 h-0 opacity-0 mb-0' : 'scale-y-100 mb-8'}`}>
                {/* 🎯 YOUR MATCHUP BOX SCORE */}
                <div className="bg-gray-950 border border-gray-900 rounded-xl shadow-lg">
                    <button onClick={() => setShowComparisons(!showComparisons)} className="w-full flex items-center justify-between p-4 hover:bg-gray-800 transition-colors focus:outline-none">
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-pink-500 animate-pulse"></span>
                            <h3 className="text-[10px] md:text-xs font-black uppercase tracking-[0.2em] text-gray-400">Live Fantasy Box Score</h3>
                        </div>
                        <span className="text-pink-500 font-black text-[10px] uppercase tracking-widest bg-pink-950/30 px-3 py-1 rounded">{showComparisons ? 'Hide ▲' : 'View ▼'}</span>
                    </button>
                    
                    {showComparisons && (
                        <div className="p-4 border-t border-gray-900 grid grid-cols-1 xl:grid-cols-2 gap-6 max-h-[800px] overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-top-4 duration-300">
                            {renderTeamBoxScore(creatorName, match?.creator_email, displayCreatorScore)}
                            {renderTeamBoxScore(opponentName || 'Opponent', match?.opponent_email, displayOpponentScore)}
                        </div>
                    )}
                </div>

                {/* 🎯 FULL CARD LEADERBOARD BOX */}
                <div className="bg-gray-950 border border-gray-900 rounded-xl shadow-lg mt-6">
                    <button onClick={() => setShowAllFighters(!showAllFighters)} className="w-full flex items-center justify-between p-4 hover:bg-gray-800 transition-colors focus:outline-none">
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse"></span>
                            <h3 className="text-[10px] md:text-xs font-black uppercase tracking-[0.2em] text-gray-400">Full Card Leaderboard (Optimal Lineup)</h3>
                        </div>
                        <span className="text-teal-500 font-black text-[10px] uppercase tracking-widest bg-teal-950/30 px-3 py-1 rounded">{showAllFighters ? 'Hide ▲' : 'View ▼'}</span>
                    </button>
                    
                    {showAllFighters && (
                        <div className="p-4 border-t border-gray-900 max-h-[600px] overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-top-4 duration-300">
                            <div className="bg-black border border-gray-800 rounded-xl overflow-hidden shadow-2xl">
                                <div className="w-full">
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
                                                                <span className="text-green-500 whitespace-pre-wrap">W{winMethod}</span>
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

            <div className="relative flex w-full">
                
                <div className={`transition-all duration-700 ease-in-out w-full lg:w-[66%] ${isFocusMode ? 'lg:mx-auto' : ''}`}>
                    <div className="flex items-center gap-2 mb-6">
                        <span className={`w-2 h-2 rounded-full bg-teal-500 animate-pulse ${isFocusMode && !hasLockedRoster ? 'opacity-0' : ''}`}></span>
                        <h2 className={`text-xl font-black uppercase italic tracking-tighter ${isFocusMode && !hasLockedRoster ? 'text-pink-600' : ''}`}>
                            {hasLockedRoster ? 'Showdown Card' : isFocusMode ? 'Draft Your 5-Man Roster' : (isCardComplete ? 'Completed Fights' : 'Showdown Fights')}
                        </h2>
                    </div>
                    
                    <div className={`transition-all ${isFocusMode && !hasLockedRoster ? '[&_button]:animate-pulse' : ''} ${hasLockedRoster ? 'opacity-80' : ''}`}>
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
                    <div className="sticky top-24 min-w-[320px] bg-gray-950 border border-gray-800 rounded-xl p-6 shadow-2xl">
                        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-900">
                            <span className="text-xl">{hasLockedRoster ? '🔒' : '📋'}</span>
                            <div>
                                <h3 className="text-sm font-black text-white uppercase italic tracking-tighter">
                                    {hasLockedRoster ? 'Locked Roster' : 'Fantasy Roster'}
                                </h3>
                                <p className={`text-[10px] font-bold uppercase tracking-widest ${hasLockedRoster ? 'text-green-500' : 'text-gray-500'}`}>
                                    {hasLockedRoster ? 'Your picks are secured' : 'Select exactly 5 fighters'}
                                </p>
                            </div>
                        </div>
                        {renderRosterSlots()}
                    </div>
                </div>
            </div>
        </div>
      </main>

      {/* MOBILE UI */}
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

      {/* MOBILE UI Modal */}
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

      <ShowdownModal isOpen={showShowdown} onClose={() => setShowShowdown(false)} />
      <MobileNav onToggleLeagues={() => setShowMobileLeagues(true)} />

    </div>
  );
}