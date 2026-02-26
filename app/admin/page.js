'use client';

import { createClient } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

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
  const [systemStatus, setSystemStatus] = useState('');
  
  // Track Method & Round selections for each fight
  const [fightDetails, setFightDetails] = useState({});
  const router = useRouter();

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user || !ADMIN_EMAILS.includes(user.email)) {
        router.push('/'); 
    } else {
        setAuthorized(true);
        fetchFights();
    }
  };

  const fetchFights = async () => {
    const { data } = await supabase
        .from('fights')
        .select('*')
        .is('winner', null)
        .order('start_time', { ascending: true });
    
    setFights(data || []);
    setLoading(false);
  };

  // ---------------------------------------------------------
  // 🚀 MACRO CONTROL ENGINES
  // ---------------------------------------------------------
  
  const fireEngine = async (endpoint, name) => {
      setSystemStatus(`Running ${name}...`);
      try {
          // Pings your secure backend API routes!
          const res = await fetch(endpoint);
          const data = await res.json();
          setSystemStatus(`✅ ${name} Success: ${data.message || 'Done!'}`);
          if (name === 'UFCStats Scraper') fetchFights(); // Refresh the manual list
      } catch (err) {
          setSystemStatus(`❌ ${name} Failed: ${err.message}`);
      }
      setTimeout(() => setSystemStatus(''), 5000); // Clear message after 5s
  };

  // ---------------------------------------------------------
  // 🛠️ MANUAL OVERRIDE CONTROLS
  // ---------------------------------------------------------

  const handleDetailChange = (fightId, field, value) => {
    setFightDetails(prev => ({
        ...prev,
        [fightId]: {
            ...prev[fightId] || { method: 'DEC', round: '3' }, 
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
        .update({ winner: winnerName, method: method, round: parseInt(round, 10) })
        .eq('id', fight.id);

    if (error) {
        alert('Error: ' + error.message);
    } else {
        // Optimistic update
        setFights(fights.filter(f => f.id !== fight.id));

        // 2. Safely trigger the Badge Engine API route
        setSystemStatus(`Graded ${winnerName}. Triggering Badge Engine...`);
        await fireEngine('/api/engine/badges', 'Badge & Streak Engine');
    }
  };

  if (!authorized) return null;

  return (
    <div className="min-h-screen bg-[#050505] text-white p-6 md:p-12 selection:bg-teal-500 selection:text-white font-sans relative overflow-hidden">
      
      {/* Ambient Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-pink-600/10 rounded-full blur-[150px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-teal-600/10 rounded-full blur-[150px] pointer-events-none"></div>

      <div className="max-w-5xl mx-auto relative z-10">
        
        {/* HEADER */}
        <div className="flex items-center justify-between mb-12">
            <div>
                <h1 className="text-3xl md:text-4xl font-black italic uppercase text-white tracking-tighter drop-shadow-lg">
                    Admin <span className="text-teal-500">Console</span>
                </h1>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mt-1">God Mode Activated.</p>
            </div>
            <button onClick={() => router.push('/')} className="px-4 py-2 rounded-full bg-gray-900 border border-gray-800 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-white hover:border-teal-500/50 transition-colors">
                Exit
            </button>
        </div>

        {/* 🚀 MACRO CONTROLS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
            
            <button onClick={() => fireEngine('/api/sync-odds', 'Odds API Sync')} className="group p-6 bg-black/40 backdrop-blur-md border border-gray-800 hover:border-pink-500/50 rounded-2xl flex flex-col items-center justify-center text-center transition-all duration-300 hover:-translate-y-1 shadow-xl">
                <span className="text-3xl mb-3 drop-shadow-[0_0_15px_rgba(219,39,119,0.5)] group-hover:scale-110 transition-transform">📡</span>
                <h3 className="text-[11px] font-black text-white uppercase tracking-widest mb-1">Sync Odds</h3>
                <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Fetch new fights & lines</p>
            </button>

            <button onClick={() => fireEngine('/api/scrape', 'UFCStats Scraper')} className="group p-6 bg-black/40 backdrop-blur-md border border-gray-800 hover:border-teal-500/50 rounded-2xl flex flex-col items-center justify-center text-center transition-all duration-300 hover:-translate-y-1 shadow-xl">
                <span className="text-3xl mb-3 drop-shadow-[0_0_15px_rgba(20,184,166,0.5)] group-hover:scale-110 transition-transform">🥊</span>
                <h3 className="text-[11px] font-black text-white uppercase tracking-widest mb-1">Run Scraper</h3>
                <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Grade winners & stats</p>
            </button>

            <button onClick={() => fireEngine('/api/engine/badges', 'Badge & Streak Engine')} className="group p-6 bg-black/40 backdrop-blur-md border border-gray-800 hover:border-yellow-500/50 rounded-2xl flex flex-col items-center justify-center text-center transition-all duration-300 hover:-translate-y-1 shadow-xl">
                <span className="text-3xl mb-3 drop-shadow-[0_0_15px_rgba(234,179,8,0.5)] group-hover:scale-110 transition-transform">🏆</span>
                <h3 className="text-[11px] font-black text-white uppercase tracking-widest mb-1">Badge Engine</h3>
                <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Calculate trophies & streaks</p>
            </button>

        </div>

        {/* SYSTEM STATUS BAR */}
        <div className={`mb-12 p-4 rounded-xl border transition-all duration-300 flex items-center justify-center text-[10px] font-black uppercase tracking-widest ${systemStatus ? 'bg-teal-950/30 border-teal-500/50 text-teal-400 opacity-100' : 'bg-transparent border-transparent text-transparent opacity-0 pointer-events-none'}`}>
            {systemStatus || 'Idle'}
        </div>

        {/* 🛠️ MANUAL OVERRIDE SECTION */}
        <div className="mb-6 flex items-center gap-3">
            <div className="w-2 h-6 bg-pink-600 rounded-full"></div>
            <h2 className="text-sm font-black text-white italic uppercase tracking-widest">Manual Override</h2>
        </div>

        {loading ? (
            <div className="text-teal-500 animate-pulse font-black italic uppercase tracking-widest text-sm flex items-center justify-center py-12 gap-3">
                <span className="w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full animate-spin"></span>
                Loading Active Fights...
            </div>
        ) : (
            <div className="space-y-4">
                {fights.length === 0 && (
                    <div className="py-16 border border-gray-800 border-dashed rounded-2xl bg-black/40 backdrop-blur-md text-center text-gray-500 shadow-xl">
                        <span className="block text-3xl mb-3 opacity-50">✅</span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">All Clear. No ungraded fights pending.</span>
                    </div>
                )}

                {fights.map((fight) => (
                    <div key={fight.id} className="bg-black/60 backdrop-blur-xl border border-gray-800 p-6 rounded-2xl flex flex-col lg:flex-row items-center justify-between gap-6 shadow-2xl hover:border-pink-500/30 transition-colors">
                        
                        {/* Fight Info */}
                        <div className="flex-1 text-center lg:text-left">
                            <div className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mb-1 flex items-center justify-center lg:justify-start gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse"></span>
                                {new Date(fight.start_time).toLocaleDateString()}
                            </div>
                            <h3 className="text-xl md:text-2xl font-black text-white italic uppercase tracking-tighter">
                                {fight.fighter_1_name} <span className="text-gray-600 not-italic text-sm mx-2 font-bold tracking-normal">vs</span> {fight.fighter_2_name}
                            </h3>
                        </div>

                        {/* Grading Controls */}
                        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                            
                            {/* Method & Round Selectors */}
                            <div className="flex gap-2 w-full sm:w-auto">
                                <select 
                                    className="flex-1 sm:w-32 bg-gray-900 border border-gray-800 text-gray-300 text-[9px] font-black uppercase tracking-widest p-3 rounded-xl focus:outline-none focus:border-pink-600 cursor-pointer appearance-none text-center"
                                    value={fightDetails[fight.id]?.method || 'DEC'}
                                    onChange={(e) => handleDetailChange(fight.id, 'method', e.target.value)}
                                >
                                    <option value="DEC">DECISION</option>
                                    <option value="KO">KNOCKOUT</option>
                                    <option value="SUB">SUBMISSION</option>
                                    <option value="DQ">DQ</option>
                                </select>

                                <select 
                                    className="w-20 bg-gray-900 border border-gray-800 text-gray-300 text-[9px] font-black uppercase tracking-widest p-3 rounded-xl focus:outline-none focus:border-pink-600 cursor-pointer appearance-none text-center"
                                    value={fightDetails[fight.id]?.round || '3'}
                                    onChange={(e) => handleDetailChange(fight.id, 'round', e.target.value)}
                                >
                                    <option value="1">R1</option>
                                    <option value="2">R2</option>
                                    <option value="3">R3</option>
                                    <option value="4">R4</option>
                                    <option value="5">R5</option>
                                </select>
                            </div>

                            {/* Winner Buttons */}
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                                <button
                                    onClick={() => setWinner(fight, fight.fighter_1_name)}
                                    className="flex-1 sm:w-auto px-4 py-3 bg-teal-950/20 hover:bg-teal-600/20 border border-teal-900/50 hover:border-teal-500 text-teal-600 hover:text-teal-400 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all active:scale-95 shadow-[0_0_15px_rgba(20,184,166,0.1)]"
                                >
                                    {fight.fighter_1_name}
                                </button>
                                
                                <button
                                    onClick={() => setWinner(fight, fight.fighter_2_name)}
                                    className="flex-1 sm:w-auto px-4 py-3 bg-teal-950/20 hover:bg-teal-600/20 border border-teal-900/50 hover:border-teal-500 text-teal-600 hover:text-teal-400 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all active:scale-95 shadow-[0_0_15px_rgba(20,184,166,0.1)]"
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