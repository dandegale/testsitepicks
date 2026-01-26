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
  const router = useRouter();

  useEffect(() => {
    checkAdminAndFetch();
  }, []);

  const checkAdminAndFetch = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    // --- SECURITY CHECK ---
    // Change 'YOUR_EMAIL_HERE' to match the email inside the alert box!
    const ADMIN_EMAIL = 'dandegale2004@gmail.com'; 

    if (!user || user.email !== ADMIN_EMAIL) { 
      // This alert will tell you exactly who you are logged in as:
      alert(`Access Denied! You are currently logged in as: ${user ? user.email : 'Nobody'}`);
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

  const markWinner = async (fightId, winnerName) => {
    if (!confirm(`Declare ${winnerName} the winner?`)) return;

    const { error } = await supabase
      .from('fights')
      .update({ winner: winnerName })
      .eq('id', fightId);

    if (error) alert('Error updating winner');
    else {
      setFights(fights.map(f => f.id === fightId ? { ...f, winner: winnerName } : f));
    }
  };

  if (loading) return <div className="p-10 text-white">Verifying Commissioner Access...</div>;

  return (
    <main className="min-h-screen bg-black text-white p-8">
      <h1 className="text-3xl font-bold text-pink-600 mb-8 uppercase">Commissioner Dashboard</h1>
      
      <div className="grid gap-6 max-w-4xl mx-auto">
        {fights.map((fight) => (
          <div key={fight.id} className="bg-gray-900 border border-gray-700 p-6 flex justify-between items-center rounded">
            
            {/* Fighter 1 Control */}
            <button 
              onClick={() => markWinner(fight.id, fight.fighter_1_name)}
              className={`p-4 rounded border w-1/3 font-bold transition-colors ${
                fight.winner === fight.fighter_1_name 
                ? 'bg-green-600 border-green-400 text-white' 
                : 'bg-gray-800 border-gray-600 hover:bg-gray-700 text-gray-400'
              }`}
            >
              {fight.fighter_1_name}
              {fight.winner === fight.fighter_1_name && <div className="text-xs uppercase mt-1">WINNER</div>}
            </button>

            <div className="text-center px-4">
              <span className="text-gray-500 font-bold">VS</span>
            </div>

            {/* Fighter 2 Control */}
            <button 
              onClick={() => markWinner(fight.id, fight.fighter_2_name)}
              className={`p-4 rounded border w-1/3 font-bold transition-colors ${
                fight.winner === fight.fighter_2_name 
                ? 'bg-green-600 border-green-400 text-white' 
                : 'bg-gray-800 border-gray-600 hover:bg-gray-700 text-gray-400'
              }`}
            >
              {fight.fighter_2_name}
              {fight.winner === fight.fighter_2_name && <div className="text-xs uppercase mt-1">WINNER</div>}
            </button>
            
          </div>
        ))}
      </div>
    </main>
  );
}