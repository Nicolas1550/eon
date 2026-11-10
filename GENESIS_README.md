# GENESIS — THE LIVING WORLD / V1 AWAKENING

**Creado sobre el ZIP `eon(6).zip` recibido.** Es una primera evolución jugable del entorno urbano EON V7, no un planeta totalmente remodelado todavía.

## Qué se agregó realmente

- Reactor 3D en un parque existente: cristal animado, aros energéticos, luces y onda de activación.
- Activación **AWAKEN WORLD** que hace crecer vegetación luminosa procedimental en varios parques mediante dos lotes `InstancedMesh`. La transformación tarda unos segundos y puede revertirse.
- Estado de despertar por `seed + grid + versión` guardado en `localStorage` del navegador. **No se guarda en Neon**, ni se cambió el esquema SQL.
- **Enfocar núcleo** con el botón de brújula junto a AWAKEN WORLD.
- Perfiles **ECO / HIGH / ULTRA** y medidor aproximado de FPS, útil para comparar carga gráfica en tu RTX 3090. ULTRA permite DPR 2×, sombras 4096 y mayor detalle cercano de árboles.
- Identidad GENESIS, manteniendo las rutas Full Stack, login y CITY VAULT de EON.

## Ejecutar en Windows / VS Code

Extraé el ZIP en una carpeta nueva. Abrí PowerShell en esa carpeta:

```powershell
npm.cmd install
npm.cmd run dev
```

Abrí `http://localhost:3000` y pulsá **AWAKEN WORLD**. Si querés guardar ciudades en Neon, copiá tu propio `.env.local` de EON a la carpeta raíz. **Nunca publiques el archivo de secretos ni lo subas a GitHub.** El entorno 3D y su efecto de despertar funcionan sin base de datos.

Para validar:

```powershell
npm.cmd run test
npm.cmd run typecheck
npm.cmd run build
```

En desktop, alterná **ECO / HIGH / ULTRA** y verificá el contador FPS. ULTRA no garantiza más FPS ni activa CUDA: sube la calidad gráfica y el costo de renderizado. En móviles se inicia en ECO.

## Usar de verdad la RTX 3090: Blender + OptiX

El WebGL de GENESIS se renderiza en la tarjeta gráfica del visitante, **no envía cálculos a tu PC por internet**. Para crear renders y recursos de alta calidad con CUDA/OptiX, instalá Blender 4.x o 5.x, actualizá el driver NVIDIA y ejecutá en el directorio del proyecto:

```powershell
& "C:\Program Files\Blender Foundation\Blender 4.5\blender.exe" -b -P tools/blender_genesis_optix.py
```

Ajustá la ruta a la versión de Blender realmente instalada. El script detecta OptiX, intenta CUDA si no está disponible y finalmente CPU; informa cuál terminó utilizando. Genera `public/genesis-render.png` a 1920×1080 con Cycles y denoising. Ese PNG es una **referencia renderizada offline**; no sustituye automáticamente los modelos de la escena web. La herramienta no se ejecutó sobre la RTX 3090 del usuario en este entorno.

## Limitaciones conocidas

- Base EON: todavía es una **ciudad** con zonas naturales, no el valle alienígena propuesto para una versión posterior.
- Las mejoras actuales en el navegador son cambios reales de escena, pero siguen siendo una estética estilizada; los edificios, autos y peatones siguen siendo los assets originales de EON V7.
- Contador FPS: mide frames renderizados sobre tiempo, no utilización/temperatura/VRAM de la GPU. Para esas métricas usá `nvidia-smi` o MSI Afterburner en tu PC.
- La activación se conserva en el navegador local. La sincronización de evolución con Neon necesitará una migración de esquema y APIs que **no** se implementó aquí.
- La compatibilidad exacta WebGL y el rendimiento de la RTX 3090 requieren pruebas locales en tu Windows.

## Archivos principales

- `src/components/GenesisCore.tsx`: núcleo y vegetación que despierta.
- `src/components/WorldPerformance.tsx`: medidor de FPS.
- `src/components/CityScene.tsx`: integración 3D y perfíl ULTRA.
- `src/components/EonApp.tsx`: acciones, interfaz, persistencia local.
- `tools/blender_genesis_optix.py`: prueba de renderizado offline en OptiX/CUDA.

El siguiente salto visual recomendado será remodelar una región fuera de la ciudad con mejores materiales PBR, instancing de follaje, rocas y terreno con referencias propias, y mediciones reales de rendimiento. Evitaremos convertir todo de golpe en un mundo enorme y lento.
