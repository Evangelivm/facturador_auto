import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { getInvoicesResumen } from '@/database/invoiceRepository';

// Valida la API key enviada en el header "x-api-key" o "Authorization: Bearer <key>".
function apiKeyValida(request: NextRequest): boolean {
  const esperada = process.env.RESUMEN_API_KEY;
  if (!esperada) return false; // sin key configurada el endpoint queda cerrado
  const auth = request.headers.get('authorization');
  const recibida = request.headers.get('x-api-key') ?? (auth?.startsWith('Bearer ') ? auth.slice(7) : '');
  const a = Buffer.from(recibida);
  const b = Buffer.from(esperada);
  return a.length === b.length && timingSafeEqual(a, b);
}

// GET /api/invoices/resumen                      -> últimos 300 comprobantes
// GET /api/invoices/resumen?factura=F001-123     -> un comprobante
// GET /api/invoices/resumen?serie=F001&numero=123
export async function GET(request: NextRequest) {
  if (!apiKeyValida(request)) {
    return NextResponse.json({ error: 'API key inválida o ausente' }, { status: 401 });
  }
  const { searchParams } = request.nextUrl;
  let serie = searchParams.get('serie') ?? undefined;
  let numero = searchParams.get('numero') ? Number(searchParams.get('numero')) : undefined;

  const factura = searchParams.get('factura');
  if (factura) {
    const [s, n] = factura.split('-');
    serie = s;
    numero = Number(n);
  }
  if (numero !== undefined && Number.isNaN(numero)) {
    return NextResponse.json({ error: 'Número de factura inválido' }, { status: 400 });
  }

  try {
    const data = await getInvoicesResumen({ serie, numero });
    if ((factura || (serie && numero)) && data.length === 0) {
      return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 });
    }
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Database error (GET /api/invoices/resumen):', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
