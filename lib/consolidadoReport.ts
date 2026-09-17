import { ComprobanteRow } from '@/components/ComprobanteOptionsModal';

// Código de tipo de comprobante según el catálogo 01 de SUNAT (el que NubeFact usa internamente es 1-4)
export const SUNAT_TIPO_CODE: Record<number, string> = { 1: '01', 2: '03', 3: '07', 4: '08' };

// El backend entrega fecha_de_emision como "DD/MM/YYYY". `new Date("DD/MM/YYYY")` NO debe
// usarse directamente: JS lo interpreta como MM/DD/YYYY (fechas con día <=12 quedan mal, ej.
// "05/09/2026" se lee como 9 de mayo en vez de 5 de setiembre) y con día >12 da Invalid Date.
// Por eso se detecta ese formato explícitamente antes de caer a un parseo genérico.
const parseDisplayDate = (value: any): Date | null => {
  if (!value) return null;
  if (typeof value === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
    const [d, m, y] = value.split('/').map(Number);
    return new Date(y, m - 1, d);
  }
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
};

export const formatFecha = (value: any) => {
  const d = parseDisplayDate(value);
  return d ? d.toLocaleDateString('es-PE') : (value ? String(value) : '');
};

// -> "YYYY-MM-DD", para comparar contra los inputs type="date" sin que la diferencia de huso
// horario (la API devuelve fechas en UTC) descarte filas del día seleccionado.
export const toDateKey = (value: any): string => {
  const d = parseDisplayDate(value);
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const isAceptada = (row: ComprobanteRow) =>
  row.estado !== 'BORRADOR' && !row.nubefact_error && !!row.nubefact_sunat_description;

export const isPagado = (row: ComprobanteRow) => !!row.pagado && Number(row.pagado) !== 0;

export interface ListFilters {
  fechaInicio: string;
  fechaFin: string;
  tipoFiltro: string;
  entidadFiltro: string;
  anuladoFiltro: string;
  buscarDocumento: string;
}

// Predicado de filtro compartido entre las pantallas de "Comprobantes" y "Consolidado", y la
// exportación a Excel de ambas: así el Excel exportado siempre coincide exactamente con lo que
// se ve filtrado en pantalla, sin duplicar la lógica en cada componente.
export const matchesFilters = (row: ComprobanteRow, f: ListFilters): boolean => {
  if (f.fechaInicio || f.fechaFin) {
    const rowDateKey = toDateKey((row as any).fecha_de_emision);
    if (f.fechaInicio && rowDateKey < f.fechaInicio) return false;
    if (f.fechaFin && rowDateKey > f.fechaFin) return false;
  }

  if (f.tipoFiltro === 'BORRADOR') {
    if (row.estado !== 'BORRADOR') return false;
  } else if (f.tipoFiltro) {
    if (String(row.tipo_de_comprobante) !== f.tipoFiltro) return false;
  }

  if (f.entidadFiltro) {
    const q = f.entidadFiltro.toLowerCase();
    const matches = (row.cliente_denominacion || '').toLowerCase().includes(q) ||
      (row.cliente_numero_de_documento || '').toLowerCase().includes(q);
    if (!matches) return false;
  }

  if (f.anuladoFiltro === 'ANULADOS' && row.estado !== 'ANULADO') return false;
  if (f.anuladoFiltro === 'NO_ANULADOS' && row.estado === 'ANULADO') return false;

  if (f.buscarDocumento) {
    const doc = `${row.serie}-${row.numero}`.toLowerCase();
    if (!doc.includes(f.buscarDocumento.toLowerCase())) return false;
  }

  return true;
};

// Encabezados EXACTOS del "Consolidado de Facturas, Boletas y Notas" que exporta NubeFact,
// para que el Excel generado acá se abra/entienda igual que el que ya conocen del panel de NubeFact.
export const EXPORT_HEADERS = [
  'FECHA E', 'FECHA V', 'TIPO', 'SERIE', 'NÚMERO', 'DOC ENTIDAD', 'RUC', 'DENOMINACIÓN',
  'TIPO DE OPERACIÓN', 'MONEDA', 'ORDEN DE COMPRA', 'PLACA DE VEHICULO', 'T/C', 'GRAVADA',
  'EXONERADA', 'INAFECTA', 'ISC', 'IGV', 'OTROS', 'IMPUESTO BOLSAS', 'TOTAL DESCUENTO', 'TOTAL',
  'TOTAL ANTICIPO', 'TOTAL PERCEPCIÓN', 'TOTAL INCLUIDO PERCEPCIÓN', 'TOTAL RETENCIÓN',
  'TOTAL GRATUITA', '¿DETRACCIÓN?', 'IMPORTE DE DETRACCIÓN', '¿PAGADO?', 'FORMA DE PAGO',
  'DETALLE DE PAGO', 'OBSERVACIONES', 'DETALLE DE LINEAS O ITEMS', '¿ANULADO?',
  'DOC MODIFICADO - TIPO', 'DOC MODIFICADO - SERIE', 'DOC MODIFICADO - NUMERO',
  'GUÍAS RELACIONADAS', 'ACEPTADO POR LA SUNAT', 'CÓDIGO SUNAT', 'SUNAT DESCRIPCIÓN DE ESTADO',
  'SUNAT OBSERVACIONES', '¿BORRADOR?', 'USUARIO',
];

export const buildExportRow = (row: any): (string | number)[] => {
  const esBorrador = row.estado === 'BORRADOR';
  const esAnulado = row.estado === 'ANULADO';
  const pagado = isPagado(row);
  const totalNum = Number(row.total) || 0;
  const formaPago = (row.medio_de_pago || '').toLowerCase().includes('credito') ? 'CREDITO' : 'CONTADO';

  let detallePago: string;
  if (pagado) {
    detallePago = `PAGADO${row.fecha_pago ? ' - ' + row.fecha_pago : ''}`;
  } else if (formaPago === 'CREDITO') {
    detallePago = `POR PAGAR [CRÉDITO] - ${totalNum.toFixed(2)}${row.fecha_de_vencimiento ? ' - ' + row.fecha_de_vencimiento : ''}`;
  } else {
    detallePago = `POR PAGAR - ${totalNum.toFixed(2)}`;
  }

  return [
    row.fecha_de_emision || '',
    row.fecha_de_vencimiento || '',
    SUNAT_TIPO_CODE[row.tipo_de_comprobante] || '',
    row.serie || '',
    Number(row.numero) || 0,
    row.cliente_tipo_de_documento ?? '',
    row.cliente_numero_de_documento || '',
    row.cliente_denominacion || '',
    'VENTA INTERNA',
    row.moneda === 2 ? 'USD' : 'PEN',
    row.orden_compra_numero || '',
    '',
    row.tipo_de_cambio ? Number(row.tipo_de_cambio) : 0,
    Number(row.total_gravada) || 0,
    Number(row.total_exonerada) || 0,
    Number(row.total_inafecta) || 0,
    0,
    Number(row.total_igv) || 0,
    Number(row.total_otros_cargos) || 0,
    0,
    0,
    totalNum,
    0,
    0,
    0,
    0,
    Number(row.total_gratuita) || 0,
    row.detraccion ? 'SI' : 'NO',
    Number(row.total_detraccion) || 0,
    pagado ? 'SI' : 'NO',
    formaPago,
    detallePago,
    row.observaciones || '',
    row.items_detalle || '',
    esAnulado ? 'SI' : 'NO',
    row.documento_que_se_modifica_tipo ? (SUNAT_TIPO_CODE[Number(row.documento_que_se_modifica_tipo)] || String(row.documento_que_se_modifica_tipo)) : '',
    row.documento_que_se_modifica_serie || '',
    row.documento_que_se_modifica_numero || '',
    '',
    esBorrador ? '' : (isAceptada(row) ? 'SI' : 'NO'),
    '',
    row.nubefact_sunat_description || row.nubefact_error || '',
    '-',
    esBorrador ? 'SI' : 'NO',
    '',
  ];
};

// Arma el .xlsx y dispara la descarga en el navegador. Se usa desde "Comprobantes" y
// "Consolidado" para no duplicar la generación del archivo.
export const exportConsolidadoExcel = async (fullRows: any[], filters: ListFilters, filenamePrefix: string) => {
  const XLSX = await import('xlsx');
  const filtered = fullRows.filter((row: any) => matchesFilters(row, filters));

  const worksheet = XLSX.utils.aoa_to_sheet([EXPORT_HEADERS, ...filtered.map(buildExportRow)]);
  worksheet['!cols'] = EXPORT_HEADERS.map((h) => ({ wch: Math.max(12, Math.min(30, h.length + 4)) }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Consolidado');
  XLSX.writeFile(workbook, `${filenamePrefix}_${new Date().toISOString().slice(0, 10)}.xlsx`);
};
