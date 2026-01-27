'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function LoginPage() {
  const router = useRouter();
  
  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState(''); // <--- NEW STATE
  const [loading, setLoading] = useState(false);
  
  // Auth Logic State
  const [mode, setMode] = useState('login'); // 'login' or 'signup'
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      if (mode === 'signup') {
        // --- SIGN UP LOGIC ---
        
        // 1. Validation
        if (!username.trim()) {
            throw new Error("Please create a username.");
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            // 2. Pass the real username here
            data: { username: username }, 
          },
        });

        if (error) throw error;

        // Check if session is null (implies email verification is required)
        if (data.user && !data.session) {
          setSuccessMsg("Account created! Check your email to confirm.");
        } else {
          router.push('/'); // Auto-login if no verification needed
        }

      } else {
        // --- LOGIN LOGIC ---
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;
        
        router.push('/');
      }
    } catch (error) {
      setErrorMsg(error.message || "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center relative overflow-hidden selection:bg-pink-600 selection:text-white font-sans">
      
      {/* --- BACKGROUND EFFECTS --- */}
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-gray-900 via-black to-black opacity-80"></div>
      <div className="absolute -top-[20%] -left-[10%] w-[500px] h-[500px] bg-pink-600/10 rounded-full blur-[100px]"></div>
      <div className="absolute top-[40%] -right-[10%] w-[400px] h-[400px] bg-teal-600/10 rounded-full blur-[100px]"></div>

      {/* --- LOGIN CARD --- */}
      <div className="relative z-10 w-full max-w-md p-4">
        
        <div className="bg-gray-950/80 backdrop-blur-xl border border-gray-800 rounded-2xl p-8 shadow-2xl shadow-black ring-1 ring-white/5 relative overflow-hidden transition-all duration-500">
            
            {/* Top accent line */}
            <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-pink-600 to-transparent opacity-50 transition-all ${loading ? 'animate-pulse' : ''}`}></div>

            {/* LOGO HEADER */}
            <div className="text-center mb-8">
                
                {/* BIGGER LOGO CONTAINER */}
                <div className="inline-block p-6 rounded-full bg-gray-900/50 border border-gray-800 mb-6 shadow-inner relative group">
                    <div className="absolute inset-0 bg-pink-600/20 rounded-full blur-md group-hover:bg-pink-600/40 transition-all"></div>
                    <img 
                        src="/fightiq-logo.jpg" 
                        alt="FightIQ" 
                        className="w-24 h-24 md:w-32 md:h-32 object-contain relative z-10 rounded-full" 
                    />
                </div>
                
                <h1 className="text-4xl md:text-5xl font-black italic text-white tracking-tighter uppercase mb-2 leading-none">
                    FIGHT<span className="text-pink-600">IQ</span>
                </h1>
                <p className="text-gray-500 text-[10px] font-bold uppercase tracking-[0.3em]">
                    {mode === 'login' ? 'Fantasy Management Suite' : 'Join the Roster'}
                </p>
            </div>

            {/* ERROR / SUCCESS MESSAGES */}
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

            {/* FORM */}
            <form onSubmit={handleAuth} className="space-y-5">
                
                {/* --- NEW: USERNAME FIELD (Signup Only) --- */}
                {mode === 'signup' && (
                  <div className="space-y-1 animate-in fade-in slide-in-from-left-2 duration-300">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Username</label>
                      <div className="relative group">
                          <input
                              type="text"
                              value={username}
                              onChange={(e) => setUsername(e.target.value)}
                              placeholder="Create your handle"
                              className="w-full bg-black/50 border border-gray-800 text-white text-sm px-4 py-3.5 rounded-lg focus:outline-none focus:border-pink-600 focus:ring-1 focus:ring-pink-600 transition-all placeholder:text-gray-700 font-bold"
                              required={mode === 'signup'}
                          />
                          <div className="absolute right-4 top-3.5 text-gray-700 group-focus-within:text-pink-600 transition-colors">
                            {/* User Icon SVG */}
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                            </svg>
                          </div>
                      </div>
                  </div>
                )}

                <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Email Address</label>
                    <div className="relative group">
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="manager@fightiq.com"
                            className="w-full bg-black/50 border border-gray-800 text-white text-sm px-4 py-3.5 rounded-lg focus:outline-none focus:border-pink-600 focus:ring-1 focus:ring-pink-600 transition-all placeholder:text-gray-700 font-bold"
                            required
                        />
                        <div className="absolute right-4 top-3.5 text-gray-700 group-focus-within:text-pink-600 transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                                <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                            </svg>
                        </div>
                    </div>
                </div>

                <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Password</label>
                    <div className="relative group">
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full bg-black/50 border border-gray-800 text-white text-sm px-4 py-3.5 rounded-lg focus:outline-none focus:border-pink-600 focus:ring-1 focus:ring-pink-600 transition-all placeholder:text-gray-700 font-bold"
                            required
                        />
                         <div className="absolute right-4 top-3.5 text-gray-700 group-focus-within:text-pink-600 transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                            </svg>
                        </div>
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-pink-700 to-pink-600 hover:from-pink-600 hover:to-pink-500 text-white py-4 rounded-lg font-black uppercase italic text-lg tracking-wider shadow-lg shadow-pink-900/30 hover:shadow-pink-900/50 transition-all transform active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed mt-4 group"
                >
                    {loading ? (
                        <span className="flex items-center justify-center gap-2">
                             <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                             Processing...
                        </span>
                    ) : (
                        <span className="flex items-center justify-center gap-2">
                            {mode === 'login' ? 'Enter The Octagon' : 'Create Account'}
                            <span className="group-hover:translate-x-1 transition-transform">→</span>
                        </span>
                    )}
                </button>
            </form>

            {/* TOGGLE MODE */}
            <div className="mt-8 text-center border-t border-gray-800 pt-6">
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-2">
                    {mode === 'login' ? "Don't have a profile?" : "Already managing a league?"}
                </p>
                <button 
                    onClick={() => {
                        setMode(mode === 'login' ? 'signup' : 'login');
                        setErrorMsg('');
                        setSuccessMsg('');
                    }}
                    className="text-xs font-black text-white uppercase tracking-widest hover:text-pink-500 transition-colors"
                >
                    {mode === 'login' ? 'Join the Fight' : 'Log In Here'}
                </button>
            </div>

        </div>
      </div>
      
      {/* Bottom corner branding */}
      <div className="absolute bottom-6 right-6 text-right hidden md:block opacity-30">
        <h2 className="text-4xl font-black italic text-gray-800 uppercase tracking-tighter">UFC</h2>
        <p className="text-[10px] font-bold text-gray-600 uppercase tracking-[0.5em]">Official Data</p>
      </div>

    </div>
  );
}