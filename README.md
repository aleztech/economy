# Economy

Cuentas personales: ingresos, gastos recurrentes, previsión de caja, proyección a largo plazo, plan de compra de vivienda y recomendaciones que se recalculan con cada cambio.

## Privacidad

Los datos viven en `public/data.enc`, cifrados con AES-256-GCM y una clave derivada de la contraseña (PBKDF2-SHA256, 310.000 iteraciones). El repositorio es público, pero sin la contraseña el fichero es ruido. La contraseña no está en el código.

Los cambios hechos en la web se guardan cifrados en el navegador. Para llevarlos a otro dispositivo: Ajustes → Descargar copia → Importar en el otro.

## Actualizar los datos iniciales

`seed.json` está en `.gitignore`. Para regenerar el fichero cifrado:

```bash
ECONOMY_PASS='…' npm run seal
```

## Desarrollo

```bash
npm install
npm run dev
```

Se publica en GitHub Pages con cada push a `main`.

Stack: Vite, React, TypeScript, Tailwind CSS 4, Recharts, Lucide.
