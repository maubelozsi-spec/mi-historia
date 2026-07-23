/* ============ Herramientas extra: lectura, estados, recortes, estilo,
   ficha de novela, bandeja de ideas y apariciones de personajes ============ */

var Extras = (function () {

  var ESTADOS = ["borrador", "revision", "terminado"];
  var ESTADO_TXT = { borrador: "📝 Borrador", revision: "🔍 En revisión", terminado: "✅ Terminado" };

  function init() {
    document.getElementById("btn-mas").addEventListener("click", function () {
      actualizarMenu();
      document.getElementById("dialogo-mas").showModal();
    });
    document.getElementById("mas-leer").addEventListener("click", function () { cerrarMas(); Lectura.alternar(); });
    document.getElementById("mas-estado").addEventListener("click", function () { cambiarEstado(); });
    document.getElementById("mas-recorte").addEventListener("click", function () { cerrarMas(); guardarRecorte(); });
    document.getElementById("mas-recortes").addEventListener("click", function () { cerrarMas(); abrirRecortes(); });
    document.getElementById("mas-estilo").addEventListener("click", function () { cerrarMas(); chequeoEstilo(); });
    document.getElementById("mas-novela").addEventListener("click", function () { cerrarMas(); abrirFichaNovela(); });

    document.getElementById("form-novela").addEventListener("submit", guardarFichaNovela);
    document.getElementById("btn-idea").addEventListener("click", function () {
      document.getElementById("idea-texto").value = "";
      document.getElementById("dialogo-idea").showModal();
    });
    document.getElementById("form-idea").addEventListener("submit", guardarIdea);
  }

  function cerrarMas() { document.getElementById("dialogo-mas").close(); }

  /* ---------- Estado del capítulo ---------- */
  function actualizarMenu() {
    var cap = Editor.capActual();
    document.getElementById("mas-estado-texto").textContent = cap ? (ESTADO_TXT[cap.estado] || ESTADO_TXT.borrador) : "—";
  }

  function cambiarEstado() {
    var cap = Editor.capActual();
    if (!cap) return;
    var i = ESTADOS.indexOf(cap.estado || "borrador");
    cap.estado = ESTADOS[(i + 1) % ESTADOS.length];
    cap.actualizadoEl = Datos.ahora();
    Datos.guardar();
    Editor.pintarLista();
    actualizarMenu();
  }

  /* ---------- Lectura en voz alta ---------- */
  var Lectura = {
    hablando: false,
    alternar: function () {
      if (!("speechSynthesis" in window)) { UI.aviso("Este navegador no puede leer en voz alta."); return; }
      if (Lectura.hablando) { speechSynthesis.cancel(); Lectura.hablando = false; UI.aviso("⏹ Lectura detenida."); return; }
      var sel = window.getSelection().toString().trim();
      var texto = sel || document.getElementById("editor").innerText.trim();
      if (!texto) { UI.aviso("No hay nada que leer en este capítulo."); return; }
      var u = new SpeechSynthesisUtterance(texto);
      u.lang = "es-ES";
      var voz = speechSynthesis.getVoices().filter(function (v) { return v.lang && v.lang.indexOf("es") === 0; })[0];
      if (voz) u.voice = voz;
      u.onend = function () { Lectura.hablando = false; };
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
      Lectura.hablando = true;
      UI.aviso("🔊 Leyendo" + (sel ? " la selección" : " el capítulo") + "… Para parar: ⋯ → Leer en voz alta.", 4500);
    }
  };

  /* ---------- Banco de recortes ---------- */
  function guardarRecorte() {
    var p = Datos.proyecto();
    if (!p) return;
    var sel = window.getSelection();
    var texto = sel.toString().trim();
    if (!texto) { UI.aviso("Selecciona primero el texto que quieras guardar como recorte."); return; }
    if (!p.recortes) p.recortes = [];
    var cap = Editor.capActual();
    p.recortes.push({ id: Datos.uid(), texto: texto, origen: cap ? cap.titulo : "", fecha: Datos.ahora() });
    sel.deleteFromDocument();
    document.getElementById("editor").dispatchEvent(new Event("input"));
    UI.aviso("✂️ Recorte guardado. Lo tienes en ⋯ → Banco de recortes (" + p.recortes.length + ").");
  }

  function abrirRecortes() {
    var p = Datos.proyecto();
    if (!p) return;
    var cuerpo = document.getElementById("panel-cuerpo");
    document.getElementById("panel-titulo").textContent = "📎 Banco de recortes";
    cuerpo.innerHTML = "";
    if (!p.recortes || !p.recortes.length) {
      cuerpo.innerHTML = "<p class='nota'>Aún no hay recortes. Cuando cortes un párrafo que duela borrar, selecciónalo y usa ⋯ → «Guardar la selección como recorte».</p>";
    }
    (p.recortes || []).slice().reverse().forEach(function (r) {
      var div = document.createElement("div");
      div.className = "recorte";
      div.innerHTML = "<p class='recorte-texto'></p><p class='nota'></p>" +
        "<button class='btn-secundario btn-ins'>Insertar en el capítulo</button> " +
        "<button class='btn-peligro btn-borra'>Borrar</button>";
      div.querySelector(".recorte-texto").textContent = r.texto.length > 300 ? r.texto.slice(0, 300) + "…" : r.texto;
      div.querySelector(".nota").textContent = (r.origen ? "De «" + r.origen + "» · " : "") + new Date(r.fecha).toLocaleDateString("es-ES");
      div.querySelector(".btn-ins").addEventListener("click", function () {
        document.getElementById("dialogo-panel").close();
        Editor.insertarTexto(" " + r.texto + " ");
        UI.aviso("Recorte insertado (sigue también en el banco).");
      });
      div.querySelector(".btn-borra").addEventListener("click", function () {
        p.recortes = p.recortes.filter(function (x) { return x.id !== r.id; });
        Datos.guardar();
        abrirRecortes();
      });
      cuerpo.appendChild(div);
    });
    document.getElementById("dialogo-panel").showModal();
  }

  /* ---------- Chequeo de estilo ---------- */
  var VACIAS = ("el la los las un una unos unas y o u de del al a en que se su sus con por para no sí si es era fue son eran ser estar " +
    "lo le les me te nos os mi tu como más pero cuando donde quien cuyo esta este esto esa ese eso aquella aquel ya muy también aunque " +
    "entre sobre hasta desde había ha he has hay tan sin porque él ella ellos ellas yo tú nosotros vosotros uno dos tres había estaba").split(" ");

  function chequeoEstilo() {
    var cap = Editor.capActual();
    if (!cap) return;
    var texto = document.getElementById("editor").innerText.replace(/\s+/g, " ").trim();
    if (!texto) { UI.aviso("El capítulo está vacío."); return; }

    var frases = texto.split(/[.!?…]+\s*/).filter(function (f) { return f.trim(); });
    var largas = frases.filter(function (f) { return f.trim().split(/\s+/).length > 40; });

    var palabras = texto.toLowerCase().replace(/[^\wáéíóúüñ\s'-]/g, " ").split(/\s+/).filter(Boolean);
    var mente = palabras.filter(function (p) { return /mente$/.test(p) && p.length > 7; });

    // repetidas cerca (misma palabra de contenido 2+ veces en 50 palabras)
    var repes = {}, pos = {};
    palabras.forEach(function (p, i) {
      if (p.length < 4 || VACIAS.indexOf(p) >= 0) return;
      if (pos[p] !== undefined && i - pos[p] <= 50) repes[p] = (repes[p] || 1) + 1;
      pos[p] = i;
    });
    var listaRepes = Object.keys(repes).sort(function (a, b) { return repes[b] - repes[a]; }).slice(0, 12);

    // frecuencias generales
    var frec = {};
    palabras.forEach(function (p) { if (p.length >= 4 && VACIAS.indexOf(p) < 0) frec[p] = (frec[p] || 0) + 1; });
    var top = Object.keys(frec).filter(function (p) { return frec[p] >= 4; })
      .sort(function (a, b) { return frec[b] - frec[a]; }).slice(0, 10);

    var html = "<p class='nota'>" + palabras.length + " palabras · " + frases.length + " frases · " +
      Math.round(palabras.length / Math.max(frases.length, 1)) + " palabras por frase de media</p>";

    html += "<h5>🔁 Repetidas muy cerca (a menos de 50 palabras)</h5>";
    html += listaRepes.length
      ? "<p>" + listaRepes.map(function (p) { return "<b>" + p + "</b> (" + repes[p] + ")"; }).join(" · ") + "</p>"
      : "<p class='nota'>Nada llamativo. 👏</p>";

    html += "<h5>🐌 Frases de más de 40 palabras (" + largas.length + ")</h5>";
    html += largas.length
      ? largas.slice(0, 5).map(function (f) { return "<p class='nota'>«" + f.trim().slice(0, 140) + "…»</p>"; }).join("")
      : "<p class='nota'>Ninguna. Buen ritmo.</p>";

    html += "<h5>⚠️ Adverbios en «-mente» (" + mente.length + ")</h5>";
    html += mente.length
      ? "<p>" + mente.join(", ") + "</p><p class='nota'>King los llama «el camino del infierno». Uno de vez en cuando vale; racimos, no.</p>"
      : "<p class='nota'>Limpio.</p>";

    html += "<h5>📊 Tus palabras más usadas del capítulo</h5>";
    html += top.length
      ? "<p>" + top.map(function (p) { return p + " (" + frec[p] + ")"; }).join(" · ") + "</p>"
      : "<p class='nota'>Sin repeticiones destacables.</p>";

    document.getElementById("panel-titulo").textContent = "🩺 Chequeo de estilo — " + cap.titulo;
    document.getElementById("panel-cuerpo").innerHTML = html;
    document.getElementById("dialogo-panel").showModal();
  }

  /* ---------- Ficha de la novela ---------- */
  function abrirFichaNovela() {
    var p = Datos.proyecto();
    if (!p) return;
    if (!p.info) p.info = {};
    document.getElementById("nov-premisa").value = p.info.premisa || "";
    document.getElementById("nov-sinopsis").value = p.info.sinopsis || "";
    document.getElementById("nov-genero").value = p.info.genero || "";
    document.getElementById("nov-final").value = p.info.final || "";
    document.getElementById("dialogo-novela").showModal();
  }

  function guardarFichaNovela(e) {
    if (!(e.submitter && e.submitter.value === "guardar")) return;
    var p = Datos.proyecto();
    if (!p) return;
    p.info = {
      premisa: document.getElementById("nov-premisa").value.trim(),
      sinopsis: document.getElementById("nov-sinopsis").value.trim(),
      genero: document.getElementById("nov-genero").value.trim(),
      final: document.getElementById("nov-final").value.trim()
    };
    Datos.guardar();
    UI.aviso("📋 Ficha de la novela guardada. Tu norte, por escrito.");
  }

  /* ---------- Bandeja de ideas ---------- */
  function guardarIdea(e) {
    if (!(e.submitter && e.submitter.value === "guardar")) return;
    var texto = document.getElementById("idea-texto").value.trim();
    if (!texto) return;
    if (!Datos.db.ideas) Datos.db.ideas = [];
    Datos.db.ideas.push({ id: Datos.uid(), texto: texto, fecha: Datos.ahora() });
    Datos.guardar();
    pintarIdeas();
    UI.aviso("💡 Idea guardada.");
  }

  function pintarIdeas() {
    var cont = document.getElementById("lista-ideas");
    if (!cont) return;
    cont.innerHTML = "";
    var ideas = Datos.db.ideas || [];
    ideas.slice().reverse().forEach(function (idea) {
      var div = document.createElement("div");
      div.className = "idea-tarjeta";
      div.innerHTML = "<p class='idea-texto'></p><div class='idea-acciones'>" +
        "<span class='nota'></span>" +
        "<button class='btn-icono btn-a-trama' title='Convertir en nota de trama'>🧵</button>" +
        "<button class='btn-icono btn-borra' title='Borrar'>🗑</button></div>";
      div.querySelector(".idea-texto").textContent = "💡 " + idea.texto;
      div.querySelector(".nota").textContent = new Date(idea.fecha).toLocaleDateString("es-ES");
      div.querySelector(".btn-a-trama").addEventListener("click", function () {
        var p = Datos.proyecto() || Datos.db.proyectos[0];
        if (!p) { UI.aviso("Crea primero una novela."); return; }
        p.fichas.push({ id: Datos.uid(), tipo: "t", nombre: idea.texto.slice(0, 50), campos: { notas: idea.texto }, creadoEl: Datos.ahora() });
        Datos.db.ideas = Datos.db.ideas.filter(function (x) { return x.id !== idea.id; });
        Datos.guardar();
        pintarIdeas();
        UI.aviso("🧵 Convertida en nota de trama de «" + p.nombre + "».");
      });
      div.querySelector(".btn-borra").addEventListener("click", function () {
        Datos.db.ideas = Datos.db.ideas.filter(function (x) { return x.id !== idea.id; });
        Datos.guardar();
        pintarIdeas();
      });
      cont.appendChild(div);
    });
  }

  /* ---------- Apariciones de un personaje/lugar/objeto ---------- */
  function apariciones(ficha) {
    var p = Datos.proyecto();
    var res = [];
    var nombre = ficha.nombre.toLowerCase();
    p.capitulos.forEach(function (cap) {
      var texto = (cap.html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
      texto.split(/(?<=[.!?…])\s+/).forEach(function (frase) {
        if (frase.toLowerCase().indexOf(nombre) >= 0) res.push({ capitulo: cap, frase: frase.trim() });
      });
    });
    return res;
  }

  function verApariciones(ficha) {
    var lista = apariciones(ficha);
    document.getElementById("panel-titulo").textContent = "🔎 «" + ficha.nombre + "» aparece " +
      (lista.length === 1 ? "1 vez" : lista.length + " veces");
    var cuerpo = document.getElementById("panel-cuerpo");
    cuerpo.innerHTML = lista.length ? "" : "<p class='nota'>Todavía no aparece en el texto.</p>";
    var capAnterior = null;
    lista.forEach(function (a) {
      if (a.capitulo !== capAnterior) {
        capAnterior = a.capitulo;
        var h = document.createElement("h5");
        h.textContent = "📖 " + a.capitulo.titulo;
        h.style.cursor = "pointer";
        h.title = "Abrir este capítulo";
        h.addEventListener("click", function () {
          document.getElementById("dialogo-panel").close();
          document.getElementById("dialogo-ficha").close();
          App.mostrarVista("escribir");
          Editor.abrirCapitulo(a.capitulo.id);
        });
        cuerpo.appendChild(h);
      }
      var pEl = document.createElement("p");
      pEl.className = "nota";
      pEl.textContent = "«" + (a.frase.length > 180 ? a.frase.slice(0, 180) + "…" : a.frase) + "»";
      cuerpo.appendChild(pEl);
    });
    document.getElementById("dialogo-panel").showModal();
  }

  return { init: init, pintarIdeas: pintarIdeas, verApariciones: verApariciones, Lectura: Lectura };
})();
