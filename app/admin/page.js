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

// ---------------------------------------------------------
// 🎤 THE ADMIN POLL CREATOR COMPONENT
// ---------------------------------------------------------
function AdminPollCreator() {
    const [question, setQuestion] = useState("");
    const [options, setOptions] = useState(["", ""]);
    const [durationHours, setDurationHours] = useState(24);
    const [isPublishing, setIsPublishing] = useState(false);

    const createPoll = async () => {
        const filteredOptions = options.filter(opt => opt.trim() !== "");
        if (!question || filteredOptions.length < 2) return alert("Need a question and at least 2 options.");

        setIsPublishing(true);

        // Calculate the exact expiration time based on selection
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + parseInt(durationHours));

        // 1. Automatically close any currently active polls
        await supabase.from('polls').update({ is_active: false }).eq('is_active', true);

        // 2. Insert the new poll
        const { error } = await supabase.from('polls').insert({
            question,
            options: filteredOptions,
            is_active: true,
            expires_at: expiresAt.toISOString()
        });

        setIsPublishing(false);

        if (!error) {
            alert("🔥 Poll is LIVE on the Dashboard!");
            setQuestion("");
            setOptions(["", ""]);
        } else {
            alert("Error: " + error.message);
        }
    };

    return (
        <div className="bg-black/60 backdrop-blur-xl p-6 md:p-8 rounded-2xl border border-gray-800 shadow-2xl relative overflow-hidden group hover:border-pink-500/30 transition-colors">
            {/* Ambient Component Glow */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-pink-600/5 rounded-full blur-[50px] pointer-events-none group-hover:bg-pink-600/10 transition-colors"></div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4 relative z-10">
                <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full bg-pink-950/50 flex items-center justify-center text-pink-500 font-black border border-pink-900/50 shadow-[0_0_10px_rgba(236,72,153,0.2)]">🎤</span>
                    <h3 className="text-sm font-black text-white uppercase tracking-widest">Live Poll Manager</h3>
                </div>
                
                <select 
                    value={durationHours} 
                    onChange={(e) => setDurationHours(e.target.value)}
                    className="bg-gray-900 text-[10px] font-black tracking-widest uppercase text-pink-500 p-3 rounded-xl border border-gray-800 outline-none cursor-pointer hover:border-pink-500/50 transition-colors"
                >
                    <option value={1}>Ends in 1 Hour</option>
                    <option value={12}>Ends in 12 Hours</option>
                    <option value={24}>Ends in 24 Hours</option>
                    <option value={48}>Ends in 48 Hours</option>
                </select>
            </div>

            <div className="relative z-10">
                <input 
                    className="w-full bg-gray-900 p-4 rounded-xl mb-4 border border-gray-800 text-white font-bold text-sm focus:border-pink-500 outline-none transition-colors"
                    placeholder="Question (e.g. Who wins the main event?)"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                />

                <div className="space-y-3 mb-4">
                    {options.map((opt, i) => (
                        <div key={i} className="flex gap-2">
                            <input 
                                className="w-full bg-black p-3 rounded-lg border border-gray-800 text-white text-xs focus:border-pink-500 outline-none transition-colors"
                                placeholder={`Option ${i+1}`}
                                value={opt}
                                onChange={(e) => {
                                    const newOpts = [...options];
                                    newOpts[i] = e.target.value;
                                    setOptions(newOpts);
                                }}
                            />
                            {options.length > 2 && (
                                <button onClick={() => setOptions(options.filter((_, index) => index !== i))} className="px-4 bg-gray-900 rounded-lg text-gray-500 hover:text-red-500 font-bold border border-gray-800 hover:border-red-900/50 transition-colors">✕</button>
                            )}
                        </div>
                    ))}
                </div>

                <button onClick={() => setOptions([...options, ""])} className="text-gray-500 hover:text-white text-[10px] font-black uppercase tracking-widest transition-colors mb-8 flex items-center gap-2">
                    <span className="w-4 h-4 rounded bg-gray-800 flex items-center justify-center">+</span> Add Option
                </button>

                <button 
                    onClick={createPoll} 
                    disabled={isPublishing}
                    className="w-full bg-pink-600 hover:bg-pink-500 text-white py-4 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all shadow-[0_0_20px_rgba(236,72,153,0.3)] disabled:opacity-50 active:scale-95"
                >
                    {isPublishing ? 'Publishing...' : 'Launch Poll To Dashboard 🚀'}
                </button>
            </div>
        </div>
    );
}

// ---------------------------------------------------------
// 🛡️ THE MAIN ADMIN PAGE
// ---------------------------------------------------------
export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [fights, setFights] = useState([]);
  const [authorized, setAuthorized] = useState(false);
  const [systemStatus, setSystemStatus] = useState('');
  
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

  const fireEngine = async (endpoint, name) => {
      setSystemStatus(`Running ${name}...`);
      try {
          const res = await fetch(endpoint);
          const data = await res.json();
          setSystemStatus(`✅ ${name} Success: ${data.message || 'Done!'}`);
          if (name === 'UFCStats Scraper') fetchFights(); 
      } catch (err) {
          setSystemStatus(`❌ ${name} Failed: ${err.message}`);
      }
      setTimeout(() => setSystemStatus(''), 5000); 
  };

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

    const { error } = await supabase
        .from('fights')
        .update({ winner: winnerName, method: method, round: parseInt(round, 10) })
        .eq('id', fight.id);

    if (error) {
        alert('Error: ' + error.message);
    } else {
        setFights(fights.filter(f => f.id !== fight.id));
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
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

        {/* 🎤 COMMUNITY ENGAGEMENT (NEW POLL SECTION) */}
        <div className="mb-6 flex items-center gap-3">
            <div className="w-2 h-6 bg-pink-600 rounded-full shadow-[0_0_10px_rgba(236,72,153,0.5)]"></div>
            <h2 className="text-sm font-black text-white italic uppercase tracking-widest">Community Engagement</h2>
        </div>
        <div className="mb-12">
            <AdminPollCreator />
        </div>

        {/* 🛠️ MANUAL OVERRIDE SECTION */}
        <div className="mb-6 flex items-center gap-3">
            <div className="w-2 h-6 bg-teal-500 rounded-full shadow-[0_0_10px_rgba(20,184,166,0.5)]"></div>
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
                    <div key={fight.id} className="bg-black/60 backdrop-blur-xl border border-gray-800 p-6 rounded-2xl flex flex-col lg:flex-row items-center justify-between gap-6 shadow-2xl hover:border-teal-500/30 transition-colors">
                        
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
                                    className="flex-1 sm:w-32 bg-gray-900 border border-gray-800 text-gray-300 text-[9px] font-black uppercase tracking-widest p-3 rounded-xl focus:outline-none focus:border-teal-500 cursor-pointer appearance-none text-center"
                                    value={fightDetails[fight.id]?.method || 'DEC'}
                                    onChange={(e) => handleDetailChange(fight.id, 'method', e.target.value)}
                                >
                                    <option value="DEC">DECISION</option>
                                    <option value="KO">KNOCKOUT</option>
                                    <option value="SUB">SUBMISSION</option>
                                    <option value="DQ">DQ</option>
                                </select>

                                <select 
                                    className="w-20 bg-gray-900 border border-gray-800 text-gray-300 text-[9px] font-black uppercase tracking-widest p-3 rounded-xl focus:outline-none focus:border-teal-500 cursor-pointer appearance-none text-center"
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