// Variables globales
let operadores = [];
let operadorActual = null;

// Elementos del DOM
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
const operadoresGrid = document.getElementById('operadoresGrid');
const buscarOperador = document.getElementById('buscarOperador');
const modal = document.getElementById('modalDetalles');
const closeBtn = document.querySelector('.close');
const btnEntrada = document.getElementById('btnEntrada');
const btnSalida = document.getElementById('btnSalida');
const fechaActual = document.getElementById('fechaActual');
const fechaInicio = document.getElementById('fechaInicio');
const fechaFin = document.getElementById('fechaFin');
const operadorFiltro = document.getElementById('operadorFiltro');
const btnGenerarReporte = document.getElementById('btnGenerarReporte');
const btnExportarCSV = document.getElementById('btnExportarCSV');
const btnImportar = document.getElementById('btnImportar');
const textareaImportar = document.getElementById('textareaImportar');
const mensajeImportacion = document.getElementById('mensajeImportacion');

// Inicializar app
document.addEventListener('DOMContentLoaded', () => {
    cargarOperadores();
    configurarTabs();
    configurarEventos();
    actualizarFechaActual();
    setInterval(actualizarFechaActual, 1000);
});

// ============ TABS ============
function configurarTabs() {
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.getAttribute('data-tab');
            mostrarTab(tabName);
        });
    });
}

function mostrarTab(tabName) {
    // Ocultar todos los tabs
    tabContents.forEach(content => content.classList.remove('active'));
    tabBtns.forEach(btn => btn.classList.remove('active'));

    // Mostrar tab activo
    document.getElementById(tabName).classList.add('active');
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    // Acciones especiales por tab
    if (tabName === 'reportes') {
        cargarSelectOperadores();
        establecerFechasDefecto();
    }
}

// ============ FECHAS ============
function actualizarFechaActual() {
    const hoy = new Date();
    const opciones = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    fechaActual.textContent = hoy.toLocaleDateString('es-PE', opciones);
}

function establecerFechasDefecto() {
    const hoy = new Date();
    const hace7dias = new Date(hoy.getTime() - (7 * 24 * 60 * 60 * 1000));

    fechaInicio.valueAsDate = hace7dias;
    fechaFin.valueAsDate = hoy;
}

// ============ OPERADORES ============
async function cargarOperadores() {
    try {
        const response = await fetch('/api/operadores');
        operadores = await response.json();
        mostrarOperadores(operadores);
    } catch (error) {
        console.error('Error al cargar operadores:', error);
        mostrarToast('Error al cargar operadores', 'error');
    }
}

function mostrarOperadores(lista) {
    operadoresGrid.innerHTML = '';

    if (lista.length === 0) {
        operadoresGrid.innerHTML = '<div class="loading">No hay operadores registrados</div>';
        return;
    }

    lista.forEach(op => {
        const card = crearCardOperador(op);
        operadoresGrid.appendChild(card);
    });
}

function crearCardOperador(op) {
    const card = document.createElement('div');
    card.className = 'operador-card';
    card.innerHTML = `
        <div class="operador-nombre">${op.nombre}</div>
        <div class="operador-info">
            <strong>DNI:</strong> ${op.dni}
        </div>
        <div class="operador-info">
            <strong>Teléfono:</strong> ${op.telefono}
        </div>
        <div class="operador-info">
            <strong>Área:</strong> ${op.area}
        </div>
        <div class="operador-estado">
            <span class="badge badge-warning">Click para registrar</span>
        </div>
    `;

    card.addEventListener('click', () => abrirModal(op));
    return card;
}

// ============ BUSQUEDA ============
buscarOperador.addEventListener('input', (e) => {
    const termino = e.target.value.toLowerCase();
    const filtrados = operadores.filter(op =>
        op.nombre.toLowerCase().includes(termino) ||
        op.dni.includes(termino)
    );
    mostrarOperadores(filtrados);
});

// ============ MODAL ============
function abrirModal(op) {
    operadorActual = op;

    document.getElementById('modalNombre').textContent = op.nombre;
    document.getElementById('modalDNI').textContent = op.dni;
    document.getElementById('modalTelefono').textContent = op.telefono;
    document.getElementById('modalArea').textContent = op.area;
    document.getElementById('modalFuncion').textContent = op.funcion;

    cargarAsistenciaHoy(op.id);
    modal.style.display = 'block';
}

closeBtn.addEventListener('click', () => {
    modal.style.display = 'none';
});

window.addEventListener('click', (e) => {
    if (e.target == modal) {
        modal.style.display = 'none';
    }
});

async function cargarAsistenciaHoy(operadorId) {
    try {
        const response = await fetch('/api/asistencia/hoy');
        const asistencias = await response.json();
        const asistencia = asistencias.find(a => a.operador_id === operadorId);

        const horaEntradaSpan = document.getElementById('horaEntrada');
        const horaSalidaSpan = document.getElementById('horaSalida');

        if (asistencia) {
            horaEntradaSpan.textContent = asistencia.hora_entrada || 'No registrada';
            horaSalidaSpan.textContent = asistencia.hora_salida || 'No registrada';
        } else {
            horaEntradaSpan.textContent = 'No registrada';
            horaSalidaSpan.textContent = 'No registrada';
        }
    } catch (error) {
        console.error('Error al cargar asistencia:', error);
    }
}

// ============ ASISTENCIA ============
btnEntrada.addEventListener('click', registrarEntrada);
btnSalida.addEventListener('click', registrarSalida);

async function registrarEntrada() {
    if (!operadorActual) return;

    try {
        const response = await fetch('/api/asistencia/entrada', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ operador_id: operadorActual.id })
        });

        const data = await response.json();

        if (data.success) {
            mostrarToast(`✓ Entrada registrada a las ${data.hora}`, 'success');
            cargarAsistenciaHoy(operadorActual.id);
        }
    } catch (error) {
        console.error('Error al registrar entrada:', error);
        mostrarToast('Error al registrar entrada', 'error');
    }
}

async function registrarSalida() {
    if (!operadorActual) return;

    try {
        const response = await fetch('/api/asistencia/salida', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ operador_id: operadorActual.id })
        });

        const data = await response.json();

        if (data.success) {
            mostrarToast(`✓ Salida registrada a las ${data.hora}`, 'success');
            cargarAsistenciaHoy(operadorActual.id);
        }
    } catch (error) {
        console.error('Error al registrar salida:', error);
        mostrarToast('Error al registrar salida', 'error');
    }
}

// ============ REPORTES ============
function cargarSelectOperadores() {
    operadorFiltro.innerHTML = '<option value="">Todos los operadores</option>';

    operadores.forEach(op => {
        const option = document.createElement('option');
        option.value = op.id;
        option.textContent = op.nombre;
        operadorFiltro.appendChild(option);
    });
}

btnGenerarReporte.addEventListener('click', generarReporte);

async function generarReporte() {
    const inicio = fechaInicio.value;
    const fin = fechaFin.value;
    const operadorId = operadorFiltro.value;

    if (!inicio || !fin) {
        mostrarToast('Selecciona rango de fechas', 'warning');
        return;
    }

    try {
        let url = `/api/reportes/rango?fecha_inicio=${inicio}&fecha_fin=${fin}`;

        if (operadorId) {
            url = `/api/reportes/operador/${operadorId}?fecha_inicio=${inicio}&fecha_fin=${fin}`;
        }

        const response = await fetch(url);
        const datos = await response.json();

        mostrarReporte(datos);
    } catch (error) {
        console.error('Error al generar reporte:', error);
        mostrarToast('Error al generar reporte', 'error');
    }
}

function mostrarReporte(datos) {
    const tbody = document.getElementById('tablaReporteBody');
    tbody.innerHTML = '';

    if (datos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty">No hay registros</td></tr>';
        return;
    }

    datos.forEach(registro => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${registro.nombre}</td>
            <td>${registro.dni}</td>
            <td>${registro.telefono}</td>
            <td>${registro.area}</td>
            <td>${registro.fecha || '-'}</td>
            <td>${registro.hora_entrada || '-'}</td>
            <td>${registro.hora_salida || '-'}</td>
            <td>
                <span class="badge ${registro.estado === 'Presente' ? 'badge-success' : 'badge-danger'}">
                    ${registro.estado}
                </span>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

btnExportarCSV.addEventListener('click', exportarCSV);

async function exportarCSV() {
    const inicio = fechaInicio.value;
    const fin = fechaFin.value;

    if (!inicio || !fin) {
        mostrarToast('Selecciona rango de fechas', 'warning');
        return;
    }

    try {
        const url = `/api/reportes/exportar?fecha_inicio=${inicio}&fecha_fin=${fin}`;
        const a = document.createElement('a');
        a.href = url;
        a.download = `reporte_asistencia_${inicio}_${fin}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        mostrarToast('Reporte descargado', 'success');
    } catch (error) {
        console.error('Error al exportar CSV:', error);
        mostrarToast('Error al exportar reporte', 'error');
    }
}

// ============ IMPORTAR ============
btnImportar.addEventListener('click', importarOperadores);

async function importarOperadores() {
    const texto = textareaImportar.value.trim();

    if (!texto) {
        mostrarMensaje('Por favor ingresa datos', 'error');
        return;
    }

    const lineas = texto.split('\n').filter(l => l.trim());
    let importados = 0;
    let errores = 0;

    for (const linea of lineas) {
        const partes = linea.split('|').map(p => p.trim());

        if (partes.length < 3) {
            errores++;
            continue;
        }

        const [nombre, dni, telefono] = partes;

        try {
            const response = await fetch('/api/operadores', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nombre: nombre,
                    dni: dni,
                    telefono: telefono,
                    area: 'COMPUTO',
                    funcion: 'OPERADOR DE COMPUTO'
                })
            });

            if (response.ok) {
                importados++;
            } else {
                errores++;
            }
        } catch (error) {
            console.error('Error al importar:', error);
            errores++;
        }
    }

    const mensaje = `✓ Importados: ${importados} | ✗ Errores: ${errores}`;
    mostrarMensaje(mensaje, 'success');

    if (importados > 0) {
        textareaImportar.value = '';
        cargarOperadores();
    }
}

function mostrarMensaje(texto, tipo) {
    mensajeImportacion.textContent = texto;
    mensajeImportacion.className = `mensaje ${tipo}`;
    setTimeout(() => {
        mensajeImportacion.className = 'mensaje';
    }, 5000);
}

// ============ TOAST ============
function mostrarToast(mensaje, tipo = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = mensaje;
    toast.className = `toast ${tipo} show`;

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// ============ EVENTOS ============
function configurarEventos() {
    // Todos los eventos ya están configurados arriba
}
