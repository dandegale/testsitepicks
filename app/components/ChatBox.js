'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function ChatBox({ league_id }) {
  // SAFETY: Force league_id to be NULL if it is undefined
  const activeLeagueId = league_id || null;

  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('Connecting...');
  const scrollRef = useRef(null);

  useEffect(() => {
    // 1. Get User
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();

    // 2. Fetch Initial Messages
    const fetchMessages = async () => {
      let query = supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(50);
      
      if (activeLeagueId) {
        query = query.eq('league_id', activeLeagueId);
      } else {
        query = query.is('league_id', null);
      }

      const { data, error } = await query;
      if (error) console.error("Error fetching messages:", error);
      if (data) setMessages(data);
    };
    fetchMessages();

    // 3. REAL-TIME SUBSCRIPTION (The "Forced Fresh" Fix)
    // We append Date.now() to the channel name.
    // This guarantees a UNIQUE channel ID every time you visit the page.
    // It prevents the browser from getting stuck on an old, dead connection.
    const uniqueChannelId = `chat_${activeLeagueId || 'global'}_${Date.now()}`;

    const channel = supabase
      .channel(uniqueChannelId) 
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages',
        filter: activeLeagueId ? `league_id=eq.${activeLeagueId}` : 'league_id=is.null'
      }, (payload) => {
        // Because the channel is unique, we can safely trust the filter above
        setMessages((prev) => [...prev, payload.new]);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setStatus('Live');
        if (status === 'CHANNEL_ERROR') setStatus('Error');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeLeagueId]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;

    // OPTIMISTIC UI: Add message immediately so it feels instant
    // We use a temporary ID so React doesn't complain about keys
    const tempId = Date.now();
    const tempMsg = {
        id: tempId,
        content: newMessage,
        user_id: user.email,
        league_id: activeLeagueId,
        created_at: new Date().toISOString()
    };

    // 1. Show it immediately (Optimistic Update)
    setMessages((prev) => [...prev, tempMsg]);
    setNewMessage('');

    // 2. Send to Database
    const { error } = await supabase.from('messages').insert([
      { 
        content: tempMsg.content, 
        user_id: tempMsg.user_id,
        league_id: tempMsg.league_id 
      }
    ]);

    if (error) {
        console.error('Error sending:', error);
        alert("Message Failed: " + error.message);
        // Rollback: Remove the message if it failed
        setMessages((prev) => prev.filter(m => m.id !== tempId));
    }
  };

  return (
    <div className="bg-gray-950 border border-gray-900 rounded-xl flex flex-col h-[400px]">
      {/* Header */}
      <div className="p-3 border-b border-gray-900 bg-black/50 rounded-t-xl flex justify-between items-center">
        <div className="flex flex-col">
            <span className="text-xs font-black uppercase text-gray-500 tracking-widest">
                {activeLeagueId ? 'League Chat' : 'Global Trash Talk'}
            </span>
            <span className="text-[9px] font-bold text-gray-600 uppercase">
                Status: <span className={status === 'Live' ? 'text-green-500' : 'text-yellow-500'}>{status}</span>
            </span>
        </div>
        <div className={`w-2 h-2 rounded-full ${status === 'Live' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
      </div>

      {/* Messages Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
            <div className="text-center text-gray-700 text-xs italic mt-10">
                Start the conversation...
            </div>
        )}
        {messages.map((msg) => {
          const isMe = user?.email === msg.user_id;
          return (
            <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
              <div className={`max-w-[80%] p-3 rounded-lg text-sm font-bold ${isMe ? 'bg-pink-600 text-white rounded-tr-none' : 'bg-gray-900 text-gray-300 rounded-tl-none'}`}>
                {msg.content}
              </div>
              <span className="text-[10px] text-gray-600 mt-1 uppercase font-black">
                {msg.user_id?.split('@')[0]}
              </span>
            </div>
          );
        })}
      </div>

      {/* Input Area */}
      <form onSubmit={handleSend} className="p-3 border-t border-gray-900 bg-black/50 rounded-b-xl flex gap-2">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder={user ? "Type your message..." : "Log in to chat"}
          disabled={!user}
          className="flex-1 bg-gray-900 border border-gray-800 text-white text-xs p-3 rounded focus:outline-none focus:border-pink-500 transition-colors"
        />
        <button 
            type="submit" 
            disabled={!user || !newMessage.trim()}
            className="bg-teal-600 text-black font-black uppercase text-xs px-4 rounded hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
            Send
        </button>
      </form>
    </div>
  );
}