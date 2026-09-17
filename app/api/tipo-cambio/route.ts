import { NextRequest, NextResponse } from 'next/server';

// Cache simple en memoria (vive mientras el proceso del servidor siga corriendo)
const tipoCambioCache = new Map<string, any>();

export async function GET(request: NextRequest) {
  const fecha = request.nextUrl.searchParams.get('fecha') || new Date().toISOString().slice(0, 10);

  if (tipoCambioCache.has(fecha)) {
    return NextResponse.json(tipoCambioCache.get(fecha));
  }

  try {
    const response = await fetch(`https://api.apis.net.pe/v1/tipo-cambio-sunat?date=${fecha}`);
    if (!response.ok) {
      return NextResponse.json({ error: `No se encontró el tipo de cambio SUNAT para ${fecha}` }, { status: response.status });
    }
    const data = await response.json();
    tipoCambioCache.set(fecha, data);
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error al consultar el tipo de cambio' }, { status: 500 });
  }
}
