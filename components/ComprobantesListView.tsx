'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { getInvoices, getInvoiceById } from '@/services/databaseService';
import { ComprobanteOptionsModal, ComprobanteRow } from './ComprobanteOptionsModal';
import { ToastType } from '@/types';
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
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableFooter } from '@/components/ui/table';
import { SearchIcon, DownloadIcon, FilterIcon, InboxIcon, XIcon, PlusIcon, CircleCheckIcon, CircleXIcon } from 'lucide-react';

interface ComprobantesListViewProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectInvoice: (invoice: any) => void;
  onGenerateNew: (invoice: ComprobanteRow, targetTipo: number) => void;
  onOpenBajas: () => void;
  onNotify: (message: string, type?: ToastType) => void;
}

const TIPO_LABELS: Record<number, string> = {
  1: 'FACTURA ELECTRÓNICA',
  2: 'BOLETA DE VENTA ELECTRÓNICA',
  3: 'NOTA DE CRÉDITO ELECTRÓNICA',
  4: 'NOTA DE DÉBITO ELECTRÓNICA'
};

// Código de tipo de comprobante según el catálogo 01 de SUNAT (el que NubeFact usa internamente es 1-4)
const SUNAT_TIPO_CODE: Record<number, string> = { 1: '01', 2: '03', 3: '07', 4: '08' };

const PAGE_SIZE = 15;

const formatFecha = (value: any) => {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('es-PE');
};

// Clave "YYYY-MM-DD" en fecha calendario local, para comparar contra los inputs type="date"
// sin que la diferencia de huso horario (la API devuelve fechas en UTC) descarte filas del
// día seleccionado.
const toDateKey = (value: any): string => {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const isAceptada = (row: ComprobanteRow) =>
  row.estado !== 'BORRADOR' && !row.nubefact_error && !!row.nubefact_sunat_description;

const isPagado = (row: ComprobanteRow) => !!row.pagado && Number(row.pagado) !== 0;

const EstadoBadge: React.FC<{ estado?: string }> = ({ estado }) => (
  <Badge variant={estado === 'EMITIDO' ? 'default' : estado === 'BORRADOR' ? 'secondary' : 'destructive'}>
    {estado || 'EMITIDO'}
  </Badge>
);

export const ComprobantesListView: React.FC<ComprobantesListViewProps> = ({
  isOpen, onClose, onSelectInvoice, onGenerateNew, onOpenBajas, onNotify
}) => {
  const [rows, setRows] = useState<ComprobanteRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState(''); // '', '1', '2', '3', '4', 'BORRADOR'
  const [entidadFiltro, setEntidadFiltro] = useState('');
  const [anuladoFiltro, setAnuladoFiltro] = useState(''); // '', 'ANULADOS', 'NO_ANULADOS'
  const [buscarDocumento, setBuscarDocumento] = useState('');
  const [page, setPage] = useState(1);

  const [optionsInvoice, setOptionsInvoice] = useState<ComprobanteRow | null>(null);

  const loadInvoices = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getInvoices();
      setRows(data);
    } catch (e: any) {
      setError(e.message || 'Error al cargar el listado de comprobantes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) loadInvoices();
  }, [isOpen]);

  const filteredRows = useMemo(() => {
    return rows.filter(row => {
      if (fechaInicio || fechaFin) {
        const rowDateKey = toDateKey((row as any).fecha_de_emision);
        if (fechaInicio && rowDateKey < fechaInicio) return false;
        if (fechaFin && rowDateKey > fechaFin) return false;
      }

      if (tipoFiltro === 'BORRADOR') {
        if (row.estado !== 'BORRADOR') return false;
      } else if (tipoFiltro) {
        if (String(row.tipo_de_comprobante) !== tipoFiltro) return false;
      }

      if (entidadFiltro) {
        const q = entidadFiltro.toLowerCase();
        const matches = (row.cliente_denominacion || '').toLowerCase().includes(q) ||
          (row.cliente_numero_de_documento || '').toLowerCase().includes(q);
        if (!matches) return false;
      }

      if (anuladoFiltro === 'ANULADOS' && row.estado !== 'ANULADO') return false;
      if (anuladoFiltro === 'NO_ANULADOS' && row.estado === 'ANULADO') return false;

      if (buscarDocumento) {
        const doc = `${row.serie}-${row.numero}`.toLowerCase();
        if (!doc.includes(buscarDocumento.toLowerCase())) return false;
      }

      return true;
    });
  }, [rows, fechaInicio, fechaFin, tipoFiltro, entidadFiltro, anuladoFiltro, buscarDocumento]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const pageRows = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [fechaInicio, fechaFin, tipoFiltro, entidadFiltro, anuladoFiltro, buscarDocumento]);

  const totals = useMemo(() => {
    const acc = { 1: 0, 2: 0, 3: 0, 4: 0 };
    filteredRows.forEach(row => {
      if (row.moneda !== 1) return; // Totales en Soles, igual que el reporte de NubeFact
      if (row.estado === 'ANULADO') return; // "...Y NO ANULADAS"
      if (row.estado === 'BORRADOR') return; // aún no se envió a SUNAT, no cuenta como comprobante real
      const tipo = row.tipo_de_comprobante as 1 | 2 | 3 | 4;
      if (acc[tipo] !== undefined) acc[tipo] += Number(row.total) || 0;
    });
    return acc;
  }, [filteredRows]);

  const handleOpenOptions = (row: ComprobanteRow) => setOptionsInvoice(row);

  const handleEditarBorrador = async (row: ComprobanteRow) => {
    try {
      const full = await getInvoiceById(row.id);
      onSelectInvoice(full);
      onClose();
    } catch (e: any) {
      onNotify('Error al cargar el borrador: ' + e.message, 'error');
    }
  };

  const handleDescargaExcel = () => {
    const header = ['FECHA', 'TIPO', 'SERIE', 'NUM', 'RUC/DNI', 'DENOMINACION', 'MONEDA', 'TOTAL', 'ESTADO', 'ANULADO', 'PROCESO', 'FECHA PAGO'];
    const csvRows = filteredRows.map(row => [
      formatFecha((row as any).fecha_de_emision),
      SUNAT_TIPO_CODE[row.tipo_de_comprobante] || row.tipo_de_comprobante,
      row.serie,
      row.numero,
      row.cliente_numero_de_documento || '',
      (row.cliente_denominacion || '').replace(/"/g, '""'),
      row.moneda === 2 ? 'USD' : 'PEN',
      Number(row.total).toFixed(2),
      row.estado || 'EMITIDO',
      row.estado === 'ANULADO' ? 'SI' : 'NO',
      isPagado(row) ? 'PAGADO' : 'POR COBRAR',
      (row as any).fecha_pago ? formatFecha((row as any).fecha_pago) : ''
    ]);
    const csv = [header, ...csvRows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `comprobantes_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-background">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-background/90 px-3 py-3 shadow-sm backdrop-blur-md sm:px-4 md:px-6">
        <h1 className="text-lg font-bold tracking-tight text-foreground sm:text-xl md:text-2xl">Comprobantes</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onOpenBajas}>
            Comunicaciones de baja
          </Button>
          <Button onClick={onClose}>
            <PlusIcon data-icon="inline-start" />
            Emitir comprobante
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose} title="Cerrar">
            <XIcon />
          </Button>
        </div>
      </div>

      <div className="w-full p-3 sm:p-4 md:p-6">
        <div className="mb-4 rounded-2xl border bg-card p-3 shadow-sm">
          <h2 className="mb-3 flex items-center gap-1.5 text-xs font-bold tracking-wide text-muted-foreground uppercase">
            <FilterIcon className="size-3.5 text-primary" />
            Filtros
          </h2>
          <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
            <Field>
              <FieldLabel htmlFor="filtro-desde">Desde</FieldLabel>
              <Input id="filtro-desde" type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="filtro-hasta">Hasta</FieldLabel>
              <Input id="filtro-hasta" type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="filtro-tipo">Tipo de comprobante</FieldLabel>
              <Select
                items={{
                  '': 'TODOS LOS TIPOS',
                  '1': 'FACTURA ELECTRÓNICA',
                  '2': 'BOLETA DE VENTA ELECTRÓNICA',
                  '3': 'NOTA DE CRÉDITO ELECTRÓNICA',
                  '4': 'NOTA DE DÉBITO ELECTRÓNICA',
                  BORRADOR: 'BORRADORES',
                }}
                value={tipoFiltro}
                onValueChange={(v) => setTipoFiltro(v ?? '')}
              >
                <SelectTrigger id="filtro-tipo" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="">TODOS LOS TIPOS</SelectItem>
                    <SelectItem value="1">FACTURA ELECTRÓNICA</SelectItem>
                    <SelectItem value="2">BOLETA DE VENTA ELECTRÓNICA</SelectItem>
                    <SelectItem value="3">NOTA DE CRÉDITO ELECTRÓNICA</SelectItem>
                    <SelectItem value="4">NOTA DE DÉBITO ELECTRÓNICA</SelectItem>
                    <SelectItem value="BORRADOR">BORRADORES</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="filtro-anulado">Estado de anulación</FieldLabel>
              <Select
                items={{ '': 'Todos', ANULADOS: 'Solo anulados', NO_ANULADOS: 'No anulados' }}
                value={anuladoFiltro}
                onValueChange={(v) => setAnuladoFiltro(v ?? '')}
              >
                <SelectTrigger id="filtro-anulado" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="">Todos</SelectItem>
                    <SelectItem value="ANULADOS">Solo anulados</SelectItem>
                    <SelectItem value="NO_ANULADOS">No anulados</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 md:grid-cols-4">
            <Field>
              <FieldLabel htmlFor="filtro-entidad">Buscar por entidad (RUC/DNI o razón social)</FieldLabel>
              <Input
                id="filtro-entidad"
                placeholder="Ej: KYC Industrial SAC"
                value={entidadFiltro}
                onChange={e => setEntidadFiltro(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="filtro-documento">Buscar documento</FieldLabel>
              <div className="flex gap-2">
                <Input
                  id="filtro-documento"
                  placeholder="Ej: FFF1-1"
                  value={buscarDocumento}
                  onChange={e => setBuscarDocumento(e.target.value)}
                />
                <Button size="icon" onClick={() => setPage(1)} title="Buscar documento">
                  <SearchIcon />
                </Button>
              </div>
            </Field>
            <Button onClick={loadInvoices}>Aplicar filtros</Button>
            <Button variant="secondary" onClick={handleDescargaExcel} title="Descargar como Excel/CSV">
              <DownloadIcon data-icon="inline-start" />
              Descarga Excel
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
            {/* Móvil / tablet angosta: tarjetas apiladas, sin scroll horizontal */}
            <div className="mb-4 flex flex-col gap-3 md:hidden">
              {pageRows.map(row => {
                const aceptada = isAceptada(row);
                const pagado = isPagado(row);
                return (
                  <div key={row.id} className={`rounded-xl border p-3 shadow-sm ${pagado ? 'border-amber-200 bg-amber-50' : 'bg-card'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-mono font-bold text-foreground">{row.serie}-{row.numero}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatFecha((row as any).fecha_de_emision)} · Tipo {SUNAT_TIPO_CODE[row.tipo_de_comprobante] || '-'}
                        </p>
                      </div>
                      <EstadoBadge estado={row.estado} />
                    </div>

                    <p className="mt-2 text-sm text-foreground">{row.cliente_denominacion}</p>
                    <p className="text-xs text-muted-foreground">{row.cliente_numero_de_documento}</p>

                    <div className="mt-2 flex items-center justify-between">
                      <p className="text-lg font-bold text-foreground">{row.moneda === 2 ? '$' : 'S/'} {Number(row.total).toFixed(2)}</p>
                      {row.estado === 'ANULADO' && <span className="text-xs font-bold text-destructive">ANULADO</span>}
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
                      {!row.estado || row.estado !== 'BORRADOR' ? (
                        <Badge variant={pagado ? 'default' : 'outline'}>{pagado ? 'PAGADO' : 'POR COBRAR'}</Badge>
                      ) : null}
                    </div>

                    <div className="mt-3 flex justify-end gap-4 border-t pt-2">
                      {row.estado === 'BORRADOR' && (
                        <Button variant="link" size="sm" onClick={() => handleEditarBorrador(row)}>Editar</Button>
                      )}
                      <Button variant="link" size="sm" onClick={() => handleOpenOptions(row)}>Opciones</Button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Escritorio / tablet ancha: tabla completa */}
            <div className="hidden rounded-lg border md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>FECHA</TableHead>
                    <TableHead>TIPO</TableHead>
                    <TableHead>SERIE</TableHead>
                    <TableHead>NUM</TableHead>
                    <TableHead>RUC</TableHead>
                    <TableHead>DENOMINACIÓN</TableHead>
                    <TableHead className="text-center">MONEDA</TableHead>
                    <TableHead className="text-right">TOTAL</TableHead>
                    <TableHead className="text-center">ESTADO</TableHead>
                    <TableHead className="text-center">ANULADO?</TableHead>
                    <TableHead className="text-center">PDF</TableHead>
                    <TableHead className="text-center">XML</TableHead>
                    <TableHead className="text-center">CDR</TableHead>
                    <TableHead className="text-center">ESTADO SUNAT</TableHead>
                    <TableHead className="text-center">PROCESO</TableHead>
                    <TableHead className="text-center">OPCIONES</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageRows.map(row => {
                    const aceptada = isAceptada(row);
                    const pagado = isPagado(row);
                    return (
                      <TableRow key={row.id} className={pagado ? 'bg-amber-50 hover:bg-amber-100' : undefined}>
                        <TableCell>{formatFecha((row as any).fecha_de_emision)}</TableCell>
                        <TableCell>{SUNAT_TIPO_CODE[row.tipo_de_comprobante] || '-'}</TableCell>
                        <TableCell className="font-mono">{row.serie}</TableCell>
                        <TableCell className="font-mono">{row.numero}</TableCell>
                        <TableCell>{row.cliente_numero_de_documento}</TableCell>
                        <TableCell>{row.cliente_denominacion}</TableCell>
                        <TableCell className="text-center">{row.moneda === 2 ? '$' : 'S/'}</TableCell>
                        <TableCell className="text-right font-semibold">{Number(row.total).toFixed(2)}</TableCell>
                        <TableCell className="text-center"><EstadoBadge estado={row.estado} /></TableCell>
                        <TableCell className={`text-center font-semibold ${row.estado === 'ANULADO' ? 'text-destructive' : 'text-muted-foreground'}`}>
                          {row.estado === 'ANULADO' ? 'SI' : 'NO'}
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
                          {row.estado === 'BORRADOR' ? '-' : (
                            <Badge variant={pagado ? 'default' : 'outline'}>{pagado ? 'PAGADO' : 'POR COBRAR'}</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center whitespace-nowrap">
                          {row.estado === 'BORRADOR' && (
                            <Button variant="link" size="sm" onClick={() => handleEditarBorrador(row)}>Editar</Button>
                          )}
                          <Button variant="link" size="sm" onClick={() => handleOpenOptions(row)}>Opciones</Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={7} className="text-right font-semibold">TOTAL DE FACTURAS EN SOLES (no anuladas)</TableCell>
                    <TableCell colSpan={9} className="font-bold">S/ {totals[1].toFixed(2)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={7} className="text-right font-semibold">TOTAL DE BOLETAS DE VENTA EN SOLES (no anuladas)</TableCell>
                    <TableCell colSpan={9} className="font-bold">S/ {totals[2].toFixed(2)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={7} className="text-right font-semibold">TOTAL DE NOTAS DE CRÉDITO EN SOLES (no anuladas)</TableCell>
                    <TableCell colSpan={9} className="font-bold">S/ {totals[3].toFixed(2)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={7} className="text-right font-semibold">TOTAL DE NOTAS DE DÉBITO EN SOLES (no anuladas)</TableCell>
                    <TableCell colSpan={9} className="font-bold">S/ {totals[4].toFixed(2)}</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>

            {/* Totales en móvil (la tabla con footer está oculta) */}
            <div className="flex flex-col gap-1 rounded-lg border p-3 text-sm md:hidden">
              <div className="flex justify-between"><span className="text-muted-foreground">Facturas (S/, no anuladas)</span><span className="font-bold">S/ {totals[1].toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Boletas (S/, no anuladas)</span><span className="font-bold">S/ {totals[2].toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Notas de crédito (S/, no anuladas)</span><span className="font-bold">S/ {totals[3].toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Notas de débito (S/, no anuladas)</span><span className="font-bold">S/ {totals[4].toFixed(2)}</span></div>
            </div>
          </>
        )}
      </div>

      <ComprobanteOptionsModal
        isOpen={!!optionsInvoice}
        invoice={optionsInvoice}
        onClose={() => setOptionsInvoice(null)}
        onChanged={loadInvoices}
        onGenerateNew={(invoice, targetTipo) => {
          setOptionsInvoice(null);
          onGenerateNew(invoice, targetTipo);
        }}
        onNotify={onNotify}
      />
    </div>
  );
};
