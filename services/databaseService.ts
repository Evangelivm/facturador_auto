import { Client, InvoiceData } from '@/types';

export const saveInvoiceToDb = async (invoice: InvoiceData) => {
  try {
    const response = await fetch('/api/invoices', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(invoice),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Error al guardar en base de datos');
    }

    return await response.json();
  } catch (error) {
    console.error('Error saving to DB:', error);
    throw error;
  }
};

export const getInvoices = async (status?: string) => {
  try {
    const url = status ? `/api/invoices?status=${status}` : '/api/invoices';
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch invoices');
    return await response.json();
  } catch (error) {
    console.error('Error fetching invoices:', error);
    throw error;
  }
};

// Trae el detalle completo (items incluidos) de todos los comprobantes, para armar el
// "Consolidado" en Excel. Solo se usa al exportar, no en el listado normal.
export const getInvoicesForExport = async () => {
  try {
    const response = await fetch('/api/invoices?export=1');
    if (!response.ok) throw new Error('Failed to fetch invoices for export');
    return await response.json();
  } catch (error) {
    console.error('Error fetching invoices for export:', error);
    throw error;
  }
};

export const getInvoiceById = async (id: number) => {
    try {
        const response = await fetch(`/api/invoices?id=${id}`);
        if (!response.ok) throw new Error('Failed to fetch invoice');
        return await response.json();
    } catch (error) {
        console.error('Error fetching invoice:', error);
        throw error;
    }
};

export const getProjects = async () => {
  const res = await fetch('/api/projects');
  if (!res.ok) throw new Error('Failed to fetch projects');
  return res.json();
};

export const addProject = async (name: string) => {
  const res = await fetch('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  });
  if (!res.ok) throw new Error('Failed to add project');
  return res.json();
};

export const getServiceLines = async () => {
  const res = await fetch('/api/service-lines');
  if (!res.ok) throw new Error('Failed to fetch service lines');
  return res.json();
};

export const addServiceLine = async (name: string) => {
  const res = await fetch('/api/service-lines', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  });
  if (!res.ok) throw new Error('Failed to add service line');
  return res.json();
};

export const updateInvoiceStatus = async (
  id: number,
  estado: string,
  nubefactData?: {
    nubefact_enlace_pdf?: string;
    nubefact_enlace_xml?: string;
    nubefact_enlace_cdr?: string;
    nubefact_sunat_description?: string;
  }
) => {
  const res = await fetch('/api/invoices', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, estado, ...nubefactData })
  });
  if (!res.ok) throw new Error('Error al actualizar la factura en base de datos');
  return res.json();
};

export const anularInvoiceInDb = async (
  id: number,
  motivo: string,
  baja?: {
    ticket?: string;
    aceptada?: boolean;
    description?: string;
    enlace_pdf?: string;
    enlace_xml?: string;
    enlace_cdr?: string;
  }
) => {
  const res = await fetch('/api/invoices', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id, estado: 'ANULADO', motivo_anulacion: motivo,
      nubefact_baja_ticket: baja?.ticket,
      nubefact_baja_aceptada: baja?.aceptada,
      nubefact_baja_description: baja?.description,
      nubefact_baja_enlace_pdf: baja?.enlace_pdf,
      nubefact_baja_enlace_xml: baja?.enlace_xml,
      nubefact_baja_enlace_cdr: baja?.enlace_cdr,
    })
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Error al registrar la anulación en la base de datos');
  }
  return res.json();
};

// Refresca el estado de un TICKET de baja ya generado, consultado con "consultar_anulacion".
export const actualizarEstadoBajaEnDb = async (
  id: number,
  baja: {
    aceptada?: boolean;
    description?: string;
    enlace_pdf?: string;
    enlace_xml?: string;
    enlace_cdr?: string;
  }
) => {
  const res = await fetch('/api/invoices', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id, refresh_baja: true,
      nubefact_baja_aceptada: baja.aceptada,
      nubefact_baja_description: baja.description,
      nubefact_baja_enlace_pdf: baja.enlace_pdf,
      nubefact_baja_enlace_xml: baja.enlace_xml,
      nubefact_baja_enlace_cdr: baja.enlace_cdr,
    })
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Error al consultar el estado de la baja');
  }
  return res.json();
};

export const registrarPagoEnDb = async (id: number, fechaPago: string, comprobantePagoData?: string) => {
  const res = await fetch('/api/pago', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, fecha_pago: fechaPago, comprobante_pago_data: comprobantePagoData })
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Error al registrar el pago');
  }
  return res.json();
};

export const deleteInvoiceFromDb = async (id: number) => {
  const res = await fetch(`/api/invoices?id=${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Error al eliminar el comprobante');
  }
  return res.json();
};

export const searchEmpresas = async (query: string): Promise<Client[]> => {
  if (!query.trim()) return [];
  const res = await fetch(`/api/empresas?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error('Failed to search empresas');
  return res.json();
};

export const getApiProfiles = async () => {
  const res = await fetch('/api/profiles');
  if (!res.ok) throw new Error('Failed to fetch profiles');
  return res.json();
};

export const addApiProfile = async (name: string, route: string, token: string) => {
  const res = await fetch('/api/profiles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, route, token })
  });
  if (!res.ok) throw new Error('Failed to add profile');
  return res.json();
};
