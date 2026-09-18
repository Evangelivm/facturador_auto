import { getInventarioPool } from './inventarioDb';
import { CatalogItem } from '@/types';

// Busca en `listado_items_2025` (base de datos de inventario de ayala) por código o descripción.
export const searchCatalogItems = async (term: string): Promise<CatalogItem[]> => {
  const q = term.trim();
  if (!q) return [];

  const rows = await getInventarioPool().query(
    `SELECT codigo, descripcion, precio_unitario, u_m
     FROM listado_items_2025
     WHERE activo = 1 AND (codigo LIKE ? OR descripcion LIKE ?)
     ORDER BY descripcion
     LIMIT 20`,
    [`%${q}%`, `%${q}%`]
  );

  return rows.map((r: any) => ({
    codigo: r.codigo || '',
    descripcion: r.descripcion || '',
    precio_unitario: r.precio_unitario !== null ? Number(r.precio_unitario) : 0,
    u_m: r.u_m || null,
  }));
};
