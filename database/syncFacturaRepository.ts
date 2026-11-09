import prisma from './prisma';

// Base de datos de origen (tabla `factura` + `factura_item`). Se valida porque se interpola en el SQL.
const SOURCE_DB = process.env.SYNC_SOURCE_DB || 'inventariosayala2025';
if (!/^[A-Za-z0-9_]+$/.test(SOURCE_DB)) throw new Error('SYNC_SOURCE_DB inválido');

export interface SyncResult {
  importados: number;
  items: number;
  comprobantes: { tipo_de_comprobante: number; serie: string; numero: number; total: number }[];
}

// Copia a `comprobantes` / `comprobante_items` las facturas de `<SOURCE_DB>.factura` que aún no existen
// (clave: tipo + serie + número). Solo toma las COMPLETADAS y aceptadas por SUNAT, así que los intentos
// FALLADO/ERROR no se importan. Es idempotente: ejecutarla otra vez no duplica nada.
export const sincronizarDesdeFactura = async (): Promise<SyncResult> => {
  const F = `\`${SOURCE_DB}\`.factura`;
  const FI = `\`${SOURCE_DB}\`.factura_item`;
  const pendientes = `f.estado_factura = 'COMPLETADO' AND f.aceptada_por_sunat = 1
    AND NOT EXISTS (SELECT 1 FROM comprobantes x WHERE x.tipo_de_comprobante = f.tipo_de_comprobante AND x.serie = f.serie AND x.numero = f.numero)`;

  return prisma.$transaction(async (tx) => {
    const lista = await tx.$queryRawUnsafe<any[]>(
      `SELECT f.tipo_de_comprobante, f.serie, f.numero, f.total FROM ${F} f WHERE ${pendientes} ORDER BY f.fecha_emision, f.numero`
    );
    if (lista.length === 0) return { importados: 0, items: 0, comprobantes: [] };

    // Clientes que no existan todavía en `clientes`
    await tx.$executeRawUnsafe(
      `INSERT INTO clientes (numero_documento, tipo_documento, denominacion, direccion, email)
       SELECT f.cliente_numero_documento, MAX(f.cliente_tipo_documento), MAX(f.cliente_denominacion), MAX(f.cliente_direccion), MAX(NULLIF(f.cliente_email, ''))
       FROM ${F} f WHERE ${pendientes}
         AND NOT EXISTS (SELECT 1 FROM clientes k WHERE k.numero_documento = f.cliente_numero_documento)
       GROUP BY f.cliente_numero_documento`
    );

    const importados = await tx.$executeRawUnsafe(
      `INSERT INTO comprobantes
        (operacion, tipo_de_comprobante, serie, numero, sunat_transaction, cliente_id, cliente_numero_de_documento, cliente_denominacion,
         cliente_direccion, cliente_email, fecha_de_emision, fecha_de_vencimiento, moneda, porcentaje_de_igv, total_gravada, total_inafecta,
         total_exonerada, total_igv, total_gratuita, total_otros_cargos, total, detraccion, detraccion_codigo, detraccion_porcentaje,
         total_detraccion, observaciones, condicion_de_pago, medio_de_pago, fondo_garantia_monto, orden_compra_numero,
         nubefact_enlace_pdf, nubefact_enlace_xml, nubefact_enlace_cdr, nubefact_sunat_description, created_at, estado, pagado)
       SELECT f.operacion, f.tipo_de_comprobante, f.serie, f.numero, f.sunat_transaction,
         (SELECT MIN(k.id) FROM clientes k WHERE k.numero_documento = f.cliente_numero_documento),
         f.cliente_numero_documento, f.cliente_denominacion, f.cliente_direccion, NULLIF(f.cliente_email, ''),
         f.fecha_emision, f.fecha_vencimiento, f.moneda, f.porcentaje_igv, f.total_gravada, f.total_inafecta,
         f.total_exonerada, f.total_igv, f.total_gratuita, f.total_otros_cargos, f.total,
         f.aplicar_detraccion, IF(f.aplicar_detraccion = 1, CAST(f.detraccion_tipo AS CHAR), NULL), f.detraccion_porcentaje,
         f.detraccion_total, f.observaciones, f.condiciones_de_pago, f.medio_de_pago,
         IF(f.fondo_garantia = 1, f.fondo_garantia_valor, NULL), f.orden_compra_valor,
         f.enlace_del_pdf, f.enlace_del_xml, f.enlace_del_cdr, f.sunat_description, f.created_at, 'EMITIDO', 0
       FROM ${F} f WHERE ${pendientes}
       ORDER BY f.fecha_emision, f.numero`
    );

    const items = await tx.$executeRawUnsafe(
      `INSERT INTO comprobante_items
        (comprobante_id, unidad_de_medida, codigo, descripcion, cantidad, valor_unitario, precio_unitario, subtotal, tipo_de_igv, igv, total, anticipo_regularizacion)
       SELECT c.id, i.unidad_medida, i.codigo_item, i.descripcion_item, i.cantidad, i.valor_unitario, i.precio_unitario,
         i.subtotal, i.tipo_de_igv, i.igv, i.total, IFNULL(i.anticipo_regularizacion, 0)
       FROM ${FI} i
       JOIN ${F} f ON f.id_factura = i.id_factura
       JOIN comprobantes c ON c.tipo_de_comprobante = f.tipo_de_comprobante AND c.serie = f.serie AND c.numero = f.numero
       WHERE f.estado_factura = 'COMPLETADO' AND f.aceptada_por_sunat = 1
         AND NOT EXISTS (SELECT 1 FROM comprobante_items y WHERE y.comprobante_id = c.id)`
    );

    return {
      importados: Number(importados),
      items: Number(items),
      comprobantes: lista.map((r) => ({
        tipo_de_comprobante: Number(r.tipo_de_comprobante),
        serie: r.serie,
        numero: Number(r.numero),
        total: Number(r.total),
      })),
    };
  }, { maxWait: 20000, timeout: 60000 }); // la BD es remota: la primera conexión puede tardar más de los 2 s por defecto
};
