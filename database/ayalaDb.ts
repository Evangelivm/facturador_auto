import mariadb, { type Pool } from 'mariadb';

// Pool de conexión aparte para la base de datos de "ayala" (ayala_back), usada
// solo para leer la tabla `empresas_2025` desde el buscador de clientes.
// Ver DATABASE_URL_AYALA en .env.local.
function createPool() {
  const url = new URL(process.env.DATABASE_URL_AYALA!);
  return mariadb.createPool({
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ''),
    connectionLimit: 5,
  });
}

const globalForAyala = globalThis as unknown as { ayalaPool?: Pool };

// Se crea perezosamente (al primer query, no al importar el módulo): así el
// build de Next.js no se rompe si DATABASE_URL_AYALA aún no está configurada
// en el entorno (p.ej. falta agregarla en Vercel).
export function getAyalaPool(): Pool {
  if (!globalForAyala.ayalaPool) {
    globalForAyala.ayalaPool = createPool();
  }
  return globalForAyala.ayalaPool;
}
