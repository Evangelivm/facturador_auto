'use client';

import React, { useEffect, useState } from 'react';
import { anularComprobante, consultarComprobante, consultarAnulacion } from '@/services/nubefactService';
import { anularInvoiceInDb, deleteInvoiceFromDb, updateInvoiceStatus, registrarPagoEnDb, actualizarEstadoBajaEnDb } from '@/services/databaseService';
import { ToastType } from '@/types';
import { formatFecha } from '@/lib/consolidadoReport';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FieldLabel } from '@/components/ui/field';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { PrinterIcon, CircleCheckIcon, CircleXIcon, RefreshCwIcon } from 'lucide-react';

export interface ComprobanteRow {
  id: number;
  tipo_de_comprobante: number;
  serie: string;
  numero: number;
  cliente_numero_de_documento?: string;
  cliente_denominacion?: string;
  total: number | string;
  moneda: number;
  estado?: string;
  motivo_anulacion?: string;
  nubefact_enlace_pdf?: string;
  nubefact_enlace_xml?: string;
  nubefact_enlace_cdr?: string;
  nubefact_sunat_description?: string;
  nubefact_error?: string;
  fecha_anulacion?: string;
  nubefact_baja_ticket?: string;
  nubefact_baja_aceptada?: boolean | null;
  nubefact_baja_description?: string;
  nubefact_baja_enlace_pdf?: string;
  nubefact_baja_enlace_xml?: string;
  nubefact_baja_enlace_cdr?: string;
  pagado?: boolean | number;
  fecha_pago?: string;
  comprobante_pago_data?: string;
}

interface ComprobanteOptionsModalProps {
  isOpen: boolean;
  invoice: ComprobanteRow | null;
  onClose: () => void;
  onChanged: () => void;
  onGenerateNew: (invoice: ComprobanteRow, targetTipo: number) => void;
  onNotify: (message: string, type?: ToastType) => void;
}

const TIPO_LABELS: Record<number, string> = {
  1: 'FACTURA ELECTRÓNICA',
  2: 'BOLETA DE VENTA ELECTRÓNICA',
  3: 'NOTA DE CRÉDITO ELECTRÓNICA',
  4: 'NOTA DE DÉBITO ELECTRÓNICA'
};

export const ComprobanteOptionsModal: React.FC<ComprobanteOptionsModalProps> = ({
  isOpen, invoice, onClose, onChanged, onGenerateNew, onNotify
}) => {
  const [showAnularForm, setShowAnularForm] = useState(false);
  const [motivo, setMotivo] = useState('ERROR DEL SISTEMA');
  const [anulando, setAnulando] = useState(false);
  const [anulacionResult, setAnulacionResult] = useState<any>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [consultando, setConsultando] = useState(false);
  const [consultandoBaja, setConsultandoBaja] = useState(false);
  const [showPagoForm, setShowPagoForm] = useState(false);
  const [pagoFecha, setPagoFecha] = useState('');
  const [pagoArchivoData, setPagoArchivoData] = useState<string | null>(null);
  const [pagoArchivoNombre, setPagoArchivoNombre] = useState('');
  const [registrandoPago, setRegistrandoPago] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShowAnularForm(false);
      setMotivo('ERROR DEL SISTEMA');
      setAnulando(false);
      setAnulacionResult(null);
      setLocalError(null);
      setConsultando(false);
      setConsultandoBaja(false);
      setShowPagoForm(false);
      setPagoFecha(new Date().toISOString().slice(0, 10));
      setPagoArchivoData(null);
      setPagoArchivoNombre('');
      setRegistrandoPago(false);
    }
  }, [isOpen, invoice?.id]);

  const openLink = (url?: string) => {
    if (!url) {
      onNotify('Este enlace no está disponible para este comprobante.', 'info');
      return;
    }
    window.open(url, '_blank');
  };

  const handleWhatsApp = () => {
    if (!invoice) return;
    const link = invoice.nubefact_enlace_pdf || '';
    const tipoLabel = TIPO_LABELS[invoice.tipo_de_comprobante] || 'COMPROBANTE';
    const text = `${tipoLabel} ${invoice.serie}-${invoice.numero}${link ? ' - ' + link : ''}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleEmail = () => {
    if (!invoice) return;
    const email = window.prompt('Ingresa el email del destinatario:');
    if (!email) return;
    const tipoLabel = TIPO_LABELS[invoice.tipo_de_comprobante] || 'COMPROBANTE';
    const subject = `${tipoLabel} ${invoice.serie}-${invoice.numero}`;
    const body = [
      `Adjunto el comprobante ${invoice.serie}-${invoice.numero}.`,
      '',
      invoice.nubefact_enlace_pdf ? `PDF: ${invoice.nubefact_enlace_pdf}` : null,
      invoice.nubefact_enlace_xml ? `XML: ${invoice.nubefact_enlace_xml}` : null,
      invoice.nubefact_enlace_cdr ? `CDR: ${invoice.nubefact_enlace_cdr}` : null,
    ].filter(Boolean).join('\n');
    window.location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const handleConfirmAnular = async () => {
    if (!invoice) return;
    if (!motivo.trim()) {
      setLocalError('Ingresa el motivo de la anulación.');
      return;
    }
    setAnulando(true);
    setLocalError(null);
    try {
      const result = await anularComprobante({
        tipo_de_comprobante: invoice.tipo_de_comprobante,
        serie: invoice.serie,
        numero: invoice.numero,
        motivo: motivo.trim()
      });

      if ((result as any).errors) {
        const errMsg = (result as any).errors;
        throw new Error(typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg));
      }

      await anularInvoiceInDb(invoice.id, motivo.trim(), {
        ticket: result.sunat_ticket_numero,
        aceptada: result.aceptada_por_sunat,
        description: result.sunat_description,
        enlace_pdf: result.enlace_del_pdf,
        enlace_xml: result.enlace_del_xml,
        enlace_cdr: result.enlace_del_cdr,
      });
      setAnulacionResult(result);
      setShowAnularForm(false);
      onChanged();
    } catch (e: any) {
      setLocalError(e.message || 'Error al anular el comprobante.');
    } finally {
      setAnulando(false);
    }
  };

  const handleDeleteDraft = async () => {
    if (!invoice) return;
    if (!window.confirm(`¿Eliminar el borrador ${invoice.serie}-${invoice.numero}? Esta acción no se puede deshacer.`)) return;
    try {
      await deleteInvoiceFromDb(invoice.id);
      onNotify(`Borrador ${invoice.serie}-${invoice.numero} eliminado.`, 'success');
      onChanged();
      onClose();
    } catch (e: any) {
      setLocalError(e.message || 'Error al eliminar el borrador.');
    }
  };

  const handleArchivoPagoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPagoArchivoNombre(file.name);
    const reader = new FileReader();
    reader.onload = () => setPagoArchivoData(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleConfirmarPago = async () => {
    if (!invoice) return;
    if (!pagoFecha) {
      setLocalError('Ingresa la fecha de pago.');
      return;
    }
    setRegistrandoPago(true);
    setLocalError(null);
    try {
      await registrarPagoEnDb(invoice.id, pagoFecha, pagoArchivoData || undefined);
      onNotify(`Pago de ${invoice.serie}-${invoice.numero} registrado.`, 'success');
      setShowPagoForm(false);
      onChanged();
    } catch (e: any) {
      setLocalError(e.message || 'Error al registrar el pago.');
    } finally {
      setRegistrandoPago(false);
    }
  };

  // SUNAT valida de forma asíncrona: a veces, al emitir, todavía no está el CDR ni la
  // descripción SUNAT porque la validación no había terminado. Esto vuelve a consultar el
  // estado real (OPERACIÓN 2 del manual de NubeFact) y actualiza el registro local.
  const handleConsultarSunat = async () => {
    if (!invoice) return;
    setConsultando(true);
    setLocalError(null);
    try {
      const result = await consultarComprobante({
        tipo_de_comprobante: invoice.tipo_de_comprobante,
        serie: invoice.serie,
        numero: invoice.numero
      });

      if ((result as any).errors) {
        const errMsg = (result as any).errors;
        throw new Error(typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg));
      }

      await updateInvoiceStatus(invoice.id, 'EMITIDO', {
        nubefact_enlace_pdf: result.enlace_del_pdf,
        nubefact_enlace_xml: result.enlace_del_xml,
        nubefact_enlace_cdr: result.enlace_del_cdr,
        nubefact_sunat_description: result.sunat_description
      });
      onChanged();
      onNotify(
        result.aceptada_por_sunat
          ? `SUNAT aceptó ${invoice.serie}-${invoice.numero}.`
          : (result.sunat_description || 'SUNAT todavía no confirma este comprobante, vuelve a intentar en unos minutos.'),
        result.aceptada_por_sunat ? 'success' : 'info'
      );
    } catch (e: any) {
      onNotify('No se pudo consultar el estado en SUNAT: ' + (e.message || ''), 'error');
    } finally {
      setConsultando(false);
    }
  };

  // Consulta el estado real del TICKET de baja ante SUNAT (OPERACIÓN "consultar_anulacion"):
  // el ticket se valida de forma asíncrona, "generar_anulacion" a veces no trae aún si fue aceptada.
  const handleConsultarBaja = async () => {
    if (!invoice) return;
    setConsultandoBaja(true);
    setLocalError(null);
    try {
      const result = await consultarAnulacion({
        tipo_de_comprobante: invoice.tipo_de_comprobante,
        serie: invoice.serie,
        numero: invoice.numero
      });

      if ((result as any).errors) {
        const errMsg = (result as any).errors;
        throw new Error(typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg));
      }

      await actualizarEstadoBajaEnDb(invoice.id, {
        aceptada: result.aceptada_por_sunat,
        description: result.sunat_description,
        enlace_pdf: result.enlace_del_pdf,
        enlace_xml: result.enlace_del_xml,
        enlace_cdr: result.enlace_del_cdr,
      });
      onChanged();
      onNotify(
        result.aceptada_por_sunat
          ? `SUNAT aceptó la baja de ${invoice.serie}-${invoice.numero}.`
          : (result.sunat_description || 'SUNAT todavía no confirma esta baja, vuelve a intentar en unos minutos.'),
        result.aceptada_por_sunat ? 'success' : 'info'
      );
    } catch (e: any) {
      onNotify('No se pudo consultar el estado de la baja: ' + (e.message || ''), 'error');
    } finally {
      setConsultandoBaja(false);
    }
  };

  if (!invoice) return null;

  const monedaSymbol = invoice.moneda === 2 ? '$' : 'S/';
  const tipoLabel = TIPO_LABELS[invoice.tipo_de_comprobante] || 'COMPROBANTE';
  const totalNum = Number(invoice.total) || 0;
  const esBorrador = invoice.estado === 'BORRADOR';
  const esAnulado = invoice.estado === 'ANULADO';
  const estaPagado = !!invoice.pagado && Number(invoice.pagado) !== 0;
  const enviada = !esBorrador;
  // "Aceptada por SUNAT" es un hecho histórico independiente de si luego se anuló: un
  // comprobante anulado sigue habiendo sido aceptado por SUNAT al momento de emitirse.
  const aceptada = enviada && !invoice.nubefact_error && !!invoice.nubefact_sunat_description;

  return (
    <Dialog open={isOpen} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto text-center sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{tipoLabel}</DialogTitle>
        </DialogHeader>

        <p className="-mt-2 font-mono text-lg text-foreground">{invoice.serie}-{invoice.numero}</p>
        <p className="text-2xl font-bold text-foreground">TOTAL: {monedaSymbol}{totalNum.toFixed(2)}</p>

        <Button
          onClick={() => openLink(invoice.nubefact_enlace_pdf)}
          className="w-full"
        >
          <PrinterIcon data-icon="inline-start" />
          IMPRIMIR
        </Button>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Button variant="destructive" onClick={() => openLink(invoice.nubefact_enlace_pdf)}>VER PDF</Button>
          <Button variant="secondary" onClick={() => openLink(invoice.nubefact_enlace_xml)}>DESCARGAR XML</Button>
          <Button variant="outline" onClick={() => openLink(invoice.nubefact_enlace_cdr)}>DESCARGAR CDR</Button>
        </div>

        <div className="divide-y rounded-lg border text-sm">
          <button onClick={handleWhatsApp} className="block w-full px-3 py-2 text-left text-primary hover:bg-muted">Enviar por WhatsApp</button>
          <button onClick={handleEmail} className="block w-full px-3 py-2 text-left text-primary hover:bg-muted">Enviar a un email personalizado</button>
          <button onClick={() => onGenerateNew(invoice, 1)} className="block w-full px-3 py-2 text-left text-primary hover:bg-muted">Generar otra FACTURA</button>
          <button onClick={() => onGenerateNew(invoice, 2)} className="block w-full px-3 py-2 text-left text-primary hover:bg-muted">Generar otra BOLETA DE VENTA</button>
        </div>

        {!esBorrador && (
          <div className={`rounded-lg border p-3 text-left ${esAnulado ? 'opacity-60' : ''}`}>
            <h3 className="mb-2 flex items-center gap-2 text-xs font-bold tracking-wider text-muted-foreground uppercase">
              Proceso de Pago
              {esAnulado && <Badge variant="destructive" className="normal-case tracking-normal">Inactivo: comprobante anulado</Badge>}
            </h3>
            {estaPagado ? (
              <div className="text-sm">
                <p className="font-semibold text-emerald-700">✔ PAGADO{invoice.fecha_pago ? ` el ${formatFecha(invoice.fecha_pago)}` : ''}</p>
                {invoice.comprobante_pago_data && (
                  <a href={invoice.comprobante_pago_data} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                    Ver constancia de pago
                  </a>
                )}
                {!esAnulado && (
                  <button onClick={() => setShowPagoForm(s => !s)} className="mt-1 block text-xs text-muted-foreground hover:underline">
                    Actualizar registro de pago
                  </button>
                )}
              </div>
            ) : esAnulado ? (
              <p className="text-sm text-muted-foreground">No aplica: este comprobante fue anulado.</p>
            ) : !showPagoForm ? (
              <Button className="w-full" onClick={() => setShowPagoForm(true)}>
                Registrar pago
              </Button>
            ) : null}

            {showPagoForm && !esAnulado && (
              <div className="mt-2 flex flex-col gap-3">
                <Field>
                  <FieldLabel htmlFor="pago-fecha">Fecha de pago</FieldLabel>
                  <Input id="pago-fecha" type="date" value={pagoFecha} onChange={(e) => setPagoFecha(e.target.value)} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="pago-archivo">Constancia de pago (imagen o PDF)</FieldLabel>
                  <Input id="pago-archivo" type="file" accept="image/*,application/pdf" onChange={handleArchivoPagoChange} />
                  {pagoArchivoNombre && <p className="mt-1 text-xs text-muted-foreground">{pagoArchivoNombre}</p>}
                </Field>
                <div className="flex gap-2">
                  <Button className="flex-1" disabled={registrandoPago} onClick={handleConfirmarPago}>
                    {registrandoPago ? 'GUARDANDO...' : 'CONFIRMAR PAGO'}
                  </Button>
                  <Button variant="outline" className="flex-1" disabled={registrandoPago} onClick={() => setShowPagoForm(false)}>
                    CANCELAR
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {esBorrador ? (
          <Button variant="destructive" className="w-full" onClick={handleDeleteDraft}>
            Eliminar borrador
          </Button>
        ) : esAnulado ? (
          <Alert className="text-left">
            <AlertDescription>
              <p className="font-semibold">Este comprobante ya fue ANULADO.</p>
              {invoice.motivo_anulacion && <p>Motivo: {invoice.motivo_anulacion}</p>}
              {invoice.fecha_anulacion && <p>Fecha de baja: {invoice.fecha_anulacion}</p>}
              {invoice.nubefact_baja_ticket && <p>Ticket SUNAT: {invoice.nubefact_baja_ticket}</p>}
              <p className={invoice.nubefact_baja_aceptada ? 'flex items-center gap-1 text-emerald-700' : 'flex items-center gap-1 text-muted-foreground'}>
                {invoice.nubefact_baja_aceptada ? <CircleCheckIcon className="size-4" /> : <CircleXIcon className="size-4" />}
                {invoice.nubefact_baja_aceptada ? 'Baja aceptada por la SUNAT' : 'La SUNAT todavía no confirma esta baja'}
              </p>
              {invoice.nubefact_baja_description && <p>Descripción: {invoice.nubefact_baja_description}</p>}
              {invoice.nubefact_baja_enlace_pdf && (
                <p>
                  <a href={invoice.nubefact_baja_enlace_pdf} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                    Ver PDF de la comunicación de baja
                  </a>
                </p>
              )}
              {!invoice.nubefact_baja_aceptada && invoice.nubefact_baja_ticket && (
                <Button variant="outline" size="sm" className="mt-2" disabled={consultandoBaja} onClick={handleConsultarBaja}>
                  <RefreshCwIcon data-icon="inline-start" className={consultandoBaja ? 'animate-spin' : ''} />
                  {consultandoBaja ? 'Consultando...' : 'Consultar estado de la baja en SUNAT'}
                </Button>
              )}
            </AlertDescription>
          </Alert>
        ) : !showAnularForm ? (
          <Button variant="destructive" className="w-full" onClick={() => setShowAnularForm(true)}>
            Anular o comunicar de baja
          </Button>
        ) : (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-left">
            <Field>
              <FieldLabel htmlFor="motivo-anulacion">Motivo de anulación</FieldLabel>
              <Input id="motivo-anulacion" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej: ERROR DEL SISTEMA" />
            </Field>
            <div className="mt-2 flex gap-2">
              <Button variant="destructive" className="flex-1" disabled={anulando} onClick={handleConfirmAnular}>
                {anulando ? 'ANULANDO...' : 'CONFIRMAR ANULACIÓN'}
              </Button>
              <Button variant="outline" className="flex-1" disabled={anulando} onClick={() => setShowAnularForm(false)}>
                CANCELAR
              </Button>
            </div>
          </div>
        )}

        {localError && (
          <Alert variant="destructive">
            <AlertDescription>{localError}</AlertDescription>
          </Alert>
        )}

        {anulacionResult ? (
          <div className="border-t pt-3 text-left text-sm">
            <p className="text-emerald-700">Enviada a la Sunat?: ✔</p>
            <p className={anulacionResult.aceptada_por_sunat ? 'text-emerald-700' : 'text-destructive'}>
              Aceptada por la Sunat?: {anulacionResult.aceptada_por_sunat ? '✔' : '✘'}
            </p>
            {anulacionResult.sunat_responsecode && <p>Código: {anulacionResult.sunat_responsecode}</p>}
            {anulacionResult.sunat_description && <p>Descripción: {anulacionResult.sunat_description}</p>}
            {anulacionResult.enlace_del_pdf && (
              <p>
                <a href={anulacionResult.enlace_del_pdf} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                  Ver PDF de la anulación
                </a>
              </p>
            )}
          </div>
        ) : !esBorrador ? (
          <div className="border-t pt-3 text-left text-sm">
            <p className={enviada ? 'flex items-center gap-1 text-emerald-700' : 'flex items-center gap-1 text-muted-foreground'}>
              {enviada ? <CircleCheckIcon className="size-4" /> : <CircleXIcon className="size-4" />} Enviada a la Sunat?
            </p>
            <p className={aceptada ? 'flex items-center gap-1 text-emerald-700' : 'flex items-center gap-1 text-destructive'}>
              {aceptada ? <CircleCheckIcon className="size-4" /> : <CircleXIcon className="size-4" />} Aceptada por la Sunat?
            </p>
            {invoice.nubefact_sunat_description && <p>Descripción: {invoice.nubefact_sunat_description}</p>}
            {invoice.nubefact_error && <p className="text-destructive">Otros: {invoice.nubefact_error}</p>}
            {!esAnulado && !aceptada && (
              <>
                <p className="mt-1 text-xs text-muted-foreground">
                  SUNAT valida de forma asíncrona: si recién emitiste el comprobante y todavía no aparece el CDR, es normal — consulta el estado en unos minutos.
                </p>
                <Button variant="outline" size="sm" className="mt-2" disabled={consultando} onClick={handleConsultarSunat}>
                  <RefreshCwIcon data-icon="inline-start" className={consultando ? 'animate-spin' : ''} />
                  {consultando ? 'Consultando...' : 'Consultar estado en SUNAT'}
                </Button>
              </>
            )}
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" className="w-full" onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
