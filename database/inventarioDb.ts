import mariadb, { type Pool } from 'mariadb';

// Pool de conexión aparte para la base de datos de inventario de ayala
// (ayala_back la usa como DATABASE_URL_THIRD), usada solo para leer el
// catálogo `listado_items_2025` desde el buscador de ítems.
// Ver DATABASE_URL_INVENTARIO en .env.local.
function createPool() {
  const url = new URL(process.env.DATABASE_URL_INVENTARIO!);
  return mariadb.createPool({
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ''),
    connectionLimit: 5,
  });
}

const globalForInventario = globalThis as unknown as { inventarioPool?: Pool };

// Se crea perezosamente (al primer query, no al importar el módulo): así el
// build de Next.js no se rompe si DATABASE_URL_INVENTARIO aún no está
// configurada en el entorno (p.ej. falta agregarla en Vercel).
export function getInventarioPool(): Pool {
  if (!globalForInventario.inventarioPool) {
    globalForInventario.inventarioPool = createPool();
  }
  return globalForInventario.inventarioPool;
}
