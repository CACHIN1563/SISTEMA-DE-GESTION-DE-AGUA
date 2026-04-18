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

// === INICIALIZACIÓN: Leer última medición del tanque desde localStorage ===
document.addEventListener('DOMContentLoaded', () => {
    const ultimaLectura = JSON.parse(localStorage.getItem('ultimoNivelTanque'));
    if (ultimaLectura) {
        const nivel = ultimaLectura.nivel;
        // Actualizar barra del Dashboard
        const fillMain = document.getElementById('tank-fill-main');
        const percentMain = document.getElementById('tank-main-percent');
        if (fillMain) fillMain.style.height = nivel + '%';
        if (percentMain) percentMain.innerText = nivel + '%';
        
        // Cambiar color según nivel crítico
        if (fillMain) {
            if (nivel <= 15) {
                fillMain.style.background = 'linear-gradient(to top, #d62828, #e63946)';
            } else if (nivel <= 40) {
                fillMain.style.background = 'linear-gradient(to top, #f77f00, #fcbf49)';
            } else {
                fillMain.style.background = 'linear-gradient(to top, #0077b6, #00b4d8)';
            }
        }

        // Actualizar texto de estado si existe
        const statusEl = document.getElementById('tank-sync-status');
        if (statusEl) {
            const fecha = new Date(ultimaLectura.fecha);
            statusEl.innerText = ultimaLectura.sincronizado 
                ? `✅ Sincronizado: ${fecha.toLocaleTimeString('es-GT')}` 
                : `⏳ Pendiente de sync: ${fecha.toLocaleTimeString('es-GT')}`;
        }
    }
});


// === GESTIÓN GLOBAL DE MODALES ===
function cerrarModales() {
    const overlays = document.querySelectorAll('.modal-overlay');
    overlays.forEach(overlay => overlay.style.display = 'none');
}

// === LÓGICA DEL COMITÉ: Validación Cero Abonos ===
function abrirModalPago(familia) {
    const modal = document.getElementById('modalPago');
    if(!modal) return;
    document.getElementById('modalFamiliaNombre').innerText = familia;
    document.getElementById('pagoMsg').innerText = "";
    document.getElementById('pagoMsg').style.color = "";
    document.getElementById('montoPagoInput').value = "";
    modal.style.display = 'flex';
}

function procesarPago() {
    const cuotaMensual = 50; 
    const entrada = parseFloat(document.getElementById('montoPagoInput').value);
    const msgBox = document.getElementById('pagoMsg');
    
    if(isNaN(entrada)) {
        msgBox.innerText = "Por favor, introduce un número válido.";
        msgBox.style.color = "red";
        return;
    }
    
    if(entrada < cuotaMensual) {
        msgBox.innerText = `ERROR: No se permiten abonos parciales. La cuota es de Q${cuotaMensual}.00`;
        msgBox.style.color = "red";
    } else {
        msgBox.innerText = "Pago registrado exitosamente (Solvente).";
        msgBox.style.color = "green";
        setTimeout(cerrarModales, 1500);
    }
}

// === LÓGICA DE ÓRDEN DE CORTE (RF-03) ===
function alertaCorte(familia) {
    const modal = document.getElementById('modalCorte');
    if(!modal) return;
    document.getElementById('corteNombreFamilia').innerText = familia;
    document.getElementById('corteMesesMora').innerText = "3"; // Simulación
    modal.style.display = 'flex';
}

function finalizarCorte() {
    const modal = document.getElementById('modalNotificacion');
    if(modal) {
        document.getElementById('notiTitulo').innerText = "Órden Emitida";
        document.getElementById('notiTexto').innerText = "La órden de suspensión ha sido enviada al dispositivo del operario.";
        cerrarModales();
        modal.style.display = 'flex';
    } else {
        alert("Órden de Suspensión emitida y enviada al dispositivo del operario.");
        cerrarModales();
    }
}

function enviarWhatsApp(familia) {
    const modal = document.getElementById('modalNotificacion');
    if(modal) {
        document.getElementById('notiTitulo').innerText = "Mensaje Enviado";
        document.getElementById('notiTexto').innerText = `Se ha enviado el recordatorio de cobro por WhatsApp a la familia ${familia}.`;
        modal.style.display = 'flex';
    } else {
        alert(`📱 Enviando mensaje de cobro vía API a WhatsApp de ${familia}...`);
    }
}

// === LÓGICA DE FAMILIAS (CU-01) ===
function abrirModalNuevaFamilia() {
    const modal = document.getElementById('modalNuevaFamilia');
    if(!modal) return;
    modal.style.display = 'flex';
}

function guardarNuevaFamilia() {
    const nombre = document.getElementById('nombreFamilia').value;
    if(!nombre) {
        alert("El nombre es obligatorio");
        return;
    }
    
    alert(`Familia "${nombre}" registrada correctamente en el Censo Familia.`);
    cerrarModales();
    
    // Inyectar en la tabla si estamos en familias.html
    const tabla = document.getElementById('listaFamiliasCompleta');
    if(tabla) {
        const row = tabla.insertRow();
        row.innerHTML = `
            <td>${nombre}</td>
            <td>${document.getElementById('dpiFamilia').value || 'N/A'}</td>
            <td>${document.getElementById('telFamilia').value || 'N/A'}</td>
            <td>${document.getElementById('sectorFamilia').value}</td>
            <td><button class="btn btn-outline" onclick="abrirFicha('${nombre}')">Ver Ficha</button></td>
        `;
    }
}

function abrirFicha(nombre) {
    if(nombre.includes('Lorenzana')) {
        window.location.href = 'turnos.html';
        return;
    }
    const modal = document.getElementById('modalFicha');
    if(!modal) return;
    const contenido = document.getElementById('fichaContenido');
    contenido.innerHTML = `
        <br>
        <p><strong>Titular:</strong> ${nombre}</p>
        <p><strong>Sector:</strong> 1 (Válvula Principal)</p>
        <p><strong>Historial:</strong> Solvente los últimos 6 meses.</p>
        <p><strong>Consumo estipulado:</strong> 5 pers. / hogar.</p>
        <br>
        <button class="btn btn-primary" style="width:100%" onclick="cerrarModales()">Imprimir Estado de Cuenta</button>
    `;
    modal.style.display = 'flex';
}

// === LÓGICA DE TURNOS (CU-04) ===
function abrirModalNuevoTurno() {
    const modal = document.getElementById('modalNuevoTurno');
    if(!modal) return;
    modal.style.display = 'flex';
}

function guardarTurno() {
    const sector = document.getElementById('sectorTurno').value;
    const inicio = document.getElementById('horaInicio').value;
    const fin = document.getElementById('horaFin').value;
    
    if(!inicio || !fin) {
        alert("Debe definir las horas del turno.");
        return;
    }
    
    const modal = document.getElementById('modalNotificacion');
    if(modal) {
        document.getElementById('notiTitulo').innerText = "Turno Programado";
        document.getElementById('notiTexto').innerText = `El ${sector} ha sido programado de ${inicio} a ${fin}.`;
        cerrarModales();
        modal.style.display = 'flex';
    } else {
        alert(`Turno programado para ${sector} de ${inicio} a ${fin}.`);
        cerrarModales();
    }
}

function verHorariosSector(sector) {
    const modal = document.getElementById('modalHorariosDetalle');
    if(!modal) return;
    
    document.getElementById('horarioTitulo').innerText = `Horarios: ${sector}`;
    const contenido = document.getElementById('horarioContenido');
    
    // Datos actualizados para coincidir con la Programación Semanal visual
    let html = "";
    if(sector.includes("Centro")) { // Sector 1
        html = `
            <p><strong>Lunes:</strong> 08:00 AM - 01:00 PM</p>
            <p><strong>Jueves:</strong> 08:00 AM - 01:00 PM</p>
            <p style="color: grey; font-style: italic;">Próximo turno: Lunes</p>
        `;
    } else if(sector.includes("Norte")) { // Sector 2
        html = `
            <p><strong>Martes:</strong> 08:00 AM - 01:00 PM</p>
            <p><strong>Viernes:</strong> 08:00 AM - 01:00 PM</p>
            <p style="color: grey; font-style: italic;">Próximo turno: Martes</p>
        `;
    } else if(sector.includes("Sur")) { // Sector 3
        html = `
            <p><strong>Miércoles:</strong> 08:00 AM - 01:00 PM</p>
            <p><strong>Sábado:</strong> 02:00 PM - 06:00 PM</p>
            <p style="color: grey; font-style: italic;">Próximo turno: Miércoles</p>
        `;
    }
    
    contenido.innerHTML = html;
    modal.style.display = 'flex';
}

// === LÓGICA DE AVERÍAS: Reporte de fallas técnicas ===
function guardarAveria() {
    const valvula = document.getElementById('valvulaAveria').value;
    const tipo = document.getElementById('tipoAveria').value;
    const alertar = document.getElementById('alertaMasiva').checked;
    
    if(!tipo) {
        alert("Por favor describa el tipo de avería.");
        return;
    }
    
    cerrarModales();
    
    const modal = document.getElementById('modalNotificacion');
    if(modal) {
        document.getElementById('notiTitulo').innerText = "Reporte Registrado";
        document.getElementById('notiTexto').innerText = alertar 
            ? `Falla en ${valvula} registrada. Se ha enviado una alerta masiva por WhatsApp a los vecinos.` 
            : `Falla en ${valvula} registrada en el sistema.`;
        document.getElementById('notiIcon').innerText = "⚠️";
        modal.style.display = 'flex';
    }
}

// === LÓGICA DE HABITANTE: Simulación de consulta ===
function simularLoginHabitante() {
    const credencial = document.getElementById('habitanteCredencial').value;
    
    if(!credencial) {
        alert("Por favor ingrese su número de teléfono o DPI.");
        return;
    }
    
    // Simulación de búsqueda en Base de Datos
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('habitanteDashboard').style.display = 'block';
    
    // Casos simulados
    if(credencial.includes("55")) { // Simular moroso
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

// === LÓGICA DE OPERADOR: Guardado de Lecturas del Tanque ===
function guardarMedicion() {
    const nivelElement = document.getElementById('nivelTanque');
    if(!nivelElement) return;
    const nivel = nivelElement.value;
    const obs = document.getElementById('obsTanque').value;
    const msgBox = document.getElementById('statusMsg');
    
    if(!nivel) {
        msgBox.innerText = "Debes introducir un nivel porcentual.";
        msgBox.style.color = "red";
        return;
    }
    
    const visualWater = document.getElementById('visual-water');
    if(visualWater) visualWater.style.height = `${nivel}%`;

    const payload = {
        fecha: new Date().toISOString(),
        nivel: parseInt(nivel),
        observaciones: obs,
        sincronizado: false
    };

    if (navigator.onLine) {
        console.log("Enviando a API Nube: ", payload);
        payload.sincronizado = true;
        msgBox.innerText = "Guardado Correctamente en Servidor Central.";
        msgBox.style.color = "green";
    } else {
        let pendientes = JSON.parse(localStorage.getItem('lecturasPendientes')) || [];
        pendientes.push(payload);
        localStorage.setItem('lecturasPendientes', JSON.stringify(pendientes));
        
        msgBox.innerText = "⚠️ GUARDADO LOCAL: Información pendiente de envío cuando vuelva el Wi-Fi.";
        msgBox.style.color = "#ffb703";
    }
    
    // Guardar el último nivel siempre en localStorage (para que el Dashboard lo lea)
    localStorage.setItem('ultimoNivelTanque', JSON.stringify(payload));
}

function sincronizarDatosPendientes() {
    let pendientes = JSON.parse(localStorage.getItem('lecturasPendientes')) || [];
    if(pendientes.length > 0) {
        setTimeout(() => {
            alert(`Sistema: ${pendientes.length} mediciones guardadas offline acaban de ser subidas a la Base de Datos con éxito.`);
            localStorage.removeItem('lecturasPendientes');
        }, 1000);
    }
}
