/* ============ Exportar e importar copias ============ */

var Exportar = (function () {

  function init() {
    document.getElementById("btn-exportar-docx").addEventListener("click", exportarWord);
    document.getElementById("btn-exportar-json").addEventListener("click", exportarJson);
    document.getElementById("btn-importar").addEventListener("click", function () {
      document.getElementById("input-importar").click();
    });
    document.getElementById("input-importar").addEventListener("change", importarJson);
    document.getElementById("input-objetivo").addEventListener("change", function () {
      Datos.db.ajustes.objetivoPalabras = parseInt(this.value, 10) || 0;
      Datos.guardar();
      pintarPanel();
    });
  }

  function descargar(nombre, contenido, tipo) {
    var blob = new Blob([contenido], { type: tipo });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  function nombreArchivo(base, ext) {
    var p = Datos.proyecto();
    var n = (p ? p.nombre : "mi-historia").toLowerCase().replace(/[^\wáéíóúüñ]+/gi, "-");
    return n + "-" + Datos.hoy() + "." + ext;
  }

  /* ---------- Word (.doc compatible, se abre en Word/LibreOffice) ---------- */
  function exportarWord() {
    var p = Datos.proyecto();
    if (!p) { UI.aviso("Abre primero una novela."); return; }
    var cuerpo = "<h1 style='text-align:center'>" + esc(p.nombre) + "</h1>";
    p.capitulos.forEach(function (c) {
      cuerpo += "<h2 style='page-break-before:always'>" + esc(c.titulo) + "</h2>" + limpiarHtml(c.html);
    });
    // anexo de fichas
    if (p.fichas.length) {
      cuerpo += "<h2 style='page-break-before:always'>Anexo: fichas</h2>";
      p.fichas.forEach(function (f) {
        cuerpo += "<h3>" + Fichas.icono(f.tipo) + " " + esc(f.nombre) + "</h3>";
        var def = Fichas.TIPOS[f.tipo];
        def.campos.forEach(function (c) {
          if (f.campos[c[0]]) cuerpo += "<p><b>" + c[1] + ":</b> " + esc(f.campos[c[0]]) + "</p>";
        });
      });
    }
    var doc = "<html xmlns:w='urn:schemas-microsoft-com:office:word'><head><meta charset='utf-8'>" +
      "<title>" + esc(p.nombre) + "</title>" +
      "<style>body{font-family:Georgia,serif;font-size:12pt;line-height:1.6}h1,h2{font-family:Georgia,serif}</style>" +
      "</head><body>" + cuerpo + "</body></html>";
    descargar(nombreArchivo(p.nombre, "doc"), "﻿" + doc, "application/msword");
    UI.aviso("Novela exportada en Word. Guárdala donde quieras (por ejemplo, en tu Drive).");
  }

  function limpiarHtml(html) {
    var div = document.createElement("div");
    div.innerHTML = html || "";
    div.querySelectorAll(".entidad").forEach(function (s) { s.replaceWith(s.textContent); });
    div.querySelectorAll("script,style").forEach(function (s) { s.remove(); });
    return div.innerHTML;
  }

  function esc(t) {
    return String(t || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /* ---------- Copia completa .json (sin el diario, que es íntimo) ---------- */
  function exportarJson() {
    var hacer = function (incluirDiario) {
      var copia = JSON.parse(JSON.stringify(Datos.db));
      if (!incluirDiario) copia.diario = { hash: copia.diario.hash, entradas: [] };
      descargar("mi-historia-copia-" + Datos.hoy() + ".json", JSON.stringify(copia, null, 1), "application/json");
      UI.aviso("Copia completa exportada. Súbela a tu Drive para tenerla a salvo.");
    };
    UI.confirmar("¿Incluir también Mi diario en la copia? (el diario iría legible dentro del archivo)",
      function () { hacer(true); }, function () { hacer(false); },
      { si: "Sí, con diario", no: "No, solo novelas" });
  }

  function importarJson(e) {
    var archivo = e.target.files[0];
    e.target.value = "";
    if (!archivo) return;
    var lector = new FileReader();
    lector.onload = function () {
      try {
        var datos = JSON.parse(lector.result);
        if (!datos || !Array.isArray(datos.proyectos)) throw new Error("El archivo no es una copia de Mi Historia.");
        UI.confirmar("Vas a restaurar la copia «" + archivo.name + "» (" + datos.proyectos.length +
          " novela(s)). Se sustituirá lo que hay ahora en este dispositivo. Antes se guardará una instantánea de seguridad. ¿Continuar?", function () {
          Datos.guardar(true); // instantánea del estado actual antes de pisar nada
          // conserva el diario actual si la copia viene sin él
          if ((!datos.diario || !datos.diario.entradas || !datos.diario.entradas.length) && Datos.db.diario.entradas.length) {
            datos.diario = Datos.db.diario;
          }
          localStorage.setItem("miHistoria_v1", JSON.stringify(datos));
          location.reload();
        });
      } catch (err) {
        UI.aviso("⚠️ No se pudo importar: " + err.message);
      }
    };
    lector.readAsText(archivo);
  }

  /* ---------- Panel de copias ---------- */
  function pintarPanel() {
    // instantáneas
    var ul = document.getElementById("lista-instantaneas");
    ul.innerHTML = "";
    var fotos = Datos.listaFotos();
    if (!fotos.length) ul.innerHTML = "<li class='nota'>Aún no hay instantáneas: se crean al escribir.</li>";
    fotos.forEach(function (fecha) {
      var li = document.createElement("li");
      li.innerHTML = "<span>📸 " + fecha + "</span><button>Restaurar</button>";
      li.querySelector("button").addEventListener("click", function () {
        UI.confirmar("¿Volver a como estaba todo el " + fecha + "? Lo escrito después se perderá (haz antes una copia .json si dudas).", function () {
          if (Datos.restaurarFoto(fecha)) location.reload();
        });
      });
      ul.appendChild(li);
    });

    // papelera
    var up = document.getElementById("lista-papelera");
    up.innerHTML = "";
    if (!Datos.db.papelera.length) up.innerHTML = "<li class='nota'>La papelera está vacía.</li>";
    Datos.db.papelera.slice().reverse().forEach(function (p) {
      var li = document.createElement("li");
      var nombre = p.dato && (p.dato.titulo || p.dato.nombre || p.dato.idea) || p.tipo;
      var fecha = new Date(p.borradoEl).toLocaleDateString("es-ES");
      li.innerHTML = "<span>🗑 <b></b> <span class='nota'>(" + p.tipo + ", " + fecha + ")</span></span><button>Restaurar</button>";
      li.querySelector("b").textContent = nombre;
      li.querySelector("button").addEventListener("click", function () {
        if (Datos.restaurarDePapelera(p.id)) { UI.aviso("Restaurado."); App.refrescarTodo(); pintarPanel(); }
        else UI.aviso("No se pudo restaurar (¿existe todavía la novela a la que pertenecía?).");
      });
      up.appendChild(li);
    });

    // objetivo
    document.getElementById("input-objetivo").value = Datos.db.ajustes.objetivoPalabras || 0;
    var r = Datos.racha();
    document.getElementById("racha-info").textContent = r > 1 ? "🔥 Racha: " + r + " días" : "";
  }

  return { init: init, pintarPanel: pintarPanel };
})();
