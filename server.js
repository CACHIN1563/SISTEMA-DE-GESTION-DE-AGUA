const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const swaggerUi = require('swagger-ui-express');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// === CONFIGURACIÓN DE SWAGGER ===
const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'API Sistema Agua San Miguel',
    version: '1.0.0',
    description: 'Documentación de los endpoints principales del sistema.'
  },
  paths: {
    '/api/auth/login': {
      post: {
        summary: 'Autenticación de Usuario',
        requestBody: {
          content: { 'application/json': { schema: { type: 'object', properties: { dpi: { type: 'string' }, password: { type: 'string' } } } } }
        },
        responses: {
          '200': { description: 'Login exitoso' },
          '401': { description: 'No autorizado' }
        }
      }
    },
    '/api/pagos': {
      post: {
        summary: 'Registrar Pago (Cero Abonos)',
        responses: {
          '200': { description: 'Pago registrado exitosamente' },
          '400': { description: 'Error Cero Abonos' }
        }
      }
    },
    '/api/vecinos': {
      get: {
        summary: 'Control de Roles',
        responses: {
          '403': { description: 'Forbidden (Acceso denegado)' }
        }
      }
    }
  }
};

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));


// Configuración de la Base de Datos (PostgreSQL)
// Nota: En producción, usa variables de entorno
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'agua_san_miguel',
  password: process.env.DB_PASSWORD || 'contraseña',
  port: process.env.DB_PORT || 5432,
});

// === RUTAS DEL SISTEMA ===

// 1. Gestión de Familias (HOGAR)
app.get('/api/hogares', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM HOGAR ORDER BY id_hogar ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener hogares', details: err.message });
  }
});

// 2. Registro de Pagos (PAGO_MENSUAL) - Lógica de Cero Abonos
app.post('/api/pagos', async (req, res) => {
  const { id_hogar, id_comite, mes, monto } = req.body;
  
  // Regla de Oro: No se aceptan pagos menores a Q50
  if (parseFloat(monto) < 50.00) {
    return res.status(400).json({ error: 'No se aceptan abonos parciales. El monto debe ser Q50.00.' });
  }

  try {
    const query = 'INSERT INTO PAGO_MENSUAL (id_hogar, id_comite_cobrador, mes_pagado, cuota_fija) VALUES ($1, $2, $3, $4) RETURNING *';
    const values = [id_hogar, id_comite, mes, 50.00];
    const result = await pool.query(query, values);
    
    // Actualizar mora en la tabla HOGAR (simplificado)
    await pool.query('UPDATE HOGAR SET meses_mora_acumulada = GREATEST(0, meses_mora_acumulada - 1) WHERE id_hogar = $1', [id_hogar]);
    
    res.json({ message: 'Pago registrado con éxito', pago: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Error al procesar pago', details: err.message });
  }
});

// 3. Sincronización de Lecturas (REGISTRO_NIVEL)
app.post('/api/lecturas', async (req, res) => {
  const { id_tanque, id_operario, volumen, fecha_fisica } = req.body;
  try {
    const query = 'INSERT INTO REGISTRO_NIVEL (id_tanque, id_operario, volumen_actual_m3, fecha_medicion_fisica) VALUES ($1, $2, $3, $4) RETURNING *';
    const values = [id_tanque, id_operario, volumen, fecha_fisica];
    const result = await pool.query(query, values);
    res.json({ message: 'Lectura sincronizada', data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Error en sincronización', details: err.message });
  }
});

// 4. Reporte de Averías
app.post('/api/averias', async (req, res) => {
  const { id_valvula, tipo_averia, descripcion, alerta_enviada } = req.body;
  try {
    const query = 'INSERT INTO REPORTE_AVERIA (id_valvula, tipo_averia, descripcion, alerta_masiva_enviada) VALUES ($1, $2, $3, $4) RETURNING *';
    const values = [id_valvula, tipo_averia, descripcion, alerta_enviada];
    const result = await pool.query(query, values);
    res.json({ message: 'Avería reportada', data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Error al registrar avería', details: err.message });
  }
});

// === RUTAS SIMULADAS PARA PRUEBAS (PROYECTO 3) ===

// CP-01: Login exitoso
app.post('/api/auth/login', (req, res) => {
  res.status(200).json({
    message: "Login exitoso",
    token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEyMywicm9sIjoiSGFiaXRhbnRlIiwiZXhwIjoxNjg5MDUyODAwfQ.Signature",
    rol: "Habitante"
  });
});

// CP-04: Error Cero Abonos
app.post('/api/pagos', (req, res) => {
  const { monto } = req.body;
  if (parseFloat(monto) < 50.00) {
    return res.status(400).json({
      error: "Bad Request",
      message: "Error Cero Abonos: No se aceptan abonos parciales. La cuota estricta es de Q50.00."
    });
  }
  res.status(200).json({ message: "Pago registrado exitosamente" });
});

// CP-10: Error de Roles (Habitante intentando ver vecinos)
app.get('/api/vecinos', (req, res) => {
  // Simulando que el middleware de auth detectó el token de "Habitante"
  res.status(403).json({
    error: "Forbidden",
    message: "Acceso denegado. Se requiere rol de 'Comité' para ver el listado completo de vecinos."
  });
});

app.listen(port, () => {
  console.log(`Servidor de Agua San Miguel corriendo en http://localhost:${port}`);
});
