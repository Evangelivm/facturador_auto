import { NextRequest, NextResponse } from 'next/server';
import { registrarPago } from '@/database/invoiceRepository';

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, fecha_pago, comprobante_pago_data } = body;
    if (!id || !fecha_pago) {
      return NextResponse.json({ error: 'Faltan datos (id, fecha_pago)' }, { status: 400 });
    }
    const result = await registrarPago(Number(id), fecha_pago, comprobante_pago_data);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
