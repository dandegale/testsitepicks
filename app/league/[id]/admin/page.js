'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
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

  const [toast, setToast] = useState(null); 
  const [deleteConfirm, setDeleteConfirm] = useState(false); 

  // 🎯 NEW: File Upload States & Refs
  const fileInputRef = useRef(null);
  const [uploadingImage, setUploadingImage] = useState(false);

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

  // 🎯 NEW: Supabase Storage Image Uploader
  const handleImageUpload = async (e) => {
    try {
        const file = e.target.files[0];
        if (!file) return;

        // Validate file type and size
        if (!file.type.startsWith('image/')) {
            setToast({ message: "Must be an image file", type: "error" });
            return;
        }
        if (file.size > 5 * 1024 * 1024) { // 5MB limit
            setToast({ message: "Image must be under 5MB", type: "error" });
            return;
        }

        setUploadingImage(true);
        setToast({ message: "Uploading image...", type: "info" });

        // Create a unique file name to avoid overwriting
        const fileExt = file.name.split('.').pop();
        const fileName = `${id}-${Date.now()}.${fileExt}`;
        const filePath = `avatars/${fileName}`; // Folders keep it organized

        // Upload to the 'league-images' bucket
        const { error: uploadError } = await supabase.storage
            .from('league-images')
            .upload(filePath, file, { cacheControl: '3600', upsert: true });

        if (uploadError) throw uploadError;

        // Get the Public URL for the image
        const { data: { publicUrl } } = supabase.storage
            .from('league-images')
            .getPublicUrl(filePath);

        // Update local state to show the preview immediately
        setLeagueImage(publicUrl);
        setToast({ message: "Image uploaded! Click Save.", type: "success" });

    } catch (error) {
        console.error("Upload Error:", error);
        setToast({ message: "Upload failed: " + error.message, type: "error" });
    } finally {
        setUploadingImage(false);
        // Reset the input so they can select the same file again if they want
        if (fileInputRef.current) fileInputRef.current.value = '';
    }
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

  const handleDeleteLeague = async () => {
    if (!deleteConfirm) {
        setDeleteConfirm(true);
        setToast({ message: "⚠️ Press again to CONFIRM DELETE", type: "error" });
        setTimeout(() => setDeleteConfirm(false), 3000);
        return;
    }

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
    if (!confirm("Kick this member?")) return; 
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
                
                {/* 🎯 NEW: Image Upload UI */}
                <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">League Logo</label>
                    <div className="flex items-center gap-4">
                        {/* Preview Bubble */}
                        {leagueImage ? (
                            <img src={leagueImage} alt="League Preview" className="w-16 h-16 rounded-xl object-cover border border-gray-700 shrink-0" />
                        ) : (
                            <div className="w-16 h-16 rounded-xl bg-black border border-gray-700 flex items-center justify-center text-[10px] text-gray-600 font-black shrink-0">
                                NO IMG
                            </div>
                        )}
                        
                        {/* Upload Button */}
                        <div className="flex-1">
                            <input 
                                type="file" 
                                accept="image/*"
                                onChange={handleImageUpload}
                                ref={fileInputRef}
                                className="hidden" 
                            />
                            <button 
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploadingImage}
                                className="w-full bg-black border border-gray-700 hover:border-pink-500 p-4 rounded-xl text-xs font-bold text-white transition-all disabled:opacity-50 flex justify-center items-center gap-2"
                            >
                                {uploadingImage ? (
                                    <>
                                        <span className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin"></span>
                                        Uploading...
                                    </>
                                ) : (
                                    'Upload Custom Logo'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            
            <div className="flex justify-end pt-4 border-t border-gray-800">
                <button 
                    type="submit" 
                    disabled={saving || uploadingImage}
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