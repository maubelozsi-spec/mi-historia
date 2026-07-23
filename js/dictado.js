/* ============ Dictado con Web Speech (es-ES) ============ */

var Dictado = (function () {
  var rec = null;
  var grabando = false;
  var botonActivo = null;
  var raizActiva = null;      // #editor o #editor-diario
  var ultimoInsertado = "";   // para «borrar eso»
  var elEstado;

  var Reconocimiento = window.SpeechRecognition || window.webkitSpeechRecognition;

  function init() {
    elEstado = document.getElementById("estado-dictado");
    var btn = document.getElementById("btn-dictar");
    var btnD = document.getElementById("btn-dictar-diario");
    if (!Reconocimiento) {
      [btn, btnD].forEach(function (b) {
        if (b) { b.disabled = true; b.title = "Este navegador no soporta dictado. Usa Chrome (PC) o Chrome/teclado de Google (Android)."; b.style.opacity = .4; }
      });
      return;
    }
    btn.addEventListener("click", function () { alternar(btn, document.getElementById("editor")); });
    if (btnD) btnD.addEventListener("click", function () { alternar(btnD, document.getElementById("editor-diario")); });
  }

  function alternar(boton, raiz) {
    if (grabando) { parar(); return; }
    empezar(boton, raiz);
  }

  function empezar(boton, raiz) {
    rec = new Reconocimiento();
    rec.lang = "es-ES";
    rec.continuous = true;
    rec.interimResults = true;

    botonActivo = boton;
    raizActiva = raiz;
    grabando = true;
    boton.classList.add("grabando");
    estado("🎙️ Escuchando… habla con naturalidad. Pulsa otra vez para parar.");

    var textoSeleccionado = window.getSelection().toString().length > 0;
    if (textoSeleccionado) estado("🎙️ Escuchando… lo que digas SUSTITUIRÁ el texto seleccionado.");

    rec.onresult = function (e) {
      var finales = "";
      for (var i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finales += e.results[i][0].transcript;
      }
      if (finales.trim()) procesar(finales.trim());
    };
    rec.onerror = function (e) {
      if (e.error === "not-allowed") estado("⚠️ Permiso de micrófono denegado. Actívalo en el candado de la barra de direcciones.");
      else if (e.error === "no-speech") estado("No te oigo… ¿está el micrófono activo?");
      else estado("⚠️ Error de dictado: " + e.error);
    };
    rec.onend = function () {
      if (grabando) { try { rec.start(); } catch (err) { pararVisual(); } } // se reinicia solo (Chrome corta cada ~60 s)
      else pararVisual();
    };
    try { rec.start(); } catch (e) { estado("⚠️ No se pudo iniciar el dictado."); pararVisual(); }
  }

  function parar() {
    grabando = false;
    if (rec) try { rec.stop(); } catch (e) {}
    pararVisual();
  }

  function pararVisual() {
    grabando = false;
    if (botonActivo) botonActivo.classList.remove("grabando");
    estado("");
  }

  function estado(t) {
    if (elEstado) elEstado.textContent = t;
    if (raizActiva && raizActiva.id === "editor-diario") UI.aviso(t || "Dictado parado", t ? 2500 : 1200);
  }

  /* ---------- Procesado de comandos hablados ---------- */
  var COMANDOS_ENTIDAD = [
    { re: /abrir par[eé]ntesis\s+(pe|p)\s+cerrar par[eé]ntesis/gi, sal: " (p) " },
    { re: /abrir par[eé]ntesis\s+(ele|l)\s+cerrar par[eé]ntesis/gi, sal: " (l) " },
    { re: /abrir par[eé]ntesis\s+(o|u)\s+cerrar par[eé]ntesis/gi, sal: " (o) " },
    { re: /abrir par[eé]ntesis\s+(te|t)\s+cerrar par[eé]ntesis/gi, sal: " (t) " }
  ];

  var PUNTUACION = [
    { re: /\bpunto y aparte\b/gi, sal: "¶" },       // marcador de párrafo
    { re: /\bpunto y seguido\b/gi, sal: ". " },
    { re: /\bpunto y coma\b/gi, sal: "; " },
    { re: /\bnueva l[ií]nea\b/gi, sal: "¶" },
    { re: /\bdos puntos\b/gi, sal: ": " },
    { re: /\bpuntos suspensivos\b/gi, sal: "… " },
    { re: /\bcoma\b/gi, sal: ", " },
    { re: /\bpunto\b/gi, sal: ". " },
    { re: /\bsigno de interrogaci[oó]n\b/gi, sal: "? " },
    { re: /\babrir interrogaci[oó]n\b/gi, sal: " ¿" },
    { re: /\bsigno de exclamaci[oó]n\b/gi, sal: "! " },
    { re: /\babrir exclamaci[oó]n\b/gi, sal: " ¡" },
    { re: /\bcerrar comillas\b/gi, sal: "» " },
    { re: /\bcomillas\b/gi, sal: " «" },
    { re: /\braya de di[aá]logo\b/gi, sal: "¶— " },
    { re: /\bgui[oó]n\b/gi, sal: "-" }
  ];

  function procesar(texto) {
    // «borrar eso»: deshace la última inserción dictada
    if (/^borra(r)? eso\.?$/i.test(texto.trim())) {
      borrarUltimo();
      return;
    }
    var t = " " + texto + " ";
    COMANDOS_ENTIDAD.forEach(function (c) { t = t.replace(c.re, c.sal); });
    PUNTUACION.forEach(function (c) { t = t.replace(c.re, c.sal); });
    t = t.replace(/\s+([.,;:!?»])/g, "$1").replace(/\s{2,}/g, " ");

    // mayúscula tras punto o al empezar párrafo
    t = t.replace(/([.!?…]\s+|¶\s*—?\s*|^\s*)([a-záéíóúüñ])/g, function (m, a, b) { return a + b.toUpperCase(); });

    var partes = t.split("¶");
    partes.forEach(function (parte, i) {
      if (i > 0) Editor.insertarParrafo(raizActiva);
      if (parte.trim() || parte === " ") Editor.insertarTexto(ajustarEspacio(parte), raizActiva);
    });
    ultimoInsertado = texto;
    Editor.detectarComandos(raizActiva);
  }

  function ajustarEspacio(t) {
    // evita dobles espacios al encadenar dictados
    return t.replace(/^\s+/, " ").replace(/\s+$/, " ");
  }

  function borrarUltimo() {
    if (!ultimoInsertado || !raizActiva) return;
    var html = raizActiva.innerHTML;
    var plano = ultimoInsertado.replace(/\s+/g, " ").trim();
    var idx = raizActiva.textContent.lastIndexOf(plano.slice(0, 30));
    if (idx < 0) { UI.aviso("No encuentro la última frase para borrarla."); return; }
    // borrado simple sobre el texto del último nodo
    var sel = window.getSelection();
    var r = document.createRange();
    r.selectNodeContents(raizActiva);
    sel.removeAllRanges(); sel.addRange(r);
    // recorta usando texto plano: sustituye la última coincidencia
    var texto = raizActiva.innerText;
    var pos = texto.lastIndexOf(plano);
    if (pos >= 0) {
      raizActiva.innerText = texto.slice(0, pos) + texto.slice(pos + plano.length);
      UI.aviso("Última frase dictada borrada.");
      if (raizActiva.id === "editor") Editor.actualizarContador();
    }
    sel.removeAllRanges();
    ultimoInsertado = "";
    if (window.Diario && raizActiva.id === "editor-diario") Diario.alEscribir();
  }

  return { init: init, get grabando() { return grabando; }, parar: parar };
})();
