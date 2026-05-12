# Asegurar Limitada — Plataforma PESV

Plataforma web de gestión de flota y cumplimiento del Plan Estratégico de Seguridad Vial (PESV)
para empresas de transporte en Colombia.

© Asegurar Limitada. Todos los derechos reservados.

## Stack

- React 18 + TypeScript + Vite
- TanStack React Query (estado de servidor)
- shadcn/ui + Tailwind CSS
- React Router v6
- MapLibre GL (mapa de flota)
- recharts (estadísticas)
- jsPDF / exceljs (exportaciones)
- Backend propio (API RNDC) + integración Cellvi

## Configuración

Copia `.env.example` a `.env` y completa los valores:

```bash
cp .env.example .env
npm install
npm run dev
```

Variables principales:
- `VITE_APIRNDC_BASE_URL` — URL del backend (en producción `https://rndc.asegurar.com.co`)
- `VITE_APIRNDC_ENABLED` — habilita la integración (`true` / `false`)
- En desarrollo el proxy de Vite enruta `/rndcapi` a `http://localhost:3000` y `/cellviapi` a `https://cellviapi.asegurar.com.co`

Consulta `.env.example` para todas las opciones disponibles.

## Scripts

```bash
npm run dev          # servidor de desarrollo
npm run build        # build de producción
npm run preview      # previsualizar el build
npm run lint         # eslint
npm test             # tests con vitest
```

## Funcionalidades

- Inspecciones preoperacionales de vehículos (con sección conductor, kits y firma digital)
- Seguimiento de novedades con flujo de corrección y validación
- Gestión documental: SOAT, tecnomecánica, licencias, pólizas, hoja de vida del vehículo
- Generación y validación de FUEC
- Integración con el registro RNDC
- Rastreo GPS de flota (MapLibre GL)
- Dashboard y estadísticas
- Acceso por roles: Administrador, Cliente-Admin (supervisor) y Conductor
- Vistas públicas verificables por QR (preoperacional y contrato)

## Despliegue

Servidor físico Rocky Linux + Apache (reverse proxy con SSL vía Let's Encrypt).
La SPA se sirve estática; las llamadas al API se hacen directo al backend.

## Licencia

Software propietario de Asegurar Limitada. Uso restringido.
