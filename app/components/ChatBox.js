'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function ChatBox({ league_id }) {
  const activeLeagueId = league_id || null;

  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [user, setUser] = useState(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    // 1. Get User
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();

    // 2. Fetch History
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

    // 3. Subscribe
    const channelId = `chat_${activeLeagueId || 'global'}_${Date.now()}`;
    const channel = supabase
      .channel(channelId) 
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages',
        filter: activeLeagueId ? `league_id=eq.${activeLeagueId}` : 'league_id=is.null'
      }, (payload) => {
        setMessages((prev) => {
          const exists = prev.some(m => m.id === payload.new.id);
          if (exists) return prev;
          return [...prev, payload.new];
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeLeagueId]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;

    // Grab username from metadata, or fallback to email stub
    const currentUsername = user.user_metadata?.username || user.email.split('@')[0];

    // Optimistic Update
    const tempId = Date.now();
    const tempMsg = {
        id: tempId,
        content: newMessage,
        user_id: user.email, 
        username: currentUsername, // NEW: Add username to local state
        league_id: activeLeagueId,
        created_at: new Date().toISOString()
    };

    setMessages((prev) => [...prev, tempMsg]);
    setNewMessage('');

    // Send to DB
    const { data, error } = await supabase.from('messages').insert([
      { 
        content: tempMsg.content, 
        user_id: tempMsg.user_id,
        username: currentUsername, // NEW: Save to DB
        league_id: tempMsg.league_id 
      }
    ]).select();

    if (error) {
        console.error("Send Error:", error);
        setMessages((prev) => prev.filter(m => m.id !== tempId));
        alert("Failed to send message.");
    } else if (data && data[0]) {
        setMessages((prev) => prev.map(m => m.id === tempId ? data[0] : m));
    }
  };

  return (
    <div className="flex flex-col h-full bg-black/20">
      
      {/* MESSAGES AREA */}
      <div 
        ref={scrollRef} 
        className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-gray-800 scrollbar-track-transparent"
      >
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-700 text-xs uppercase font-bold tracking-widest opacity-50">
            Quiet in here...
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = user?.email === msg.user_id;
            
            // NEW LOGIC: Try msg.username first, fallback to email split
            const displayName = msg.username || (msg.user_id ? msg.user_id.split('@')[0] : 'Unknown');

            return (
              <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-[85%] rounded-lg px-3 py-2 text-xs font-medium ${isMe ? 'bg-pink-600 text-white' : 'bg-gray-800 text-gray-300'}`}>
                  {msg.content}
                </div>
                <span className="text-[9px] text-gray-600 font-bold uppercase mt-1 tracking-wider">
                  {isMe ? 'You' : displayName}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* INPUT AREA */}
      <form onSubmit={handleSend} className="p-3 bg-gray-950 border-t border-gray-800 flex gap-2">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder={user ? "Talk trash..." : "Log in to chat"}
          disabled={!user}
          className="flex-1 bg-gray-900 border border-gray-700 text-white text-xs px-3 py-2 rounded focus:outline-none focus:border-pink-600 transition-colors placeholder:text-gray-600 font-bold disabled:opacity-50"
        />
        <button 
          type="submit" 
          disabled={!user || !newMessage.trim()}
          className="bg-teal-600 hover:bg-teal-500 text-white text-[10px] font-black uppercase px-4 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
            SEND
        </button>
      </form>
    </div>
  );
}