'use client';

import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function FighterProfile() {
  const { slug } = useParams(); 
  const [fighterBio, setFighterBio] = useState(null);
  const [fightHistory, setFightHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [trackedRecord, setTrackedRecord] = useState({ wins: 0, losses: 0, draws: 0 });

  // Display Name Helper
  const formatName = (s) => {
    if (!s) return "Unknown Fighter";
    return s.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const displayName = formatName(slug);

  useEffect(() => {
    async function fetchFighterData() {
      // 1. Fetch Official Bio (API)
      try {
        const bioRes = await fetch(`https://api.octagon-api.com/fighter/${slug}`);
        if (bioRes.ok) {
          setFighterBio(await bioRes.json());
        }
      } catch (err) {
        console.warn("Bio API Error", err);
      }

      // 2. SMART FUZZY SEARCH (The "First 4 Letters" Logic)
      if (slug) {
          const parts = slug.split('-');
          
          if (parts.length > 0) {
              // Get "Safe" 4-letter snippets. 
              // substring(0,4) is safe even if name is shorter (e.g. "Jon" -> "jon")
              const fNameFrag = parts[0].substring(0, 4).toLowerCase(); 
              const lNameFrag = parts[parts.length - 1].substring(0, 4).toLowerCase();

              // Pattern: "Anything" + "First4" + "Anything" + "Last4" + "Anything"
              // Matches: "alex-volk" -> "%alex%volk%" -> matches "Alexander Volkanovski"
              const searchPattern = `%${fNameFrag}%${lNameFrag}%`;

              const { data: fights } = await supabase
                .from('fights')
                .select('*')
                .or(`fighter_1_name.ilike.${searchPattern},fighter_2_name.ilike.${searchPattern}`)
                .order('start_time', { ascending: false });

              if (fights) {
                setFightHistory(fights);
                
                // Calculate Record using the same fuzzy logic
                let w = 0, l = 0, d = 0;
                fights.forEach(f => {
                   if (f.winner) {
                       const wName = f.winner.toLowerCase();
                       // If the winner name contains our First AND Last fragments, it's a win
                       if (wName.includes(fNameFrag) && wName.includes(lNameFrag)) {
                           w++;
                       } else {
                           l++;
                       }
                   }
                });
                setTrackedRecord({ wins: w, losses: l, draws: d });
              }
          }
      }
      setLoading(false);
    }

    if (slug) fetchFighterData();
  }, [slug]);

  // Official Record Helper
  const getOfficialRecord = () => {
      if (!fighterBio) return 'N/A';
      if (fighterBio.record) return fighterBio.record; // "26-4-0"
      if (fighterBio.wins !== undefined) {
          return `${fighterBio.wins}-${fighterBio.losses}-${fighterBio.draws || 0}`;
      }
      return 'N/A';
  };

  if (loading) return <div className="min-h-screen bg-black text-white flex items-center justify-center font-black animate-pulse">LOADING FIGHTER...</div>;

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-pink-500">
      
      {/* HERO SECTION */}
      <div className="relative h-[40vh] min-h-[300px] w-full overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent z-10"></div>
        {fighterBio?.image ? (
            <img src={fighterBio.image} alt={displayName} className="absolute inset-0 w-full h-full object-cover opacity-50 object-top" />
        ) : (
            <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
                <span className="text-gray-800 font-black text-9xl opacity-20 uppercase">{displayName.charAt(0)}</span>
            </div>
        )}
        
        <div className="absolute bottom-0 left-0 w-full p-6 z-20 max-w-5xl mx-auto">
            <Link href="/" className="text-pink-500 text-xs font-black uppercase tracking-widest mb-4 inline-block hover:underline">← Back to Dashboard</Link>
            <h1 className="text-5xl md:text-7xl font-black italic uppercase tracking-tighter leading-none">{displayName}</h1>
            {fighterBio?.nickname && <p className="text-xl text-gray-400 font-bold uppercase tracking-widest mt-2">"{fighterBio.nickname}"</p>}
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-6 grid grid-cols-1 md:grid-cols-3 gap-10">
        
        {/* STATS CARD */}
        <div className="space-y-6">
            <div className="bg-gray-950 border border-gray-800 rounded-2xl p-6 shadow-xl">
                <h3 className="text-gray-500 text-xs font-black uppercase tracking-widest mb-6">Physical Stats</h3>
                <div className="grid grid-cols-2 gap-y-6">
                    <div>
                        <p className="text-[10px] text-gray-600 uppercase font-bold">Height</p>
                        <p className="text-xl font-black italic text-white">{fighterBio?.height || 'N/A'}</p>
                    </div>
                    <div>
                        <p className="text-[10px] text-gray-600 uppercase font-bold">Weight</p>
                        <p className="text-xl font-black italic text-white">{fighterBio?.weight || 'N/A'}</p>
                    </div>
                    <div>
                        <p className="text-[10px] text-gray-600 uppercase font-bold">Reach</p>
                        <p className="text-xl font-black italic text-white">{fighterBio?.reach || 'N/A'}</p>
                    </div>
                    <div>
                        <p className="text-[10px] text-gray-600 uppercase font-bold">Stance</p>
                        <p className="text-xl font-black italic text-white">{fighterBio?.stance || 'Orthodox'}</p>
                    </div>
                </div>
            </div>

            {/* RECORD CARD */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 flex justify-between items-center">
                 <div>
                    <p className="text-[10px] text-gray-500 uppercase font-bold">Career Record</p>
                    <p className="text-4xl font-black italic text-white">
                        {getOfficialRecord()}
                    </p>
                    <p className="text-[9px] text-gray-600 mt-1 uppercase font-bold">
                        League: {trackedRecord.wins}-{trackedRecord.losses}
                    </p>
                 </div>
                 <div className="text-right">
                    <p className="text-[10px] text-gray-500 uppercase font-bold">League Win %</p>
                    <p className="text-3xl font-black italic text-teal-500">
                        {trackedRecord.wins + trackedRecord.losses > 0 
                            ? Math.round((trackedRecord.wins / (trackedRecord.wins + trackedRecord.losses)) * 100) + '%'
                            : '—'
                        }
                    </p>
                 </div>
            </div>
        </div>

        {/* FIGHT HISTORY LIST */}
        <div className="md:col-span-2">
            <h3 className="text-2xl font-black italic uppercase tracking-tighter mb-6">League History</h3>
            
            <div className="space-y-4">
                {fightHistory.length === 0 ? (
                    <div className="p-8 border border-dashed border-gray-800 rounded-xl text-center text-gray-500 text-sm">
                        No recorded fights in this league.
                    </div>
                ) : (
                    fightHistory.map(fight => {
                        // RE-USE THE FRAGMENTS FOR MATCHING OPPONENT NAME
                        const parts = slug.split('-');
                        const fFrag = parts[0].substring(0, 4).toLowerCase();
                        const lFrag = parts[parts.length - 1].substring(0, 4).toLowerCase();

                        const f1Raw = fight.fighter_1_name.toLowerCase();
                        // "Am I Fighter 1?" -> Check if name contains BOTH fragments
                        const isF1Me = f1Raw.includes(fFrag) && f1Raw.includes(lFrag);
                        
                        const opponent = isF1Me ? fight.fighter_2_name : fight.fighter_1_name;

                        // RESULT LOGIC
                        const hasWinner = !!fight.winner;
                        const wRaw = (fight.winner || '').toLowerCase();
                        const isWin = hasWinner && wRaw.includes(fFrag) && wRaw.includes(lFrag);
                        const isPending = !hasWinner;

                        return (
                            <div key={fight.id} className="group bg-gray-950 border border-gray-900 hover:border-gray-700 rounded-xl p-4 transition-all flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">
                                        {new Date(fight.start_time).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </p>
                                    <h4 className="text-lg font-black italic uppercase text-white group-hover:text-pink-500 transition-colors">
                                        vs. {opponent}
                                    </h4>
                                    <p className="text-xs text-gray-400 font-bold uppercase">{fight.event_name}</p>
                                </div>
                                
                                <div>
                                    {isPending ? (
                                        <span className="bg-gray-800 text-gray-400 px-3 py-1 rounded text-xs font-black uppercase tracking-widest">
                                            Upcoming
                                        </span>
                                    ) : isWin ? (
                                        <span className="bg-teal-900/30 text-teal-400 border border-teal-800 px-4 py-2 rounded text-sm font-black italic uppercase tracking-widest">
                                            WIN
                                        </span>
                                    ) : (
                                        <span className="bg-red-900/20 text-red-500 border border-red-900 px-4 py-2 rounded text-sm font-black italic uppercase tracking-widest">
                                            LOSS
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>

      </div>
    </div>
  );
}