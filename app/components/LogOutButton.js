'use client';

import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function LogOutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.refresh(); 
    router.push('/login'); 
  };

  return (
    <button 
      onClick={handleLogout}
      className="text-xs font-bold text-gray-400 hover:text-white border border-gray-600 hover:border-white px-3 py-1 rounded transition-all uppercase"
    >
      Sign Out
    </button>
  );
}