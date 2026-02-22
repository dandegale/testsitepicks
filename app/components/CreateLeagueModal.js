'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export default function CreateLeagueModal({ isOpen, onClose, onRefresh }) {
  const [name, setName] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [tab, setTab] = useState('join'); 
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);

  // 🎯 NEW: File Upload States
  const fileInputRef = useRef(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUser(user);
    };
    getUser();
  }, []);

  // 🎯 NEW: Supabase Storage Image Uploader
  const handleImageUpload = async (e) => {
    try {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            return alert("Must be an image file");
        }
        if (file.size > 5 * 1024 * 1024) { 
            return alert("Image must be under 5MB");
        }

        setUploadingImage(true);

        const fileExt = file.name.split('.').pop();
        // Use a random string for the ID since the league doesn't exist yet
        const tempId = Math.random().toString(36).substring(2, 10);
        const fileName = `temp-${tempId}-${Date.now()}.${fileExt}`;
        const filePath = `avatars/${fileName}`; 

        const { error: uploadError } = await supabase.storage
            .from('league-images')
            .upload(filePath, file, { cacheControl: '3600', upsert: true });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
            .from('league-images')
            .getPublicUrl(filePath);

        setImageUrl(publicUrl);

    } catch (error) {
        console.error("Upload Error:", error);
        alert("Upload failed: " + error.message);
    } finally {
        setUploadingImage(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCreate = async () => {
    if (!user) return alert("You must be logged in.");
    if (!name.trim()) return alert("League Name is required.");

    setLoading(true);
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    const { data: league, error: createError } = await supabase
      .from('leagues')
      .insert([{ 
        name, 
        image_url: imageUrl, 
        created_by: user.id, 
        invite_code: code 
      }])
      .select()
      .single();

    if (createError) {
        setLoading(false);
        return alert("Error creating league: " + createError.message);
    }

    await supabase.from('league_members').insert([{ 
        league_id: league.id, 
        user_id: user.email 
    }]);
    
    setLoading(false);
    onRefresh(); 
    onClose();
  };

  const handleJoin = async () => {
    if (!user) return alert("You must be logged in.");
    
    const cleanCode = inviteCode.trim().toUpperCase();
    if (!cleanCode) return alert("Please enter a code.");

    setLoading(true);
    
    const { data: league, error: searchError } = await supabase
        .from('leagues')
        .select('id, name')
        .eq('invite_code', cleanCode)
        .single();

    if (searchError || !league) {
        setLoading(false);
        return alert("Invalid Invite Code. Please double-check.");
    }

    const { error: joinError } = await supabase
        .from('league_members')
        .insert([{ 
            league_id: league.id, 
            user_id: user.email 
        }]);
    
    if (joinError) {
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
          <div className="space-y-6">
            <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-2">League Name</label>
                <input 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    placeholder="e.g. The Octagon Club" 
                    className="w-full bg-black border border-gray-800 p-4 rounded-xl text-white outline-none focus:border-pink-500 transition-all font-bold"
                />
            </div>
            
            {/* 🎯 THE NEW IMAGE UPLOAD UI */}
            <div>
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-2">League Logo</label>
                <div className="flex items-center gap-4">
                    {/* Preview Bubble */}
                    {imageUrl ? (
                        <div className="w-14 h-14 shrink-0 rounded-xl overflow-hidden border border-gray-700 bg-black">
                            <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
                        </div>
                    ) : (
                        <div className="w-14 h-14 shrink-0 rounded-xl bg-black border border-gray-700 flex items-center justify-center text-[10px] text-gray-600 font-black">
                            IMG
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
                            className="w-full bg-black border border-gray-700 hover:border-pink-500 p-4 rounded-xl text-[10px] font-black uppercase tracking-widest text-white transition-all disabled:opacity-50 flex justify-center items-center gap-2"
                        >
                            {uploadingImage ? (
                                <>
                                    <span className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin"></span>
                                    Uploading...
                                </>
                            ) : (
                                'Upload Image'
                            )}
                        </button>
                    </div>
                </div>
            </div>

            <button 
                onClick={handleCreate} 
                disabled={loading || uploadingImage}
                className="w-full py-4 mt-2 bg-pink-600 text-white font-black uppercase text-xs rounded-xl hover:bg-pink-500 disabled:opacity-50 transition-colors shadow-lg shadow-pink-900/20"
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
                    className="w-full bg-black border border-gray-800 p-4 rounded-xl text-white text-center font-mono text-3xl uppercase outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all tracking-widest placeholder-gray-800"
                />
            </div>
            <button 
                onClick={handleJoin} 
                disabled={loading}
                className="w-full py-4 bg-teal-500 text-black font-black uppercase text-xs rounded-xl hover:bg-teal-400 disabled:opacity-50 transition-colors shadow-lg shadow-teal-900/20"
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