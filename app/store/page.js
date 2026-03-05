'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { STORE_CASES } from '@/lib/cases';

// 🎯 COMPONENTS
import LeagueRail from '../components/LeagueRail';
import MobileNav from '../components/MobileNav';
import LogOutButton from '../components/LogOutButton';

// 💥 THE VFX ENGINE
import confetti from 'canvas-confetti';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const getRarityColor = (rarity) => {
    switch (rarity) {
        case 'Legendary': return '#eab308'; 
        case 'Epic': return '#db2777';      
        case 'Rare': return '#14b8a6';      
        default: return '#6b7280';          
    }
};

const getRarityStyle = (rarity) => {
    switch (rarity) {
        case 'Legendary': return { card: 'bg-gray-950 border-gray-800', text: 'text-yellow-500', badge: 'bg-yellow-500/20 text-yellow-500' };
        case 'Epic': return { card: 'bg-gray-950 border-gray-800', text: 'text-pink-500', badge: 'bg-pink-600/20 text-pink-500' };
        case 'Rare': return { card: 'bg-gray-950 border-gray-800', text: 'text-teal-400', badge: 'bg-teal-500/20 text-teal-400' };
        default: return { card: 'bg-gray-950 border-gray-800', text: 'text-gray-400', badge: 'bg-gray-800 text-gray-400' };
    }
};

// 🎯 GLOBAL AUDIO ENGINE
let audioCtx = null;

const playTickSound = () => {
    try {
        if (!audioCtx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            audioCtx = new AudioContext();
        }
        
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }

        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, audioCtx.currentTime); 
        osc.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.05);
        
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
        
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        osc.start();
        osc.stop(audioCtx.currentTime + 0.05);
    } catch (e) {
        console.error("Audio engine failed to start:", e);
    }
};

// 💥 PARTICLE EFFECT FUNCTIONS
const triggerLegendaryConfetti = () => {
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 200 };

    const randomInRange = (min, max) => Math.random() * (max - min) + min;

    const interval = setInterval(function() {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
            return clearInterval(interval);
        }

        const particleCount = 50 * (timeLeft / duration);
        confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }, colors: ['#eab308', '#fef08a', '#ca8a04', '#ffffff'] }));
        confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }, colors: ['#eab308', '#fef08a', '#ca8a04', '#ffffff'] }));
    }, 250);
};

const triggerEpicConfetti = () => {
    confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.6 },
        colors: ['#db2777', '#f472b6', '#9d174d', '#ffffff'],
        zIndex: 200,
        startVelocity: 45
    });
};

const CoinIcon = () => (
    <svg className="w-4 h-4 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const GridIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-pink-500">
        <rect x="3" y="3" width="7" height="7" rx="1"></rect>
        <rect x="14" y="3" width="7" height="7" rx="1"></rect>
        <rect x="14" y="14" width="7" height="7" rx="1"></rect>
        <rect x="3" y="14" width="7" height="7" rx="1"></rect>
    </svg>
);

const StatsIcon = () => (
    <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
);

const BoxIcon = () => (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
        <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
        <line x1="12" y1="22.08" x2="12" y2="12"></line>
    </svg>
);

export default function StorePage() {
    const router = useRouter();
    const [user, setUser] = useState(null);
    const [coins, setCoins] = useState(0);
    const [equippedTitle, setEquippedTitle] = useState(null);
    const [allItems, setAllItems] = useState([]);
    const [myInventory, setMyInventory] = useState([]);
    
    // 🎯 NEW: Layout States
    const [clientLeagues, setClientLeagues] = useState([]);
    const [showMobileMenu, setShowMobileMenu] = useState(false);

    const [selectedCase, setSelectedCase] = useState(null);
    const [isInventoryOpen, setIsInventoryOpen] = useState(false);

    const [isSpinning, setIsSpinning] = useState(false);
    const [wonItem, setWonItem] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [spinComplete, setSpinComplete] = useState(false);
    
    const [tapeItems, setTapeItems] = useState([]);
    const [isMounted, setIsMounted] = useState(false);

    const tapeRef = useRef(null);
    const tickIntervalRef = useRef(null);

    const TAPE_LENGTH = 70; 
    const WINNING_INDEX = 60; 
    const ITEM_WIDTH = 160; 
    const GAP_WIDTH = 16;
    const TOTAL_ITEM_SPACE = ITEM_WIDTH + GAP_WIDTH;

    // 🛡️ THE GATEKEEPER
    useEffect(() => {
        const checkAuth = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                router.replace('/login');
            }
        };
        checkAuth();
    }, [router]);

    const loadData = async (currentUser) => {
        const { data: profile } = await supabase.from('profiles').select('coins, equipped_title').eq('email', currentUser.email).single();
        if (profile) {
            setCoins(profile.coins || 0);
            setEquippedTitle(profile.equipped_title);
        }

        const { data: store } = await supabase.from('store_items').select('*');
        if (store) setAllItems(store);

        const { data: inv } = await supabase.from('user_inventory').select('item_id').eq('user_email', currentUser.email);
        if (inv && store) {
            const ownedIds = inv.map(i => i.item_id);
            const ownedItems = store.filter(s => ownedIds.includes(s.id));
            setMyInventory(ownedItems);
        }

        // 🎯 NEW: Fetch user's leagues for the rail
        const { data: memberships } = await supabase.from('league_members').select('leagues ( id, name, image_url, invite_code )').eq('user_id', currentUser.email);
        if (memberships) setClientLeagues(memberships.map(m => m.leagues).filter(Boolean));
    };

    useEffect(() => {
        setIsMounted(true);
        const initAuth = async () => {
            const { data: { user: currentUser } } = await supabase.auth.getUser();
            if (currentUser) {
                setUser(currentUser);
                loadData(currentUser);
            }
        };
        initAuth();
    }, []);

    useEffect(() => {
        if (selectedCase) {
            const visualPool = selectedCase.visualItems || [];
            if (visualPool.length > 0) {
                setTapeItems(Array.from({ length: 70 }, () => visualPool[Math.floor(Math.random() * visualPool.length)]));
            }
            if (tapeRef.current) {
                tapeRef.current.style.transition = 'none';
                tapeRef.current.style.transform = `translateX(-80px)`;
            }
        }
    }, [selectedCase]);

    const triggerSpinAudio = () => {
        let delay = 30; 
        let elapsed = 0;
        const tick = () => {
            playTickSound();
            elapsed += delay;
            delay = delay * 1.09; 
            if (elapsed < 6800) { 
                tickIntervalRef.current = setTimeout(tick, delay);
            }
        };
        tick();
    };

    const handleOpenCase = async () => {
        if (isSpinning || !selectedCase) return;
        if (!user) return alert("You must be logged in to open cases!");
        if (coins < selectedCase.price) return alert("Not enough coins!");
        if (myInventory.length >= allItems.length && allItems.length > 0) return alert("You already own everything in this crate!");
        
        setIsSpinning(true);
        setSpinComplete(false);
        setWonItem(null);
        setShowModal(false);
        setIsInventoryOpen(false);

        const visualPool = selectedCase.visualItems || [];
        const newTape = Array.from({ length: TAPE_LENGTH }, () => visualPool[Math.floor(Math.random() * visualPool.length)]);
        let actualWonItem = visualPool[8]; 
        let newBalance = coins - selectedCase.price;

        try {
            setCoins(newBalance);
            const res = await fetch('/api/open-case', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userEmail: user.email, caseId: selectedCase.id })
            });
            const text = await res.text();
            try {
                const data = JSON.parse(text);
                if (res.ok) {
                    actualWonItem = data.item;
                    newBalance = data.newBalance;
                } else {
                    alert(data.error);
                    setCoins(newBalance + selectedCase.price);
                    setIsSpinning(false);
                    return;
                }
            } catch (e) {}
        } catch (err) {}

        newTape[WINNING_INDEX] = actualWonItem;
        setTapeItems(newTape);

        if (tapeRef.current) {
            tapeRef.current.style.transition = 'none';
            tapeRef.current.style.transform = `translateX(-80px)`; 
        }

        setTimeout(() => {
            if (tapeRef.current) {
                triggerSpinAudio();

                const randomOffset = Math.floor(Math.random() * 60) - 30; 
                const stopPosition = -80 - (WINNING_INDEX * TOTAL_ITEM_SPACE) + randomOffset;

                tapeRef.current.style.transition = 'transform 7s cubic-bezier(0.1, 0.85, 0.2, 1)';
                tapeRef.current.style.transform = `translateX(${stopPosition}px)`;
            }

            setTimeout(() => {
                setSpinComplete(true);
                if (actualWonItem.rarity === 'Legendary') triggerLegendaryConfetti();
                else if (actualWonItem.rarity === 'Epic') triggerEpicConfetti();
            }, 7000);

            setTimeout(() => {
                setWonItem(actualWonItem);
                setCoins(newBalance); 
                setShowModal(true);
                setIsSpinning(false);
                loadData(user);
            }, 8500); 

        }, 100);
    };

    const handleEquipTitle = async (titleName) => {
        if (!user) return;
        setEquippedTitle(titleName);
        await supabase.from('profiles').update({ equipped_title: titleName }).eq('email', user.email);
        setShowModal(false);
        setSpinComplete(false);
    };

    if (!isMounted) return null;

    return (
        <div className="flex min-h-screen bg-black text-white overflow-hidden font-sans selection:bg-pink-500 selection:text-white">
            
            {/* 🎯 DESKTOP LEAGUE RAIL */}
            <div className="hidden md:block transition-all duration-500 ml-0">
                <LeagueRail initialLeagues={clientLeagues} />
            </div>

            {/* 🎯 MOBILE MENU DRAWER */}
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
                            <Link href="/how-it-works" className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-800/40 border border-transparent hover:border-gray-800/60 transition-all mb-1 group">
                                <svg className="w-5 h-5 text-gray-500 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                                <span className="text-sm font-bold text-gray-300 group-hover:text-white transition-colors">How It Works</span>
                            </Link>
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
                        </div>
                    </div>
                </div>
            </div>

            <main className="flex-1 h-screen overflow-y-auto overflow-x-hidden scrollbar-hide relative flex flex-col pb-24 md:pb-0 w-full max-w-[100vw]">
                
                {/* 🎯 UNIFIED HEADER WITH TEAL HAMBURGER */}
                <header className="sticky top-0 z-[60] w-full bg-black/80 backdrop-blur-xl border-b border-gray-800">
                    <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between w-full">
                        
                        <div className="flex items-center gap-3 md:gap-4">
                            <button 
                                onClick={() => setShowMobileMenu(true)} 
                                className="md:hidden p-1 text-teal-400 hover:text-teal-300 transition-colors drop-shadow-[0_0_5px_rgba(45,212,191,0.5)] animate-pulse"
                            >
                                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" /></svg>
                            </button>
                            
                            <Link href="/" className="text-xl md:text-2xl font-black italic text-white tracking-tighter uppercase">
                                FIGHT<span className="text-pink-600">IQ</span>
                            </Link>
                            
                            <div className="hidden md:block h-4 w-px bg-gray-800 mx-2"></div>
                            
                            <nav className="hidden lg:flex gap-6 text-[10px] font-black uppercase tracking-widest text-gray-500">
                                <Link href="/" className="hover:text-white transition-colors">Global Feed</Link>
                                <span className="text-pink-600 cursor-default">Store</span>
                            </nav>
                        </div>
                        
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-3 bg-gray-900 border border-gray-800 px-4 py-1.5 rounded-lg">
                                <CoinIcon />
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black uppercase text-gray-500 tracking-widest hidden sm:inline">Balance:</span>
                                    <span className="font-black italic text-white">{coins.toLocaleString()}</span>
                                </div>
                            </div>
                            <div className="hidden md:block">
                                <LogOutButton />
                            </div>
                        </div>
                    </div>
                </header>

                <div className="p-4 md:p-10 max-w-5xl mx-auto w-full">
                    {!selectedCase ? (
                        <div className="space-y-12 animate-in fade-in zoom-in-95 duration-300">
                            <div>
                                <h1 className="text-4xl md:text-6xl font-black italic uppercase tracking-tighter mb-2 leading-none text-white">
                                    THE <span className="text-pink-600">STORE</span>
                                </h1>
                                <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">
                                    Purchase cases to unlock exclusive walkout titles.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {STORE_CASES.map(crate => (
                                    <div 
                                        key={crate.id}
                                        onClick={() => setSelectedCase(crate)}
                                        className="group cursor-pointer bg-gray-950 border border-gray-800 hover:border-pink-500/50 rounded-2xl p-6 transition-all hover:shadow-[0_0_30px_rgba(236,72,153,0.15)] hover:-translate-y-1 relative overflow-hidden flex flex-col items-center text-center"
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-b from-pink-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                        
                                        <div className="relative w-32 h-32 mb-4 group-hover:scale-110 transition-transform drop-shadow-[0_0_15px_rgba(236,72,153,0.3)] flex items-center justify-center">
                                            {crate.image ? (
                                                <Image src={crate.image} alt={crate.name} fill className="object-contain" sizes="128px" />
                                            ) : (
                                                <BoxIcon />
                                            )}
                                        </div>

                                        <h3 className="text-2xl font-black italic uppercase tracking-tighter text-white mb-2">{crate.name}</h3>
                                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-6">{crate.description}</p>
                                        
                                        <div className="mt-auto w-full bg-gray-900 border border-gray-800 rounded-lg py-3 flex items-center justify-center gap-2 group-hover:bg-pink-600 group-hover:border-pink-500 transition-colors">
                                            <span className="font-black italic uppercase text-sm tracking-widest">View Case</span>
                                            <div className="w-px h-3 bg-white/30 mx-1"></div>
                                            <span className="font-black text-sm">{crate.price} COINS</span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {myInventory.length > 0 && (
                                <div className="mt-12 bg-[#0a0a0a] border border-gray-800 rounded-2xl overflow-hidden transition-all duration-300 shadow-xl">
                                    <button 
                                        onClick={() => setIsInventoryOpen(!isInventoryOpen)}
                                        className="w-full flex items-center justify-between p-5 md:p-6 hover:bg-white/[0.02] transition-colors"
                                    >
                                        <div className="flex items-center gap-3 md:gap-4">
                                            <GridIcon />
                                            <h2 className="text-xl md:text-2xl font-black uppercase italic tracking-tighter text-white mt-1">Your Collection</h2>
                                            <span className="border border-pink-500 text-pink-500 text-[9px] md:text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ml-2 shadow-[0_0_10px_rgba(236,72,153,0.2)]">
                                                {myInventory.length} Items
                                            </span>
                                        </div>
                                        
                                        <div className="bg-[#111] border border-gray-800 p-2 rounded-lg flex items-center justify-center hover:bg-[#1a1a1a] transition-colors">
                                            <svg 
                                                className={`w-4 h-4 text-gray-400 transition-transform duration-300 ${isInventoryOpen ? 'rotate-180' : ''}`} 
                                                fill="none" 
                                                viewBox="0 0 24 24" 
                                                stroke="currentColor"
                                            >
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </div>
                                    </button>

                                    <div className={`grid transition-all duration-300 ease-in-out ${isInventoryOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                                        <div className="overflow-hidden">
                                            <div className="p-6 border-t border-gray-800 bg-black/50">
                                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                                    {myInventory.map(item => {
                                                        const style = getRarityStyle(item.rarity);
                                                        const isEquipped = equippedTitle === item.name;
                                                        return (
                                                            <div key={item.id} onClick={() => handleEquipTitle(item.name)} className={`cursor-pointer hover:-translate-y-1 transition-transform border flex flex-col items-center justify-center p-4 rounded-xl h-24 relative overflow-hidden ${style.card} ${isEquipped ? 'ring-2 ring-white shadow-[0_0_15px_rgba(255,255,255,0.2)]' : 'opacity-80 hover:opacity-100'}`}>
                                                                <div className="absolute bottom-0 left-0 right-0 h-1" style={{ backgroundColor: getRarityColor(item.rarity) }}></div>
                                                                {isEquipped && <div className="absolute top-0 left-0 right-0 bg-white text-black text-[8px] font-black uppercase text-center tracking-widest py-0.5">Equipped</div>}
                                                                <span className={`text-xs font-black italic uppercase text-center leading-tight tracking-tighter ${style.text}`}>"{item.name}"</span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                    ) : (

                        <div className="flex flex-col items-center animate-in slide-in-from-right-8 duration-300">
                            
                            <div className="w-full flex justify-start mb-10">
                                <button 
                                    onClick={() => !isSpinning && setSelectedCase(null)}
                                    disabled={isSpinning}
                                    className="flex items-center gap-2 text-gray-500 hover:text-white font-bold uppercase tracking-widest text-[10px] transition-colors disabled:opacity-50"
                                >
                                    ← Back to Store
                                </button>
                            </div>

                            <div className="text-center w-full flex flex-col items-center mb-10">
                                <div className="relative w-40 h-40 mb-4 drop-shadow-[0_0_20px_rgba(236,72,153,0.4)] flex items-center justify-center">
                                    {selectedCase.image ? (
                                        <Image src={selectedCase.image} alt={selectedCase.name} fill className="object-contain" sizes="160px" />
                                    ) : (
                                        <BoxIcon />
                                    )}
                                </div>
                                
                                <h1 className="text-4xl md:text-6xl font-black italic uppercase tracking-tighter mb-1 leading-none text-white">
                                    {selectedCase.name}
                                </h1>
                                <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">
                                    {selectedCase.description}
                                </p>
                            </div>

                            <div className="w-full relative h-48 bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl flex items-center overflow-hidden mb-8">
                                <div className="absolute left-1/2 top-0 bottom-0 z-[100] transform -translate-x-1/2 pointer-events-none w-[20px] h-full flex flex-col items-center drop-shadow-[0_0_10px_rgba(234,179,8,1)]">
                                    <svg width="20" height="16" viewBox="0 0 20 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0"><path d="M10 16L0 0H20L10 16Z" fill="#eab308"/></svg>
                                    <div className="w-[4px] flex-1 bg-[#eab308]"></div>
                                    <svg width="20" height="16" viewBox="0 0 20 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0"><path d="M10 0L20 16H0L10 0Z" fill="#eab308"/></svg>
                                </div>

                                <div className="absolute left-0 top-0 bottom-0 w-16 md:w-32 bg-gradient-to-r from-gray-900 to-transparent z-40 pointer-events-none"></div>
                                <div className="absolute right-0 top-0 bottom-0 w-16 md:w-32 bg-gradient-to-l from-gray-900 to-transparent z-40 pointer-events-none"></div>

                                <div ref={tapeRef} className="flex items-center absolute left-1/2 flex-nowrap" style={{ gap: `${GAP_WIDTH}px` }}>
                                    {tapeItems.map((item, idx) => {
                                        const style = getRarityStyle(item.rarity);
                                        const rarityColor = getRarityColor(item.rarity);
                                        const isWinner = spinComplete && idx === WINNING_INDEX;
                                        const isLoser = spinComplete && idx !== WINNING_INDEX;

                                        return (
                                            <div 
                                                key={idx} 
                                                className={`shrink-0 border flex flex-col items-center justify-center p-4 rounded-xl relative transition-all duration-300 ease-in-out ${style.card} ${isWinner ? 'scale-110 z-50 ring-2 ring-white shadow-2xl brightness-110' : 'scale-100 z-10'} ${isLoser ? 'opacity-20 grayscale' : 'opacity-100'}`}
                                                style={{ width: `${ITEM_WIDTH}px`, height: '128px' }}
                                            >
                                                <div className={`absolute bottom-0 left-0 right-0 h-2 transition-all ${isWinner ? 'h-3' : ''}`} style={{ backgroundColor: rarityColor }}></div>
                                                <span className={`text-sm font-black italic uppercase text-center leading-tight tracking-tighter drop-shadow-md z-10 ${style.text}`}>"{item.name}"</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <button 
                                onClick={handleOpenCase}
                                disabled={isSpinning || coins < selectedCase.price || myInventory.length === allItems.length}
                                className="flex items-center gap-3 bg-pink-600 hover:bg-pink-500 text-white disabled:bg-gray-900 disabled:text-gray-600 disabled:border-gray-800 disabled:cursor-not-allowed border border-pink-400 px-12 py-4 rounded-xl font-black italic uppercase tracking-widest transition-all text-sm shadow-[0_0_20px_rgba(236,72,153,0.3)] disabled:shadow-none hover:scale-105 active:scale-95"
                            >
                                {isSpinning ? <span className="animate-pulse">Unlocking Container...</span> : 
                                    myInventory.length === allItems.length && allItems.length > 0 ? "All Items Owned" :
                                ( <><span>Unlock Container</span><div className="w-px h-4 bg-white/30 mx-1"></div><span>{selectedCase.price} COINS</span></> )
                                }
                            </button>

                            <div className="w-full border-t border-gray-800 mt-16 pt-16">
                                <div className="flex items-center gap-3 mb-6">
                                    <StatsIcon />
                                    <div>
                                        <h2 className="text-2xl font-black uppercase italic tracking-tighter text-white leading-none">Possible Drops</h2>
                                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">Odds: Common (70%) | Rare (20%) | Epic (8%) | Legendary (2%)</p>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-3">
                                    {allItems.map(item => {
                                        const isOwned = myInventory.some(i => i.id === item.id);
                                        return (
                                            <div key={item.id} className={`border border-gray-800 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest ${isOwned ? 'bg-gray-950 text-gray-600 line-through opacity-50' : 'bg-gray-900 text-gray-300'}`}>
                                                <span style={{ color: !isOwned ? getRarityColor(item.rarity) : undefined }} className={isOwned ? '' : 'drop-shadow-md'}>
                                                    {item.name}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {/* 🎯 UNIFIED MOBILE NAV */}
            <MobileNav onToggleLeagues={() => setShowMobileMenu(true)} />

            {/* WINNER MODAL */}
            {showModal && wonItem && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="relative w-full max-w-sm flex flex-col items-center text-center animate-in zoom-in-95 duration-300 bg-gray-950 border border-gray-800 rounded-2xl p-6 shadow-2xl">
                        
                        <div className="flex items-center gap-2 mb-6">
                            <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse"></span>
                            <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Item Unlocked</h3>
                        </div>

                        <div className={`w-full h-40 border border-b-4 flex flex-col items-center justify-center p-6 mb-8 rounded-xl shadow-inner relative overflow-hidden ${getRarityStyle(wonItem.rarity).card}`} style={{ borderBottomColor: getRarityColor(wonItem.rarity) }}>
                            <div className={`absolute top-2 right-2 border px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${getRarityStyle(wonItem.rarity).badge}`}>
                                {wonItem.rarity}
                            </div>
                            
                            <h2 className={`text-2xl font-black italic uppercase tracking-tighter leading-none drop-shadow-md ${getRarityStyle(wonItem.rarity).text}`}>
                                "{wonItem.name}"
                            </h2>
                        </div>

                        <div className="flex w-full gap-3">
                            <button 
                                onClick={() => { setShowModal(false); setSpinComplete(false); }}
                                className="flex-1 bg-gray-900 border border-gray-800 hover:bg-gray-800 text-gray-400 py-3 rounded-xl font-bold uppercase tracking-widest text-[10px] transition-colors"
                            >
                                Close
                            </button>
                            <button 
                                onClick={() => handleEquipTitle(wonItem.name)}
                                className="flex-1 bg-teal-600 hover:bg-teal-500 border border-teal-400 text-white py-3 rounded-xl font-black italic uppercase tracking-widest text-[10px] transition-all shadow-[0_0_15px_rgba(20,184,166,0.3)]"
                            >
                                Equip Nickname
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}