/* ============ Generador de nombres ============ */

var Nombres = (function () {

  var SILABAS = {
    epico: {
      ini: ["Al", "Ar", "Bel", "Cal", "Dar", "El", "Fen", "Gal", "Ka", "Lor", "Mar", "Nor", "Or", "Ra", "Ser", "Tal", "Ul", "Va", "Zar"],
      med: ["a", "e", "i", "o", "u", "an", "ar", "en", "ien", "or", "ad", "il", "un"],
      finM: ["dor", "gar", "ion", "mir", "nor", "rik", "ron", "th", "var", "dric", "mund"],
      finF: ["a", "ia", "ara", "iel", "ina", "wen", "ys", "eth", "ora", "isa"]
    },
    elfico: {
      ini: ["Ae", "Cel", "El", "Fae", "Gala", "Il", "Lau", "Lú", "Nim", "Sil", "Thal", "Ya"],
      med: ["la", "le", "ria", "ndi", "re", "va", "wi", "lo", "mi"],
      finM: ["rion", "las", "dir", "nor", "thir", "wë", "dil"],
      finF: ["riel", "wen", "neth", "diel", "las", "më", "sil"]
    },
    nordico: {
      ini: ["Bjor", "Ei", "Frey", "Gun", "Hal", "Ing", "Ka", "Rag", "Sig", "Thor", "Ulf", "Va"],
      med: ["", "n", "ri", "va", "ge", "dr"],
      finM: ["ar", "nir", "olf", "und", "vald", "grim", "stein"],
      finF: ["a", "dis", "hild", "run", "veig", "ny"]
    },
    oscuro: {
      ini: ["Az", "Bal", "Dre", "Gor", "Khar", "Mal", "Mor", "Nag", "Sha", "Vex", "Zor"],
      med: ["a", "ak", "go", "mo", "ra", "u", "ze"],
      finM: ["gath", "goth", "mor", "rak", "thul", "zar", "gul"],
      finF: ["a", "ith", "esh", "ura", "yx", "ara"]
    },
    hispano: {
      ini: ["Álva", "Beltrá", "Este", "Gonza", "Íñi", "Leo", "Men", "Nu", "Rodri", "San", "Teo", "Vela"],
      med: ["", "n", "l", "r"],
      finM: ["ro", "go", "n", "rdo", "lo", "ncio"],
      finF: ["ra", "na", "lda", "cia", "mena", "linda"]
    }
  };

  var LUGAR = {
    prefijos: ["Val", "Puerto", "Villa", "Monte", "Roca", "Torre", "Puente", "Cabo", "Fuente", "Castel", "Alde", "Sierra", "Isla", "Bahía", "Hondo", "Refugio"],
    nucleos: ["bruma", "escarcha", "ceniza", "plata", "espinas", "cuervos", "sal", "luna", "alba", "sombra", "hierro", "coral", "niebla", "ámbar", "viento", "fuego"],
    sufijos: ["ia", "or", "heim", "gard", "mar", "duin", "throne", "ë"]
  };

  var OBJETO = {
    bases: ["Espada", "Brújula", "Amuleto", "Anillo", "Lámpara", "Espejo", "Llave", "Corona", "Daga", "Cáliz", "Mapa", "Medallón", "Arpa", "Grimorio", "Farol", "Reloj"],
    de: ["de Ceniza", "del Alba", "de las Mareas", "de Bruma", "del Último Rey", "de Hueso", "de Plata Viva", "del Silencio", "de los Susurros", "de Escarcha", "del Bosque Hundido", "de la Reina Coral", "de Medianoche", "de las Siete Puertas"]
  };

  function alAzar(lista) { return lista[Math.floor(Math.random() * lista.length)]; }

  function nombrePersona(estilo, genero) {
    var s = SILABAS[estilo] || SILABAS.epico;
    var g = genero === "indistinto" ? (Math.random() < 0.5 ? "m" : "f") : genero;
    var fin = g === "f" ? alAzar(s.finF) : alAzar(s.finM);
    var medio = Math.random() < 0.6 ? alAzar(s.med) : "";
    var n = alAzar(s.ini) + medio + fin;
    return n.charAt(0).toUpperCase() + n.slice(1);
  }

  function nombreLugar() {
    var r = Math.random();
    if (r < 0.45) { // compuesto castellano: "Val de Bruma"
      var nexo = alAzar(["de", "de la", "del"]);
      return alAzar(LUGAR.prefijos) + " " + nexo + " " + alAzar(LUGAR.nucleos);
    }
    if (r < 0.8) { // pegado: "Rocaescarcha"
      var a = alAzar(LUGAR.prefijos), b = alAzar(LUGAR.nucleos);
      return a + b;
    }
    // exótico: "Valdoria", "Brumheim"
    var base = alAzar(LUGAR.nucleos);
    return base.charAt(0).toUpperCase() + base.slice(1) + alAzar(LUGAR.sufijos);
  }

  function nombreObjeto() {
    return alAzar(OBJETO.bases) + " " + alAzar(OBJETO.de);
  }

  function generar(tipo, estilo, genero, cuantos) {
    var res = [], intentos = 0, visto = {};
    while (res.length < (cuantos || 8) && intentos++ < 80) {
      var n = tipo === "l" ? nombreLugar() : tipo === "o" ? nombreObjeto() : nombrePersona(estilo, genero);
      if (!visto[n]) { visto[n] = true; res.push(n); }
    }
    return res;
  }

  /* ---------- Interfaz ---------- */
  function init() {
    document.querySelectorAll(".btn-generador").forEach(function (b) {
      b.addEventListener("click", abrir);
    });
    document.getElementById("gen-generar").addEventListener("click", pintarNombres);
    document.getElementById("gen-tipo").addEventListener("change", function () {
      var esP = this.value === "p";
      document.getElementById("gen-estilo").parentElement.style.display = esP ? "" : "none";
      document.getElementById("gen-genero").parentElement.style.display = esP ? "" : "none";
      pintarNombres();
    });
    document.getElementById("gen-estilo").addEventListener("change", pintarNombres);
    document.getElementById("gen-genero").addEventListener("change", pintarNombres);
  }

  function abrir() {
    document.getElementById("dialogo-nombres").showModal();
    pintarNombres();
  }

  function pintarNombres() {
    var tipo = document.getElementById("gen-tipo").value;
    var estilo = document.getElementById("gen-estilo").value;
    var genero = document.getElementById("gen-genero").value;
    var cont = document.getElementById("gen-resultados");
    cont.innerHTML = "";
    generar(tipo, estilo, genero, 10).forEach(function (n) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "gen-nombre";
      b.textContent = n;
      b.title = "Crear ficha con este nombre";
      b.addEventListener("click", function () {
        if (!Datos.proyecto()) { UI.aviso("Abre primero una novela."); return; }
        var f = Fichas.buscarPorNombre(tipo, n) || Fichas.crear(tipo, n);
        UI.aviso(Fichas.icono(tipo) + " Ficha de «" + n + "» creada. La tienes en Fichas.");
        Fichas.pintar();
      });
      cont.appendChild(b);
    });
  }

  return { init: init, generar: generar };
})();
