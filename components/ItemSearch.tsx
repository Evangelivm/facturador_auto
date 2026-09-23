'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { CatalogItem } from '@/types';
import { Input } from '@/components/ui/input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { searchCatalogItems } from '@/services/databaseService';

interface ItemSearchProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSelect: (item: CatalogItem) => void;
  className?: string;
  placeholder?: string;
}

export const ItemSearch: React.FC<ItemSearchProps> = ({ value, onChange, onSelect, className, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<CatalogItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Busca en el catálogo de inventario de ayala (tabla listado_items_2025)
  useEffect(() => {
    const term = value.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }

    let cancelled = false;
    setIsSearching(true);
    const timeoutId = setTimeout(async () => {
      try {
        const items = await searchCatalogItems(term);
        if (!cancelled) setResults(items);
      } catch (error) {
        console.error('Error buscando ítems del catálogo:', error);
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [value]);

  // El input suele vivir dentro de una tabla con overflow-hidden (para las esquinas
  // redondeadas), así que el dropdown se renderiza en un portal a <body> y se
  // posiciona con coordenadas fijas para no quedar recortado.
  const updatePosition = useCallback(() => {
    const rect = inputRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPosition({ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 320) });
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen, updatePosition]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      // El dropdown se renderiza en un portal a <body>, así que no es
      // descendiente de wrapperRef: hay que revisar ambos contenedores.
      const insideWrapper = wrapperRef.current?.contains(target);
      const insideDropdown = dropdownRef.current?.contains(target);
      if (!insideWrapper && !insideDropdown) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (item: CatalogItem) => {
    onSelect(item);
    setIsOpen(false);
  };

  const showDropdown = isOpen && value.trim().length >= 2 && position;

  return (
    <div className="relative" ref={wrapperRef}>
      <Input
        ref={inputRef}
        value={value}
        onChange={onChange}
        onFocus={() => setIsOpen(true)}
        className={className}
        placeholder={placeholder}
        autoComplete="off"
      />

      {showDropdown && position && createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-50 max-h-72 overflow-y-auto overflow-x-hidden rounded-lg bg-popover text-popover-foreground shadow-xl ring-1 ring-foreground/10"
          style={{ top: position.top, left: position.left, width: Math.max(position.width, 520) }}
        >
          {isSearching && (
            <div className="px-4 py-1.5 text-xs text-muted-foreground">Buscando ítems...</div>
          )}

          {results.length === 0 ? (
            <div className="p-4 text-center text-xs text-muted-foreground">
              {isSearching ? 'Buscando...' : 'No se encontraron ítems en el catálogo.'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Código</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="w-20 text-right">Precio</TableHead>
                  <TableHead className="w-16 text-center">UM</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((item, index) => (
                  <TableRow key={index} className="cursor-pointer" onClick={() => handleSelect(item)}>
                    <TableCell className="whitespace-nowrap font-medium">{item.codigo}</TableCell>
                    <TableCell className="whitespace-normal break-words">{item.descripcion}</TableCell>
                    <TableCell className="text-right">{item.precio_unitario.toFixed(2)}</TableCell>
                    <TableCell className="text-center">{item.u_m || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>,
        document.body
      )}
    </div>
  );
};
