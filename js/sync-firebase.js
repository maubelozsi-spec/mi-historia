/* ============ Sincronización con Firebase (Auth + Firestore) ============
   Estructura en Firestore (todo bajo el usuario, protegido por reglas):
     usuarios/{uid}/proyectos/{pid}   → proyecto sin capítulos (+ capitulosIds)
     usuarios/{uid}/capitulos/{cid}   → {proyectoId, titulo, html, actualizadoEl}
     usuarios/{uid}/entradas/{id}     → entrada del diario
     usuarios/{uid}/meta/global       → ajustes, hash del diario, marca de tiempo
   Estrategia: gana la versión más reciente (marca de tiempo por documento);
   en el día a día se suben solo los documentos que cambian. */

var Sync = (function () {
  var VERSION_SDK = "10.12.2";
  var fs = null, uid = null;
  var activo = false;        // sesión iniciada y primera fusión hecha
  var aplicando = false;     // estamos aplicando datos remotos (no re-subir)
  var cache = {};            // ruta -> JSON de la última versión conocida en la nube
  var timerSubida = null;
  var listeners = [];

  var CLAVE_IDS = "miHistoria_sync_ids"; // ids ya vistos: distingue "nuevo remoto" de "borrado local"

  /* ---------- Utilidades ---------- */
  function estadoUI(texto, conBoton) {
    var el = document.getElementById("estado-sync");
    if (el) el.textContent = texto;
    var tarjeta = document.getElementById("texto-sync");
    if (tarjeta) tarjeta.textContent = texto;
    pintarBoton(conBoton);

    // icono de nube en la cabecera: siempre visible cuando hay Firebase configurado
    var nube = document.getElementById("indicador-nube");
    if (nube && window.FIREBASE_CONFIG) {
      nube.classList.remove("oculto");
      if (conBoton === "salir") {
        nube.textContent = "☁️";
        nube.title = "Sincronizado con tu nube";
        nube.classList.remove("nube-aviso");
      } else {
        nube.textContent = "⚠️";
        nube.title = "SIN sesión de nube: lo que escribas queda solo en este dispositivo. Entra con Google en la pantalla de inicio.";
        nube.classList.add("nube-aviso");
      }
    }
  }

  function pintarBoton(modo) { // "entrar" | "salir" | null
    ["tarjeta-sync", "sync-inicio"].forEach(function (idCont) {
      var cont = document.getElementById(idCont);
      if (!cont) return;
      var btn = cont.querySelector(".btn-sync-sesion");
      if (!btn) {
        btn = document.createElement("button");
        btn.className = "btn-sync-sesion btn-primario";
        cont.appendChild(btn);
        btn.addEventListener("click", function () {
          if (btn.dataset.modo === "entrar") entrar();
          else salir();
        });
      }
      if (!modo) { btn.style.display = "none"; return; }
      btn.style.display = "";
      btn.dataset.modo = modo;
      btn.textContent = modo === "entrar" ? "🔑 Acceder con Google" : "Cerrar sesión de la nube";
    });
  }

  function idsVistos() {
    try { return JSON.parse(localStorage.getItem(CLAVE_IDS) || "{}"); } catch (e) { return {}; }
  }
  function guardarIdsVistos(m) { localStorage.setItem(CLAVE_IDS, JSON.stringify(m)); }

  function cargarSdk(cb) {
    var base = "https://www.gstatic.com/firebasejs/" + VERSION_SDK + "/";
    var archivos = ["firebase-app-compat.js", "firebase-auth-compat.js", "firebase-firestore-compat.js"];
    var i = 0;
    (function siguiente() {
      if (i >= archivos.length) return cb(true);
      var s = document.createElement("script");
      s.src = base + archivos[i++];
      s.onload = siguiente;
      s.onerror = function () { cb(false); };
      document.head.appendChild(s);
    })();
  }

  /* ---------- Modelo: separar la base local en documentos ---------- */
  function separar(db) {
    var docs = {}; // ruta relativa -> objeto
    db.proyectos.forEach(function (p) {
      var copia = {};
      Object.keys(p).forEach(function (k) { if (k !== "capitulos") copia[k] = p[k]; });
      copia.capitulosIds = p.capitulos.map(function (c) { return c.id; });
      docs["proyectos/" + p.id] = copia;
      p.capitulos.forEach(function (c) {
        docs["capitulos/" + c.id] = { proyectoId: p.id, id: c.id, titulo: c.titulo, html: c.html, estado: c.estado || "borrador", actualizadoEl: c.actualizadoEl };
      });
    });
    db.diario.entradas.forEach(function (e) {
      docs["entradas/" + e.id] = e;
    });
    docs["meta/global"] = {
      ajustes: db.ajustes,
      diarioHash: db.diario.hash,
      diarioPista: db.diario.pista || null,
      ideas: db.ideas || [],
      proyectoActivo: db.proyectoActivo,
      actualizadoEl: db.metaActualizadoEl || ""
    };
    return docs;
  }

  /* ---------- Reconstruir la base local desde documentos ---------- */
  function reconstruir(docs) {
    var db = Datos.db;
    var proyectos = [], capsPorId = {};
    Object.keys(docs).forEach(function (ruta) {
      if (ruta.indexOf("capitulos/") === 0) capsPorId[docs[ruta].id] = docs[ruta];
    });
    Object.keys(docs).forEach(function (ruta) {
      if (ruta.indexOf("proyectos/") !== 0) return;
      var d = docs[ruta];
      var p = {};
      Object.keys(d).forEach(function (k) { if (k !== "capitulosIds") p[k] = d[k]; });
      p.capitulos = (d.capitulosIds || []).map(function (cid) {
        var c = capsPorId[cid];
        return c ? { id: c.id, titulo: c.titulo, html: c.html, estado: c.estado || "borrador", actualizadoEl: c.actualizadoEl } : null;
      }).filter(Boolean);
      if (!p.capitulos.length) p.capitulos = [Datos.nuevoCapitulo("Capítulo 1")];
      proyectos.push(p);
    });
    db.proyectos = proyectos;
    db.diario.entradas = Object.keys(docs).filter(function (r) { return r.indexOf("entradas/") === 0; })
      .map(function (r) { return docs[r]; });
    var meta = docs["meta/global"];
    if (meta) {
      db.ajustes = meta.ajustes || db.ajustes;
      db.diario.hash = meta.diarioHash || db.diario.hash;
      db.diario.pista = meta.diarioPista || db.diario.pista;
      db.ideas = meta.ideas || db.ideas || [];
      db.metaActualizadoEl = meta.actualizadoEl;
      if (meta.proyectoActivo && proyectos.some(function (p) { return p.id === meta.proyectoActivo; })) {
        db.proyectoActivo = db.proyectoActivo || meta.proyectoActivo;
      }
    }
  }

  /* ---------- Arranque ---------- */
  function init() {
    if (!window.FIREBASE_CONFIG) {
      estadoUI("Sincronización en la nube: pendiente de configurar.", null);
      return;
    }
    cargarSdk(function (ok) {
      if (!ok) { estadoUI("Sin conexión con la nube ahora mismo; se guarda en el dispositivo.", null); return; }
      firebase.initializeApp(FIREBASE_CONFIG);
      fs = firebase.firestore();
      firebase.auth().onAuthStateChanged(function (user) {
        if (user) {
          uid = user.uid;
          estadoUI("Conectando con tu nube…", null);
          fusionInicial().then(function () {
            activo = true;
            escuchar();
            estadoUI("☁️ Sincronizado como " + (user.displayName || user.email) + ".", "salir");
            subir(Datos.db); // empuja lo pendiente
            if (window.App) App.refrescarTodo();
          }).catch(function (e) {
            console.error(e);
            estadoUI("⚠️ No se pudo sincronizar: " + e.message, "salir");
          });
        } else {
          activo = false; uid = null;
          estadoUI("Nube configurada. Accede con Google para sincronizar tus dispositivos.", "entrar");
        }
      });
    });
  }

  function entrar() {
    var prov = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithPopup(prov).catch(function (e) {
      if (e && e.code === "auth/popup-blocked") firebase.auth().signInWithRedirect(prov);
      else UI.aviso("⚠️ No se pudo acceder: " + e.message);
    });
  }

  function salir() {
    firebase.auth().signOut();
    activo = false;
    detener();
    estadoUI("Sesión de nube cerrada. Los cambios quedan solo en este dispositivo.", "entrar");
  }

  /* ---------- Primera fusión: gana el más reciente por documento ---------- */
  function ref(ruta) {
    var partes = ruta.split("/");
    return fs.collection("usuarios").doc(uid).collection(partes[0]).doc(partes[1]);
  }

  function fusionInicial() {
    var col = function (n) { return fs.collection("usuarios").doc(uid).collection(n).get(); };
    return Promise.all([col("proyectos"), col("capitulos"), col("entradas"), col("meta")]).then(function (res) {
      var remotos = {};
      ["proyectos", "capitulos", "entradas", "meta"].forEach(function (n, i) {
        res[i].forEach(function (d) { remotos[n + "/" + d.id] = d.data(); });
      });
      var locales = separar(Datos.db);
      var vistos = idsVistos();
      var finales = {};

      // decide documento a documento
      var rutas = {};
      Object.keys(remotos).forEach(function (r) { rutas[r] = 1; });
      Object.keys(locales).forEach(function (r) { rutas[r] = 1; });
      Object.keys(rutas).forEach(function (ruta) {
        var loc = locales[ruta], rem = remotos[ruta];
        if (loc && rem) {
          var tLoc = (loc.actualizadoEl || loc.fecha || "");
          var tRem = (rem.actualizadoEl || rem.fecha || "");
          finales[ruta] = tRem > tLoc ? rem : loc;
        } else if (rem && !loc) {
          // Solo existe en la nube: SIEMPRE se restaura en este dispositivo.
          // (Nunca borramos la nube en la fusión inicial: si un dispositivo
          // pierde sus datos locales, la nube es el salvavidas, no al revés.
          // Los borrados hechos a propósito se propagan solo en vivo.)
          finales[ruta] = rem;
        } else {
          finales[ruta] = loc; // solo local: se subirá
        }
      });

      // aplica localmente
      aplicando = true;
      var docsLocales = {};
      Object.keys(finales).forEach(function (r) { if (finales[r]) docsLocales[r] = finales[r]; });
      reconstruir(docsLocales);
      Datos.guardar(true);
      aplicando = false;

      // sube diferencias (en la fusión inicial nunca se borra nada de la nube)
      var lote = fs.batch(), cambios = 0;
      Object.keys(finales).forEach(function (ruta) {
        var f = finales[ruta];
        if (!f) return;
        var json = JSON.stringify(f);
        if (JSON.stringify(remotos[ruta]) !== json) { lote.set(ref(ruta), f); cambios++; }
        cache[ruta] = json;
        vistos[ruta] = 1;
      });
      guardarIdsVistos(vistos);
      return cambios ? lote.commit() : Promise.resolve();
    });
  }

  /* ---------- Escucha en tiempo real ---------- */
  function escuchar() {
    detener();
    ["proyectos", "capitulos", "entradas", "meta"].forEach(function (n) {
      var l = fs.collection("usuarios").doc(uid).collection(n).onSnapshot(function (snap) {
        if (snap.metadata.hasPendingWrites) return; // eco de nuestras propias escrituras
        var huboCambios = false;
        var vistos = idsVistos();
        snap.docChanges().forEach(function (ch) {
          var ruta = n + "/" + ch.doc.id;
          if (ch.type === "removed") {
            if (cache[ruta] !== undefined) { cache[ruta] = undefined; huboCambios = true; borrarLocal(ruta); }
            return;
          }
          var json = JSON.stringify(ch.doc.data());
          if (cache[ruta] === json) return; // ya lo teníamos
          cache[ruta] = json;
          vistos[ruta] = 1;
          huboCambios = true;
        });
        if (huboCambios) {
          guardarIdsVistos(vistos);
          aplicarCache();
        }
      });
      listeners.push(l);
    });
  }

  function detener() {
    listeners.forEach(function (l) { try { l(); } catch (e) {} });
    listeners = [];
  }

  function borrarLocal(ruta) {
    var db = Datos.db;
    var id = ruta.split("/")[1];
    if (ruta.indexOf("proyectos/") === 0) db.proyectos = db.proyectos.filter(function (p) { return p.id !== id; });
    else if (ruta.indexOf("capitulos/") === 0) db.proyectos.forEach(function (p) { p.capitulos = p.capitulos.filter(function (c) { return c.id !== id; }); });
    else if (ruta.indexOf("entradas/") === 0) db.diario.entradas = db.diario.entradas.filter(function (e) { return e.id !== id; });
  }

  function aplicarCache() {
    // reconstruye lo local a partir de la caché completa (nube) fusionada con lo no sincronizado
    var docs = {};
    Object.keys(cache).forEach(function (r) { if (cache[r] !== undefined) docs[r] = JSON.parse(cache[r]); });
    aplicando = true;
    reconstruir(docs);
    Datos.guardar(true);
    aplicando = false;
    // refresca la interfaz si no estás escribiendo en ese momento
    var enfocado = document.activeElement;
    var escribiendo = enfocado && (enfocado.id === "editor" || enfocado.id === "editor-diario" ||
      enfocado.tagName === "INPUT" || enfocado.tagName === "TEXTAREA");
    if (!escribiendo && window.App) App.refrescarTodo();
  }

  /* ---------- Subida con diferencias ---------- */
  function subir(db) {
    if (!activo || aplicando) return;
    clearTimeout(timerSubida);
    timerSubida = setTimeout(function () { empujar(db); }, 1500);
  }

  // al ocultar/cerrar la app, empuja lo pendiente SIN esperar
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden" && activo) {
      clearTimeout(timerSubida);
      empujar(Datos.db);
    }
  });

  function empujar(db) {
      try {
        var docs = separar(db);
        var lote = fs.batch(), cambios = 0;
        var vistos = idsVistos();
        Object.keys(docs).forEach(function (ruta) {
          var json = JSON.stringify(docs[ruta]);
          if (cache[ruta] !== json) { lote.set(ref(ruta), docs[ruta]); cache[ruta] = json; vistos[ruta] = 1; cambios++; }
        });
        // borrados locales → borrar en la nube
        // Válvula de seguridad: si lo local se ha quedado sin NINGUNA novela
        // pero la nube tenía varias, no borramos nada (algo fue mal en local).
        var proyectosLocales = Object.keys(docs).filter(function (r) { return r.indexOf("proyectos/") === 0; }).length;
        var proyectosNube = Object.keys(cache).filter(function (r) { return r.indexOf("proyectos/") === 0 && cache[r] !== undefined; }).length;
        var puedeBorrar = proyectosLocales > 0 || proyectosNube === 0;
        if (puedeBorrar) {
          Object.keys(cache).forEach(function (ruta) {
            if (cache[ruta] !== undefined && !docs[ruta] && ruta !== "meta/global") {
              lote.delete(ref(ruta)); cache[ruta] = undefined; delete vistos[ruta]; cambios++;
            }
          });
        }
        if (cambios) {
          guardarIdsVistos(vistos);
          lote.commit().catch(function (e) { console.error("Error subiendo", e); });
        }
      } catch (e) { console.error(e); }
  }

  return {
    init: init,
    subir: subir,
    get activo() { return activo; },
    get aplicando() { return aplicando; }
  };
})();
