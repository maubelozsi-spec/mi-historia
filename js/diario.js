/* ============ Mi diario — privado con código alfanumérico ============ */

var Diario = (function () {
  var abierto = false;
  var entradaId = null;
  var elEditor, elTitulo, elLista, elFecha;

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
    document.getElementById("btn-nueva-entrada").addEventListener("click", nuevaEntrada);

    document.getElementById("btn-diario-lista").addEventListener("click", function () { modoVista("lista"); });
    document.getElementById("btn-diario-tiempo").addEventListener("click", function () { modoVista("tiempo"); });

    elEditor.addEventListener("input", alEscribir);
    elEditor.addEventListener("keyup", function () { alEscribir(); });
    elTitulo.addEventListener("input", function () {
      var en = entradaActiva();
      if (!en) return;
      en.titulo = elTitulo.value;
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
  }

  function cerrar() {
    abierto = false;
    entradaId = null;
    document.getElementById("diario-interior").classList.add("oculto");
    document.getElementById("diario-puerta").classList.remove("oculto");
    elEditor.innerHTML = "";
    App.mostrarVista("escribir");
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
    Datos.guardar();
  }

  function pintarLista() {
    elLista.innerHTML = "";
    var entradas = Datos.db.diario.entradas.slice().sort(porFechaDesc);
    entradas.forEach(function (en) {
      var li = document.createElement("li");
      li.className = en.id === entradaId ? "activo" : "";
      li.innerHTML = '<span class="cap-titulo"></span><button class="btn-icono btn-borra" title="Borrar">🗑</button>';
      li.querySelector(".cap-titulo").textContent = en.titulo || new Date(en.fecha).toLocaleDateString("es-ES");
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

  function pintarLineaTemporal() {
    var cont = document.getElementById("diario-linea");
    cont.innerHTML = "";
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
      div.querySelector(".lt-momento").textContent = f.toLocaleDateString("es-ES", { weekday: "long", day: "numeric" });
      div.querySelector("h4").textContent = en.titulo || "";
      div.querySelector("p").textContent = resumen + (resumen.length >= 140 ? "…" : "");
      div.addEventListener("click", function () { abrirEntrada(en.id); });
      cont.appendChild(div);
    });
  }

  return { init: init, alEscribir: alEscribir, alSalirDeVista: alSalirDeVista };
})();
