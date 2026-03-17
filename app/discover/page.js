'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import LeagueRail from '../components/LeagueRail';
import LogOutButton from '../components/LogOutButton';
import MobileNav from '../components/MobileNav';
import Toast from '../components/Toast';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export default function DiscoverLeaguesPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [leagues, setLeagues] = useState([]);
    const [userLeagues, setUserLeagues] = useState(new Set());
    
    // 🎯 NEW: Added states for the menu and user's specific leagues
    const [clientLeagues, setClientLeagues] = useState([]);
    const [showMobileMenu, setShowMobileMenu] = useState(false);
    
    const [searchQuery, setSearchQuery] = useState('');
    const [sortOrder, setSortOrder] = useState('desc'); 
    
    const [toast, setToast] = useState(null);
    const [customAlert, setCustomAlert] = useState(null);
    const [joiningLeagueId, setJoiningLeagueId] = useState(null);

    const showAlert = (title, message) => {
        setCustomAlert({ type: 'alert', title, message });
    };

    useEffect(() => {
        const fetchDiscoverData = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            
            let myLeagueIds = new Set();
            if (user) {
                // 🎯 FIX: Updated select to also grab the league details for the menu
                const { data: memberships } = await supabase
                    .from('league_members')
                    .select('league_id, leagues ( id, name, image_url, invite_code )')
                    .eq('user_id', user.email);
                    
                if (memberships) {
                    myLeagueIds = new Set(memberships.map(m => m.league_id));
                    setClientLeagues(memberships.map(m => m.leagues).filter(Boolean));
                }
            }
            setUserLeagues(myLeagueIds);

            const { data: leaguesData, error: leaguesError } = await supabase
                .from('leagues')
                .select('*')
                .eq('is_public', true); 

            if (leaguesError) console.error("Error fetching leagues:", leaguesError);
            
            const { data: membersData } = await supabase.from('league_members').select('league_id');
            
            if (leaguesData) {
                const strictlyPublicLeagues = leaguesData.filter(league => 
                    league.is_public === true || 
                    league.is_public === 'true' || 
                    league.is_public === 'TRUE'
                );

                const memberCounts = {};
                if (membersData) {
                    membersData.forEach(m => {
                        memberCounts[m.league_id] = (memberCounts[m.league_id] || 0) + 1;
                    });
                }

                const processedLeagues = strictlyPublicLeagues.map(league => {
                    return {
                        ...league,
                        memberCount: memberCounts[league.id] || 0,
                        averageScore: parseFloat(league.average_score) || 0 
                    };
                });

                setLeagues(processedLeagues);
            }
            setLoading(false);
        };

        fetchDiscoverData();
    }, []);

    const filteredLeagues = useMemo(() => {
        let result = [...leagues];
        
        if (searchQuery.trim() !== '') {
            result = result.filter(l => l.name?.toLowerCase().includes(searchQuery.toLowerCase()));
        }

        result.sort((a, b) => {
            if (sortOrder === 'desc') return b.memberCount - a.memberCount;
            return a.memberCount - b.memberCount;
        });

        return result;
    }, [leagues, searchQuery, sortOrder]);

    const podiumLeagues = useMemo(() => {
        if (leagues.length === 0) return [null, null, null];
        
        const sortedByScore = [...leagues].sort((a, b) => {
            if (b.averageScore !== a.averageScore) {
                return b.averageScore - a.averageScore;
            }
            return b.memberCount - a.memberCount;
        });
        
        const top3 = sortedByScore.slice(0, 3);
        
        return [
            top3[1] || null, 
            top3[0] || null, 
            top3[2] || null
        ];
    }, [leagues]);

    const handleJoinLeague = async (leagueId, leagueName) => {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user || !user.email) {
            router.push('/login');
            return;
        }

        setJoiningLeagueId(leagueId);
        const { error: joinError } = await supabase.from('league_members').insert([{ league_id: leagueId, user_id: user.email }]);

        if (joinError) {
            if (joinError.code === '23505') {
                showAlert("Already Joined", `You are already in "${leagueName}"!`);
                router.push(`/league/${leagueId}`);
            } else {
                showAlert("Error", "Error joining: " + joinError.message);
            }
            setJoiningLeagueId(null);
        } else {
            router.push(`/league/${leagueId}`);
        }
    };

    const PodiumStep = ({ league, rank }) => {
        if (!league) return <div className="w-[32%] max-w-[160px] opacity-0 pointer-events-none"></div>;

        let heightClass = "h-28 md:h-40";
        let colorClass = "bg-gradient-to-t from-amber-950/80 to-amber-900/30 border-t-[3px] md:border-t-4 border-amber-600";
        let textClass = "text-amber-500";
        let ringClass = "ring-amber-600";
        let shadowClass = "shadow-[0_-10px_30px_rgba(217,119,6,0.15)]";
        let rankLabel = "3RD";
        
        if (rank === 1) {
            heightClass = "h-40 md:h-56";
            colorClass = "bg-gradient-to-t from-yellow-900/80 to-yellow-600/30 border-t-[3px] md:border-t-4 border-yellow-400";
            textClass = "text-yellow-400";
            ringClass = "ring-yellow-400";
            shadowClass = "shadow-[0_-15px_40px_rgba(250,204,21,0.25)]";
            rankLabel = "1ST";
        } else if (rank === 2) {
            heightClass = "h-32 md:h-48";
            colorClass = "bg-gradient-to-t from-gray-800/90 to-gray-600/30 border-t-[3px] md:border-t-4 border-gray-300";
            textClass = "text-gray-300";
            ringClass = "ring-gray-300";
            shadowClass = "shadow-[0_-10px_30px_rgba(209,213,219,0.15)]";
            rankLabel = "2ND";
        }

        return (
            <div className="flex flex-col items-center justify-end w-[32%] max-w-[160px] group cursor-pointer transition-transform duration-300 hover:-translate-y-2 relative" onClick={() => router.push(`/league/${league.id}`)}>
                
                <div className={`w-12 h-12 md:w-20 md:h-20 rounded-full bg-black ring-[2px] md:ring-4 ${ringClass} overflow-hidden -mb-6 md:-mb-10 z-20 relative flex items-center justify-center shadow-xl group-hover:scale-105 transition-transform`}>
                    {league.image_url ? (
                        <img src={league.image_url} alt={league.name} className="absolute inset-0 w-full h-full object-cover" />
                    ) : (
                        <span className="text-[10px] md:text-sm font-black uppercase text-gray-500">LG</span>
                    )}
                </div>

                <div className={`w-full ${heightClass} ${colorClass} ${shadowClass} rounded-t-lg md:rounded-t-xl flex flex-col items-center pt-8 md:pt-14 pb-2 md:pb-3 px-1 md:px-2 relative z-10`}>
                    <span className={`font-black italic text-lg md:text-4xl leading-none mb-1 drop-shadow-md ${textClass}`}>
                        {rankLabel}
                    </span>
                    <span className="text-[7px] md:text-[11px] font-bold text-center uppercase tracking-widest text-white truncate w-full mb-auto px-1">
                        {league.name}
                    </span>
                    <div className="bg-black/60 px-1 py-1 md:px-2 md:py-2 rounded md:rounded-lg border border-white/10 w-full flex flex-col items-center backdrop-blur-sm mt-2">
                        <span className="text-[6px] md:text-[8px] uppercase tracking-widest text-gray-400">Avg Score</span>
                        <span className="text-[10px] md:text-sm font-black text-white leading-none mt-0.5">{league.averageScore}</span>
                    </div>
                </div>
            </div>
        );
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center font-sans">
                <span className="w-12 h-12 rounded-full border-4 border-pink-600 border-t-transparent animate-spin mb-4"></span>
                <div className="text-xs font-black uppercase tracking-widest text-pink-600">Loading Leagues...</div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen bg-black text-white font-sans selection:bg-pink-500 selection:text-white">
            
            {/* 🎯 DESKTOP LEAGUE RAIL */}
            <div className="hidden md:block transition-all duration-500 ml-0 z-[70]">
                <LeagueRail initialLeagues={clientLeagues} />
            </div>

            {/* 🎯 THE DARK MOBILE DRAWER */}
            <div className={`fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm transition-opacity duration-300 md:hidden ${showMobileMenu ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={() => setShowMobileMenu(false)}>
                <div className={`absolute left-0 top-0 bottom-0 w-[80%] max-w-[300px] bg-[#0b0e14] border-r border-gray-800/60 shadow-2xl transform transition-transform duration-300 flex flex-col ${showMobileMenu ? 'translate-x-0' : '-translate-x-full'}`} onClick={e => e.stopPropagation()}>
                    <div className="p-5 border-b border-gray-800/60 flex justify-between items-center bg-black/20">
                        <span className="text-xl font-black italic text-white tracking-tighter uppercase">
                            FIGHT<span className="text-pink-600">IQ</span>
                        </span>
                        <button onClick={() => setShowMobileMenu(false)} className="text-gray-500 hover:text-white transition-colors p-2 -mr-2">✕</button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-6 custom-scrollbar">
                        <div>
                            <p className="text-[10px] font-black text-pink-500 uppercase tracking-widest mb-4">Your Leagues</p>
                            <div className="flex flex-col gap-2">
                                {clientLeagues && clientLeagues.length > 0 ? (
                                    clientLeagues.map(league => (
                                        <Link key={league.id} href={`/league/${league.id}`} className="flex items-center gap-4 p-3 rounded-xl bg-[#12161f] hover:bg-gray-800 border border-gray-800/60 hover:border-pink-500/50 transition-all group">
                                            <div className="w-10 h-10 rounded-full bg-black border border-gray-700 flex items-center justify-center text-[10px] font-black text-gray-400 group-hover:text-pink-500 group-hover:border-pink-500 transition-all shrink-0 overflow-hidden relative">
                                                {league.image_url ? <img src={league.image_url} alt={league.name} className="w-full h-full object-cover" /> : (league.name ? league.name.substring(0,2).toUpperCase() : 'LG')}
                                            </div>
                                            <span className="font-bold text-sm text-gray-300 group-hover:text-white truncate">{league.name}</span>
                                        </Link>
                                    ))
                                ) : (
                                    <div className="p-4 border border-dashed border-gray-800 rounded-xl text-center bg-black/20">
                                        <p className="text-gray-600 text-[10px] font-bold uppercase tracking-widest mb-2">No Leagues Joined</p>
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        <div className="border-t border-gray-800/60 pt-6 mt-2 pb-6">
                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3">Main Menu</p>
                            <Link href="/" className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-800/40 border border-transparent hover:border-gray-800/60 transition-all mb-1 group">
                                <svg className="w-5 h-5 text-gray-500 group-hover:text-yellow-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                                <span className="text-sm font-bold text-gray-300 group-hover:text-white transition-colors">Dashboard</span>
                            </Link>
                            <Link href="/leaderboard" className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-800/40 border border-transparent hover:border-gray-800/60 transition-all mb-1 group">
                                <svg className="w-5 h-5 text-gray-500 group-hover:text-yellow-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v1a5 5 0 01-5 5h-1v2h4v2H5v-2h4v-2H8a5 5 0 01-5-5v-1a2 2 0 012-2m14 0V5a2 2 0 00-2-2H5a2 2 0 00-2 2v6" /></svg>
                                <span className="text-sm font-bold text-gray-300 group-hover:text-white transition-colors">Global Leaderboard</span>
                            </Link>
                            <Link href="/profile" className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-800/40 border border-transparent hover:border-gray-800/60 transition-all mb-1 group">
                                <svg className="w-5 h-5 text-gray-500 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                <span className="text-sm font-bold text-gray-300 group-hover:text-white transition-colors">My Profile</span>
                            </Link>
                            <Link href="/store" className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-800/40 border border-transparent hover:border-pink-500/30 transition-all group">
                                <svg className="w-5 h-5 text-gray-500 group-hover:text-pink-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                                <span className="text-sm font-bold text-gray-300 group-hover:text-pink-500 transition-colors">Item Store</span>
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            <main className="flex-1 h-screen overflow-y-auto pb-24 relative flex flex-col w-full">
                
                <header className="sticky top-0 z-[60] w-full bg-black/80 backdrop-blur-xl border-b border-gray-800">
                    <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between w-full">
                        <div className="flex items-center gap-3 md:gap-4">
                            {/* 🎯 THE TEAL HAMBURGER BUTTON */}
                            <button 
                                onClick={() => setShowMobileMenu(true)} 
                                className="md:hidden p-1 text-teal-400 hover:text-teal-300 transition-colors drop-shadow-[0_0_5px_rgba(45,212,191,0.5)] animate-pulse"
                            >
                                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" /></svg>
                            </button>
                            
                            <Link href="/" className="text-xl md:text-2xl font-black italic text-white tracking-tighter uppercase">FIGHT<span className="text-pink-600">IQ</span></Link>
                            <div className="hidden md:block h-4 w-px bg-gray-800 mx-2"></div>
                            <nav className="hidden lg:flex gap-6 text-[10px] font-black uppercase tracking-widest text-gray-500">
                                <Link href="/" className="hover:text-white transition-colors">Global Feed</Link>
                                <span className="text-pink-600 cursor-default">Discover Leagues</span>
                            </nav>
                        </div>
                        <div className="flex items-center gap-3">
                            <Link href="/profile" className="hidden lg:flex bg-gray-900 hover:bg-gray-800 border border-gray-700 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-gray-300 hover:text-white transition-all items-center gap-2">
                                <span>My Profile</span>
                            </Link>
                            <div className="hidden md:block"><LogOutButton /></div>
                        </div>
                    </div>
                </header>

                {/* HERO PODIUM */}
                <div className="relative w-full bg-[#0b0e14] border-b border-gray-800 overflow-hidden pt-10 md:pt-12 pb-8 md:pb-10">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-pink-900/20 via-black to-black z-0"></div>
                    
                    <div className="max-w-5xl mx-auto px-2 md:px-4 relative z-10">
                        <div className="text-center mb-8 md:mb-10">
                            <h1 className="text-3xl md:text-5xl font-black italic uppercase tracking-tighter mb-1 md:mb-2">League For League</h1>
                            <p className="text-[9px] md:text-xs text-gray-400 font-bold uppercase tracking-[0.2em]">Highest Scoring Public Leagues</p>
                        </div>

                        <div className="flex justify-center items-end gap-1.5 sm:gap-4 md:gap-8 mt-10 md:mt-16 mx-auto max-w-2xl px-1">
                            <PodiumStep league={podiumLeagues[0]} rank={2} />
                            <PodiumStep league={podiumLeagues[1]} rank={1} />
                            <PodiumStep league={podiumLeagues[2]} rank={3} />
                        </div>
                    </div>
                </div>

                {/* DISCOVER LIST */}
                <div className="max-w-4xl mx-auto px-4 md:px-6 py-10 md:py-12 w-full">
                    
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                        <div>
                            <h2 className="text-xl md:text-2xl font-black italic uppercase tracking-tighter flex items-center gap-3">
                                <svg className="w-5 h-5 md:w-6 md:h-6 text-pink-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Public Directory
                            </h2>
                        </div>

                        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                            <div className="relative w-full md:w-72 group">
                                <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4 group-focus-within:text-pink-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                <input 
                                    type="text" 
                                    placeholder="Search leagues..." 
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full h-12 bg-gray-900/50 border border-gray-800 hover:border-gray-700 focus:border-pink-500 focus:bg-gray-900 focus:ring-1 focus:ring-pink-500/50 rounded-xl pl-11 pr-4 text-sm font-bold text-white placeholder-gray-600 outline-none transition-all shadow-sm"
                                />
                            </div>
                            <div className="relative w-full sm:w-56 shrink-0 group">
                                <select 
                                    value={sortOrder}
                                    onChange={(e) => setSortOrder(e.target.value)}
                                    className="w-full h-12 appearance-none bg-gray-900/50 border border-gray-800 hover:border-gray-700 focus:border-teal-500 focus:bg-gray-900 focus:ring-1 focus:ring-teal-500/50 rounded-xl pl-5 pr-10 text-sm font-bold text-gray-300 outline-none cursor-pointer transition-all shadow-sm"
                                >
                                    <option value="desc">Most Members (Default)</option>
                                    <option value="asc">Fewest Members</option>
                                </select>
                                <svg className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4 pointer-events-none group-hover:text-gray-300 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    <div className="divide-y divide-gray-800/60 mt-4 border-t border-gray-800/60">
                        {filteredLeagues.map(league => {
                            const isMember = userLeagues.has(league.id);
                            
                            return (
                                <div key={league.id} className="flex items-center gap-2 md:gap-5 py-4 group hover:bg-gray-900/40 px-1 md:px-3 -mx-1 md:-mx-3 rounded-2xl transition-colors">
                                    
                                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-black border border-gray-700 group-hover:border-gray-500 overflow-hidden shrink-0 relative transition-colors shadow-inner">
                                        {league.image_url ? (
                                            <img src={league.image_url} alt={league.name} className="absolute inset-0 w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-gray-900">
                                                <span className="text-[10px] font-black text-gray-500">LG</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0 flex flex-col justify-center pl-1">
                                        <div className="flex items-center gap-2 mb-0.5 md:mb-1">
                                            <h3 className="text-sm md:text-base font-black text-white uppercase italic leading-tight truncate group-hover:text-pink-400 transition-colors" title={league.name}>
                                                {league.name}
                                            </h3>
                                        </div>
                                        
                                        <div className="flex items-center gap-2 md:gap-3 text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-gray-500">
                                            <span className="flex items-center gap-1 md:gap-1.5">
                                                <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                                                {league.memberCount} <span className="hidden sm:inline">Members</span>
                                            </span>
                                            <span className="text-gray-800 font-black">•</span>
                                            <span className="flex items-center gap-1 md:gap-1.5 text-teal-500">
                                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                                                {league.averageScore} <span className="hidden sm:inline">Avg Pts</span>
                                            </span>
                                        </div>
                                    </div>

                                    <div className="shrink-0 ml-1">
                                        {isMember ? (
                                            <Link href={`/league/${league.id}`} className="px-3 md:px-6 py-2 rounded-lg font-black uppercase tracking-widest text-[9px] md:text-[10px] bg-gray-900 border border-gray-700 text-gray-400 hover:bg-gray-800 hover:text-white transition-colors block text-center min-w-[60px] md:min-w-[70px] shadow-sm">
                                                View
                                            </Link>
                                        ) : (
                                            <button 
                                                onClick={() => handleJoinLeague(league.id, league.name)}
                                                disabled={joiningLeagueId === league.id}
                                                className="px-3 md:px-6 py-2 rounded-lg font-black uppercase tracking-widest text-[9px] md:text-[10px] bg-teal-500/10 text-teal-400 border border-teal-500/30 hover:bg-teal-500 hover:text-black transition-all disabled:opacity-50 min-w-[60px] md:min-w-[70px] shadow-sm hover:shadow-[0_0_15px_rgba(20,184,166,0.3)]"
                                            >
                                                {joiningLeagueId === league.id ? '...' : 'Join'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {filteredLeagues.length === 0 && (
                        <div className="w-full text-center py-16 mt-4 bg-black border border-dashed border-gray-800 rounded-2xl shadow-inner">
                            <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">No public leagues found matching your criteria.</p>
                        </div>
                    )}
                </div>
            </main>

            {/* 🎯 LINKED TO OPEN THE DRAWER */}
            <div className="md:hidden">
                <MobileNav onToggleLeagues={() => setShowMobileMenu(true)} />
            </div>

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            {customAlert && (
                <div className="fixed inset-0 z-[300] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-gray-950 border border-gray-800 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6">
                            <h3 className="text-xl font-black italic uppercase tracking-tighter text-white mb-2">{customAlert.title}</h3>
                            <p className="text-gray-400 text-sm font-medium leading-relaxed">{customAlert.message}</p>
                        </div>
                        <div className="p-4 bg-black/50 border-t border-gray-900 flex gap-3 justify-end">
                            {customAlert.type === 'confirm' && (
                                <button onClick={() => setCustomAlert(null)} className="px-5 py-2.5 rounded-lg font-bold text-xs uppercase tracking-widest text-gray-500 hover:text-white hover:bg-gray-900 transition-colors">
                                    Cancel
                                </button>
                            )}
                            <button onClick={() => { if (customAlert.onConfirm) customAlert.onConfirm(); else setCustomAlert(null); }} className="px-5 py-2.5 rounded-lg font-black text-xs uppercase tracking-widest bg-pink-600 text-white hover:bg-pink-500 transition-colors shadow-[0_0_15px_rgba(236,72,153,0.3)]">
                                {customAlert.confirmText || 'OK'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}