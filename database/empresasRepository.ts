import { getAyalaPool } from './ayalaDb';
import { Client } from '@/types';

// Busca en `empresas_2025` (base de datos de ayala) por RUC o razón social.
export const searchEmpresasAyala = async (term: string): Promise<Client[]> => {
  const q = term.trim();
  if (!q) return [];

  const rows = await getAyalaPool().query(
    `SELECT codigo, razon_social, nro_documento, direccion
     FROM empresas_2025
     WHERE nro_documento LIKE ? OR razon_social LIKE ?
     ORDER BY razon_social
     LIMIT 20`,
    [`%${q}%`, `%${q}%`]
  );

  return rows.map((r: any) => ({
    numero_documento: r.nro_documento || '',
    denominacion: r.razon_social || '',
    direccion: r.direccion || '',
    email: '',
    tipo_documento: 6,
  }));
};
