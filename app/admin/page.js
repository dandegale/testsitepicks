'use client';

import { createClient } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

// This jumps out of the admin folder, out of the app folder, and into utils
import { awardEventBadges, evaluateUserStreaks } from '../../utils/badgeEngine';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Authorized Admins
const ADMIN_EMAILS = ['dandegale2004@gmail.com'];

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [fights, setFights] = useState([]);
  const [authorized, setAuthorized] = useState(false);
  
  // Track Method & Round selections for each fight
  const [fightDetails, setFightDetails] = useState({});
  const router = useRouter();

  useEffect(() => {
    checkUser();
    fetchFights();
  }, []);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    // Security Check: Kick out anyone who isn't you
    if (!user || !ADMIN_EMAILS.includes(user.email)) {
        router.push('/'); 
    } else {
        setAuthorized(true);
    }
  };

  const fetchFights = async () => {
    // Fetch active fights (where winner is still null)
    const { data } = await supabase
        .from('fights')
        .select('*')
        .is('winner', null)
        .order('start_time', { ascending: true });
    
    setFights(data || []);
    setLoading(false);
  };

  const handleDetailChange = (fightId, field, value) => {
    setFightDetails(prev => ({
        ...prev,
        [fightId]: {
            ...prev[fightId] || { method: 'DEC', round: '3' }, // Defaults
            [field]: value
        }
    }));
  };

  const setWinner = async (fight, winnerName) => {
    const details = fightDetails[fight.id] || { method: 'DEC', round: '3' };
    const { method, round } = details;

    if (!confirm(`Declare ${winnerName} as the winner by ${method} in Round ${round}?`)) return;

    // 1. Update the fight in the database
    const { error } = await supabase
        .from('fights')
        .update({ winner: winnerName, method: method, round: round })
        .eq('id', fight.id);

    if (error) {
        alert('Error: ' + error.message);
    } else {
        // Optimistic update: Remove from list instantly
        setFights(fights.filter(f => f.id !== fight.id));

        // 2. 🎯 RUN THE BADGE ENGINES
        console.log("Firing Badge Engines...");
        
        // A. Run Event-Specific Badges (BMF, Flashbang, etc.)
        await awardEventBadges(fight.event_id);

        // B. Run Career Streak Badges (On Fire, Chalk Eater, etc.)
        // We only need to check streaks for people who actually picked this fight
        const { data: recentPicks } = await supabase
            .from('picks')
            .select('user_id')
            .eq('fight_id', fight.id);
            
        if (recentPicks) {
            // Get unique list of emails to avoid running the engine 5 times for the same guy
            const uniqueUsers = [...new Set(recentPicks.map(p => p.user_id))];
            
            for (const email of uniqueUsers) {
                await evaluateUserStreaks(email);
            }
        }
        
        console.log("Engines complete! Badges awarded.");
    }
  };

  if (!authorized) return null;

  return (
    <div className="min-h-screen bg-black text-white p-6 md:p-12 selection:bg-pink-600 selection:text-white font-sans">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-black italic uppercase text-pink-600 tracking-tighter">
                Admin Console
            </h1>
            <button 
                onClick={() => router.push('/')}
                className="text-xs font-black text-gray-500 hover:text-white uppercase tracking-widest transition-colors"
            >
                ← Back to App
            </button>
        </div>

        {loading ? (
            <div className="text-pink-600 animate-pulse font-black italic uppercase tracking-widest text-sm flex items-center gap-3">
                <span className="w-4 h-4 border-2 border-pink-600 border-t-transparent rounded-full animate-spin"></span>
                Loading Active Fights...
            </div>
        ) : (
            <div className="space-y-4">
                {fights.length === 0 && (
                    <div className="p-12 border border-gray-800 border-dashed rounded-xl bg-gray-950/50 text-center text-gray-500 shadow-xl">
                        <span className="block text-3xl mb-3">✅</span>
                        <span className="text-xs font-bold uppercase tracking-widest text-gray-400">All Clear. No active fights pending results.</span>
                    </div>
                )}

                {fights.map((fight) => (
                    <div key={fight.id} className="bg-gray-950/80 backdrop-blur-md border border-gray-800 p-6 rounded-xl flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl shadow-black/50 hover:border-gray-700 transition-colors">
                        
                        {/* Fight Info */}
                        <div className="flex-1 text-center md:text-left">
                            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1.5 flex items-center justify-center md:justify-start gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-pink-600 animate-pulse"></span>
                                {new Date(fight.start_time).toLocaleTimeString([], { hour: '2-digit', minute:'2-digit' })}
                            </div>
                            <h3 className="text-xl md:text-2xl font-black text-white italic uppercase tracking-tighter">
                                {fight.fighter_1_name} <span className="text-gray-600 not-italic text-sm mx-2 font-bold tracking-normal">vs</span> {fight.fighter_2_name}
                            </h3>
                        </div>

                        {/* Grading Controls */}
                        <div className="flex flex-col gap-3 w-full md:w-auto">
                            
                            {/* Method & Round Selectors */}
                            <div className="flex gap-2">
                                <select 
                                    className="flex-1 bg-black border border-gray-800 text-gray-300 text-[10px] font-black uppercase tracking-widest p-2 rounded focus:outline-none focus:border-pink-600 cursor-pointer"
                                    value={fightDetails[fight.id]?.method || 'DEC'}
                                    onChange={(e) => handleDetailChange(fight.id, 'method', e.target.value)}
                                >
                                    <option value="DEC">Decision (DEC)</option>
                                    <option value="KO">Knockout (KO/TKO)</option>
                                    <option value="SUB">Submission (SUB)</option>
                                </select>

                                <select 
                                    className="w-24 bg-black border border-gray-800 text-gray-300 text-[10px] font-black uppercase tracking-widest p-2 rounded focus:outline-none focus:border-pink-600 cursor-pointer text-center"
                                    value={fightDetails[fight.id]?.round || '3'}
                                    onChange={(e) => handleDetailChange(fight.id, 'round', e.target.value)}
                                >
                                    <option value="1">Rd 1</option>
                                    <option value="2">Rd 2</option>
                                    <option value="3">Rd 3</option>
                                    <option value="4">Rd 4</option>
                                    <option value="5">Rd 5</option>
                                </select>
                            </div>

                            {/* Winner Buttons */}
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setWinner(fight, fight.fighter_1_name)}
                                    className="flex-1 px-4 py-3 bg-gray-900 hover:bg-green-600/20 border border-gray-800 hover:border-green-500 text-gray-300 hover:text-green-400 text-[10px] font-black uppercase tracking-widest rounded transition-all active:scale-95"
                                >
                                    {fight.fighter_1_name}
                                </button>
                                
                                <button
                                    onClick={() => setWinner(fight, fight.fighter_2_name)}
                                    className="flex-1 px-4 py-3 bg-gray-900 hover:bg-green-600/20 border border-gray-800 hover:border-green-500 text-gray-300 hover:text-green-400 text-[10px] font-black uppercase tracking-widest rounded transition-all active:scale-95"
                                >
                                    {fight.fighter_2_name}
                                </button>
                            </div>
                        </div>

                    </div>
                ))}
            </div>
        )}
      </div>
    </div>
  );
}