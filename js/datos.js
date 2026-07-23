/* ============ Mi Historia — capa de datos ============
   Guarda todo en localStorage y deja la interfaz preparada para
   sincronizar con Firebase (js/sync-firebase.js) cuando se configure. */

var Datos = (function () {
  var CLAVE = "miHistoria_v1";
  var CLAVE_FOTOS = "miHistoria_fotos_v1";
  var db = null;
  var tGuardado = null;

  function ahora() { return new Date().toISOString(); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  function baseDatos() {
    return {
      version: 1,
      proyectos: [],
      proyectoActivo: null,
      diario: { hash: null, entradas: [] },
      papelera: [],            // {tipo, dato, borradoEl, proyectoId}
      ajustes: { objetivoPalabras: 0, historicoDias: {} } // historicoDias: {"2026-07-23": 1250}
    };
  }

  function nuevoProyecto(nombre) {
    return {
      id: uid(), nombre: nombre, creadoEl: ahora(), actualizadoEl: ahora(),
      capitulos: [nuevoCapitulo("Capítulo 1")],
      capituloActivo: null,
      fichas: [],              // {id, tipo:'p|l|o|t', nombre, campos:{}, creadoEl}
      relaciones: [],          // {id, deId, aId, tipo, texto, doble}
      eventos: [],             // {id, orden, momento, titulo, detalle, capituloId, tipo}
      entornos: [],            // {id, idea, campos:{}, resultado}
      posicionesMapa: {}       // fichaId -> {x, y}
    };
  }

  function nuevoCapitulo(titulo) {
    return { id: uid(), titulo: titulo || "Capítulo sin título", html: "", actualizadoEl: ahora() };
  }

  function cargar() {
    try {
      var crudo = localStorage.getItem(CLAVE);
      db = crudo ? JSON.parse(crudo) : baseDatos();
    } catch (e) {
      console.error("Error cargando datos", e);
      db = baseDatos();
    }
    purgarPapelera();
    return db;
  }

  function guardar(inmediato) {
    var ind = document.getElementById("indicador-guardado");
    if (ind) { ind.classList.add("guardando"); ind.title = "Guardando…"; }
    clearTimeout(tGuardado);
    var hacer = function () {
      try {
        localStorage.setItem(CLAVE, JSON.stringify(db));
        fotoDiaria();
        if (window.Sync && Sync.activo) Sync.subir(db);
        if (ind) { ind.classList.remove("guardando"); ind.title = "Guardado"; }
      } catch (e) {
        console.error("Error guardando", e);
        if (window.UI) UI.aviso("⚠️ No se pudo guardar: " + e.message);
      }
    };
    if (inmediato) hacer(); else tGuardado = setTimeout(hacer, 600);
  }

  /* ---------- Instantáneas diarias ---------- */
  function hoy() { return new Date().toISOString().slice(0, 10); }

  function fotoDiaria() {
    try {
      var fotos = JSON.parse(localStorage.getItem(CLAVE_FOTOS) || "{}");
      fotos[hoy()] = JSON.stringify(db); // se sobrescribe la del día: última versión del día
      var fechas = Object.keys(fotos).sort();
      while (fechas.length > 15) { delete fotos[fechas.shift()]; } // máx. 15 días
      localStorage.setItem(CLAVE_FOTOS, JSON.stringify(fotos));
    } catch (e) { /* si no cabe, la app sigue funcionando */ }
  }

  function listaFotos() {
    try {
      var fotos = JSON.parse(localStorage.getItem(CLAVE_FOTOS) || "{}");
      return Object.keys(fotos).sort().reverse();
    } catch (e) { return []; }
  }

  function restaurarFoto(fecha) {
    var fotos = JSON.parse(localStorage.getItem(CLAVE_FOTOS) || "{}");
    if (!fotos[fecha]) return false;
    db = JSON.parse(fotos[fecha]);
    guardar(true);
    return true;
  }

  /* ---------- Papelera (30 días) ---------- */
  function aPapelera(tipo, dato, proyectoId) {
    db.papelera.push({ id: uid(), tipo: tipo, dato: dato, proyectoId: proyectoId || null, borradoEl: ahora() });
    guardar();
  }

  function purgarPapelera() {
    var limite = Date.now() - 30 * 24 * 60 * 60 * 1000;
    db.papelera = (db.papelera || []).filter(function (p) {
      return new Date(p.borradoEl).getTime() > limite;
    });
  }

  function restaurarDePapelera(id) {
    var i = db.papelera.findIndex(function (p) { return p.id === id; });
    if (i < 0) return false;
    var p = db.papelera[i];
    var proy = db.proyectos.find(function (x) { return x.id === p.proyectoId; });
    if (p.tipo === "proyecto") db.proyectos.push(p.dato);
    else if (!proy) return false;
    else if (p.tipo === "capitulo") proy.capitulos.push(p.dato);
    else if (p.tipo === "ficha") proy.fichas.push(p.dato);
    else if (p.tipo === "evento") proy.eventos.push(p.dato);
    else if (p.tipo === "entorno") proy.entornos.push(p.dato);
    else if (p.tipo === "entrada") db.diario.entradas.push(p.dato);
    db.papelera.splice(i, 1);
    guardar();
    return true;
  }

  /* ---------- Proyecto activo ---------- */
  function proyecto() {
    return db.proyectos.find(function (p) { return p.id === db.proyectoActivo; }) || null;
  }

  /* ---------- Objetivo y racha ---------- */
  function registrarPalabrasHoy(total) {
    db.ajustes.historicoDias[hoy()] = total;
  }

  function racha() {
    var obj = db.ajustes.objetivoPalabras;
    if (!obj) return 0;
    var n = 0, d = new Date();
    for (;;) {
      var clave = d.toISOString().slice(0, 10);
      var escrito = db.ajustes.historicoDias[clave] || 0;
      if (escrito >= obj) { n++; d.setDate(d.getDate() - 1); }
      else if (clave === hoy()) { d.setDate(d.getDate() - 1); } // hoy aún no cuenta en contra
      else break;
    }
    return n;
  }

  return {
    cargar: cargar, guardar: guardar, uid: uid, ahora: ahora, hoy: hoy,
    get db() { return db; },
    nuevoProyecto: nuevoProyecto, nuevoCapitulo: nuevoCapitulo, proyecto: proyecto,
    aPapelera: aPapelera, restaurarDePapelera: restaurarDePapelera,
    listaFotos: listaFotos, restaurarFoto: restaurarFoto,
    registrarPalabrasHoy: registrarPalabrasHoy, racha: racha
  };
})();
