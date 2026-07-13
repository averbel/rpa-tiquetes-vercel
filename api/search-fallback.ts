import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getBrowser } from '../lib/browser';
import { isAuthorized } from '../lib/auth';

/**
 * POST /api/search-fallback
 * Se llama solo si la API de vuelos primaria (Amadeus/Skyscanner/TravelPayouts) falla.
 * Body esperado: { origen, destino, fechaSalida, fechaRegreso?, cantidadPasajeros? }
 * Responde: { vuelos: [ { aerolinea, precio, horaSalida, horaLlegada, urlCompra } ] }
 *
 * IMPORTANTE: los selectores [data-testid="..."] son PLACEHOLDERS.
 * Debes inspeccionar el DOM real del sitio de Avianca y reemplazarlos
 * antes de usar esto en producción.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metodo no permitido, usa POST' });
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  const { origen, destino, fechaSalida, fechaRegreso, cantidadPasajeros } = req.body || {};

  if (!origen || !destino || !fechaSalida) {
    return res.status(400).json({ error: 'Faltan parametros: origen, destino, fechaSalida' });
  }

  let browser;
  try {
    browser = await getBrowser();
    const page = await browser.newPage();

    const baseUrl = process.env.AVIANCA_BASE_URL || 'https://www.avianca.com';
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // --- AJUSTAR SELECTORES SEGUN EL SITIO REAL ---
    await page.fill('[data-testid="origin-input"]', origen).catch(() => {});
    await page.fill('[data-testid="destination-input"]', destino).catch(() => {});
    await page.fill('[data-testid="departure-date-input"]', fechaSalida).catch(() => {});
    if (fechaRegreso) {
      await page.fill('[data-testid="return-date-input"]', fechaRegreso).catch(() => {});
    }
    await page.fill('[data-testid="passengers-input"]', String(cantidadPasajeros || 1)).catch(() => {});
    await page.click('[data-testid="search-flights-button"]').catch(() => {});
    await page.waitForSelector('[data-testid="flight-result-card"]', { timeout: 30000 }).catch(() => {});

    const vuelos = await page.$$eval('[data-testid="flight-result-card"]', (cards) =>
      cards.map((card) => ({
        aerolinea: card.querySelector('[data-testid="airline-name"]')?.textContent?.trim() || 'Avianca',
        precio: Number(
          (card.querySelector('[data-testid="flight-price"]')?.textContent || '0').replace(/[^\d]/g, '')
        ),
        horaSalida: card.querySelector('[data-testid="departure-time"]')?.getAttribute('datetime') || '',
        horaLlegada: card.querySelector('[data-testid="arrival-time"]')?.getAttribute('datetime') || '',
        urlCompra: (card.querySelector('a[data-testid="select-flight-link"]') as HTMLAnchorElement | null)?.href || ''
      }))
    );

    return res.status(200).json({ vuelos });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Error desconocido en search-fallback' });
  } finally {
    if (browser) await browser.close();
  }
}
