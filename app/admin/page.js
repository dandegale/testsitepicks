'use client';

import { createClient } from '@supabase/supabase-js';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function AdminPage() {
  const [fights, setFights] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // --- THE SELECTION TOOL STATE ---
  const [weekLabel, setWeekLabel] = useState('UFC 312');
  const [eventType, setEventType] = useState('main_card'); // 'main_card' vs 'full_card'
  const [currentLeagueStatus, setCurrentLeagueStatus] = useState(null);
  
  const router = useRouter();

  useEffect(() => {
    checkAdminAndFetch();
    fetchCurrentLeagueStatus();
  }, []);

  const checkAdminAndFetch = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const ADMIN_EMAIL = 'dandegale2004@gmail.com'; 

    if (!user || user.email !== ADMIN_EMAIL) { 
      alert(`Access Denied! Logged in as: ${user ? user.email : 'Nobody'}`);
      router.push('/');
      return;
    }

    const { data } = await supabase
      .from('fights')
      .select('*')
      .order('start_time', { ascending: true });
      
    setFights(data || []);
    setLoading(false);
  };

  const fetchCurrentLeagueStatus = async () => {
    const { data } = await supabase
      .from('league_events')
      .select('*')
      .eq('league_id', 'default_league')
      .maybeSingle();
    
    if (data) {
      setCurrentLeagueStatus(data);
      setWeekLabel(data.week_label);
      setEventType(data.event_type);
    }
  };

  const saveLeagueSettings = async () => {
    const { error } = await supabase
      .from('league_events')
      .upsert({
        league_id: 'default_league',
        week_label: weekLabel,
        event_type: eventType,
        is_active: true
      }, { onConflict: 'league_id' });

    if (error) {
      alert('Database Error: ' + error.message);
    } else {
      alert(`SUCCESS: League is now set to ${eventType === 'main_card' ? 'Last 5 Fights' : 'Full Card'}`);
      fetchCurrentLeagueStatus();
    }
  };

  const markWinner = async (fightId, winnerName) => {
    if (!confirm(`Declare ${winnerName} the winner?`)) return;
    const { error } = await supabase.from('fights').update({ winner: winnerName }).eq('id', fightId);
    if (error) alert('Error updating winner');
    else setFights(fights.map(f => f.id === fightId ? { ...f, winner: winnerName } : f));
  };

  if (loading) return <div className="p-10 text-white font-mono uppercase animate-pulse">Initializing Commissioner Tools...</div>;

  return (
    <main className="min-h-screen bg-black text-white p-6 md:p-12 font-sans">
      
      {/* 1. HEADER */}
      <div className="mb-12 border-b border-gray-800 pb-8">
        <h1 className="text-4xl font-black text-pink-600 uppercase italic tracking-tighter">Commissioner Dashboard</h1>
        <p className="text-gray-500 text-[10px] uppercase tracking-[0.3em] font-bold mt-2">UNF League Control Center</p>
      </div>

      {/* 2. THE SELECTION TOOL: SELECT CARD TYPE */}
      <section className="max-w-4xl mx-auto mb-16 bg-gray-900/50 border-2 border-pink-600/30 p-8 rounded-3xl shadow-[0_0_50px_rgba(219,39,119,0.1)]">
        <div className="flex items-center gap-3 mb-8">
          <div className="bg-pink-600 p-2 rounded-lg">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h2 className="text-xl font-black uppercase tracking-tight">Step 1: Select Card Type</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Card Meta */}
          <div className="space-y-4">
            <label className="text-[10px] uppercase font-black text-gray-500 tracking-widest">Week/Event Label</label>
            <input 
              value={weekLabel} 
              onChange={(e) => setWeekLabel(e.target.value)}
              className="w-full bg-black border border-gray-700 p-4 rounded-xl font-bold text-white focus:border-pink-500 outline-none transition-all"
              placeholder="e.g. UFC 312"
            />
          </div>

          {/* Type Selection */}
          <div className="space-y-4">
            <label className="text-[10px] uppercase font-black text-gray-500 tracking-widest">Select Card Scope</label>
            <div className="flex gap-2 p-1 bg-black border border-gray-800 rounded-xl">
              <button 
                onClick={() => setEventType('main_card')}
                className={`flex-1 py-3 rounded-lg font-black text-[10px] uppercase transition-all ${eventType === 'main_card' ? 'bg-pink-600 text-white' : 'text-gray-500 hover:text-white'}`}
              >
                Main Card (Final 5)
              </button>
              <button 
                onClick={() => setEventType('full_card')}
                className={`flex-1 py-3 rounded-lg font-black text-[10px] uppercase transition-all ${eventType === 'full_card' ? 'bg-pink-600 text-white' : 'text-gray-500 hover:text-white'}`}
              >
                Full Card
              </button>
            </div>
          </div>
        </div>

        <button 
          onClick={saveLeagueSettings}
          className="mt-8 w-full bg-white text-black py-5 rounded-2xl font-black uppercase italic tracking-tighter hover:bg-pink-600 hover:text-white transition-all transform active:scale-95 shadow-xl"
        >
          {currentLeagueStatus ? 'Update Existing League Selection' : 'Confirm & Publish Selection'}
        </button>

        {currentLeagueStatus && (
          <div className="mt-6 pt-6 border-t border-gray-800 flex justify-between items-center text-[10px] font-bold text-gray-500 uppercase tracking-widest">
            <span>Current Live Scope:</span>
            <span className="text-pink-500">{currentLeagueStatus.week_label} — {currentLeagueStatus.event_type === 'main_card' ? 'Final 5 Fights' : 'Entire Card'}</span>
          </div>
        )}
      </section>

      {/* 3. WINNER MANAGEMENT */}
      <div className="max-w-4xl mx-auto">
        <h2 className="text-xl font-black uppercase tracking-tight text-gray-500 mb-8 flex items-center gap-4">
          Step 2: Declare Winners
          <div className="h-px flex-1 bg-gray-900"></div>
        </h2>
        
        <div className="space-y-4">
          {fights.map((fight) => (
            <div key={fight.id} className="bg-gray-950 border border-gray-900 p-4 flex justify-between items-center rounded-2xl hover:border-gray-700 transition-all">
              <button 
                onClick={() => markWinner(fight.id, fight.fighter_1_name)} 
                className={`p-4 rounded-xl border w-[42%] font-black transition-all ${fight.winner === fight.fighter_1_name ? 'bg-green-600 border-green-400 text-white' : 'bg-black border-gray-800 text-gray-500 hover:border-pink-500'}`}
              >
                {fight.fighter_1_name}
              </button>
              <span className="text-gray-800 font-black italic">VS</span>
              <button 
                onClick={() => markWinner(fight.id, fight.fighter_2_name)} 
                className={`p-4 rounded-xl border w-[42%] font-black transition-all ${fight.winner === fight.fighter_2_name ? 'bg-green-600 border-green-400 text-white' : 'bg-black border-gray-800 text-gray-500 hover:border-pink-500'}`}
              >
                {fight.fighter_2_name}
              </button>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}