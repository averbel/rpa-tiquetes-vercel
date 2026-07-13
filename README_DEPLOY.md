# Desplegar este servicio en Vercel (desde cero)

Este proyecto NO tiene frontend — son solo dos funciones serverless
(`/api/search-fallback` y `/api/checkout`) que tu workflow de n8n Cloud va
a llamar por HTTP, porque n8n Cloud no puede ejecutar Playwright directamente.

## Requisitos previos

- Node.js instalado en tu máquina.
- Una cuenta gratuita en https://vercel.com (puedes crearla con tu cuenta de GitHub).

## 1. Instalar dependencias

Dentro de la carpeta del proyecto:

```bash
npm install playwright-core @sparticuz/chromium
npm install --save-dev @vercel/node typescript @types/node
```

(No fijé versiones en `package.json` a propósito para que `npm install`
resuelva las versiones más recientes y compatibles en el momento en que lo
instales.)

## 2. Instalar el CLI de Vercel y autenticarte

```bash
npm install -g vercel
vercel login
```

Sigue el flujo que te pida (login por email o GitHub).

## 3. Generar tu token secreto

```bash
openssl rand -hex 32
```

Guarda ese valor — lo vas a usar tanto en Vercel como en n8n.

## 4. Enlazar y desplegar el proyecto

Desde la carpeta del proyecto:

```bash
vercel
```

Te va a preguntar:
- **Set up and deploy?** → Yes
- **Which scope?** → tu cuenta personal
- **Link to existing project?** → No
- **Project name?** → por ejemplo `rpa-tiquetes`
- **Directory?** → `.` (la carpeta actual)
- **Override settings?** → No (no es un framework como Next.js, Vercel detecta las funciones en `/api` automáticamente)

Esto crea un despliegue de **preview**. Cuando confirmes que funciona, despliega a producción:

```bash
vercel --prod
```

Al final te da una URL, por ejemplo:
```
https://rpa-tiquetes.vercel.app
```
Esa es tu `RPA_SERVICE_URL`.

## 5. Configurar las variables de entorno en Vercel

```bash
vercel env add RPA_SERVICE_TOKEN production
# pega el token que generaste en el paso 3

vercel env add AVIANCA_BASE_URL production
# https://www.avianca.com
```

Después de agregar variables de entorno nuevas, vuelve a desplegar para que tomen efecto:

```bash
vercel --prod
```

## 6. Probar los endpoints manualmente antes de conectarlos a n8n

```bash
curl -X POST https://rpa-tiquetes.vercel.app/api/search-fallback \
  -H "Authorization: Bearer TU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"origen":"BOG","destino":"MDE","fechaSalida":"2026-08-20","cantidadPasajeros":1}'
```

Si responde `{"vuelos": []}` en vez de un error, la función corrió bien —
lo que falta ajustar son los selectores del DOM real (ver punto 7).

## 7. Ajustar los selectores reales de Avianca

En `api/search-fallback.ts` y `api/checkout.ts`, todos los `[data-testid="..."]`
son marcadores de ejemplo. Abre el sitio real, inspecciona el DOM (F12) y
reemplázalos por los selectores verdaderos. Esto es indispensable — sin
selectores correctos, los `.catch(() => {})` van a hacer que cada paso
falle en silencio y termines con un screenshot de la página equivocada.

## 8. Conectar con n8n

En n8n Cloud, configura las variables de entorno del workflow:
- `RPA_SERVICE_URL` = `https://rpa-tiquetes.vercel.app`
- `RPA_SERVICE_TOKEN` = el mismo token del paso 3

## 9. Sobre el límite de tiempo de ejecución

El plan Hobby de Vercel tiene un límite de duración por función. Con Fluid
Compute (activo por defecto) puede extenderse configurando `maxDuration` en
`vercel.json` — ya lo dejé en 60 segundos. Si un checkout completo con
Playwright tarda más que eso, verifica el límite exacto vigente para tu
cuenta en el dashboard de Vercel (Project → Settings → Functions), y si no
alcanza, usa el patrón asíncrono (endpoint que dispara el job + endpoint de
consulta de estado) en vez de una sola llamada síncrona.
