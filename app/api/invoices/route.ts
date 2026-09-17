import { NextRequest, NextResponse } from 'next/server';
import {
  saveInvoice,
  getInvoices,
  getInvoiceById,
  updateInvoiceStatus,
  setInvoiceEstado,
  deleteInvoice,
} from '@/database/invoiceRepository';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const id = searchParams.get('id');
  const status = searchParams.get('status') ?? undefined;

  try {
    if (id) {
      const invoice = await getInvoiceById(Number(id));
      if (!invoice) return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 });
      return NextResponse.json(invoice);
    }
    const invoices = await getInvoices(status);
    return NextResponse.json(invoices);
  } catch (error: any) {
    console.error('Database error (GET /api/invoices):', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await saveInvoice(body);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Error al guardar en base de datos: ' + error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, estado, motivo_anulacion, nubefact_enlace_pdf, nubefact_enlace_xml, nubefact_enlace_cdr, nubefact_sunat_description } = body;
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

    // Anular un comprobante no debe pisar sus enlaces de PDF/XML/CDR originales
    if (estado === 'ANULADO') {
      const result = await setInvoiceEstado(Number(id), estado, motivo_anulacion);
      return NextResponse.json(result);
    }

    const result = await updateInvoiceStatus(Number(id), estado, {
      nubefact_enlace_pdf, nubefact_enlace_xml, nubefact_enlace_cdr, nubefact_sunat_description
    });
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

  try {
    const result = await deleteInvoice(Number(id));
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
