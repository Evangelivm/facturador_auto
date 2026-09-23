'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Client } from '@/types';
import { searchEmpresas } from '@/services/databaseService';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { SearchIcon, PlusIcon } from 'lucide-react';

interface ClientSearchProps {
  onSelect: (client: Client) => void;
  currentValue: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const ClientSearch: React.FC<ClientSearchProps> = ({ onSelect, currentValue, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [empresaResults, setEmpresaResults] = useState<Client[]>([]);
  const [isSearchingEmpresas, setIsSearchingEmpresas] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // New Client Form State
  const [newClient, setNewClient] = useState<Client>({
    numero_documento: '',
    denominacion: '',
    direccion: '',
    email: '',
    tipo_documento: 6 // Default RUC
  });

  // Load clients from localStorage on mount
  useEffect(() => {
    const savedClients = localStorage.getItem('invoice_clients');
    if (savedClients) {
      setClients(JSON.parse(savedClients));
    }
  }, []);

  // Filter clients based on input
  useEffect(() => {
    if (!currentValue) {
      setFilteredClients(clients);
      return;
    }
    const lowerTerm = currentValue.toLowerCase();
    const filtered = clients.filter(c =>
      c.numero_documento.includes(lowerTerm) ||
      c.denominacion.toLowerCase().includes(lowerTerm)
    );
    setFilteredClients(filtered);
  }, [currentValue, clients]);

  // Busca en la base de datos de ayala (tabla empresas_2025) por RUC o razón social
  useEffect(() => {
    const term = currentValue.trim();
    if (term.length < 2) {
      setEmpresaResults([]);
      return;
    }

    let cancelled = false;
    setIsSearchingEmpresas(true);
    const timeoutId = setTimeout(async () => {
      try {
        const results = await searchEmpresas(term);
        if (!cancelled) setEmpresaResults(results);
      } catch (error) {
        console.error('Error buscando empresas:', error);
        if (!cancelled) setEmpresaResults([]);
      } finally {
        if (!cancelled) setIsSearchingEmpresas(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [currentValue]);

  // Combina clientes guardados localmente con empresas encontradas en ayala,
  // evitando duplicados por número de documento (se prioriza el guardado local).
  const combinedResults = [
    ...filteredClients,
    ...empresaResults.filter(
      (empresa) => !filteredClients.some((c) => c.numero_documento === empresa.numero_documento)
    ),
  ];

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);

  const handleSelect = (client: Client) => {
    onSelect(client);
    setIsOpen(false);
  };

  const handleSaveNewClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClient.numero_documento || !newClient.denominacion) {
        setFormError("RUC y Razón Social son obligatorios");
        return;
    }
    setFormError(null);

    const updatedClients = [...clients, newClient];
    setClients(updatedClients);
    localStorage.setItem('invoice_clients', JSON.stringify(updatedClients));

    // Select the new client immediately
    onSelect(newClient);

    // Reset and close
    setNewClient({
        numero_documento: '',
        denominacion: '',
        direccion: '',
        email: '',
        tipo_documento: 6
    });
    setIsModalOpen(false);
  };

  const handleNewClientChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const { name, value } = e.target;
      setNewClient(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <div className="relative">
        <Input
          name="cliente_numero_de_documento"
          value={currentValue}
          onChange={onChange}
          onFocus={() => setIsOpen(true)}
          placeholder="Buscar cliente (RUC o Nombre)..."
          className="pr-8"
          autoComplete="off"
        />
        <SearchIcon className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      </div>

      {/* Dropdown - Enhanced Table Layout */}
      {isOpen && (
        <div className="absolute -left-1 z-50 mt-1 max-h-80 w-[780px] overflow-y-auto overflow-x-hidden rounded-lg bg-popover text-popover-foreground shadow-xl ring-1 ring-foreground/10">
          <button
             type="button"
             className="flex w-full items-center border-b px-4 py-3 text-left font-bold text-primary transition-colors hover:bg-primary/5"
             onClick={() => {
                 setIsOpen(false);
                 setFormError(null);
                 setNewClient(prev => ({ ...prev, numero_documento: currentValue })); // Pre-fill RUC if user typed it
                 setIsModalOpen(true);
             }}
          >
             <PlusIcon className="mr-2 size-4" /> Crear Nuevo Cliente
          </button>

          {isSearchingEmpresas && (
            <div className="px-4 py-1.5 text-xs text-muted-foreground">Buscando empresas...</div>
          )}

          {combinedResults.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <p>No se encontraron clientes.</p>
              <p className="mt-1 text-xs">Haga clic arriba para crear uno nuevo.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">RUC</TableHead>
                  <TableHead>Razón Social</TableHead>
                  <TableHead>Dirección</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {combinedResults.map((client, index) => (
                  <TableRow key={index} className="cursor-pointer" onClick={() => handleSelect(client)}>
                    <TableCell className="font-medium whitespace-nowrap">{client.numero_documento}</TableCell>
                    <TableCell className="whitespace-normal break-words">{client.denominacion}</TableCell>
                    <TableCell className="max-w-[260px] truncate" title={client.direccion}>{client.direccion}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}

      {/* Modal Create Client */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar Nuevo Cliente</DialogTitle>
          </DialogHeader>

          {formError && (
            <Alert variant="destructive">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSaveNewClient}>
            <div className="flex flex-col gap-4">
              <Field>
                <FieldLabel htmlFor="new-client-ruc">RUC *</FieldLabel>
                <Input id="new-client-ruc" name="numero_documento" value={newClient.numero_documento} onChange={handleNewClientChange} placeholder="107032..." required />
              </Field>
              <Field>
                <FieldLabel htmlFor="new-client-denominacion">Razón Social *</FieldLabel>
                <Input id="new-client-denominacion" name="denominacion" value={newClient.denominacion} onChange={handleNewClientChange} placeholder="EMPRESA S.A.C." required />
              </Field>
              <Field>
                <FieldLabel htmlFor="new-client-direccion">Dirección *</FieldLabel>
                <Input id="new-client-direccion" name="direccion" value={newClient.direccion} onChange={handleNewClientChange} placeholder="Av. Principal 123..." required />
              </Field>
              <Field>
                <FieldLabel htmlFor="new-client-email">Email</FieldLabel>
                <Input id="new-client-email" type="email" name="email" value={newClient.email} onChange={handleNewClientChange} placeholder="contacto@empresa.com" />
              </Field>
            </div>

            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                Guardar Cliente
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
