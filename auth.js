(function() {
    let sesion = null;
    try {
        sesion = JSON.parse(localStorage.getItem('sesionActiva'));
    } catch (e) {
        console.error("Error parsing sesionActiva:", e);
    }
    
    const path = window.location.pathname;
    const esPaginaLogin = path.includes('login.html');
    
    // Obtener nombre de archivo actual para protección de rutas
    const filename = path.split('/').pop().split('?')[0].split('#')[0].toLowerCase();

    if (!sesion) {
        // Si no hay sesión y no estamos en login, redirigir a login
        if (!esPaginaLogin) {
            window.location.href = 'login.html';
        }
    } else {
        // Si hay sesión y estamos en login, redirigir al dashboard correspondiente
        if (esPaginaLogin) {
            redirigirSegunRol(sesion.rol);
        } else {
            // Protección estricta de rutas según el Rol del usuario
            if (sesion.rol === 'operario') {
                // Operario solo puede ver operador.html, averias.html, turnos.html
                const paginasPermitidas = ['operador.html', 'averias.html', 'turnos.html'];
                if (filename !== 'login.html' && !paginasPermitidas.includes(filename) && filename !== '') {
                    window.location.href = 'operador.html';
                } else if (filename === '') {
                    window.location.href = 'operador.html';
                }
            } else if (sesion.rol === 'tesorero') {
                // Tesorero solo puede ver el dashboard (index.html)
                const paginasPermitidas = ['index.html'];
                if (filename !== 'login.html' && !paginasPermitidas.includes(filename) && filename !== '') {
                    window.location.href = 'index.html';
                } else if (filename === '') {
                    window.location.href = 'index.html';
                }
            } else if (sesion.rol === 'habitante') {
                // Habitante solo puede ver habitante.html
                if (filename !== 'login.html' && filename !== 'habitante.html') {
                    window.location.href = 'habitante.html';
                }
            }
        }
    }

    function redirigirSegunRol(rol) {
        if (rol === 'operario') {
            window.location.href = 'operador.html';
        } else if (rol === 'habitante') {
            window.location.href = 'habitante.html';
        } else if (rol === 'tesorero') {
            window.location.href = 'index.html';
        } else {
            window.location.href = 'index.html';
        }
    }

    // Cierre de sesión global
    window.cerrarSesion = function() {
        localStorage.removeItem('sesionActiva');
        window.location.href = 'login.html';
    };

    // Al cargar el DOM, inyectar el menú y perfil según el rol
    document.addEventListener('DOMContentLoaded', () => {
        if (!sesion) return;

        // 1. Actualizar el perfil del usuario dinámicamente con su nombre real (Pregunta 1)
        const perfilEl = document.querySelector('.user-profile');
        if (perfilEl) {
            let icon = '👤';
            let rolDisplay = 'Comité';
            if (sesion.rol === 'operario') {
                icon = '👷';
                rolDisplay = 'Operador';
            } else if (sesion.rol === 'tesorero') {
                icon = '💳';
                rolDisplay = 'Tesorero';
            } else if (sesion.rol === 'habitante') {
                icon = '👤';
                rolDisplay = 'Habitante';
            } else if (sesion.rol === 'comite') {
                icon = '👑';
                rolDisplay = 'Admin';
            }
            perfilEl.innerHTML = `${sesion.nombre} <span style="font-size: 0.75em; opacity: 0.7; font-weight: normal; margin-left: 5px; background: #e2e8f0; padding: 2px 8px; border-radius: 10px; color: #2d3748;">${rolDisplay}</span> <span>${icon}</span>`;
        }

        // 2. Controlar la visibilidad de las pestañas según su Rol (Pregunta 2)
        const nav = document.querySelector('.sidebar nav');
        if (nav) {
            let menuHTML = '';
            // Detectar la página activa quitando rutas
            const activePage = filename || 'index.html';

            if (sesion.rol === 'comite') {
                // Comité / Admin ve todas las opciones
                menuHTML = `
                    <a href="index.html" class="${activePage === 'index.html' || activePage === '' ? 'active' : ''}">🗂️ Dashboard</a>
                    <a href="familias.html" class="${activePage === 'familias.html' ? 'active' : ''}">👥 Familias</a>
                    <a href="turnos.html" class="${activePage === 'turnos.html' ? 'active' : ''}">🗓️ Turnos Fijos</a>
                    <a href="operador.html" class="${activePage === 'operador.html' ? 'active' : ''}">⚙️ Módulo Operador</a>
                    <a href="averias.html" class="${activePage === 'averias.html' ? 'active' : ''}">⚠️ Averías</a>
                    <a href="habitante.html" class="${activePage === 'habitante.html' ? 'active' : ''}">👤 Portal Habitante</a>
                `;
            } else if (sesion.rol === 'operario') {
                // Operario sólo ve Módulo Operativo (operador.html), Averías y Turnos
                menuHTML = `
                    <a href="operador.html" class="${activePage === 'operador.html' || activePage === '' ? 'active' : ''}">⚙️ Módulo Operador</a>
                    <a href="averias.html" class="${activePage === 'averias.html' ? 'active' : ''}">⚠️ Averías</a>
                    <a href="turnos.html" class="${activePage === 'turnos.html' ? 'active' : ''}">🗓️ Turnos Fijos</a>
                `;
            } else if (sesion.rol === 'tesorero') {
                // Tesorero sólo ve Dashboard
                menuHTML = `
                    <a href="index.html" class="${activePage === 'index.html' || activePage === '' ? 'active' : ''}">🗂️ Dashboard</a>
                `;
            } else if (sesion.rol === 'habitante') {
                // Habitante sólo ve Portal Habitante
                menuHTML = `
                    <a href="habitante.html" class="${activePage === 'habitante.html' ? 'active' : ''}">👤 Portal Habitante</a>
                `;
            }

            // Botón de cerrar sesión unificado
            menuHTML += `
                <div style="margin-top: 50px; border-top: 1px solid #eee; padding-top: 20px;">
                    <a href="#" onclick="cerrarSesion()" style="color: var(--danger);">🚪 Cerrar Sesión</a>
                </div>
            `;

            nav.innerHTML = menuHTML;
        }
        
        // 3. Ajustar el subtítulo del logo según el rol
        const logoSub = document.querySelector('.logo span:not(.logo-icon)');
        if (logoSub) {
            if (sesion.rol === 'comite') {
                logoSub.innerText = 'Panel Administrativo';
            } else if (sesion.rol === 'operario') {
                logoSub.innerText = 'Módulo Operativo';
            } else if (sesion.rol === 'tesorero') {
                logoSub.innerText = 'Tesorería';
            } else if (sesion.rol === 'habitante') {
                logoSub.innerText = 'Portal Habitante';
            }
        }
    });
})();
