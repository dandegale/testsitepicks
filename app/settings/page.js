'use client';

import { createClient } from '@supabase/supabase-js';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function Settings() {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const router = useRouter();

  useEffect(() => {
    getProfile();
  }, []);

  const getProfile = async () => {
    // 1. Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        router.push('/login');
        return;
    }
    setUser(user);

    // 2. Check if they already have a username
    const { data } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .single();

    if (data) {
        setUsername(data.username);
    }
    setLoading(false);
  };

  const updateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        username: username,
        updated_at: new Date(),
      });

    if (error) {
      alert(error.message);
    } else {
      alert('Identity Updated!');
      router.push('/'); // Send them back to the dashboard
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-black text-white p-8 flex flex-col items-center justify-center">
      <div className="max-w-md w-full">
        <h1 className="text-3xl font-bold text-red-600 uppercase mb-8 text-center tracking-tighter">
          Fighter Identity
        </h1>
        
        <div className="bg-gray-900 p-8 rounded-lg border border-gray-700 shadow-2xl">
            <label className="block text-gray-400 text-xs font-bold mb-3 uppercase tracking-widest">
                Choose Your Fight Name
            </label>
            <input
                type="text"
                value={username || ''}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. The Shredder"
                className="w-full bg-black text-white border border-gray-600 rounded p-4 mb-6 focus:border-red-600 outline-none font-bold text-xl text-center placeholder-gray-700"
            />
            
            <button
                onClick={updateProfile}
                disabled={loading}
                className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-4 rounded uppercase tracking-wider transition-colors shadow-lg shadow-red-900/50"
            >
                {loading ? 'Saving...' : 'Confirm Identity'}
            </button>
        </div>
        
        <div className="mt-8 text-center">
            <Link href="/" className="text-gray-500 hover:text-white text-xs uppercase font-bold tracking-widest">
                Cancel & Return to Fight Week
            </Link>
        </div>
      </div>
    </div>
  );
}