/* ============ Línea temporal de los hechos de la novela ============ */

var Tiempo = (function () {
  var eventoEnEdicion = null;

  function init() {
    document.getElementById("btn-nuevo-evento").addEventListener("click", function () { abrirDialogo(null); });
    document.getElementById("form-evento").addEventListener("submit", alCerrarDialogo);
    document.getElementById("filtro-personaje").addEventListener("change", pintar);
  }

  function pintarFiltro() {
    var sel = document.getElementById("filtro-personaje");
    var valor = sel.value;
    sel.innerHTML = '<option value="">Todos los personajes</option>';
    Fichas.personajes().forEach(function (f) {
      var o = document.createElement("option");
      o.value = f.id; o.textContent = "👤 " + f.nombre;
      sel.appendChild(o);
    });
    sel.value = valor || "";
  }

  function pintar() {
    var cont = document.getElementById("linea-temporal");
    var p = Datos.proyecto();
    if (!cont || !p) return;
    pintarFiltro();
    cont.innerHTML = "";
    if (!p.eventos.length) {
      cont.innerHTML = '<p class="nota">Añade los hechos de tu novela en orden: qué pasa, cuándo y en qué capítulo. ' +
        'Te servirá para ver la historia entera de un vistazo y detectar huecos.</p>';
      return;
    }
    var filtro = document.getElementById("filtro-personaje").value;
    var lista = p.eventos.slice().sort(function (a, b) { return (a.orden || 0) - (b.orden || 0); });
    if (filtro) lista = lista.filter(function (ev) { return (ev.personajes || []).indexOf(filtro) >= 0; });
    if (!lista.length && filtro) {
      cont.innerHTML = '<p class="nota">Este personaje no interviene en ningún hecho todavía. Márcalo al editar cada hecho.</p>';
      return;
    }
    lista.forEach(function (ev) {
      var div = document.createElement("div");
      div.className = "lt-item";
      var cap = p.capitulos.find(function (c) { return c.id === ev.capituloId; });
      var nombres = (ev.personajes || []).map(function (id) {
        var f = p.fichas.find(function (x) { return x.id === id; });
        return f ? f.nombre : null;
      }).filter(Boolean).join(", ");
      div.innerHTML =
        '<div class="lt-momento"></div><h4></h4><p></p>' +
        '<div style="margin-top:.35rem"><span class="chip chip-' + (ev.tipo || "aventura") + '"></span> ' +
        (cap ? '<span class="nota">📖 ' + "</span>" : "") +
        (nombres ? ' <span class="nota">👤 ' + nombres + "</span>" : "") + "</div>";
      div.querySelector(".lt-momento").textContent = (ev.orden != null ? ev.orden + ". " : "") + (ev.momento || "");
      div.querySelector("h4").textContent = ev.titulo;
      div.querySelector("p").textContent = ev.detalle || "";
      div.querySelector(".chip").textContent = ev.tipo || "aventura";
      if (cap) div.querySelector(".nota").textContent = "📖 " + cap.titulo;
      div.addEventListener("click", function () { abrirDialogo(ev); });
      cont.appendChild(div);
    });
  }

  function abrirDialogo(ev) {
    eventoEnEdicion = ev;
    var p = Datos.proyecto();
    var selCap = document.getElementById("ev-capitulo");
    selCap.innerHTML = '<option value="">(ninguno)</option>';
    p.capitulos.forEach(function (c) {
      var o = document.createElement("option");
      o.value = c.id; o.textContent = c.titulo;
      selCap.appendChild(o);
    });
    var contP = document.getElementById("ev-personajes");
    contP.innerHTML = "";
    Fichas.personajes().forEach(function (f) {
      var l = document.createElement("label");
      l.className = "check-linea";
      var c = document.createElement("input");
      c.type = "checkbox"; c.value = f.id;
      c.checked = !!(ev && ev.personajes && ev.personajes.indexOf(f.id) >= 0);
      l.appendChild(c);
      l.appendChild(document.createTextNode(" " + f.nombre));
      contP.appendChild(l);
    });
    if (!Fichas.personajes().length) contP.innerHTML = "<span class='nota'>Aún no hay personajes con ficha.</span>";
    if (ev) {
      document.getElementById("ev-orden").value = ev.orden != null ? ev.orden : "";
      document.getElementById("ev-momento").value = ev.momento || "";
      document.getElementById("ev-titulo").value = ev.titulo || "";
      document.getElementById("ev-detalle").value = ev.detalle || "";
      document.getElementById("ev-tipo").value = ev.tipo || "aventura";
      selCap.value = ev.capituloId || "";
    } else {
      var maxOrden = p.eventos.reduce(function (m, e) { return Math.max(m, e.orden || 0); }, 0);
      document.getElementById("ev-orden").value = maxOrden + 1;
      document.getElementById("ev-momento").value = "";
      document.getElementById("ev-titulo").value = "";
      document.getElementById("ev-detalle").value = "";
      document.getElementById("ev-tipo").value = "aventura";
      selCap.value = "";
    }
    document.getElementById("btn-borrar-evento").style.display = ev ? "" : "none";
    document.getElementById("dialogo-evento").showModal();
  }

  function alCerrarDialogo(e) {
    var valor = e.submitter && e.submitter.value;
    var p = Datos.proyecto();
    if (valor === "guardar") {
      var datos = {
        orden: parseFloat(document.getElementById("ev-orden").value) || 0,
        momento: document.getElementById("ev-momento").value.trim(),
        titulo: document.getElementById("ev-titulo").value.trim(),
        detalle: document.getElementById("ev-detalle").value.trim(),
        capituloId: document.getElementById("ev-capitulo").value || null,
        tipo: document.getElementById("ev-tipo").value,
        personajes: Array.prototype.slice.call(document.querySelectorAll("#ev-personajes input:checked"))
          .map(function (c) { return c.value; })
      };
      if (!datos.titulo) return;
      if (eventoEnEdicion) Object.assign(eventoEnEdicion, datos);
      else { datos.id = Datos.uid(); p.eventos.push(datos); }
      Datos.guardar();
    } else if (valor === "borrar" && eventoEnEdicion) {
      Datos.aPapelera("evento", eventoEnEdicion, p.id);
      p.eventos = p.eventos.filter(function (x) { return x !== eventoEnEdicion; });
      Datos.guardar();
    }
    eventoEnEdicion = null;
    pintar();
  }

  return { init: init, pintar: pintar };
})();
