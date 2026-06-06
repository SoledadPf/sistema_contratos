-- ==========================================================
-- SCRIPT DE INICIALIZACIÓN DE BASE DE DATOS - PORTAL BETA
-- ==========================================================

-- Habilitar extensión para UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==========================================
-- 1. CREACIÓN DE ENUMS
-- ==========================================

CREATE TYPE rol_usuario        AS ENUM ('proveedor', 'administrador', 'auditor', 'superadmin');
CREATE TYPE estado_usuario     AS ENUM ('activo', 'inactivo', 'bloqueado');
CREATE TYPE tipo_doc_proveedor AS ENUM ('dni_anverso', 'dni_reverso', 'ficha_ruc', 'certijoven', 'cv', 'dj_domicilio', 'dj_lavado', 'registro_proveedor', 'otro');
CREATE TYPE tipo_doc_tramite   AS ENUM ('recibo_xml', 'recibo_pdf', 'suspension_4ta', 'otro');
CREATE TYPE estado_proveedor   AS ENUM ('pendiente', 'aprobado', 'observado', 'rechazado');
CREATE TYPE estado_contrato    AS ENUM ('borrador', 'pendiente_firma', 'en_validacion', 'aprobado', 'rechazado', 'cancelado');
CREATE TYPE estado_entregable  AS ENUM ('pendiente', 'notificado', 'aprobado', 'rechazado');
CREATE TYPE estado_tramite     AS ENUM ('pendiente', 'notificado', 'en_revision', 'aprobado', 'rechazado');
CREATE TYPE estado_campana     AS ENUM ('activa', 'cerrada', 'cancelada');
CREATE TYPE resultado_firma    AS ENUM ('aprobado', 'rechazado');
CREATE TYPE estado_blockchain  AS ENUM ('pendiente', 'confirmado', 'fallido');
CREATE TYPE tipo_blockchain    AS ENUM ('contrato', 'tramite_pago');
CREATE TYPE estado_envio_noti  AS ENUM ('pendiente', 'enviado', 'fallido');

-- ==========================================
-- 2. CREACIÓN DE TABLAS
-- ==========================================

CREATE TABLE usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    rol rol_usuario NOT NULL,
    estado estado_usuario NOT NULL DEFAULT 'activo',
    totp_secret VARCHAR(64) NULL,
    totp_habilitado BOOLEAN DEFAULT false,
    ultimo_login TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE TABLE proveedores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID UNIQUE REFERENCES usuarios(id),
    tipo_documento VARCHAR(20) NOT NULL,
    nro_documento VARCHAR(20) NOT NULL,
    ruc VARCHAR(11) UNIQUE NOT NULL,
    fecha_inicio_actividad DATE NOT NULL,
    nombres VARCHAR(100) NOT NULL,
    apellido_paterno VARCHAR(100) NOT NULL,
    apellido_materno VARCHAR(100) NOT NULL,
    fecha_nacimiento DATE NOT NULL,
    pais_nacimiento VARCHAR(60) DEFAULT 'PERU',
    departamento_nacimiento VARCHAR(60) NULL,
    provincia_nacimiento VARCHAR(60) NULL,
    distrito_nacimiento VARCHAR(60) NULL,
    ocupacion VARCHAR(120) NULL,
    actividad_ciiu VARCHAR(10) NULL,
    rubro VARCHAR(120) NULL,
    telefono_movil VARCHAR(12) NOT NULL,
    telefono_fijo VARCHAR(12) NULL,
    correo VARCHAR(255) NOT NULL,
    lugar_constitucion VARCHAR(60) DEFAULT 'PERU',
    tipo_relacion VARCHAR(30) DEFAULT 'proveedor',
    ruc_estado_sunat VARCHAR(20) NULL,
    ruc_condicion_sunat VARCHAR(20) NULL,
    ruc_validado_en TIMESTAMPTZ NULL,
    estado_registro estado_proveedor NOT NULL DEFAULT 'pendiente',
    observacion_admin TEXT NULL,
    aprobado_por UUID REFERENCES usuarios(id) NULL,
    aprobado_en TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE direcciones_proveedor (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proveedor_id UUID REFERENCES proveedores(id),
    departamento VARCHAR(60) NOT NULL,
    provincia VARCHAR(60) NOT NULL,
    distrito VARCHAR(60) NOT NULL,
    zona VARCHAR(60) NULL,
    tipo_via VARCHAR(30) NULL,
    descripcion_via VARCHAR(150) NULL,
    tipo_zona VARCHAR(30) NULL,
    descripcion_zona VARCHAR(150) NULL,
    manzana VARCHAR(10) NULL,
    lote VARCHAR(10) NULL,
    etapa VARCHAR(10) NULL,
    nro VARCHAR(10) NULL,
    interior VARCHAR(10) NULL,
    descripcion_interior VARCHAR(60) NULL,
    bloque VARCHAR(10) NULL,
    descripcion_bloque VARCHAR(60) NULL,
    es_principal BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE datos_bancarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proveedor_id UUID REFERENCES proveedores(id),
    banco VARCHAR(80) NOT NULL,
    nro_cuenta VARCHAR(30) NOT NULL,
    cci VARCHAR(20) NOT NULL,
    tipo_cuenta VARCHAR(20) DEFAULT 'ahorros',
    es_principal BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE documentos_proveedor (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proveedor_id UUID REFERENCES proveedores(id),
    tipo_documento tipo_doc_proveedor NOT NULL,
    descripcion VARCHAR(200) NULL,
    nombre_archivo VARCHAR(255) NOT NULL,
    ruta_storage VARCHAR(500) NOT NULL,
    mime_type VARCHAR(80) NOT NULL,
    tamano_bytes BIGINT NULL,
    hash_sha256 VARCHAR(64) NULL,
    estado VARCHAR(30) DEFAULT 'pendiente',
    observacion TEXT NULL,
    revisado_por UUID REFERENCES usuarios(id) NULL,
    revisado_en TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE campanas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(150) NOT NULL,
    fundo VARCHAR(100) NULL,
    cultivo VARCHAR(80) NULL,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    estado estado_campana DEFAULT 'activa',
    creado_por UUID REFERENCES usuarios(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE contratos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proveedor_id UUID REFERENCES proveedores(id),
    campana_id UUID REFERENCES campanas(id),
    nro_contrato VARCHAR(30) UNIQUE NOT NULL,
    descripcion_servicio TEXT NOT NULL,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    monto_total NUMERIC(12,2) NOT NULL,
    nro_entregables INTEGER NOT NULL,
    monto_por_entregable NUMERIC(12,2) NOT NULL,
    moneda VARCHAR(5) DEFAULT 'PEN',
    estado estado_contrato NOT NULL DEFAULT 'borrador',
    pdf_borrador_ruta VARCHAR(500) NULL,
    pdf_firmado_ruta VARCHAR(500) NULL,
    pdf_firmado_hash VARCHAR(64) NULL,
    generado_por UUID REFERENCES usuarios(id),
    aprobado_por UUID REFERENCES usuarios(id) NULL,
    aprobado_en TIMESTAMPTZ NULL,
    observacion_rechazo TEXT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE validaciones_firma (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contrato_id UUID REFERENCES contratos(id),
    imagen_firma_contrato_ruta VARCHAR(500) NOT NULL,
    imagen_firma_dni_ruta VARCHAR(500) NOT NULL,
    score_similitud NUMERIC(5,4) NOT NULL,
    umbral_aplicado NUMERIC(5,4) DEFAULT 0.9000,
    resultado resultado_firma NOT NULL,
    modelo_version VARCHAR(30) NULL,
    metadata_ia JSONB NULL,
    ejecutado_en TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE entregables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contrato_id UUID REFERENCES contratos(id),
    nro_entregable INTEGER NOT NULL,
    nombre VARCHAR(200) NOT NULL,
    descripcion TEXT NULL,
    periodo VARCHAR(30) NULL,
    fecha_periodo_inicio DATE NULL,
    fecha_periodo_fin DATE NULL,
    monto NUMERIC(12,2) NOT NULL,
    estado estado_entregable DEFAULT 'pendiente',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (contrato_id, nro_entregable)
);

CREATE TABLE tramites_pago (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entregable_id UUID UNIQUE REFERENCES entregables(id),
    tipo_comprobante VARCHAR(40) DEFAULT 'recibo_honorarios',
    nro_comprobante VARCHAR(20) NULL,
    fecha_emision DATE NULL,
    descripcion_comprobante TEXT NULL,
    monto_bruto NUMERIC(12,2) NULL,
    tiene_suspension_4ta BOOLEAN DEFAULT false,
    retencion_porcentaje NUMERIC(5,2) DEFAULT 8.00,
    monto_retencion NUMERIC(12,2) DEFAULT 0,
    monto_neto NUMERIC(12,2) NULL,
    estado estado_tramite DEFAULT 'pendiente',
    notificado_en TIMESTAMPTZ NULL,
    observacion_proveedor TEXT NULL,
    observacion_admin TEXT NULL,
    revisado_por UUID REFERENCES usuarios(id) NULL,
    aprobado_en TIMESTAMPTZ NULL,
    datos_bancarios_id UUID REFERENCES datos_bancarios(id) NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE documentos_tramite (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tramite_id UUID REFERENCES tramites_pago(id),
    tipo_documento tipo_doc_tramite NOT NULL,
    descripcion VARCHAR(200) NULL,
    nombre_archivo VARCHAR(255) NOT NULL,
    ruta_storage VARCHAR(500) NOT NULL,
    mime_type VARCHAR(80) NULL,
    tamano_bytes BIGINT NULL,
    hash_sha256 VARCHAR(64) NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE historial_tramite (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tramite_id UUID REFERENCES tramites_pago(id),
    estado_anterior VARCHAR(30) NULL,
    estado_nuevo VARCHAR(30) NOT NULL,
    comentario TEXT NULL,
    realizado_por UUID REFERENCES usuarios(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE notificaciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    destinatario_id UUID REFERENCES usuarios(id),
    tipo VARCHAR(60) NOT NULL,
    asunto VARCHAR(255) NOT NULL,
    cuerpo TEXT NULL,
    referencia_tipo VARCHAR(30) NULL,
    referencia_id UUID NULL,
    estado_envio estado_envio_noti DEFAULT 'pendiente',
    enviado_en TIMESTAMPTZ NULL,
    intento_nro INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE administradores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID UNIQUE REFERENCES usuarios(id),
    nombres VARCHAR(100) NOT NULL,
    apellidos VARCHAR(100) NOT NULL,
    cargo VARCHAR(80) NULL,
    telefono VARCHAR(12) NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE registros_blockchain (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo_registro tipo_blockchain NOT NULL,
    referencia_id UUID NOT NULL,
    hash_documento VARCHAR(64) NOT NULL,
    tx_id VARCHAR(255) UNIQUE NOT NULL,
    bloque_numero BIGINT NULL,
    red_blockchain VARCHAR(30) DEFAULT 'hyperledger',
    chaincode_version VARCHAR(20) NULL,
    estado estado_blockchain DEFAULT 'confirmado',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ==========================================
-- 3. ÍNDICES RECOMENDADOS
-- ==========================================

CREATE INDEX idx_contratos_proveedor     ON contratos(proveedor_id);
CREATE INDEX idx_contratos_campana       ON contratos(campana_id);
CREATE INDEX idx_entregables_contrato    ON entregables(contrato_id);
CREATE INDEX idx_tramites_entregable     ON tramites_pago(entregable_id);
CREATE INDEX idx_documentos_proveedor    ON documentos_proveedor(proveedor_id, tipo_documento);
CREATE INDEX idx_documentos_tramite      ON documentos_tramite(tramite_id);
CREATE INDEX idx_historial_tramite       ON historial_tramite(tramite_id);
CREATE INDEX idx_notificaciones_dest     ON notificaciones(destinatario_id, estado_envio);
CREATE INDEX idx_blockchain_referencia   ON registros_blockchain(tipo_registro, referencia_id);
CREATE INDEX idx_blockchain_tx           ON registros_blockchain(tx_id);
CREATE INDEX idx_validaciones_contrato   ON validaciones_firma(contrato_id);

CREATE INDEX idx_proveedores_ruc         ON proveedores(ruc);
CREATE INDEX idx_proveedores_nro_doc     ON proveedores(nro_documento);
