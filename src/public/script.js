const socket = io();
let colorJugador;
let nombreJugador;
let posicionJugador = 0;
let dado;
let socketI;
let turnoActual;
let fichaJugador1=document.getElementById('fichaJugador1')
let fichaJugador2=document.getElementById('fichaJugador2')
let infoJugador;
let jugadorActual = null;
let jugadorRival = null;

const btnDado = document.getElementById('btnDado');
const preguntaTexto = document.getElementById('preguntaTexto');
const opcionesDiv = document.getElementById('opciones');
const btnAbandono=document.getElementById('btnAbandono')
let numeroDado=document.getElementById('numeroDado')
const celdas = document.querySelectorAll('.celda');

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btnInicio').addEventListener('click', () => {
        let consigna = document.getElementById('consigna');
        consigna.style.display = 'none';
        let formularioIngreso = document.getElementById('formRegistro');
        formularioIngreso.style.display = 'block';
    });
    document.getElementById('formRegistro').addEventListener('submit', startGame);

    btnDado.addEventListener('click', () => {
        calcularNum();
    });

    btnAbandono.addEventListener('click', () => {
    if (confirm("¿Estás seguro de que quieres abandonar la partida?")) {
        socket.emit('client:abandonarPartida', { nombre:  nombreJugador });
        reiniciarJuego();
        }
      });
    socket.on('server:socketId', (socketId) => {
        socketI = socketId;
    });
    socket.on('infoRival', (rival) => {
         jugadorRival = rival;
         console.log('MI INFO ',jugadorActual)
         console.log('RIVAL ',jugadorRival)
         mostrarInfoJugadores()
         
     });
    socket.on('server:asignarFichas', ({ ficha1, ficha2 }) => {
        let fichaJugador1 = document.getElementById('fichaJugador1');
        let fichaJugador2 = document.getElementById('fichaJugador2');
      // Actualizar las fichas en la interfaz
        if (fichaJugador1 && fichaJugador2) {
           fichaJugador1.style.backgroundColor = ficha1 || 'grey'; 
           socket.emit('cliente:actualizarFicha',ficha1)
           fichaJugador2.style.backgroundColor = ficha2 || 'grey'; 
        }
    });
         
    socket.on('server:actualizarTurnoColor',(color)=>{
        let turnoJ= document.getElementById('turnoJugador');
        turnoJ.style.backgroundColor=color;
    })
    socket.on('server:faltanJugadores',()=>{
        alert('FALTA UN JUGADOR PARA COMENZAR LA PARTIDA,ESPERE')
    })
    socket.on('server:noTurno', () => {
        alert('NO ES TU TURNO, ESPERE A QUE EL OTRO JUGADOR TERMINE SU TURNO');
    });

    socket.on('server:colorRepetido', (mensaje) => {
        alert(mensaje);
        let formularioIngreso = document.getElementById('formRegistro');
        formularioIngreso.style.display = 'block';
    });
    socket.on('server:numeroDado', (data) => {
        dado = data.resultadoDado;
        mostrarNumeroDado(dado);
        actualizarDado(data.resultadoDado)


    });
    

    socket.on('server:actualizarJugadores', (jugadores) => {
        //actualiza el movimiento de los jugadores en el tablero
        actualizarCasillas(jugadores);
    });

    socket.on('server:mostrarPregunta', (pregunta) => {
        mostrarPregunta(pregunta, true);
    });

    socket.on('server:mostrarPreguntaObservador', (pregunta) => {
        mostrarPregunta(pregunta, false);
    });

    socket.on('server:borrarPregunta', () => {
        preguntaTexto.textContent = 'Esperando otra pregunta';
        opcionesDiv.innerHTML = '';
    });
    socket.on('server:posicionOcupada',(pos)=>{
           alert(`CAISTE EN LA POSICION ${pos} ,QUE ESTA OCUPADA POR EL RIVAL,GIRE EL DADO NUEVAMENTE `)
    });
    socket.on('server:yaGiraste', () => {
        alert('Ya giraste el dado en este turno,responde la pregunta');
        });

    socket.on('server:respuestaCorrecta', () => {
        alert('¡Respuesta correcta,avanzas de posicion!');
        posicionJugador += dado;
    });

    socket.on('server:respuestaIncorrecta', () => {
        alert('¡Respuesta incorrecta,no avanzas!');
    });
    socket.on('server:jugadorGano', (data) => {
        jugadorGano(data);
    });

  socket.on('server:jugadorAbandona', (nombre) => {
    alert(`El jugador ${nombre} ha abandonado la partida.Eres el jugador ganador.`);
    location.reload();
   });
});

function mostrarInfoJugadores() {
    if (jugadorActual && jugadorRival) {
        document.getElementById('nombreJugadorActual').innerText = `Nombre: ${jugadorActual.nombre}`;
        document.getElementById('colorJugadorActual').innerText = `Color: ${jugadorActual.color}`;
        document.getElementById('infoJugadorActual').style.backgroundColor=jugadorActual.color;

        document.getElementById('nombreJugadorRival').innerText = `Nombre: ${jugadorRival.nombre}`;
        document.getElementById('colorJugadorRival').innerText = `Color: ${jugadorRival.color}`;
        document.getElementById('infoJugadorRival').style.backgroundColor=jugadorRival.color;
        setTimeout(() => {
            document.getElementById('infoJugadorRival').style.display = 'flex';
            document.getElementById('infoJugadorActual').style.display = 'flex';
       }, 3000);
        
      
        
    }
}
function actualizarDado(num) {
    const dadoFace = document.getElementById('dadoFace');
    dadoFace.classList.add('girar'); 
    setTimeout(() => {
        dadoFace.innerHTML = ''; 
        const dotPositions = [
            [], 
            [[50, 50]], 
            [[30, 30], [70, 70]], 
            [[30, 30], [50, 50], [70, 70]], 
            [[30, 30], [30, 70], [70, 30], [70, 70]], 
            [[30, 30], [30, 70], [70, 30], [70, 70], [50, 50]], 
            [[30, 30], [30, 70], [50, 30], [50, 70], [70, 30], [70, 70]]
        ];

        dotPositions[num ].forEach(([topPercent, leftPercent]) => {
            const dot = document.createElement('div');
            dot.className = 'dot';
            dot.style.top = `${topPercent}%`;
            dot.style.left = `${leftPercent}%`;
            dadoFace.appendChild(dot);
        });

        dadoFace.classList.remove('girar'); 
    }, 600); 
}

let unidoAJuego = false;
let cantR;
async function startGame(event) {
     btnDado.style.display = "block";
     btnAbandono.style.display="block"
    event.preventDefault();

    // Evitar unirse más de una vez
    if (unidoAJuego) return;
    cantR = 0;
    nombreJugador = document.getElementById('nombreJugador').value;
    colorJugador = document.getElementById('colorJugador').value;
    socket.emit('client:actualizarFicha', { color: colorJugador });


     infoJugador = { nombre: nombreJugador, color: colorJugador, socketId: socket.id };
     jugadorActual=infoJugador;
    
     
    try {
        const colorDisponible = await new Promise((resolve) => {
            socket.emit('client:enviarColor', infoJugador, (response) => {
                resolve(response.success);
            });
        });

        if (!colorDisponible) {
            cantR += 1;
            if (cantR <= 1) {
            alert(`El color ${infoJugador.color} ya está en uso, elige otro color.`);
                }
            return;
        }
        
   
        const bienvenidaJugador = document.getElementById('bienvenidaJugador');
        bienvenidaJugador.innerHTML = `
            <h4>¡Bienvenido, ${nombreJugador}!</h4>
            <h4>Color de ficha elegido : ${colorJugador}</h4>
        `;
        bienvenidaJugador.style.display = 'block';
        document.getElementById('formRegistro').style.display = 'none';
     
        setTimeout(() => {
            bienvenidaJugador.style.display='none'
                          if(jugadorActual && jugadorRival) {
                mostrarInfoJugadores()}
            
        }, 3000);
        socket.emit('client:unirseJuego', infoJugador);
        unidoAJuego = true; 
        
    } catch (error) {
        console.error('Error al unirse al juego:', error.message);
        alert(`Error: ${error.message}`);
        unidoAJuego = false; 
    }
}



function calcularNum() {
    socket.emit('client:numeroDado', { socketId: socketI});

}

function mostrarNumeroDado(dado) {
    numeroDado.textContent = `Número del dado: ${dado}`;
    numeroDado.style.display = 'block';

    setTimeout(() => {
        numeroDado.style.display = 'none';
    }, 4000);
    
}

function mostrarPregunta(pregunta, mostrarOpciones) {
    preguntaTexto.textContent = `Pregunta: ${pregunta.pregunta}`;
    opcionesDiv.innerHTML = '';

    if (mostrarOpciones) {
        pregunta.opciones.forEach(opcion => {
            const button = document.createElement('button');
            button.textContent = opcion;
            button.addEventListener('click', () => verificarRespuesta(pregunta, opcion));
            opcionesDiv.appendChild(button);
        });
    }
}

function verificarRespuesta(pregunta, seleccionada) {
    socket.emit('client:verificarRespuesta', {
        nombre: nombreJugador,
        respuestaSeleccionada: seleccionada,
        casillero: dado + posicionJugador
    });
}

function actualizarCasillas(jugadores) {
    celdas.forEach(celda => {
        celda.style.backgroundColor = '#4CAF50';
        celda.innerText = celda.getAttribute('data-celda-number');
        celda.classList.remove('resaltada'); // Remover clase resaltada de todas las celdas

    });
   

   
    jugadores.forEach(jugador => {
        if (jugador.posicion > 0 && jugador.posicion <= 19) {
             // Actualizar el color de la ficha correspondiente al jugador
             if (jugador.socketId === socketI) {
                fichaJugador1.style.backgroundColor = '#9e9897'; 
            } else   {
                fichaJugador2.style.backgroundColor = '#9e9897'; 
            }
            const celdaActual = celdas[jugador.posicion - 1];
            celdaActual.style.backgroundColor = jugador.color;
            celdaActual.innerHTML = `<span>${jugador.nombre}</span>`;
            celdaActual.classList.add('resaltada'); // Agregar clase resaltada a la celda actual
        }
            
    });
}


function jugadorGano(data) {
    btnDado.style.display = "none";
    btnAbandono.style.display='none';
    preguntaTexto.innerHTML = `
    <div style="text-align: center; padding: 20px; background-color: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; border-radius: 5px;">
        <h3>--- FIN DEL JUEGO ---</h3>
        <p>GANADOR: ${data.nombre}</p>
        <p><button onclick="reiniciarJuego()">REINICIAR PARA JUGAR NUEVAMENTE</button></p>
    </div>
    `;
    
    
    celdas.forEach(celda => {
        celda.style.backgroundColor = '#4CAF50';
        celda.innerText = celda.getAttribute('data-celda-number');
    });

    let llegada = document.getElementById('llegada');
    llegada.style.backgroundColor = data.color;
    llegada.innerText = `FIN DEL JUEGO ,GANADOR : ${data.nombre}`;
    alert(`¡GANÓ EL JUGADOR: ${data.nombre}!`);
}

function reiniciarJuego() {
    location.reload();
}





