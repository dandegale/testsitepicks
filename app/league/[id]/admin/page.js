'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
// 1. IMPORT TOAST
import Toast from '../../../components/Toast'; 

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
  
  // Editable Fields
  const [leagueName, setLeagueName] = useState('');
  const [leagueImage, setLeagueImage] = useState('');
  
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Card Selection
  const [eventType, setEventType] = useState('full_card');
  const [syncing, setSyncing] = useState(false);

  // --- NEW STATES FOR TOAST & DELETE ---
  const [toast, setToast] = useState(null); 
  const [deleteConfirm, setDeleteConfirm] = useState(false); 

  useEffect(() => {
    if (id) fetchAdminData();
  }, [id]);

  const fetchAdminData = async () => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.push('/login'); return; }

        const { data: league, error: leagueError } = await supabase
          .from('leagues')
          .select('*')
          .eq('id', id)
          .single();

        if (leagueError || !league) {
            router.push('/');
            return;
        }

        // Strict Admin Check
        const isCreator = (league.created_by === user.email) || (league.created_by === user.id);
        if (!isCreator) {
            router.push(`/league/${id}`);
            return;
        }

        setLeagueName(league.name || '');
        setLeagueImage(league.image_url || '');

        const { data: config } = await supabase
            .from('league_events')
            .select('event_type')
            .eq('league_id', id)
            .maybeSingle();
        
        if (config) setEventType(config.event_type);

        const { data: memberList } = await supabase
          .from('league_members')
          .select('*')
          .eq('league_id', id)
          .order('joined_at', { ascending: false });

        setMembers(memberList || []);

    } catch (err) {
        console.error("Admin Page Error:", err);
    } finally {
        setLoading(false);
    }
  };

  const handleUpdateCardType = async (type) => {
    setSyncing(true);
    setEventType(type); 
    await supabase.from('league_events').upsert({ 
        league_id: id, 
        event_type: type, 
        week_label: leagueName || "Weekly Event",
        is_active: true
    }, { onConflict: 'league_id' });
    setSyncing(false);
    setToast({ message: "Card Settings Saved", type: "success" });
  };

  const handleUpdateLeague = async (e) => {
    e.preventDefault();
    if (!leagueName.trim()) {
        setToast({ message: "League name required", type: "error" });
        return;
    }

    setSaving(true);
    const { error } = await supabase
        .from('leagues')
        .update({ name: leagueName, image_url: leagueImage })
        .eq('id', id);

    if (error) {
        setToast({ message: error.message, type: "error" });
    } else {
        setToast({ message: "League Updated", type: "success" });
    }
    setSaving(false);
  };

  // --- NEW DELETE LOGIC (NO BROWSER ALERT) ---
  const handleDeleteLeague = async () => {
    // 1. If not yet confirmed, ask for confirmation via Toast
    if (!deleteConfirm) {
        setDeleteConfirm(true);
        setToast({ message: "⚠️ Press again to CONFIRM DELETE", type: "error" });
        
        // Reset the button after 3 seconds if they don't click
        setTimeout(() => setDeleteConfirm(false), 3000);
        return;
    }

    // 2. Second click: Actually Delete
    setDeleting(true);
    const { error } = await supabase.from('leagues').delete().eq('id', id);

    if (error) {
        setToast({ message: error.message, type: "error" });
        setDeleting(false);
        setDeleteConfirm(false);
    } else {
        setToast({ message: "League Deleted", type: "success" });
        router.push('/');
    }
  };

  const handleKick = async (memberId) => {
    if (!confirm("Kick this member?")) return; // Kept browser alert for kicking (less critical)
    setMembers(prev => prev.filter(m => m.id !== memberId));
    await supabase.from('league_members').delete().eq('id', memberId);
    setToast({ message: "Member Kicked", type: "info" });
  };

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-pink-600 font-bold animate-pulse">LOADING ADMIN SUITE...</div>;

  return (
    <div className="min-h-screen bg-black text-white p-6 md:p-12 font-sans selection:bg-pink-600 pb-32">
      
      {/* HEADER */}
      <div className="max-w-4xl mx-auto border-b border-gray-800 pb-8 mb-12 flex justify-between items-end">
        <div>
            <h1 className="text-5xl font-black text-pink-600 uppercase italic tracking-tighter">Admin Suite</h1>
            <p className="text-gray-500 font-bold uppercase tracking-widest mt-2">{leagueName}</p>
        </div>
        <Link href={`/league/${id}`} className="px-6 py-3 bg-gray-900 rounded-lg text-xs font-black uppercase hover:bg-white hover:text-black transition-all">
            ← Back to Dashboard
        </Link>
      </div>

      {/* 1. EDIT LEAGUE DETAILS */}
      <div className="max-w-4xl mx-auto mb-16">
        <h2 className="text-sm font-black text-white uppercase tracking-widest mb-6 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-pink-600"></span> 
            Edit League Details
        </h2>
        
        <form onSubmit={handleUpdateLeague} className="bg-gray-900 border border-gray-800 rounded-3xl p-8 shadow-xl">
            <div className="grid md:grid-cols-2 gap-8 mb-8">
                <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">League Name</label>
                    <input 
                        type="text" 
                        value={leagueName} 
                        onChange={(e) => setLeagueName(e.target.value)} 
                        className="w-full bg-black border border-gray-700 p-4 rounded-xl text-white font-bold focus:border-pink-500 outline-none transition-all"
                        placeholder="e.g. Dana's Contenders"
                    />
                </div>
                <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Logo Image URL</label>
                    <input 
                        type="text" 
                        value={leagueImage} 
                        onChange={(e) => setLeagueImage(e.target.value)} 
                        className="w-full bg-black border border-gray-700 p-4 rounded-xl text-white font-mono text-xs focus:border-pink-500 outline-none transition-all"
                        placeholder="https://..."
                    />
                </div>
            </div>
            <div className="flex justify-end">
                <button 
                    type="submit" 
                    disabled={saving}
                    className="bg-white text-black font-black uppercase text-xs px-8 py-4 rounded-xl hover:bg-pink-600 hover:text-white transition-all disabled:opacity-50"
                >
                    {saving ? 'Saving...' : 'Save Changes'}
                </button>
            </div>
        </form>
      </div>

      {/* 2. CARD SETTINGS */}
      <div className="max-w-4xl mx-auto mb-16">
        <h2 className="text-sm font-black text-gray-500 uppercase tracking-widest mb-6">Card Configuration</h2>
        <div className="bg-gray-950 border border-gray-800 rounded-3xl p-8 flex gap-4">
            <button 
                onClick={() => handleUpdateCardType('main_card')}
                className={`flex-1 py-4 rounded-xl font-bold text-xs uppercase border ${eventType === 'main_card' ? 'bg-pink-600 text-white border-pink-500' : 'bg-black text-gray-500 border-gray-800'}`}
            >
                Main Card Only
            </button>
            <button 
                onClick={() => handleUpdateCardType('full_card')}
                className={`flex-1 py-4 rounded-xl font-bold text-xs uppercase border ${eventType === 'full_card' ? 'bg-pink-600 text-white border-pink-500' : 'bg-black text-gray-500 border-gray-800'}`}
            >
                Full Card
            </button>
        </div>
      </div>

      {/* 3. MEMBER MANAGEMENT */}
      <div className="max-w-4xl mx-auto mb-16">
        <h2 className="text-sm font-black text-gray-500 uppercase tracking-widest mb-6">Roster ({members.length})</h2>
        <div className="bg-gray-900 border border-gray-800 rounded-3xl overflow-hidden">
            {members.map(m => (
                <div key={m.id} className="p-6 border-b border-gray-800 flex justify-between items-center last:border-0 hover:bg-gray-800/50">
                    <span className="font-bold text-gray-300">{m.user_id}</span>
                    <button onClick={() => handleKick(m.id)} className="text-[10px] font-black uppercase text-red-500 hover:text-white bg-red-950/30 hover:bg-red-600 px-4 py-2 rounded-lg transition-all">
                        Kick
                    </button>
                </div>
            ))}
        </div>
      </div>

      {/* 4. DANGER ZONE (DELETE) */}
      <div className="max-w-4xl mx-auto pb-24">
        <h2 className="text-sm font-black text-red-600 uppercase tracking-widest mb-6">Danger Zone</h2>
        <div className={`border rounded-3xl p-8 flex justify-between items-center transition-all duration-300 ${deleteConfirm ? 'bg-red-950/30 border-red-500 shadow-[0_0_30px_rgba(220,38,38,0.2)]' : 'bg-red-950/10 border-red-900/30'}`}>
            <div>
                <h3 className="font-bold text-white mb-1">Delete League</h3>
                <p className="text-xs text-red-400">
                    {deleteConfirm ? "⚠️ ARE YOU SURE? THIS CANNOT BE UNDONE." : "Permanently remove this league and all data."}
                </p>
            </div>
            
            {/* --- UPDATED DELETE BUTTON --- */}
            <button 
                onClick={handleDeleteLeague}
                disabled={deleting}
                className={`font-black uppercase text-xs px-6 py-3 rounded-xl transition-all duration-200 ${
                    deleteConfirm 
                    ? "bg-red-600 text-white scale-105 shadow-xl animate-pulse" 
                    : "bg-red-900/20 text-red-500 border border-red-900 hover:bg-red-900/40"
                }`}
            >
                {deleting ? 'Deleting...' : (deleteConfirm ? 'CONFIRM DELETE?' : 'Delete League')}
            </button>
        </div>
      </div>

      {/* --- RENDER TOAST --- */}
      {toast && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast(null)} 
        />
      )}

    </div>
  );
}