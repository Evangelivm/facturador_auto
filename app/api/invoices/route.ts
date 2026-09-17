import { NextRequest, NextResponse } from 'next/server';
import {
  saveInvoice,
  getInvoices,
  getInvoicesForExport,
  getInvoiceById,
  updateInvoiceStatus,
  registrarAnulacion,
  actualizarEstadoBaja,
  deleteInvoice,
} from '@/database/invoiceRepository';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const id = searchParams.get('id');
  const status = searchParams.get('status') ?? undefined;
  const isExport = searchParams.get('export') === '1';

  try {
    if (id) {
      const invoice = await getInvoiceById(Number(id));
      if (!invoice) return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 });
      return NextResponse.json(invoice);
    }
    if (isExport) {
      const invoices = await getInvoicesForExport();
      return NextResponse.json(invoices);
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
    const {
      id, estado, motivo_anulacion, nubefact_enlace_pdf, nubefact_enlace_xml, nubefact_enlace_cdr, nubefact_sunat_description,
      refresh_baja, nubefact_baja_ticket, nubefact_baja_aceptada, nubefact_baja_description,
      nubefact_baja_enlace_pdf, nubefact_baja_enlace_xml, nubefact_baja_enlace_cdr,
    } = body;
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

    // Refresca el estado de un TICKET de "comunicación de baja" ya generado
    // (OPERACIÓN "consultar_anulacion" del manual de NubeFact), sin cambiar el estado local.
    if (refresh_baja) {
      const result = await actualizarEstadoBaja(Number(id), {
        aceptada: nubefact_baja_aceptada,
        description: nubefact_baja_description,
        enlace_pdf: nubefact_baja_enlace_pdf,
        enlace_xml: nubefact_baja_enlace_xml,
        enlace_cdr: nubefact_baja_enlace_cdr,
      });
      return NextResponse.json(result);
    }

    // Anular un comprobante no debe pisar sus enlaces de PDF/XML/CDR originales. Se registra
    // además el TICKET de la Comunicación de Baja (OPERACIÓN "generar_anulacion").
    if (estado === 'ANULADO') {
      const result = await registrarAnulacion(Number(id), {
        motivo: motivo_anulacion,
        ticket: nubefact_baja_ticket,
        aceptada: nubefact_baja_aceptada,
        description: nubefact_baja_description,
        enlace_pdf: nubefact_baja_enlace_pdf,
        enlace_xml: nubefact_baja_enlace_xml,
        enlace_cdr: nubefact_baja_enlace_cdr,
      });
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
