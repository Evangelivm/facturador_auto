'use client';

import React, { useState, useEffect, useRef } from 'react';
import { InvoiceData, InvoiceItem, NubeFactResponse, Client, CatalogItem, CreditInstallment, ToastType } from '@/types';
import { toast } from '@/components/ui/toast';
import { calculateItemTotals, calculateInvoiceTotals, getTodayForInput, formatToSunatDate } from '@/utils/calculations';
import { sendInvoice, checkConnection } from '@/services/nubefactService';
import { saveInvoiceToDb, getInvoices, getInvoiceById, getProjects, addProject, getServiceLines, addServiceLine } from '@/services/databaseService';
import { getTipoCambioSunat } from '@/services/exchangeRateService';
import { ResponseViewer } from '@/components/ResponseViewer';
import { DetractionModal } from '@/components/DetractionModal';
import { ClientSearch } from '@/components/ClientSearch';
import { ItemSearch } from '@/components/ItemSearch';
import { InputModal } from '@/components/InputModal';
import { InvoiceListModal } from '@/components/InvoiceListModal';
import { ComprobantesListView } from '@/components/ComprobantesListView';
import { ComunicacionesBajaView } from '@/components/ComunicacionesBajaView';
import { ConsolidadoView } from '@/components/ConsolidadoView';
import { ComprobanteRow } from '@/components/ComprobanteOptionsModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field, FieldLabel } from '@/components/ui/field';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusIcon, XIcon, RefreshCwIcon, FileTextIcon, Loader2Icon, ReceiptIcon, BanIcon, LayoutListIcon } from 'lucide-react';

// Serie con la que se identifica un documento que todavía es un borrador (nunca se envía a
// NubeFact/SUNAT así). Al emitirlo recién se le asigna la serie y el correlativo real.
const BORRADOR_SERIE = 'BORR';
const REAL_SERIE = 'FFF1';

// Safe ID generator
const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

const initialItem: InvoiceItem = {
  id: '1',
  unidad_de_medida: 'NIU',
  codigo: '',
  descripcion: '',
  cantidad: 1,
  valor_unitario: 0,
  precio_unitario: 0,
  subtotal: 0,
  tipo_de_igv: 1,
  igv: 0,
  total: 0,
  anticipo_regularizacion: false
};

const initialInvoice: InvoiceData = {
  operacion: "generar_comprobante",
  tipo_de_comprobante: 1,
  serie: REAL_SERIE,
  numero: 1,
  sunat_transaction: 1,
  cliente_tipo_de_documento: 6,
  cliente_numero_de_documento: "",
  cliente_denominacion: "",
  cliente_direccion: "",
  cliente_email: "",
  fecha_de_emision: getTodayForInput(),
  fecha_de_vencimiento: "",
  moneda: 1,
  porcentaje_de_igv: 18.00,
  descuento_global: "",
  total_descuento: "",
  total_anticipo: "",
  total_gravada: 0,
  total_inafecta: "",
  total_exonerada: "",
  total_igv: 0,
  total_gratuita: "",
  total_otros_cargos: "",
  total: 0,
  percepcion_tipo: "",
  percepcion_base_imponible: "",
  total_percepcion: "",
  total_incluido_percepcion: "",
  retencion_tipo: "",
  retencion_base_imponible: "",
  total_retencion: "",
  detraccion: false,
  detraccion_codigo: "",
  detraccion_porcentaje: 0,
  total_detraccion: 0,
  documento_que_se_modifica_tipo: "",
  documento_que_se_modifica_serie: "",
  documento_que_se_modifica_numero: "",
  tipo_de_nota_de_credito: "",
  tipo_de_nota_de_debito: "",
  observaciones: "",
  enviar_automaticamente_a_la_sunat: true,
  enviar_automaticamente_al_cliente: false,
  items: [],

  tipo_de_venta: "Contado",
  medio_de_pago: "Efectivo",
  fondo_garantia_monto: "",
  orden_compra_numero: "",
  proyecto: "",
  linea_servicio: ""
};

type ConnectionStatus = 'checking' | 'connected' | 'error';

const DEFAULT_PROJECTS = ["PROYECTO COLONIAL", "Proyecto Implementación ERP", "Proyecto Migración Cloud", "Mantenimiento 2025"];
const DEFAULT_SERVICE_LINES = ["MOVIMIENTO DE TIERRAS", "Consultoría", "Desarrollo de Software", "Soporte Técnico"];
const DEFAULT_UNITS = ["NIU", "ZZ", "KGM", "MTR", "LTR", "MTQ", "HUR"];

const DETRACTION_CATALOG = [
  { code: "0", label: "NO APLICA", percent: 0.00 },
  { code: "001", label: "Azúcar y melaza de caña", percent: 10.00 },
  { code: "010", label: "Residuos, subproductos, desechos", percent: 15.00 },
  { code: "012", label: "Intermediación laboral", percent: 12.00 },
  { code: "020", label: "Mantenimiento y reparación", percent: 12.00 },
  { code: "022", label: "Otros servicios empresariales", percent: 12.00 },
  { code: "025", label: "Fabricación por encargo", percent: 10.00 },
  { code: "027", label: "Transporte de bienes", percent: 4.00 },
  { code: "030", label: "Contratos de construcción", percent: 4.00 },
  { code: "037", label: "Demás servicios gravados con IGV", percent: 12.00 }
];

// Catálogo de motivos de Nota de Crédito (según manual de integración NubeFact)
const NOTA_CREDITO_CATALOG = [
  { code: 1, label: "ANULACIÓN DE LA OPERACIÓN" },
  { code: 2, label: "ANULACIÓN POR ERROR EN EL RUC" },
  { code: 3, label: "CORRECCIÓN POR ERROR EN LA DESCRIPCIÓN" },
  { code: 4, label: "DESCUENTO GLOBAL" },
  { code: 5, label: "DESCUENTO POR ÍTEM" },
  { code: 6, label: "DEVOLUCIÓN TOTAL" },
  { code: 7, label: "DEVOLUCIÓN POR ÍTEM" },
  { code: 8, label: "BONIFICACIÓN" },
  { code: 9, label: "DISMINUCIÓN EN EL VALOR" },
  { code: 10, label: "OTROS CONCEPTOS" },
  { code: 11, label: "AJUSTES AFECTOS AL IVAP" },
  { code: 12, label: "AJUSTES DE OPERACIONES DE EXPORTACIÓN" },
  { code: 13, label: "AJUSTES - MONTOS Y/O FECHAS DE PAGO" },
];

// Catálogo de motivos de Nota de Débito (según manual de integración NubeFact)
const NOTA_DEBITO_CATALOG = [
  { code: 1, label: "INTERESES POR MORA" },
  { code: 2, label: "AUMENTO EN EL VALOR" },
  { code: 3, label: "PENALIDADES" },
  { code: 4, label: "AJUSTES AFECTOS AL IVAP" },
  { code: 5, label: "AJUSTES DE OPERACIONES DE EXPORTACIÓN" },
];

// Helper para sumar días a una fecha DD/MM/YYYY
const addDaysToDate = (dateStr: string, days: number): string => {
  if (!dateStr) return "";
  const [day, month, year] = dateStr.split('/').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  const d = date.getDate().toString().padStart(2, '0');
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
};

// DD/MM/YYYY -> YYYY-MM-DD
const formatDateForInput = (dateStr: string): string => {
  if (!dateStr) return "";
  const [day, month, year] = dateStr.split('/');
  return `${year}-${month}-${day}`;
};

// YYYY-MM-DD -> DD/MM/YYYY
const formatDateFromInput = (dateStr: string): string => {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
};

function App() {
  const [invoice, setInvoice] = useState<InvoiceData>(initialInvoice);
  const [items, setItems] = useState<InvoiceItem[]>([{ ...initialItem, id: generateId() }]);

  // Estado para Cuotas (0 = Contado, 1-3 = Crédito)
  const [numCuotas, setNumCuotas] = useState<number>(0);
  const [cuotas, setCuotas] = useState<CreditInstallment[]>([]);
  const [firstInstallmentDate, setFirstInstallmentDate] = useState<string>("");

  const [isDetractionModalOpen, setIsDetractionModalOpen] = useState(false);
  const [loadingTipoCambio, setLoadingTipoCambio] = useState(false);
  // "Opciones adicionales" (detracción, fondo de garantía, orden de compra) empieza desplegado.
  const [showOpcionesAdicionales, setShowOpcionesAdicionales] = useState(true);

  const [projectsList, setProjectsList] = useState<string[]>([]);
  const [serviceLinesList, setServiceLinesList] = useState<string[]>([]);
  const [unitsList, setUnitsList] = useState<string[]>(DEFAULT_UNITS);

  useEffect(() => {
    // Load lists from DB
    getProjects().then(data => {
        if (data && data.length > 0) setProjectsList(data);
        else setProjectsList(DEFAULT_PROJECTS);
    }).catch(e => {
        console.error("Error loading projects", e);
        setProjectsList(DEFAULT_PROJECTS);
    });

    getServiceLines().then(data => {
        if (data && data.length > 0) setServiceLinesList(data);
        else setServiceLinesList(DEFAULT_SERVICE_LINES);
    }).catch(e => {
        console.error("Error loading service lines", e);
        setServiceLinesList(DEFAULT_SERVICE_LINES);
    });
  }, []);

  useEffect(() => {
    // Check for invoice data in URL params (from replication)
    const params = new URLSearchParams(window.location.search);
    const replicatedData = params.get('replicate_data');
    if (replicatedData) {
        try {
            const decoded = JSON.parse(decodeURIComponent(replicatedData));
            // Ensure dates are reset or kept based on logic (usually keep same date or set to today)
            // Here we keep the original data but maybe update emission date to today if needed.
            // For exact replica, we keep everything.

            // Generate new IDs for items to avoid conflicts if needed, though for a new window it doesn't matter much.
            const newItems = decoded.items.map((item: any) => ({...item, id: generateId()}));

            setInvoice({...decoded.invoice, fecha_de_emision: getTodayForInput()}); // Reset date to today for new invoice
            setItems(newItems);
            setNumCuotas(decoded.numCuotas);
            setCuotas(decoded.cuotas);

            // Clean URL
            window.history.replaceState({}, document.title, window.location.pathname);
        } catch (e) {
            console.error("Error parsing replicated data", e);
        }
    }
  }, []);

  const [connStatus, setConnStatus] = useState<ConnectionStatus>('checking');
  const [connMessage, setConnMessage] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<NubeFactResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Estados para el Modal de Entrada (Proyectos / Lineas)
  const [inputModalOpen, setInputModalOpen] = useState(false);
  const [inputModalTarget, setInputModalTarget] = useState<'proyecto' | 'linea_servicio' | null>(null);
  const [inputModalTitle, setInputModalTitle] = useState("");

  // Estado para la vista completa de "Comprobantes" (listado, filtros, anulación)
  const [comprobantesViewOpen, setComprobantesViewOpen] = useState(false);
  // Estado para la vista de "Comunicaciones de Baja" (anulaciones ante SUNAT y su ticket)
  const [bajaViewOpen, setBajaViewOpen] = useState(false);
  // Estado para el "Consolidado de Facturas, Boletas y Notas" (reporte global + export a Excel)
  const [consolidadoViewOpen, setConsolidadoViewOpen] = useState(false);

  // Notificaciones tipo "toast" (reemplazan los alert() nativos del navegador)
  const showToast = (message: string, type: ToastType = 'success') => {
    toast.add({ description: message, type });
  };

  // Estado para el modal de búsqueda del comprobante original (Nota de Crédito)
  const [isOriginalDocModalOpen, setIsOriginalDocModalOpen] = useState(false);

  // true = el documento en pantalla ya existe en la BD (borrador/comprobante cargado para editar),
  // por lo que su número NO debe autogenerarse. false = documento nuevo a punto de emitirse.
  const [isExistingRecord, setIsExistingRecord] = useState(false);

  // Autogenera el número siguiente disponible. Mientras el documento sea un borrador (serie
  // "BORR") es solo un correlativo interno propio, independiente del tipo de comprobante
  // (BORR-1, BORR-2, ...). Recién cuando se emite se le asigna el correlativo real de SUNAT
  // para ese tipo + serie real (ver handleSubmit). Así un borrador nunca choca con una factura
  // ya emitida ni bloquea el envío por "documento duplicado".
  useEffect(() => {
    if (isExistingRecord) return;
    let cancelled = false;
    (async () => {
      try {
        const invoices = await getInvoices();
        if (cancelled) return;
        const isBorradorSerie = invoice.serie === BORRADOR_SERIE;
        const maxNumero = invoices.reduce((max: number, inv: any) => {
          if (isBorradorSerie) {
            if (inv.serie !== BORRADOR_SERIE) return max;
          } else if (inv.tipo_de_comprobante !== invoice.tipo_de_comprobante || inv.serie !== invoice.serie) {
            return max;
          }
          return Math.max(max, Number(inv.numero) || 0);
        }, 0);
        const nextNumero = maxNumero + 1;
        setInvoice(prev => (Number(prev.numero) === nextNumero ? prev : { ...prev, numero: nextNumero }));
      } catch (e) {
        console.error('No se pudo calcular el siguiente correlativo automáticamente:', e);
        // 0 = sentinel: bloquea la emisión (ver missingRequired) en vez de dejar un número que
        // podría no ser el correlativo real si la consulta falló.
        setInvoice(prev => (Number(prev.numero) === 0 ? prev : { ...prev, numero: 0 }));
        showToast('No se pudo calcular el siguiente correlativo (revisa tu conexión). Verifica el número antes de emitir.', 'error');
      }
    })();
    return () => { cancelled = true; };
  }, [invoice.tipo_de_comprobante, invoice.serie, isExistingRecord]);

  // Las credenciales de NubeFact ya no se ingresan en pantalla: viven como variables de
  // entorno del servidor (NUBEFACT_ROUTE / NUBEFACT_TOKEN). Esto solo verifica que el
  // servidor pueda contactar a NubeFact con lo que haya configurado.
  useEffect(() => {
    const verifyConnection = async () => {
      setConnStatus('checking');
      const result = await checkConnection();
      if (result.success) {
        setConnStatus('connected');
        setConnMessage(result.message);
      } else {
        setConnStatus('error');
        setConnMessage(result.message);
      }
    };
    verifyConnection();
  }, []);

  useEffect(() => {
    const totals = calculateInvoiceTotals(items);
    let detractionAmount = 0;
    if (invoice.detraccion && invoice.detraccion_porcentaje) {
      // Este monto queda en la MISMA moneda de la factura (afecta el neto a pagar / cuotas,
      // que también están en esa moneda). El equivalente en Soles que realmente se deposita
      // en el Banco de la Nación se calcula aparte, solo para mostrarlo (ver handleGenerateInfo).
      detractionAmount = Math.round(totals.total * (invoice.detraccion_porcentaje / 100));
    }
    setInvoice(prev => ({
      ...prev,
      items: items,
      total_gravada: totals.total_gravada,
      total_igv: totals.total_igv,
      total: totals.total,
      total_detraccion: detractionAmount
    }));
  }, [items, invoice.detraccion, invoice.detraccion_porcentaje]);

  // Efecto para recalcular cuotas automáticamente si cambia el total y estamos en modo crédito
  useEffect(() => {
      if (numCuotas > 0) {
          const fondoGarantia = parseFloat(invoice.fondo_garantia_monto || "0");
          const netAmount = invoice.total - (invoice.total_detraccion || 0) - fondoGarantia;

          if (netAmount > 0) {
            // Solo recalcular si los montos actuales no suman el total (evitar sobrescribir ediciones manuales si ya cuadran)
            const sumaActual = cuotas.reduce((acc, c) => acc + c.importe, 0);
            if (Math.abs(sumaActual - netAmount) > 0.1) {
                distributeTotalToCuotas(numCuotas, netAmount);
            }
          }
      }
  }, [invoice.total, invoice.total_detraccion, invoice.fondo_garantia_monto]);

  // Update fecha_de_vencimiento when cuotas change
  useEffect(() => {
    if (numCuotas > 0 && cuotas.length > 0) {
      const lastCuota = cuotas[cuotas.length - 1];
      if (lastCuota && lastCuota.fecha_de_pago) {
        setInvoice(prev => ({
          ...prev,
          fecha_de_vencimiento: lastCuota.fecha_de_pago
        }));
      }
    }
  }, [cuotas, numCuotas]);

  // Autoajusta la altura del panel de Observación cuando el texto generado se
  // estira (detracción + fondo de garantía + O/C + cuentas bancarias, etc.),
  // en vez de quedarse recortado con scroll interno.
  const observacionesRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = observacionesRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [invoice.observaciones]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;

    if (name === 'detraccion_toggle') {
        const isDetraction = value === 'SI';
        setInvoice(prev => ({
            ...prev,
            detraccion: isDetraction,
            detraccion_codigo: isDetraction ? prev.detraccion_codigo : "",
            detraccion_porcentaje: isDetraction ? prev.detraccion_porcentaje : 0,
            total_detraccion: 0
        }));
        return;
    }

    const numValue = (name === 'tipo_de_comprobante' || name === 'cliente_tipo_de_documento' || name === 'moneda')
      ? parseInt(value)
      : value;

    setInvoice(prev => ({ ...prev, [name]: numValue }));
  };

  const handleClientSelect = (client: Client) => {
    setInvoice(prev => ({
        ...prev,
        cliente_numero_de_documento: client.numero_documento,
        cliente_denominacion: client.denominacion,
        cliente_direccion: client.direccion,
        cliente_email: client.email || prev.cliente_email
    }));
  };

  const handleDetractionSelect = (item: { code: string; label: string; percent: number }) => {
    setInvoice(prev => ({ ...prev, detraccion_codigo: item.code, detraccion_porcentaje: item.percent }));
    setIsDetractionModalOpen(false);
  };

  const handleTipoComprobanteChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = parseInt(e.target.value);
    const isNotaCredito = val === 3;
    const isNotaDebito = val === 4;
    const isNota = isNotaCredito || isNotaDebito;

    setInvoice(prev => ({
      ...prev,
      tipo_de_comprobante: val,
      // Limpiar campos propios de Nota de Crédito/Débito si se vuelve a Factura
      documento_que_se_modifica_tipo: isNota ? (prev.documento_que_se_modifica_tipo || 1) : "",
      documento_que_se_modifica_serie: isNota ? prev.documento_que_se_modifica_serie : "",
      documento_que_se_modifica_numero: isNota ? prev.documento_que_se_modifica_numero : "",
      tipo_de_nota_de_credito: isNotaCredito ? prev.tipo_de_nota_de_credito : "",
      tipo_de_nota_de_debito: isNotaDebito ? prev.tipo_de_nota_de_debito : "",
    }));

    if (isNota) {
      // Una Nota de Crédito/Débito no maneja cronograma de cuotas
      setNumCuotas(0);
      setCuotas([]);
    }
  };

  // Trae el tipo de cambio SUNAT (venta) publicado para la fecha de emisión de la factura,
  // usado para convertir a Soles el monto de la detracción cuando la factura está en Dólares.
  const handleFetchTipoCambio = async () => {
      const [d, m, y] = (invoice.fecha_de_emision || '').split('/');
      if (!d || !m || !y) {
          showToast('Ingresa primero la fecha de emisión.', 'error');
          return;
      }
      setLoadingTipoCambio(true);
      try {
          const fechaISO = `${y}-${m}-${d}`;
          const data = await getTipoCambioSunat(fechaISO);
          setInvoice(prev => ({ ...prev, tipo_de_cambio: String(data.venta) }));
          showToast(`Tipo de cambio SUNAT (venta) del ${data.fecha}: ${data.venta}`, 'success');
      } catch (e: any) {
          showToast('No se pudo obtener el tipo de cambio automáticamente: ' + e.message, 'error');
      } finally {
          setLoadingTipoCambio(false);
      }
  };

  // Carga los datos (cliente + ítems) del comprobante original que la Nota de Crédito modifica
  const handleSelectOriginalInvoice = (loadedInvoice: any) => {
    setInvoice(prev => ({
      ...prev,
      cliente_numero_de_documento: loadedInvoice.cliente_numero_de_documento,
      cliente_denominacion: loadedInvoice.cliente_denominacion,
      cliente_direccion: loadedInvoice.cliente_direccion,
      cliente_email: loadedInvoice.cliente_email || prev.cliente_email,
      moneda: loadedInvoice.moneda,
      documento_que_se_modifica_tipo: loadedInvoice.tipo_de_comprobante,
      documento_que_se_modifica_serie: loadedInvoice.serie,
      documento_que_se_modifica_numero: loadedInvoice.numero,
    }));

    if (loadedInvoice.items && loadedInvoice.items.length > 0) {
      const mappedItems = loadedInvoice.items.map((item: any) => ({
        ...item,
        id: generateId(),
        cantidad: Number(item.cantidad),
        valor_unitario: Number(item.valor_unitario),
        precio_unitario: Number(item.precio_unitario),
        subtotal: Number(item.subtotal),
        igv: Number(item.igv),
        total: Number(item.total)
      }));
      setItems(mappedItems);
    }
  };

  // Lógica para distribuir el total entre las cuotas
  const distributeTotalToCuotas = (count: number, totalOverride?: number, startDateOverride?: string) => {
      const fondoGarantia = parseFloat(invoice.fondo_garantia_monto || "0");
      const netAmount = totalOverride !== undefined ? totalOverride : (invoice.total - (invoice.total_detraccion || 0) - fondoGarantia);

      if (netAmount <= 0 && count > 0) return;

      const baseAmount = Math.floor((netAmount / count) * 100) / 100;
      const remainder = parseFloat((netAmount - (baseAmount * count)).toFixed(2));

      const newCuotas: CreditInstallment[] = [];
      let currentDate = startDateOverride || firstInstallmentDate || addDaysToDate(invoice.fecha_de_emision, 30);
      let previousDate = currentDate;

      for (let i = 0; i < count; i++) {
          let dateForThisInstallment;

          if (i === 0) {
              dateForThisInstallment = currentDate;
          } else {
              // Sumar 30 días a la fecha anterior para la siguiente cuota
              dateForThisInstallment = addDaysToDate(previousDate, 30);
          }
          previousDate = dateForThisInstallment;

          // La primera cuota se lleva el remanente (diferencia por redondeo)
          const amount = i === 0 ? parseFloat((baseAmount + remainder).toFixed(2)) : baseAmount;

          newCuotas.push({
              cuota: i + 1,
              fecha_de_pago: dateForThisInstallment,
              importe: amount
          });
      }
      setCuotas(newCuotas);
  };

  const handlePaymentModeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const val = parseInt(e.target.value);
      setNumCuotas(val);

      if (val === 0) {
          // Contado
          setInvoice(prev => ({ ...prev, tipo_de_venta: 'Contado', medio_de_pago: 'Efectivo', fecha_de_vencimiento: '' }));
          setCuotas([]);
          setFirstInstallmentDate("");
      } else {
          // Crédito
          setInvoice(prev => ({ ...prev, tipo_de_venta: 'Crédito', medio_de_pago: 'credito' }));

          // Si no hay fecha inicial establecida, usar fecha emisión + 30 días
          let startDate = firstInstallmentDate;
          if (!startDate) {
              startDate = addDaysToDate(invoice.fecha_de_emision, 30);
              setFirstInstallmentDate(startDate);
          }

          distributeTotalToCuotas(val, undefined, startDate);
      }
  };

  const handleFirstInstallmentDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const dateVal = e.target.value; // YYYY-MM-DD
      if (!dateVal) return;

      const dateDDMMYYYY = formatDateFromInput(dateVal);
      setFirstInstallmentDate(dateDDMMYYYY);

      if (numCuotas > 0) {
          distributeTotalToCuotas(numCuotas, undefined, dateDDMMYYYY);
      }
  };

  const handleCuotaChange = (index: number, field: keyof CreditInstallment, value: any) => {
      const updatedCuotas = [...cuotas];
      updatedCuotas[index] = { ...updatedCuotas[index], [field]: field === 'importe' ? parseFloat(value) : value };
      setCuotas(updatedCuotas);
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const { name, checked } = e.target;
      setInvoice(prev => ({ ...prev, [name]: checked }));
  };

  const handleItemChange = (id: string, field: keyof InvoiceItem, value: any) => {
    setItems(prevItems => prevItems.map(item => {
      if (item.id !== id) return item;
      const updatedItem = { ...item, [field]: value };
      if (field === 'cantidad' || field === 'valor_unitario') {
        const qty = field === 'cantidad' ? Number(value) : item.cantidad;
        const valor = field === 'valor_unitario' ? Number(value) : item.valor_unitario;
        return { ...updatedItem, ...calculateItemTotals(qty, valor) };
      }
      return updatedItem;
    }));
  };

  // Al elegir un ítem del catálogo de inventario de ayala, autocompleta código,
  // descripción, precio y (si coincide con el catálogo SUNAT) la unidad de medida.
  const handleSelectCatalogItem = (id: string, catalogItem: CatalogItem) => {
    setItems(prevItems => prevItems.map(item => {
      if (item.id !== id) return item;
      const um = catalogItem.u_m?.toUpperCase().trim();
      const unidad_de_medida = um && unitsList.includes(um) ? um : item.unidad_de_medida;
      const updatedItem = {
        ...item,
        codigo: catalogItem.codigo,
        descripcion: catalogItem.descripcion,
        valor_unitario: catalogItem.precio_unitario,
        unidad_de_medida,
      };
      return { ...updatedItem, ...calculateItemTotals(updatedItem.cantidad, catalogItem.precio_unitario) };
    }));
  };

  const addItem = () => setItems(prev => [...prev, { ...initialItem, id: generateId() }]);
  const removeItem = (id: string) => items.length > 1 && setItems(prev => prev.filter(item => item.id !== id));

  const handleAddOption = (target: 'proyecto' | 'linea_servicio', title: string) => {
      setInputModalTarget(target);
      setInputModalTitle(title);
      setInputModalOpen(true);
  };

  const handleInputModalConfirm = async (value: string) => {
      if (!inputModalTarget) return;

      const trimmed = value.trim();
      if (!trimmed) return;

      try {
          if (inputModalTarget === 'proyecto') {
              if (!projectsList.includes(trimmed)) {
                  await addProject(trimmed);
                  setProjectsList(prev => [...prev, trimmed]);
              }
              setInvoice(prev => ({ ...prev, proyecto: trimmed }));
          } else if (inputModalTarget === 'linea_servicio') {
              if (!serviceLinesList.includes(trimmed)) {
                  await addServiceLine(trimmed);
                  setServiceLinesList(prev => [...prev, trimmed]);
              }
              setInvoice(prev => ({ ...prev, linea_servicio: trimmed }));
          }
      } catch (e) {
          console.error(e);
          showToast("Error al guardar nuevo item", 'error');
      }

      setInputModalOpen(false);
  };

  const handleGenerateInfo = () => {
      const fondoGarantia = parseFloat(invoice.fondo_garantia_monto || "0");
      const netoPagar = invoice.total - (invoice.total_detraccion || 0) - fondoGarantia;
      const currencySymbol = invoice.moneda === 1 ? 'S/' : '$';

      const lines: string[] = [];

      lines.push(`NETO A PAGAR: ${currencySymbol} ${netoPagar.toFixed(2)}`);

      if (fondoGarantia > 0) {
          lines.push(`FONDO DE GARANTÍA: ${currencySymbol} ${fondoGarantia.toFixed(2)}`);
      }

      // Orden de Compra
      if (invoice.orden_compra && invoice.orden_compra_numero) {
          lines.push(`ORDEN DE COMPRA/SERVICIO: ${invoice.orden_compra_numero}`);
      }

      lines.push("CUENTAS BANCARIAS:");
      lines.push("Banco BCP (Soles)");
      lines.push("Cta. Cte.: 191-2551705-0-96");
      lines.push("CCI: 002-191-002551705096-56");

      if (invoice.detraccion) {
          lines.push("Banco de la Nación (Detracciones): 00-050-045072");
          lines.push("INFORMACIÓN DE LA DETRACCIÓN:");

          const detractionItem = DETRACTION_CATALOG.find(d => d.code === invoice.detraccion_codigo);
          const desc = detractionItem ? ` - ${detractionItem.label}` : "";

          lines.push(`Bien/Servicio: ${invoice.detraccion_codigo}${desc}`);
          lines.push(`Porcentaje: ${invoice.detraccion_porcentaje?.toFixed(2)}%`);

          // El depósito de la detracción siempre se hace en Soles. Si la factura está en
          // Dólares, hay que convertir el monto con el tipo de cambio del día.
          if (invoice.moneda === 2) {
              const tipoCambio = parseFloat(invoice.tipo_de_cambio || '0');
              if (tipoCambio > 0) {
                  const montoSoles = Math.round((invoice.total_detraccion || 0) * tipoCambio);
                  lines.push(`Tipo de Cambio: ${tipoCambio.toFixed(3)}`);
                  lines.push(`Monto Detracción: S/ ${montoSoles.toFixed(2)} (equivalente a $ ${invoice.total_detraccion?.toFixed(2)})`);
              } else {
                  lines.push(`Monto Detracción: falta indicar el Tipo de Cambio para calcular el monto en Soles`);
              }
          } else {
              lines.push(`Monto Detracción: S/ ${invoice.total_detraccion?.toFixed(2)}`);
          }
      }

      // Condiciones de Pago
      let paymentString = `CONDICIONES DE PAGO: ${numCuotas > 0 ? 'CRÉDITO' : 'CONTADO'}`;

      if (numCuotas > 0) {
           const lastDate = cuotas.length > 0 ? cuotas[cuotas.length - 1].fecha_de_pago : '';
           paymentString += ` - ${cuotas.length} CUOTA(S)`;
           if (lastDate) paymentString += ` - VENC: ${lastDate}`;
      } else {
           paymentString += ` - EFECTIVO`;
      }
      lines.push(paymentString);

      setInvoice(prev => ({ ...prev, observaciones: lines.join("\n") }));
  };

  // Deja el formulario completamente en blanco para el siguiente documento, con la serie real
  // (FFF1) y su siguiente correlativo ya calculados por defecto. Se calcula acá mismo (no se
  // deja al efecto de autogeneración) porque si el tipo/serie no cambian respecto al documento
  // recién guardado, ese efecto no se dispararía y el número se quedaría pegado.
  const resetFormForNextInvoice = async () => {
      setIsExistingRecord(false);
      // 0 = sentinel: si falla el cálculo, NO se debe asumir "1" (pisaría el correlativo real).
      // canSubmit lo bloquea hasta que el usuario verifique/corrija el número manualmente.
      let nextNumero = 0;
      try {
          const invoices = await getInvoices();
          const max = invoices.reduce((acc: number, inv: any) => (
              inv.tipo_de_comprobante === initialInvoice.tipo_de_comprobante && inv.serie === REAL_SERIE
                  ? Math.max(acc, Number(inv.numero) || 0) : acc
          ), 0);
          nextNumero = max + 1;
      } catch (e) {
          console.error('No se pudo calcular el siguiente correlativo:', e);
          showToast('No se pudo calcular el siguiente correlativo (revisa tu conexión). Verifica el número antes de emitir.', 'error');
      }
      setInvoice({
          ...initialInvoice,
          fecha_de_emision: getTodayForInput(),
          numero: nextNumero,
      });
      setItems([{ ...initialItem, id: generateId() }]);
      setNumCuotas(0);
      setCuotas([]);
      setFirstInstallmentDate("");
      setShowOpcionesAdicionales(true);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    setResponse(null);
    try {
      if (!invoice.cliente_numero_de_documento) throw new Error("Falta el documento del cliente");
      if (items.length === 0) throw new Error("Debe agregar al menos un item");

      if (invoice.tipo_de_comprobante === 3) {
        if (!invoice.documento_que_se_modifica_serie || !invoice.documento_que_se_modifica_numero) {
          throw new Error("Para la Nota de Crédito debe indicar la serie y número del comprobante que se modifica");
        }
        if (!invoice.tipo_de_nota_de_credito) {
          throw new Error("Debe seleccionar el motivo (tipo) de la Nota de Crédito");
        }
      }

      if (invoice.tipo_de_comprobante === 4) {
        if (!invoice.documento_que_se_modifica_serie || !invoice.documento_que_se_modifica_numero) {
          throw new Error("Para la Nota de Débito debe indicar la serie y número del comprobante que se modifica");
        }
        if (!invoice.tipo_de_nota_de_debito) {
          throw new Error("Debe seleccionar el motivo (tipo) de la Nota de Débito");
        }
      }

      const existingInvoices = await getInvoices();

      // Si todavía es un borrador (serie "BORR-N", un correlativo interno propio), recién al
      // emitirlo se le asigna la serie y el correlativo real de SUNAT para este tipo de
      // comprobante — así nunca choca con el número de un borrador ni con otra factura emitida.
      let serieToUse = invoice.serie;
      let numeroToUse = Number(invoice.numero);
      if (serieToUse === BORRADOR_SERIE) {
        const maxReal = existingInvoices.reduce((max: number, inv: any) => {
          if (inv.tipo_de_comprobante !== invoice.tipo_de_comprobante || inv.serie !== REAL_SERIE) return max;
          return Math.max(max, Number(inv.numero) || 0);
        }, 0);
        serieToUse = REAL_SERIE;
        numeroToUse = maxReal + 1;
      }

      // Verificación de duplicados: evita reenviar a NubeFact/SUNAT un mismo tipo+serie+número
      // que ya exista localmente, en vez de depender solo del rechazo remoto
      // ("Este documento ya existe en NubeFacT").
      const duplicate = existingInvoices.find((inv: any) =>
        Number(inv.id) !== Number(invoice.id) &&
        inv.tipo_de_comprobante === invoice.tipo_de_comprobante &&
        inv.serie === serieToUse &&
        Number(inv.numero) === numeroToUse
      );
      if (duplicate) {
        throw new Error(`Ya existe un comprobante ${serieToUse}-${numeroToUse} de este tipo (estado: ${duplicate.estado || 'EMITIDO'}). Cambia el número antes de emitir.`);
      }

      const isCredit = numCuotas > 0;

      // Validar cuotas
      if (isCredit) {
          const fondoGarantia = parseFloat(invoice.fondo_garantia_monto || "0");
          const totalNeto = invoice.total - (invoice.total_detraccion || 0) - fondoGarantia;
          const sumaCuotas = cuotas.reduce((acc, c) => acc + c.importe, 0);

          if (Math.abs(totalNeto - sumaCuotas) > 0.1) {
              throw new Error(`La suma de las cuotas (${sumaCuotas.toFixed(2)}) no coincide con el total neto (${totalNeto.toFixed(2)})`);
          }
      }

      let condicionesPagoStr = isCredit ? 'CREDITO' : 'CONTADO';

      if (isCredit) {
         const lastDate = cuotas.length > 0 ? cuotas[cuotas.length - 1].fecha_de_pago : '';
         condicionesPagoStr += ` - ${cuotas.length} CUOTAS`;
         if (lastDate) condicionesPagoStr += ` - VENC: ${lastDate}`;
      } else {
         condicionesPagoStr += ` - EFECTIVO`;
      }

      const invoicePayload = {
        ...invoice,
        serie: serieToUse,
        numero: numeroToUse,
        fecha_de_emision: formatToSunatDate(invoice.fecha_de_emision),
        // Si es crédito, la fecha de vencimiento es la última cuota
        fecha_de_vencimiento: isCredit && cuotas.length > 0
            ? formatToSunatDate(cuotas[cuotas.length - 1].fecha_de_pago)
            : "",

        condicion_de_pago: isCredit ? 'CREDITO' : 'CONTADO',
        medio_de_pago: isCredit ? "credito" : "Efectivo", // Según tu JSON, credito para cuotas
        condiciones_de_pago: condicionesPagoStr,

        // Mapear cuotas al formato SUNAT (DD-MM-YYYY)
        venta_al_credito: isCredit ? cuotas.map(c => ({
            cuota: c.cuota,
            fecha_de_pago: formatToSunatDate(c.fecha_de_pago),
            importe: c.importe
        })) : undefined
      };

      const result = await sendInvoice(invoicePayload);
      setResponse(result);

      // Save to Database if successful
      if (result && !result.errors) {
          try {
              // Update invoice payload with NubeFact links if available
              const dbPayload = {
                  ...invoicePayload,
                  nubefact_enlace_pdf: result.enlace_del_pdf,
                  nubefact_enlace_xml: result.enlace_del_xml,
                  nubefact_enlace_cdr: result.enlace_del_cdr,
                  nubefact_sunat_description: result.sunat_description,
                  estado: 'EMITIDO' as const
              };
              await saveInvoiceToDb(dbPayload);
              console.log("Factura guardada en base de datos local");
              showToast(`${invoicePayload.serie}-${invoicePayload.numero} emitido correctamente.`, 'success');

              // Deja el formulario en blanco, listo para el siguiente documento.
              await resetFormForNextInvoice();
          } catch (dbError) {
              console.error("No se pudo guardar en BD local:", dbError);
              // La SUNAT YA aceptó este comprobante (consumió el correlativo real) aunque no se
              // pudo guardar localmente. Si se sigue como si nada, el próximo cálculo de
              // correlativo (que solo mira la BD local) no lo va a ver y va a repetir este mismo
              // número — NubeFact lo rechazaría como duplicado. Se avisa fuerte y se adelanta el
              // correlativo en memoria para esta sesión.
              showToast(
                  `${invoicePayload.serie}-${invoicePayload.numero} fue ACEPTADO por SUNAT pero no se pudo guardar en el sistema local (revisa tu conexión a la base de datos). Anota este número: no lo reutilices.`,
                  'error'
              );
              setIsExistingRecord(false);
              setInvoice({
                  ...initialInvoice,
                  fecha_de_emision: getTodayForInput(),
                  serie: serieToUse,
                  numero: numeroToUse + 1,
              });
              setItems([{ ...initialItem, id: generateId() }]);
              setNumCuotas(0);
              setCuotas([]);
              setFirstInstallmentDate("");
              setShowOpcionesAdicionales(true);
          }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReplicateInvoice = () => {
    const dataToReplicate = {
        invoice: {
            ...invoice,
            id: undefined,
            // La pestaña nueva recalcula su propio correlativo real (FFF1) al montarse.
            serie: REAL_SERIE,
            numero: 0,
        },
        items,
        numCuotas,
        cuotas
    };

    const encodedData = encodeURIComponent(JSON.stringify(dataToReplicate));
    const url = `${window.location.origin}${window.location.pathname}?replicate_data=${encodedData}`;
    window.open(url, '_blank');
  };

  const handleSaveDraft = async () => {
    setLoading(true);
    try {
        if (!invoice.cliente_numero_de_documento) {
            showToast("Para guardar un borrador, al menos seleccione un cliente.", 'error');
            setLoading(false);
            return;
        }

        // Un borrador no debe "reservar" el correlativo real (FFF1-N): si el documento todavía
        // no tiene su propio número de borrador (BORR-N), se le asigna acá recién al guardarlo.
        let serieToUse = invoice.serie;
        let numeroToUse = invoice.numero;
        if (serieToUse !== BORRADOR_SERIE) {
            const existingInvoices = await getInvoices();
            const maxBorr = existingInvoices.reduce((max: number, inv: any) => (
                inv.serie === BORRADOR_SERIE ? Math.max(max, Number(inv.numero) || 0) : max
            ), 0);
            serieToUse = BORRADOR_SERIE;
            numeroToUse = maxBorr + 1;
        }

        const draftInvoice = {
            ...invoice,
            serie: serieToUse,
            numero: numeroToUse,
            estado: 'BORRADOR' as const,
            fecha_de_emision: formatToSunatDate(invoice.fecha_de_emision),
            fecha_de_vencimiento: invoice.fecha_de_vencimiento ? formatToSunatDate(invoice.fecha_de_vencimiento) : "",
            items: items,
            venta_al_credito: numCuotas > 0 ? cuotas.map(c => ({
                cuota: c.cuota,
                fecha_de_pago: formatToSunatDate(c.fecha_de_pago),
                importe: c.importe
            })) : undefined
        };

        const result = await saveInvoiceToDb(draftInvoice);
        if (result && result.success) {
            showToast(`Borrador ${draftInvoice.serie}-${draftInvoice.numero} guardado exitosamente.`, 'success');
            // Deja el formulario en blanco, listo para el siguiente documento. Si se necesita
            // retomar este borrador más tarde, se puede abrir desde "Comprobantes" > Editar.
            await resetFormForNextInvoice();
        } else {
            showToast("Error al guardar el borrador.", 'error');
        }
    } catch (e: any) {
        console.error(e);
        showToast("Error al guardar borrador: " + e.message, 'error');
    } finally {
        setLoading(false);
    }
  };

  const handleLoadDraft = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Legacy file loading support
    const fileReader = new FileReader();
    if (e.target.files && e.target.files.length > 0) {
        fileReader.readAsText(e.target.files[0], "UTF-8");
        fileReader.onload = (event) => {
            if (event.target && event.target.result) {
                try {
                    const parsedData = JSON.parse(event.target.result as string);

                    // Basic validation
                    if (parsedData.invoice && parsedData.items) {
                        setInvoice(parsedData.invoice);
                        setItems(parsedData.items);
                        setNumCuotas(parsedData.numCuotas || 0);
                        setCuotas(parsedData.cuotas || []);
                        setFirstInstallmentDate(""); // Reset for loaded draft

                        // Ensure projects/services are added to lists if not present (y persistidos en la BD)
                        if (parsedData.invoice.proyecto && !projectsList.includes(parsedData.invoice.proyecto)) {
                            setProjectsList(prev => [...prev, parsedData.invoice.proyecto]);
                            addProject(parsedData.invoice.proyecto).catch(console.error);
                        }
                        if (parsedData.invoice.linea_servicio && !serviceLinesList.includes(parsedData.invoice.linea_servicio)) {
                            setServiceLinesList(prev => [...prev, parsedData.invoice.linea_servicio]);
                            addServiceLine(parsedData.invoice.linea_servicio).catch(console.error);
                        }

                        showToast("Borrador cargado exitosamente", 'success');
                    } else {
                        showToast("El archivo no tiene el formato correcto de borrador", 'error');
                    }
                } catch (error) {
                    console.error("Error parsing draft", error);
                    showToast("Error al leer el archivo de borrador", 'error');
                }
            }
        };
    }
    // Reset input
    e.target.value = '';
  };

  const handleSelectInvoiceFromList = (loadedInvoice: any) => {
      // Es un documento ya existente en la BD: su número no debe autogenerarse/sobrescribirse.
      setIsExistingRecord(true);
      // Map loaded invoice back to state
      // MySQL devuelve las columnas DECIMAL como strings (ej. "500.00"); hay que convertirlas
      // a number o el render (.toFixed()) revienta.
      setInvoice({
          ...loadedInvoice,
          fecha_de_emision: loadedInvoice.fecha_de_emision || getTodayForInput(),
          fecha_de_vencimiento: loadedInvoice.fecha_de_vencimiento || "",
          detraccion: Boolean(Number(loadedInvoice.detraccion)),
          porcentaje_de_igv: Number(loadedInvoice.porcentaje_de_igv) || 18,
          total_gravada: Number(loadedInvoice.total_gravada) || 0,
          total_inafecta: loadedInvoice.total_inafecta || "",
          total_exonerada: loadedInvoice.total_exonerada || "",
          total_igv: Number(loadedInvoice.total_igv) || 0,
          total_gratuita: loadedInvoice.total_gratuita || "",
          total_otros_cargos: loadedInvoice.total_otros_cargos || "",
          total: Number(loadedInvoice.total) || 0,
          total_detraccion: Number(loadedInvoice.total_detraccion) || 0,
          detraccion_porcentaje: Number(loadedInvoice.detraccion_porcentaje) || 0,
          // Si el backend no pudo traer el tipo de documento del cliente (ej. cliente eliminado),
          // se infiere por longitud para no romper el reenvío a NubeFact ("Tipo de documento no existe").
          cliente_tipo_de_documento: loadedInvoice.cliente_tipo_de_documento
              || ((loadedInvoice.cliente_numero_de_documento || '').length === 11 ? 6 : 1),
          // "fondo_garantia" y "orden_compra" son casillas de la UI que no existen como tales en la BD;
          // se infieren de si hay un monto/número guardado para que se muestren al editar.
          fondo_garantia: Number(loadedInvoice.fondo_garantia_monto) > 0,
          fondo_garantia_monto: Number(loadedInvoice.fondo_garantia_monto) > 0 ? String(loadedInvoice.fondo_garantia_monto) : "",
          orden_compra: !!loadedInvoice.orden_compra_numero,
          orden_compra_numero: loadedInvoice.orden_compra_numero || "",
          proyecto: loadedInvoice.proyecto || "",
          linea_servicio: loadedInvoice.linea_servicio || "",
      });

      // Si el comprobante cargado ya usa detracción, fondo de garantía u orden de compra,
      // se muestra la sección abierta para que no quede oculta sin que el usuario lo note.
      if (Boolean(Number(loadedInvoice.detraccion)) || Number(loadedInvoice.fondo_garantia_monto) > 0 || !!loadedInvoice.orden_compra_numero) {
          setShowOpcionesAdicionales(true);
      }

      // Map items
      if (loadedInvoice.items) {
          const mappedItems = loadedInvoice.items.map((item: any) => ({
              ...item,
              id: generateId(), // Regenerate IDs for UI consistency
              // Ensure numbers are numbers
              cantidad: Number(item.cantidad),
              valor_unitario: Number(item.valor_unitario),
              precio_unitario: Number(item.precio_unitario),
              subtotal: Number(item.subtotal),
              igv: Number(item.igv),
              total: Number(item.total)
          }));
          setItems(mappedItems);
      }

      // Map cuotas if credit
      if (loadedInvoice.venta_al_credito && loadedInvoice.venta_al_credito.length > 0) {
          setNumCuotas(loadedInvoice.venta_al_credito.length);
          const mappedCuotas = loadedInvoice.venta_al_credito.map((c: any) => ({
              cuota: c.cuota,
              fecha_de_pago: formatToSunatDate(c.fecha_de_pago),
              importe: Number(c.importe)
          }));
          setCuotas(mappedCuotas);

          // Set first installment date for UI
          if (mappedCuotas.length > 0) {
              setFirstInstallmentDate(mappedCuotas[0].fecha_de_pago);
          }
      } else {
          setNumCuotas(0);
          setCuotas([]);
          setFirstInstallmentDate("");
      }

      // Update lists if needed (y persistir en la BD para que aparezcan en futuras facturas)
      if (loadedInvoice.proyecto && !projectsList.includes(loadedInvoice.proyecto)) {
          setProjectsList(prev => [...prev, loadedInvoice.proyecto]);
          addProject(loadedInvoice.proyecto).catch(console.error);
      }
      if (loadedInvoice.linea_servicio && !serviceLinesList.includes(loadedInvoice.linea_servicio)) {
          setServiceLinesList(prev => [...prev, loadedInvoice.linea_servicio]);
          addServiceLine(loadedInvoice.linea_servicio).catch(console.error);
      }
  };

  // Usa un comprobante existente (desde el listado de "Comprobantes") como base para emitir uno nuevo
  // (ej. "Generar otra FACTURA" a partir de una Boleta ya emitida): copia cliente e ítems, pero
  // lo trata como un documento nuevo (serie/número a definir, sin enlaces ni estado previos).
  const handleGenerateNewFromInvoice = async (row: ComprobanteRow, targetTipo: number) => {
      try {
          const fullInvoice = await getInvoiceById(row.id);
          handleSelectInvoiceFromList(fullInvoice);
          // Es un documento NUEVO (aunque se use uno existente como base): su número debe autogenerarse.
          setIsExistingRecord(false);
          setInvoice(prev => ({
              ...prev,
              id: undefined,
              tipo_de_comprobante: targetTipo,
              serie: REAL_SERIE,
              numero: 0,
              estado: undefined,
              documento_que_se_modifica_tipo: "",
              documento_que_se_modifica_serie: "",
              documento_que_se_modifica_numero: "",
              tipo_de_nota_de_credito: "",
              nubefact_enlace_pdf: undefined,
              nubefact_enlace_xml: undefined,
              nubefact_enlace_cdr: undefined,
              nubefact_sunat_description: undefined,
          }));
          setResponse(null);
          setError(null);
          setComprobantesViewOpen(false);
      } catch (e: any) {
          showToast('Error al cargar el comprobante base: ' + e.message, 'error');
      }
  };

  const sectionTitleClass = "text-sm font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2";
  const isCredit = numCuotas > 0;

  // Calculos de validación visual
  const fondoGarantiaVal = parseFloat(invoice.fondo_garantia_monto || "0");
  const netoPagar = invoice.total - (invoice.total_detraccion || 0) - fondoGarantiaVal;
  const sumaCuotas = cuotas.reduce((acc, c) => acc + (c.importe || 0), 0);
  const diffCuotas = netoPagar - sumaCuotas;

  const missingRequired: string[] = [];
  if (!invoice.cliente_numero_de_documento) missingRequired.push('el documento del cliente');
  if (items.length === 0 || !items.some(it => it.descripcion.trim() && it.cantidad > 0)) missingRequired.push('al menos un ítem con descripción');
  if (!Number(invoice.numero) || Number(invoice.numero) <= 0) missingRequired.push('un número de comprobante válido (no se pudo calcular el correlativo automáticamente, revisa tu conexión)');
  const canSubmit = missingRequired.length === 0;

  const unitItems = Object.fromEntries(unitsList.map(u => [u, u]));

  return (
    <div className="min-h-screen pb-6 font-sans">
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-200/80 shadow-sm px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
              <span className={`hidden sm:flex h-9 w-9 items-center justify-center rounded-xl text-white font-black text-sm shadow-lg shadow-primary-600/30 bg-gradient-to-br ${invoice.tipo_de_comprobante === 3 ? 'from-purple-500 to-fuchsia-600' : invoice.tipo_de_comprobante === 4 ? 'from-amber-500 to-orange-600' : 'from-primary-500 to-violet-600'}`}>
                  NF
              </span>
              <h1 className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight">
                  {invoice.tipo_de_comprobante === 3 ? 'Nueva Nota de Crédito' : invoice.tipo_de_comprobante === 4 ? 'Nueva Nota de Débito' : 'Nueva Factura'}
              </h1>
          </div>

          <nav className="flex items-center gap-1 rounded-lg border border-gray-200/80 bg-gray-50/80 p-1 order-3 w-full sm:order-none sm:w-auto">
              <Button variant="ghost" size="sm" className="flex-1 sm:flex-none text-gray-600 hover:text-gray-900" onClick={() => setComprobantesViewOpen(true)}>
                  <ReceiptIcon data-icon="inline-start" />
                  Ver comprobantes
              </Button>
              <Button variant="ghost" size="sm" className="flex-1 sm:flex-none text-gray-600 hover:text-gray-900" onClick={() => setConsolidadoViewOpen(true)}>
                  <LayoutListIcon data-icon="inline-start" />
                  Consolidado
              </Button>
              <Button variant="ghost" size="sm" className="flex-1 sm:flex-none text-gray-600 hover:text-gray-900" onClick={() => setBajaViewOpen(true)}>
                  <BanIcon data-icon="inline-start" />
                  Comunicaciones de baja
              </Button>
          </nav>

          <div className="flex items-center gap-3">
             {connStatus === 'connected' ? (
                 <Badge className="gap-2 bg-emerald-50 py-1 pr-3 text-emerald-700 border-emerald-200" title={connMessage}>
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    API Activa
                 </Badge>
             ) : connStatus === 'checking' ? (
                 <Badge className="gap-2 bg-amber-50 py-1 pr-3 text-amber-700 border-amber-200">
                    <Loader2Icon className="size-3.5 animate-spin" />
                    Verificando...
                 </Badge>
             ) : (
                 <Badge className="gap-2 bg-rose-50 py-1 pr-3 text-rose-700 border-rose-200" title={connMessage}>
                    <span className="h-2 w-2 rounded-full bg-rose-500" />
                    Sin conexión con NubeFact
                 </Badge>
             )}
          </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-3 space-y-3">
        <div className="bg-white/90 backdrop-blur rounded-2xl shadow-md shadow-gray-900/5 border border-gray-100 p-4">

            {/* ENCABEZADO FACTURA */}
            <div className="flex flex-col md:flex-row justify-between gap-4 mb-4 pb-4 border-b border-gray-100">
                {/* LADO IZQUIERDO: CLIENTE */}
                <div className="w-full md:w-1/2 space-y-2">
                    <h2 className={sectionTitleClass}>
                        <span className="flex items-center justify-center h-7 w-7 rounded-lg bg-primary-100 text-primary-600">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                        </span>
                        Datos del Cliente
                    </h2>
                    <div className="grid grid-cols-12 gap-3">
                        <div className="col-span-4">
                            <FieldLabel className="mb-1 text-xs font-semibold text-gray-600">Documento <span className="text-rose-500">*</span></FieldLabel>
                            <ClientSearch currentValue={invoice.cliente_numero_de_documento} onChange={handleInputChange} onSelect={handleClientSelect} />
                            {!invoice.cliente_numero_de_documento && (
                                <p className="text-[11px] text-rose-500 mt-1">Requerido para emitir</p>
                            )}
                        </div>
                        <div className="col-span-8">
                            <Field>
                                <FieldLabel htmlFor="cliente_denominacion">Razón Social <span className="text-rose-500">*</span></FieldLabel>
                                <Input id="cliente_denominacion" name="cliente_denominacion" value={invoice.cliente_denominacion} onChange={handleInputChange} className="bg-gray-50 font-medium" />
                            </Field>
                        </div>
                        <div className="col-span-12">
                            <Field>
                                <FieldLabel htmlFor="cliente_direccion">Dirección</FieldLabel>
                                <Input id="cliente_direccion" name="cliente_direccion" value={invoice.cliente_direccion} onChange={handleInputChange} className="text-xs" placeholder="Dirección fiscal" />
                            </Field>
                        </div>
                    </div>
                </div>

                {/* LADO DERECHO: DATOS COMPROBANTE */}
                <div className={`w-full md:w-1/3 p-3 rounded-xl border shadow-sm ${invoice.tipo_de_comprobante === 3 ? 'bg-gradient-to-br from-purple-50 to-fuchsia-50 border-purple-200' : invoice.tipo_de_comprobante === 4 ? 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200' : 'bg-gradient-to-br from-primary-50 to-indigo-50 border-primary-100'}`}>
                    <FieldLabel className="mb-1 text-xs font-semibold text-gray-600">Tipo de comprobante</FieldLabel>
                    <div className="flex justify-between items-center mb-2">
                        <Select
                            items={{ '1': 'FACTURA ELECTRÓNICA', '3': 'NOTA DE CRÉDITO ELECTRÓNICA', '4': 'NOTA DE DÉBITO ELECTRÓNICA' }}
                            value={String(invoice.tipo_de_comprobante)}
                            onValueChange={(v) => handleTipoComprobanteChange({ target: { value: v ?? '1' } } as any)}
                        >
                            <SelectTrigger className={`w-fit border-0 bg-transparent p-0 text-lg font-bold shadow-none focus-visible:ring-0 ${invoice.tipo_de_comprobante === 3 ? 'text-purple-700' : invoice.tipo_de_comprobante === 4 ? 'text-amber-700' : 'text-gray-800'}`}>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    <SelectItem value="1">FACTURA ELECTRÓNICA</SelectItem>
                                    <SelectItem value="3">NOTA DE CRÉDITO ELECTRÓNICA</SelectItem>
                                    <SelectItem value="4">NOTA DE DÉBITO ELECTRÓNICA</SelectItem>
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <Field>
                            <FieldLabel htmlFor="serie">Serie</FieldLabel>
                            <Input id="serie" name="serie" value={invoice.serie} onChange={handleInputChange} className="font-mono text-center" />
                        </Field>
                        <Field>
                            <FieldLabel htmlFor="numero">Número</FieldLabel>
                            <Input id="numero" type="number" name="numero" value={invoice.numero} onChange={handleInputChange} className="font-mono text-center font-bold text-lg" />
                        </Field>
                        <Field>
                            <FieldLabel htmlFor="fecha_de_emision">Fecha Emisión</FieldLabel>
                            <Input id="fecha_de_emision" name="fecha_de_emision" value={invoice.fecha_de_emision} onChange={handleInputChange} placeholder="DD/MM/YYYY" />
                        </Field>
                        <Field>
                            <FieldLabel htmlFor="moneda">Moneda</FieldLabel>
                            <Select
                                items={{ '1': 'SOLES', '2': 'DOLARES' }}
                                value={String(invoice.moneda)}
                                onValueChange={(v) => handleInputChange({ target: { name: 'moneda', value: v ?? '1' } } as any)}
                            >
                                <SelectTrigger id="moneda" className="w-full"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectGroup>
                                        <SelectItem value="1">SOLES</SelectItem>
                                        <SelectItem value="2">DOLARES</SelectItem>
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                        </Field>
                        {invoice.moneda === 2 && (
                            <Field>
                                <FieldLabel htmlFor="tipo_de_cambio">Tipo de Cambio (S/ x $)</FieldLabel>
                                <div className="flex gap-1">
                                    <Input
                                        id="tipo_de_cambio"
                                        type="number"
                                        step="0.001"
                                        name="tipo_de_cambio"
                                        value={invoice.tipo_de_cambio || ''}
                                        onChange={handleInputChange}
                                        placeholder="Ej: 3.75"
                                    />
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="icon"
                                        onClick={handleFetchTipoCambio}
                                        disabled={loadingTipoCambio}
                                        title="Obtener tipo de cambio SUNAT del día de emisión"
                                    >
                                        <RefreshCwIcon className={loadingTipoCambio ? 'animate-spin' : ''} />
                                    </Button>
                                </div>
                            </Field>
                        )}
                    </div>

                    {(invoice.tipo_de_comprobante === 3 || invoice.tipo_de_comprobante === 4) && (
                        <div className={`mt-4 pt-4 border-t ${invoice.tipo_de_comprobante === 4 ? 'border-amber-200' : 'border-purple-200'}`}>
                            <div className="flex justify-between items-center mb-2">
                                <h3 className={`text-xs font-bold uppercase tracking-wider ${invoice.tipo_de_comprobante === 4 ? 'text-amber-700' : 'text-purple-700'}`}>Documento que se Modifica</h3>
                                <Button type="button" variant="link" size="sm" onClick={() => setIsOriginalDocModalOpen(true)}>
                                    Buscar comprobante...
                                </Button>
                            </div>
                            <div className="grid grid-cols-2 gap-2 mb-2">
                                <Field>
                                    <FieldLabel htmlFor="doc_modifica_tipo">Tipo Doc.</FieldLabel>
                                    <Select
                                        items={{ '': '--', '1': 'FACTURA', '2': 'BOLETA' }}
                                        value={String(invoice.documento_que_se_modifica_tipo ?? '')}
                                        onValueChange={(v) => handleInputChange({ target: { name: 'documento_que_se_modifica_tipo', value: v ?? '' } } as any)}
                                    >
                                        <SelectTrigger id="doc_modifica_tipo" className="w-full"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectGroup>
                                                <SelectItem value="">--</SelectItem>
                                                <SelectItem value="1">FACTURA</SelectItem>
                                                <SelectItem value="2">BOLETA</SelectItem>
                                            </SelectGroup>
                                        </SelectContent>
                                    </Select>
                                </Field>
                                <Field>
                                    <FieldLabel htmlFor="doc_modifica_serie">Serie</FieldLabel>
                                    <Input id="doc_modifica_serie" name="documento_que_se_modifica_serie" value={invoice.documento_que_se_modifica_serie || ''} onChange={handleInputChange} className="font-mono" />
                                </Field>
                            </div>
                            <div className="grid grid-cols-2 gap-2 mb-2">
                                <Field>
                                    <FieldLabel htmlFor="doc_modifica_numero">Número</FieldLabel>
                                    <Input id="doc_modifica_numero" name="documento_que_se_modifica_numero" value={invoice.documento_que_se_modifica_numero || ''} onChange={handleInputChange} className="font-mono" />
                                </Field>
                            </div>
                            {invoice.tipo_de_comprobante === 3 ? (
                                <Field>
                                    <FieldLabel htmlFor="tipo_nota_credito">Motivo (Tipo de Nota de Crédito)</FieldLabel>
                                    <Select
                                        items={{ '': 'Seleccionar...', ...Object.fromEntries(NOTA_CREDITO_CATALOG.map(item => [String(item.code), `${item.code} - ${item.label}`])) }}
                                        value={String(invoice.tipo_de_nota_de_credito ?? '')}
                                        onValueChange={(v) => handleInputChange({ target: { name: 'tipo_de_nota_de_credito', value: v ?? '' } } as any)}
                                    >
                                        <SelectTrigger id="tipo_nota_credito" className="w-full text-xs"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectGroup>
                                                <SelectItem value="">Seleccionar...</SelectItem>
                                                {NOTA_CREDITO_CATALOG.map(item => (
                                                    <SelectItem key={item.code} value={String(item.code)}>{item.code} - {item.label}</SelectItem>
                                                ))}
                                            </SelectGroup>
                                        </SelectContent>
                                    </Select>
                                </Field>
                            ) : (
                                <Field>
                                    <FieldLabel htmlFor="tipo_nota_debito">Motivo (Tipo de Nota de Débito)</FieldLabel>
                                    <Select
                                        items={{ '': 'Seleccionar...', ...Object.fromEntries(NOTA_DEBITO_CATALOG.map(item => [String(item.code), `${item.code} - ${item.label}`])) }}
                                        value={String(invoice.tipo_de_nota_de_debito ?? '')}
                                        onValueChange={(v) => handleInputChange({ target: { name: 'tipo_de_nota_de_debito', value: v ?? '' } } as any)}
                                    >
                                        <SelectTrigger id="tipo_nota_debito" className="w-full text-xs"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectGroup>
                                                <SelectItem value="">Seleccionar...</SelectItem>
                                                {NOTA_DEBITO_CATALOG.map(item => (
                                                    <SelectItem key={item.code} value={String(item.code)}>{item.code} - {item.label}</SelectItem>
                                                ))}
                                            </SelectGroup>
                                        </SelectContent>
                                    </Select>
                                </Field>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* CONDICIÓN DE PAGO / PROYECTO / LÍNEA DE SERVICIO — lo que se usa en casi toda factura */}
            <div className="grid grid-cols-12 gap-3 mb-3 bg-gray-50 p-2.5 rounded border border-gray-100">
                <div className="col-span-12 md:col-span-3">
                    <FieldLabel className="mb-1 text-xs font-semibold text-gray-600">Condición de Pago</FieldLabel>
                    {invoice.tipo_de_comprobante === 3 || invoice.tipo_de_comprobante === 4 ? (
                        <div className="flex h-8 w-full items-center rounded-lg border bg-gray-100 px-2.5 text-sm text-gray-400 italic">No aplica</div>
                    ) : (
                        <Select
                            items={{ '0': 'CONTADO', '1': 'CRÉDITO - 1 Cuota', '2': 'CRÉDITO - 2 Cuotas', '3': 'CRÉDITO - 3 Cuotas' }}
                            value={String(numCuotas)}
                            onValueChange={(v) => handlePaymentModeChange({ target: { value: v ?? '0' } } as any)}
                        >
                            <SelectTrigger className={`w-full font-bold text-gray-800 ${isCredit ? 'border-2 border-blue-400 bg-blue-50' : ''}`}><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    <SelectItem value="0">CONTADO</SelectItem>
                                    <SelectItem value="1">CRÉDITO - 1 Cuota</SelectItem>
                                    <SelectItem value="2">CRÉDITO - 2 Cuotas</SelectItem>
                                    <SelectItem value="3">CRÉDITO - 3 Cuotas</SelectItem>
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                    )}
                </div>

                <div className="col-span-12 md:col-span-4">
                    <FieldLabel className="mb-1 text-xs font-semibold text-gray-600">Proyecto</FieldLabel>
                    <div className="flex gap-1.5">
                        <Select
                            items={{ '': 'Seleccionar...', ...Object.fromEntries(projectsList.map(p => [p, p])) }}
                            value={invoice.proyecto || ''}
                            onValueChange={(v) => handleInputChange({ target: { name: 'proyecto', value: v ?? '' } } as any)}
                        >
                            <SelectTrigger className="w-full text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    <SelectItem value="">Seleccionar...</SelectItem>
                                    {projectsList.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                        <Button variant="outline" size="icon" onClick={() => handleAddOption('proyecto', 'Nuevo')} type="button">
                            <PlusIcon />
                        </Button>
                    </div>
                </div>
                <div className="col-span-12 md:col-span-5">
                    <FieldLabel className="mb-1 text-xs font-semibold text-gray-600">Línea Servicio</FieldLabel>
                    <div className="flex gap-1.5">
                        <Select
                            items={{ '': 'Seleccionar...', ...Object.fromEntries(serviceLinesList.map(l => [l, l])) }}
                            value={invoice.linea_servicio || ''}
                            onValueChange={(v) => handleInputChange({ target: { name: 'linea_servicio', value: v ?? '' } } as any)}
                        >
                            <SelectTrigger className="w-full text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    <SelectItem value="">Seleccionar...</SelectItem>
                                    {serviceLinesList.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                        <Button variant="outline" size="icon" onClick={() => handleAddOption('linea_servicio', 'Nueva')} type="button">
                            <PlusIcon />
                        </Button>
                    </div>
                </div>
            </div>

            {/* OPCIONES ADICIONALES: Detracción / Fondo de Garantía / Orden de Compra — no aplican
                a toda factura, así que quedan plegadas salvo que ya estén en uso. */}
            <div className={`mb-4 border rounded-xl overflow-hidden transition-colors ${showOpcionesAdicionales ? 'border-amber-200' : 'border-gray-100'}`}>
                <button
                    type="button"
                    onClick={() => setShowOpcionesAdicionales(s => !s)}
                    className={`w-full flex justify-between items-center px-3 py-2.5 text-left transition-colors ${showOpcionesAdicionales ? 'bg-amber-50' : ''}`}
                >
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Opciones adicionales
                        {(invoice.detraccion || invoice.fondo_garantia || invoice.orden_compra) && (
                            <Badge className="bg-amber-100 text-amber-700 normal-case tracking-normal">En uso</Badge>
                        )}
                    </span>
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 text-gray-400 transition-transform ${showOpcionesAdicionales ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>
                {showOpcionesAdicionales && (
                    <div className="grid grid-cols-12 gap-3 px-3 pb-2 pt-2 border-t border-amber-100 bg-amber-50/50 animate-fade-in-down">
                        <div className="col-span-6 md:col-span-2">
                            <FieldLabel className="mb-1 text-xs font-semibold text-gray-600">Detracción</FieldLabel>
                            <Select
                                items={{ NO: 'NO', SI: 'SI' }}
                                value={invoice.detraccion ? 'SI' : 'NO'}
                                onValueChange={(v) => handleInputChange({ target: { name: 'detraccion_toggle', value: v ?? 'NO' } } as any)}
                            >
                                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectGroup>
                                        <SelectItem value="NO">NO</SelectItem>
                                        <SelectItem value="SI">SI</SelectItem>
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="col-span-12 md:col-span-6 flex items-end pb-1 gap-3">
                             <label className="flex items-center gap-1.5 text-xs">
                                <Checkbox checked={invoice.fondo_garantia || false} onCheckedChange={(checked) => handleCheckboxChange({ target: { name: 'fondo_garantia', checked } } as any)} />
                                Fondo Gto.
                             </label>
                             {invoice.fondo_garantia && (
                                 <Input name="fondo_garantia_monto" value={invoice.fondo_garantia_monto} onChange={handleInputChange} placeholder="Monto" className="w-24" />
                             )}
                             <label className="flex items-center gap-1.5 text-xs ml-2">
                                <Checkbox checked={invoice.orden_compra || false} onCheckedChange={(checked) => handleCheckboxChange({ target: { name: 'orden_compra', checked } } as any)} />
                                O/C
                             </label>
                             {invoice.orden_compra && (
                                 <Input name="orden_compra_numero" value={invoice.orden_compra_numero} onChange={handleInputChange} placeholder="Nro O/C" className="w-28" />
                             )}
                        </div>
                    </div>
                )}
            </div>

            {/* SECCION EDITOR DE CUOTAS */}
            {isCredit && (
                <div className="mb-4 border border-blue-200 rounded-lg overflow-hidden animate-fade-in-down shadow-sm">
                    <div className="bg-blue-50 px-4 py-2 border-b border-blue-200 flex flex-wrap justify-between items-center gap-2">
                        <div className="flex items-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <h3 className="text-sm font-bold text-blue-900">Cronograma de Pagos</h3>
                        </div>

                        <div className="flex items-center bg-white px-2 py-1 rounded border border-blue-200 shadow-sm">
                             <label className="text-xs font-semibold text-blue-800 mr-2">1ra Cuota:</label>
                             <input
                                 type="date"
                                 value={formatDateForInput(firstInstallmentDate)}
                                 onChange={handleFirstInstallmentDateChange}
                                 className="text-xs border-0 focus:ring-0 p-0 text-gray-700 font-medium bg-transparent"
                             />
                        </div>

                        <Button variant="outline" size="sm" onClick={() => distributeTotalToCuotas(numCuotas)}>
                            <RefreshCwIcon data-icon="inline-start" />
                            Recalcular
                        </Button>
                    </div>
                    <div className="p-3 bg-white overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-16"># Cuota</TableHead>
                                    <TableHead>Fecha de Vencimiento</TableHead>
                                    <TableHead className="text-right">Importe</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {cuotas.map((cuota, idx) => (
                                    <TableRow key={idx}>
                                        <TableCell>
                                            <Badge variant="secondary">#{cuota.cuota}</Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                value={cuota.fecha_de_pago}
                                                onChange={(e) => handleCuotaChange(idx, 'fecha_de_pago', e.target.value)}
                                                placeholder="DD/MM/YYYY"
                                                className="w-48"
                                            />
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="relative inline-block w-40">
                                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">{invoice.moneda === 1 ? 'S/' : '$'}</span>
                                                <Input
                                                    type="number"
                                                    value={cuota.importe}
                                                    onChange={(e) => handleCuotaChange(idx, 'importe', e.target.value)}
                                                    step="0.01"
                                                    className="pl-6 text-right font-bold"
                                                />
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        <div className="flex justify-between items-center text-sm border-t pt-3 mt-2 bg-gray-50 -mx-4 -mb-4 px-4 pb-3">
                             <div className="flex items-center">
                                 <span className="text-gray-600 mr-2 font-medium">Validación:</span>
                                 <Badge variant={Math.abs(diffCuotas) > 0.1 ? 'destructive' : 'default'}>
                                    {Math.abs(diffCuotas) > 0.1 ? `Diferencia: ${diffCuotas.toFixed(2)}` : 'Correcto'}
                                 </Badge>
                             </div>
                             <div className="text-right flex space-x-6">
                                <span className="text-gray-500">Total Factura: <strong>{netoPagar.toFixed(2)}</strong></span>
                                <span className="text-gray-800">Total Cuotas: <strong className="text-lg">{sumaCuotas.toFixed(2)}</strong></span>
                             </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="mt-4">
                <div className="flex justify-between items-center mb-2">
                    <h3 className={sectionTitleClass + " mb-0"}>
                        <span className="flex items-center justify-center h-7 w-7 rounded-lg bg-emerald-100 text-emerald-600">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                            </svg>
                        </span>
                        Ítems del Comprobante <span className="text-rose-500">*</span>
                    </h3>
                    <Button size="sm" onClick={addItem}>
                        <PlusIcon data-icon="inline-start" />
                        Agregar ítem
                    </Button>
                </div>
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-primary-50 hover:bg-primary-50">
                                <TableHead className="w-10">#</TableHead>
                                <TableHead className="w-24">Cod</TableHead>
                                <TableHead>Descripción</TableHead>
                                <TableHead className="w-20 text-center">UM</TableHead>
                                <TableHead className="w-20 text-right">Cant</TableHead>
                                <TableHead className="w-24 text-right">Valor U.</TableHead>
                                <TableHead className="w-24 text-right">Total</TableHead>
                                <TableHead className="w-10" />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {items.map((item, index) => (
                                <TableRow key={item.id}>
                                    <TableCell className="text-xs text-muted-foreground">{index + 1}</TableCell>
                                    <TableCell><Input value={item.codigo} onChange={(e) => handleItemChange(item.id, 'codigo', e.target.value)} className="h-7 border-0 shadow-none" placeholder="Cod" /></TableCell>
                                    <TableCell>
                                        <ItemSearch
                                            value={item.descripcion}
                                            onChange={(e) => handleItemChange(item.id, 'descripcion', e.target.value)}
                                            onSelect={(catalogItem) => handleSelectCatalogItem(item.id, catalogItem)}
                                            className="h-7"
                                            placeholder="Descripción del servicio o bien"
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Select
                                            items={unitItems}
                                            value={item.unidad_de_medida}
                                            onValueChange={(v) => handleItemChange(item.id, 'unidad_de_medida', v ?? item.unidad_de_medida)}
                                        >
                                            <SelectTrigger className="h-7 w-full border-0 bg-transparent shadow-none"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectGroup>
                                                    {unitsList.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                                                </SelectGroup>
                                            </SelectContent>
                                        </Select>
                                    </TableCell>
                                    <TableCell><Input type="number" value={item.cantidad} onChange={(e) => handleItemChange(item.id, 'cantidad', e.target.value)} className="h-7 text-right" /></TableCell>
                                    <TableCell><Input type="number" value={item.valor_unitario} onChange={(e) => handleItemChange(item.id, 'valor_unitario', e.target.value)} className="h-7 text-right" /></TableCell>
                                    <TableCell className="text-right text-xs font-semibold text-foreground">{item.subtotal.toFixed(2)}</TableCell>
                                    <TableCell className="text-center">
                                        <Button variant="ghost" size="icon-sm" onClick={() => removeItem(item.id)} title="Quitar ítem" className="text-destructive hover:text-destructive">
                                            <XIcon />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-8">
                     <div className="flex justify-between items-center mb-1">
                        <FieldLabel className="text-xs font-semibold text-gray-600">Observación</FieldLabel>
                        <Button variant="outline" size="sm" onClick={handleGenerateInfo}>
                            <FileTextIcon data-icon="inline-start" />
                            Generar Info Automática
                        </Button>
                     </div>
                     <Textarea ref={observacionesRef} name="observaciones" value={invoice.observaciones} onChange={handleInputChange} className="min-h-20 max-h-80 overflow-y-auto text-xs" />
                </div>
                <div className="md:col-span-4">
                  <div className="bg-gradient-to-br from-primary-600 via-primary-600 to-violet-700 p-3 rounded-2xl shadow-lg shadow-primary-600/30 text-white">
                    <div className="flex justify-between mb-1 text-primary-100"><span className="text-sm">Subtotal:</span><span className="font-medium text-white">{invoice.moneda === 2 ? '$' : 'S/'} {invoice.total_gravada.toFixed(2)}</span></div>
                    <div className="flex justify-between mb-2 text-primary-100"><span className="text-sm">IGV (18%):</span><span className="font-medium text-white">{invoice.moneda === 2 ? '$' : 'S/'} {invoice.total_igv.toFixed(2)}</span></div>

                    {invoice.detraccion && (
                        <div className="flex justify-between text-rose-100 bg-white/10 text-sm cursor-pointer hover:bg-white/20 p-1.5 -mx-1 rounded-lg mb-1 transition-colors" onClick={() => setIsDetractionModalOpen(true)}>
                            <span>Detracción ({invoice.detraccion_porcentaje}%):</span>
                            <span>-{invoice.total_detraccion?.toFixed(2)}</span>
                        </div>
                    )}

                    <div className="flex justify-between items-baseline border-t border-white/20 pt-2 mb-3">
                        <span className="font-bold text-primary-100 text-sm uppercase tracking-wide">Total</span>
                        <span className="font-black text-3xl text-white tracking-tight">{invoice.moneda === 2 ? '$' : 'S/'} {invoice.total.toFixed(2)}</span>
                    </div>

                    {!canSubmit && (
                        <p className="text-[11px] text-amber-100 bg-white/10 rounded-lg px-2 py-1.5 mb-2 flex items-start gap-1.5">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            Falta {missingRequired.join(' y ')}.
                        </p>
                    )}

                    <Button
                        onClick={handleSubmit}
                        disabled={loading || !canSubmit}
                        title={!canSubmit ? `Falta ${missingRequired.join(' y ')}` : undefined}
                        className="w-full bg-white text-primary-800 font-black py-2.5 hover:bg-primary-50 disabled:opacity-50"
                    >
                        {loading ? 'EMITIENDO...' : invoice.tipo_de_comprobante === 3 ? 'EMITIR NOTA DE CRÉDITO' : invoice.tipo_de_comprobante === 4 ? 'EMITIR NOTA DE DÉBITO' : 'EMITIR AHORA'}
                    </Button>
                    <Button variant="outline" onClick={handleSaveDraft} className="w-full mt-2 border-white/40 bg-transparent text-white hover:bg-white/10">
                        Guardar borrador
                    </Button>
                  </div>
                </div>
            </div>
        </div>
      </div>

      <DetractionModal isOpen={isDetractionModalOpen} onClose={() => setIsDetractionModalOpen(false)} onSelect={handleDetractionSelect} catalog={DETRACTION_CATALOG} />
      <InputModal
          isOpen={inputModalOpen}
          onClose={() => setInputModalOpen(false)}
          onConfirm={handleInputModalConfirm}
          title={inputModalTitle}
      />
      <InvoiceListModal
          isOpen={isOriginalDocModalOpen}
          onClose={() => setIsOriginalDocModalOpen(false)}
          onSelectInvoice={handleSelectOriginalInvoice}
      />
      <ComprobantesListView
          isOpen={comprobantesViewOpen}
          onClose={() => setComprobantesViewOpen(false)}
          onSelectInvoice={handleSelectInvoiceFromList}
          onGenerateNew={handleGenerateNewFromInvoice}
          onOpenBajas={() => { setComprobantesViewOpen(false); setBajaViewOpen(true); }}
          onOpenConsolidado={() => { setComprobantesViewOpen(false); setConsolidadoViewOpen(true); }}
          onNotify={showToast}
      />
      <ComunicacionesBajaView
          isOpen={bajaViewOpen}
          onClose={() => setBajaViewOpen(false)}
          onOpenComprobantes={() => { setBajaViewOpen(false); setComprobantesViewOpen(true); }}
          onOpenConsolidado={() => { setBajaViewOpen(false); setConsolidadoViewOpen(true); }}
          onNotify={showToast}
      />
      <ConsolidadoView
          isOpen={consolidadoViewOpen}
          onClose={() => setConsolidadoViewOpen(false)}
          onOpenComprobantes={() => { setConsolidadoViewOpen(false); setComprobantesViewOpen(true); }}
          onOpenBajas={() => { setConsolidadoViewOpen(false); setBajaViewOpen(true); }}
          onNotify={showToast}
      />
      <ResponseViewer response={response} loading={loading} error={error} onClose={() => { setResponse(null); setError(null); }} />
    </div>
  );
}

export default App;
