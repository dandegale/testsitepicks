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
  const [status, setStatus] = useState('Connecting...');
  const scrollRef = useRef(null);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();

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

    // Generate a unique channel per session to prevent zombie listeners
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
          // --- STRICT DE-DUPLICATION ---
          // Check by content AND user if ID isn't perfectly matched yet
          const exists = prev.some(m => 
            m.id === payload.new.id || 
            (m.content === payload.new.content && m.user_id === payload.new.user_id && typeof m.id === 'number')
          );
          if (exists) return prev;
          return [...prev, payload.new];
        });
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setStatus('Live');
      });

    return () => { supabase.removeChannel(channel); };
  }, [activeLeagueId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;

    // We use a numeric tempId so the subscription knows it's a "local" message
    const tempId = Date.now();
    const tempMsg = {
        id: tempId,
        content: newMessage,
        user_id: user.email,
        league_id: activeLeagueId,
        created_at: new Date().toISOString()
    };

    setMessages((prev) => [...prev, tempMsg]);
    setNewMessage('');

    const { data, error } = await supabase.from('messages').insert([
      { 
        content: tempMsg.content, 
        user_id: tempMsg.user_id,
        league_id: tempMsg.league_id 
      }
    ]).select();

    if (error) {
        setMessages((prev) => prev.filter(m => m.id !== tempId));
        alert("Failed to send.");
    } else if (data && data[0]) {
        // Immediately replace the temp message with the real one from DB
        setMessages((prev) => prev.map(m => m.id === tempId ? data[0] : m));
    }
  };

  return (
    <div className="bg-gray-950 border border-gray-900 rounded-xl flex flex-col h-[400px]">
      <div className="p-3 border-b border-gray-900 bg-black/50 rounded-t-xl flex justify-between items-center">
        <span className="text-xs font-black uppercase text-gray-500 tracking-widest">
            {activeLeagueId ? 'League Chat' : 'Global Trash Talk'}
        </span>
        <div className={`w-2 h-2 rounded-full ${status === 'Live' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide">
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

      <form onSubmit={handleSend} className="p-3 border-t border-gray-900 bg-black/50 rounded-b-xl flex gap-2">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type your message..."
          disabled={!user}
          className="flex-1 bg-gray-900 border border-gray-800 text-white text-xs p-3 rounded focus:outline-none focus:border-pink-500"
        />
        <button type="submit" className="bg-teal-600 text-black font-black uppercase text-xs px-4 rounded hover:bg-teal-500 disabled:opacity-50">
            Send
        </button>
      </form>
    </div>
  );
}