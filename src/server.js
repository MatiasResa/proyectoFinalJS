import express from 'express';
import http from 'http';
import { Server as SocketIO } from 'socket.io';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = http.createServer(app);
const io = new SocketIO(server);

//----ESQUEMA DE RUTAS----
app.use(express.static(path.join(__dirname, 'public')));
app.post('/start', (req, res) => {
    const nuevaPartida = crearNuevaPartida();
    res.json({ success: true, partida: nuevaPartida });
});

app.post('/join', (req, res) => {
    const { nombre, color } = req.body;
    let partida = partidas.find(partida => partida.jugadores.length < 2);
    if (!partida) {
        partida = crearNuevaPartida();
    }
    const nuevoJugador = {
        nombre,
        color,
        socketId: null,  
        posicion: 0
    };
    partida.jugadores.push(nuevoJugador);
    res.json({ success: true, partida });
});

app.get('/game/:id', (req, res) => {
    const partida = partidas.find(p => p.id === req.params.id);
    if (partida) {
        res.json({ success: true, partida });
    } else {
        res.status(404).json({ success: false, message: 'Partida no encontrada' });
    }
});

app.post('/leave', (req, res) => {
    const { nombre } = req.body;
    let partida = partidas.find(partida => partida.jugadores.some(jugador => jugador.nombre === nombre));
    if (partida) {
        partida.jugadores = partida.jugadores.filter(jugador => jugador.nombre !== nombre);
        if (partida.jugadores.length === 1) {
            const ganador = partida.jugadores[0];
            io.to(partida.id).emit('server:jugadorGano', { nombre: ganador.nombre });
        }
        res.json({ success: true, message: 'Jugador ha abandonado la partida' });
    } else {
        res.status(404).json({ success: false, message: 'Partida no encontrada' });
    }
});

app.post('/rollDice', (req, res) => {
    const { socketId } = req.body;
    const partida = obtenerPartidaPorSocketId(socketId);
    if (partida) {
        const resultadoDado = girarDado();
        partida.valorDado = resultadoDado;
        res.json({ success: true, resultadoDado });
        io.to(partida.id).emit('server:numeroDado', { resultadoDado });
    } else {
        res.status(404).json({ success: false, message: 'Partida no encontrada' });
    }
});

app.post('/answer', (req, res) => {
    const { socketId, respuestaSeleccionada, casillero } = req.body;
    const partida = obtenerPartidaPorSocketId(socketId);
    if (partida) {
        const pregunta = casilleros[casillero-1];
        if (pregunta.correcta === respuestaSeleccionada) {
            res.json({ success: true, mensaje: 'Respuesta correcta' });
            io.to(partida.id).emit('server:respuestaCorrecta');
        } else {
            res.json({ success: false, mensaje: 'Respuesta incorrecta' });
            io.to(partida.id).emit('server:respuestaIncorrecta');
        }
    } else {
        res.status(404).json({ success: false, message: 'Partida no encontrada' });
    }
});

////--------------------------------------------------
///-----------VARIABLES GLOBALES----------------------
////--------------------------------------------------
const preguntas = cargarPreguntas();
const casilleros = asignarPreguntasAleatorias(preguntas);
let partidas=[]


////--------------------------------------------------
////--------FUNCIONES GENERALES   ----------
////--------------------------------------------------
function cargarPreguntas() {
    const preguntasPath = path.join(__dirname, 'public', 'data', 'preguntas.json');
    const preguntas = JSON.parse(fs.readFileSync(preguntasPath, 'utf8'));
    return preguntas;
}


function asignarPreguntasAleatorias(preguntas) {
    console.log(' ASIGNANDO PREGUNTAS ')
    const casilleros = Array(20).fill(null);
    preguntas.sort(() => Math.random() - 0.5);
    for (let i = 0; i < casilleros.length; i++) {
        casilleros[i] = preguntas[i];
    }
    return casilleros;
}

function girarDado() {
 return Math.floor(Math.random() * 6) + 1;
  
}

function crearNuevaPartida() {
    const idPartida = `partida-${partidas.length + 1}`;
    const nuevaPartida = {
        id: idPartida,
        jugadores: [],
        turnoActual: 0,
        preguntaActual: null,
        hayGanador: false,
        valorDado: 0
    };
    partidas.push(nuevaPartida);
    return nuevaPartida;
}
function guardarEstado() {
    const estado = {
        partidas
        
    };
    console.log('Guardando estado:', estado);
    fs.writeFileSync(path.join(__dirname, 'public', 'data', 'partidas.json'), JSON.stringify(estado, null, 2));
}
function obtenerPartidaPorSocketId(socketId) {
    return partidas.find(partida => partida.jugadores.some(jugador => jugador.socketId === socketId));
}


function cargarEstado() {
    try {
        const estadoPath = path.join(__dirname, 'public', 'data', 'partidas.json');
        if (fs.existsSync(estadoPath)) {
            const estado = JSON.parse(fs.readFileSync(estadoPath, 'utf8'));
            partidas = estado.partidas || [];
            console.log('Estado cargado:', estado);
        }
    } catch (error) {
        console.error('Error al cargar el estado del juego:', error);
    }
}
cargarEstado();


function mostrarPregunta(casillero, partida) {
        
    console.log('CASILLA SIG ', casillero, partida.turnoActual);
    const pregunta = casilleros[casillero-1];
    partida.preguntaActual = pregunta;
    io.to(partida.turnoActual).emit('server:mostrarPregunta', partida.preguntaActual);

    if (partida.jugadores.length > 1) {
        const observador = partida.jugadores.find(j => j.socketId !== partida.turnoActual);
        if (observador) {
            io.to(observador.socketId).emit('server:mostrarPreguntaObservador', { pregunta: pregunta.pregunta });
        }
    }
}
function cambiarTurno(partida) {
    partida.turnoActual = partida.jugadores.find(j => j.socketId !== partida.turnoActual).socketId;
    if (partida.turnoActual) {
        const jugadorActual = partida.jugadores.find(j => j.socketId === partida.turnoActual);
        io.to(partida.id).emit('server:actualizarTurnoColor', jugadorActual.color);

    }
    guardarEstado();
}

////--------------------------------------------------
////----INICIO DE CONEXION SOCKET---MANEJO DE EVENTOS
////--------------------------------------------------
console.log('SE REINICIO EL JUEGO ')
io.on('connection', (socket) => {
    console.log('Nuevo cliente conectado', socket.id);
    socket.emit('server:socketId', socket.id);

    socket.on('client:enviarColor', (playerInfo, callback) => {
        let partida = obtenerPartidaPorSocketId(socket.id);

    if (!partida) {
        // Buscamos una partida con espacio para otro jugador
        partida = partidas.find(partida => partida.jugadores.length < 2);
        if (!partida) {
            // Si no hay partidas disponibles, creamos una nueva
            partida = crearNuevaPartida();
            console.log("Se creó una nueva partida:", partida.id);
        }
    }

    if (partida.jugadores.length === 0) {
        callback({ success: true, message: 'Primer jugador, color disponible' });
    } else {
        const colorYaElegido = partida.jugadores.some(jugador => jugador.color === playerInfo.color);
        if (colorYaElegido) {
            callback({ success: false, message: 'Color  ya elegido' });
        } else {
            callback({ success: true, message: 'Color disponible' });
        }
    }
    });
    socket.on('client:unirseJuego', (playerInfo) => {
        console.log('Intento de unión de jugador:', playerInfo);
    
        const partidaExistente = obtenerPartidaPorSocketId(socket.id);
        if (partidaExistente) {
            console.log('El jugador ya está en el juego:', partidaExistente);
            return;
        }
    
        let partidaDisponible = partidas.find(partida => partida.jugadores.length < 2);
        if (!partidaDisponible) {
            partidaDisponible = crearNuevaPartida();
        }
    
        const nuevoJugador = {
            nombre: playerInfo.nombre,
            color: playerInfo.color,
            socketId: socket.id,
            posicion: 0
        };
        partidaDisponible.jugadores.push(nuevoJugador);
        socket.join(partidaDisponible.id);
    
        if (partidaDisponible.jugadores.length === 1) {
            // Primer jugador se une
            partidaDisponible.turnoActual = socket.id;
            const primerJugador = partidaDisponible.jugadores[0];
            partidaDisponible.fichaJugador1 = { color: primerJugador.color, socketId: primerJugador.socketId };
            io.to(partidaDisponible.id).emit('server:asignarFichas', {
                ficha1: partidaDisponible.fichaJugador1.color,
                ficha2: 'grey'
            });
            io.to(partidaDisponible.id).emit('server:actualizarTurnoColor', primerJugador.color);
    
        } else  {

            // Segundo jugador se une
            const [jugador1, jugador2] = partidaDisponible.jugadores;
            io.to(jugador1.socketId).emit('infoRival', { nombre: jugador2.nombre, color: jugador2.color });
            io.to(jugador2.socketId).emit('infoRival', { nombre: jugador1.nombre, color: jugador1.color });
            partidaDisponible.fichaJugador2 = { color: jugador2.color, socketId: jugador2.socketId };
    
            // Emitir la asignación de fichas a todos los jugadores
            io.to(partidaDisponible.id).emit('server:asignarFichas', {
                ficha1: partidaDisponible.fichaJugador1.color,
                ficha2: partidaDisponible.fichaJugador2.color
            });
            io.to(partidaDisponible.id).emit('server:actualizarJugadores', partidaDisponible.jugadores);
        } 
    
        guardarEstado();
    });
    
  socket.on('client:actualizarFicha', ({ color }) => {
    const partida = obtenerPartidaPorSocketId(socket.id);
    if (partida) {
        const jugador = partida.jugadores.find(j => j.socketId === socket.id);
        if (jugador) {
            jugador.color = color;
            // Actualizar ficha del jugador
            if (partida.fichaJugador1.socketId === socket.id) {
                partida.fichaJugador1.color = color;
            } else if (partida.fichaJugador2.socketId === socket.id) {
                partida.fichaJugador2.color = color;
            }

            io.to(partida.id).emit('server:actualizarFichas', {
                ficha1: partida.fichaJugador1.color,
                ficha2: partida.fichaJugador2.color
            });
          }
      }
   });
    

    socket.on('client:numeroDado', (data) => {
        const partida = obtenerPartidaPorSocketId(socket.id);
        if (partida && partida.jugadores.length === 2) {
            if (partida.turnoActual === socket.id) {
                if (!partida.dadoGirado) {
                    partida.valorDado = girarDado();
                    partida.dadoGirado = true;
                    
                    let jugador = partida.jugadores.find(j => j.socketId === partida.turnoActual);
                    let nuevaPosicion = jugador.posicion + partida.valorDado;
    
                    if (nuevaPosicion > 20) {
                        nuevaPosicion = 20;
                    }
    
                    let posicionOcupada = partida.jugadores.some(j => j.posicion === nuevaPosicion);
    
                    if (posicionOcupada) {
                        partida.dadoGirado = false;
                        io.to(partida.turnoActual).emit('server:posicionOcupada', nuevaPosicion);
                    } else {
                        io.to(partida.id).emit('server:numeroDado', { resultadoDado: partida.valorDado });
    
                        mostrarPregunta(nuevaPosicion, partida);
                    }

                } else {
                    io.to(socket.id).emit('server:yaGiraste');
                }
            } else {
                io.to(socket.id).emit('server:noTurno');
            }
        } else {
            socket.emit('server:faltanJugadores');
        }
        guardarEstado();
    });


    socket.on('client:verificarRespuesta', (data) => {
        const partida = obtenerPartidaPorSocketId(socket.id);
        if (partida) {
            partida.dadoGirado = false;
            let jugador = partida.jugadores.find(j => j.socketId === partida.turnoActual);
            io.to(partida.id).emit('server:actualizarTurnoColor', jugador.color);
            io.to(partida.id).emit('server:borrarPregunta');
            let { respuestaSeleccionada, casillero } = data;

            const pregunta = partida.preguntaActual;
            if (pregunta && pregunta.correcta === respuestaSeleccionada) {
                socket.emit('server:respuestaCorrecta');
                if (casillero > 19) {
                    partida.jugadores.find(j => j.socketId === partida.turnoActual).posicion = 20;
                    partida.hayGanador = { estado: true, idGanador: partida.turnoActual, nombre: partida.jugadores.find(j => j.socketId === partida.turnoActual).nombre };
                    
                    io.to(partida.id).emit('server:jugadorGano', { nombre: partida.jugadores.find(j => j.socketId === partida.turnoActual).nombre, color: partida.jugadores.find(j => j.socketId === partida.turnoActual).color });

                } else {
                    partida.jugadores.find(j => j.socketId === partida.turnoActual).posicion = casillero;
                    moverJugador({ nombre: partida.jugadores.find(j => j.socketId === partida.turnoActual).nombre, posicion: casillero }, partida);
                }
            } else {
                socket.emit('server:respuestaIncorrecta');
            }
            cambiarTurno(partida);
            guardarEstado();
        }
    });

    socket.on('client:jugadorGano', (data) => {
         io.to(data.partidaId).emit('server:jugadorGano', data);
    
    });

    function moverJugador(movimiento, partida) {
        const jugador = partida.jugadores.find(j => j.socketId === socket.id);
        if (jugador) {
            jugador.posicion = movimiento.posicion;
            io.to(partida.id).emit('server:actualizarJugadores', partida.jugadores);

        }
    }

    

  
    socket.on('disconnect', () => {
        console.log('Jugador desconectado:', socket.id);

        // Buscar la partida del jugador desconectado
        let partida = obtenerPartidaPorSocketId(socket.id);
        if (partida) {
            // Encontrar el jugador que se desconectó
            let jugadorDesconectado = partida.jugadores.find(j => j.socketId === socket.id);
            // Si había dos jugadores y uno se desconecta, el otro gana
            if (partida.jugadores.length === 2) {
                let jugadorGanador = partida.jugadores.find(j => j.socketId !== socket.id);
                partida.ganador = jugadorGanador.socketId;
                io.to(partida.id).emit('server:jugadorGano', {
                    nombre: jugadorGanador.nombre,
                    color: jugadorGanador.color
                });

               
            } else {
                // Si solo hay un jugador, no hacer nada
                partida.jugadores = partida.jugadores.filter(j => j.socketId !== socket.id);
                io.to(partida.id).emit('server:actualizarJugadores', partida.jugadores);
            }
        }
    }); 
});


const PORT = process.env.PORT || 5500;
server.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
});