/* ============ Fichas de personajes, lugares, objetos y tramas ============ */

var Fichas = (function () {
  var tipoActivo = "p";
  var fichaEnEdicion = null;

  var TIPOS = {
    p: { nombre: "Personaje", icono: "👤", campos: [
      ["descripcionFisica", "Descripción física", "area"],
      ["caracter", "Carácter y personalidad", "area"],
      ["modoActuar", "Modo de actuar y de pensar", "area"],
      ["historia", "Historia y pasado", "area"],
      ["objetivo", "Qué quiere (objetivo y motivación)", "area"],
      ["evolucion", "Evolución a lo largo de la novela", "area"],
      ["notas", "Otras notas", "area"]
    ]},
    l: { nombre: "Lugar", icono: "📍", campos: [
      ["aspecto", "Aspecto y geografía", "area"],
      ["ambiente", "Ambiente y emoción que transmite", "area"],
      ["sentidos", "Los cinco sentidos (qué se ve, oye, huele…)", "area"],
      ["historia", "Historia del lugar", "area"],
      ["habitantes", "Quién vive o aparece aquí", "area"],
      ["notas", "Otras notas", "area"]
    ]},
    o: { nombre: "Objeto", icono: "🗝️", campos: [
      ["aspecto", "Aspecto", "area"],
      ["poder", "Qué hace o qué significa", "area"],
      ["origen", "Origen e historia", "area"],
      ["poseedor", "Quién lo tiene", "texto"],
      ["notas", "Otras notas", "area"]
    ]},
    t: { nombre: "Nota de trama", icono: "🧵", campos: [
      ["promesa", "Qué se promete al lector", "area"],
      ["pago", "Dónde y cómo se paga (capítulo previsto)", "area"],
      ["linea", "Línea narrativa (aventura, amor, intriga, mundo)", "texto"],
      ["notas", "Otras notas", "area"]
    ]}
  };

  function init() {
    document.querySelectorAll("#vista-fichas .subnav-btn[data-tipo]").forEach(function (b) {
      b.addEventListener("click", function () {
        tipoActivo = b.dataset.tipo;
        document.querySelectorAll("#vista-fichas .subnav-btn[data-tipo]").forEach(function (x) { x.classList.remove("activo"); });
        b.classList.add("activo");
        pintar();
      });
    });
    document.getElementById("btn-nueva-ficha").addEventListener("click", function () {
      var titulo = "Nombre " + (tipoActivo === "t" ? "de la nota de trama" : "del " + TIPOS[tipoActivo].nombre.toLowerCase());
      UI.pedir(titulo, "", function (nombre) {
        var f = crear(tipoActivo, nombre);
        pintar();
        abrir(f);
      });
    });
    document.getElementById("form-ficha").addEventListener("submit", alCerrarDialogo);
  }

  function icono(t) { return TIPOS[t] ? TIPOS[t].icono : "🗂️"; }

  function crear(tipo, nombre) {
    var p = Datos.proyecto();
    var f = { id: Datos.uid(), tipo: tipo, nombre: nombre, campos: {}, creadoEl: Datos.ahora() };
    p.fichas.push(f);
    Datos.guardar();
    return f;
  }

  function buscarPorNombre(tipo, nombre) {
    var p = Datos.proyecto();
    if (!p) return null;
    var n = nombre.toLowerCase();
    return p.fichas.find(function (f) { return f.tipo === tipo && f.nombre.toLowerCase() === n; }) || null;
  }

  function abrirPorId(id) {
    var p = Datos.proyecto();
    if (!p) return;
    var f = p.fichas.find(function (x) { return x.id === id; });
    if (f) abrir(f);
  }

  function abrir(f) {
    fichaEnEdicion = f;
    var d = document.getElementById("dialogo-ficha");
    document.getElementById("dialogo-ficha-titulo").textContent = icono(f.tipo) + " " + TIPOS[f.tipo].nombre;
    var cont = document.getElementById("dialogo-ficha-campos");
    cont.innerHTML = "";

    var lNombre = document.createElement("label");
    lNombre.textContent = "Nombre";
    var iNombre = document.createElement("input");
    iNombre.type = "text"; iNombre.id = "ficha-nombre"; iNombre.value = f.nombre; iNombre.required = true;
    lNombre.appendChild(iNombre);
    cont.appendChild(lNombre);

    TIPOS[f.tipo].campos.forEach(function (c) {
      var l = document.createElement("label");
      l.textContent = c[1];
      var input;
      if (c[2] === "area") { input = document.createElement("textarea"); input.rows = 2; }
      else { input = document.createElement("input"); input.type = "text"; }
      input.dataset.campo = c[0];
      input.value = f.campos[c[0]] || "";
      l.appendChild(input);
      cont.appendChild(l);
    });

    // apariciones en el texto
    if (f.tipo !== "t") {
      var btnAp = document.createElement("button");
      btnAp.type = "button";
      btnAp.className = "btn-secundario";
      btnAp.textContent = "🔎 ¿Dónde aparece en la novela?";
      btnAp.addEventListener("click", function () { Extras.verApariciones(f); });
      cont.appendChild(btnAp);
    }

    // relaciones del personaje (solo lectura, se editan en el mapa)
    if (f.tipo === "p") {
      var rels = relacionesDe(f.id);
      if (rels.length) {
        var div = document.createElement("div");
        div.innerHTML = "<b>Relaciones:</b> " + rels.join(" · ") +
          ' <span class="nota">(se editan en la pestaña Relaciones)</span>';
        div.style.fontSize = ".85rem";
        cont.appendChild(div);
      }
    }
    d.showModal();
  }

  function relacionesDe(id) {
    var p = Datos.proyecto();
    return p.relaciones.filter(function (r) { return r.deId === id || r.aId === id; })
      .map(function (r) {
        var otroId = r.deId === id ? r.aId : r.deId;
        var otro = p.fichas.find(function (f) { return f.id === otroId; });
        return (otro ? otro.nombre : "¿?") + " (" + (r.texto || r.tipo) + ")";
      });
  }

  function alCerrarDialogo(e) {
    var valor = e.submitter && e.submitter.value;
    var f = fichaEnEdicion;
    if (!f) return;
    if (valor === "guardar") {
      f.nombre = document.getElementById("ficha-nombre").value.trim() || f.nombre;
      document.querySelectorAll("#dialogo-ficha-campos [data-campo]").forEach(function (el) {
        f.campos[el.dataset.campo] = el.value;
      });
      Datos.guardar();
      pintar();
      if (window.Mapa) Mapa.pintar();
    } else if (valor === "borrar") {
      UI.confirmar("¿Enviar la ficha de «" + f.nombre + "» a la papelera?", function () {
        var p = Datos.proyecto();
        Datos.aPapelera("ficha", f, p.id);
        p.fichas = p.fichas.filter(function (x) { return x.id !== f.id; });
        p.relaciones = p.relaciones.filter(function (r) { return r.deId !== f.id && r.aId !== f.id; });
        Datos.guardar();
        pintar();
        if (window.Mapa) Mapa.pintar();
      });
    }
    fichaEnEdicion = null;
  }

  function pintar() {
    var cont = document.getElementById("lista-fichas");
    var p = Datos.proyecto();
    if (!cont || !p) return;
    cont.innerHTML = "";
    var lista = p.fichas.filter(function (f) { return f.tipo === tipoActivo; });
    if (!lista.length) {
      cont.innerHTML = '<p class="nota" style="grid-column:1/-1">Todavía no hay fichas. Créalas desde aquí o escribiendo en el editor: <b>Nombre (' + tipoActivo + ')</b>.</p>';
      return;
    }
    lista.sort(function (a, b) { return a.nombre.localeCompare(b.nombre, "es"); });
    lista.forEach(function (f) {
      var t = document.createElement("div");
      t.className = "ficha-tarjeta";
      var resumen = f.campos[TIPOS[f.tipo].campos[0][0]] || "";
      t.innerHTML = "<h4></h4><p></p>";
      t.querySelector("h4").textContent = icono(f.tipo) + " " + f.nombre;
      t.querySelector("p").textContent = resumen || "(ficha por completar)";
      t.addEventListener("click", function () { abrir(f); });
      cont.appendChild(t);
    });
  }

  function personajes() {
    var p = Datos.proyecto();
    return p ? p.fichas.filter(function (f) { return f.tipo === "p"; }) : [];
  }

  return {
    init: init, pintar: pintar, crear: crear, abrir: abrir, abrirPorId: abrirPorId,
    buscarPorNombre: buscarPorNombre, icono: icono, personajes: personajes, TIPOS: TIPOS
  };
})();
