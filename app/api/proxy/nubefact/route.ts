import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const { data } = await request.json();

  // Las credenciales de NubeFact ya no se piden en pantalla: viven solo en el
  // servidor (variables de entorno), nunca en el navegador del usuario.
  const route = process.env.NUBEFACT_ROUTE;
  const token = process.env.NUBEFACT_TOKEN;

  if (!route || !token) {
    return NextResponse.json({ error: 'Faltan configurar NUBEFACT_ROUTE / NUBEFACT_TOKEN en las variables de entorno del servidor' }, { status: 500 });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

  const startTime = Date.now();
  console.log(`[Proxy] Requesting: ${route}`);

  try {
    const response = await fetch(route, {
      method: 'POST',
      headers: {
        Authorization: token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data || {}),
      signal: controller.signal,
    });

    const duration = Date.now() - startTime;
    console.log(`[Proxy] Response received in ${duration}ms. Status: ${response.status}`);

    const contentType = response.headers.get('content-type');
    let result: any;

    if (contentType && contentType.includes('application/json')) {
      result = await response.json();
    } else {
      const text = await response.text();
      try {
        result = JSON.parse(text);
      } catch (e) {
        result = { message: text };
      }
    }

    if (response.status >= 400) {
      console.error(
        `[Proxy] NubeFact respondió con error (operacion: ${data?.operacion}, tipo: ${data?.tipo_de_comprobante}, serie-numero: ${data?.serie}-${data?.numero}):`,
        JSON.stringify(result).slice(0, 2000)
      );
    }

    return NextResponse.json(result, { status: response.status });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[Proxy] Error after ${duration}ms:`, error);

    if (error.name === 'AbortError') {
      return NextResponse.json({ error: 'Tiempo de espera agotado al conectar con NubeFact (Timeout)' }, { status: 504 });
    }
    return NextResponse.json({ error: error.message || 'Error interno del servidor proxy' }, { status: 500 });
  } finally {
    clearTimeout(timeoutId);
  }
}
