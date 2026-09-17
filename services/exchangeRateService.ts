export interface TipoCambioSunat {
  origen: string;
  compra: number;
  venta: number;
  moneda: string;
  fecha: string;
}

/**
 * Consulta el tipo de cambio SUNAT (USD/PEN) publicado para una fecha, vía el proxy propio
 * (la API externa no permite CORS desde el navegador).
 * @param fechaISO Fecha en formato YYYY-MM-DD
 */
export const getTipoCambioSunat = async (fechaISO: string): Promise<TipoCambioSunat> => {
  const res = await fetch(`/api/tipo-cambio?fecha=${fechaISO}`);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'No se pudo obtener el tipo de cambio');
  }
  return data;
};
