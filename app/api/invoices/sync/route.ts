import { NextResponse } from 'next/server';
import { sincronizarDesdeFactura } from '@/database/syncFacturaRepository';

// POST /api/invoices/sync -> importa a `comprobantes` las facturas nuevas de la tabla `factura` de origen.
export async function POST() {
  try {
    const result = await sincronizarDesdeFactura();
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error al sincronizar facturas:', error);
    return NextResponse.json({ error: 'Error al sincronizar: ' + error.message }, { status: 500 });
  }
}
