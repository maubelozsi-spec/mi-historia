/* ============ Editor de capítulos ============ */

var Editor = (function () {
  var elEditor, elTitulo, elLista, elContador, elObjetivo;
  var capituloId = null;
  var palabrasInicioDia = null;

  function init() {
    elEditor = document.getElementById("editor");
    elTitulo = document.getElementById("titulo-capitulo");
    elLista = document.getElementById("lista-capitulos");
    elContador = document.getElementById("contador-palabras");
    elObjetivo = document.getElementById("objetivo-estado");

    elEditor.addEventListener("input", function () {
      alEscribir();
      detectarComandos(elEditor); // los teclados móviles no emiten keyup fiable
    });
    elEditor.addEventListener("click", function (e) {
      var ent = e.target.closest(".entidad");
      if (ent) Fichas.abrirPorId(ent.dataset.fichaId);
    });
    elTitulo.addEventListener("input", function () {
      var cap = capActivo();
      if (!cap) return;
      cap.titulo = elTitulo.value;
      Datos.guardar();
      pintarLista();
    });

    document.getElementById("btn-nuevo-capitulo").addEventListener("click", nuevoCapitulo);
    document.getElementById("btn-enfoque").addEventListener("click", function () {
      document.body.classList.toggle("enfoque");
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") document.body.classList.remove("enfoque");
    });
    document.getElementById("btn-toggle-capitulos").addEventListener("click", function () {
      document.getElementById("panel-capitulos").classList.toggle("abierto");
    });
    document.querySelectorAll("#barra-comandos .cmd").forEach(function (el) {
      el.addEventListener("click", function () { insertarTexto(" (" + el.dataset.cmd + ") "); detectarComandos(elEditor); });
    });
    document.getElementById("btn-ayuda-voz").addEventListener("click", function () {
      document.getElementById("dialogo-ayuda-voz").showModal();
    });
  }

  function capActivo() {
    var p = Datos.proyecto();
    if (!p) return null;
    return p.capitulos.find(function (c) { return c.id === capituloId; }) || null;
  }

  function abrirProyecto() {
    var p = Datos.proyecto();
    if (!p) return;
    capituloId = p.capituloActivo && p.capitulos.some(function (c) { return c.id === p.capituloActivo; })
      ? p.capituloActivo : (p.capitulos[0] && p.capitulos[0].id);
    pintarLista();
    abrirCapitulo(capituloId);
    palabrasInicioDia = null;
  }

  function abrirCapitulo(id) {
    var p = Datos.proyecto();
    if (!p) return;
    capituloId = id;
    p.capituloActivo = id;
    var cap = capActivo();
    if (!cap) return;
    elTitulo.value = cap.titulo;
    elEditor.innerHTML = cap.html || "";
    pintarLista();
    actualizarContador();
    Datos.guardar();
  }

  function nuevoCapitulo() {
    var p = Datos.proyecto();
    if (!p) return;
    var cap = Datos.nuevoCapitulo("Capítulo " + (p.capitulos.length + 1));
    p.capitulos.push(cap);
    abrirCapitulo(cap.id);
    elTitulo.focus();
    elTitulo.select();
  }

  function borrarCapitulo(id) {
    var p = Datos.proyecto();
    var i = p.capitulos.findIndex(function (c) { return c.id === id; });
    if (i < 0) return;
    UI.confirmar("¿Enviar «" + p.capitulos[i].titulo + "» a la papelera?", function () {
      Datos.aPapelera("capitulo", p.capitulos[i], p.id);
      p.capitulos.splice(i, 1);
      if (!p.capitulos.length) p.capitulos.push(Datos.nuevoCapitulo("Capítulo 1"));
      abrirCapitulo(p.capitulos[Math.max(0, i - 1)].id);
      UI.aviso("Capítulo enviado a la papelera (30 días).");
    });
  }

  function moverCapitulo(id, delta) {
    var p = Datos.proyecto();
    var i = p.capitulos.findIndex(function (c) { return c.id === id; });
    var j = i + delta;
    if (i < 0 || j < 0 || j >= p.capitulos.length) return;
    var tmp = p.capitulos[i]; p.capitulos[i] = p.capitulos[j]; p.capitulos[j] = tmp;
    Datos.guardar(); pintarLista();
  }

  function pintarLista() {
    var p = Datos.proyecto();
    if (!p) return;
    elLista.innerHTML = "";
    p.capitulos.forEach(function (cap, idx) {
      var li = document.createElement("li");
      li.className = cap.id === capituloId ? "activo" : "";
      var n = contarPalabras(cap.html);
      var iconoEstado = { revision: "🔍", terminado: "✅" }[cap.estado] || "📝";
      li.innerHTML = '<span class="num">' + (idx + 1) + '.</span> <span class="estado-cap" title="Estado">' + iconoEstado + '</span> <span class="cap-titulo"></span>' +
        '<span class="palabras">' + n + '</span>' +
        '<button class="btn-icono btn-sube" title="Subir">▲</button>' +
        '<button class="btn-icono btn-baja" title="Bajar">▼</button>' +
        '<button class="btn-icono btn-borra" title="Borrar">🗑</button>';
      li.querySelector(".cap-titulo").textContent = cap.titulo;
      li.addEventListener("click", function (e) {
        if (e.target.tagName === "BUTTON") return;
        abrirCapitulo(cap.id);
        if (window.innerWidth <= 720) document.getElementById("panel-capitulos").classList.remove("abierto");
      });
      li.querySelector(".btn-sube").addEventListener("click", function () { moverCapitulo(cap.id, -1); });
      li.querySelector(".btn-baja").addEventListener("click", function () { moverCapitulo(cap.id, 1); });
      li.querySelector(".btn-borra").addEventListener("click", function () { borrarCapitulo(cap.id); });
      elLista.appendChild(li);
    });
  }

  function alEscribir() {
    var cap = capActivo();
    if (!cap) return;
    cap.html = elEditor.innerHTML;
    cap.actualizadoEl = Datos.ahora();
    Datos.guardar();
    actualizarContador();
  }

  /* ---------- Contador y objetivo ---------- */
  function contarPalabras(html) {
    if (!html) return 0;
    var t = html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").trim();
    return t ? t.split(/\s+/).length : 0;
  }

  function totalPalabras() {
    var p = Datos.proyecto();
    if (!p) return 0;
    return p.capitulos.reduce(function (s, c) { return s + contarPalabras(c.html); }, 0);
  }

  function actualizarContador() {
    var cap = capActivo();
    var total = totalPalabras();
    elContador.textContent = contarPalabras(cap && cap.html) + " / " + total + " palabras";
    if (palabrasInicioDia === null) {
      var hist = Datos.db.ajustes.historicoDias;
      palabrasInicioDia = total - (hist[Datos.hoy()] || 0);
    }
    var hoyEscritas = Math.max(0, total - palabrasInicioDia);
    Datos.registrarPalabrasHoy(hoyEscritas);
    var obj = Datos.db.ajustes.objetivoPalabras;
    if (obj > 0) {
      var r = Datos.racha();
      elObjetivo.textContent = "Hoy: " + hoyEscritas + " / " + obj + " palabras" +
        (hoyEscritas >= obj ? " ✔ ¡objetivo cumplido!" : "") + (r > 1 ? " · racha: " + r + " días 🔥" : "");
    } else elObjetivo.textContent = "";
  }

  /* ---------- Comandos de entidades (p)(l)(o)(t) ---------- */
  // 1) Nombre propio: "Aldair (p)", "Torre del Alba (l)"
  var RE_CMD = /((?:[A-ZÁÉÍÓÚÜÑ][\wáéíóúüñÁÉÍÓÚÜÑ'-]*)(?:\s+(?:de|del|la|las|el|los|[A-ZÁÉÍÓÚÜÑ][\wáéíóúüñÁÉÍÓÚÜÑ'-]*))*)\s*\(\s*([plot])\s*\)/;
  // 2) Nombre común tras artículo: "junto al faro (l)", "la brújula de bronce (o)"
  var RE_CMD_MIN = /(?:\b(?:el|la|los|las|un|una|unos|unas|al|del)\s+)([a-záéíóúüñ][\wáéíóúüñ'-]*(?:\s+(?:de|del|de la|de los|de las)\s+[\wáéíóúüñÁÉÍÓÚÜÑ'-]+)*)\s*\(\s*([plot])\s*\)/;
  // 3) Última palabra suelta: "faro (l)"
  var RE_CMD_ULT = /([\wáéíóúüñÁÉÍÓÚÜÑ'-]+)\s*\(\s*([plot])\s*\)/;

  function buscarComando(texto) {
    return RE_CMD.exec(texto) || RE_CMD_MIN.exec(texto) || RE_CMD_ULT.exec(texto);
  }

  function detectarComandos(raiz) {
    var seguridad = 0;
    while (procesarUnComando(raiz) && seguridad++ < 10) { /* procesa todas las coincidencias */ }
  }

  function procesarUnComando(raiz) {
    var sel = window.getSelection();
    if (!sel.rangeCount) return false;
    var nodo = sel.anchorNode;
    if (!nodo || nodo.nodeType !== 3 || !raiz.contains(nodo)) return false;
    var m = buscarComando(nodo.textContent);
    if (!m) return false;

    var enTexto = m[1].trim();                       // como aparece en el texto («faro»)
    var nombre = enTexto.charAt(0).toUpperCase() + enTexto.slice(1); // nombre de la ficha («Faro»)
    var tipo = m[2];
    var cursor = sel.anchorOffset;
    // Sustituir "Nombre (x)" por un span de entidad, conservando el artículo si lo hay
    var texto = nodo.textContent;
    var inicioNombre = m.index + m[0].indexOf(m[1]);
    var antes = texto.slice(0, inicioNombre);
    var despues = texto.slice(m.index + m[0].length);

    var ficha = Fichas.buscarPorNombre(tipo, nombre) || Fichas.crear(tipo, nombre);

    var span = document.createElement("span");
    span.className = "entidad";
    span.dataset.fichaId = ficha.id;
    span.textContent = enTexto;

    var frag = document.createDocumentFragment();
    frag.appendChild(document.createTextNode(antes));
    frag.appendChild(span);
    var nodoDespues = document.createTextNode(despues);
    frag.appendChild(nodoDespues);
    nodo.parentNode.replaceChild(frag, nodo);

    // Recoloca el cursor donde estaba, relativo al texto que sigue a la entidad
    var offset = Math.max(0, Math.min(cursor - (m.index + m[0].length), nodoDespues.length));
    var r = document.createRange();
    r.setStart(nodoDespues, offset);
    r.collapse(true);
    sel.removeAllRanges();
    sel.addRange(r);

    alEscribirSegunRaiz(raiz);
    UI.aviso(Fichas.icono(tipo) + " Ficha de «" + nombre + "» lista. Tócala en el texto o ve a Fichas para completarla.");
    Fichas.pintar();
    return true;
  }

  function alEscribirSegunRaiz(raiz) {
    if (raiz === elEditor) alEscribir();
    else if (window.Diario) Diario.alEscribir();
  }

  /* ---------- Utilidades de inserción (usadas también por el dictado) ---------- */
  function insertarTexto(texto, raiz) {
    raiz = raiz || elEditor;
    raiz.focus();
    var sel = window.getSelection();
    if (!sel.rangeCount || !raiz.contains(sel.anchorNode)) {
      // cursor al final
      var r = document.createRange();
      r.selectNodeContents(raiz);
      r.collapse(false);
      sel.removeAllRanges();
      sel.addRange(r);
    }
    var rango = sel.getRangeAt(0);
    rango.deleteContents(); // si hay selección, se sustituye
    var nodo = document.createTextNode(texto);
    rango.insertNode(nodo);
    rango.setStartAfter(nodo);
    rango.collapse(true);
    sel.removeAllRanges();
    sel.addRange(rango);
    alEscribirSegunRaiz(raiz);
  }

  function insertarParrafo(raiz) {
    raiz = raiz || elEditor;
    raiz.focus();
    document.execCommand("insertParagraph");
    alEscribirSegunRaiz(raiz);
  }

  function resaltarEntidadesExistentes() {
    // Marca en el capítulo actual nombres de fichas aún sin enlazar (al abrir la vista Fichas se refresca)
  }

  return {
    init: init, abrirProyecto: abrirProyecto, abrirCapitulo: abrirCapitulo,
    pintarLista: pintarLista, insertarTexto: insertarTexto, insertarParrafo: insertarParrafo,
    detectarComandos: detectarComandos, contarPalabras: contarPalabras,
    totalPalabras: totalPalabras, actualizarContador: actualizarContador,
    capActual: capActivo,
    get elEditor() { return elEditor; }
  };
})();
