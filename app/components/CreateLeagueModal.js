'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export default function CreateLeagueModal({ isOpen, onClose, onRefresh }) {
  const [name, setName] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [tab, setTab] = useState('join'); // Default to join for better UX
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUser(user);
    };
    getUser();
  }, []);

  // --- HANDLE CREATE ---
  const handleCreate = async () => {
    if (!user) return alert("You must be logged in.");
    if (!name.trim()) return alert("League Name is required.");

    setLoading(true);
    // Generate simple 6-char code
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    // 1. Insert League
    const { data: league, error: createError } = await supabase
      .from('leagues')
      .insert([{ 
        name, 
        image_url: imageUrl, 
        created_by: user.id, // Stores the Creator's UUID
        invite_code: code 
      }])
      .select()
      .single();

    if (createError) {
        setLoading(false);
        return alert("Error creating league: " + createError.message);
    }

    // 2. Add Creator to Members Table
    // Note: We use 'user_id' as the column name (which stores the email/ID string)
    await supabase.from('league_members').insert([{ 
        league_id: league.id, 
        user_id: user.email 
    }]);
    
    setLoading(false);
    onRefresh(); 
    onClose();
  };

  // --- HANDLE JOIN (The Fix) ---
  const handleJoin = async () => {
    if (!user) return alert("You must be logged in.");
    
    const cleanCode = inviteCode.trim().toUpperCase();
    if (!cleanCode) return alert("Please enter a code.");

    setLoading(true);
    
    // 1. Verify Code exists
    const { data: league, error: searchError } = await supabase
        .from('leagues')
        .select('id, name')
        .eq('invite_code', cleanCode)
        .single();

    if (searchError || !league) {
        setLoading(false);
        return alert("Invalid Invite Code. Please double-check.");
    }

    // 2. Insert into Members
    // FIX: Using 'user_id' column to match your SQL table
    const { error: joinError } = await supabase
        .from('league_members')
        .insert([{ 
            league_id: league.id, 
            user_id: user.email 
        }]);
    
    if (joinError) {
        // Postgres error 23505 = Unique Violation (Already in table)
        if (joinError.code === '23505') {
            alert(`You are already in "${league.name}"!`);
        } else {
            alert("Error joining: " + joinError.message);
        }
    } else {
        alert(`Success! You have joined "${league.name}".`);
        onRefresh();
        onClose();
    }
    setLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[60] p-4 backdrop-blur-sm">
      <div className="bg-gray-950 border border-pink-600 p-8 rounded-2xl max-w-md w-full shadow-2xl animate-in zoom-in duration-200">
        
        {/* Header */}
        <div className="text-center mb-6">
            <h2 className="text-2xl font-black italic uppercase text-white tracking-tighter">
                {tab === 'create' ? 'Start a War' : 'Join the Fight'}
            </h2>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-8 border-b border-gray-800">
          <button onClick={() => setTab('join')} className={`flex-1 pb-4 font-bold uppercase text-xs tracking-widest transition-colors ${tab === 'join' ? 'text-teal-400 border-b-2 border-teal-400' : 'text-gray-500 hover:text-white'}`}>
            Enter Code
          </button>
          <button onClick={() => setTab('create')} className={`flex-1 pb-4 font-bold uppercase text-xs tracking-widest transition-colors ${tab === 'create' ? 'text-pink-500 border-b-2 border-pink-500' : 'text-gray-500 hover:text-white'}`}>
            Create New
          </button>
        </div>

        {/* Forms */}
        {tab === 'create' ? (
          <div className="space-y-4">
            <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase">League Name</label>
                <input 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    placeholder="e.g. Dana White's Contender Series" 
                    className="w-full bg-black border border-gray-800 p-3 rounded text-white outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition-all"
                />
            </div>
            <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase">Logo URL (Optional)</label>
                <input 
                    value={imageUrl} 
                    onChange={(e) => setImageUrl(e.target.value)} 
                    placeholder="https://..." 
                    className="w-full bg-black border border-gray-800 p-3 rounded text-white outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition-all"
                />
            </div>
            <button 
                onClick={handleCreate} 
                disabled={loading}
                className="w-full py-4 mt-2 bg-pink-600 text-white font-black uppercase text-xs rounded hover:bg-pink-500 disabled:opacity-50 transition-colors"
            >
                {loading ? 'Creating...' : 'Initialize League'}
            </button>
          </div>
        ) : (
          <div className="space-y-6">
             <div className="text-center">
                <p className="text-gray-500 text-xs mb-4">Enter the invite code shared by your league commissioner.</p>
                <input 
                    value={inviteCode} 
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())} 
                    placeholder="X9J2M" 
                    className="w-full bg-black border border-gray-800 p-4 rounded-lg text-white text-center font-mono text-3xl uppercase outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all tracking-widest placeholder-gray-800"
                />
            </div>
            <button 
                onClick={handleJoin} 
                disabled={loading}
                className="w-full py-4 bg-teal-500 text-black font-black uppercase text-xs rounded hover:bg-teal-400 disabled:opacity-50 transition-colors"
            >
                {loading ? 'Searching...' : 'Join League'}
            </button>
          </div>
        )}
        
        <button onClick={onClose} className="w-full mt-6 text-gray-600 hover:text-white text-[10px] font-bold uppercase tracking-widest transition-colors">
            Cancel
        </button>
      </div>
    </div>
  );
}