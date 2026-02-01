'use client';

import { createClient } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// ✅ UPDATED: Your email is now the only authorized admin
const ADMIN_EMAILS = ['dandegale2004@gmail.com'];

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [fights, setFights] = useState([]);
  const [authorized, setAuthorized] = useState(false);
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

  const setWinner = async (fightId, winnerName) => {
    if (!confirm(`Declare ${winnerName} as the winner?`)) return;

    const { error } = await supabase
        .from('fights')
        .update({ winner: winnerName })
        .eq('id', fightId);

    if (error) {
        alert('Error: ' + error.message);
    } else {
        // Optimistic update: Remove from list instantly
        setFights(fights.filter(f => f.id !== fightId));
    }
  };

  if (!authorized) return null;

  return (
    <div className="min-h-screen bg-black text-white p-6 md:p-12">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-black italic uppercase text-pink-600">
                Admin Console
            </h1>
            <button 
                onClick={() => router.push('/')}
                className="text-xs font-bold text-gray-500 hover:text-white uppercase"
            >
                ← Back to App
            </button>
        </div>

        {loading ? (
            <div className="text-gray-500 animate-pulse font-mono text-xs">Loading active fights...</div>
        ) : (
            <div className="space-y-4">
                {fights.length === 0 && (
                    <div className="p-8 border border-gray-800 rounded-xl bg-gray-900/50 text-center text-gray-500">
                        <span className="block text-xl mb-2">✅ All Clear</span>
                        <span className="text-xs uppercase tracking-widest">No active fights pending results.</span>
                    </div>
                )}

                {fights.map((fight) => (
                    <div key={fight.id} className="bg-gray-900 border border-gray-800 p-6 rounded-xl flex flex-col md:flex-row items-center justify-between gap-6 shadow-lg">
                        
                        {/* Fight Info */}
                        <div className="flex-1 text-center md:text-left">
                            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">
                                {new Date(fight.start_time).toLocaleTimeString([], { hour: '2-digit', minute:'2-digit' })}
                            </div>
                            <h3 className="text-xl font-black text-white italic uppercase">
                                {fight.fighter_1_name} <span className="text-gray-600 not-italic text-sm mx-2">vs</span> {fight.fighter_2_name}
                            </h3>
                        </div>

                        {/* Winner Buttons */}
                        <div className="flex items-center gap-3 w-full md:w-auto">
                            <button
                                onClick={() => setWinner(fight.id, fight.fighter_1_name)}
                                className="flex-1 md:flex-none px-6 py-3 bg-gray-800 hover:bg-green-600 border border-gray-700 hover:border-green-500 text-white text-xs font-black uppercase tracking-widest rounded transition-all active:scale-95"
                            >
                                {fight.fighter_1_name}
                            </button>
                            
                            <button
                                onClick={() => setWinner(fight.id, fight.fighter_2_name)}
                                className="flex-1 md:flex-none px-6 py-3 bg-gray-800 hover:bg-green-600 border border-gray-700 hover:border-green-500 text-white text-xs font-black uppercase tracking-widest rounded transition-all active:scale-95"
                            >
                                {fight.fighter_2_name}
                            </button>
                        </div>

                    </div>
                ))}
            </div>
        )}
      </div>
    </div>
  );
}