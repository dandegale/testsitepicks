import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name');

  if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 });

  try {
    const searchName = name.replace(/-/g, ' '); // "jon-jones" -> "jon jones"
    
    // 1. Fetch from ESPN
    const espnUrl = `https://site.api.espn.com/apis/site/v2/sports/mma/ufc/athletes?limit=1&q=${encodeURIComponent(searchName)}`;
    const res = await fetch(espnUrl);
    
    // Safety check: Did ESPN actually reply?
    if (!res.ok) throw new Error('ESPN API Error');

    const data = await res.json();

    if (data.athletes && data.athletes.length > 0) {
        const athlete = data.athletes[0];
        return NextResponse.json({
            found: true,
            image: athlete.headshot?.href || null,
            height: athlete.displayHeight,
            weight: athlete.displayWeight,
            age: athlete.age,
            country: athlete.citizenship,
            nickname: athlete.nickname,
            record: athlete.displayRecord
        });
    }
    
    return NextResponse.json({ found: false });

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}