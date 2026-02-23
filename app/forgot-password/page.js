'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleReset = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/update-password`,
      });

      if (error) throw error;
      setSuccessMsg("Reset link sent! Check your email. 📧");
    } catch (error) {
      setErrorMsg(error.message || "Failed to send reset link.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center relative overflow-hidden selection:bg-pink-600 selection:text-white font-sans">
      
      {/* BACKGROUND EFFECTS */}
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-gray-900 via-black to-black opacity-80"></div>
      <div className="absolute -top-[20%] -left-[10%] w-[500px] h-[500px] bg-pink-600/10 rounded-full blur-[100px]"></div>

      {/* RECOVERY CARD */}
      <div className="relative z-10 w-full max-w-md p-4">
        <div className="bg-gray-950/80 backdrop-blur-xl border border-gray-800 rounded-2xl p-8 shadow-2xl shadow-black ring-1 ring-white/5 relative overflow-hidden">
            
            <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-pink-600 to-transparent opacity-50 transition-all ${loading ? 'animate-pulse' : ''}`}></div>

            <div className="text-center mb-8">
                <h1 className="text-3xl font-black italic uppercase tracking-tighter text-white mb-1">
                    Recover Account
                </h1>
                <p className="text-gray-500 text-[10px] font-bold uppercase tracking-[0.2em]">
                    Enter your email to reset
                </p>
            </div>

            {errorMsg && (
                <div className="mb-6 p-4 bg-red-950/30 border border-red-900/50 rounded-lg text-red-400 text-xs font-bold text-center animate-in fade-in slide-in-from-top-2">
                    ⚠ {errorMsg}
                </div>
            )}
            {successMsg && (
                <div className="mb-6 p-4 bg-teal-950/30 border border-teal-900/50 rounded-lg text-teal-400 text-xs font-bold text-center animate-in fade-in slide-in-from-top-2">
                    ✓ {successMsg}
                </div>
            )}

            <form onSubmit={handleReset} className="space-y-5">
                <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Email Address</label>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="manager@fightiq.com"
                        className="w-full bg-black/50 border border-gray-800 text-white text-sm px-4 py-3.5 rounded-lg focus:outline-none focus:border-pink-600 focus:ring-1 focus:ring-pink-600 transition-all placeholder:text-gray-700 font-bold"
                        required
                    />
                </div>

                <button
                    type="submit"
                    disabled={loading || successMsg}
                    className="w-full bg-gradient-to-r from-pink-700 to-pink-600 hover:from-pink-600 hover:to-pink-500 text-white py-4 rounded-lg font-black uppercase italic text-lg tracking-wider shadow-lg shadow-pink-900/30 transition-all active:scale-[0.99] disabled:opacity-50 mt-4"
                >
                    {loading ? 'Sending...' : 'Send Reset Link'}
                </button>
            </form>

            <div className="mt-8 text-center border-t border-gray-800 pt-6">
                <Link href="/login" className="text-xs font-black text-gray-500 uppercase tracking-widest hover:text-white transition-colors">
                    ← Back to Login
                </Link>
            </div>
        </div>
      </div>
    </div>
  );
}