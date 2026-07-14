import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getBrowser } from '../lib/browser.js';
import { isAuthorized } from '../lib/auth.js';

/**
 * POST /api/checkout
 * Navega hasta el vuelo seleccionado, diligencia los datos del viajero y
 * se DETIENE en la pantalla de medios de pago. NO ejecuta el pago.
 *
 * Body esperado:
 * { vueloSeleccionado: { aerolinea, precio, horaSalida, horaLlegada, urlCompra },
 *   datosViajero: { nombre, documento, correo, telefono, cantidadPasajeros, equipajeBodega } }
 *
 * Responde: { ok: true, urlPago, screenshotBase64 } o { ok: false, error }
 *
 * IMPORTANTE: los selectores [data-testid="..."] son PLACEHOLDERS.
 * Debes inspeccionar el DOM real del sitio de Avianca y reemplazarlos
 * antes de usar esto en producción.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Metodo no permitido, usa POST' });
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({ ok: false, error: 'No autorizado' });
  }

  const { vueloSeleccionado, datosViajero } = req.body || {};

  if (!vueloSeleccionado || !vueloSeleccionado.urlCompra || !datosViajero) {
    return res.status(400).json({ ok: false, error: 'Faltan vueloSeleccionado.urlCompra y/o datosViajero' });
  }

  let browser;
  try {
    browser = await getBrowser();
    const page = await browser.newPage();

    // 1. Ir directo a la URL del vuelo seleccionado
    await page.goto(vueloSeleccionado.urlCompra, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // --- AJUSTAR SELECTORES SEGUN EL SITIO REAL ---
    // 2. Continuar al checkout
    await page.click('[data-testid="continue-checkout-button"]').catch(() => {});
    await page.waitForLoadState('networkidle').catch(() => {});

    // 3. Diligenciar datos del pasajero
    await page.fill('[data-testid="passenger-name-input"]', datosViajero.nombre).catch(() => {});
    await page.fill('[data-testid="passenger-document-input"]', datosViajero.documento).catch(() => {});
    await page.fill('[data-testid="passenger-email-input"]', datosViajero.correo).catch(() => {});
    if (datosViajero.telefono) {
      await page.fill('[data-testid="passenger-phone-input"]', datosViajero.telefono).catch(() => {});
    }
    if (datosViajero.equipajeBodega) {
      await page.check('[data-testid="checked-baggage-checkbox"]').catch(() => {});
    }

    // 4. Avanzar hasta la pantalla de pago (SIN seleccionar medio de pago ni pagar)
    await page.click('[data-testid="continue-to-payment-button"]').catch(() => {});
    await page.waitForSelector('[data-testid="payment-methods-section"]', { timeout: 15000 }).catch(() => {});

    // 5. Captura de evidencia (en memoria, sin escribir a disco -> el filesystem
    //    de una función serverless es efímero y de solo lectura salvo /tmp)
    const screenshotBuffer = await page.screenshot({ fullPage: true });

    return res.status(200).json({
      ok: true,
      urlPago: page.url(),
      screenshotBase64: screenshotBuffer.toString('base64')
    });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err.message || 'Error desconocido en checkout' });
  } finally {
    if (browser) await browser.close();
  }
}
