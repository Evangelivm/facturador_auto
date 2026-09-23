import { NextRequest, NextResponse } from 'next/server';
import { searchCatalogItems } from '@/database/itemsCatalogRepository';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') || '';

  try {
    const results = await searchCatalogItems(q);
    return NextResponse.json(results);
  } catch (e: any) {
    console.error('Error buscando ítems (inventario ayala):', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
