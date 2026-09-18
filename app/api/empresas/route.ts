import { NextRequest, NextResponse } from 'next/server';
import { searchEmpresasAyala } from '@/database/empresasRepository';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') || '';

  try {
    const empresas = await searchEmpresasAyala(q);
    return NextResponse.json(empresas);
  } catch (e: any) {
    console.error('Error buscando empresas (ayala):', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
