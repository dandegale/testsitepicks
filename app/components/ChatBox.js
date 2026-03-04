'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

// 🎯 IMPORT STORE CASES FOR RARITY LOOKUP
import { STORE_CASES } from '@/lib/cases';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// 🎯 HELPER TO COLORIZE TITLES BASED ON RARITY
const getRarityTextStyle = (rarity) => {
    switch (rarity) {
        case 'Legendary': return 'text-yellow-500 drop-shadow-[0_0_5px_rgba(234,179,8,0.8)]';
        case 'Epic': return 'text-pink-500 drop-shadow-[0_0_5px_rgba(219,39,119,0.8)]';
        case 'Rare': return 'text-teal-400 drop-shadow-[0_0_5px_rgba(20,184,166,0.8)]';
        default: return 'text-gray-400'; 
    }
};

export default function ChatBox({ league_id }) {
  const activeLeagueId = league_id || null;

  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [user, setUser] = useState(null);
  
  // 🎯 NEW: Store profiles so we can map avatars/titles to messages
  const [profilesMap, setProfilesMap] = useState({});
  const fetchedEmails = useRef(new Set());
  
  const scrollRef = useRef(null);

  // 🎯 DYNAMIC PROFILE FETCHER
  const loadProfiles = async (emails) => {
      const missing = emails.filter(e => e && !fetchedEmails.current.has(e));
      if (missing.length === 0) return;

      missing.forEach(e => fetchedEmails.current.add(e));

      const { data, error } = await supabase
          .from('profiles')
          .select('email, username, avatar_url, equipped_title')
          .in('email', missing);

      if (data) {
          setProfilesMap(prev => {
              const next = { ...prev };
              data.forEach(p => { next[p.email] = p; });
              return next;
          });
      }
  };

  useEffect(() => {
    // 1. Get User
    const initUser = async () => {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser) {
          setUser(currentUser);
          loadProfiles([currentUser.email]); // Load current user's profile instantly
      }
    };
    initUser();

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
      if (data) {
          setMessages(data);
          // Load profiles for everyone in the chat history
          const uniqueEmails = [...new Set(data.map(m => m.user_id))];
          loadProfiles(uniqueEmails);
      }
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
        // Immediately load the profile of the person who just sent the message
        loadProfiles([payload.new.user_id]);
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

    const currentUsername = user.user_metadata?.username || user.email.split('@')[0];

    // Optimistic Update
    const tempId = Date.now();
    const tempMsg = {
        id: tempId,
        content: newMessage,
        user_id: user.email, 
        username: currentUsername, 
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
        username: currentUsername, 
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
    <div className="flex flex-col h-full bg-gray-950/50">
      
      {/* MESSAGES AREA */}
      <div 
        ref={scrollRef} 
        className="flex-1 overflow-y-auto p-4 space-y-5 scrollbar-thin scrollbar-thumb-gray-800 scrollbar-track-transparent"
      >
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-700 text-xs uppercase font-bold tracking-widest opacity-50">
            Quiet in here...
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = user?.email === msg.user_id;
            const profile = profilesMap[msg.user_id] || {};
            
            // Resolve Display Data
            const displayName = profile.username || msg.username || (msg.user_id ? msg.user_id.split('@')[0] : 'Unknown');
            const avatarUrl = profile.avatar_url;
            const equippedTitle = profile.equipped_title;
            
            // Check Rarity for Color
            let titleRarity = 'Common';
            if (equippedTitle) {
                for (const crate of STORE_CASES) {
                    const item = crate.visualItems?.find(i => i.name === equippedTitle);
                    if (item) {
                        titleRarity = item.rarity;
                        break;
                    }
                }
            }

            // Avatar Bubble Component
            const AvatarNode = () => (
                <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-900 border border-gray-700 flex-shrink-0 flex items-center justify-center text-[10px] font-black text-gray-500 shadow-md">
                    {avatarUrl ? (
                        <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                    ) : (
                        displayName.charAt(0).toUpperCase()
                    )}
                </div>
            );

            return (
              <div key={msg.id} className={`flex gap-3 w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
                
                {/* Other User Avatar (Left) */}
                {!isMe && <AvatarNode />}

                <div className={`flex flex-col max-w-[75%] ${isMe ? 'items-end' : 'items-start'}`}>
                  
                  {/* Name & Title Header */}
                  <div className={`flex items-baseline gap-2 mb-1 px-1 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                          {isMe ? 'You' : displayName}
                      </span>
                      {equippedTitle && (
                          <span className={`text-[8px] font-black uppercase tracking-widest truncate ${getRarityTextStyle(titleRarity)}`}>
                              "{equippedTitle}"
                          </span>
                      )}
                  </div>
                  
                  {/* Message Bubble */}
                  <div className={`px-4 py-2.5 text-xs font-medium shadow-lg leading-relaxed ${
                      isMe 
                      ? 'bg-pink-600 text-white rounded-2xl rounded-tr-sm' 
                      : 'bg-gray-800 border border-gray-700 text-gray-200 rounded-2xl rounded-tl-sm'
                  }`}>
                    {msg.content}
                  </div>

                </div>

                {/* Current User Avatar (Right) */}
                {isMe && <AvatarNode />}

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
          className="flex-1 bg-black border border-gray-800 text-white text-xs px-4 py-3 rounded-xl focus:outline-none focus:border-pink-600 transition-colors placeholder:text-gray-600 font-bold disabled:opacity-50 shadow-inner"
        />
        <button 
          type="submit" 
          disabled={!user || !newMessage.trim()}
          className="bg-teal-500 hover:bg-teal-400 text-black text-[10px] font-black uppercase px-5 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(20,184,166,0.2)] hover:shadow-[0_0_20px_rgba(20,184,166,0.4)]"
        >
            SEND
        </button>
      </form>
    </div>
  );
}