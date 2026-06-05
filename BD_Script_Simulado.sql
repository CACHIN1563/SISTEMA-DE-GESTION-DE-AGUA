-- SCRIPT SQL DE SIMULACIÓN PARA PROYECTO AGUA SAN MIGUEL
-- Fase 2: Definición de Estructura (PostgreSQL / MySQL)

CREATE TABLE SECTOR (
    id_sector SERIAL PRIMARY KEY,
    nombre_sector VARCHAR(50) NOT NULL,
    horario_fijo VARCHAR(100)
);

CREATE TABLE PRODUCTO_FAMILIA (
    id_familia SERIAL PRIMARY KEY,
    nombre_jefe VARCHAR(150) NOT NULL,
    dpi VARCHAR(15) UNIQUE NOT NULL,
    telefono VARCHAR(12) NOT NULL,
    id_sector INT REFERENCES SECTOR(id_sector),
    estado_solvencia VARCHAR(20) DEFAULT 'Solvente',
    meses_mora INT DEFAULT 0
);

CREATE TABLE PAGO (
    id_pago SERIAL PRIMARY KEY,
    id_familia INT REFERENCES PRODUCTO_FAMILIA(id_familia),
    fecha_pago DATE DEFAULT CURRENT_DATE,
    monto_fijo DECIMAL(10,2) CHECK (monto_fijo = 50.00), -- REGLA: Cero Abonos
    mes_saldado VARCHAR(20) NOT NULL,
    metodo_pago VARCHAR(20)
);

CREATE TABLE EMPLEADO (
    id_empleado SERIAL PRIMARY KEY,
    nombre VARCHAR(100),
    rol VARCHAR(50), -- 'Operador', 'Comité', 'Tesorero'
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL
);

CREATE TABLE LECTURA_TANQUE (
    id_lectura SERIAL PRIMARY KEY,
    id_empleado INT REFERENCES EMPLEADO(id_empleado),
    fecha_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    nivel_porcentaje INT CHECK (nivel_porcentaje BETWEEN 0 AND 100),
    observaciones TEXT,
    sincronizado_nube BOOLEAN DEFAULT FALSE
);

CREATE TABLE ORDEN_CORTE (
    id_orden SERIAL PRIMARY KEY,
    id_familia INT REFERENCES PRODUCTO_FAMILIA(id_familia),
    fecha_emision DATE DEFAULT CURRENT_DATE,
    motivo VARCHAR(200),
    estado VARCHAR(20) DEFAULT 'Pendiente'
);

CREATE TABLE REPORTE_AVERIA (
    id_averia SERIAL PRIMARY KEY,
    id_sector INT REFERENCES SECTOR(id_sector),
    tipo_averia VARCHAR(100) NOT NULL,
    descripcion TEXT,
    alerta_masiva_enviada BOOLEAN DEFAULT FALSE,
    estado VARCHAR(20) DEFAULT 'En reparación',
    prioridad VARCHAR(20) DEFAULT 'Media',
    fecha DATE DEFAULT CURRENT_DATE
);

-- Datos Semilla (Ejemplos)
INSERT INTO SECTOR (nombre_sector, horario_fijo) VALUES 
('Centro', 'Lunes y Jueves (08:00 - 13:00)'),
('Norte', 'Martes y Viernes (08:00 - 13:00)'),
('Sur', 'Miércoles y Sábado');

INSERT INTO EMPLEADO (nombre, rol, username, password) VALUES 
('Operario Calí', 'Operador', 'operario', 'op123'),
('Comité Central', 'Comité', 'admin', 'admin123'),
('Tesorero Juan', 'Tesorero', 'tesorero', 'tes123');

INSERT INTO PRODUCTO_FAMILIA (nombre_jefe, dpi, telefono, id_sector, estado_solvencia, meses_mora) VALUES
('Lorenzana, Daniel', '2345 67890 0101', '5544-3322', 1, 'Solvente', 0),
('Ardón, Carlos', '1234 56789 0101', '4433-2211', 2, 'Moroso', 3),
('Familia Cachin (Tienda)', '3456 78901 0101', '5566-7788', 1, 'Mora', 1);

INSERT INTO REPORTE_AVERIA (id_sector, tipo_averia, descripcion, alerta_masiva_enviada, estado, prioridad, fecha) VALUES
(1, 'Fuga en tubería primaria', 'Ruptura en la válvula A2 del Sector 1 Centro.', TRUE, 'En reparación', 'Urgente', '2026-04-16'),
(2, 'Falla sensor de nivel', 'El sensor ultrasónico del tanque principal reporta lecturas intermitentes.', FALSE, 'Resuelto', 'Media', '2026-04-14');

