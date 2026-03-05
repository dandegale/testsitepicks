import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request) {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
    
    if (!serviceKey) {
        return NextResponse.json({ error: 'Missing Server Key in environment variables' }, { status: 500 });
    }

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        serviceKey
    );

    try {
        const body = await request.json();
        const { userEmail, caseId, dynamicPool, price } = body;

        if (!userEmail) return NextResponse.json({ error: 'No user email provided' }, { status: 400 });

        const isDynamic = Boolean(dynamicPool && dynamicPool.length > 0);
        const CASE_COST = isDynamic ? price : 100; 

        // 1. Check user's coin balance
        const { data: profile, error: profileError } = await supabase.from('profiles').select('coins').eq('email', userEmail).single();
        if (profileError || !profile || profile.coins < CASE_COST) {
            return NextResponse.json({ error: 'Not enough coins!' }, { status: 403 });
        }

        // 2. 🛡️ THE MASTER DUPLICATE CHECKER (Runs for both case types!)
        // Fetch User's Current Inventory AND the full Store
        const { data: inventory } = await supabase.from('user_inventory').select('item_id').eq('user_email', userEmail);
        const { data: storeItems } = await supabase.from('store_items').select('*');

        const ownedIds = inventory ? inventory.map(inv => inv.item_id) : [];
        const ownedNames = storeItems
            .filter(item => ownedIds.includes(item.id))
            .map(item => item.name);


        // ==========================================
        // 🌀 DYNAMIC CASE LOGIC (Fight Week Case)
        // ==========================================
        if (isDynamic) {
            
            // Filter the incoming card to ONLY fighters the user doesn't already own
            const availableDynamicItems = dynamicPool.filter(item => !ownedNames.includes(item.name));

            if (availableDynamicItems.length === 0) {
                return NextResponse.json({ error: 'You already own every nickname from this event!' }, { status: 400 });
            }

            const newBalance = profile.coins - CASE_COST;
            await supabase.from('profiles').update({ coins: newBalance }).eq('email', userEmail);

            // Roll the RNG for Rarity
            const roll = Math.random() * 100;
            let targetRarity = 'Common';
            if (roll < 3) targetRarity = 'Legendary';
            else if (roll < 12) targetRarity = 'Epic';
            else if (roll < 45) targetRarity = 'Rare';

            // Pick a random fighter nickname from the AVAILABLE pool
            let pool = availableDynamicItems.filter(i => i.rarity === targetRarity);
            if (pool.length === 0) pool = availableDynamicItems; // Fallback if that specific rarity is fully owned
            const wonItem = pool[Math.floor(Math.random() * pool.length)];

            // Check if this nickname exists in store_items globally
            let { data: existingItem, error: fetchError } = await supabase
                .from('store_items')
                .select('*')
                .eq('name', wonItem.name)
                .maybeSingle();
            
            if (fetchError) throw new Error(`Supabase Fetch Error: ${fetchError.message}`);
            
            if (!existingItem) {
                const { data: newItem, error: insertError } = await supabase.from('store_items').insert([{
                    name: wonItem.name,
                    rarity: wonItem.rarity
                }]).select('*').single();

                if (insertError) throw new Error(`Supabase Insert Error: ${insertError.message}`);
                existingItem = newItem;
            }

            // Add it to the user's inventory
            const { error: invError } = await supabase.from('user_inventory').insert([{ user_email: userEmail, item_id: existingItem.id }]);
            if (invError) throw new Error(`Inventory Insert Error: ${invError.message}`);

            return NextResponse.json({ success: true, item: existingItem, newBalance });
        } 
        
        // ==========================================
        // 📦 STATIC CASE LOGIC (Standard Cases)
        // ==========================================
        else {
            // Filter available items to ensure the NAME is not already in their inventory
            const availableItems = storeItems.filter(item => !ownedNames.includes(item.name));

            if (availableItems.length === 0) {
                return NextResponse.json({ error: 'You already own every item in this crate!' }, { status: 400 });
            }

            const newBalance = profile.coins - CASE_COST;
            await supabase.from('profiles').update({ coins: newBalance }).eq('email', userEmail);

            const roll = Math.floor(Math.random() * 100) + 1; 
            let wonRarity = 'Common';
            if (roll > 70 && roll <= 90) wonRarity = 'Rare';       
            else if (roll > 90 && roll <= 98) wonRarity = 'Epic';   
            else if (roll > 98) wonRarity = 'Legendary';            

            let possibleItems = availableItems.filter(i => i.rarity === wonRarity);
            if (possibleItems.length === 0) possibleItems = availableItems;

            const wonItem = possibleItems[Math.floor(Math.random() * possibleItems.length)];

            await supabase.from('user_inventory').insert({ user_email: userEmail, item_id: wonItem.id });

            return NextResponse.json({ success: true, item: wonItem, newBalance });
        }

    } catch (error) {
        console.error("Case Opening Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}