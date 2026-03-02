import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const CASE_COST = 100;

export async function POST(request) {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return NextResponse.json({ error: 'Missing Server Key' }, { status: 500 });
    }

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY 
    );

    try {
        const body = await request.json();
        const { userEmail } = body;

        if (!userEmail) return NextResponse.json({ error: 'No user email provided' }, { status: 400 });

        // 1. Check user's coin balance
        const { data: profile } = await supabase.from('profiles').select('coins').eq('email', userEmail).single();
        if (!profile || profile.coins < CASE_COST) return NextResponse.json({ error: 'Not enough coins!' }, { status: 403 });

        // 2. Fetch User's Current Inventory AND the full Store
        const { data: inventory } = await supabase.from('user_inventory').select('item_id').eq('user_email', userEmail);
        const { data: storeItems } = await supabase.from('store_items').select('*');

        const ownedIds = inventory ? inventory.map(inv => inv.item_id) : [];

        // 🎯 THE FIX: Get the actual text NAMES of the items they own
        const ownedNames = storeItems
            .filter(item => ownedIds.includes(item.id))
            .map(item => item.name);

        // 3. Filter available items to ensure the NAME is not already in their inventory
        const availableItems = storeItems.filter(item => !ownedNames.includes(item.name));

        // 4. Guard: If they bought everything
        if (availableItems.length === 0) {
            return NextResponse.json({ error: 'You already own every item in this crate!' }, { status: 400 });
        }

        // 5. Deduct coins
        await supabase.from('profiles').update({ coins: profile.coins - CASE_COST }).eq('email', userEmail);

        // 6. ROLL THE DICE
        const roll = Math.floor(Math.random() * 100) + 1; 
        let wonRarity = 'Common';
        if (roll > 70 && roll <= 90) wonRarity = 'Rare';       
        else if (roll > 90 && roll <= 98) wonRarity = 'Epic';   
        else if (roll > 98) wonRarity = 'Legendary';            

        // 7. Filter the remaining available items by rarity
        let possibleItems = availableItems.filter(i => i.rarity === wonRarity);

        // 8. Fallback: If they rolled a rarity (like 'Common') but they already own ALL Common items, 
        // give them a random item from whatever other rarities are left.
        if (possibleItems.length === 0) {
            possibleItems = availableItems;
        }

        const wonItem = possibleItems[Math.floor(Math.random() * possibleItems.length)];

        // 9. Add new item to their inventory
        await supabase.from('user_inventory').insert({ user_email: userEmail, item_id: wonItem.id });

        return NextResponse.json({ success: true, item: wonItem, newBalance: profile.coins - CASE_COST });

    } catch (error) {
        console.error("Case Opening Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}