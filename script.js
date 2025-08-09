/* =============================================
   VARIABLES GLOBALES DEL JUEGO
============================================= */
let nombreJugador = "";
let numeroDocumento = "";
let numeroFicha = "";
let nombrePrograma = "";
let correoUsuario = "";
let nombreInstructor = "";

let preguntas = [];           // Lista de preguntas cargadas
let preguntaActual = 0;       // Índice de la pregunta en curso
let respuestasCorrectas = 0;  // Total de respuestas correctas
let respuestasIncorrectas = 0;// Total de respuestas incorrectas
let puntaje = 0;              

let tiempoTotal = 1800;       // ⏱️ Tiempo total del juego en segundos (30 min)
let tiempoPregunta = 55;      // ⏱️ Tiempo por pregunta en segundos
let intervaloTotal;           // Intervalo para el temporizador global
let intervaloPregunta;        // Intervalo para el temporizador de cada pregunta
let resultadoEnviado = false; // Evita envíos duplicados de resultados

// URL unificada de Google Apps Script para envío de datos
const WEBAPP_URL = "https://script.google.com/macros/s/AKfycbwtylOPSMHApdhkWPcDxnAmUiX6Zn0VZJZZNtFjM45e5mfF5vyTCU8HIPsWjbyct0yM/exec";


/* =============================================
   MANEJO DE PANTALLAS
============================================= */

// 📜 Muestra la pantalla de instrucciones
function mostrarInstrucciones() {
  document.getElementById("pantalla-inicio").classList.add("oculto");
  document.getElementById("pantalla-instrucciones").classList.remove("oculto");
}

// 📝 Muestra la pantalla para registrar datos del jugador
function mostrarPantallaNombre() {
  document.getElementById("pantalla-instrucciones").classList.add("oculto");
  document.getElementById("pantalla-nombre").classList.remove("oculto");
}


/* =============================================
   REGISTRO DE DATOS DEL JUGADOR
============================================= */
function guardarNombre() {
  // 📥 Capturar datos del formulario
  const nombre = document.getElementById("nombre-usuario").value.trim();
  const documento = document.getElementById("numero-documento").value.trim();
  const ficha = document.getElementById("numero-ficha").value.trim();
  const programa = document.getElementById("nombre-programa").value.trim();
  const correo = document.getElementById("correo-usuario").value.trim();

  // 🔍 Validaciones básicas
  if (!nombre || !documento || !ficha || !programa || !correo || !nombreInstructor) {
    alert("Por favor, completa todos los campos.");
    return;
  }


  // 💾 Guardar en variables globales
  nombreJugador = nombre;
  numeroFicha = ficha;
  correoUsuario = correo;
  numeroDocumento = documento;
  nombrePrograma = programa;


    // 📊 Validar número de intentos diarios
    const fecha = new Date().toISOString().split("T")[0];
    const refIntentos = firebase.database().ref(`intentos/${numeroDocumento}/${fecha}`);

    refIntentos.get().then(snapshot => {
      let intentosHoy = snapshot.val() || 0;

      if (intentosHoy >= 3) {
        alert("❌ Límite de 3 intentos diarios alcanzado.");
        return;
      }

      // 📌 Registrar intento
      intentosHoy++;
      refIntentos.set(intentosHoy);

      if (intentosHoy === 1) alert("✅ Intento #1 de 3 hoy. ¡Suerte!");
      if (intentosHoy === 2) alert("⚡ Intento #2 de 3 hoy.");
      if (intentosHoy === 3) alert("🚨 Último intento del día (#3 de 3).");

      // 🔄 Cargar preguntas y mostrar pantalla de temas
      cargarPreguntasDesdeFirebase(() => {
        document.getElementById("pantalla-nombre").classList.add("oculto");
        document.getElementById("pantalla-temas").classList.remove("oculto");
      });
    });
  });
}


/* =============================================
   INICIO DEL JUEGO
============================================= */
let inicioJuego = null;

function mostrarPantallaJuego() {
  document.getElementById("pantalla-temas").classList.add("oculto");
  document.getElementById("pantalla-juego").classList.remove("oculto");
  inicioJuego = Date.now(); // ⏱ Inicio del intento
  document.getElementById("puntaje").textContent = puntaje;
  document.getElementById("tiempo-total").textContent = formatearTiempo(tiempoTotal);

  iniciarTiempoTotal();      // Inicia cuenta regresiva global
  mostrarPregunta();         // Muestra primera pregunta
  iniciarTiempoPregunta();   // Inicia cuenta regresiva por pregunta
}


/* =============================================
   CARGA DE PREGUNTAS DESDE FIREBASE
============================================= */
function cargarPreguntasDesdeFirebase(callback) {
  firebase.database().ref("preguntas").once("value")
    .then(snapshot => {
      const datos = snapshot.val();
      if (!datos) {
        alert("No hay preguntas disponibles.");
        return;
      }

      // Mezclar preguntas aleatoriamente
      const todas = Object.values(datos);
      for (let i = todas.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [todas[i], todas[j]] = [todas[j], todas[i]];
      }

      // Seleccionar solo las primeras 20
      preguntas = todas.slice(0, 20);
      callback();
    })
    .catch(error => {
      console.error("Error cargando preguntas:", error);
    });
}


/* =============================================
   TEMPORIZADORES
============================================= */
// ⏳ Tiempo total de juego
function iniciarTiempoTotal() {
  intervaloTotal = setInterval(() => {
    tiempoTotal--;
    document.getElementById("tiempo-total").textContent = formatearTiempo(tiempoTotal);

    if (tiempoTotal <= 0) {
      clearInterval(intervaloTotal);
      clearInterval(intervaloPregunta);
      finalizarJuego();
    }
  }, 1000);
}

// ⏱ Tiempo por pregunta
function iniciarTiempoPregunta() {
  clearInterval(intervaloPregunta);
  tiempoPregunta = 55;
  document.getElementById("tiempo-pregunta").textContent = tiempoPregunta;

  intervaloPregunta = setInterval(() => {
    tiempoPregunta--;
    document.getElementById("tiempo-pregunta").textContent = tiempoPregunta;

    if (tiempoPregunta <= 0) {
      clearInterval(intervaloPregunta);
      respuestasIncorrectas++;
      mostrarRetroalimentacion("⏱️ ¡Tiempo agotado! Respuesta incorrecta.");
      avanzarPregunta();
    }
  }, 1000);
}


/* =============================================
   MOSTRAR Y VERIFICAR PREGUNTAS
============================================= */
function mostrarPregunta() {
  const pregunta = preguntas[preguntaActual];

  if (!pregunta || !Array.isArray(pregunta.opciones)) {
    console.error("❌ Pregunta inválida:", pregunta);
    alert("Error al cargar pregunta. Intenta de nuevo.");
    finalizarJuego();
    return;
  }

  document.getElementById("pregunta").textContent = pregunta.pregunta;
  const opciones = document.getElementById("opciones");
  opciones.innerHTML = "";

  pregunta.opciones.forEach((opcion, index) => {
    const boton = document.createElement("button");
    boton.textContent = opcion;
    boton.onclick = () => verificarRespuesta(index);
    opciones.appendChild(boton);
  });

  document.getElementById("respuesta").textContent = "";
  document.getElementById("progreso-pregunta").textContent = preguntaActual + 1;
}

function verificarRespuesta(index) {
  const pregunta = preguntas[preguntaActual];
  document.querySelectorAll("#opciones button").forEach(btn => btn.disabled = true);

  if (index === pregunta.respuesta) {
    puntaje++;
    respuestasCorrectas++;
    mostrarRetroalimentacion("✅ ¡Respuesta correcta!");
  } else {
    respuestasIncorrectas++;
    mostrarRetroalimentacion("❌ Incorrecta. " + pregunta.retroalimentacion);
  }
  
  document.getElementById("puntaje").textContent = puntaje;
  avanzarPregunta();
}

function mostrarRetroalimentacion(texto) {
  document.getElementById("respuesta").textContent = texto;
}

function avanzarPregunta() {
  clearInterval(intervaloPregunta);
  setTimeout(() => {
    preguntaActual++;
    if (preguntaActual < preguntas.length) {
      mostrarPregunta();
      iniciarTiempoPregunta();
    } else {
      finalizarJuego();
    }
  }, 2000);
}


/* =============================================
   FINALIZAR JUEGO Y GUARDAR RESULTADOS
============================================= */
function finalizarJuego() {
  if (resultadoEnviado) return;
  resultadoEnviado = true;

  const finJuego = Date.now();
  const duracionSegundos = Math.round((finJuego - inicioJuego) / 1000);
  const promedioPregunta = (duracionSegundos / preguntas.length).toFixed(2);
  const porcentaje = (respuestasCorrectas / preguntas.length) * 100;
  const estado = porcentaje >= 80 ? "Aprobado" : "Reprobado";

  // Mostrar pantalla final
  clearInterval(intervaloTotal);
  clearInterval(intervaloPregunta);
  document.getElementById("pantalla-juego").classList.add("oculto");
  document.getElementById("pantalla-final").classList.remove("oculto");

  document.getElementById("nombre-final").textContent = nombreJugador;
  document.getElementById("puntaje-final").textContent = puntaje;
  document.getElementById("correctas").textContent = respuestasCorrectas;
  document.getElementById("incorrectas").textContent = respuestasIncorrectas;
  document.getElementById("porcentaje-final").textContent = porcentaje.toFixed(2);

  // Guardar datos en Firebase y enviar a Google Sheets
  guardarResultadoFirebase(duracionSegundos, promedioPregunta, estado);
  enviarDatosUnificados(porcentaje, duracionSegundos, promedioPregunta, estado);

  // Mensaje final
  if (porcentaje >= 80) {
    alert("✅ Tu certificado será enviado a tu correo.");
  } else {
    alert("Debes acertar mínimo el 80% para obtener el certificado.");
  }
}

function guardarResultadoFirebase(duracion, promedio, estado) {
  const jugadorRef = firebase.database().ref("jugadores").push();
  jugadorRef.set({
    nombre: nombreJugador,
    documento: numeroDocumento,
    ficha: numeroFicha,
    programa: nombrePrograma,
    correo: correoUsuario,
    instructor: nombreInstructor,
    puntaje: puntaje,
    correctas: respuestasCorrectas,
    incorrectas: respuestasIncorrectas,
    porcentaje: ((respuestasCorrectas / preguntas.length) * 100).toFixed(2),
    estado: estado,
    duracion: duracion,
    promedioPregunta: promedio,
    fecha: new Date().toLocaleString()
  });
}

function enviarDatosUnificados(porcentaje, duracion, promedio, estado) {
  const fecha = new Date().toLocaleString();

  const bodyData = new URLSearchParams({
    "entry.1074037193": nombreJugador,
    "entry.760554111": numeroDocumento,
    "entry.1436076378": numeroFicha,
    "entry.480386414": nombrePrograma,
    "entry.446350167": correoUsuario,
    "entry.1952037755": nombreInstructor,
    "entry.1279592004": puntaje,
    "entry.2118980774": respuestasCorrectas,
    "entry.1770889491": respuestasIncorrectas,
    "duracion": duracion,
    "promedio": promedio,
    "estado": estado,
    "fecha": fecha
  });

  fetch(WEBAPP_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: bodyData.toString(),
  });
}


/* =============================================
   UTILIDADES
============================================= */
function formatearTiempo(segundos) {
  const min = Math.floor(segundos / 60);
  const seg = segundos % 60;
  return `${min.toString().padStart(2, "0")}:${seg.toString().padStart(2, "0")}`;
}

function volverAlInicio() {
  location.reload();
}
