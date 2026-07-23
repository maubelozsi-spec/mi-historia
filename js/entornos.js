/* ============ Constructor guiado de entornos ============ */

var Entornos = (function () {

  var PREGUNTAS = [
    ["idea", "Tu idea en una frase", "«Un faro abandonado en un acantilado», «una ciudad flotante»…"],
    ["vista", "¿Qué se VE? Formas, colores, luz, tamaño…", ""],
    ["sonido", "¿Qué se OYE? ¿Y qué silencio hay?", ""],
    ["olor", "¿A qué huele? ¿Qué se saborea en el aire?", ""],
    ["tacto", "¿Qué se siente en la piel? Frío, humedad, viento…", ""],
    ["epoca", "Época, clima y momento del día", ""],
    ["emocion", "¿Qué emoción debe sentir el lector aquí?", "miedo, paz, asombro, nostalgia…"],
    ["secreto", "¿Qué esconde este lugar? ¿Qué pasó aquí?", "El truco de Tolkien y Anne Rice: el lugar tiene memoria"],
    ["cualidad", "Su cualidad dominante en UNA palabra", "El truco de Rothfuss: el silencio de la posada"],
    ["papel", "¿Qué papel juega en la trama?", ""]
  ];

  function init() {
    document.getElementById("btn-nuevo-entorno").addEventListener("click", crear);
  }

  function crear() {
    UI.pedir("Tu idea de entorno, en una frase", "", function (idea) {
      var p = Datos.proyecto();
      var ent = { id: Datos.uid(), idea: idea, campos: { idea: idea }, creadoEl: Datos.ahora() };
      p.entornos.push(ent);
      Datos.guardar();
      pintar();
      abrir(ent);
    }, "p. ej. «Un faro abandonado en un acantilado»");
  }

  function abrir(ent) {
    var d = document.getElementById("dialogo-ficha");
    document.getElementById("dialogo-ficha-titulo").textContent = "🏞️ Entorno: " + ent.idea;
    var cont = document.getElementById("dialogo-ficha-campos");
    cont.innerHTML = "";
    PREGUNTAS.forEach(function (q) {
      var l = document.createElement("label");
      l.textContent = q[1];
      if (q[2]) {
        var peq = document.createElement("div");
        peq.className = "nota"; peq.textContent = q[2];
        l.appendChild(peq);
      }
      var input = document.createElement("textarea");
      input.rows = q[0] === "idea" ? 1 : 2;
      input.dataset.campo = q[0];
      input.value = ent.campos[q[0]] || "";
      l.appendChild(input);
      cont.appendChild(l);
    });

    var form = document.getElementById("form-ficha");
    var gestor = function (e) {
      form.removeEventListener("submit", gestor, true);
      e.stopImmediatePropagation(); // evita el gestor de fichas normales
      var valor = e.submitter && e.submitter.value;
      var p = Datos.proyecto();
      if (valor === "guardar") {
        cont.querySelectorAll("[data-campo]").forEach(function (el) { ent.campos[el.dataset.campo] = el.value; });
        ent.idea = ent.campos.idea || ent.idea;
        Datos.guardar();
      } else if (valor === "borrar") {
        UI.confirmar("¿Enviar este entorno a la papelera?", function () {
          Datos.aPapelera("entorno", ent, p.id);
          p.entornos = p.entornos.filter(function (x) { return x.id !== ent.id; });
          Datos.guardar();
          pintar();
        });
      }
      pintar();
    };
    form.addEventListener("submit", gestor, true);
    d.showModal();
  }

  function pintar() {
    var cont = document.getElementById("lista-entornos");
    var p = Datos.proyecto();
    if (!cont || !p) return;
    cont.innerHTML = "";
    if (!p.entornos.length) {
      cont.innerHTML = '<p class="nota" style="grid-column:1/-1">Crea un entorno a partir de una idea y el constructor te guiará ' +
        'con las preguntas de los cinco sentidos, la emoción y el secreto del lugar. ' +
        'Cuando actives la IA, este mismo formulario se rellenará solo. ' +
        'Si el entorno es un lugar concreto de la novela, crea también su ficha con (l) en el editor.</p>';
      return;
    }
    p.entornos.forEach(function (ent) {
      var t = document.createElement("div");
      t.className = "ficha-tarjeta";
      t.innerHTML = "<h4></h4><p></p>";
      t.querySelector("h4").textContent = "🏞️ " + ent.idea;
      t.querySelector("p").textContent = ent.campos.emocion ? "Emoción: " + ent.campos.emocion : "(por desarrollar)";
      t.addEventListener("click", function () { abrir(ent); });
      cont.appendChild(t);
    });
  }

  return { init: init, pintar: pintar };
})();
