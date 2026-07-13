import chromium from '@sparticuz/chromium';
import { chromium as playwrightChromium, Browser } from 'playwright-core';

/**
 * Lanza Chromium dentro de una función serverless de Vercel.
 * Playwright "normal" no cabe en el límite de tamaño de la función,
 * por eso se usa el binario liviano de @sparticuz/chromium.
 */
export async function getBrowser(): Promise<Browser> {
  const executablePath = await chromium.executablePath();

  return playwrightChromium.launch({
    args: chromium.args,
    executablePath,
    headless: true
  });
}
