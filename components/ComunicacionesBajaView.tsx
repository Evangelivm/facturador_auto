'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { getInvoices, anularInvoiceInDb, actualizarEstadoBajaEnDb } from '@/services/databaseService';
import { anularComprobante, consultarAnulacion } from '@/services/nubefactService';
import { InvoiceListModal } from './InvoiceListModal';
import { ComprobanteRow } from './ComprobanteOptionsModal';
import { ToastType } from '@/types';
import { formatFecha, toDateKey } from '@/lib/consolidadoReport';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, FieldLabel } from '@/components/ui/field';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Empty, EmptyHeader, EmptyTitle, EmptyMedia } from '@/components/ui/empty';
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { FilterIcon, InboxIcon, XIcon, PlusIcon, RefreshCwIcon, CircleCheckIcon, CircleXIcon } from 'lucide-react';

interface ComunicacionesBajaViewProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenComprobantes: () => void;
  onOpenConsolidado: () => void;
  onNotify: (message: string, type?: ToastType) => void;
}

const TIPO_LABELS: Record<number, string> = {
  1: 'FACTURA ELECTRÓNICA',
  2: 'BOLETA DE VENTA ELECTRÓNICA',
  3: 'NOTA DE CRÉDITO ELECTRÓNICA',
  4: 'NOTA DE DÉBITO ELECTRÓNICA'
};

const PAGE_SIZE = 15;

const EstadoBajaBadge: React.FC<{ aceptada?: boolean | null; ticket?: string }> = ({ aceptada, ticket }) => {
  if (!ticket) return <Badge variant="secondary">SIN TICKET</Badge>;
  return aceptada
    ? <Badge>ACEPTADA POR SUNAT</Badge>
    : <Badge variant="destructive">PENDIENTE EN SUNAT</Badge>;
};

export const ComunicacionesBajaView: React.FC<ComunicacionesBajaViewProps> = ({ isOpen, onClose, onOpenComprobantes, onOpenConsolidado, onNotify }) => {
  const [rows, setRows] = useState<ComprobanteRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState('');
  const [buscarDocumento, setBuscarDocumento] = useState('');
  const [page, setPage] = useState(1);

  const [consultandoId, setConsultandoId] = useState<number | null>(null);

  // Flujo de "Agregar documento para ANULAR o COMUNICAR DE BAJA": PASO 1 elegir el documento
  // emitido, PASO 2 confirmar el motivo y enviar la anulación a NubeFact/SUNAT.
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [selectedForAnular, setSelectedForAnular] = useState<ComprobanteRow | null>(null);
  const [motivo, setMotivo] = useState('ERROR DEL SISTEMA');
  const [anulando, setAnulando] = useState(false);

  const loadRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getInvoices('ANULADO');
      setRows(data);
    } catch (e: any) {
      setError(e.message || 'Error al cargar las comunicaciones de baja');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) loadRows();
  }, [isOpen]);

  const filteredRows = useMemo(() => {
    return rows.filter(row => {
      if (fechaInicio || fechaFin) {
        const key = toDateKey((row as any).fecha_anulacion);
        if (fechaInicio && key < fechaInicio) return false;
        if (fechaFin && key > fechaFin) return false;
      }
      if (tipoFiltro && String(row.tipo_de_comprobante) !== tipoFiltro) return false;
      if (buscarDocumento) {
        const q = buscarDocumento.toLowerCase();
        const doc = `${row.serie}-${row.numero}`.toLowerCase();
        const matches = doc.includes(q) ||
          (row.cliente_denominacion || '').toLowerCase().includes(q) ||
          (row.cliente_numero_de_documento || '').toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [rows, fechaInicio, fechaFin, tipoFiltro, buscarDocumento]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const pageRows = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [fechaInicio, fechaFin, tipoFiltro, buscarDocumento]);

  const openLink = (url?: string) => {
    if (!url) {
      onNotify('Este enlace todavía no está disponible.', 'info');
      return;
    }
    window.open(url, '_blank');
  };

  const handleSelectDocumento = (invoice: any) => {
    setAddModalOpen(false);
    if (invoice.estado === 'BORRADOR') {
      onNotify('Un borrador no está emitido ante SUNAT, no se puede anular. Elimínalo desde "Comprobantes".', 'error');
      return;
    }
    if (invoice.estado === 'ANULADO') {
      onNotify(`${invoice.serie}-${invoice.numero} ya fue anulado anteriormente.`, 'info');
      return;
    }
    setMotivo('ERROR DEL SISTEMA');
    setSelectedForAnular(invoice as ComprobanteRow);
  };

  const handleConfirmarAnulacion = async () => {
    if (!selectedForAnular) return;
    if (!motivo.trim()) {
      onNotify('Ingresa el motivo de la anulación.', 'error');
      return;
    }
    setAnulando(true);
    try {
      const result = await anularComprobante({
        tipo_de_comprobante: selectedForAnular.tipo_de_comprobante,
        serie: selectedForAnular.serie,
        numero: selectedForAnular.numero,
        motivo: motivo.trim()
      });

      if ((result as any).errors) {
        const errMsg = (result as any).errors;
        throw new Error(typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg));
      }

      await anularInvoiceInDb(selectedForAnular.id, motivo.trim(), {
        ticket: result.sunat_ticket_numero,
        aceptada: result.aceptada_por_sunat,
        description: result.sunat_description,
        enlace_pdf: result.enlace_del_pdf,
        enlace_xml: result.enlace_del_xml,
        enlace_cdr: result.enlace_del_cdr,
      });

      onNotify(`Comunicación de baja de ${selectedForAnular.serie}-${selectedForAnular.numero} enviada a la SUNAT.`, 'success');
      setSelectedForAnular(null);
      await loadRows();
    } catch (e: any) {
      onNotify('Error al anular el comprobante: ' + (e.message || ''), 'error');
    } finally {
      setAnulando(false);
    }
  };

  const handleConsultarEstado = async (row: ComprobanteRow) => {
    setConsultandoId(row.id);
    try {
      const result = await consultarAnulacion({
        tipo_de_comprobante: row.tipo_de_comprobante,
        serie: row.serie,
        numero: row.numero
      });

      if ((result as any).errors) {
        const errMsg = (result as any).errors;
        throw new Error(typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg));
      }

      await actualizarEstadoBajaEnDb(row.id, {
        aceptada: result.aceptada_por_sunat,
        description: result.sunat_description,
        enlace_pdf: result.enlace_del_pdf,
        enlace_xml: result.enlace_del_xml,
        enlace_cdr: result.enlace_del_cdr,
      });
      await loadRows();
      onNotify(
        result.aceptada_por_sunat
          ? `SUNAT aceptó la baja de ${row.serie}-${row.numero}.`
          : (result.sunat_description || 'SUNAT todavía no confirma esta baja, vuelve a intentar en unos minutos.'),
        result.aceptada_por_sunat ? 'success' : 'info'
      );
    } catch (e: any) {
      onNotify('No se pudo consultar el estado en SUNAT: ' + (e.message || ''), 'error');
    } finally {
      setConsultandoId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-background">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-background/90 px-3 py-3 shadow-sm backdrop-blur-md sm:px-4 md:px-6">
        <h1 className="text-lg font-bold tracking-tight text-foreground sm:text-xl md:text-2xl">Comunicaciones de Baja</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onOpenConsolidado}>
            Consolidado
          </Button>
          <Button variant="outline" onClick={onOpenComprobantes}>
            Ver comprobantes
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose} title="Cerrar">
            <XIcon />
          </Button>
        </div>
      </div>

      <div className="w-full p-3 sm:p-4 md:p-6">
        <Alert className="mb-4">
          <AlertDescription>
            Las comunicaciones de baja o anulación de documentos consta de <strong>2 PASOS</strong>.
            {' '}<strong>PASO 1</strong> = Agregar o elegir un documento. <strong>PASO 2</strong> = Consultar el estado de la anulación a la SUNAT.
          </AlertDescription>
        </Alert>

        <Button className="mb-4 w-full sm:w-auto" onClick={() => setAddModalOpen(true)}>
          <PlusIcon data-icon="inline-start" />
          Agregar documento para ANULAR o COMUNICAR DE BAJA
        </Button>

        {selectedForAnular && (
          <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <p className="mb-2 text-sm font-semibold text-foreground">
              Anular {TIPO_LABELS[selectedForAnular.tipo_de_comprobante] || 'COMPROBANTE'} {selectedForAnular.serie}-{selectedForAnular.numero}
            </p>
            <Field>
              <FieldLabel htmlFor="motivo-baja">Motivo de anulación</FieldLabel>
              <Input id="motivo-baja" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej: ERROR DEL SISTEMA" />
            </Field>
            <div className="mt-2 flex gap-2">
              <Button variant="destructive" className="flex-1" disabled={anulando} onClick={handleConfirmarAnulacion}>
                {anulando ? 'ENVIANDO A SUNAT...' : 'CONFIRMAR ANULACIÓN'}
              </Button>
              <Button variant="outline" className="flex-1" disabled={anulando} onClick={() => setSelectedForAnular(null)}>
                CANCELAR
              </Button>
            </div>
          </div>
        )}

        <div className="mb-4 rounded-2xl border bg-card p-3 shadow-sm">
          <h2 className="mb-3 flex items-center gap-1.5 text-xs font-bold tracking-wide text-muted-foreground uppercase">
            <FilterIcon className="size-3.5 text-primary" />
            Filtros
          </h2>
          <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 md:grid-cols-4">
            <Field>
              <FieldLabel htmlFor="baja-desde">Fecha de baja desde</FieldLabel>
              <Input id="baja-desde" type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="baja-hasta">Fecha de baja hasta</FieldLabel>
              <Input id="baja-hasta" type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="baja-tipo">Tipo de comprobante</FieldLabel>
              <Select
                items={{ '': 'TODOS LOS TIPOS', '1': 'FACTURA ELECTRÓNICA', '2': 'BOLETA DE VENTA ELECTRÓNICA', '3': 'NOTA DE CRÉDITO ELECTRÓNICA', '4': 'NOTA DE DÉBITO ELECTRÓNICA' }}
                value={tipoFiltro}
                onValueChange={(v) => setTipoFiltro(v ?? '')}
              >
                <SelectTrigger id="baja-tipo" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="">TODOS LOS TIPOS</SelectItem>
                    <SelectItem value="1">FACTURA ELECTRÓNICA</SelectItem>
                    <SelectItem value="2">BOLETA DE VENTA ELECTRÓNICA</SelectItem>
                    <SelectItem value="3">NOTA DE CRÉDITO ELECTRÓNICA</SelectItem>
                    <SelectItem value="4">NOTA DE DÉBITO ELECTRÓNICA</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="baja-doc">Buscar documento o entidad</FieldLabel>
              <Input id="baja-doc" placeholder="Ej: FFF1-1" value={buscarDocumento} onChange={e => setBuscarDocumento(e.target.value)} />
            </Field>
          </div>
        </div>

        {totalPages > 1 && (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>&lt;</Button>
            <Badge className="size-8 rounded-full p-0 text-sm">{page}</Badge>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>&gt;</Button>
            <span className="text-xs text-muted-foreground">Página {page} de {totalPages} ({filteredRows.length} bajas)</span>
          </div>
        )}

        {error && (
          <Alert variant="destructive" className="mb-3">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : pageRows.length === 0 ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon"><InboxIcon /></EmptyMedia>
              <EmptyTitle>No hay comunicaciones de baja que coincidan con el filtro</EmptyTitle>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            {/* Móvil: tarjetas apiladas */}
            <div className="mb-4 flex flex-col gap-3 md:hidden">
              {pageRows.map(row => (
                <div key={row.id} className="rounded-xl border bg-card p-3 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-mono font-bold text-foreground">{row.serie}-{row.numero}</p>
                      <p className="text-xs text-muted-foreground">Baja: {formatFecha((row as any).fecha_anulacion)}</p>
                    </div>
                    <EstadoBajaBadge aceptada={row.nubefact_baja_aceptada} ticket={row.nubefact_baja_ticket} />
                  </div>
                  <p className="mt-2 text-sm text-foreground">{row.cliente_denominacion}</p>
                  <p className="text-xs text-muted-foreground">Motivo: {row.motivo_anulacion || '-'}</p>
                  {row.nubefact_baja_ticket && <p className="text-xs text-muted-foreground">Ticket: {row.nubefact_baja_ticket}</p>}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(row.nubefact_baja_enlace_pdf || row.nubefact_enlace_pdf) && (
                      <Badge variant="destructive" render={<a href={row.nubefact_baja_enlace_pdf || row.nubefact_enlace_pdf} target="_blank" rel="noreferrer" />}>PDF</Badge>
                    )}
                    {(row.nubefact_baja_enlace_xml || row.nubefact_enlace_xml) && (
                      <Badge variant="default" render={<a href={row.nubefact_baja_enlace_xml || row.nubefact_enlace_xml} target="_blank" rel="noreferrer" />}>XML</Badge>
                    )}
                    {(row.nubefact_baja_enlace_cdr || row.nubefact_enlace_cdr) && (
                      <Badge variant="secondary" render={<a href={row.nubefact_baja_enlace_cdr || row.nubefact_enlace_cdr} target="_blank" rel="noreferrer" />}>CDR</Badge>
                    )}
                  </div>
                  {!row.nubefact_baja_aceptada && row.nubefact_baja_ticket && (
                    <Button variant="outline" size="sm" className="mt-3 w-full" disabled={consultandoId === row.id} onClick={() => handleConsultarEstado(row)}>
                      <RefreshCwIcon data-icon="inline-start" className={consultandoId === row.id ? 'animate-spin' : ''} />
                      {consultandoId === row.id ? 'Consultando...' : 'Consultar estado en SUNAT'}
                    </Button>
                  )}
                </div>
              ))}
            </div>

            {/* Escritorio: tabla completa */}
            <div className="hidden rounded-lg border md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>FECHA DE BAJA</TableHead>
                    <TableHead>DOCUMENTO RELACIONADO</TableHead>
                    <TableHead>CLIENTE</TableHead>
                    <TableHead>MOTIVO</TableHead>
                    <TableHead>TICKET (SUNAT)</TableHead>
                    <TableHead className="text-center">PDF</TableHead>
                    <TableHead className="text-center">XML</TableHead>
                    <TableHead className="text-center">CDR</TableHead>
                    <TableHead className="text-center">ESTADO EN LA SUNAT</TableHead>
                    <TableHead className="text-center">OPCIONES</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageRows.map(row => (
                    <TableRow key={row.id}>
                      <TableCell>{formatFecha((row as any).fecha_anulacion)}</TableCell>
                      <TableCell>
                        <p className="font-mono font-semibold">{row.serie}-{row.numero}</p>
                        <p className="text-xs text-muted-foreground">{TIPO_LABELS[row.tipo_de_comprobante] || '-'}</p>
                      </TableCell>
                      <TableCell>{row.cliente_denominacion}</TableCell>
                      <TableCell>{row.motivo_anulacion || '-'}</TableCell>
                      <TableCell className="font-mono">{row.nubefact_baja_ticket || '-'}</TableCell>
                      <TableCell className="text-center">
                        {(row.nubefact_baja_enlace_pdf || row.nubefact_enlace_pdf) ? (
                          <Badge variant="destructive" render={<a href={row.nubefact_baja_enlace_pdf || row.nubefact_enlace_pdf} target="_blank" rel="noreferrer" />}>PDF</Badge>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        {(row.nubefact_baja_enlace_xml || row.nubefact_enlace_xml) ? (
                          <Badge variant="default" render={<a href={row.nubefact_baja_enlace_xml || row.nubefact_enlace_xml} target="_blank" rel="noreferrer" />}>XML</Badge>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        {(row.nubefact_baja_enlace_cdr || row.nubefact_enlace_cdr) ? (
                          <Badge variant="secondary" render={<a href={row.nubefact_baja_enlace_cdr || row.nubefact_enlace_cdr} target="_blank" rel="noreferrer" />}>CDR</Badge>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        <EstadoBajaBadge aceptada={row.nubefact_baja_aceptada} ticket={row.nubefact_baja_ticket} />
                      </TableCell>
                      <TableCell className="text-center whitespace-nowrap">
                        {!row.nubefact_baja_aceptada && row.nubefact_baja_ticket ? (
                          <Button variant="link" size="sm" disabled={consultandoId === row.id} onClick={() => handleConsultarEstado(row)}>
                            <RefreshCwIcon data-icon="inline-start" className={consultandoId === row.id ? 'animate-spin' : ''} />
                            {consultandoId === row.id ? 'Consultando...' : 'Consultar estado'}
                          </Button>
                        ) : row.nubefact_baja_aceptada ? (
                          <span className="flex items-center justify-center gap-1 text-xs text-emerald-700"><CircleCheckIcon className="size-4" /> Aceptada</span>
                        ) : (
                          <span className="flex items-center justify-center gap-1 text-xs text-muted-foreground"><CircleXIcon className="size-4" /> Sin ticket</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </div>

      <InvoiceListModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSelectInvoice={handleSelectDocumento}
      />
    </div>
  );
};
