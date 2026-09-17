'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { SearchIcon } from 'lucide-react';

interface DetractionItem {
  code: string;
  label: string;
  percent: number;
}

interface DetractionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (item: DetractionItem) => void;
  catalog: DetractionItem[];
}

export const DetractionModal: React.FC<DetractionModalProps> = ({ isOpen, onClose, onSelect, catalog }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredCatalog, setFilteredCatalog] = useState<DetractionItem[]>(catalog);

  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      setFilteredCatalog(catalog);
    }
  }, [isOpen, catalog]);

  useEffect(() => {
    const lowerTerm = searchTerm.toLowerCase();
    const filtered = catalog.filter(item =>
      item.code.toLowerCase().includes(lowerTerm) ||
      item.label.toLowerCase().includes(lowerTerm) ||
      item.percent.toString().includes(lowerTerm)
    );
    setFilteredCatalog(filtered);
  }, [searchTerm, catalog]);

  return (
    <Dialog open={isOpen} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="flex max-h-[80vh] flex-col sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Seleccionar Tipo de Detracción</DialogTitle>
          <DialogDescription>Seleccione el tipo de bien o servicio sujeto a detracción según SUNAT</DialogDescription>
        </DialogHeader>

        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Buscar por código, producto o porcentaje..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoFocus
          />
        </div>

        <div className="flex-1 overflow-y-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Cód</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead className="text-right">%</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCatalog.map((item) => (
                <TableRow
                  key={item.code}
                  onClick={() => onSelect(item)}
                  className="cursor-pointer"
                >
                  <TableCell className="font-medium">{item.code}</TableCell>
                  <TableCell className="whitespace-normal text-muted-foreground">{item.label}</TableCell>
                  <TableCell className="text-right font-bold text-primary">{item.percent.toFixed(2)}%</TableCell>
                </TableRow>
              ))}
              {filteredCatalog.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="whitespace-normal py-10 text-center text-muted-foreground">
                    No se encontraron resultados para &quot;{searchTerm}&quot;
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
