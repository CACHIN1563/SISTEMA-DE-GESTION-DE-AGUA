const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

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

app.listen(port, () => {
  console.log(`Servidor de Agua San Miguel corriendo en http://localhost:${port}`);
});
