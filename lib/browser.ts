import chromium from '@sparticuz/chromium-min';
import { chromium as playwrightChromium, Browser } from 'playwright-core';

/**
 * Lanza Chromium dentro de una función serverless de Vercel.
 *
 * Usamos la variante "-min" de @sparticuz/chromium: en vez de empaquetar
 * el binario de Chromium dentro de la función (lo cual falla en Vercel
 * porque el "bin" no siempre queda incluido al traceear archivos), esta
 * variante lo descarga desde una URL pública la primera vez que corre
 * (queda cacheado en /tmp en invocaciones posteriores mientras la
 * instancia siga "caliente").
 *
 * Debes configurar la variable de entorno CHROMIUM_PACK_URL con la URL
 * del asset "chromium-vX.X.X-pack.x64.tar" de la ULTIMA release de:
 * https://github.com/Sparticuz/chromium/releases
 *
 * Importante: la versión de @sparticuz/chromium-min que instalas debe
 * coincidir con la versión del pack.tar que apuntas (ej. si instalas
 * @sparticuz/chromium-min@141.0.0, usa el pack de la release v141.0.0).
 */
export async function getBrowser(): Promise<Browser> {
  const packUrl = process.env.CHROMIUM_PACK_URL;
  if (!packUrl) {
    throw new Error(
      'Falta la variable de entorno CHROMIUM_PACK_URL. Configúrala con la URL del ' +
      'chromium-vX.X.X-pack.x64.tar de https://github.com/Sparticuz/chromium/releases'
    );
  }

  const executablePath = await chromium.executablePath(packUrl);

  return playwrightChromium.launch({
    args: chromium.args,
    executablePath,
    headless: true
  });
}
