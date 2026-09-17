
import { InvoiceData, NubeFactResponse } from '@/types';

// Helper to parse response and throw specific errors
const handleResponse = async (response: Response) => {
    const text = await response.text();
    let result: any;
    try {
        result = JSON.parse(text);
    } catch (e) {
        // If it's HTML (common with proxy errors), throw a clearer error
        if (text.trim().startsWith('<')) {
             // Try to extract title from HTML for better error message
            const titleMatch = text.match(/<title>(.*?)<\/title>/i);
            const title = titleMatch ? titleMatch[1] : 'Error desconocido del Proxy';
            throw new Error(`El Proxy devolvió un error (Posible bloqueo): ${title}`);
        }
        throw new Error(`Respuesta inválida del servidor: ${text.substring(0, 100)}...`);
    }

    if (!response.ok) {
       if (result.errors) {
         const errorMsg = typeof result.errors === 'string' ? result.errors : JSON.stringify(result.errors);
         throw new Error(errorMsg);
       }
       throw new Error(result.error || `Error HTTP ${response.status}: ${result.message || 'Desconocido'}`);
    }
    return result as NubeFactResponse;
}

/**
 * Sends the invoice data to NubeFact API via the local backend proxy. Las credenciales
 * (ruta y token) ya no se piden en pantalla: viven como variables de entorno en el servidor.
 */
export const sendInvoice = async (data: InvoiceData): Promise<NubeFactResponse> => {
  // Ensure items don't have internal ID when sending to API
  const payload = {
    ...data,
    items: data.items.map(({ id, ...rest }) => rest)
  };

  try {
    // Use local backend proxy
    const response = await fetch('/api/proxy/nubefact', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ data: payload })
    });

    return await handleResponse(response);

  } catch (error: any) {
    console.error("Error sending invoice:", error);
    throw new Error(error.message || "Error desconocido al contactar con NubeFact");
  }
};

/**
 * Consulta el estado actual de un comprobante ya generado (OPERACIÓN 2 del manual de NubeFact:
 * "consultar_comprobante"). Necesario porque SUNAT valida de forma asíncrona: la respuesta
 * inmediata de "generar_comprobante" a veces no trae aún el CDR ni la descripción SUNAT.
 */
export const consultarComprobante = async (
  params: { tipo_de_comprobante: number; serie: string; numero: number }
): Promise<NubeFactResponse> => {
  try {
    const response = await fetch('/api/proxy/nubefact', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        data: {
          operacion: 'consultar_comprobante',
          tipo_de_comprobante: params.tipo_de_comprobante,
          serie: params.serie,
          numero: params.numero
        }
      })
    });

    return await handleResponse(response);
  } catch (error: any) {
    console.error("Error consultando comprobante:", error);
    throw new Error(error.message || "Error desconocido al consultar el comprobante");
  }
};

/**
 * Anula un comprobante (Factura, Boleta, Nota de Crédito o Nota de Débito) ante NubeFact/SUNAT.
 * Corresponde a la OPERACIÓN 3 del manual de NubeFact: "generar_anulacion" (comunicación de baja).
 */
export const anularComprobante = async (
  params: { tipo_de_comprobante: number; serie: string; numero: number; motivo: string }
): Promise<NubeFactResponse> => {
  try {
    const response = await fetch('/api/proxy/nubefact', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        data: {
          operacion: 'generar_anulacion',
          tipo_de_comprobante: params.tipo_de_comprobante,
          serie: params.serie,
          numero: params.numero,
          motivo: params.motivo
        }
      })
    });

    return await handleResponse(response);
  } catch (error: any) {
    console.error("Error anulando comprobante:", error);
    throw new Error(error.message || "Error desconocido al anular el comprobante");
  }
};

/**
 * Checks connectivity with NubeFact API via the local backend proxy. No recibe credenciales:
 * el proxy las lee de las variables de entorno del servidor (NUBEFACT_ROUTE / NUBEFACT_TOKEN).
 */
export const checkConnection = async (): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await fetch('/api/proxy/nubefact', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ data: {} }) // Empty body for connection check
    });

    if (response.status === 401 || response.status === 403) {
      return { success: false, message: 'Token rechazado (401/403)' };
    }
    if (response.status === 404) {
      return { success: false, message: 'Ruta no encontrada (404)' };
    }
    if (response.status === 504) {
      return { success: false, message: 'Tiempo de espera agotado (Timeout)' };
    }
    if (response.status === 500) {
      const body = await response.json().catch(() => ({}));
      return { success: false, message: body.error || 'Error del servidor' };
    }
    // 400 means server received request but complained about empty body (good connection)
    if (response.status === 400) {
        return { success: true, message: 'Conectado' };
    }
    if (response.ok) {
        return { success: true, message: 'Conexión exitosa' };
    }

    return { success: false, message: `Error Servidor: ${response.status}` };

  } catch (error: any) {
    return { success: false, message: 'Sin conexión (Error de Red o Proxy)' };
  }
};
