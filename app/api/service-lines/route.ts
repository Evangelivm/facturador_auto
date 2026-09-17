import { NextRequest, NextResponse } from 'next/server';
import { getServiceLines, addServiceLine } from '@/database/settingsRepository';

export async function GET() {
  try {
    const lines = await getServiceLines();
    return NextResponse.json(lines);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    await addServiceLine(body.name);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
