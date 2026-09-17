import prisma from './prisma';

// Prisma error code para violación de restricción unique (equivalente a ER_DUP_ENTRY de mysql2)
const isUniqueConstraintError = (error: any) => error?.code === 'P2002';

// Projects
export const getProjects = async () => {
  const rows = await prisma.proyecto.findMany({ where: { activo: true }, orderBy: { nombre: 'asc' } });
  return rows.map(r => r.nombre);
};

export const addProject = async (nombre: string) => {
  try {
    await prisma.proyecto.create({ data: { nombre } });
    return true;
  } catch (error: any) {
    if (isUniqueConstraintError(error)) return false; // Already exists
    throw error;
  }
};

// Service Lines
export const getServiceLines = async () => {
  const rows = await prisma.lineaServicio.findMany({ where: { activo: true }, orderBy: { nombre: 'asc' } });
  return rows.map(r => r.nombre);
};

export const addServiceLine = async (nombre: string) => {
  try {
    await prisma.lineaServicio.create({ data: { nombre } });
    return true;
  } catch (error: any) {
    if (isUniqueConstraintError(error)) return false;
    throw error;
  }
};

// API Profiles
export const getApiProfiles = async () => {
  const rows = await prisma.apiProfile.findMany({ where: { activo: true }, orderBy: { created_at: 'asc' } });
  return rows.map(r => ({
    id: r.id,
    name: r.nombre,
    config: { route: r.ruta, token: r.token }
  }));
};

// Si ya existe un perfil con ese nombre, actualiza su ruta/token en vez de duplicarlo
// (usado para guardar automáticamente las credenciales activas de NubeFact en la BD).
export const addApiProfile = async (nombre: string, ruta: string, token: string) => {
  const existing = await prisma.apiProfile.findFirst({ where: { nombre } });
  if (existing) {
    await prisma.apiProfile.update({ where: { id: existing.id }, data: { ruta, token, activo: true } });
    return existing.id;
  }
  const created = await prisma.apiProfile.create({ data: { nombre, ruta, token } });
  return created.id;
};
