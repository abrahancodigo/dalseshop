# Optimización de la tienda

El inicio utiliza la página publicada en el CMS: conserva sus secciones, promociones, imágenes, colores y carrusel. La caché local de inicio y configuración está separada por proyecto Firebase para evitar mezclar datos reales con la demostración.

## Imágenes y fuentes

`StoreImage` selecciona variantes WebP por ancho de pantalla y densidad de píxeles. Mantiene la proporción original, reserva dimensiones y utiliza carga diferida, salvo en la primera promoción y la imagen principal del detalle. La ampliación conserva el archivo original.

Los archivos con nombre basado en su contenido se guardan en `public/optimized-images` y `public/fonts`. Firebase Hosting y el worker de Cloudflare incluyen caché duradera para esos recursos.

Las imágenes nuevas generan variantes WebP automáticamente desde el administrador. Se conservan las proporciones y la transparencia; las imágenes animadas conservan su original. Los enlaces incluyen la información de las variantes, por lo que no requieren recompilar la tienda. La limpieza de Storage conserva las variantes cuyo original sigue en uso.

Para regenerar variantes locales de imágenes anteriores:

```sh
npm run optimize:images
npm run build
```

El generador solamente lee documentos públicos y descarga archivos; no escribe en Firebase. Reutiliza los archivos existentes. Usa `npm run optimize:images -- --refresh` si se reemplazó una imagen manteniendo exactamente la misma URL. Las imágenes sin variantes utilizan automáticamente el original.

Inter se sirve localmente, con su licencia en `public/fonts/Inter-LICENSE.txt`. El generador actualiza también la precarga de la fuente en `index.html`.

## Consultas y movimiento

Las secciones de productos empiezan a consultar a 700 píxeles del viewport. Las consultas iguales comparten solicitudes pendientes y resultados durante 15 segundos. Las búsquedas por códigos y los filtros sin índice comparten el catálogo durante 60 segundos. Las mutaciones de productos invalidan ambas cachés.

El carrusel mantiene el efecto 3D, añade deslizamiento horizontal y utiliza transformaciones y opacidad. Pausa al salir de pantalla, ocultar la pestaña, abrir la ampliación o activar movimiento reducido. El desplazamiento vertical y el gesto de ampliar la página siguen disponibles.

El menú y la búsqueda admiten Escape, control del foco y bloqueo de desplazamiento. En celular se muestran banners completos, tarjetas en dos columnas y controles principales de al menos 44 píxeles.

## Desarrollo

`npm run dev:local` usa `.env.localdev`. Con `VITE_USE_EMULATORS=true` y `VITE_LOCAL_STOREFRONT_PREVIEW=true`, la tienda lee su diseño público real y mantiene las escrituras en los emuladores.

Las mejoras están implementadas en el código local. La compilación no implica publicación ni una medición de Lighthouse o de fluidez en un dispositivo real.

## Primera visita y navegación

La compilación prepara una copia pública del inicio, marcas, categorías y configuración visual. No incluye precios, existencias ni clientes. React muestra esta copia antes de descargar Firebase y revalida los datos en segundo plano. Una caché vacía sin conexión no reemplaza el contenido disponible.

La búsqueda, el carrito, el visor y las rutas secundarias se descargan cuando se necesitan. El catálogo conserva filtros y cantidad visible en la URL, resultados en la sesión durante cinco minutos y posición al volver desde un producto. Los resultados se actualizan en segundo plano.

## Validación

`npm run test:storefront` comprueba caché, filtros, metadatos de imágenes, gestos, conservación de variantes y bloqueo de despliegue de esta rama. `npm run test:browser` comprueba el inicio sin conexión, tamaños móviles, menú, carrusel, regreso al catálogo y generación real de WebP con transparencia.

`docs/performance-report.json` contiene tres mediciones por compilación con Chromium, emulación Pixel 7, CPU ralentizada cuatro veces, descarga de 1.6 Mbps y latencia de 150 ms. Son mediciones locales de laboratorio; no representan un teléfono físico. El JavaScript que bloquea el arranque bajó aproximadamente de 273 KB a 146 KB comprimidos.

La rama `improve/storefront-performance` se entrega para revisión. Su compilación automática en Cloudflare está bloqueada explícitamente para cumplir la indicación de no desplegar.
