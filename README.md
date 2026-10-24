# Cortes Airbnb · GitHub Pages (publicación sin datos privados)

Esta versión **no incluye saldos, ingresos, titulares reales ni el historial original**. 
Los datos financieros deben recuperarse **después de publicar** desde Configuración → Importar respaldo JSON.

## Publicar

1. Crea un repositorio público nuevo en GitHub, por ejemplo `cortes-airbnb`.
2. Extrae este paquete ZIP en tu computadora.
3. Sube **el contenido de esta carpeta** a la raíz de la rama `main`, incluyendo `index.html`, `app.js`, `styles.css`, `sw.js`, `manifest.webmanifest`, iconos y `.nojekyll`.
4. En GitHub entra en **Settings → Pages → Build and deployment → Deploy from a branch**, selecciona `main` y `/ (root)`, y guarda.
5. Entra en `https://TUUSUARIO.github.io/cortes-airbnb/`.
6. Haz clic en **Importar respaldo JSON** y selecciona un respaldo privado guardado en tu dispositivo.

**Nunca subas el archivo de respaldo privado, el PDF original ni los ZIP/HTML anteriores al repositorio.** GitHub Pages es público y los archivos publicados son accesibles a cualquiera.

## Datos y actualizaciones

Los saldos se guardan en `localStorage` del navegador para este sitio, no en GitHub. Desde otro dispositivo tendrás que importar un respaldo. Exporta copias periódicas desde Configuración. Para actualizar, reemplaza los archivos de la app en GitHub; no toques los respaldos del navegador. Cambiar el dominio de la app crea otro almacenamiento local.

Si importaste datos en una versión anterior y los modificaste, **exporta primero su respaldo actual**; el respaldo privado suministrado con la migración solo contiene los datos iniciales del PDF (enero-septiembre de 2026).
