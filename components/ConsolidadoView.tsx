'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { getInvoices, getInvoiceById, getInvoicesForExport } from '@/services/databaseService';
import { ComprobanteOptionsModal, ComprobanteRow } from './ComprobanteOptionsModal';
import { ToastType } from '@/types';
import {
  SUNAT_TIPO_CODE, formatFecha, isAceptada, isPagado, ListFilters, matchesFilters, exportConsolidadoExcel,
} from '@/lib/consolidadoReport';
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
import {
  SearchIcon, DownloadIcon, FilterIcon, InboxIcon, XIcon, CircleCheckIcon, CircleXIcon,
  Loader2Icon, PrinterIcon,
} from 'lucide-react';

interface ConsolidadoViewProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenComprobantes: () => void;
  onOpenBajas: () => void;
  onNotify: (message: string, type?: ToastType) => void;
}

const PAGE_SIZE = 15;

export const ConsolidadoView: React.FC<ConsolidadoViewProps> = ({
  isOpen, onClose, onOpenComprobantes, onOpenBajas, onNotify
}) => {
  const [rows, setRows] = useState<ComprobanteRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showBanner, setShowBanner] = useState(true);

  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState('');
  const [entidadFiltro, setEntidadFiltro] = useState('');
  const [buscarDocumento, setBuscarDocumento] = useState('');
  const [page, setPage] = useState(1);

  const [exporting, setExporting] = useState(false);
  const [optionsInvoice, setOptionsInvoice] = useState<ComprobanteRow | null>(null);

  const loadInvoices = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getInvoices();
      setRows(data);
    } catch (e: any) {
      setError(e.message || 'Error al cargar el consolidado');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) loadInvoices();
  }, [isOpen]);

  const activeFilters: ListFilters = {
    fechaInicio, fechaFin, tipoFiltro, entidadFiltro, anuladoFiltro: '', buscarDocumento,
  };

  const filteredRows = useMemo(() => {
    return rows.filter(row => matchesFilters(row, activeFilters));
  }, [rows, fechaInicio, fechaFin, tipoFiltro, entidadFiltro, buscarDocumento]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const pageRows = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [fechaInicio, fechaFin, tipoFiltro, entidadFiltro, buscarDocumento]);

  const handleVer = (row: ComprobanteRow) => setOptionsInvoice(row);

  const openLink = (url?: string) => {
    if (!url) {
      onNotify('Este enlace no está disponible para este comprobante.', 'info');
      return;
    }
    window.open(url, '_blank');
  };

  // Mismo "Consolidado de Facturas, Boletas y Notas" en .xlsx que descarga NubeFact (mismas
  // columnas), respetando los filtros activos en pantalla.
  const handleDescargaExcel = async () => {
    setExporting(true);
    try {
      const fullRows = await getInvoicesForExport();
      await exportConsolidadoExcel(fullRows, activeFilters, 'consolidado');
    } catch (e: any) {
      onNotify('Error al generar el Excel: ' + (e.message || ''), 'error');
    } finally {
      setExporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-background">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-background/90 px-3 py-3 shadow-sm backdrop-blur-md sm:px-4 md:px-6">
        <h1 className="text-lg font-bold tracking-tight text-foreground sm:text-xl md:text-2xl">
          Consolidado de Facturas, Boletas y Notas
        </h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onOpenComprobantes}>
            Ver comprobantes
          </Button>
          <Button variant="outline" onClick={onOpenBajas}>
            Comunicaciones de baja
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose} title="Cerrar">
            <XIcon />
          </Button>
        </div>
      </div>

      <div className="w-full p-3 sm:p-4 md:p-6">
        {showBanner && (
          <Alert className="mb-4 border-amber-200 bg-amber-50 text-amber-900">
            <AlertDescription className="flex items-start justify-between gap-3">
              <span>
                <strong>IMPORTANTE:</strong> en esta opción se ven todas las FACTURAS, y
                NOTAS emitidas por Maquinarias Ayala.
              </span>
              <button onClick={() => setShowBanner(false)} className="shrink-0 text-amber-700 hover:text-amber-900" title="Cerrar aviso">
                <XIcon className="size-4" />
              </button>
            </AlertDescription>
          </Alert>
        )}

        <div className="mb-4 rounded-2xl border bg-card p-3 shadow-sm">
          <h2 className="mb-3 flex items-center gap-1.5 text-xs font-bold tracking-wide text-muted-foreground uppercase">
            <FilterIcon className="size-3.5 text-primary" />
            Filtros
          </h2>
          <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
            <Field>
              <FieldLabel htmlFor="cons-desde">Desde</FieldLabel>
              <Input id="cons-desde" type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="cons-hasta">Hasta</FieldLabel>
              <Input id="cons-hasta" type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="cons-tipo">Filtrar por tipo</FieldLabel>
              <Select
                items={{
                  '': 'TODOS LOS TIPOS',
                  '1': 'FACTURA ELECTRÓNICA',
                  '2': 'BOLETA DE VENTA ELECTRÓNICA',
                  '3': 'NOTA DE CRÉDITO ELECTRÓNICA',
                  '4': 'NOTA DE DÉBITO ELECTRÓNICA',
                }}
                value={tipoFiltro}
                onValueChange={(v) => setTipoFiltro(v ?? '')}
              >
                <SelectTrigger id="cons-tipo" className="w-full"><SelectValue /></SelectTrigger>
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
              <FieldLabel htmlFor="cons-entidad">Buscar por entidad</FieldLabel>
              <Input
                id="cons-entidad"
                placeholder="RUC/DNI o razón social"
                value={entidadFiltro}
                onChange={e => setEntidadFiltro(e.target.value)}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 md:grid-cols-4">
            <Field className="md:col-span-2">
              <FieldLabel htmlFor="cons-doc">Buscar documento</FieldLabel>
              <div className="flex gap-2">
                <Input
                  id="cons-doc"
                  placeholder="Ej: FFF1-1"
                  value={buscarDocumento}
                  onChange={e => setBuscarDocumento(e.target.value)}
                />
                <Button size="icon" onClick={() => setPage(1)} title="Buscar documento">
                  <SearchIcon />
                </Button>
              </div>
            </Field>
            <Button onClick={loadInvoices}>Filtrar</Button>
            <Button variant="secondary" onClick={handleDescargaExcel} disabled={exporting} title="Descargar consolidado en Excel">
              {exporting ? <Loader2Icon data-icon="inline-start" className="animate-spin" /> : <DownloadIcon data-icon="inline-start" />}
              {exporting ? 'Generando...' : 'Descarga Excel'}
            </Button>
          </div>
        </div>

        {totalPages > 1 && (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>&lt;</Button>
            <Badge className="size-8 rounded-full p-0 text-sm">{page}</Badge>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>&gt;</Button>
            <span className="text-xs text-muted-foreground">Página {page} de {totalPages} ({filteredRows.length} comprobantes)</span>
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
              <EmptyTitle>No hay comprobantes que coincidan con el filtro</EmptyTitle>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            {/* Móvil: tarjetas apiladas */}
            <div className="mb-4 flex flex-col gap-3 md:hidden">
              {pageRows.map(row => {
                const esAnulado = row.estado === 'ANULADO';
                const aceptada = isAceptada(row);
                const pagado = isPagado(row);
                return (
                  <div key={row.id} className={`rounded-xl border p-3 shadow-sm ${esAnulado ? 'border-amber-300 bg-amber-100' : 'bg-card'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className={esAnulado ? 'line-through' : ''}>
                        <p className="font-mono font-bold text-foreground">{row.serie}-{row.numero}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatFecha((row as any).fecha_de_emision)} · Tipo {SUNAT_TIPO_CODE[row.tipo_de_comprobante] || '-'}
                        </p>
                      </div>
                      {esAnulado && <Badge variant="destructive">ANULADO</Badge>}
                    </div>
                    <p className={`mt-2 text-sm text-foreground ${esAnulado ? 'line-through' : ''}`}>{row.cliente_denominacion}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <p className={`text-lg font-bold text-foreground ${esAnulado ? 'line-through' : ''}`}>
                        {row.moneda === 2 ? '$' : 'S/'} {Number(row.total).toFixed(2)}
                      </p>
                      <Badge variant={pagado ? 'default' : 'outline'}>{pagado ? 'PAGADO' : 'NO PAGADO'}</Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {row.nubefact_enlace_pdf && (
                        <Badge variant="destructive" render={<a href={row.nubefact_enlace_pdf} target="_blank" rel="noreferrer" />}>PDF</Badge>
                      )}
                      {row.nubefact_enlace_xml && (
                        <Badge variant="default" render={<a href={row.nubefact_enlace_xml} target="_blank" rel="noreferrer" />}>XML</Badge>
                      )}
                      {row.nubefact_enlace_cdr && (
                        <Badge variant="secondary" render={<a href={row.nubefact_enlace_cdr} target="_blank" rel="noreferrer" />}>CDR</Badge>
                      )}
                      {row.estado !== 'BORRADOR' && (
                        <Badge variant={aceptada ? 'default' : 'destructive'}>SUNAT {aceptada ? '✔' : '✘'}</Badge>
                      )}
                    </div>
                    <div className="mt-3 flex justify-end border-t pt-2">
                      <Button variant="link" size="sm" onClick={() => handleVer(row)}>Ver</Button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Escritorio: tabla completa, igual a la del Consolidado de NubeFact */}
            <div className="hidden overflow-x-auto rounded-lg border md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>FECHA</TableHead>
                    <TableHead>TIPO</TableHead>
                    <TableHead>SERIE</TableHead>
                    <TableHead>NÚM.</TableHead>
                    <TableHead>ENTIDAD</TableHead>
                    <TableHead className="text-center">M</TableHead>
                    <TableHead className="text-right">TOTAL</TableHead>
                    <TableHead className="text-center">PAGADO?</TableHead>
                    <TableHead className="text-center" title="No disponible en este sistema">ENVIADO AL CLIENTE?</TableHead>
                    <TableHead className="text-center" title="No disponible en este sistema">LEÍDO POR CLIENTE?</TableHead>
                    <TableHead className="text-center">ANULADO?</TableHead>
                    <TableHead className="text-center">IMPRIMIR</TableHead>
                    <TableHead className="text-center">PDF</TableHead>
                    <TableHead className="text-center">XML</TableHead>
                    <TableHead className="text-center">CDR</TableHead>
                    <TableHead className="text-center">ESTADO EN LA SUNAT</TableHead>
                    <TableHead className="text-center">VER</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageRows.map(row => {
                    const esAnulado = row.estado === 'ANULADO';
                    const aceptada = isAceptada(row);
                    const pagado = isPagado(row);
                    const rowText = esAnulado ? 'line-through' : '';
                    return (
                      <TableRow key={row.id} className={esAnulado ? 'bg-amber-100 hover:bg-amber-100' : undefined}>
                        <TableCell className={rowText}>{formatFecha((row as any).fecha_de_emision)}</TableCell>
                        <TableCell className={rowText}>{SUNAT_TIPO_CODE[row.tipo_de_comprobante] || '-'}</TableCell>
                        <TableCell className={`font-mono ${rowText}`}>{row.serie}</TableCell>
                        <TableCell className={`font-mono ${rowText}`}>{row.numero}</TableCell>
                        <TableCell className={rowText}>
                          <p>{row.cliente_denominacion}</p>
                          <p className="text-xs text-muted-foreground">{row.cliente_numero_de_documento}</p>
                        </TableCell>
                        <TableCell className={`text-center ${rowText}`}>{row.moneda === 2 ? '$' : 'S/'}</TableCell>
                        <TableCell className={`text-right font-semibold ${rowText}`}>{Number(row.total).toFixed(2)}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={pagado ? 'default' : 'outline'}>{pagado ? 'SI' : 'NO'}</Badge>
                        </TableCell>
                        <TableCell className="text-center text-muted-foreground">—</TableCell>
                        <TableCell className="text-center text-muted-foreground">—</TableCell>
                        <TableCell className={`text-center font-semibold ${esAnulado ? 'text-destructive' : 'text-muted-foreground'}`}>
                          {esAnulado ? 'SI' : 'NO'}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button variant="ghost" size="icon-sm" onClick={() => openLink(row.nubefact_enlace_pdf)} title="Imprimir">
                            <PrinterIcon />
                          </Button>
                        </TableCell>
                        <TableCell className="text-center">
                          {row.nubefact_enlace_pdf ? (
                            <Badge variant="destructive" render={<a href={row.nubefact_enlace_pdf} target="_blank" rel="noreferrer" />}>PDF</Badge>
                          ) : '-'}
                        </TableCell>
                        <TableCell className="text-center">
                          {row.nubefact_enlace_xml ? (
                            <Badge variant="default" render={<a href={row.nubefact_enlace_xml} target="_blank" rel="noreferrer" />}>XML</Badge>
                          ) : '-'}
                        </TableCell>
                        <TableCell className="text-center">
                          {row.nubefact_enlace_cdr ? (
                            <Badge variant="secondary" render={<a href={row.nubefact_enlace_cdr} target="_blank" rel="noreferrer" />}>CDR</Badge>
                          ) : '-'}
                        </TableCell>
                        <TableCell className="text-center">
                          {row.estado === 'BORRADOR' ? '-' : (
                            aceptada
                              ? <CircleCheckIcon className="mx-auto size-4 text-emerald-600" />
                              : <CircleXIcon className="mx-auto size-4 text-destructive" />
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button variant="link" size="sm" onClick={() => handleVer(row)}>Ver</Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </div>

      <ComprobanteOptionsModal
        isOpen={!!optionsInvoice}
        invoice={optionsInvoice}
        onClose={() => setOptionsInvoice(null)}
        onChanged={loadInvoices}
        onGenerateNew={() => setOptionsInvoice(null)}
        onNotify={onNotify}
      />
    </div>
  );
};
