import prisma from './prisma';
import { InvoiceData } from '@/types';

// Convierte "DD/MM/YYYY", "DD-MM-YYYY" (SUNAT) o "YYYY-MM-DD" a un Date (UTC medianoche,
// para que coincida con columnas @db.Date sin corrimientos por huso horario).
function parseFlexibleDate(dateStr?: string | null): Date | null {
  if (!dateStr) return null;
  const parts = dateStr.includes('/') ? dateStr.split('/') : dateStr.split('-');
  if (parts.length !== 3) return null;

  if (parts[0].length <= 2) {
    // DD/MM/YYYY o DD-MM-YYYY
    const [day, month, year] = parts.map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  }
  // YYYY-MM-DD
  const [year, month, day] = parts.map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

// Date -> "DD/MM/YYYY" para el frontend
function formatDateForFrontend(date?: Date | null): string {
  if (!date) return '';
  const d = String(date.getUTCDate()).padStart(2, '0');
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const y = date.getUTCFullYear();
  return `${d}/${m}/${y}`;
}

// Prisma.Decimal (o cualquier valor numérico-like) -> number
function toNum(v: any): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'object' && typeof v.toNumber === 'function') return v.toNumber();
  return Number(v);
}

function serializeItem(item: any) {
  return {
    id: item.id,
    comprobante_id: item.comprobante_id,
    unidad_de_medida: item.unidad_de_medida,
    codigo: item.codigo,
    descripcion: item.descripcion,
    cantidad: toNum(item.cantidad),
    valor_unitario: toNum(item.valor_unitario),
    precio_unitario: toNum(item.precio_unitario),
    subtotal: toNum(item.subtotal),
    tipo_de_igv: item.tipo_de_igv,
    igv: toNum(item.igv),
    total: toNum(item.total),
    anticipo_regularizacion: Boolean(item.anticipo_regularizacion)
  };
}

function serializeCuota(c: any) {
  return {
    cuota: c.cuota,
    fecha_de_pago: formatDateForFrontend(c.fecha_de_pago),
    importe: toNum(c.importe)
  };
}

function serializeComprobante(c: any) {
  return {
    ...c,
    fecha_de_emision: formatDateForFrontend(c.fecha_de_emision),
    fecha_de_vencimiento: c.fecha_de_vencimiento ? formatDateForFrontend(c.fecha_de_vencimiento) : '',
    fecha_pago: c.fecha_pago ? formatDateForFrontend(c.fecha_pago) : null,
    tipo_de_cambio: c.tipo_de_cambio != null ? String(toNum(c.tipo_de_cambio)) : undefined,
    porcentaje_de_igv: c.porcentaje_de_igv != null ? toNum(c.porcentaje_de_igv) : undefined,
    total_gravada: c.total_gravada != null ? toNum(c.total_gravada) : undefined,
    total_inafecta: c.total_inafecta != null ? toNum(c.total_inafecta) : undefined,
    total_exonerada: c.total_exonerada != null ? toNum(c.total_exonerada) : undefined,
    total_igv: c.total_igv != null ? toNum(c.total_igv) : undefined,
    total_gratuita: c.total_gratuita != null ? toNum(c.total_gratuita) : undefined,
    total_otros_cargos: c.total_otros_cargos != null ? toNum(c.total_otros_cargos) : undefined,
    total: c.total != null ? toNum(c.total) : undefined,
    detraccion: Boolean(c.detraccion),
    detraccion_porcentaje: c.detraccion_porcentaje != null ? toNum(c.detraccion_porcentaje) : undefined,
    total_detraccion: c.total_detraccion != null ? toNum(c.total_detraccion) : undefined,
    fondo_garantia_monto: c.fondo_garantia_monto != null ? toNum(c.fondo_garantia_monto) : undefined,
    pagado: Boolean(c.pagado),
  };
}

export const saveInvoice = async (invoice: InvoiceData, isDraft: boolean = false) => {
  return prisma.$transaction(async (tx) => {
    // 1. Insert/Update Client
    await tx.cliente.upsert({
      where: { numero_documento: invoice.cliente_numero_de_documento },
      create: {
        numero_documento: invoice.cliente_numero_de_documento,
        tipo_documento: invoice.cliente_tipo_de_documento || 6,
        denominacion: invoice.cliente_denominacion,
        direccion: invoice.cliente_direccion || null,
        email: invoice.cliente_email || null,
      },
      update: {
        denominacion: invoice.cliente_denominacion,
        direccion: invoice.cliente_direccion || null,
        email: invoice.cliente_email || null,
      }
    });
    const cliente = await tx.cliente.findUniqueOrThrow({
      where: { numero_documento: invoice.cliente_numero_de_documento }
    });

    const data = {
      operacion: invoice.operacion || 'generar_comprobante',
      tipo_de_comprobante: invoice.tipo_de_comprobante,
      serie: invoice.serie,
      numero: Number(invoice.numero),
      sunat_transaction: invoice.sunat_transaction || 1,
      cliente_id: cliente.id,
      cliente_numero_de_documento: invoice.cliente_numero_de_documento,
      cliente_denominacion: invoice.cliente_denominacion,
      cliente_direccion: invoice.cliente_direccion,
      cliente_email: invoice.cliente_email,
      fecha_de_emision: parseFlexibleDate(invoice.fecha_de_emision) ?? new Date(),
      fecha_de_vencimiento: invoice.fecha_de_vencimiento ? parseFlexibleDate(invoice.fecha_de_vencimiento) : null,
      moneda: invoice.moneda,
      tipo_de_cambio: invoice.tipo_de_cambio || null,
      porcentaje_de_igv: invoice.porcentaje_de_igv,
      total_gravada: invoice.total_gravada,
      total_inafecta: Number(invoice.total_inafecta) || 0,
      total_exonerada: Number(invoice.total_exonerada) || 0,
      total_igv: invoice.total_igv,
      total_gratuita: Number(invoice.total_gratuita) || 0,
      total_otros_cargos: Number(invoice.total_otros_cargos) || 0,
      total: invoice.total,
      detraccion: invoice.detraccion ?? false,
      detraccion_codigo: invoice.detraccion_codigo || null,
      detraccion_porcentaje: invoice.detraccion_porcentaje || null,
      total_detraccion: invoice.total_detraccion || 0,
      documento_que_se_modifica_tipo: invoice.documento_que_se_modifica_tipo ? Number(invoice.documento_que_se_modifica_tipo) : null,
      documento_que_se_modifica_serie: invoice.documento_que_se_modifica_serie || null,
      documento_que_se_modifica_numero: invoice.documento_que_se_modifica_numero ? Number(invoice.documento_que_se_modifica_numero) : null,
      tipo_de_nota_de_credito: invoice.tipo_de_nota_de_credito ? Number(invoice.tipo_de_nota_de_credito) : null,
      tipo_de_nota_de_debito: invoice.tipo_de_nota_de_debito ? Number(invoice.tipo_de_nota_de_debito) : null,
      observaciones: invoice.observaciones || '',
      condicion_de_pago: invoice.condicion_de_pago || 'CONTADO',
      medio_de_pago: invoice.medio_de_pago || 'Efectivo',
      fondo_garantia_monto: Number(invoice.fondo_garantia_monto) || 0,
      orden_compra_numero: invoice.orden_compra_numero || null,
      proyecto: invoice.proyecto || null,
      linea_servicio: invoice.linea_servicio || null,
      nubefact_enlace_pdf: invoice.nubefact_enlace_pdf || null,
      nubefact_enlace_xml: invoice.nubefact_enlace_xml || null,
      nubefact_enlace_cdr: invoice.nubefact_enlace_cdr || null,
      nubefact_sunat_description: invoice.nubefact_sunat_description || null,
      estado: invoice.estado || 'EMITIDO',
    };

    // 2. Insert or Update Invoice: si el comprobante ya existe (ej. se está regrabando un
    // borrador ya guardado antes, o emitiendo un borrador cargado), se actualiza esa misma fila
    // en vez de insertar una nueva y dejar un duplicado.
    let invoiceId: number;
    if (invoice.id) {
      await tx.comprobante.update({ where: { id: Number(invoice.id) }, data });
      invoiceId = Number(invoice.id);
      // Reemplaza el detalle completo (más simple y seguro que diferenciar altas/bajas/cambios ítem a ítem)
      await tx.comprobanteItem.deleteMany({ where: { comprobante_id: invoiceId } });
      await tx.comprobanteCuota.deleteMany({ where: { comprobante_id: invoiceId } });
    } else {
      const created = await tx.comprobante.create({ data });
      invoiceId = created.id;
    }

    // 3. Insert Items
    if (invoice.items?.length) {
      await tx.comprobanteItem.createMany({
        data: invoice.items.map(item => ({
          comprobante_id: invoiceId,
          unidad_de_medida: item.unidad_de_medida || 'NIU',
          codigo: item.codigo || '',
          descripcion: item.descripcion || '',
          cantidad: item.cantidad,
          valor_unitario: item.valor_unitario,
          precio_unitario: item.precio_unitario,
          subtotal: item.subtotal,
          tipo_de_igv: item.tipo_de_igv,
          igv: item.igv,
          total: item.total,
          anticipo_regularizacion: item.anticipo_regularizacion ?? false,
        }))
      });
    }

    // 4. Insert Cuotas (if any)
    if (invoice.venta_al_credito?.length) {
      await tx.comprobanteCuota.createMany({
        data: invoice.venta_al_credito.map(cuota => ({
          comprobante_id: invoiceId,
          cuota: cuota.cuota,
          fecha_de_pago: parseFlexibleDate(cuota.fecha_de_pago)!,
          importe: cuota.importe,
        }))
      });
    }

    return { success: true, id: invoiceId, message: isDraft ? 'Borrador guardado correctamente' : 'Factura guardada correctamente' };
  });
};

export const getInvoices = async (status?: string) => {
  const rows = await prisma.comprobante.findMany({
    where: status ? { estado: status } : undefined,
    orderBy: [{ fecha_de_emision: 'desc' }, { id: 'desc' }],
    take: 300,
    select: {
      id: true, tipo_de_comprobante: true, serie: true, numero: true, fecha_de_emision: true,
      cliente_numero_de_documento: true, cliente_denominacion: true,
      total: true, total_gratuita: true, moneda: true, tipo_de_cambio: true,
      estado: true, motivo_anulacion: true,
      nubefact_enlace_pdf: true, nubefact_enlace_xml: true, nubefact_enlace_cdr: true,
      nubefact_sunat_description: true, nubefact_error: true,
      pagado: true, fecha_pago: true, created_at: true,
    }
  });
  return rows.map(serializeComprobante);
};

// Marca un comprobante como ANULADO (o revierte el estado) sin tocar los enlaces
// de PDF/XML/CDR originales, a diferencia de updateInvoiceStatus.
export const setInvoiceEstado = async (id: number, estado: string, motivoAnulacion?: string) => {
  await prisma.comprobante.update({
    where: { id },
    data: { estado, motivo_anulacion: motivoAnulacion || null }
  });
  return { success: true };
};

// Registra el pago de un comprobante (fecha + constancia adjunta como data URI base64).
// Es un registro manual del proceso interno, no viene de NubeFact/SUNAT.
export const registrarPago = async (id: number, fechaPago: string, comprobantePagoData?: string | null) => {
  await prisma.comprobante.update({
    where: { id },
    data: {
      pagado: true,
      fecha_pago: parseFlexibleDate(fechaPago),
      comprobante_pago_data: comprobantePagoData || null,
    }
  });
  return { success: true };
};

// Elimina definitivamente un comprobante. Solo se permite para BORRADORES: una
// FACTURA/BOLETA/NOTA ya emitida ante SUNAT no puede borrarse, debe anularse
// (generar_anulacion / comunicación de baja) según el manual de NubeFact.
export const deleteInvoice = async (id: number) => {
  const invoice = await prisma.comprobante.findUnique({ where: { id }, select: { estado: true } });
  if (!invoice) throw new Error('Comprobante no encontrado');
  if (invoice.estado !== 'BORRADOR') {
    throw new Error('Solo se pueden eliminar borradores. Un comprobante emitido debe anularse (comunicación de baja) en lugar de eliminarse.');
  }
  await prisma.comprobante.delete({ where: { id } });
  return { success: true };
};

export const updateInvoiceStatus = async (
  id: number,
  estado: string,
  nubefactData?: {
    nubefact_enlace_pdf?: string;
    nubefact_enlace_xml?: string;
    nubefact_enlace_cdr?: string;
    nubefact_sunat_description?: string;
  }
) => {
  await prisma.comprobante.update({
    where: { id },
    data: {
      estado,
      nubefact_enlace_pdf: nubefactData?.nubefact_enlace_pdf || null,
      nubefact_enlace_xml: nubefactData?.nubefact_enlace_xml || null,
      nubefact_enlace_cdr: nubefactData?.nubefact_enlace_cdr || null,
      nubefact_sunat_description: nubefactData?.nubefact_sunat_description || null,
    }
  });
  return { success: true };
};

export const getInvoiceById = async (id: number) => {
  const invoice = await prisma.comprobante.findUnique({
    where: { id },
    include: {
      cliente: true,
      items: true,
      cuotas: { orderBy: { cuota: 'asc' } },
    }
  });
  if (!invoice) return null;

  const { cliente, items, cuotas, ...rest } = invoice;

  return {
    ...serializeComprobante(rest),
    cliente_tipo_de_documento: cliente?.tipo_documento,
    items: items.map(serializeItem),
    venta_al_credito: cuotas.map(serializeCuota),
    numCuotas: cuotas.length,
    cuotas: cuotas.map(serializeCuota),
  };
};
