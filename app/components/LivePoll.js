"use client";

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export default function LivePoll({ userEmail }) {
    const [poll, setPoll] = useState(null);
    const [votes, setVotes] = useState([]);
    const [userVote, setUserVote] = useState(null);
    const [timeLeft, setTimeLeft] = useState('');

    useEffect(() => {
        fetchActivePoll();
        
        const channel = supabase.channel('live-votes')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'poll_votes' }, (payload) => {
                // Ensure we only update votes for the currently displayed poll
                setVotes(current => {
                    if (poll && payload.new.poll_id === poll.id) {
                        return [...current, payload.new];
                    }
                    return current;
                });
            })
            .subscribe();

        return () => supabase.removeChannel(channel);
    }, [poll?.id]);

    // ⏳ THE TIMER ENGINE: Calculates time remaining and self-destructs when 0
    useEffect(() => {
        if (!poll || !poll.expires_at) return;

        const timer = setInterval(() => {
            const now = new Date().getTime();
            const expireTime = new Date(poll.expires_at).getTime();
            const distance = expireTime - now;

            if (distance <= 0) {
                clearInterval(timer);
                setPoll(null); // 💥 Destroys the component from the UI!
            } else {
                const h = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const m = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
                const s = Math.floor((distance % (1000 * 60)) / 1000);
                
                // Formats it neatly, omitting hours if less than 1 hour remains
                setTimeLeft(h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`);
            }
        }, 1000);

        return () => clearInterval(timer);
    }, [poll]);

    async function fetchActivePoll() {
        const now = new Date().toISOString();
        
        const { data } = await supabase
            .from('polls')
            .select('*')
            .eq('is_active', true)
            .gte('expires_at', now) // 🎯 Supabase strictly filters out expired polls
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(); 
            
        if (data) {
            setPoll(data);
            fetchVotes(data.id);
        } else {
            setPoll(null);
        }
    }

    async function fetchVotes(pollId) {
        const { data } = await supabase.from('poll_votes').select('*').eq('poll_id', pollId);
        setVotes(data || []);
        const mine = data?.find(v => v.user_email === userEmail);
        if (mine) setUserVote(mine.selected_option);
    }

    const castVote = async (option) => {
        if (userVote || !userEmail) return;
        
        setUserVote(option);
        setVotes(current => [...current, { poll_id: poll.id, user_email: userEmail, selected_option: option }]);

        const { error } = await supabase.from('poll_votes').insert({ 
            poll_id: poll.id, 
            user_email: userEmail, 
            selected_option: option 
        });

        if (error) {
            setUserVote(null);
            setVotes(current => current.filter(v => v.user_email !== userEmail));
        }
    };

    // 🎯 If no poll exists OR the timer expired, it renders absolutely nothing!
    if (!poll) return null;

    return (
        <div className="w-full bg-gray-950 border border-gray-900 rounded-xl overflow-hidden p-6 shadow-lg flex flex-col relative">
            <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-pink-500 animate-pulse"></span>
                    <h3 className="text-xs font-black text-white uppercase tracking-[0.2em]">Community Poll</h3>
                </div>
                {/* Display the Live Countdown */}
                <div className="bg-gray-900 border border-gray-800 px-3 py-1 rounded-md">
                    <span className="text-[10px] font-mono text-pink-500 font-bold">{timeLeft || 'Loading...'}</span>
                </div>
            </div>
            
            <h4 className="text-lg font-black italic uppercase tracking-tighter text-white mb-6 leading-tight">
                {poll.question}
            </h4>
            
            <div className="space-y-3">
                {poll.options.map(option => {
                    const count = votes.filter(v => v.selected_option === option).length;
                    const percent = votes.length > 0 ? Math.round((count / votes.length) * 100) : 0;
                    const isSelected = userVote === option;
                    
                    return (
                        <button 
                            key={option}
                            onClick={() => castVote(option)}
                            disabled={!!userVote}
                            className={`relative w-full text-left p-4 rounded-xl border transition-all overflow-hidden ${
                                userVote 
                                    ? (isSelected ? 'border-pink-500 bg-pink-500/10' : 'border-gray-800 bg-gray-900/50 opacity-60') 
                                    : 'border-gray-800 bg-gray-900 hover:border-pink-500/50 hover:bg-gray-800'
                            }`}
                        >
                            {userVote && (
                                <div 
                                    className={`absolute left-0 top-0 bottom-0 transition-all duration-1000 ease-out ${isSelected ? 'bg-pink-600/30' : 'bg-gray-700/30'}`} 
                                    style={{ width: `${percent}%` }}
                                ></div>
                            )}
                            
                            <div className="relative z-10 flex justify-between items-center">
                                <span className={`font-bold text-sm ${isSelected ? 'text-white' : 'text-gray-300'}`}>
                                    {option}
                                </span>
                                {userVote && (
                                    <span className={`text-xs font-black ${isSelected ? 'text-pink-500' : 'text-gray-500'}`}>
                                        {percent}%
                                    </span>
                                )}
                            </div>
                        </button>
                    );
                })}
            </div>
            
            <div className="mt-4 pt-4 border-t border-gray-800 text-right">
                <span className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">
                    {votes.length} Total Votes
                </span>
            </div>
        </div>
    );
}