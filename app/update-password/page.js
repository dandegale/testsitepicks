'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    
    try {
      const { error } = await supabase.auth.updateUser({ password: password });
      if (error) throw error;
      
      setSuccessMsg("Password updated successfully! 👊");
      setTimeout(() => router.push('/'), 2000); // Send them to the dashboard after 2 seconds
    } catch (error) {
      setErrorMsg(error.message || "Failed to update password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center relative overflow-hidden selection:bg-teal-500 selection:text-white font-sans">
      
      {/* BACKGROUND EFFECTS */}
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-gray-900 via-black to-black opacity-80"></div>
      <div className="absolute top-[40%] -right-[10%] w-[500px] h-[500px] bg-teal-600/10 rounded-full blur-[100px]"></div>

      {/* UPDATE CARD */}
      <div className="relative z-10 w-full max-w-md p-4">
        <div className="bg-gray-950/80 backdrop-blur-xl border border-gray-800 rounded-2xl p-8 shadow-2xl shadow-black ring-1 ring-white/5 relative overflow-hidden">
            
            <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-teal-500 to-transparent opacity-50 transition-all ${loading ? 'animate-pulse' : ''}`}></div>

            <div className="text-center mb-8">
                <h1 className="text-3xl font-black italic uppercase tracking-tighter text-teal-400 mb-1">
                    New Password
                </h1>
                <p className="text-gray-500 text-[10px] font-bold uppercase tracking-[0.2em]">
                    Secure your account
                </p>
            </div>

            {errorMsg && (
                <div className="mb-6 p-4 bg-red-950/30 border border-red-900/50 rounded-lg text-red-400 text-xs font-bold text-center animate-in fade-in slide-in-from-top-2">
                    ⚠ {errorMsg}
                </div>
            )}
            {successMsg && (
                <div className="mb-6 p-4 bg-teal-950/30 border border-teal-900/50 rounded-lg text-teal-400 text-xs font-bold text-center animate-in fade-in slide-in-from-top-2">
                    {successMsg}
                </div>
            )}

            <form onSubmit={handleUpdate} className="space-y-5">
                <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">New Password</label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-black/50 border border-gray-800 text-white text-sm px-4 py-3.5 rounded-lg focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all placeholder:text-gray-700 font-bold"
                        required
                        minLength={6}
                    />
                </div>

                <button
                    type="submit"
                    disabled={loading || successMsg}
                    className="w-full bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-400 text-white py-4 rounded-lg font-black uppercase italic text-lg tracking-wider shadow-lg shadow-teal-900/30 transition-all active:scale-[0.99] disabled:opacity-50 mt-4"
                >
                    {loading ? 'Saving...' : 'Save Password'}
                </button>
            </form>
        </div>
      </div>
    </div>
  );
}