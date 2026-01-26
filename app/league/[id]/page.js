'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import LeagueRail from '../../components/LeagueRail';
import FightDashboard from '../../components/FightDashboard';
import ChatBox from '../../components/ChatBox'; 

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function LeaguePage() {
  const params = useParams();
  const id = params?.id; 

  const [league, setLeague] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [fights, setFights] = useState([]);
  const [groupedFights, setGroupedFights] = useState({});
  const [leaguePicks, setLeaguePicks] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]); 
  const [loading, setLoading] = useState(true);

  // --- DRAWER STATE ---
  // Controls the Chat Drawer for BOTH Mobile and Desktop
  const [isChatOpen, setIsChatOpen] = useState(false);

  useEffect(() => {
    if (id) fetchLeagueData();
  }, [id]);

  const fetchLeagueData = async () => {
    setLoading(true);
    
    const { data: { user } } = await supabase.auth.getUser();

    const { data: leagueData, error } = await supabase
        .from('leagues')
        .select('*')
        .eq('id', id)
        .single();
    
    if (error || !leagueData) { 
        setLoading(false); 
        return; 
    }
    setLeague(leagueData);

    if (user && leagueData.created_by === user.id) {
        setIsAdmin(true);
    }

    const { data: fightData } = await supabase
        .from('fights')
        .select('*')
        .order('start_time', { ascending: true });
    
    setFights(fightData || []);
    setGroupedFights(groupFightsSmartly(fightData || []));

    const { data: picks } = await supabase
        .from('picks')
        .select('*')
        .eq('league_id', id);
    
    setLeaguePicks(picks || []);

    calculateLeaderboard(picks || [], fightData || []);
    setLoading(false);
  };

  const calculateLeaderboard = (picks, fights) => {
    const userStats = {};
    picks.forEach(pick => {
        const fight = fights.find(f => f.id == pick.fight_id);
        const displayName = pick.username || pick.user_id.split('@')[0]; 
        
        if (!userStats[displayName]) {
            userStats[displayName] = { name: displayName, wins: 0, losses: 0, profit: 0 };
        }

        if (fight && fight.winner) {
            if (fight.winner === pick.selected_fighter) {
                userStats[displayName].wins++;
                const odds = pick.odds_at_pick;
                const gain = odds > 0 ? (odds / 10) : (100 / Math.abs(odds)) * 10;
                userStats[displayName].profit += gain;
            } else {
                userStats[displayName].losses++;
                userStats[displayName].profit -= 10; 
            }
        }
    });
    const sorted = Object.values(userStats).sort((a, b) => b.profit - a.profit);
    setLeaderboard(sorted);
  };

  const groupFightsSmartly = (fights) => {
    if (!fights) return {};
    const groups = {};
    let currentGroupKey = null, groupReferenceTime = null;
    fights.forEach((fight) => {
      const fightTime = new Date(fight.start_time);
      const dateStr = fightTime.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
      let addToCurrent = groupReferenceTime && (fightTime - groupReferenceTime) / (1000 * 60 * 60) < 48;
      if (addToCurrent && currentGroupKey) { groups[currentGroupKey].push(fight); } 
      else {
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

  if (loading) return <div className="min-h-screen bg-black text-teal-500 p-10 font-black uppercase italic animate-pulse">Entering League...</div>;
  if (!league) return <div className="min-h-screen bg-black text-white p-10">League not found.</div>;

  return (
    <div className="flex h-screen bg-black text-white overflow-hidden flex-col md:flex-row">
      
      {/* 1. LEFT RAIL (Always Visible on Desktop) */}
      <div className="hidden md:block">
        <LeagueRail />
      </div>

      {/* 2. MAIN CONTENT AREA (Takes Full Width) */}
      <div className="flex flex-1 overflow-hidden relative flex-col">
        
        {/* CENTER COLUMN: Picks & Standings */}
        <main className="flex-1 h-full overflow-y-auto p-4 md:p-8 scrollbar-hide w-full">
            
            {/* HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-gray-800 pb-6 gap-4">
                <div>
                    <h1 className="text-3xl md:text-4xl font-black text-white uppercase italic tracking-tighter">{league.name}</h1>
                    <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mt-1 flex items-center gap-2">
                        Invite Code: 
                        <span onClick={() => navigator.clipboard.writeText(league.invite_code)} className="text-teal-400 font-mono select-all cursor-pointer hover:bg-teal-900/30 px-1 rounded transition-colors" title="Click to Copy">
                            {league.invite_code}
                        </span>
                        
                        {isAdmin && (
                            <Link 
                                href={`/league/${id}/admin`}
                                className="ml-4 px-3 py-1 bg-pink-600 text-white text-[10px] font-black uppercase rounded hover:bg-pink-500 shadow-lg shadow-pink-900/20 transition-all flex items-center gap-1"
                            >
                                ⚙ Admin
                            </Link>
                        )}
                    </p>
                </div>
                
                <div className="flex items-center gap-3">
                    {/* --- TOGGLE CHAT BUTTON --- */}
                    <button 
                        onClick={() => setIsChatOpen(true)}
                        className="bg-teal-600/10 text-teal-400 border border-teal-600/50 px-4 py-2 rounded font-black uppercase text-xs hover:bg-teal-600 hover:text-black transition-all flex items-center gap-2"
                    >
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                        💬 Open Chat
                    </button>

                    <Link href="/" className="bg-gray-900 text-gray-500 px-4 py-2 rounded font-bold uppercase text-xs hover:text-white transition-colors">
                        ← Exit
                    </Link>
                </div>
            </div>

            {/* STANDINGS */}
            {leaderboard.length > 0 ? (
                <div className="max-w-4xl mx-auto mb-12">
                    <h2 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4">Official Standings</h2>
                    <div className="bg-gray-950 border border-gray-900 rounded-xl overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-black text-gray-500 text-[10px] uppercase font-black tracking-wider">
                                <tr><th className="p-4">Rank</th><th className="p-4">Player</th><th className="p-4">Record</th><th className="p-4 text-right">Profit</th></tr>
                            </thead>
                            <tbody className="divide-y divide-gray-900">
                                {leaderboard.map((row, i) => (
                                    <tr key={row.name} className="hover:bg-gray-900/50 transition-colors">
                                        <td className="p-4 text-gray-700 italic font-black">#{i + 1}</td>
                                        <td className="p-4 font-bold text-teal-400">{row.name}</td>
                                        <td className="p-4 text-gray-400 text-sm font-mono">{row.wins}W - {row.losses}L</td>
                                        <td className={`p-4 text-right font-black font-mono ${row.profit >= 0 ? 'text-green-500' : 'text-pink-600'}`}>{row.profit >= 0 ? '+' : ''}{row.profit.toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="max-w-4xl mx-auto mb-12 p-6 bg-gray-950 border border-dashed border-gray-800 rounded-xl text-center text-gray-600 text-xs font-bold uppercase">No scores yet. Wait for the first fight to end!</div>
            )}

            {/* PICKS DASHBOARD */}
            <div className="max-w-4xl mx-auto mb-20">
                <FightDashboard fights={fights} groupedFights={groupedFights} initialPicks={leaguePicks} league_id={id} />
            </div>
        </main>

        {/* --- UNIVERSAL CHAT DRAWER --- */}
        {/* - Fixed position on ALL screens
            - Slides in from the right
            - Has a backdrop on mobile/desktop to focus attention (optional, I removed backdrop for desktop so you can see picks, but kept it covering the interaction area)
        */}
        <aside 
            className={`
                fixed inset-y-0 right-0 z-[100]
                w-full md:w-[400px] 
                bg-black border-l border-gray-800 shadow-2xl shadow-black
                transition-transform duration-300 ease-in-out
                flex flex-col
                ${isChatOpen ? 'translate-x-0' : 'translate-x-full'}
            `}
        >
            <div className="p-6 h-full flex flex-col relative">
                
                {/* Close Button */}
                <div className="flex justify-between items-center mb-6 border-b border-gray-800 pb-4">
                     <div>
                        <h2 className="text-2xl font-black text-teal-400 uppercase italic tracking-tighter">League Chat</h2>
                        <p className="text-gray-500 text-xs">Trash talk is encouraged.</p>
                     </div>
                     <button 
                        onClick={() => setIsChatOpen(false)} 
                        className="w-8 h-8 flex items-center justify-center bg-gray-900 text-white rounded-full hover:bg-gray-800 transition-colors"
                     >
                        ✕
                     </button>
                </div>

                {/* Chat Component */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    <ChatBox league_id={id} isAdmin={isAdmin} />
                </div>
            </div>
        </aside>

        {/* BACKDROP (Optional: Click outside to close) */}
        {isChatOpen && (
            <div 
                className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm"
                onClick={() => setIsChatOpen(false)}
            />
        )}

      </div>
    </div>
  );
}