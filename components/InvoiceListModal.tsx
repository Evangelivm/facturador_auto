'use client';

import React, { useState, useEffect } from 'react';
import { getInvoices, getInvoiceById } from '@/services/databaseService';
import { InvoiceData } from '@/types';
import { formatFecha } from '@/lib/consolidadoReport';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty, EmptyHeader, EmptyTitle, EmptyMedia } from '@/components/ui/empty';
import { InboxIcon, Loader2Icon } from 'lucide-react';

interface InvoiceListProps {
  onSelectInvoice: (invoice: InvoiceData) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const InvoiceListModal: React.FC<InvoiceListProps> = ({ onSelectInvoice, isOpen, onClose }) => {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('TODOS'); // TODOS, BORRADOR, EMITIDO

  useEffect(() => {
    if (isOpen) {
      loadInvoices();
    }
  }, [isOpen, filter]);

  const loadInvoices = async () => {
    setLoading(true);
    try {
      const status = filter === 'TODOS' ? undefined : filter;
      const data = await getInvoices(status);
      setInvoices(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = async (id: number) => {
      setLoading(true);
      try {
          const fullInvoice = await getInvoiceById(id);
          onSelectInvoice(fullInvoice);
          onClose();
      } catch (error) {
          alert("Error al cargar la factura");
      } finally {
          setLoading(false);
      }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Listado de Documentos</DialogTitle>
        </DialogHeader>

        <ToggleGroup variant="outline" value={[filter]} onValueChange={(v) => v[0] && setFilter(v[0])}>
          <ToggleGroupItem value="TODOS">Todos</ToggleGroupItem>
          <ToggleGroupItem value="BORRADOR">Borradores</ToggleGroupItem>
          <ToggleGroupItem value="EMITIDO">Emitidos</ToggleGroupItem>
        </ToggleGroup>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
            <Loader2Icon className="size-4 animate-spin" /> Cargando...
          </div>
        ) : invoices.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon"><InboxIcon /></EmptyMedia>
              <EmptyTitle>No hay documentos encontrados</EmptyTitle>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-center">Estado</TableHead>
                  <TableHead className="text-center">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell>{formatFecha(inv.fecha_de_emision)}</TableCell>
                    <TableCell className="font-mono">{inv.serie}-{inv.numero}</TableCell>
                    <TableCell>{inv.cliente_denominacion}</TableCell>
                    <TableCell className="text-right font-bold">
                      {inv.moneda === 1 ? 'S/' : '$'} {parseFloat(inv.total).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={inv.estado === 'EMITIDO' ? 'default' : inv.estado === 'BORRADOR' ? 'secondary' : 'destructive'}>
                        {inv.estado || 'EMITIDO'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button variant="link" size="sm" onClick={() => handleSelect(inv.id)}>
                        {inv.estado === 'BORRADOR' ? 'Editar/Emitir' : 'Ver/Copiar'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
