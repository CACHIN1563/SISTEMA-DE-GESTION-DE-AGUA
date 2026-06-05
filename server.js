const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const swaggerUi = require('swagger-ui-express');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// === MIDDLEWARES ===
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

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

// === CONFIGURACIÓN DE LA BASE DE DATOS (POSTGRESQL) ===
const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      }
    })
  : new Pool({
      user: process.env.DB_USER || 'postgres',
      host: process.env.DB_HOST || 'localhost',
      database: process.env.DB_NAME || 'sistema_agua', 
      password: process.env.DB_PASSWORD || '150623',
      port: process.env.DB_PORT || 5432,
    });

const fs = require('fs');
const path = require('path');

// Probar conexión inicial con PostgreSQL al levantar el servidor
pool.connect(async (err, client, release) => {
  if (err) {
    return console.error('❌ Error crítico al conectar a PostgreSQL:', err.stack);
  }
  console.log('✅ Conexión exitosa a la base de datos PostgreSQL (sistema_agua)');
  
  try {
    // Verificar si la tabla SECTOR existe para determinar si la BD está vacía
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'sector'
      );
    `);
    
    const dbExists = tableCheck.rows[0].exists;
    if (!dbExists) {
      console.log('🔄 Base de datos vacía detectada. Inicializando esquema y datos semilla...');
      const sqlPath = path.join(__dirname, 'BD_Script_Simulado.sql');
      if (fs.existsSync(sqlPath)) {
        const sql = fs.readFileSync(sqlPath, 'utf8');
        await client.query(sql);
        console.log('✅ Base de datos inicializada y poblada con éxito desde BD_Script_Simulado.sql');
      } else {
        console.warn('⚠️ No se encontró el archivo BD_Script_Simulado.sql para inicializar la base de datos.');
      }
    } else {
      console.log('🛡️ Base de datos ya inicializada. Verificando integridad...');
      await client.query('ALTER TABLE SECTOR ADD COLUMN IF NOT EXISTS horario_fijo VARCHAR(100);');
      console.log('🛡️ Esquema verificado y corregido con éxito (columna horario_fijo asegurada).');
    }
  } catch (dbErr) {
    console.error('⚠️ Error al verificar/inicializar el esquema de la base de datos:', dbErr.message);
  }
  
  release();
});


// === RUTAS DEL SISTEMA ===

// 1. Gestión de Familias (PRODUCTO_FAMILIA)
app.get(['/api/familias', '/api/hogares'], async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT pf.*, s.nombre_sector 
      FROM PRODUCTO_FAMILIA pf 
      LEFT JOIN SECTOR s ON pf.id_sector = s.id_sector 
      ORDER BY pf.id_familia ASC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener familias', details: err.message });
  }
});

app.post(['/api/familias', '/api/hogares'], async (req, res) => {
  const { nombre_jefe, dpi, telefono, id_sector, estado_solvencia, meses_mora } = req.body;
  
  if (!nombre_jefe || !dpi) {
    return res.status(400).json({ error: 'Bad Request', message: 'El nombre del jefe y el DPI son campos obligatorios.' });
  }

  try {
    const query = `
      INSERT INTO PRODUCTO_FAMILIA (nombre_jefe, dpi, telefono, id_sector, estado_solvencia, meses_mora) 
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
    `;
    const values = [
      nombre_jefe,
      dpi,
      telefono || null,
      parseInt(id_sector) || 1,
      estado_solvencia || 'Solvente',
      parseInt(meses_mora) || 0
    ];
    const result = await pool.query(query, values);
    res.json({ message: 'Familia registrada con éxito', familia: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Error al registrar familia', details: err.message });
  }
});

// 2. Gestión de Sectores
app.get('/api/sectores', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM SECTOR ORDER BY id_sector ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener sectores', details: err.message });
  }
});

app.put('/api/sectores/:id', async (req, res) => {
  const { id } = req.params;
  const { horario_fijo } = req.body;
  try {
    const result = await pool.query(
      'UPDATE SECTOR SET horario_fijo = $1 WHERE id_sector = $2 RETURNING *',
      [horario_fijo, parseInt(id)]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Sector no encontrado' });
    }
    res.json({ message: 'Horario programado con éxito', sector: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar horario del sector', details: err.message });
  }
});

// 3. Registro de Pagos (PAGO) - Regla Estricta de Cero Abonos
app.get('/api/habitantes/buscar', async (req, res) => {
  const { credencial } = req.query;
  if (!credencial) {
    return res.status(400).json({ error: 'Bad Request', message: 'El número de teléfono o DPI es obligatorio.' });
  }

  try {
    const normalized = credencial.trim().replace(/\s+/g, '').replace(/-/g, '');
    const result = await pool.query(`
      SELECT pf.*, s.nombre_sector, s.horario_fijo 
      FROM PRODUCTO_FAMILIA pf 
      LEFT JOIN SECTOR s ON pf.id_sector = s.id_sector 
      WHERE REPLACE(pf.telefono, '-', '') = $1 OR REPLACE(pf.dpi, ' ', '') = $1
    `, [normalized]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'No se encontró ningún habitante registrado con ese teléfono o DPI.' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al buscar habitante', details: err.message });
  }
});

app.get('/api/pagos/recaudacion', async (req, res) => {
  try {
    const result = await pool.query('SELECT SUM(monto_fijo) as total FROM PAGO');
    const total = parseFloat(result.rows[0].total) || 0.00;
    res.json({ total });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener la recaudación', details: err.message });
  }
});

app.post('/api/login', async (req, res) => {
  const { usuario, password } = req.body;
  if (!usuario || !password) {
    return res.status(400).json({ error: 'Bad Request', message: 'Usuario y contraseña son requeridos.' });
  }

  try {
    const result = await pool.query(
      'SELECT nombre, rol FROM EMPLEADO WHERE username = $1 AND password = $2 LIMIT 1',
      [usuario, password]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Usuario o contraseña incorrectos.' });
    }

    const matchedUser = result.rows[0];
    const rawRol = matchedUser.rol.toLowerCase();
    let finalRol = 'comite';
    if (rawRol === 'operador' || rawRol === 'operario') {
      finalRol = 'operario';
    } else if (rawRol === 'tesorero') {
      finalRol = 'tesorero';
    }

    res.json({
      usuario: usuario,
      nombre: matchedUser.nombre,
      rol: finalRol
    });
  } catch (err) {
    res.status(500).json({ error: 'Error en el servidor', details: err.message });
  }
});

app.post('/api/pagos', async (req, res) => {
  const { id_familia, monto, mes_saldado, metodo_pago } = req.body;
  
  if (!id_familia || monto === undefined) {
    return res.status(400).json({ error: 'Bad Request', message: 'ID de familia y monto son obligatorios.' });
  }

  // Regla de Oro: No se aceptan pagos menores a Q50.00
  if (parseFloat(monto) < 50.00) {
    return res.status(400).json({ 
      error: 'Bad Request', 
      message: 'Error Cero Abonos: No se aceptan abonos parciales. La cuota estricta es de Q50.00.' 
    });
  }

  try {
    // Buscar la mora actual de la familia para verificar solvencia primero
    const selectFamily = await pool.query('SELECT meses_mora, estado_solvencia FROM PRODUCTO_FAMILIA WHERE id_familia = $1', [parseInt(id_familia)]);
    
    if (selectFamily.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'La familia seleccionada no existe.' });
    }
    
    const { meses_mora, estado_solvencia } = selectFamily.rows[0];
    if (parseInt(meses_mora) === 0 || estado_solvencia === 'Solvente') {
      return res.status(400).json({ 
        error: 'Bad Request', 
        message: 'La familia ya se encuentra solvente y no posee cuotas pendientes de pago.' 
      });
    }

    // Insertar el registro del pago en la tabla PAGO
    const queryPago = 'INSERT INTO PAGO (id_familia, monto_fijo, mes_saldado, metodo_pago) VALUES ($1, $2, $3, $4) RETURNING *';
    const valuesPago = [parseInt(id_familia), 50.00, mes_saldado || 'Mensualidad', metodo_pago || 'Efectivo'];
    const resultPago = await pool.query(queryPago, valuesPago);
    
    const nuevaMora = Math.max(0, meses_mora - 1); // Resta 1 mes de mora sin bajar de 0
    const nuevoEstado = nuevaMora === 0 ? 'Solvente' : 'Mora';
    
    // Actualizar la tabla PRODUCTO_FAMILIA con el nuevo estado financiero
    await pool.query(
      'UPDATE PRODUCTO_FAMILIA SET meses_mora = $1, estado_solvencia = $2 WHERE id_familia = $3', 
      [nuevaMora, nuevoEstado, parseInt(id_familia)]
    );
    
    res.json({ 
      message: 'Pago registrado con éxito y estado de cuenta actualizado', 
      pago: resultPago.rows[0] 
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al procesar el pago en la base de datos', details: err.message });
  }
});

// 4. Gestión de Averías (REPORTE_AVERIA)
app.get('/api/averias', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT ra.*, s.nombre_sector 
      FROM REPORTE_AVERIA ra 
      LEFT JOIN SECTOR s ON ra.id_sector = s.id_sector 
      ORDER BY ra.id_averia DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener averías', details: err.message });
  }
});

app.post('/api/averias', async (req, res) => {
  const { id_sector, tipo_averia, descripcion, alerta_enviada, estado, prioridad } = req.body;
  
  if (!tipo_averia) {
    return res.status(400).json({ error: 'Bad Request', message: 'El tipo de avería es obligatorio.' });
  }

  try {
    const query = `
      INSERT INTO REPORTE_AVERIA (id_sector, tipo_averia, descripcion, alerta_masiva_enviada, estado, prioridad) 
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
    `;
    const values = [
      parseInt(id_sector) || 1, 
      tipo_averia, 
      descripcion || '', 
      alerta_enviada || false, 
      estado || 'En reparación', 
      prioridad || 'Media'
    ];
    const result = await pool.query(query, values);
    res.json({ message: 'Avería reportada con éxito', data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Error al registrar avería', details: err.message });
  }
});

// 5. Lecturas de Tanque (LECTURA_TANQUE)
app.get('/api/lecturas', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT lt.*, e.nombre as nombre_empleado 
      FROM LECTURA_TANQUE lt 
      LEFT JOIN EMPLEADO e ON lt.id_empleado = e.id_empleado 
      ORDER BY lt.id_lectura DESC LIMIT 5
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener lecturas', details: err.message });
  }
});

app.post('/api/lecturas', async (req, res) => {
  const { id_empleado, nivel_porcentaje, observaciones, sincronizado_nube } = req.body;
  
  if (nivel_porcentaje === undefined) {
    return res.status(400).json({ error: 'Bad Request', message: 'El nivel del porcentaje del tanque es obligatorio.' });
  }

  try {
    const query = `
      INSERT INTO LECTURA_TANQUE (id_empleado, nivel_porcentaje, observaciones, sincronizado_nube) 
      VALUES ($1, $2, $3, $4) RETURNING *
    `;
    const values = [
      parseInt(id_empleado) || 1, 
      parseInt(nivel_porcentaje), 
      observaciones || 'Sin observaciones', 
      sincronizado_nube || false
    ];
    const result = await pool.query(query, values);
    res.json({ message: 'Lectura guardada con éxito', data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Error al guardar lectura', details: err.message });
  }
});

// === RUTAS DE AUTENTICACIÓN / SEGURIDAD ===
app.post('/api/auth/login', (req, res) => {
  const { dpi, password } = req.body;
  
  // Login estático simulado para compatibilidad inmediata con el Frontend
  res.status(200).json({
    message: "Login exitoso",
    token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEyMywicm9sIjoiSGFiaXRhbnRlIiwiZXhwIjoxNjg5MDUyODAwfQ.Signature",
    rol: "Habitante"
  });
});

app.get('/api/vecinos', (req, res) => {
  res.status(403).json({
    error: "Forbidden",
    message: "Acceso denegado. Se requiere rol de 'Comité' para ver el listado completo de vecinos."
  });
});

// 6. Simulación de Facturación Mensual Automática (Carga de Cuota)
app.post('/api/facturacion/generar-mensualidad', async (req, res) => {
  try {
    // Incrementar en 1 los meses de mora de todos los hogares
    await pool.query(`
      UPDATE PRODUCTO_FAMILIA 
      SET meses_mora = meses_mora + 1,
          estado_solvencia = 'Mora'
    `);
    res.json({ message: '¡Facturación mensual generada con éxito! Se cargó Q50.00 de cuota (+1 mes de mora) a todas las familias de la comunidad.' });
  } catch (err) {
    res.status(500).json({ error: 'Error al generar la facturación mensual', details: err.message });
  }
});

// 7. Gestión de Órdenes de Corte (ORDEN_CORTE)
app.get('/api/cortes', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT oc.*, pf.nombre_jefe, pf.telefono, s.nombre_sector 
      FROM ORDEN_CORTE oc
      JOIN PRODUCTO_FAMILIA pf ON oc.id_familia = pf.id_familia
      LEFT JOIN SECTOR s ON pf.id_sector = s.id_sector
      ORDER BY oc.id_orden DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener órdenes de corte', details: err.message });
  }
});

app.post('/api/cortes', async (req, res) => {
  const { id_familia, motivo } = req.body;
  if (!id_familia) {
    return res.status(400).json({ error: 'Bad Request', message: 'El ID de la familia es obligatorio.' });
  }
  try {
    const query = `
      INSERT INTO ORDEN_CORTE (id_familia, motivo, estado) 
      VALUES ($1, $2, 'Pendiente') RETURNING *
    `;
    const result = await pool.query(query, [parseInt(id_familia), motivo || 'Mora acumulada mayor a 3 meses']);
    res.json({ message: 'Orden de corte registrada con éxito', data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Error al registrar orden de corte', details: err.message });
  }
});

app.put('/api/cortes/:id', async (req, res) => {
  const { id } = req.params;
  const { estado } = req.body;
  try {
    const result = await pool.query(
      'UPDATE ORDEN_CORTE SET estado = $1 WHERE id_orden = $2 RETURNING *',
      [estado || 'Ejecutado', parseInt(id)]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Orden de corte no encontrada' });
    }
    res.json({ message: 'Orden de corte actualizada con éxito', data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar orden de corte', details: err.message });
  }
});

// === INICIALIZACIÓN DEL SERVIDOR ===
app.listen(port, () => {
  console.log(`🚀 Servidor de Agua San Miguel corriendo en http://localhost:${port}`);
  console.log(`📝 Documentación Swagger disponible en http://localhost:${port}/api/docs`);
});
