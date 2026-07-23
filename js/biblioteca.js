/* ============ Biblioteca de técnica narrativa — vista ============ */

var Biblioteca = (function () {
  var pintada = false;

  function pintar() {
    if (pintada) return;
    var cont = document.getElementById("contenido-biblioteca");
    cont.innerHTML = "";

    // tabla rápida
    var tabla = document.createElement("div");
    tabla.className = "tarjeta";
    var filas = BIBLIOTECA_TABLA.map(function (f) {
      return "<tr><td>" + f[0] + "</td><td><b>" + f[1] + "</b></td></tr>";
    }).join("");
    tabla.innerHTML = "<h3>¿A quién imitar para qué?</h3><table class='tabla-voz'>" + filas + "</table>";
    cont.appendChild(tabla);

    BIBLIOTECA.forEach(function (a) {
      var det = document.createElement("details");
      det.className = "autor";
      var sum = document.createElement("summary");
      sum.innerHTML = a.icono + " <span></span> <span class='obra'></span>";
      sum.querySelector("span").textContent = a.autor;
      sum.querySelector(".obra").textContent = a.obra;
      det.appendChild(sum);

      var cuerpo = document.createElement("div");
      cuerpo.className = "autor-cuerpo";
      var html = "<p><i>" + a.sello + "</i></p>";
      a.secciones.forEach(function (s) {
        html += "<h5>" + s[0] + "</h5><p>" + s[1] + "</p>";
      });
      html += "<div class='aplicalo'><b>Aplícalo así:</b> " + a.aplicalo + "</div>";
      cuerpo.innerHTML = html;
      det.appendChild(cuerpo);
      cont.appendChild(det);
    });
    pintada = true;
  }

  return { pintar: pintar };
})();
