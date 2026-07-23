# Mi Historia

App personal para escribir novelas. Web estática (PWA) sin dependencias: HTML + CSS + JavaScript.

## Qué hace

- **Editor por capítulos** con autoguardado, contador de palabras, objetivo diario con racha y modo enfoque.
- **Dictado por voz** (Web Speech, es-ES): puntuación por comandos hablados, sustitución de texto seleccionado y «borrar eso».
- **Comandos de entidades** escritos o dictados: `Nombre (p)` personaje, `(l)` lugar, `(o)` objeto, `(t)` nota de trama. Crean fichas y enlazan el nombre en el texto. Barra recordatoria siempre visible.
- **Mapa de relaciones** entre personajes: tarjetas arrastrables, flechas con etiqueta, colores por tipo.
- **Línea temporal** de los hechos de la novela (orden, momento, tipo, capítulo).
- **Constructor guiado de entornos** (cinco sentidos, emoción, secreto del lugar).
- **Generador de nombres** (personajes por estilos, lugares, objetos).
- **Biblioteca de técnica narrativa**: Rothfuss, Sisí, Tolkien, Sanderson (+ su curso BYU), Pérez-Reverte, Austen, Anne Rice.
- **Mi diario**: apartado privado con código alfanumérico, mismo editor sin comandos, con su propia línea temporal.
- **Copias**: exportar Word (.doc) y copia completa (.json) reimportable; instantáneas diarias (15 días); papelera de 30 días.
- **Varios proyectos** (novelas) a la vez.

## Pendiente (siguiente fase)

- Proyecto de Firebase propio: acceso con cuenta y sincronización PC ↔ móvil (`js/sync-firebase.js`).
- Publicación en GitHub Pages e instalación como PWA.
- Botones de IA (creador de mundos, consejero de autores): preparados, se activan con clave API.
- Lector invitado solo-lectura.

## Probar en local

Servir la carpeta con cualquier servidor estático y abrir `index.html`. El dictado requiere Chrome y permiso de micrófono (https o localhost).
