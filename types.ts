
export interface InvoiceItem {
  id: string; // Internal ID for UI
  unidad_de_medida: string; // e.g., "NIU", "ZZ"
  codigo: string;
  descripcion: string;
  cantidad: number;
  valor_unitario: number; // Price excluding IGV
  precio_unitario: number; // Price including IGV
  subtotal: number; // valor_unitario * cantidad
  tipo_de_igv: number; // 1 = Gravado - Operación Onerosa
  igv: number;
  total: number; // subtotal + igv
  anticipo_regularizacion: boolean;
}

export interface Client {
  numero_documento: string;
  denominacion: string;
  direccion: string;
  email?: string;
  tipo_documento: number; // 6 for RUC
}

// Nueva interfaz para las cuotas
export interface CreditInstallment {
  cuota: number;
  fecha_de_pago: string; // DD-MM-YYYY
  importe: number;
}

export interface InvoiceData {
  id?: number; // Presente cuando el documento ya existe en la BD (borrador cargado para editar)
  operacion: string;
  tipo_de_comprobante: number; // 1 = Factura, 2 = Boleta
  serie: string;
  numero: number;
  sunat_transaction: number;
  cliente_tipo_de_documento: number; // 6 = RUC, 1 = DNI
  cliente_numero_de_documento: string;
  cliente_denominacion: string;
  cliente_direccion: string;
  cliente_email: string;
  fecha_de_emision: string; // DD-MM-YYYY
  fecha_de_vencimiento: string;
  moneda: number; // 1 = Soles, 2 = Dolares
  tipo_de_cambio?: string;
  porcentaje_de_igv: number;
  descuento_global: string | number;
  total_descuento: string | number;
  total_anticipo: string | number;
  total_gravada: number;
  total_inafecta: string | number;
  total_exonerada: string | number;
  total_igv: number;
  total_gratuita: string | number;
  total_otros_cargos: string | number;
  total: number;
  percepcion_tipo: string | number;
  percepcion_base_imponible: string | number;
  total_percepcion: string | number;
  total_incluido_percepcion: string | number;
  retencion_tipo?: string | number;
  retencion_base_imponible?: string | number;
  total_retencion?: string | number;

  // Campos Detracción
  detraccion: boolean;
  detraccion_codigo?: string;
  detraccion_porcentaje?: number;
  total_detraccion?: number;

  // Campos Nota de Crédito / Nota de Débito (tipo_de_comprobante = 3 o 4)
  documento_que_se_modifica_tipo?: number | string;
  documento_que_se_modifica_serie?: string;
  documento_que_se_modifica_numero?: string | number;
  tipo_de_nota_de_credito?: number | string;
  tipo_de_nota_de_debito?: number | string;
  motivo_anulacion?: string;

  observaciones: string;
  enviar_automaticamente_a_la_sunat: boolean;
  enviar_automaticamente_al_cliente: boolean;
  items: InvoiceItem[];

  // Campos adicionales para UI (Diseño)
  condiciones_de_pago?: string;
  condicion_de_pago?: string; // Para la API (CONTADO / CREDITO)
  venta_al_credito?: CreditInstallment[]; // Array para NubeFact

  tipo_de_venta?: string;
  medio_de_pago?: string;
  fondo_garantia?: boolean;
  fondo_garantia_monto?: string;
  orden_compra?: boolean;
  orden_compra_numero?: string;
  proyecto?: string;
  linea_servicio?: string;

  // Campos para BD Local
  nubefact_enlace_pdf?: string;
  nubefact_enlace_xml?: string;
  nubefact_enlace_cdr?: string;
  nubefact_sunat_description?: string;

  estado?: 'EMITIDO' | 'BORRADOR' | 'ANULADO';
}

export type ToastType = 'success' | 'error' | 'info';

export interface NubeFactResponse {
  tipo_de_comprobante?: number;
  serie?: string;
  numero?: number;
  enlace?: string;
  enlace_del_pdf?: string;
  enlace_del_xml?: string;
  enlace_del_cdr?: string;
  // TICKET asignado por SUNAT a una Comunicación de Baja / Anulación ("generar_anulacion" /
  // "consultar_anulacion").
  sunat_ticket_numero?: string;
  aceptada_por_sunat?: boolean;
  sunat_description?: string;
  sunat_note?: any;
  sunat_responsecode?: string;
  sunat_soap_error?: string;
  anulado?: boolean;
  cadena_para_codigo_qr?: string;
  codigo_hash?: string;
  errors?: string;
  codigo?: number;
}
