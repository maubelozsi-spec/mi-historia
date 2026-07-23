/* ============ Mapa de relaciones entre personajes ============ */

var Mapa = (function () {
  var svg, relacionEnEdicion = null;
  var arrastrando = null;

  var ANCHO_NODO = 150, ALTO_NODO = 46;

  function init() {
    svg = document.getElementById("lienzo-mapa");
    document.getElementById("btn-nueva-relacion").addEventListener("click", function () { abrirDialogo(null); });
    document.getElementById("form-relacion").addEventListener("submit", alCerrarDialogo);

    svg.addEventListener("pointerdown", empezarArrastre);
    svg.addEventListener("pointermove", moverArrastre);
    svg.addEventListener("pointerup", soltarArrastre);
    svg.addEventListener("pointercancel", soltarArrastre);

    // definición de puntas de flecha por tipo
    var defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    ["familia", "amor", "amistad", "conflicto", "poder", "otro"].forEach(function (tipo) {
      var m = document.createElementNS("http://www.w3.org/2000/svg", "marker");
      m.setAttribute("id", "punta-" + tipo);
      m.setAttribute("viewBox", "0 0 10 10");
      m.setAttribute("refX", "9"); m.setAttribute("refY", "5");
      m.setAttribute("markerWidth", "7"); m.setAttribute("markerHeight", "7");
      m.setAttribute("orient", "auto-start-reverse");
      var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", "M 0 0 L 10 5 L 0 10 z");
      path.setAttribute("class", "rel-" + tipo);
      path.style.fill = "currentColor";
      path.setAttribute("fill", getComputedStyle(document.documentElement).getPropertyValue("--tinta"));
      m.appendChild(path);
      defs.appendChild(m);
    });
    svg.appendChild(defs);
  }

  function posiciones() {
    var p = Datos.proyecto();
    if (!p.posicionesMapa) p.posicionesMapa = {};
    return p.posicionesMapa;
  }

  function posicionDe(f, idx, total) {
    var pos = posiciones();
    if (!pos[f.id]) {
      // distribución inicial en círculo, dentro de la zona visible
      var cx = 360, cy = 280, r = Math.min(240, Math.max(140, total * 26));
      var ang = (2 * Math.PI * idx) / Math.max(total, 1);
      pos[f.id] = { x: Math.round(cx + r * Math.cos(ang)), y: Math.round(cy + r * Math.sin(ang) * 0.7) };
    }
    return pos[f.id];
  }

  function pintar() {
    if (!svg) return;
    var p = Datos.proyecto();
    if (!p) return;
    // limpia todo menos <defs>
    Array.prototype.slice.call(svg.children).forEach(function (c) {
      if (c.tagName !== "defs") svg.removeChild(c);
    });

    var pers = Fichas.personajes();

    // flechas primero (debajo)
    p.relaciones.forEach(function (rel) {
      var a = pers.find(function (f) { return f.id === rel.deId; });
      var b = pers.find(function (f) { return f.id === rel.aId; });
      if (!a || !b) return;
      var pa = posicionDe(a, pers.indexOf(a), pers.length);
      var pb = posicionDe(b, pers.indexOf(b), pers.length);

      var x1 = pa.x + ANCHO_NODO / 2, y1 = pa.y + ALTO_NODO / 2;
      var x2 = pb.x + ANCHO_NODO / 2, y2 = pb.y + ALTO_NODO / 2;
      // recorta la línea para no entrar en las cajas
      var ang = Math.atan2(y2 - y1, x2 - x1);
      var margen = 12;
      var rx1 = x1 + Math.cos(ang) * (ANCHO_NODO / 2 - 10 + margen);
      var ry1 = y1 + Math.sin(ang) * (ALTO_NODO / 2 + margen);
      var rx2 = x2 - Math.cos(ang) * (ANCHO_NODO / 2 - 10 + margen);
      var ry2 = y2 - Math.sin(ang) * (ALTO_NODO / 2 + margen);

      var linea = document.createElementNS("http://www.w3.org/2000/svg", "line");
      linea.setAttribute("x1", rx1); linea.setAttribute("y1", ry1);
      linea.setAttribute("x2", rx2); linea.setAttribute("y2", ry2);
      linea.setAttribute("class", "flecha-linea rel-" + rel.tipo);
      linea.setAttribute("marker-end", "url(#punta-" + rel.tipo + ")");
      if (rel.doble) linea.setAttribute("marker-start", "url(#punta-" + rel.tipo + ")");
      linea.addEventListener("click", function () { abrirDialogo(rel); });
      svg.appendChild(linea);

      var et = document.createElementNS("http://www.w3.org/2000/svg", "text");
      et.setAttribute("x", (rx1 + rx2) / 2);
      et.setAttribute("y", (ry1 + ry2) / 2 - 6);
      et.setAttribute("text-anchor", "middle");
      et.setAttribute("class", "flecha-etiqueta");
      et.textContent = rel.texto || rel.tipo;
      et.addEventListener("click", function () { abrirDialogo(rel); });
      svg.appendChild(et);
    });

    // nodos
    pers.forEach(function (f, i) {
      var pos = posicionDe(f, i, pers.length);
      var g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      g.setAttribute("class", "nodo-mapa");
      g.setAttribute("transform", "translate(" + pos.x + "," + pos.y + ")");
      g.dataset.fichaId = f.id;

      var rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      rect.setAttribute("width", ANCHO_NODO); rect.setAttribute("height", ALTO_NODO);
      rect.setAttribute("rx", 10);
      g.appendChild(rect);

      var tx = document.createElementNS("http://www.w3.org/2000/svg", "text");
      tx.setAttribute("x", ANCHO_NODO / 2); tx.setAttribute("y", ALTO_NODO / 2 + 5);
      tx.setAttribute("text-anchor", "middle");
      var nombre = f.nombre.length > 16 ? f.nombre.slice(0, 15) + "…" : f.nombre;
      tx.textContent = nombre;
      g.appendChild(tx);

      g.addEventListener("dblclick", function () { Fichas.abrir(f); });
      svg.appendChild(g);
    });

    if (!pers.length) {
      var aviso = document.createElementNS("http://www.w3.org/2000/svg", "text");
      aviso.setAttribute("x", 400); aviso.setAttribute("y", 200);
      aviso.setAttribute("fill", "#8a8570"); aviso.setAttribute("font-size", "18");
      aviso.textContent = "Crea personajes con (p) en el editor y aparecerán aquí.";
      svg.appendChild(aviso);
    }
  }

  /* ---------- Arrastre de nodos ---------- */
  function coordsSvg(e) {
    var pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  }

  function empezarArrastre(e) {
    var g = e.target.closest(".nodo-mapa");
    if (!g) return;
    var c = coordsSvg(e);
    var pos = posiciones()[g.dataset.fichaId];
    arrastrando = { g: g, id: g.dataset.fichaId, dx: c.x - pos.x, dy: c.y - pos.y, movido: false };
    svg.setPointerCapture(e.pointerId);
    e.preventDefault();
  }

  function moverArrastre(e) {
    if (!arrastrando) return;
    var c = coordsSvg(e);
    var pos = posiciones()[arrastrando.id];
    pos.x = Math.round(c.x - arrastrando.dx);
    pos.y = Math.round(c.y - arrastrando.dy);
    arrastrando.movido = true;
    pintar();
    // el nodo re-creado: re-referencia (no hace falta seguir el mismo elemento)
  }

  function soltarArrastre() {
    if (arrastrando && arrastrando.movido) Datos.guardar();
    arrastrando = null;
  }

  /* ---------- Diálogo de relación ---------- */
  function abrirDialogo(rel) {
    var pers = Fichas.personajes();
    if (pers.length < 2 && !rel) { UI.aviso("Necesitas al menos dos personajes con ficha."); return; }
    relacionEnEdicion = rel;
    var selDe = document.getElementById("rel-de");
    var selA = document.getElementById("rel-a");
    [selDe, selA].forEach(function (s) {
      s.innerHTML = "";
      pers.forEach(function (f) {
        var o = document.createElement("option");
        o.value = f.id; o.textContent = f.nombre;
        s.appendChild(o);
      });
    });
    if (rel) {
      selDe.value = rel.deId; selA.value = rel.aId;
      document.getElementById("rel-tipo").value = rel.tipo;
      document.getElementById("rel-texto").value = rel.texto || "";
      document.getElementById("rel-doble").checked = !!rel.doble;
    } else {
      document.getElementById("rel-texto").value = "";
      document.getElementById("rel-doble").checked = false;
      if (pers[1]) selA.value = pers[1].id;
    }
    document.getElementById("btn-borrar-relacion").style.display = rel ? "" : "none";
    document.getElementById("dialogo-relacion").showModal();
  }

  function alCerrarDialogo(e) {
    var valor = e.submitter && e.submitter.value;
    var p = Datos.proyecto();
    if (valor === "guardar") {
      var datos = {
        deId: document.getElementById("rel-de").value,
        aId: document.getElementById("rel-a").value,
        tipo: document.getElementById("rel-tipo").value,
        texto: document.getElementById("rel-texto").value.trim(),
        doble: document.getElementById("rel-doble").checked
      };
      if (datos.deId === datos.aId) { UI.aviso("Elige dos personajes distintos."); return; }
      if (relacionEnEdicion) Object.assign(relacionEnEdicion, datos);
      else { datos.id = Datos.uid(); p.relaciones.push(datos); }
      Datos.guardar();
    } else if (valor === "borrar" && relacionEnEdicion) {
      p.relaciones = p.relaciones.filter(function (r) { return r !== relacionEnEdicion; });
      Datos.guardar();
    }
    relacionEnEdicion = null;
    pintar();
  }

  return { init: init, pintar: pintar };
})();
