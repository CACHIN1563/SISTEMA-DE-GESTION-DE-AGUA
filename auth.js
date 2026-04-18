(function() {
    const sesion = JSON.parse(localStorage.getItem('sesionActiva'));
    const esPaginaLogin = window.location.pathname.includes('login.html');

    if (!sesion) {
        // Si no hay sesión y no estamos en login, redirigir a login
        if (!esPaginaLogin) {
            window.location.href = 'login.html';
        }
    } else {
        // Si hay sesión y estamos en login, redirigir al dashboard correspondiente
        if (esPaginaLogin) {
            redirigirSegunRol(sesion.rol);
        }
    }

    function redirigirSegunRol(rol) {
        if (rol === 'operario') {
            window.location.href = 'operador.html';
        } else if (rol === 'habitante') {
            window.location.href = 'habitante.html';
        } else {
            window.location.href = 'index.html';
        }
    }

    // Exponer la función de cierre de sesión globalmente
    window.cerrarSesion = function() {
        localStorage.removeItem('sesionActiva');
        window.location.href = 'login.html';
    };
})();
