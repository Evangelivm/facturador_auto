'use client';

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangleIcon } from 'lucide-react';

export interface OcDuplicadaMatch {
  serie: string;
  numero: number | string;
  cliente_denominacion?: string;
  fecha_de_emision?: string;
  estado?: string;
}

interface OcDuplicadaModalProps {
  isOpen: boolean;
  ordenCompra: string;
  matches: OcDuplicadaMatch[];
  onCancel: () => void;
  onConfirm: () => void;
}

export const OcDuplicadaModal: React.FC<OcDuplicadaModalProps> = ({
  isOpen,
  ordenCompra,
  matches,
  onCancel,
  onConfirm,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={(next) => { if (!next) onCancel(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            <AlertTriangleIcon className="h-5 w-5 shrink-0" />
            REVISAR O/C YA EMITIDA
          </DialogTitle>
          <DialogDescription>
            La orden de compra <strong>{ordenCompra}</strong> ya tiene {matches.length === 1 ? 'un comprobante emitido' : `${matches.length} comprobantes emitidos`} registrado{matches.length === 1 ? '' : 's'}. Verifica que no se esté facturando dos veces antes de continuar.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-48 overflow-y-auto rounded-md border divide-y">
          {matches.map((m, idx) => (
            <div key={idx} className="flex items-center justify-between gap-2 p-2 text-sm">
              <div className="min-w-0">
                <div className="font-medium">{m.serie}-{m.numero}</div>
                {m.cliente_denominacion && (
                  <div className="truncate text-xs text-muted-foreground">{m.cliente_denominacion}</div>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {m.fecha_de_emision && <span className="text-xs text-muted-foreground">{m.fecha_de_emision}</span>}
                <Badge variant="outline">{m.estado || 'EMITIDO'}</Badge>
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Revisar O/C
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm}>
            Emitir de todas formas
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
