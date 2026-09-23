import { getAyalaPool } from './ayalaDb';

// Lee el catálogo de proyectos (`centroproyecto`) y líneas de servicio (`fasecontrol`)
// de la base de datos de ayala — las mismas tablas que alimentan los select
// "Proyectos" y "Línea de Servicio" del formulario de nueva factura en ayala_front.
export const getProyectosAyala = async (): Promise<string[]> => {
  const rows = await getAyalaPool().query(
    `SELECT DISTINCT proyecto FROM centroproyecto WHERE proyecto IS NOT NULL AND proyecto <> '' ORDER BY proyecto`
  );
  return rows.map((r: any) => r.proyecto as string);
};

export const getLineasServicioAyala = async (): Promise<string[]> => {
  const rows = await getAyalaPool().query(
    `SELECT DISTINCT descripcion FROM fasecontrol WHERE descripcion IS NOT NULL AND descripcion <> '' ORDER BY descripcion`
  );
  return rows.map((r: any) => r.descripcion as string);
};
