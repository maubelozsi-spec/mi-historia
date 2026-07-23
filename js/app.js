/* ============ Mi Historia — arranque y navegación ============ */

var UI = {
  aviso: function (texto, ms) {
    var el = document.getElementById("aviso");
    if (!texto) { el.classList.add("oculto"); return; }
    el.textContent = texto;
    el.classList.remove("oculto");
    clearTimeout(UI._t);
    UI._t = setTimeout(function () { el.classList.add("oculto"); }, ms || 3200);
  },

  _prepararDialogo: function () {
    var d = document.getElementById("dialogo-pedir");
    if (!UI._dialogoListo) {
      UI._dialogoListo = true;
      document.getElementById("pedir-input").addEventListener("keydown", function (e) {
        if (e.key === "Enter") { e.preventDefault(); document.getElementById("pedir-ok").click(); }
      });
    }
    d.returnValue = "cancelar";
    return d;
  },

  /* Diálogo propio en lugar de prompt(): UI.pedir(título, valorInicial, cb) */
  pedir: function (titulo, valorInicial, cb, textoAyuda) {
    var d = UI._prepararDialogo();
    document.getElementById("pedir-titulo").textContent = titulo;
    document.getElementById("pedir-texto").textContent = textoAyuda || "";
    var input = document.getElementById("pedir-input");
    input.classList.remove("oculto");
    input.value = valorInicial || "";
    document.getElementById("pedir-ok").textContent = "Aceptar";
    document.getElementById("pedir-cancelar").textContent = "Cancelar";
    var alCerrar = function () {
      d.removeEventListener("close", alCerrar);
      if (d.returnValue === "ok" && input.value.trim()) cb(input.value.trim());
    };
    d.addEventListener("close", alCerrar);
    d.showModal();
    input.focus(); input.select();
  },

  /* Diálogo propio en lugar de confirm(): UI.confirmar(texto, cbSí, cbNo, {si, no}) */
  confirmar: function (texto, cbSi, cbNo, etiquetas) {
    var d = UI._prepararDialogo();
    document.getElementById("pedir-titulo").textContent = "";
    document.getElementById("pedir-texto").textContent = texto;
    document.getElementById("pedir-input").classList.add("oculto");
    document.getElementById("pedir-ok").textContent = (etiquetas && etiquetas.si) || "Sí";
    document.getElementById("pedir-cancelar").textContent = (etiquetas && etiquetas.no) || "Cancelar";
    var alCerrar = function () {
      d.removeEventListener("close", alCerrar);
      if (d.returnValue === "ok") { if (cbSi) cbSi(); }
      else if (cbNo) cbNo();
    };
    d.addEventListener("close", alCerrar);
    d.showModal();
  }
};

var App = (function () {
  var vistaActual = "inicio";

  function init() {
    Datos.cargar();
    Editor.init();
    Dictado.init();
    Fichas.init();
    Mapa.init();
    Tiempo.init();
    Entornos.init();
    Nombres.init();
    Diario.init();
    Exportar.init();
    Sync.init();

    document.getElementById("btn-inicio").addEventListener("click", function () { mostrarVista("inicio"); });
    document.querySelectorAll("#nav-principal .nav-btn").forEach(function (b) {
      b.addEventListener("click", function () { mostrarVista(b.dataset.vista); });
    });
    document.getElementById("btn-nueva-novela").addEventListener("click", nuevaNovela);

    // atajo: Ctrl+S fuerza guardado (aunque ya es automático)
    document.addEventListener("keydown", function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        Datos.guardar(true);
        UI.aviso("Guardado ✔ (se guarda solo mientras escribes)");
      }
    });

    // service worker para PWA (solo funciona bajo https o localhost)
    if ("serviceWorker" in navigator && location.protocol !== "file:") {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    }

    if (Datos.db.proyectoActivo && Datos.proyecto()) {
      abrirProyecto(Datos.db.proyectoActivo, true);
    } else {
      mostrarVista("inicio");
    }
  }

  function mostrarVista(nombre) {
    if (vistaActual === "diario" && nombre !== "diario") Diario.alSalirDeVista();
    vistaActual = nombre;
    document.querySelectorAll(".vista").forEach(function (v) { v.classList.add("oculto"); });
    var vista = document.getElementById("vista-" + nombre);
    if (vista) vista.classList.remove("oculto");
    document.querySelectorAll("#nav-principal .nav-btn").forEach(function (b) {
      b.classList.toggle("activo", b.dataset.vista === nombre);
    });
    var nav = document.getElementById("nav-principal");
    nav.classList.toggle("oculto", nombre === "inicio" || nombre === "diario" || !Datos.proyecto());

    // el diario es un espacio aparte: la cabecera lo refleja
    var np = document.getElementById("nombre-proyecto");
    if (nombre === "diario") np.textContent = "— Mi diario 🔒";
    else {
      var p = Datos.proyecto();
      np.textContent = p && nombre !== "inicio" ? "— " + p.nombre : "";
    }

    if (nombre === "inicio") pintarProyectos();
    else if (nombre === "fichas") Fichas.pintar();
    else if (nombre === "mapa") Mapa.pintar();
    else if (nombre === "tiempo") Tiempo.pintar();
    else if (nombre === "entornos") Entornos.pintar();
    else if (nombre === "biblioteca") Biblioteca.pintar();
    else if (nombre === "copia") Exportar.pintarPanel();
  }

  /* ---------- Novelas (proyectos) ---------- */
  function pintarProyectos() {
    var cont = document.getElementById("lista-proyectos");
    cont.innerHTML = "";
    if (!Datos.db.proyectos.length) {
      cont.innerHTML = '<p class="nota">Todavía no hay ninguna novela. ¡Crea la primera!</p>';
    }
    Datos.db.proyectos.forEach(function (p) {
      var palabras = p.capitulos.reduce(function (s, c) { return s + Editor.contarPalabras(c.html); }, 0);
      var t = document.createElement("div");
      t.className = "proyecto-tarjeta";
      t.innerHTML = "<div><h3></h3><div class='detalle'>" + p.capitulos.length + " capítulos · " +
        palabras + " palabras · " + p.fichas.length + " fichas</div></div>" +
        "<div class='proyecto-acciones'>" +
        "<button class='btn-renombra' title='Renombrar'>✏️</button>" +
        "<button class='btn-borra' title='Borrar'>🗑</button></div>";
      t.querySelector("h3").textContent = "📖 " + p.nombre;
      t.addEventListener("click", function (e) {
        if (e.target.tagName === "BUTTON") return;
        abrirProyecto(p.id);
      });
      t.querySelector(".btn-renombra").addEventListener("click", function () {
        UI.pedir("Nuevo nombre de la novela", p.nombre, function (n) {
          p.nombre = n; Datos.guardar(); pintarProyectos();
        });
      });
      t.querySelector(".btn-borra").addEventListener("click", function () {
        UI.confirmar("¿Enviar la novela «" + p.nombre + "» ENTERA a la papelera? Podrás recuperarla durante 30 días.", function () {
          Datos.aPapelera("proyecto", p, p.id);
          Datos.db.proyectos = Datos.db.proyectos.filter(function (x) { return x.id !== p.id; });
          if (Datos.db.proyectoActivo === p.id) Datos.db.proyectoActivo = null;
          Datos.guardar();
          pintarProyectos();
        });
      });
      cont.appendChild(t);
    });
  }

  function nuevaNovela() {
    UI.pedir("Título de la novela", "Mi historia", function (nombre) {
      var p = Datos.nuevoProyecto(nombre);
      Datos.db.proyectos.push(p);
      Datos.guardar();
      abrirProyecto(p.id);
    }, "Podrás cambiarlo cuando quieras.");
  }

  function abrirProyecto(id, silencioso) {
    Datos.db.proyectoActivo = id;
    var p = Datos.proyecto();
    if (!p) { mostrarVista("inicio"); return; }
    document.getElementById("nombre-proyecto").textContent = "— " + p.nombre;
    Datos.guardar();
    Editor.abrirProyecto();
    mostrarVista("escribir");
    if (!silencioso) UI.aviso("📖 " + p.nombre);
  }

  function refrescarTodo() {
    if (Datos.proyecto()) {
      Editor.abrirProyecto();
      Fichas.pintar(); Tiempo.pintar(); Entornos.pintar();
    }
    pintarProyectos();
  }

  return { init: init, mostrarVista: mostrarVista, refrescarTodo: refrescarTodo };
})();

document.addEventListener("DOMContentLoaded", App.init);
