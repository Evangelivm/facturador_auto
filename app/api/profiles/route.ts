import { NextRequest, NextResponse } from 'next/server';
import { getApiProfiles, addApiProfile } from '@/database/settingsRepository';

export async function GET() {
  try {
    const profiles = await getApiProfiles();
    return NextResponse.json(profiles);
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, route, token } = body;
    if (!name || !route || !token) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
    }
    const id = await addApiProfile(name, route, token);
    return NextResponse.json({ id });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
