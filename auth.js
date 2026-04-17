document.getElementById('role').addEventListener('change', function (e) {
    const role = e.target.value;
    const creds = document.getElementById('credentialsFields');
    const habitante = document.getElementById('habitanteField');

    if (role === 'habitante') {
        creds.classList.add('hidden');
        habitante.classList.remove('hidden');
    } else {
        creds.classList.remove('hidden');
        habitante.classList.add('hidden');
    }
});

document.getElementById('loginForm').addEventListener('submit', function (e) {
    e.preventDefault();

    const role = document.getElementById('role').value;
    const user = document.getElementById('username').value;
    const pass = document.getElementById('password').value;
    const dpi = document.getElementById('dpi').value;
    const errorMsg = document.getElementById('errorMessage');

    // Lógica de autenticación basada en tu tabla
    if (role === 'admin' && user === 'admin' && pass === 'admin123') {
        window.location.href = 'index.html';
    }
    else if (role === 'operador' && user === 'operario' && pass === 'op123') {
        window.location.href = 'operador.html';
    }
    else if (role === 'habitante' && dpi.length > 5) {
        // Para habitante simulamos que cualquier DPI/Tel válido entra
        window.location.href = 'habitante.html';
    }
    else {
        errorMsg.classList.remove('hidden');
        setTimeout(() => errorMsg.classList.add('hidden'), 3000);
    }
});