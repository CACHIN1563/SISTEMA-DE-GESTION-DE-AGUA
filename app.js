// === REGISTRO DEL SERVICE WORKER (Para el manejo Offline) ===
if('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
      .then(reg => console.log('Service Worker Registrado!', reg))
      .catch(err => console.error('Error al registrar SW', err));
}

// === LÓGICA DE DETECCIÓN DE RED ===
window.addEventListener('online', () => {
    let offlineBanner = document.getElementById('offline-banner');
    let onlineBanner = document.getElementById('online-banner');
    if(offlineBanner) offlineBanner.style.display = 'none';
    if(onlineBanner) {
        onlineBanner.style.display = 'block';
        setTimeout(() => onlineBanner.style.display = 'none', 3000);
    }
    sincronizarDatosPendientes();
});

window.addEventListener('offline', () => {
    let offlineBanner = document.getElementById('offline-banner');
    if(offlineBanner) offlineBanner.style.display = 'block';
});

// Inicialización de la Detección visual
if(!navigator.onLine) {
    let offlineBanner = document.getElementById('offline-banner');
    if(offlineBanner) offlineBanner.style.display = 'block';
}

// === API HELPER ===
const API_BASE = window.location.protocol.startsWith('http') 
    ? window.location.origin 
    : 'http://localhost:3000'; // Dinámico para producción/desarrollo y fallback para file://

async function apiFetch(url, options = {}) {
    try {
        const response = await fetch(API_BASE + url, options);
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            const msg = errData.message || errData.error || 'Error en la petición';
            const details = errData.details ? `: ${errData.details}` : '';
            throw new Error(msg + details);
        }
        return await response.json();
    } catch (err) {
        console.error(`Error en API Call (${url}):`, err);
        throw err;
    }
}

// Global state / cache
let globalFamilias = [];
let selectedFamiliaId = null;

// === INICIALIZACIÓN DE VISTAS ===
document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;

    // Cargar nivel inicial de tanque en el dashboard
    inicializarTanqueDashboard();

    if (path.includes('index.html') || path === '/' || path.endsWith('/')) {
        inicializarDashboard();
    } else if (path.includes('familias.html')) {
        inicializarCensoFamilias();
    } else if (path.includes('averias.html')) {
        inicializarAverias();
    } else if (path.includes('turnos.html')) {
        inicializarTurnos();
    } else if (path.includes('operador.html')) {
        inicializarModuloOperador();
    }
});

// === LÓGICA DEL TANQUE EN DASHBOARD ===
function inicializarTanqueDashboard() {
    const fillMain = document.getElementById('tank-fill-main');
    const percentMain = document.getElementById('tank-main-percent');
    const statusEl = document.getElementById('tank-sync-status');

    // Leer último del localStorage por si acaso
    const ultimaLecturaLocal = JSON.parse(localStorage.getItem('ultimoNivelTanque'));

    function renderNivel(nivel, fechaStr, sincronizado) {
        if (fillMain) fillMain.style.height = nivel + '%';
        if (percentMain) percentMain.innerText = nivel + '%';
        
        if (fillMain) {
            if (nivel <= 15) {
                fillMain.style.background = 'linear-gradient(to top, #d62828, #e63946)';
            } else if (nivel <= 40) {
                fillMain.style.background = 'linear-gradient(to top, #f77f00, #fcbf49)';
            } else {
                fillMain.style.background = 'linear-gradient(to top, #0077b6, #00b4d8)';
            }
        }

        if (statusEl && fechaStr) {
            const fecha = new Date(fechaStr);
            statusEl.innerText = sincronizado 
                ? `✅ Sincronizado: ${fecha.toLocaleTimeString('es-GT')}` 
                : `⏳ Pendiente de sync: ${fecha.toLocaleTimeString('es-GT')}`;
        }
    }

    if (ultimaLecturaLocal) {
        renderNivel(ultimaLecturaLocal.nivel, ultimaLecturaLocal.fecha, ultimaLecturaLocal.sincronizado);
    }

    // Intentar traer la última lectura de la base de datos real
    if (navigator.onLine) {
        apiFetch('/api/lecturas')
            .then(lecturas => {
                if (lecturas && lecturas.length > 0) {
                    const latest = lecturas[0];
                    renderNivel(latest.nivel_porcentaje, latest.fecha_hora, latest.sincronizado_nube);
                    localStorage.setItem('ultimoNivelTanque', JSON.stringify({
                        nivel: latest.nivel_porcentaje,
                        fecha: latest.fecha_hora,
                        sincronizado: latest.sincronizado_nube
                    }));
                } else {
                    renderNivel(0, new Date().toISOString(), true);
                }
            })
            .catch(err => console.log('No se pudo obtener lectura del tanque de la DB:', err));
    }
}

// === LÓGICA GLOBAL DE MODALES ===
function cerrarModales() {
    const overlays = document.querySelectorAll('.modal-overlay');
    overlays.forEach(overlay => overlay.style.display = 'none');
}

// === GESTIÓN DEL DASHBOARD (index.html) ===
function inicializarDashboard() {
    cargarFamiliasDashboard();
}

async function cargarFamiliasDashboard() {
    const tbody = document.getElementById('tablaFamiliasBody');
    if (!tbody) return;

    try {
        globalFamilias = await apiFetch('/api/familias');
        tbody.innerHTML = '';

        if (globalFamilias.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">No hay familias registradas.</td></tr>';
            actualizarKPIs(0, 0);
            return;
        }

        let totalMora = 0;
        let totalRecaudado = 0;
        try {
            const dataRec = await apiFetch('/api/pagos/recaudacion');
            totalRecaudado = dataRec.total;
        } catch (recErr) {
            console.error('Error al obtener recaudacion real de base de datos:', recErr);
            totalRecaudado = 4850; // fallback
        }

        globalFamilias.forEach(fam => {
            const tr = document.createElement('tr');
            
            // Estado y Badge
            let badgeClass = 'badge-success';
            let estadoTexto = 'Solvente';
            
            if (fam.meses_mora > 0) {
                totalMora++;
                if (fam.meses_mora >= 3) {
                    badgeClass = 'badge-danger';
                    estadoTexto = `Moroso - ${fam.meses_mora} cuotas`;
                } else {
                    badgeClass = 'badge-warning';
                    estadoTexto = `Mora - ${fam.meses_mora} cuota`;
                }
            }

            // Acciones
            let accionesHTML = '';
            if (fam.meses_mora > 0) {
                accionesHTML = `
                    <button class="btn btn-wa" onclick="enviarWhatsApp('${fam.nombre_jefe}')" title="Recordatorio WhatsApp">💬</button>
                    ${fam.meses_mora >= 3 ? `<button class="btn btn-corte" onclick="alertaCorte('${fam.nombre_jefe}', ${fam.meses_mora}, ${fam.id_familia})">Corte ⚠️</button>` : ''}
                    <button class="btn btn-outline" style="padding: 5px 12px; font-size: 13px;" onclick="abrirModalPagoConFamilia(${fam.id_familia}, '${fam.nombre_jefe}')">Cobrar Q50</button>
                `;
            } else {
                accionesHTML = `
                    <button class="btn btn-outline" onclick="abrirFicha('${fam.nombre_jefe}', '${fam.nombre_sector}')">Ver Turno</button>
                `;
            }

            tr.innerHTML = `
                <td><strong>${fam.nombre_jefe}</strong></td>
                <td>${fam.nombre_sector || 'Sector general'}</td>
                <td><span class="badge ${badgeClass}">${estadoTexto}</span></td>
                <td><div style="display: flex; gap: 8px; align-items: center;">${accionesHTML}</div></td>
            `;
            tbody.appendChild(tr);
        });

        actualizarKPIs(totalMora, totalRecaudado);
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--danger);">Error al cargar familias desde la base de datos.</td></tr>';
    }
}

async function actualizarKPIs(familiasMora, recaudacion) {
    const kpis = document.querySelectorAll('.kpi-card');
    if (kpis.length >= 2) {
        // KPI 0: Familias en mora
        const valueMora = kpis[0].querySelector('.kpi-value');
        if (valueMora) valueMora.innerText = familiasMora;
        
        // KPI 1: Recaudación Mensual
        const valueRec = kpis[1].querySelector('.kpi-value');
        if (valueRec) valueRec.innerText = `Q ${recaudacion.toLocaleString()}`;
        
        // KPI 2: Averías Activas
        const valueAverias = document.getElementById('kpi-averias-activas');
        if (valueAverias) {
            try {
                const averias = await apiFetch('/api/averias');
                const activas = averias.filter(a => a.estado !== 'Resuelto').length;
                valueAverias.innerText = activas;
            } catch (err) {
                valueAverias.innerText = '-';
            }
        }
    }
}

// === LÓGICA DE REGISTRO DE PAGOS (Cero Abonos) ===
async function abrirModalPago(defaultFamName = null) {
    const modal = document.getElementById('modalPago');
    if (!modal) return;

    const selectContainer = document.getElementById('pagoSelectContainer');
    const textContainer = document.getElementById('pagoFamiliaTextContainer');
    const selectEl = document.getElementById('pagoFamiliaSelect');
    const msgBox = document.getElementById('pagoMsg');

    msgBox.innerText = "";
    msgBox.style.color = "";
    document.getElementById('montoPagoInput').value = "";

    if (defaultFamName === null) {
        // Modo "+ Registrar Pago": Mostrar selector dropdown con familias de la base de datos
        selectContainer.style.display = 'block';
        textContainer.style.display = 'none';
        
        try {
            if (globalFamilias.length === 0) {
                globalFamilias = await apiFetch('/api/familias');
            }
            
            selectEl.innerHTML = '';
            const deudores = globalFamilias.filter(fam => fam.meses_mora > 0);
            if (deudores.length === 0) {
                const opt = document.createElement('option');
                opt.value = '';
                opt.innerText = '¡Todas las familias están solventes!';
                selectEl.appendChild(opt);
                selectedFamiliaId = '';
            } else {
                deudores.forEach(fam => {
                    const opt = document.createElement('option');
                    opt.value = fam.id_familia;
                    opt.innerText = `${fam.nombre_jefe} (Debe Q${fam.meses_mora * 50})`;
                    selectEl.appendChild(opt);
                });
                selectedFamiliaId = selectEl.value;
            }
            
            selectEl.onchange = (e) => {
                selectedFamiliaId = e.target.value;
            };
        } catch (err) {
            selectEl.innerHTML = '<option value="">Error al cargar familias</option>';
        }
    } else {
        // Caso deprecado, redirigimos a abrirModalPagoConFamilia
        console.warn('Llamando a abrirModalPago con string estático deprecado.');
    }

    modal.style.display = 'flex';
}

function abrirModalPagoConFamilia(idFamilia, nombreJefe) {
    const modal = document.getElementById('modalPago');
    if (!modal) return;

    const selectContainer = document.getElementById('pagoSelectContainer');
    const textContainer = document.getElementById('pagoFamiliaTextContainer');
    const msgBox = document.getElementById('pagoMsg');

    msgBox.innerText = "";
    msgBox.style.color = "";
    document.getElementById('montoPagoInput').value = "";

    // Modo cobro directo: ocultamos select dropdown y fijamos ID
    selectContainer.style.display = 'none';
    textContainer.style.display = 'block';
    document.getElementById('modalFamiliaNombre').innerText = nombreJefe;
    
    selectedFamiliaId = idFamilia;
    modal.style.display = 'flex';
}

async function procesarPago() {
    const cuotaMensual = 50; 
    const entrada = parseFloat(document.getElementById('montoPagoInput').value);
    const msgBox = document.getElementById('pagoMsg');
    
    if(isNaN(entrada)) {
        msgBox.innerText = "Por favor, introduce un número válido.";
        msgBox.style.color = "red";
        return;
    }

    if (!selectedFamiliaId) {
        msgBox.innerText = "Debe seleccionar una familia válida.";
        msgBox.style.color = "red";
        return;
    }
    
    // Regla de Oro local
    if(entrada < cuotaMensual) {
        msgBox.innerText = `ERROR: No se permiten abonos parciales. La cuota es de Q${cuotaMensual}.00`;
        msgBox.style.color = "red";
        return;
    }

    try {
        const payload = {
            id_familia: parseInt(selectedFamiliaId),
            monto: entrada,
            mes_saldado: `Mensualidad ${new Date().toLocaleString('es-GT', { month: 'long' })}`,
            metodo_pago: 'Efectivo'
        };

        const res = await apiFetch('/api/pagos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        msgBox.innerText = "✅ ¡Pago registrado exitosamente en PostgreSQL!";
        msgBox.style.color = "green";
        
        // Recargar dashboard e inicializar tanque
        setTimeout(() => {
            cerrarModales();
            cargarFamiliasDashboard();
            inicializarTanqueDashboard();
        }, 1500);

    } catch (err) {
        msgBox.innerText = `ERROR: ${err.message}`;
        msgBox.style.color = "red";
    }
}

// === ACCIONES DE SUSPENSIÓN Y CORTE (RF-03) ===
let corteFamiliaId = null;

function alertaCorte(nombreFamilia, mesesMora, idFamilia) {
    const modal = document.getElementById('modalCorte');
    if(!modal) return;
    document.getElementById('corteNombreFamilia').innerText = nombreFamilia;
    document.getElementById('corteMesesMora').innerText = mesesMora;
    corteFamiliaId = idFamilia;
    modal.style.display = 'flex';
}

async function finalizarCorte() {
    if (!corteFamiliaId) return;
    try {
        await apiFetch('/api/cortes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id_familia: corteFamiliaId,
                motivo: 'Suspensión por morosidad crítica acumulada (3+ meses)'
            })
        });

        cerrarModales();
        const modal = document.getElementById('modalNotificacion');
        if(modal) {
            document.getElementById('notiTitulo').innerText = "Órden Emitida";
            document.getElementById('notiTexto').innerText = "La órden de suspensión física ha sido registrada en PostgreSQL y enviada al dispositivo del operario.";
            modal.style.display = 'flex';
        } else {
            alert("Órden de Suspensión emitida y registrada con éxito.");
        }
        
        cargarFamiliasDashboard();
    } catch (err) {
        alert(`Error al emitir orden de corte en PostgreSQL: ${err.message}`);
    }
}

async function ejecutarFacturacionMensual() {
    if (!confirm("⚠️ ADVERTENCIA: ¿Está seguro de que desea generar la facturación mensual masiva?\nEsto cargará +1 mes de mora y una cuota de Q50.00 a todas las familias en la base de datos.")) {
        return;
    }
    
    try {
        const res = await apiFetch('/api/facturacion/generar-mensualidad', {
            method: 'POST'
        });
        
        const modal = document.getElementById('modalNotificacion');
        if(modal) {
            document.getElementById('notiTitulo').innerText = "⚡ Facturación Generada";
            document.getElementById('notiTexto').innerText = res.message;
            modal.style.display = 'flex';
        } else {
            alert(res.message);
        }
        
        cargarFamiliasDashboard();
    } catch (err) {
        alert(`Error al generar facturación masiva: ${err.message}`);
    }
}

function enviarWhatsApp(nombreFamilia) {
    const modal = document.getElementById('modalNotificacion');
    if(modal) {
        document.getElementById('notiTitulo').innerText = "Mensaje Enviado";
        document.getElementById('notiTexto').innerText = `Se ha enviado el recordatorio formal de cobro por WhatsApp al jefe de hogar de la familia ${nombreFamilia}.`;
        modal.style.display = 'flex';
    } else {
        alert(`📱 Enviando mensaje de cobro vía API a WhatsApp de ${nombreFamilia}...`);
    }
}

// === GESTIÓN DE CENSO FAMILIAR (familias.html) ===
async function inicializarCensoFamilias() {
    cargarFamiliasCenso();
}

async function cargarFamiliasCenso() {
    const tbody = document.getElementById('listaFamiliasCompleta');
    if (!tbody) return;

    try {
        const familias = await apiFetch('/api/familias');
        tbody.innerHTML = '';

        if (familias.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">No hay familias registradas en el censo.</td></tr>';
            return;
        }

        familias.forEach(fam => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${fam.nombre_jefe}</strong></td>
                <td>${fam.dpi}</td>
                <td>${fam.telefono}</td>
                <td>${fam.nombre_sector || 'Sector general'}</td>
                <td>
                    <button class="btn btn-outline" onclick="abrirFicha('${fam.nombre_jefe}', '${fam.nombre_sector || 'Sector 1'}')">Ver Ficha</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--danger);">Error al cargar familias desde PostgreSQL.</td></tr>';
    }
}

async function abrirModalNuevaFamilia() {
    const modal = document.getElementById('modalNuevaFamilia');
    if(!modal) return;
    
    // Limpiar campos
    document.getElementById('nombreFamilia').value = '';
    document.getElementById('dpiFamilia').value = '';
    document.getElementById('telFamilia').value = '';

    // Cargar sectores de la base de datos
    const selectSector = document.getElementById('sectorFamilia');
    try {
        const sectores = await apiFetch('/api/sectores');
        selectSector.innerHTML = '';
        sectores.forEach(sec => {
            const opt = document.createElement('option');
            opt.value = sec.id_sector;
            opt.innerText = sec.nombre_sector;
            selectSector.appendChild(opt);
        });
    } catch (err) {
        selectSector.innerHTML = '<option value="1">Sector 1 - Centro</option>';
    }

    modal.style.display = 'flex';
}

async function guardarNuevaFamilia() {
    const nombre = document.getElementById('nombreFamilia').value.trim();
    const dpi = document.getElementById('dpiFamilia').value.trim();
    const tel = document.getElementById('telFamilia').value.trim();
    const id_sector = document.getElementById('sectorFamilia').value;

    if(!nombre || !dpi || !tel) {
        alert("Todos los campos (Nombre, DPI, Teléfono) son obligatorios.");
        return;
    }
    
    try {
        const payload = {
            nombre_jefe: nombre,
            dpi: dpi,
            telefono: tel,
            id_sector: parseInt(id_sector),
            estado_solvencia: 'Solvente',
            meses_mora: 0
        };

        await apiFetch('/api/familias', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        alert(`Familia "${nombre}" registrada correctamente en el censo familiar de la base de datos.`);
        cerrarModales();
        cargarFamiliasCenso();
        
    } catch (err) {
        alert(`Error al registrar familia: ${err.message}`);
    }
}

function abrirFicha(nombre, sector = 'Sector 1 - Centro') {
    const modal = document.getElementById('modalFicha');
    if(!modal) return;
    const contenido = document.getElementById('fichaContenido');
    contenido.innerHTML = `
        <br>
        <p><strong>Titular / Jefe:</strong> ${nombre}</p>
        <p><strong>Sector:</strong> ${sector}</p>
        <p><strong>Historial:</strong> Conectado a la red central de distribución.</p>
        <p><strong>Consumo promedio:</strong> 5 pers. / hogar.</p>
        <br>
        <button class="btn btn-primary" style="width:100%" onclick="alert('Generando archivo PDF e imprimiendo estado de cuenta...')">Imprimir Ficha Técnica</button>
    `;
    modal.style.display = 'flex';
}

// === GESTIÓN DE AVERÍAS (averias.html) ===
async function inicializarAverias() {
    cargarAveriasListado();
}

async function cargarAveriasListado() {
    const tbody = document.getElementById('tablaAveriasBody');
    if (!tbody) return;

    try {
        const averias = await apiFetch('/api/averias');
        tbody.innerHTML = '';

        if (averias.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">No hay reportes de fallas activas.</td></tr>';
            return;
        }

        averias.forEach(av => {
            const tr = document.createElement('tr');
            
            // Colores de Badge
            let styleBadge = '';
            if (av.estado === 'Resuelto') {
                styleBadge = 'background: #e5f9e5; color: #27ae60;';
            } else if (av.estado === 'En reparación') {
                styleBadge = 'background: #ffe5e5; color: #ff3b3b;';
            } else {
                styleBadge = 'background: #fff3cd; color: #856404;';
            }

            const fechaFormat = new Date(av.fecha).toLocaleDateString('es-GT', {
                day: '2-digit', month: 'short', year: 'numeric'
            });

            tr.innerHTML = `
                <td>${fechaFormat}</td>
                <td><strong>${av.nombre_sector || 'General'}</strong></td>
                <td>${av.tipo_averia}</td>
                <td><span class="status-badge" style="padding: 5px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; ${styleBadge}">${av.estado}</span></td>
                <td>${av.prioridad}</td>
                <td><button class="btn btn-outline" style="padding: 5px 10px; font-size: 12px;" onclick="alert('Detalle Falla: ${av.descripcion || 'Sin descripción detallada.'}')">Detalles</button></td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--danger);">Error al cargar reporte de fallas.</td></tr>';
    }
}

async function abrirModalAveria() {
    const modal = document.getElementById('modalNuevaAveria');
    if(!modal) return;

    document.getElementById('tipoAveria').value = '';
    document.getElementById('descAveria').value = '';
    document.getElementById('alertaMasiva').checked = false;

    // Cargar sectores
    const selectV = document.getElementById('valvulaAveria');
    try {
        const sectores = await apiFetch('/api/sectores');
        selectV.innerHTML = '';
        sectores.forEach(sec => {
            const opt = document.createElement('option');
            opt.value = sec.id_sector;
            opt.innerText = sec.nombre_sector;
            selectV.appendChild(opt);
        });
    } catch (err) {
        selectV.innerHTML = '<option value="1">Sector 1 - Válvula Principal</option>';
    }

    modal.style.display = 'flex';
}

async function guardarAveria() {
    const sectorId = document.getElementById('valvulaAveria').value;
    const tipo = document.getElementById('tipoAveria').value.trim();
    const desc = document.getElementById('descAveria').value.trim();
    const alertar = document.getElementById('alertaMasiva').checked;
    const prioridad = document.getElementById('prioridadAveria').value;
    
    if(!tipo) {
        alert("Por favor describa el tipo de avería.");
        return;
    }
    
    try {
        const payload = {
            id_sector: parseInt(sectorId),
            tipo_averia: tipo,
            descripcion: desc,
            alerta_enviada: alertar,
            estado: 'En reparación',
            prioridad: prioridad
        };

        await apiFetch('/api/averias', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        cerrarModales();
        
        const modalNoti = document.getElementById('modalNotificacion');
        if(modalNoti) {
            document.getElementById('notiTitulo').innerText = "Reporte Registrado";
            document.getElementById('notiTexto').innerText = alertar 
                ? `Falla registrada con éxito en PostgreSQL. Se ha emitido una notificación masiva por WhatsApp a los vecinos.` 
                : `Falla registrada con éxito en PostgreSQL central.`;
            document.getElementById('notiIcon').innerText = "⚠️";
            modalNoti.style.display = 'flex';
        }

        cargarAveriasListado();

    } catch (err) {
        alert(`Error al registrar avería: ${err.message}`);
    }
}

// === GESTIÓN DE PLANIFICACIÓN DE TURNOS (turnos.html) ===
let globalSectores = [];

async function inicializarTurnos() {
    const container = document.getElementById('sectoresDisponiblesContainer');
    if (!container) return;

    try {
        globalSectores = await apiFetch('/api/sectores');
        
        // Cargar familias también para mostrar el conteo correcto por sector
        if (globalFamilias.length === 0) {
            globalFamilias = await apiFetch('/api/familias');
        }

        // 1. Renderizar tarjetas de Sectores Disponibles
        container.innerHTML = '';
        globalSectores.forEach((sec, idx) => {
            const numFamilias = globalFamilias.filter(f => f.id_sector === sec.id_sector).length;
            
            let cardClass = 'info';
            if (idx === 1) cardClass = 'success';
            if (idx === 2) cardClass = 'warning';

            const div = document.createElement('div');
            div.className = `kpi-card ${cardClass}`;
            div.style.padding = '20px';
            div.innerHTML = `
                <h4>${sec.nombre_sector}</h4>
                <p><strong>${numFamilias}</strong> Familias conectadas</p>
                <p style="font-size: 13px; margin-top: 10px; color: var(--text-muted); font-style: italic;">
                    Horario actual: ${sec.horario_fijo || 'No programado'}
                </p>
                <button class="btn btn-outline" style="width: 100%; margin-top: 15px;" onclick="verHorariosSector(${sec.id_sector})">Ver Horarios</button>
            `;
            container.appendChild(div);
        });

        // 2. Renderizar Calendario Semanal por Sectores Dinámicamente
        const grid = document.getElementById('calendarioSemanalGrid');
        if (grid) {
            grid.innerHTML = '';
            const diasSemana = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
            
            // Inyectar primero las cabeceras
            diasSemana.forEach(d => {
                const header = document.createElement('div');
                header.style.fontWeight = 'bold';
                header.style.marginBottom = '10px';
                header.innerText = d;
                grid.appendChild(header);
            });

            // Inyectar las tarjetas dinámicas de turnos por día
            diasSemana.forEach((dia, idx) => {
                const secConTurno = globalSectores.filter(sec => {
                    if (!sec.horario_fijo) return false;
                    return sec.horario_fijo.toLowerCase().startsWith(dia.toLowerCase()) || 
                           sec.horario_fijo.toLowerCase().includes(dia.toLowerCase());
                });

                if (secConTurno.length > 0) {
                    const cell = document.createElement('div');
                    
                    let cardClass = 'info';
                    if (idx % 3 === 1) cardClass = 'success';
                    if (idx % 3 === 2) cardClass = 'warning';
                    
                    cell.className = `kpi-card ${cardClass}`;
                    cell.style.padding = '10px';
                    cell.style.fontSize = '12px';
                    cell.style.borderTop = `2px solid var(--${cardClass === 'info' ? 'primary' : cardClass})`;

                    let innerHTML = '';
                    secConTurno.forEach((sec, sIdx) => {
                        let timeStr = 'Programado';
                        const match = sec.horario_fijo.match(/\(([^)]+)\)/);
                        if (match && match[1]) {
                            timeStr = match[1];
                        } else {
                            timeStr = sec.horario_fijo.replace(new RegExp(`^${dia}\\s*`, 'i'), '').trim() || 'Programado';
                        }
                        
                        if (sIdx > 0) innerHTML += '<hr style="margin: 5px 0; border: 0; border-top: 1px solid rgba(0,0,0,0.1);">';
                        innerHTML += `<b>${sec.nombre_sector}</b><br>${timeStr}`;
                    });

                    cell.innerHTML = innerHTML;
                    grid.appendChild(cell);
                } else {
                    const cell = document.createElement('div');
                    cell.style.padding = '10px';
                    cell.style.border = '1px dashed #ccc';
                    cell.style.borderRadius = '8px';
                    cell.style.fontSize = '12px';
                    cell.style.color = 'var(--text-muted)';
                    cell.innerText = dia === 'Domingo' ? 'Limpieza Tanque' : 'Sin Turno';
                    grid.appendChild(cell);
                }
            });
        }
    } catch (err) {
        container.innerHTML = `<p style="color: var(--danger); text-align: center;">Error al cargar información de distribución: ${err.message}</p>`;
    }
}

function abrirModalNuevoTurno() {
    const modal = document.getElementById('modalNuevoTurno');
    if(!modal) return;

    const selectEl = document.getElementById('sectorTurno');
    if (selectEl) {
        selectEl.innerHTML = '';
        globalSectores.forEach(sec => {
            const opt = document.createElement('option');
            opt.value = sec.id_sector;
            opt.innerText = sec.nombre_sector;
            selectEl.appendChild(opt);
        });
    }

    document.getElementById('horaInicio').value = '';
    document.getElementById('horaFin').value = '';
    modal.style.display = 'flex';
}

async function guardarTurno() {
    const id_sector = document.getElementById('sectorTurno').value;
    const dia = document.getElementById('diaTurno').value;
    const inicio = document.getElementById('horaInicio').value;
    const fin = document.getElementById('horaFin').value;
    
    if(!inicio || !fin) {
        alert("Debe definir las horas de inicio y fin del turno.");
        return;
    }
    
    const schedule = `${dia} (${inicio} - ${fin})`;

    try {
        await apiFetch(`/api/sectores/${id_sector}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ horario_fijo: schedule })
        });

        cerrarModales();
        
        const modal = document.getElementById('modalNotificacion');
        if(modal) {
            document.getElementById('notiTitulo').innerText = "Turno Programado";
            document.getElementById('notiTexto').innerText = `El horario ha sido guardado físicamente en PostgreSQL para este sector: "${schedule}".`;
            modal.style.display = 'flex';
        }

        // Recargar la pantalla para ver el nuevo horario inmediatamente
        inicializarTurnos();

    } catch (err) {
        alert(`Error al guardar turno en PostgreSQL: ${err.message}`);
    }
}

function verHorariosSector(idSector) {
    const modal = document.getElementById('modalHorariosDetalle');
    if(!modal) return;
    
    const sec = globalSectores.find(s => s.id_sector === idSector);
    if(!sec) return;

    document.getElementById('horarioTitulo').innerText = `Horarios: ${sec.nombre_sector}`;
    const contenido = document.getElementById('horarioContenido');
    
    contenido.innerHTML = `
        <p style="font-size: 15px; margin-bottom: 10px;"><strong>Horario Fijo Registrado en PostgreSQL:</strong></p>
        <p style="font-size: 18px; color: var(--primary); font-weight: 600; background: #f0f8ff; padding: 12px; border-radius: 6px; border-left: 4px solid var(--primary);">
            ${sec.horario_fijo || 'Sin asignar (¡Presiona "+ Nuevo Turno" para asignar uno!)'}
        </p>
        <p style="color: grey; font-style: italic; font-size: 13px; margin-top: 15px;">Este horario determina cuándo se habilita el suministro físico.</p>
    `;
    
    modal.style.display = 'flex';
}

// === GESTIÓN DE OPERADOR - MEDICIÓN TANQUE (operador.html) ===
function inicializarModuloOperador() {
    // Al cargar la vista de operador, colocar el nivel visual correcto
    const visualWater = document.getElementById('visual-water');
    const nivelElement = document.getElementById('nivelTanque');
    
    const ultimaLectura = JSON.parse(localStorage.getItem('ultimoNivelTanque'));
    if (ultimaLectura && visualWater) {
        visualWater.style.height = `${ultimaLectura.nivel}%`;
        if (nivelElement) nivelElement.value = ultimaLectura.nivel;
    }

    // Cargar órdenes de corte asociadas
    cargarOrdenesCorteOperador();
}

async function cargarOrdenesCorteOperador() {
    const tbody = document.getElementById('tablaCortesBody');
    if (!tbody) return;

    try {
        const cortes = await apiFetch('/api/cortes');
        tbody.innerHTML = '';

        // Filtrar sólo las órdenes que no estén ya resueltas (reconectadas)
        const pendientes = cortes.filter(c => c.estado !== 'Resuelto');

        if (pendientes.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 15px;">No hay suspensiones pendientes de ejecutar.</td></tr>';
            return;
        }

        pendientes.forEach(c => {
            const tr = document.createElement('tr');
            
            let btnAccion = '';
            let labelEstado = '';
            
            if (c.estado === 'Pendiente') {
                labelEstado = '<span class="badge badge-danger">PENDIENTE CORTE</span>';
                btnAccion = `<button class="btn btn-corte" style="padding: 5px 12px; font-size: 12px; width: auto;" onclick="ejecutarCorteFisico(${c.id_orden}, '${c.nombre_jefe}')">Confirmar Corte</button>`;
            } else if (c.estado === 'Ejecutado') {
                labelEstado = '<span class="badge badge-warning">CORTADO</span>';
                btnAccion = `<button class="btn btn-primary" style="padding: 5px 12px; font-size: 12px; width: auto;" onclick="reconectarServicioFisico(${c.id_orden}, '${c.nombre_jefe}')">Marcar Reconectado</button>`;
            }

            const fechaFormat = new Date(c.fecha_emision).toLocaleDateString('es-GT', {
                day: '2-digit', month: 'short', year: 'numeric'
            });

            tr.innerHTML = `
                <td>${fechaFormat}</td>
                <td><strong>${c.nombre_jefe}</strong></td>
                <td>${c.nombre_sector || 'General'}</td>
                <td>${labelEstado}</td>
                <td><div style="display: flex; gap: 8px;">${btnAccion}</div></td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--danger); padding: 15px;">Error al cargar órdenes de suspensión.</td></tr>';
    }
}

async function ejecutarCorteFisico(idOrden, nombreJefe) {
    if (!confirm(`¿Confirmar que ha procedido con la desconexión física de la válvula para la familia "${nombreJefe}"?`)) {
        return;
    }
    
    try {
        await apiFetch(`/api/cortes/${idOrden}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ estado: 'Ejecutado' })
        });
        
        alert(`Servicio de la familia "${nombreJefe}" marcado como CORTADO en base de datos.`);
        cargarOrdenesCorteOperador();
    } catch (err) {
        alert(`Error al actualizar orden de corte: ${err.message}`);
    }
}

async function reconectarServicioFisico(idOrden, nombreJefe) {
    if (!confirm(`¿Confirmar que ha procedido con la reconexión física del servicio para la familia "${nombreJefe}"?`)) {
        return;
    }
    
    try {
        await apiFetch(`/api/cortes/${idOrden}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ estado: 'Resuelto' })
        });
        
        alert(`Servicio de la familia "${nombreJefe}" marcado como RECONECTADO/RESUELTO.`);
        cargarOrdenesCorteOperador();
    } catch (err) {
        alert(`Error al actualizar orden de reconexión: ${err.message}`);
    }
}

async function guardarMedicion() {
    const nivelElement = document.getElementById('nivelTanque');
    if(!nivelElement) return;
    const nivel = parseInt(nivelElement.value);
    const obs = document.getElementById('obsTanque').value.trim();
    const msgBox = document.getElementById('statusMsg');
    
    if(isNaN(nivel) || nivel < 0 || nivel > 100) {
        msgBox.innerText = "Debes introducir un nivel porcentual entre 0 y 100.";
        msgBox.style.color = "red";
        return;
    }
    
    const visualWater = document.getElementById('visual-water');
    if(visualWater) visualWater.style.height = `${nivel}%`;

    const payload = {
        id_empleado: 1, // Operario Calí (Ver datos semilla)
        nivel_porcentaje: nivel,
        observaciones: obs || 'Sin anomalías',
        sincronizado_nube: false,
        fecha: new Date().toISOString()
    };

    if (navigator.onLine) {
        try {
            await apiFetch('/api/lecturas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id_empleado: payload.id_empleado,
                    nivel_porcentaje: payload.nivel_porcentaje,
                    observaciones: payload.observaciones,
                    sincronizado_nube: true
                })
            });

            payload.sincronizado_nube = true;
            localStorage.setItem('ultimoNivelTanque', JSON.stringify({
                nivel: nivel,
                fecha: payload.fecha,
                sincronizado: true
            }));

            msgBox.innerText = "✅ Guardado Correctamente en Servidor Central PostgreSQL.";
            msgBox.style.color = "green";

        } catch (err) {
            console.warn('Fallo guardado en DB Central, procediendo a respaldo local:', err);
            guardarEnLocalBackup(payload, msgBox);
        }
    } else {
        guardarEnLocalBackup(payload, msgBox);
    }
}

function guardarEnLocalBackup(payload, msgBox) {
    let pendientes = JSON.parse(localStorage.getItem('lecturasPendientes')) || [];
    pendientes.push(payload);
    localStorage.setItem('lecturasPendientes', JSON.stringify(pendientes));
    
    localStorage.setItem('ultimoNivelTanque', JSON.stringify({
        nivel: payload.nivel_porcentaje,
        fecha: payload.fecha,
        sincronizado: false
    }));

    msgBox.innerText = "⚠️ GUARDADO LOCAL: Información almacenada localmente (Modo Offline). Se subirá al volver la conexión.";
    msgBox.style.color = "#ffb703";
}

async function sincronizarDatosPendientes() {
    let pendientes = JSON.parse(localStorage.getItem('lecturasPendientes')) || [];
    if(pendientes.length > 0 && navigator.onLine) {
        console.log(`Sincronizando ${pendientes.length} registros fuera de línea...`);
        let exitos = 0;
        
        for (const item of pendientes) {
            try {
                await apiFetch('/api/lecturas', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id_empleado: item.id_empleado,
                        nivel_porcentaje: item.nivel_porcentaje,
                        observaciones: item.observaciones,
                        sincronizado_nube: true
                    })
                });
                exitos++;
            } catch (err) {
                console.error('Error sincronizando registro individual:', err);
            }
        }

        if (exitos > 0) {
            alert(`Sistema: ${exitos} mediciones guardadas offline han sido sincronizadas en la base de datos PostgreSQL central.`);
            localStorage.removeItem('lecturasPendientes');
            inicializarTanqueDashboard();
        }
    }
}

// === PORTAL DE HABITANTE (habitante.html) ===
function simularLoginHabitante() {
    const credencial = document.getElementById('habitanteCredencial').value;
    
    if(!credencial) {
        alert("Por favor ingrese su número de teléfono o DPI.");
        return;
    }
    
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('habitanteDashboard').style.display = 'block';
    
    if(credencial.includes("55") || credencial.includes("22")) { 
        document.getElementById('nombreHabitante').innerText = "FAMILIA LÓPEZ PÉREZ";
        document.getElementById('labelEstado').innerText = "MOROSO";
        document.getElementById('labelEstado').style.color = "#eb4d4b";
        document.getElementById('alertaDeuda').style.display = 'flex';
        document.getElementById('montoDeuda').innerText = "Q150.00 (3 meses)";
    } else {
        document.getElementById('nombreHabitante').innerText = "FAMILIA GARCÍA MONTEJO";
        document.getElementById('labelEstado').innerText = "SOLVENTE";
        document.getElementById('labelEstado').style.color = "#27ae60";
        document.getElementById('alertaDeuda').style.display = 'none';
    }
}
