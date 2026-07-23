/* Service worker: la app funciona sin conexión y se actualiza sola */
var CACHE = "mi-historia-v1";
var ARCHIVOS = [
  "./", "./index.html", "./css/styles.css", "./icon.svg", "./manifest.json",
  "./js/datos.js", "./js/biblioteca-datos.js", "./js/editor.js", "./js/dictado.js",
  "./js/fichas.js", "./js/mapa.js", "./js/tiempo.js", "./js/entornos.js", "./js/nombres.js",
  "./js/biblioteca.js", "./js/diario.js", "./js/exportar.js", "./js/app.js"
];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ARCHIVOS); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (claves) {
    return Promise.all(claves.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

/* Red primero (para recibir actualizaciones), caché si no hay conexión */
self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request).then(function (resp) {
      var copia = resp.clone();
      caches.open(CACHE).then(function (c) { c.put(e.request, copia); });
      return resp;
    }).catch(function () { return caches.match(e.request); })
  );
});
