'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function LeagueAdminPage() {
  const params = useParams();
  const id = params?.id;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState([]);
  const [leagueName, setLeagueName] = useState('');
  const [leagueImage, setLeagueImage] = useState('');
  const [saving, setSaving] = useState(false);

  // --- CARD SELECTION STATE ---
  const [eventType, setEventType] = useState('full_card');
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (id) fetchAdminData();
  }, [id]);

  const fetchAdminData = async () => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.push('/login'); return; }

        // 1. Fetch League
        const { data: league, error: leagueError } = await supabase
          .from('leagues')
          .select('*')
          .eq('id', id)
          .single();

        if (leagueError || !league) {
            console.error("League Fetch Error:", leagueError);
            alert("Error loading league data.");
            router.push('/');
            return;
        }

        // 2. ROBUST ADMIN CHECK (Fixes the "Access Denied" bug)
        const isCreator = (league.created_by === user.email) || (league.created_by === user.id);
        
        if (!isCreator) {
            alert("⛔ Access Denied: You are not the admin of this league.");
            router.push(`/league/${id}`);
            return;
        }

        setLeagueName(league.name);
        setLeagueImage(league.image_url || '');

        // 3. Fetch Config (Safely)
        // If league_events table doesn't exist yet, this won't crash the app
        const { data: config, error: configError } = await supabase
            .from('league_events')
            .select('event_type')
            .eq('league_id', id)
            .maybeSingle();
        
        if (config) setEventType(config.event_type);

        // 4. Fetch Members
        const { data: memberList, error: memberError } = await supabase
          .from('league_members')
          .select('*')
          .eq('league_id', id)
          .order('joined_at', { ascending: false });

        if (memberError) console.error("Member Fetch Error:", memberError);
        setMembers(memberList || []);

    } catch (err) {
        console.error("Admin Page Crash:", err);
        alert("Something went wrong loading the admin page.");
    } finally {
        // 5. ALWAYS Stop Loading (Fixes the "Stuck Loading" bug)
        setLoading(false);
    }
  };

  const handleUpdateCardType = async (type) => {
    setSyncing(true);
    setEventType(type); // Optimistic UI update

    // Ensure the league_events table exists in your Supabase first!
    const { error } = await supabase
        .from('league_events')
        .upsert({ 
            league_id: id, 
            event_type: type, 
            week_label: leagueName || "Weekly Event",
            is_active: true
        }, { onConflict: 'league_id' });

    if (error) {
        console.error("Sync Error:", error);
        alert("Sync Error: " + error.message + "\n\n(Note: Does the 'league_events' table exist in your database?)");
    }
    setSyncing(false);
  };

  const handleUpdateLeague = async (e) => {
    e.preventDefault();
    if (!leagueName.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('leagues').update({ name: leagueName, image_url: leagueImage }).eq('id', id);
    if (error) alert("Error: " + error.message);
    else alert("League updated!");
    setSaving(false);
  };

  const handleKick = async (memberId, userId) => {
    if (!confirm(`Kick ${userId}?`)) return;
    
    // Optimistic remove
    setMembers(prev => prev.filter(m => m.id !== memberId));
    
    const { error } = await supabase.from('league_members').delete().eq('id', memberId);
    
    if (error) { 
        alert("Failed to kick: " + error.message); 
        fetchAdminData(); // Revert on error
    }
  };

  if (loading) {
      return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center text-pink-600 gap-4">
            <span className="w-12 h-12 rounded-full border-4 border-pink-600 border-t-transparent animate-spin"></span>
            <div className="font-black uppercase italic tracking-widest animate-pulse">Entering Admin Mode...</div>
        </div>
      );
  }

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-8 font-sans selection:bg-pink-600 selection:text-white">
      
      {/* HEADER */}
      <div className="max-w-3xl mx-auto border-b border-gray-800 pb-6 mb-12 flex flex-col md:flex-row justify-between items-end gap-4">
        <div>
            <h1 className="text-4xl font-black text-pink-600 uppercase italic tracking-tighter leading-none">League Admin</h1>
            <p className="text-gray-500 text-[10px] font-bold uppercase tracking-[0.3em] mt-2 italic">
                {leagueName} • Manager Suite
            </p>
        </div>
        <Link href={`/league/${id}`} className="px-6 py-3 bg-gray-900 border border-gray-700 rounded-lg text-[10px] font-black uppercase hover:bg-white hover:text-black transition-all flex items-center gap-2">
            <span>←</span> Back to Octagon
        </Link>
      </div>

      {/* CARD SELECTION TOOL */}
      <div className="max-w-3xl mx-auto mb-16">
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-xs font-black text-white uppercase tracking-widest italic flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-pink-600 animate-pulse"></span>
                Step 1: Set Active Card Type
            </h2>
        </div>

        <div className="bg-gray-950 border border-gray-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
            {/* Background Effect */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-pink-900/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

            <p className="text-gray-500 text-[10px] uppercase font-bold tracking-widest mb-8 leading-relaxed max-w-md relative z-10">
                This dictates what members see on the dashboard. <span className="text-white">Main Card</span> filters out all prelims.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 mb-8 relative z-10">
                <button 
                    onClick={() => handleUpdateCardType('main_card')}
                    disabled={syncing}
                    className={`flex-1 py-5 px-4 rounded-2xl font-black text-xs uppercase transition-all tracking-tighter border ${eventType === 'main_card' ? 'bg-pink-600 border-pink-500 text-white shadow-xl shadow-pink-900/40 transform scale-[1.02]' : 'bg-black border-gray-800 text-gray-500 hover:text-white hover:border-gray-600'}`}
                >
                    Main Card Only <span className="block text-[9px] opacity-70 mt-1 font-normal tracking-normal">(Display Final 5 Fights)</span>
                </button>
                <button 
                    onClick={() => handleUpdateCardType('full_card')}
                    disabled={syncing}
                    className={`flex-1 py-5 px-4 rounded-2xl font-black text-xs uppercase transition-all tracking-tighter border ${eventType === 'full_card' ? 'bg-pink-600 border-pink-500 text-white shadow-xl shadow-pink-900/40 transform scale-[1.02]' : 'bg-black border-gray-800 text-gray-500 hover:text-white hover:border-gray-600'}`}
                >
                    Show Full Card <span className="block text-[9px] opacity-70 mt-1 font-normal tracking-normal">(Display All Fights)</span>
                </button>
            </div>

            <div className="flex items-center justify-between border-t border-gray-900 pt-6 relative z-10">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-600">
                    Live Status: <span className="text-pink-500 ml-2">{eventType === 'main_card' ? 'Main Card Only' : 'Full Card Active'}</span>
                </p>
                {syncing && <span className="text-[9px] font-black text-teal-400 uppercase animate-pulse italic tracking-widest">Syncing...</span>}
            </div>
        </div>
      </div>

      {/* GENERAL SETTINGS */}
      <div className="max-w-3xl mx-auto mb-16">
        <h2 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-6 italic">General Settings</h2>
        <form onSubmit={handleUpdateLeague} className="bg-gray-950 border border-gray-800 rounded-3xl p-8 space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
                <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">League Name</label>
                    <input 
                        type="text" 
                        value={leagueName} 
                        onChange={(e) => setLeagueName(e.target.value)} 
                        className="w-full bg-black border border-gray-800 p-4 rounded-xl text-white mt-2 focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none font-bold text-sm transition-all placeholder:text-gray-700" 
                    />
                </div>
                <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Logo URL</label>
                    <input 
                        type="text" 
                        value={leagueImage} 
                        onChange={(e) => setLeagueImage(e.target.value)} 
                        placeholder="https://..." 
                        className="w-full bg-black border border-gray-800 p-4 rounded-xl text-white mt-2 focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none text-xs font-mono transition-all placeholder:text-gray-700" 
                    />
                </div>
            </div>
            <div className="flex justify-end pt-2">
                <button type="submit" disabled={saving} className="bg-white text-black font-black uppercase text-[10px] px-8 py-4 rounded-xl hover:bg-pink-600 hover:text-white transition-all shadow-lg active:scale-95 disabled:opacity-50">
                    {saving ? 'Saving...' : 'Update Settings'}
                </button>
            </div>
        </form>
      </div>

      {/* MEMBER LIST */}
      <div className="max-w-3xl mx-auto">
        <h2 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-6 italic">Active Roster ({members.length})</h2>
        <div className="bg-gray-950 border border-gray-800 rounded-3xl overflow-hidden shadow-2xl">
            {members.length === 0 ? (
                <div className="p-12 text-center text-gray-600 italic text-sm font-bold uppercase tracking-widest">
                    No members found.
                </div>
            ) : (
                <div className="divide-y divide-gray-900">
                    {members.map((member) => (
                        <div key={member.id} className="p-6 flex justify-between items-center hover:bg-gray-900/50 transition-all group">
                            <div className="flex items-center gap-5">
                                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 flex items-center justify-center font-black text-sm text-gray-400 group-hover:text-white transition-colors">
                                    {member.user_id ? member.user_id[0].toUpperCase() : '?'}
                                </div>
                                <div>
                                    <div className="font-black text-sm text-gray-300 group-hover:text-white transition-colors">{member.user_id}</div>
                                    <div className="text-[9px] text-gray-600 uppercase font-black tracking-widest mt-0.5">
                                        Joined: {new Date(member.joined_at).toLocaleDateString()}
                                    </div>
                                </div>
                            </div>
                            <button 
                                onClick={() => handleKick(member.id, member.user_id)} 
                                className="px-4 py-2 bg-red-950/20 text-red-500 border border-red-900/30 rounded-lg text-[9px] font-black uppercase hover:bg-red-600 hover:text-white transition-all opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0"
                            >
                                Kick
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
      </div>

    </div>
  );
}