'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

export default function FighterProfilePage() {
  const params = useParams();
  const slug = params?.slug;

  const [fighterBio, setFighterBio] = useState(null);
  const [loading, setLoading] = useState(true);

  const formatName = (s) => {
    if (!s) return "Loading...";
    return s.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const displayName = slug ? formatName(slug) : "Loading...";

  useEffect(() => {
    if (!slug) return;

    async function fetchData() {
      try {
          // 🚀 We just hit our new backend route!
          const res = await fetch(`/api/fighter/${slug}`);
          const data = await res.json();
          setFighterBio(data);
      } catch (error) {
          console.error("Failed to load fighter data:", error);
      } finally {
          setLoading(false);
      }
    }

    fetchData();
  }, [slug]);

  if (!slug || loading || !fighterBio) {
      return (
        <div className="min-h-screen bg-black text-white flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-pink-600 border-t-transparent rounded-full animate-spin"></div>
                <div className="text-xs font-black uppercase tracking-widest text-gray-500">Compiling Fighter Data...</div>
            </div>
        </div>
      );
  }

  const displayRecord = (fighterBio.record && fighterBio.record !== '—') ? fighterBio.record : `0-0-0`;

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-pink-500">
      
      {/* HERO SECTION */}
      <div className="relative h-[45vh] min-h-[350px] w-full overflow-hidden bg-black border-b border-gray-800">
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-black to-black z-0" />
        {fighterBio.image ? (
            <>
                <div className="absolute right-0 top-0 h-full w-full md:w-2/3 bg-cover bg-center opacity-20 blur-3xl scale-110" style={{ backgroundImage: `url(${fighterBio.image})` }} />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={fighterBio.image} alt={displayName} className="absolute right-0 bottom-0 h-[90%] w-auto max-w-[60%] object-contain object-bottom z-10 mr-4 md:mr-10 opacity-90 drop-shadow-2xl" />
                <div className="absolute inset-0 bg-gradient-to-r from-black via-black/60 to-transparent z-20" />
            </>
        ) : (
            <div className="absolute inset-0 flex items-center justify-end pr-20 opacity-10">
                <span className="text-9xl font-black uppercase text-gray-700">{displayName.charAt(0)}</span>
            </div>
        )}
        
        <div className="absolute bottom-0 left-0 w-full p-6 md:p-10 z-30 max-w-7xl mx-auto flex flex-col justify-end h-full pointer-events-none">
            <Link href="/" className="text-pink-500 text-xs font-black uppercase tracking-widest mb-4 inline-block hover:text-white transition-colors pointer-events-auto w-fit">
                ← Back to Dashboard
            </Link>
            <div className="relative z-40 max-w-[85%]">
                <div className="flex flex-wrap items-baseline gap-4 mb-2">
                    <h1 className="text-5xl md:text-8xl font-black italic uppercase tracking-tighter leading-none drop-shadow-lg">{displayName}</h1>
                    {fighterBio.ranking && <span className="self-center text-3xl md:text-5xl font-black italic text-white ml-2">{fighterBio.ranking}</span>}
                    {displayRecord !== '0-0-0' && <span className="self-center text-3xl md:text-5xl font-black italic text-teal-400 bg-teal-900/20 px-4 py-1 rounded-lg border border-teal-800/50 ml-4">{displayRecord}</span>}
                </div>
            </div>
            {fighterBio.nickname && <p className="text-xl text-gray-400 font-bold uppercase tracking-widest pl-1">"{fighterBio.nickname}"</p>}
            {fighterBio.country && <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-600 mt-4 pl-1">Representing: <span className="text-white">{fighterBio.country}</span></p>}
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 md:p-10 grid grid-cols-1 lg:grid-cols-3 gap-10">
        
        {/* STATS (2x2 Grid) */}
        <div className="space-y-6">
            <div className="bg-gray-950 border border-gray-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-pink-600"></div>
                <h3 className="text-gray-500 text-xs font-black uppercase tracking-widest mb-6">Stats</h3>
                <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                    <div><p className="text-[10px] text-gray-600 uppercase font-bold">Height</p><p className="text-xl font-black italic text-white">{fighterBio.height}</p></div>
                    <div><p className="text-[10px] text-gray-600 uppercase font-bold">Weight</p><p className="text-xl font-black italic text-white">{fighterBio.weight}</p></div>
                    <div><p className="text-[10px] text-gray-600 uppercase font-bold">Reach</p><p className="text-xl font-black italic text-white">{fighterBio.reach}</p></div>
                    <div><p className="text-[10px] text-gray-600 uppercase font-bold">Age</p><p className="text-xl font-black italic text-white">{fighterBio.age}</p></div>
                </div>
                {fighterBio.winStats.totalWins > 0 && (
                    <div className="mt-8 pt-6 border-t border-gray-800">
                         <h4 className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-4">Win Breakdown ({fighterBio.winStats.totalWins} Wins)</h4>
                         <div className="space-y-4">
                            <div>
                                <div className="flex justify-between text-xs font-bold uppercase mb-1"><span className="text-white">KO / TKO</span><span className="text-pink-500">{fighterBio.winStats.ko} ({fighterBio.winStats.koPct}%)</span></div>
                                <div className="w-full bg-gray-900 rounded-full h-1.5"><div className="bg-pink-600 h-1.5 rounded-full" style={{ width: `${fighterBio.winStats.koPct}%` }}></div></div>
                            </div>
                            <div>
                                <div className="flex justify-between text-xs font-bold uppercase mb-1"><span className="text-white">Submission</span><span className="text-teal-400">{fighterBio.winStats.sub} ({fighterBio.winStats.subPct}%)</span></div>
                                <div className="w-full bg-gray-900 rounded-full h-1.5"><div className="bg-teal-500 h-1.5 rounded-full" style={{ width: `${fighterBio.winStats.subPct}%` }}></div></div>
                            </div>
                            <div>
                                <div className="flex justify-between text-xs font-bold uppercase mb-1"><span className="text-white">Decision</span><span className="text-blue-400">{fighterBio.winStats.dec} ({fighterBio.winStats.decPct}%)</span></div>
                                <div className="w-full bg-gray-900 rounded-full h-1.5"><div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${fighterBio.winStats.decPct}%` }}></div></div>
                            </div>
                         </div>
                    </div>
                )}
            </div>
            
            {/* STATUS BOX */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 flex justify-between items-center">
                 <div><p className="text-[10px] text-gray-500 uppercase font-bold">Current Status</p><p className="text-2xl font-black italic text-white">ACTIVE</p></div>
                 <div className="text-right"><p className="text-[10px] text-gray-500 uppercase font-bold">Total Fights</p><p className="text-2xl font-black italic text-teal-500">{fighterBio.history.length}</p></div>
            </div>
        </div>

        {/* FIGHT HISTORY */}
        <div className="md:col-span-2">
            <h3 className="text-2xl font-black italic uppercase tracking-tighter mb-6">FIGHT HISTORY</h3>
            <div className="space-y-4">
                {fighterBio.history.length === 0 ? (
                    <div className="p-8 border border-dashed border-gray-800 rounded-xl text-center text-gray-500 text-sm">No recent fight history found.</div>
                ) : (
                    fighterBio.history.map((fight, i) => {
                        const isWin = fight.outcome === 'Win';
                        const isUpcoming = fight.outcome === 'Upcoming';
                        
                        // Formats the opponent name into a URL-friendly slug
                        const opponentSlug = fight.opponent.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

                        return (
                            <div key={i} className={`group border rounded-xl p-4 transition-all flex items-center justify-between ${isUpcoming ? 'bg-yellow-900/10 border-yellow-600/50' : 'bg-gray-950 border-gray-900 hover:border-gray-700'}`}>
                                <div className="min-w-0 flex-1 pr-4">
                                    <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${isUpcoming ? 'text-yellow-500' : 'text-gray-500'}`}>{fight.date}</p>
                                    <h4 className="text-lg font-black italic uppercase text-white truncate">
                                        vs. 
                                        <Link href={`/fighter/${opponentSlug}`} className="ml-2 hover:text-pink-500 transition-colors">
                                            {fight.opponent}
                                        </Link>
                                    </h4>
                                    <p className="text-xs text-gray-400 font-bold uppercase truncate">{fight.event} • {fight.method}</p>
                                </div>
                                <div className="shrink-0">
                                    {isUpcoming ? (
                                        <span className="bg-yellow-900/30 text-yellow-400 border border-yellow-800 px-4 py-2 rounded text-sm font-black italic uppercase tracking-widest">NEXT</span>
                                    ) : isWin ? (
                                        <span className="bg-teal-900/30 text-teal-400 border border-teal-800 px-4 py-2 rounded text-sm font-black italic uppercase tracking-widest">WIN</span>
                                    ) : (
                                        <span className="bg-red-900/20 text-red-500 border border-red-900 px-4 py-2 rounded text-sm font-black italic uppercase tracking-widest">{fight.outcome.toUpperCase()}</span>
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