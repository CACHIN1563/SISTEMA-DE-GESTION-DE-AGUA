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
    rol VARCHAR(50) -- 'Operador', 'Tesorero'
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

-- Datos Semilla (Ejemplos)
INSERT INTO SECTOR (nombre_sector, horario_fijo) VALUES 
('Centro', 'Lunes y Jueves (08:00 - 13:00)'),
('Norte', 'Martes y Viernes (08:00 - 13:00)'),
('Sur', 'Miércoles y Sábado');

INSERT INTO EMPLEADO (nombre, rol) VALUES ('Operario Calí', 'Operador');
