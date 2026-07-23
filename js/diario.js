/* ============ Mi diario — privado con código alfanumérico ============ */

var Diario = (function () {
  var abierto = false;
  var entradaId = null;
  var elEditor, elTitulo, elLista, elFecha;

  var ANIMOS = { 1: "😞", 2: "😕", 3: "😐", 4: "🙂", 5: "😄" };

  var REFLEXIONES = [
    "¿Qué ha sido lo mejor de hoy y por qué?",
    "¿Qué dificultad has afrontado hoy? ¿Qué has aprendido de ella?",
    "¿Qué te preocupa ahora mismo? ¿Qué parte depende de ti?",
    "¿A quién le agradeces algo hoy?",
    "¿Qué te gustaría decirte a ti mismo dentro de un año?",
    "¿Qué harías mañana si no tuvieras miedo?",
    "¿Qué has hecho hoy por cuidarte?",
    "¿Qué emoción ha mandado hoy en ti? ¿Dónde la has notado en el cuerpo?",
    "Algo no salió como querías. ¿Cómo crees que lo verás dentro de un mes?",
    "¿Qué pequeño paso puedes dar mañana hacia lo que quieres?",
    "¿Qué te ha hecho sonreír hoy?",
    "¿Qué necesitas soltar para estar mejor?",
    "¿De qué te sientes orgulloso hoy, aunque sea pequeño?",
    "Si un buen amigo estuviera en tu situación, ¿qué le dirías?",
    "¿Qué momento de hoy merecería un capítulo en tu novela?",
    "¿Qué versión de ti quiere salir mañana de la cama?"
  ];

  /* Hash sencillo (djb2 doble) — evita guardar el código en claro.
     Protege tu intimidad frente a quien coja el dispositivo. */
  function hash(txt) {
    var h1 = 5381, h2 = 52711;
    for (var i = 0; i < txt.length; i++) {
      var c = txt.charCodeAt(i);
      h1 = ((h1 * 33) ^ c) >>> 0;
      h2 = ((h2 * 31) + c) >>> 0;
    }
    return h1.toString(36) + "." + h2.toString(36);
  }

  function init() {
    elEditor = document.getElementById("editor-diario");
    elTitulo = document.getElementById("titulo-entrada");
    elLista = document.getElementById("lista-entradas");
    elFecha = document.getElementById("fecha-entrada");

    document.getElementById("btn-diario").addEventListener("click", function () { App.mostrarVista("diario"); prepararPuerta(); });
    document.getElementById("btn-entrar-diario").addEventListener("click", entrar);
    document.getElementById("input-codigo-diario").addEventListener("keydown", function (e) { if (e.key === "Enter") entrar(); });
    document.getElementById("input-codigo-diario2").addEventListener("keydown", function (e) { if (e.key === "Enter") entrar(); });
    document.getElementById("btn-salir-diario").addEventListener("click", cerrar);
    document.getElementById("btn-toggle-entradas").addEventListener("click", function () {
      document.getElementById("panel-entradas").classList.toggle("abierto");
    });
    document.getElementById("btn-reflexion").addEventListener("click", insertarReflexion);
    document.getElementById("diario-pista-enlace").addEventListener("click", function () {
      UI.aviso("💡 Tu pista: " + (Datos.db.diario.pista || "(no dejaste pista)"), 6000);
    });
    document.querySelectorAll(".animo-btn").forEach(function (b) {
      b.addEventListener("click", function () {
        var en = entradaActiva();
        if (!en) return;
        en.animo = parseInt(b.dataset.animo, 10);
        en.actualizadoEl = Datos.ahora();
        Datos.guardar();
        pintarAnimo();
        pintarLista();
      });
    });
    document.getElementById("btn-nueva-entrada").addEventListener("click", nuevaEntrada);

    document.getElementById("btn-diario-lista").addEventListener("click", function () { modoVista("lista"); });
    document.getElementById("btn-diario-tiempo").addEventListener("click", function () { modoVista("tiempo"); });

    elEditor.addEventListener("input", alEscribir);
    elEditor.addEventListener("keyup", function () { alEscribir(); });
    elTitulo.addEventListener("input", function () {
      var en = entradaActiva();
      if (!en) return;
      en.titulo = elTitulo.value;
      en.actualizadoEl = Datos.ahora();
      Datos.guardar();
      pintarLista();
    });
  }

  function prepararPuerta() {
    var tieneCodigo = !!Datos.db.diario.hash;
    document.getElementById("diario-puerta-texto").textContent = tieneCodigo
      ? "Introduce tu código para entrar."
      : "Primera vez: elige un código alfanumérico (letras y números). Apúntalo bien: sin él no se puede entrar.";
    document.getElementById("input-codigo-diario2").classList.toggle("oculto", tieneCodigo);
    document.getElementById("input-pista-diario").classList.toggle("oculto", tieneCodigo);
    document.getElementById("diario-pista-enlace").classList.toggle("oculto", !(tieneCodigo && Datos.db.diario.pista));
    document.getElementById("diario-error").textContent = "";
    document.getElementById("input-codigo-diario").value = "";
    document.getElementById("input-codigo-diario2").value = "";
    document.getElementById("input-codigo-diario").focus();
  }

  function entrar() {
    var cod = document.getElementById("input-codigo-diario").value.trim();
    var err = document.getElementById("diario-error");
    if (cod.length < 4) { err.textContent = "El código debe tener al menos 4 caracteres."; return; }
    var d = Datos.db.diario;
    if (!d.hash) {
      var cod2 = document.getElementById("input-codigo-diario2").value.trim();
      if (cod !== cod2) { err.textContent = "Los dos códigos no coinciden."; return; }
      d.hash = hash(cod);
      d.pista = document.getElementById("input-pista-diario").value.trim() || null;
      Datos.guardar(true);
    } else if (hash(cod) !== d.hash) {
      err.textContent = "Código incorrecto.";
      return;
    }
    abierto = true;
    document.getElementById("diario-puerta").classList.add("oculto");
    document.getElementById("diario-interior").classList.remove("oculto");
    if (!d.entradas.length) nuevaEntrada();
    else abrirEntrada(d.entradas.slice().sort(porFechaDesc)[0].id);
    pintarLista();
    pintarTalDia();
  }

  /* ---------- Tal día como hoy ---------- */
  function pintarTalDia() {
    var banner = document.getElementById("tal-dia");
    banner.classList.add("oculto");
    var candidatos = [
      { dias: 365, texto: "hace un año", margen: 5 },
      { dias: 30, texto: "hace un mes", margen: 3 },
      { dias: 7, texto: "hace una semana", margen: 1 }
    ];
    var hoy = Date.now();
    for (var i = 0; i < candidatos.length; i++) {
      var c = candidatos[i];
      var objetivo = hoy - c.dias * 86400000;
      var en = Datos.db.diario.entradas.filter(function (e) {
        return e.id !== entradaId && Math.abs(new Date(e.fecha).getTime() - objetivo) <= c.margen * 86400000;
      }).sort(porFechaDesc)[0];
      if (en) {
        var extracto = (en.html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 110);
        if (!extracto) continue;
        banner.innerHTML = "<span>🕰️ <b>Tal día como hoy, " + c.texto + "</b>, escribiste: «" + extracto +
          "…»</span> <button class='btn-secundario btn-leer'>Leer</button><button class='btn-icono btn-x' title='Cerrar'>✕</button>";
        banner.querySelector(".btn-leer").addEventListener("click", (function (id) {
          return function () { abrirEntrada(id); banner.classList.add("oculto"); };
        })(en.id));
        banner.querySelector(".btn-x").addEventListener("click", function () { banner.classList.add("oculto"); });
        banner.classList.remove("oculto");
        return;
      }
    }
  }

  function cerrar() {
    abierto = false;
    entradaId = null;
    document.getElementById("diario-interior").classList.add("oculto");
    document.getElementById("diario-puerta").classList.remove("oculto");
    elEditor.innerHTML = "";
    App.mostrarVista("inicio");
  }

  function insertarReflexion() {
    var en = entradaActiva();
    if (!en) return;
    var q = REFLEXIONES[Math.floor(Math.random() * REFLEXIONES.length)];
    var p = document.createElement("p");
    p.className = "reflexion";
    p.innerHTML = "<i>💭 " + q + "</i>";
    elEditor.appendChild(p);
    var respuesta = document.createElement("p");
    respuesta.innerHTML = "<br>";
    elEditor.appendChild(respuesta);
    // cursor en el párrafo de respuesta
    var sel = window.getSelection();
    var r = document.createRange();
    r.setStart(respuesta, 0);
    r.collapse(true);
    sel.removeAllRanges();
    sel.addRange(r);
    elEditor.focus();
    alEscribir();
  }

  function pintarAnimo() {
    var en = entradaActiva();
    document.querySelectorAll(".animo-btn").forEach(function (b) {
      b.classList.toggle("elegido", !!en && parseInt(b.dataset.animo, 10) === en.animo);
    });
  }

  function alSalirDeVista() { if (abierto) { abierto = false; document.getElementById("diario-interior").classList.add("oculto"); document.getElementById("diario-puerta").classList.remove("oculto"); elEditor.innerHTML = ""; entradaId = null; } }

  function porFechaDesc(a, b) { return (b.fecha || "").localeCompare(a.fecha || ""); }

  function entradaActiva() {
    return Datos.db.diario.entradas.find(function (e) { return e.id === entradaId; }) || null;
  }

  function nuevaEntrada() {
    var hoy = new Date();
    var en = {
      id: Datos.uid(),
      fecha: hoy.toISOString(),
      titulo: hoy.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
      html: ""
    };
    Datos.db.diario.entradas.push(en);
    Datos.guardar();
    abrirEntrada(en.id);
  }

  function abrirEntrada(id) {
    entradaId = id;
    var en = entradaActiva();
    if (!en) return;
    elTitulo.value = en.titulo || "";
    elFecha.textContent = new Date(en.fecha).toLocaleDateString("es-ES");
    elEditor.innerHTML = en.html || "";
    modoVista("lista", true);
    pintarAnimo();
    pintarLista();
  }

  function borrarEntrada(id) {
    var d = Datos.db.diario;
    var i = d.entradas.findIndex(function (e) { return e.id === id; });
    if (i < 0) return;
    UI.confirmar("¿Enviar esta entrada del diario a la papelera?", function () {
      Datos.aPapelera("entrada", d.entradas[i], null);
      d.entradas.splice(i, 1);
      if (d.entradas.length) abrirEntrada(d.entradas.slice().sort(porFechaDesc)[0].id);
      else nuevaEntrada();
    });
  }

  function alEscribir() {
    var en = entradaActiva();
    if (!en) return;
    en.html = elEditor.innerHTML;
    en.actualizadoEl = Datos.ahora();
    Datos.guardar();
  }

  function pintarLista() {
    elLista.innerHTML = "";
    var entradas = Datos.db.diario.entradas.slice().sort(porFechaDesc);
    entradas.forEach(function (en) {
      var li = document.createElement("li");
      li.className = en.id === entradaId ? "activo" : "";
      li.innerHTML = '<span class="cap-titulo"></span><button class="btn-icono btn-borra" title="Borrar">🗑</button>';
      li.querySelector(".cap-titulo").textContent = (en.animo ? ANIMOS[en.animo] + " " : "") +
        (en.titulo || new Date(en.fecha).toLocaleDateString("es-ES"));
      li.addEventListener("click", function (e) {
        if (e.target.tagName === "BUTTON") return;
        abrirEntrada(en.id);
        if (window.innerWidth <= 720) document.getElementById("panel-entradas").classList.remove("abierto");
      });
      li.querySelector(".btn-borra").addEventListener("click", function () { borrarEntrada(en.id); });
      elLista.appendChild(li);
    });
  }

  /* ---------- Línea temporal del diario ---------- */
  function modoVista(modo, silencioso) {
    var zona = document.getElementById("zona-diario");
    var linea = document.getElementById("diario-linea");
    var bLista = document.getElementById("btn-diario-lista");
    var bTiempo = document.getElementById("btn-diario-tiempo");
    if (modo === "tiempo") {
      zona.classList.add("oculto"); linea.classList.remove("oculto");
      bTiempo.classList.add("activo"); bLista.classList.remove("activo");
      pintarLineaTemporal();
    } else {
      linea.classList.add("oculto"); zona.classList.remove("oculto");
      bLista.classList.add("activo"); bTiempo.classList.remove("activo");
    }
  }

  /* ---------- Gráfica de ánimo (últimos 30 días) ---------- */
  function graficaAnimo() {
    var conAnimo = Datos.db.diario.entradas.filter(function (e) { return e.animo; });
    if (conAnimo.length < 2) return null;
    var hoy = new Date(); hoy.setHours(23, 59, 59);
    var inicio = hoy.getTime() - 29 * 86400000;
    var puntos = conAnimo.filter(function (e) { return new Date(e.fecha).getTime() >= inicio; })
      .sort(function (a, b) { return a.fecha.localeCompare(b.fecha); });
    if (puntos.length < 2) return null;
    var W = 560, H = 120, mx = 30, my = 12;
    var xDe = function (e) { return mx + ((new Date(e.fecha).getTime() - inicio) / (29 * 86400000)) * (W - mx - 10); };
    var yDe = function (e) { return H - my - ((e.animo - 1) / 4) * (H - 2 * my); };
    var svg = "<svg viewBox='0 0 " + W + " " + H + "' style='width:100%;max-width:600px'>";
    for (var a = 1; a <= 5; a++) {
      var y = H - my - ((a - 1) / 4) * (H - 2 * my);
      svg += "<text x='2' y='" + (y + 4) + "' font-size='11'>" + ANIMOS[a] + "</text>" +
        "<line x1='" + mx + "' y1='" + y + "' x2='" + (W - 10) + "' y2='" + y + "' stroke='#d8d2c4' stroke-dasharray='3 4'/>";
    }
    svg += "<polyline fill='none' stroke='#6a5acd' stroke-width='2' points='" +
      puntos.map(function (e) { return xDe(e).toFixed(1) + "," + yDe(e).toFixed(1); }).join(" ") + "'/>";
    puntos.forEach(function (e) {
      svg += "<circle cx='" + xDe(e).toFixed(1) + "' cy='" + yDe(e).toFixed(1) + "' r='4' fill='#6a5acd'/>";
    });
    svg += "</svg>";
    return "<div class='tarjeta'><h3 style='margin:.2rem 0'>Tu ánimo, último mes</h3>" + svg + "</div>";
  }

  function pintarLineaTemporal() {
    var cont = document.getElementById("diario-linea");
    cont.innerHTML = "";
    var g = graficaAnimo();
    if (g) cont.insertAdjacentHTML("beforeend", g);
    var entradas = Datos.db.diario.entradas.slice().sort(porFechaDesc);
    if (!entradas.length) { cont.innerHTML = '<p class="nota">Aún no hay entradas.</p>'; return; }
    var mesActual = "";
    entradas.forEach(function (en) {
      var f = new Date(en.fecha);
      var mes = f.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
      if (mes !== mesActual) {
        mesActual = mes;
        var h = document.createElement("h3");
        h.textContent = mes.charAt(0).toUpperCase() + mes.slice(1);
        h.style.marginLeft = "1.6rem";
        cont.appendChild(h);
      }
      var div = document.createElement("div");
      div.className = "lt-item";
      var resumen = (en.html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 140);
      div.innerHTML = '<div class="lt-momento"></div><h4></h4><p></p>';
      div.querySelector(".lt-momento").textContent = f.toLocaleDateString("es-ES", { weekday: "long", day: "numeric" }) +
        (en.animo ? "  ·  " + ANIMOS[en.animo] : "");
      div.querySelector("h4").textContent = en.titulo || "";
      div.querySelector("p").textContent = resumen + (resumen.length >= 140 ? "…" : "");
      div.addEventListener("click", function () { abrirEntrada(en.id); });
      cont.appendChild(div);
    });
  }

  return { init: init, alEscribir: alEscribir, alSalirDeVista: alSalirDeVista };
})();
