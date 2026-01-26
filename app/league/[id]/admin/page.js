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

  useEffect(() => {
    if (id) fetchAdminData();
  }, [id]);

  const fetchAdminData = async () => {
    // 1. Get Current User
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }

    // 2. Check if User OWNS this league
    const { data: league } = await supabase
      .from('leagues')
      .select('*')
      .eq('id', id)
      .single();

    if (!league || league.created_by !== user.id) {
        alert("⛔ Access Denied: You are not the Admin of this league.");
        router.push(`/league/${id}`);
        return;
    }

    // Set Form Data
    setLeagueName(league.name);
    setLeagueImage(league.image_url || '');

    // 3. Fetch Members
    const { data: memberList } = await supabase
      .from('league_members')
      .select('*')
      .eq('league_id', id)
      .order('joined_at', { ascending: false });

    setMembers(memberList || []);
    setLoading(false);
  };

  // --- FEATURE 1: UPDATE SETTINGS ---
  const handleUpdateLeague = async (e) => {
    e.preventDefault();
    if (!leagueName.trim()) return;
    setSaving(true);

    const { error } = await supabase
        .from('leagues')
        .update({ name: leagueName, image_url: leagueImage })
        .eq('id', id);

    if (error) {
        alert("Error updating: " + error.message);
    } else {
        alert("League updated successfully!");
    }
    setSaving(false);
  };

  // --- FEATURE 2: KICK USER ---
  const handleKick = async (memberId, userId) => {
    if (!confirm(`Are you sure you want to kick ${userId}?`)) return;

    // Optimistic Update (Remove from UI immediately)
    setMembers(prev => prev.filter(m => m.id !== memberId));

    const { error } = await supabase
        .from('league_members')
        .delete()
        .eq('id', memberId);

    if (error) {
        alert("Kick failed: " + error.message);
        fetchAdminData(); // Revert on error
    }
  };

  if (loading) return <div className="min-h-screen bg-black text-white p-10 font-bold uppercase animate-pulse">Loading Admin Panel...</div>;

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-8">
      
      {/* HEADER */}
      <div className="max-w-3xl mx-auto border-b border-gray-800 pb-6 mb-8 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
            <h1 className="text-3xl font-black text-pink-600 uppercase italic tracking-tighter">
                Admin Settings
            </h1>
            <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mt-1">
                Manage League
            </p>
        </div>
        <Link href={`/league/${id}`} className="px-4 py-2 bg-gray-900 border border-gray-700 rounded text-xs font-bold uppercase hover:bg-gray-800 transition-colors">
            ← Back to Dashboard
        </Link>
      </div>

      {/* SECTION 1: LEAGUE SETTINGS */}
      <div className="max-w-3xl mx-auto mb-12">
        <h2 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4">
            General Settings
        </h2>
        <form onSubmit={handleUpdateLeague} className="bg-gray-950 border border-gray-800 rounded-xl p-6 space-y-4">
            <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase">League Name</label>
                <input 
                    type="text" 
                    value={leagueName} 
                    onChange={(e) => setLeagueName(e.target.value)}
                    className="w-full bg-black border border-gray-800 p-3 rounded text-white mt-1 focus:border-pink-500 outline-none font-bold"
                />
            </div>
            <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase">Logo Image URL</label>
                <input 
                    type="text" 
                    value={leagueImage} 
                    onChange={(e) => setLeagueImage(e.target.value)}
                    placeholder="https://..."
                    className="w-full bg-black border border-gray-800 p-3 rounded text-white mt-1 focus:border-pink-500 outline-none text-xs font-mono"
                />
            </div>
            <div className="flex justify-end">
                <button 
                    type="submit" 
                    disabled={saving}
                    className="bg-pink-600 text-white font-black uppercase text-xs px-6 py-3 rounded hover:bg-pink-500 disabled:opacity-50 transition-colors"
                >
                    {saving ? 'Saving...' : 'Save Changes'}
                </button>
            </div>
        </form>
      </div>

      {/* SECTION 2: MEMBER MANAGEMENT */}
      <div className="max-w-3xl mx-auto">
        <h2 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4">
            Member List ({members.length})
        </h2>

        <div className="bg-gray-950 border border-gray-800 rounded-xl overflow-hidden">
            {members.length === 0 ? (
                <div className="p-8 text-center text-gray-500 italic text-sm">
                    No members found.
                </div>
            ) : (
                <div className="divide-y divide-gray-800">
                    {members.map((member) => (
                        <div key={member.id} className="p-4 flex justify-between items-center hover:bg-gray-800/50 transition-colors">
                            <div className="flex items-center gap-4">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-500 to-blue-600 flex items-center justify-center font-bold text-xs text-white">
                                    {member.user_id[0].toUpperCase()}
                                </div>
                                <div>
                                    <div className="font-bold text-sm text-gray-200">{member.user_id}</div>
                                    <div className="text-[10px] text-gray-500 uppercase font-mono">
                                        Joined: {new Date(member.joined_at).toLocaleDateString()}
                                    </div>
                                </div>
                            </div>
                            
                            {/* Only show Kick button if it's NOT the admin themselves (optional logic, but safe) */}
                            <button 
                                onClick={() => handleKick(member.id, member.user_id)}
                                className="px-3 py-1 bg-red-900/20 text-red-500 border border-red-900/50 rounded text-[10px] font-black uppercase hover:bg-red-600 hover:text-white transition-all"
                            >
                                Kick User
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