/* ============ Exportación EPUB y formato manuscrito ============ */

var Epub = (function () {

  /* ---------- ZIP mínimo (método "almacenado", suficiente para EPUB) ---------- */
  var TABLA_CRC = (function () {
    var t = [], c;
    for (var n = 0; n < 256; n++) {
      c = n;
      for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(datos) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < datos.length; i++) c = TABLA_CRC[(c ^ datos[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function u16(n) { return [n & 255, (n >> 8) & 255]; }
  function u32(n) { return [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255]; }

  function zip(archivos) { // [{nombre, texto}]
    var enc = new TextEncoder();
    var partes = [], central = [], offset = 0;
    archivos.forEach(function (a) {
      var nombre = enc.encode(a.nombre);
      var datos = enc.encode(a.texto);
      var crc = crc32(datos);
      var local = [].concat(u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0),
        u32(crc), u32(datos.length), u32(datos.length), u16(nombre.length), u16(0));
      partes.push(new Uint8Array(local), nombre, datos);
      central.push({ nombre: nombre, crc: crc, tam: datos.length, offset: offset });
      offset += local.length + nombre.length + datos.length;
    });
    var inicioCentral = offset, tamCentral = 0;
    central.forEach(function (c) {
      var reg = [].concat(u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
        u32(c.crc), u32(c.tam), u32(c.tam), u16(c.nombre.length), u16(0), u16(0), u16(0), u16(0),
        u32(0), u32(c.offset));
      partes.push(new Uint8Array(reg), c.nombre);
      tamCentral += reg.length + c.nombre.length;
    });
    partes.push(new Uint8Array([].concat(u32(0x06054b50), u16(0), u16(0),
      u16(central.length), u16(central.length), u32(tamCentral), u32(inicioCentral), u16(0))));
    return new Blob(partes, { type: "application/epub+zip" });
  }

  /* ---------- Utilidades de contenido ---------- */
  function esc(t) {
    return String(t || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function parrafos(html) {
    var div = document.createElement("div");
    div.innerHTML = html || "";
    div.querySelectorAll(".entidad").forEach(function (s) { s.replaceWith(s.textContent); });
    var texto = div.innerText;
    return texto.split(/\n+/).filter(function (p) { return p.trim(); })
      .map(function (p) { return "<p>" + esc(p.trim()) + "</p>"; }).join("\n");
  }

  function nombreArchivo(p, ext) {
    return p.nombre.toLowerCase().replace(/[^\wáéíóúüñ]+/gi, "-") + "-" + Datos.hoy() + "." + ext;
  }

  function descargar(nombre, blob) {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  /* ---------- EPUB ---------- */
  function exportarEpub() {
    var p = Datos.proyecto();
    if (!p) { UI.aviso("Abre primero una novela."); return; }
    var uidLibro = "urn:uuid:mi-historia-" + p.id;
    var archivos = [{ nombre: "mimetype", texto: "application/epub+zip" }];

    archivos.push({
      nombre: "META-INF/container.xml",
      texto: '<?xml version="1.0" encoding="UTF-8"?>\n<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">' +
        '<rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>'
    });

    archivos.push({
      nombre: "OEBPS/estilo.css",
      texto: "body{font-family:serif;line-height:1.6;margin:5%}h1,h2{text-align:center}p{text-indent:1.2em;margin:0 0 .2em}"
    });

    var manifest = '<item id="css" href="estilo.css" media-type="text/css"/>\n<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>\n';
    var spine = "", navLis = "";

    p.capitulos.forEach(function (cap, i) {
      var id = "cap" + (i + 1);
      archivos.push({
        nombre: "OEBPS/" + id + ".xhtml",
        texto: '<?xml version="1.0" encoding="UTF-8"?>\n<html xmlns="http://www.w3.org/1999/xhtml"><head><title>' + esc(cap.titulo) +
          '</title><link rel="stylesheet" href="estilo.css"/></head><body><h2>' + esc(cap.titulo) + "</h2>\n" +
          parrafos(cap.html) + "</body></html>"
      });
      manifest += '<item id="' + id + '" href="' + id + '.xhtml" media-type="application/xhtml+xml"/>\n';
      spine += '<itemref idref="' + id + '"/>\n';
      navLis += '<li><a href="' + id + '.xhtml">' + esc(cap.titulo) + "</a></li>\n";
    });

    archivos.push({
      nombre: "OEBPS/nav.xhtml",
      texto: '<?xml version="1.0" encoding="UTF-8"?>\n<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">' +
        "<head><title>Índice</title></head><body><nav epub:type=\"toc\"><h1>Índice</h1><ol>" + navLis + "</ol></nav></body></html>"
    });

    archivos.push({
      nombre: "OEBPS/content.opf",
      texto: '<?xml version="1.0" encoding="UTF-8"?>\n<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">' +
        '<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">' +
        "<dc:identifier id=\"uid\">" + uidLibro + "</dc:identifier>" +
        "<dc:title>" + esc(p.nombre) + "</dc:title><dc:language>es</dc:language>" +
        '<meta property="dcterms:modified">' + new Date().toISOString().replace(/\.\d+Z/, "Z") + "</meta>" +
        "</metadata><manifest>" + manifest + "</manifest><spine>" + spine + "</spine></package>"
    });

    descargar(nombreArchivo(p, "epub"), zip(archivos));
    UI.aviso("📱 EPUB descargado: ábrelo con Google Play Libros, Kindle o cualquier lector.");
  }

  /* ---------- Formato manuscrito (para certámenes y editoriales) ---------- */
  function exportarManuscrito() {
    var p = Datos.proyecto();
    if (!p) { UI.aviso("Abre primero una novela."); return; }
    var cuerpo = "<p style='text-align:center'><b>" + esc(p.nombre).toUpperCase() + "</b></p>";
    if (p.info && p.info.premisa) cuerpo += "<p style='text-align:center'><i>" + esc(p.info.premisa) + "</i></p>";
    p.capitulos.forEach(function (cap) {
      cuerpo += "<h2 style='page-break-before:always;text-align:center;font-size:12pt'>" + esc(cap.titulo).toUpperCase() + "</h2>" + parrafos(cap.html);
    });
    var doc = "<html xmlns:w='urn:schemas-microsoft-com:office:word'><head><meta charset='utf-8'><title>" + esc(p.nombre) + "</title>" +
      "<style>body{font-family:'Times New Roman',serif;font-size:12pt;line-height:2}p{text-indent:1.25cm;margin:0}h2{font-family:'Times New Roman',serif}</style>" +
      "</head><body>" + cuerpo + "</body></html>";
    descargar(nombreArchivo(p, "doc").replace(".doc", "-manuscrito.doc"), new Blob(["﻿" + doc], { type: "application/msword" }));
    UI.aviso("🖋️ Manuscrito descargado: Times 12, doble espacio y sangrías, el formato que piden concursos y editoriales.");
  }

  return { exportarEpub: exportarEpub, exportarManuscrito: exportarManuscrito };
})();
