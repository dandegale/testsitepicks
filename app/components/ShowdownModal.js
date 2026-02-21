'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link'; 

// Initialize Supabase safely
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

export default function ShowdownModal({ isOpen, onClose }) {
  const [phase, setPhase] = useState('hidden'); 
  const [inviteLink, setInviteLink] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // NEW STATES FOR LOBBY
  const [activeMatches, setActiveMatches] = useState([]);
  const [viewingActives, setViewingActives] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState('');

  useEffect(() => {
    if (isOpen) {
      setPhase('animating');
      // Reset states when opened
      setInviteLink('');
      setCopied(false);
      setViewingActives(false); // Reset to main menu
      
      const timer = setTimeout(() => {
        setPhase('content');
      }, 1200);
      return () => clearTimeout(timer);
    } else {
      setPhase('hidden');
    }
  }, [isOpen]);

  const generateInvite = async () => {
    setIsGenerating(true);
    
    // 1. Get the current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        alert("You must be logged in to create a showdown!");
        setIsGenerating(false);
        return;
    }

    // 2. Generate a random 6-character code
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    // 3. Save to our new Supabase table
    const { error } = await supabase
        .from('h2h_matches')
        .insert({
            creator_email: user.email,
            invite_code: code,
            status: 'pending'
        });

    if (error) {
        console.error("Error creating showdown:", error);
        alert("Failed to create showdown. Please try again.");
    } else {
        // 4. Create the sharable URL
        const url = `${window.location.origin}/showdown/${code}`;
        setInviteLink(url);
    }
    
    setIsGenerating(false);
  };

  const copyToClipboard = () => {
      navigator.clipboard.writeText(`I'm challenging you to a 1v1 UFC pick 'em showdown on FightIQ! 👊\n\nEnter the octagon here: ${inviteLink}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
  };

  // UPDATED: FETCH ACTIVE MATCHES AND RESOLVE USERNAMES
  const fetchActiveMatches = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
          alert("Please log in to view your showdowns.");
          return;
      }
      setCurrentUserEmail(user.email);

      // Fetch matches where you are either the creator OR the opponent
      const { data: matches, error } = await supabase
          .from('h2h_matches')
          .select('*')
          .or(`creator_email.eq.${user.email},opponent_email.eq.${user.email}`)
          .order('created_at', { ascending: false });

      if (!error && matches && matches.length > 0) {
          // 1. Extract all unique emails from the matches
          const emailsToFetch = new Set();
          matches.forEach(m => {
              if (m.creator_email) emailsToFetch.add(m.creator_email);
              if (m.opponent_email) emailsToFetch.add(m.opponent_email);
          });

          // 2. Query the profiles table for these emails
          const { data: profiles } = await supabase
              .from('profiles')
              .select('email, username')
              .in('email', Array.from(emailsToFetch));

          // 3. Map the usernames back into our match data
          const enrichedMatches = matches.map(m => {
              const creatorProfile = profiles?.find(p => p.email === m.creator_email);
              const opponentProfile = profiles?.find(p => p.email === m.opponent_email);
              
              return {
                  ...m,
                  creator_username: creatorProfile?.username || m.creator_email.split('@')[0],
                  opponent_username: m.opponent_email ? (opponentProfile?.username || m.opponent_email.split('@')[0]) : null
              };
          });

          setActiveMatches(enrichedMatches);
      } else {
          setActiveMatches([]);
      }
      
      setViewingActives(true);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden">
      {/* Background Blur Overlay */}
      <div 
        className={`absolute inset-0 bg-black/90 backdrop-blur-md transition-opacity duration-500 ${phase === 'hidden' ? 'opacity-0' : 'opacity-100'}`}
        onClick={onClose}
      />

      {/* --- THE ANIMATION PHASE --- */}
      {phase === 'animating' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <style>{`
              @keyframes slideRightSmash {
                0% { transform: translateX(-100vw) rotate(-30deg) scale(0.8); opacity: 0; }
                60% { transform: translateX(10%) rotate(10deg) scale(1.2); opacity: 1; }
                80% { transform: translateX(-5%) rotate(-5deg) scale(1); }
                100% { transform: translateX(0) rotate(0) scale(1); }
              }
              @keyframes slideLeftSmash {
                0% { transform: translateX(100vw) rotate(30deg) scale(0.8); opacity: 0; }
                60% { transform: translateX(-10%) rotate(-10deg) scale(1.2); opacity: 1; }
                80% { transform: translateX(5%) rotate(5deg) scale(1); }
                100% { transform: translateX(0) rotate(0) scale(1); }
              }
              @keyframes screenShake {
                0%, 100% { transform: translate(0, 0); }
                60% { transform: translate(0, 0); } 
                65% { transform: translate(-15px, 15px); }
                70% { transform: translate(15px, -15px); }
                75% { transform: translate(-8px, 8px); }
                80% { transform: translate(8px, -8px); }
              }
              .animate-pink-glove { animation: slideRightSmash 0.8s cubic-bezier(0.25, 1, 0.5, 1) forwards; }
              .animate-teal-glove { animation: slideLeftSmash 0.8s cubic-bezier(0.25, 1, 0.5, 1) forwards; }
              .animate-shake { animation: screenShake 1.2s ease-out forwards; }
            `}</style>

            <div className="relative flex w-full max-w-5xl justify-center items-center animate-shake">
                
                {/* Pink Corner (Left) */}
                <div className="animate-pink-glove z-20 text-right pr-2 md:pr-10">
                    <img 
                        src="/pink-gloves.png" 
                        alt="Pink Corner Gloves" 
                        className="w-48 h-48 md:w-80 md:h-80 object-contain drop-shadow-[0_0_40px_rgba(219,39,119,0.8)] transform -rotate-12"
                    />
                </div>

                {/* Impact Flash */}
                <div className="absolute z-10 w-full h-full flex items-center justify-center mix-blend-screen opacity-0 animate-[ping_0.3s_ease-out_0.6s_1_forwards]">
                    <div className="w-64 h-64 md:w-96 md:h-96 bg-white rounded-full blur-[80px]"></div>
                </div>

                {/* Teal Corner (Right) */}
                <div className="animate-teal-glove z-20 text-left pl-2 md:pl-10">
                    <img 
                        src="/teal-gloves.png" 
                        alt="Teal Corner Gloves" 
                        className="w-48 h-48 md:w-80 md:h-80 object-contain drop-shadow-[0_0_40px_rgba(20,184,166,0.8)] transform rotate-12"
                    />
                </div>
            </div>
        </div>
      )}

      {/* --- THE ACTUAL 1v1 UI PHASE --- */}
      {phase === 'content' && (
        <div className="relative z-30 w-full max-w-lg bg-gray-950 border border-gray-800 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.8)] p-6 md:p-10 animate-in zoom-in-95 fade-in duration-300">
            <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white">✕</button>
            
            <div className="text-center mb-8">
                <span className="bg-pink-900/30 text-pink-500 border border-pink-900 px-3 py-1 rounded text-[10px] font-black uppercase tracking-widest mb-4 inline-block shadow-[0_0_15px_rgba(219,39,119,0.3)]">
                    Unranked Showdown
                </span>
                <h2 className="text-4xl font-black italic uppercase tracking-tighter text-white">
                    1v1 Challenge
                </h2>
                <p className="text-sm text-gray-400 font-bold uppercase tracking-widest mt-2">
                    Winner takes bragging rights. Stats hidden from global record.
                </p>
            </div>

            {/* DYNAMIC RENDER: Active Matches List OR Creation Menu */}
            {viewingActives ? (
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 animate-in fade-in slide-in-from-right-4 custom-scrollbar">
                    <button onClick={() => setViewingActives(false)} className="text-[10px] text-gray-500 hover:text-white mb-2 uppercase font-black transition-colors">
                        ← Back to Menu
                    </button>
                    {activeMatches.map(m => (
                        <Link 
                            key={m.id} 
                            href={`/showdown/${m.invite_code}`}
                            onClick={onClose} // Close modal when navigating
                            className="flex items-center justify-between bg-black border border-gray-800 p-4 rounded-xl hover:border-pink-500 transition-all group"
                        >
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Code: {m.invite_code}</span>
                                <span className="text-sm font-bold text-white uppercase italic">
                                    {/* USE ENRICHED USERNAMES HERE */}
                                    Vs {currentUserEmail === m.creator_email ? (m.opponent_username || 'WAITING...') : m.creator_username}
                                </span>
                            </div>
                            <span className="text-pink-500 font-black group-hover:translate-x-1 transition-transform">→</span>
                        </Link>
                    ))}
                    {activeMatches.length === 0 && (
                        <p className="text-center py-6 text-gray-600 text-xs font-bold uppercase tracking-widest border border-dashed border-gray-800 rounded-xl">
                            No Active Showdowns
                        </p>
                    )}
                </div>
            ) : (
                <div className="space-y-4">
                    {!inviteLink ? (
                        <button 
                            onClick={generateInvite}
                            disabled={isGenerating}
                            className="w-full bg-white text-black font-black uppercase tracking-widest py-4 rounded hover:bg-pink-600 hover:text-white transition-all active:scale-95 disabled:opacity-50"
                        >
                            {isGenerating ? 'Generating...' : 'Create Invite Link'}
                        </button>
                    ) : (
                        <div className="animate-in fade-in slide-in-from-top-2">
                            <p className="text-[10px] font-black uppercase text-teal-400 tracking-widest mb-2 text-center">
                                Showdown Created! Send this to your opponent:
                            </p>
                            <button 
                                onClick={copyToClipboard}
                                className="w-full flex items-center justify-between bg-black border border-teal-500/50 hover:border-teal-400 text-teal-100 p-4 rounded transition-all group"
                            >
                                <span className="font-mono text-xs truncate max-w-[80%]">{inviteLink}</span>
                                <span className="text-[10px] font-black uppercase tracking-widest bg-teal-900 text-teal-300 px-2 py-1 rounded group-hover:bg-teal-700 transition-colors">
                                    {copied ? 'Copied!' : 'Copy'}
                                </span>
                            </button>
                        </div>
                    )}
                    
                    <button 
                        onClick={fetchActiveMatches}
                        className="w-full bg-transparent text-gray-400 border border-gray-800 font-black uppercase tracking-widest py-4 rounded hover:bg-gray-900 hover:text-white transition-all active:scale-95"
                    >
                        View Active Showdowns
                    </button>
                </div>
            )}
        </div>
      )}
    </div>
  );
}