import mariadb from 'mariadb';

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

const globalForAyala = globalThis as unknown as { ayalaPool?: mariadb.Pool };

export const ayalaPool = globalForAyala.ayalaPool ?? createPool();

if (process.env.NODE_ENV !== 'production') {
  globalForAyala.ayalaPool = ayalaPool;
}

export default ayalaPool;
