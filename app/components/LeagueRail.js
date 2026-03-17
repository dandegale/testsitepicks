'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation'; 
import { createClient } from '@supabase/supabase-js';
import CreateLeagueModal from './CreateLeagueModal'; 
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export default function LeagueRail({ initialLeagues = [] }) {
  const [isOpen, setIsOpen] = useState(false); 
  const [showModal, setShowModal] = useState(false); 
  const [leagues, setLeagues] = useState(initialLeagues);
  const [userEmail, setUserEmail] = useState(null);
  const pathname = usePathname(); 

  useEffect(() => {
    if (initialLeagues && initialLeagues.length > 0) {
      setLeagues(initialLeagues);
    }
  }, [initialLeagues]);

  useEffect(() => {
    if (initialLeagues.length === 0) fetchData();
  }, []);

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      setUserEmail(user.email);
      
      // 🎯 FIRST ATTEMPT: Try to fetch with the custom sort_order
      let { data, error } = await supabase
        .from('league_members')
        .select('leagues ( id, name, image_url, invite_code ), sort_order')
        .eq('user_id', user.email)
        .order('sort_order', { ascending: true });
      
      // 🎯 FALLBACK: If sort_order column is missing in Supabase, catch the error and do a normal fetch
      if (error || !data) {
         const fallback = await supabase
            .from('league_members')
            .select('leagues ( id, name, image_url, invite_code )')
            .eq('user_id', user.email);
         data = fallback.data;
      }
      
      if (data) {
        const validLeagues = data.map(item => item.leagues).filter(Boolean);
        setLeagues(validLeagues);
      }
    }
  };

  // 🎯 THE DRAG AND DROP HANDLER
  const handleDragEnd = async (result) => {
    if (!result.destination) return; 

    const items = Array.from(leagues);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Optimistically update the UI instantly
    setLeagues(items);

    // Save the new order to the database silently
    if (userEmail) {
        const updates = items.map((league, index) => ({
            league_id: league.id,
            user_id: userEmail,
            sort_order: index
        }));

        // Fire and forget the update, catch error silently if column is missing
        supabase
            .from('league_members')
            .upsert(updates, { onConflict: 'league_id, user_id' })
            .then(({ error }) => {
                if (error) console.warn("To save layout permanently, add 'sort_order' integer column to league_members table.");
            });
    }
  };

  return (
    <>
      {/* --- DESKTOP RAIL --- */}
      <div className="hidden md:flex flex-col items-center w-20 bg-gray-950 border-r border-pink-900/30 h-screen sticky top-0 py-6 gap-6 z-40">
        
        <Link href="/" className="w-[70px] h-[70px] flex items-center justify-center hover:scale-105 transition-transform shrink-0 px-1">
            <img src="/fightiq-logo.png" alt="FightIQ" className="w-full h-full object-contain" />
        </Link>

        <div className="w-8 h-px bg-gray-800 shrink-0"></div>

        <Link href="/" className="group relative flex items-center justify-center w-full">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-xs border-2 transition-all shrink-0 ${pathname === '/' ? 'bg-teal-500 text-black border-white' : 'bg-gray-950 text-teal-500 border-gray-700 hover:border-teal-500'}`}>
                GL
            </div>
        </Link>

        {/* 🎯 DRAG AND DROP CONTEXT WRAPPER */}
        <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="league-list">
                {(provided) => (
                    <div 
                        {...provided.droppableProps} 
                        ref={provided.innerRef} 
                        className="flex flex-col gap-4 overflow-y-auto overflow-x-hidden no-scrollbar w-full items-center pb-4"
                    >
                        {leagues.map((league, index) => {
                            const isActive = pathname === `/league/${league.id}`; 
                            return (
                                <Draggable key={league.id.toString()} draggableId={league.id.toString()} index={index}>
                                    {(provided, snapshot) => (
                                        <div
                                            ref={provided.innerRef}
                                            {...provided.draggableProps}
                                            {...provided.dragHandleProps}
                                            style={{ ...provided.draggableProps.style }}
                                            className={`group relative flex items-center justify-center w-full shrink-0 ${snapshot.isDragging ? 'z-50 scale-110 drop-shadow-[0_0_15px_rgba(236,72,153,0.5)]' : ''}`}
                                        >
                                            <div 
                                                onClick={() => { if (!snapshot.isDragging) window.location.href = `/league/${league.id}`; }}
                                                className="cursor-pointer"
                                            >
                                                {league.image_url ? (
                                                    <img 
                                                        src={league.image_url} 
                                                        className={`w-12 h-12 rounded-full border-2 transition-all object-cover shrink-0 ${isActive ? 'border-pink-500' : 'border-transparent hover:border-pink-500'}`}
                                                        alt={league.name}
                                                    />
                                                ) : (
                                                    <div className={`w-12 h-12 rounded-full bg-gray-950 flex items-center justify-center font-bold text-xs border-2 transition-colors shrink-0 ${isActive ? 'text-pink-500 border-pink-500' : 'text-gray-500 border-gray-800 hover:border-pink-500 hover:text-pink-500'}`}>
                                                        {league.name.substring(0, 2).toUpperCase()}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </Draggable>
                            );
                        })}
                        {provided.placeholder}
                    </div>
                )}
            </Droppable>
        </DragDropContext>

        <button 
          onClick={() => setShowModal(true)}
          className="w-12 h-12 rounded-full bg-gray-950 border border-dashed border-gray-700 flex items-center justify-center text-gray-500 hover:text-green-400 hover:border-green-400 transition-all text-xl mt-auto mb-4 shrink-0"
        >
            +
        </button>
      </div>

      {/* --- MOBILE HAMBURGER --- */}
      <div className="md:hidden fixed top-4 left-4 z-50">
         <button onClick={() => setIsOpen(true)} className="p-2 bg-gray-900 border border-pink-900 rounded text-pink-500 shadow-lg">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
         </button>
      </div>

      {/* --- MOBILE DRAWER --- */}
      {isOpen && (
        <>
            <div className="fixed inset-0 bg-black/80 z-40 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
            <div className="fixed inset-y-0 left-0 w-72 bg-gray-950 border-r border-pink-900 z-50 p-6 flex flex-col shadow-2xl animate-in slide-in-from-left duration-300">
                <div className="flex justify-between items-center mb-8">
                    <div className="flex items-center gap-3">
                        <img src="/fightiq-logo.png" alt="FightIQ" className="w-12 h-12 object-contain" />
                        <span className="text-xl font-black text-white italic tracking-tighter uppercase">FIGHT<span className="text-pink-600">IQ</span></span>
                    </div>
                    <button onClick={() => setIsOpen(false)} className="text-gray-500 hover:text-white">✕</button>
                </div>

                <div className="mb-8 space-y-3 overflow-y-auto">
                    <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Leagues</div>
                    <Link href="/" onClick={() => setIsOpen(false)} className="flex items-center gap-3 p-2 rounded hover:bg-gray-900 text-teal-400 font-bold transition-colors">
                        <div className="w-8 h-8 rounded-full bg-teal-900/50 flex items-center justify-center border border-teal-500 text-xs">GL</div>
                        Global League
                    </Link>
                    {leagues.map(l => (
                        <Link key={l.id} href={`/league/${l.id}`} onClick={() => setIsOpen(false)} className="flex items-center gap-3 p-2 rounded hover:bg-gray-900 text-gray-300 font-bold transition-colors">
                             <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center border border-gray-600 text-xs">{l.name.substring(0,2).toUpperCase()}</div>
                             {l.name}
                        </Link>
                    ))}
                    <button onClick={() => { setIsOpen(false); setShowModal(true); }} className="w-full py-3 mt-4 border border-dashed border-gray-700 text-gray-500 rounded hover:text-teal-400 hover:border-teal-500 transition-all text-xs font-bold uppercase">
                        + Create / Join
                    </button>
                </div>

                <nav className="space-y-4 text-lg font-bold uppercase tracking-wider border-t border-gray-800 pt-6 mt-auto">
                    <Link href="/" className="block text-gray-400 hover:text-pink-500 transition-colors">🏠 Dashboard</Link>
                    <Link href="/profile" className="block text-gray-400 hover:text-pink-500 transition-colors">👤 My Profile</Link>
                </nav>
            </div>
        </>
      )}

      <CreateLeagueModal isOpen={showModal} onClose={() => setShowModal(false)} userEmail={userEmail} onRefresh={fetchData} />
    </>
  );
}