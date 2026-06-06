# ESTRUCTURA DE BASE DE DATOS Y BLOCKCHAIN
## Portal de Proveedores Temporales — Complejo Agroindustrial Beta
**Versión 1.0 | Ica, Perú | 2025**
*Documento técnico preparado para: Antigravity*

---

## 1. CONSIDERACIONES GENERALES

- **Motor de base de datos:** PostgreSQL 15+
- **Esquema principal:** `portal_beta`
- **Convenciones de nomenclatura:** snake_case, tablas en plural, PKs como `id` (UUID v4)
- **Auditoría:** Todas las tablas incluyen `created_at`, `updated_at` y `created_by` (referencia al usuario que realizó la acción)
- **Soft delete:** Las tablas críticas usan `deleted_at` en lugar de eliminación física
- **Blockchain:** Red Hyperledger Fabric (privada) o Polygon Mumbai (MVP). La base de datos guarda la referencia a la transacción; el ledger guarda el registro inmutable

---

## 2. DIAGRAMA DE ENTIDADES (RESUMEN)

```
usuarios
   └── proveedores (1:1)
   └── administradores (1:1)

proveedores
   └── documentos_proveedor (1:N)
   └── datos_bancarios (1:N)
   └── contratos (1:N)
         └── entregables (1:N)
               └── tramites_pago (1:1)
                     └── documentos_tramite (1:N)
                     └── historial_tramite (1:N)

campanas
   └── contratos (1:N)

contratos
   └── registros_blockchain (1:1)
   └── validaciones_firma (1:N)

tramites_pago
   └── registros_blockchain (1:1)  ← opcional
```

---

## 3. TABLAS — BASE DE DATOS RELACIONAL (PostgreSQL)

---

### 3.1 `usuarios`
Tabla central de autenticación. Todos los actores del sistema (proveedor, admin, auditor) tienen un registro aquí.

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | Identificador único |
| `email` | VARCHAR(255) | UNIQUE, NOT NULL | Correo de acceso |
| `password_hash` | VARCHAR(255) | NOT NULL | Hash bcrypt de la contraseña |
| `rol` | ENUM | NOT NULL | `proveedor`, `administrador`, `auditor`, `superadmin` |
| `estado` | ENUM | NOT NULL, DEFAULT 'activo' | `activo`, `inactivo`, `bloqueado` |
| `totp_secret` | VARCHAR(64) | NULL | Secreto para 2FA (TOTP). Solo para admin y superadmin |
| `totp_habilitado` | BOOLEAN | DEFAULT false | Indica si el 2FA está activo |
| `ultimo_login` | TIMESTAMPTZ | NULL | Fecha y hora del último inicio de sesión |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | Fecha de creación |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() | Última modificación |
| `deleted_at` | TIMESTAMPTZ | NULL | Soft delete |

---

### 3.2 `proveedores`
Datos personales, tributarios y de nacimiento del proveedor temporal.

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | UUID | PK | Identificador único |
| `usuario_id` | UUID | FK → usuarios.id, UNIQUE | Relación 1:1 con el usuario |
| `tipo_documento` | ENUM | NOT NULL | `DNI`, `extranjeria` |
| `nro_documento` | VARCHAR(20) | NOT NULL | Número de DNI o carné |
| `ruc` | VARCHAR(11) | UNIQUE, NOT NULL | RUC de persona natural |
| `fecha_inicio_actividad` | DATE | NOT NULL | Según ficha SUNAT |
| `nombres` | VARCHAR(100) | NOT NULL | Nombres |
| `apellido_paterno` | VARCHAR(100) | NOT NULL | Apellido paterno |
| `apellido_materno` | VARCHAR(100) | NOT NULL | Apellido materno |
| `fecha_nacimiento` | DATE | NOT NULL | Fecha de nacimiento |
| `pais_nacimiento` | VARCHAR(60) | DEFAULT 'PERU' | País de nacimiento |
| `departamento_nacimiento` | VARCHAR(60) | NULL | Departamento de nacimiento |
| `provincia_nacimiento` | VARCHAR(60) | NULL | Provincia de nacimiento |
| `distrito_nacimiento` | VARCHAR(60) | NULL | Distrito de nacimiento |
| `ocupacion` | VARCHAR(120) | NULL | Ocupación declarada |
| `actividad_ciiu` | VARCHAR(10) | NULL | Código CIIU (SUNAT) |
| `rubro` | VARCHAR(120) | NULL | Descripción del rubro |
| `telefono_movil` | VARCHAR(12) | NOT NULL | Celular principal (9 dígitos) |
| `telefono_fijo` | VARCHAR(12) | NULL | Teléfono fijo opcional |
| `correo` | VARCHAR(255) | NOT NULL | Correo de contacto |
| `lugar_constitucion` | VARCHAR(60) | DEFAULT 'PERU' | País de constitución |
| `tipo_relacion` | VARCHAR(30) | DEFAULT 'proveedor' | Tipo de relación con la empresa |
| `ruc_estado_sunat` | VARCHAR(20) | NULL | Estado retornado por SUNAT (activo/baja/etc.) |
| `ruc_condicion_sunat` | VARCHAR(20) | NULL | Condición (habido/no habido) |
| `ruc_validado_en` | TIMESTAMPTZ | NULL | Última validación de RUC en SUNAT |
| `estado_registro` | ENUM | NOT NULL, DEFAULT 'pendiente' | `pendiente`, `aprobado`, `observado`, `rechazado` |
| `observacion_admin` | TEXT | NULL | Observaciones del administrador sobre el registro |
| `aprobado_por` | UUID | FK → usuarios.id, NULL | Admin que aprobó el registro |
| `aprobado_en` | TIMESTAMPTZ | NULL | Fecha de aprobación del registro |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() | |

---

### 3.3 `direcciones_proveedor`
Datos de ubicación del proveedor (separados para normalización).

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | UUID | PK | |
| `proveedor_id` | UUID | FK → proveedores.id | |
| `departamento` | VARCHAR(60) | NOT NULL | |
| `provincia` | VARCHAR(60) | NOT NULL | |
| `distrito` | VARCHAR(60) | NOT NULL | |
| `zona` | VARCHAR(60) | NULL | |
| `tipo_via` | VARCHAR(30) | NULL | Av., Jr., Calle, Psje., etc. |
| `descripcion_via` | VARCHAR(150) | NULL | Nombre de la vía |
| `tipo_zona` | VARCHAR(30) | NULL | Urb., A.H., etc. |
| `descripcion_zona` | VARCHAR(150) | NULL | Nombre de la urbanización |
| `manzana` | VARCHAR(10) | NULL | |
| `lote` | VARCHAR(10) | NULL | |
| `etapa` | VARCHAR(10) | NULL | |
| `nro` | VARCHAR(10) | NULL | |
| `interior` | VARCHAR(10) | NULL | |
| `descripcion_interior` | VARCHAR(60) | NULL | |
| `bloque` | VARCHAR(10) | NULL | |
| `descripcion_bloque` | VARCHAR(60) | NULL | |
| `es_principal` | BOOLEAN | DEFAULT true | Dirección principal del proveedor |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() | |

---

### 3.4 `datos_bancarios`
Información de cuenta para el pago de cada trámite aprobado.

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | UUID | PK | |
| `proveedor_id` | UUID | FK → proveedores.id | |
| `banco` | VARCHAR(80) | NOT NULL | Nombre de la entidad bancaria |
| `nro_cuenta` | VARCHAR(30) | NOT NULL | Número de cuenta |
| `cci` | VARCHAR(20) | NOT NULL | Código de Cuenta Interbancario |
| `tipo_cuenta` | VARCHAR(20) | DEFAULT 'ahorros' | `ahorros`, `corriente` |
| `es_principal` | BOOLEAN | DEFAULT true | Cuenta activa para pagos |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() | |

---

### 3.5 `documentos_proveedor`
Archivos adjuntos del proveedor (DNI, ficha RUC, CV, declaraciones, etc.).

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | UUID | PK | |
| `proveedor_id` | UUID | FK → proveedores.id | |
| `tipo_documento` | ENUM | NOT NULL | `dni_anverso`, `dni_reverso`, `ficha_ruc`, `certijoven`, `cv`, `dj_domicilio`, `dj_lavado`, `registro_proveedor`, `otro` |
| `descripcion` | VARCHAR(200) | NULL | Descripción libre del documento |
| `nombre_archivo` | VARCHAR(255) | NOT NULL | Nombre original del archivo |
| `ruta_storage` | VARCHAR(500) | NOT NULL | Ruta en S3/Cloudinary (no pública) |
| `mime_type` | VARCHAR(80) | NOT NULL | `application/pdf`, `image/jpeg`, etc. |
| `tamano_bytes` | BIGINT | NULL | Tamaño del archivo |
| `hash_sha256` | VARCHAR(64) | NULL | Hash del archivo para integridad |
| `estado` | ENUM | DEFAULT 'pendiente' | `pendiente`, `aprobado`, `rechazado` |
| `observacion` | TEXT | NULL | Observación del administrador |
| `revisado_por` | UUID | FK → usuarios.id, NULL | Admin que revisó el documento |
| `revisado_en` | TIMESTAMPTZ | NULL | |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |

> **Nota:** Las imágenes del DNI (anverso y reverso) son insumo del módulo de IA para extraer la firma de referencia biométrica. La ruta en storage nunca se expone públicamente.

---

### 3.6 `campanas`
Campañas agrícolas del fundo a las que se asignan proveedores.

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | UUID | PK | |
| `nombre` | VARCHAR(150) | NOT NULL | Nombre de la campaña (ej. "Campaña Espárrago Ene-Jun 2025") |
| `fundo` | VARCHAR(100) | NULL | Nombre del fundo asociado |
| `cultivo` | VARCHAR(80) | NULL | Tipo de cultivo o actividad |
| `fecha_inicio` | DATE | NOT NULL | Inicio de la campaña |
| `fecha_fin` | DATE | NOT NULL | Fin de la campaña |
| `estado` | ENUM | DEFAULT 'activa' | `activa`, `cerrada`, `cancelada` |
| `creado_por` | UUID | FK → usuarios.id | Admin que creó la campaña |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() | |

---

### 3.7 `contratos`
Contrato de locación de servicios entre la empresa y el proveedor para una campaña.

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | UUID | PK | |
| `proveedor_id` | UUID | FK → proveedores.id | |
| `campana_id` | UUID | FK → campanas.id | |
| `nro_contrato` | VARCHAR(30) | UNIQUE, NOT NULL | Número correlativo (ej. LOCACION-N°154-2025) |
| `descripcion_servicio` | TEXT | NOT NULL | Descripción del servicio contratado |
| `fecha_inicio` | DATE | NOT NULL | Inicio de vigencia del contrato |
| `fecha_fin` | DATE | NOT NULL | Fin de vigencia del contrato |
| `monto_total` | NUMERIC(12,2) | NOT NULL | Monto total del contrato |
| `nro_entregables` | INTEGER | NOT NULL | Número de entregables/pagos definidos |
| `monto_por_entregable` | NUMERIC(12,2) | NOT NULL | Monto por cada entregable |
| `moneda` | VARCHAR(5) | DEFAULT 'PEN' | `PEN` (soles) |
| `estado` | ENUM | NOT NULL, DEFAULT 'borrador' | `borrador`, `pendiente_firma`, `en_validacion`, `aprobado`, `rechazado`, `cancelado` |
| `pdf_borrador_ruta` | VARCHAR(500) | NULL | Ruta del PDF borrador generado por el sistema |
| `pdf_firmado_ruta` | VARCHAR(500) | NULL | Ruta del PDF con firma subido por el proveedor |
| `pdf_firmado_hash` | VARCHAR(64) | NULL | Hash SHA-256 del PDF firmado (también va a blockchain) |
| `generado_por` | UUID | FK → usuarios.id | Admin que generó el borrador |
| `aprobado_por` | UUID | FK → usuarios.id, NULL | Admin que aprobó el contrato |
| `aprobado_en` | TIMESTAMPTZ | NULL | |
| `observacion_rechazo` | TEXT | NULL | Motivo de rechazo si aplica |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() | |

---

### 3.8 `validaciones_firma`
Registro de cada intento de validación biométrica de la firma del contrato.

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | UUID | PK | |
| `contrato_id` | UUID | FK → contratos.id | |
| `imagen_firma_contrato_ruta` | VARCHAR(500) | NOT NULL | Imagen de firma extraída del PDF del contrato |
| `imagen_firma_dni_ruta` | VARCHAR(500) | NOT NULL | Imagen de firma extraída del DNI del proveedor |
| `score_similitud` | NUMERIC(5,4) | NOT NULL | Score entre 0.0000 y 1.0000 (ej. 0.9342 = 93.42%) |
| `umbral_aplicado` | NUMERIC(5,4) | DEFAULT 0.9000 | Umbral configurado en el momento de la validación |
| `resultado` | ENUM | NOT NULL | `aprobado`, `rechazado` |
| `modelo_version` | VARCHAR(30) | NULL | Versión del modelo de IA usado |
| `metadata_ia` | JSONB | NULL | Datos adicionales retornados por el servicio de IA |
| `ejecutado_en` | TIMESTAMPTZ | DEFAULT now() | Momento en que se ejecutó la validación |

---

### 3.9 `entregables`
Entregables generados automáticamente al aprobarse el contrato (uno por periodo/mes).

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | UUID | PK | |
| `contrato_id` | UUID | FK → contratos.id | |
| `nro_entregable` | INTEGER | NOT NULL | Número de orden (1, 2, 3... N) |
| `nombre` | VARCHAR(200) | NOT NULL | Ej. "LOCACION N°154-2025 - VALERY POMA N°1" |
| `descripcion` | TEXT | NULL | Descripción del servicio para ese periodo |
| `periodo` | VARCHAR(30) | NULL | Ej. "Enero 2026", "Febrero 2026" |
| `fecha_periodo_inicio` | DATE | NULL | Inicio del periodo de servicio |
| `fecha_periodo_fin` | DATE | NULL | Fin del periodo de servicio |
| `monto` | NUMERIC(12,2) | NOT NULL | Monto asignado a este entregable |
| `estado` | ENUM | DEFAULT 'pendiente' | `pendiente`, `notificado`, `aprobado`, `rechazado` |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() | |

**Índice:** `UNIQUE (contrato_id, nro_entregable)`

---

### 3.10 `tramites_pago`
Trámite de pago asociado a cada entregable. El proveedor lo completa y notifica; el admin aprueba.

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | UUID | PK | |
| `entregable_id` | UUID | FK → entregables.id, UNIQUE | Relación 1:1 con el entregable |
| `tipo_comprobante` | VARCHAR(40) | DEFAULT 'recibo_honorarios' | Tipo de comprobante (siempre recibo por honorarios en este módulo) |
| `nro_comprobante` | VARCHAR(20) | NULL | Número de serie + número emitido en SUNAT (ej. E001-18) |
| `fecha_emision` | DATE | NULL | Fecha de emisión del comprobante en SUNAT |
| `descripcion_comprobante` | TEXT | NULL | Descripción tal como figura en el comprobante SUNAT |
| `monto_bruto` | NUMERIC(12,2) | NULL | Monto bruto del recibo por honorarios |
| `tiene_suspension_4ta` | BOOLEAN | DEFAULT false | Si tiene suspensión de 4ta categoría vigente |
| `retencion_porcentaje` | NUMERIC(5,2) | DEFAULT 8.00 | % de retención aplicado (8% por defecto, 0% si tiene suspensión) |
| `monto_retencion` | NUMERIC(12,2) | DEFAULT 0 | Monto retenido calculado |
| `monto_neto` | NUMERIC(12,2) | NULL | Monto a pagar (bruto - retención) |
| `estado` | ENUM | DEFAULT 'pendiente' | `pendiente`, `notificado`, `en_revision`, `aprobado`, `rechazado` |
| `notificado_en` | TIMESTAMPTZ | NULL | Momento en que el proveedor hizo clic en "Notificar" |
| `observacion_proveedor` | TEXT | NULL | Comentarios del proveedor al notificar |
| `observacion_admin` | TEXT | NULL | Observaciones del administrador al aprobar/rechazar |
| `revisado_por` | UUID | FK → usuarios.id, NULL | Admin que revisó el trámite |
| `aprobado_en` | TIMESTAMPTZ | NULL | Fecha de aprobación del trámite |
| `datos_bancarios_id` | UUID | FK → datos_bancarios.id, NULL | Cuenta a la que se transferirá el pago |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() | |

---

### 3.11 `documentos_tramite`
Archivos adjuntos al trámite de pago (recibo XML, recibo PDF, suspensión 4ta, otros).

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | UUID | PK | |
| `tramite_id` | UUID | FK → tramites_pago.id | |
| `tipo_documento` | ENUM | NOT NULL | `recibo_xml`, `recibo_pdf`, `suspension_4ta`, `otro` |
| `descripcion` | VARCHAR(200) | NULL | Descripción libre (ej. "Recibo XML", "Suspensión de 4ta") |
| `nombre_archivo` | VARCHAR(255) | NOT NULL | Nombre original del archivo |
| `ruta_storage` | VARCHAR(500) | NOT NULL | Ruta en almacenamiento privado |
| `mime_type` | VARCHAR(80) | NULL | |
| `tamano_bytes` | BIGINT | NULL | |
| `hash_sha256` | VARCHAR(64) | NULL | Hash del archivo para integridad |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |

---

### 3.12 `historial_tramite`
Trazabilidad de cada cambio de estado del trámite de pago.

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | UUID | PK | |
| `tramite_id` | UUID | FK → tramites_pago.id | |
| `estado_anterior` | VARCHAR(30) | NULL | Estado previo |
| `estado_nuevo` | VARCHAR(30) | NOT NULL | Nuevo estado tras el evento |
| `comentario` | TEXT | NULL | Motivo del cambio o comentario |
| `realizado_por` | UUID | FK → usuarios.id | Usuario que generó el cambio |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |

---

### 3.13 `notificaciones`
Registro de todos los correos y alertas enviados por el sistema.

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | UUID | PK | |
| `destinatario_id` | UUID | FK → usuarios.id | Usuario destinatario |
| `tipo` | VARCHAR(60) | NOT NULL | `registro_recibido`, `documentos_aprobados`, `documentos_rechazados`, `contrato_aprobado`, `contrato_rechazado`, `tramite_notificado`, `tramite_aprobado`, `tramite_rechazado` |
| `asunto` | VARCHAR(255) | NOT NULL | Asunto del correo |
| `cuerpo` | TEXT | NULL | Contenido del mensaje |
| `referencia_tipo` | VARCHAR(30) | NULL | `contrato`, `tramite`, `proveedor`, etc. |
| `referencia_id` | UUID | NULL | ID del objeto relacionado |
| `estado_envio` | ENUM | DEFAULT 'pendiente' | `pendiente`, `enviado`, `fallido` |
| `enviado_en` | TIMESTAMPTZ | NULL | |
| `intento_nro` | INTEGER | DEFAULT 0 | Número de intentos de envío |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |

---

### 3.14 `administradores`
Datos adicionales del personal administrativo del fundo.

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | UUID | PK | |
| `usuario_id` | UUID | FK → usuarios.id, UNIQUE | |
| `nombres` | VARCHAR(100) | NOT NULL | |
| `apellidos` | VARCHAR(100) | NOT NULL | |
| `cargo` | VARCHAR(80) | NULL | Cargo dentro del fundo |
| `telefono` | VARCHAR(12) | NULL | |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |

---

### 3.15 `registros_blockchain`
Referencia a los registros escritos en la red blockchain. La base de datos NO duplica el contenido del ledger; solo guarda la referencia.

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | UUID | PK | |
| `tipo_registro` | ENUM | NOT NULL | `contrato`, `tramite_pago` |
| `referencia_id` | UUID | NOT NULL | ID del contrato o trámite registrado |
| `hash_documento` | VARCHAR(64) | NOT NULL | Hash SHA-256 del documento registrado |
| `tx_id` | VARCHAR(255) | UNIQUE, NOT NULL | ID de transacción en la red blockchain |
| `bloque_numero` | BIGINT | NULL | Número de bloque donde se escribió |
| `red_blockchain` | VARCHAR(30) | DEFAULT 'hyperledger' | `hyperledger`, `polygon`, `otro` |
| `chaincode_version` | VARCHAR(20) | NULL | Versión del chaincode/smart contract usado |
| `estado` | ENUM | DEFAULT 'confirmado' | `pendiente`, `confirmado`, `fallido` |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | |

---

## 4. ESTRUCTURA BLOCKCHAIN

---

### 4.1 Red y tecnología

| Parámetro | Opción A (Producción) | Opción B (MVP) |
|---|---|---|
| **Red** | Hyperledger Fabric 2.x | Polygon Mumbai (testnet) → Polygon PoS (prod) |
| **Tipo** | Privada / permisionada | Pública / sin permiso |
| **Participantes** | Complejo Beta + nodo Antigravity | Solo Complejo Beta |
| **Costo por tx** | Prácticamente cero (red propia) | Gas en MATIC (~centavos) |
| **Tiempo de finality** | < 1 segundo | ~2 segundos |
| **Recomendación** | Para producción con auditoría regulatoria | Para lanzar el MVP rápido |

---

### 4.2 Datos que se escriben en blockchain

El blockchain **no almacena el contrato completo** (eso vive en el servidor). Almacena la **huella digital** (hash) más los metadatos mínimos para auditoría.

#### Registro de contrato aprobado

```json
{
  "tipo": "CONTRATO_APROBADO",
  "version_chaincode": "1.0.0",
  "timestamp": "2025-03-15T10:32:47Z",
  "nro_contrato": "LOCACION-N°154-2025",
  "ruc_proveedor": "10412345678",
  "nombre_proveedor": "VALERY POMA",
  "campana_id": "uuid-de-la-campana",
  "campana_nombre": "Campaña Espárrago Ene-Jun 2025",
  "hash_pdf_contrato": "a3f9d2b1c8e4...",
  "score_validacion_firma": 0.9342,
  "umbral_aplicado": 0.9000,
  "resultado_validacion": "APROBADO",
  "aprobado_por_admin_id": "uuid-del-admin",
  "fecha_aprobacion": "2025-03-15",
  "monto_total": 10800.00,
  "moneda": "PEN",
  "nro_entregables": 6
}
```

#### Registro de trámite de pago aprobado (opcional pero recomendado)

```json
{
  "tipo": "TRAMITE_PAGO_APROBADO",
  "version_chaincode": "1.0.0",
  "timestamp": "2026-01-19T14:55:00Z",
  "nro_contrato": "LOCACION-N°154-2025",
  "ruc_proveedor": "10412345678",
  "nro_entregable": 2,
  "nro_comprobante": "E001-18",
  "hash_recibo_pdf": "c7e2a9f3b1d8...",
  "hash_recibo_xml": "d1b4f8e2a7c3...",
  "monto_bruto": 1800.00,
  "tiene_suspension_4ta": false,
  "retencion_porcentaje": 8.00,
  "monto_retencion": 144.00,
  "monto_neto": 1656.00,
  "moneda": "PEN",
  "aprobado_por_admin_id": "uuid-del-admin",
  "fecha_aprobacion": "2026-01-19",
  "tx_contrato_ref": "tx-id-del-contrato-en-blockchain"
}
```

---

### 4.3 Chaincode / Smart Contract (Hyperledger Fabric)

El chaincode expone tres funciones principales:

#### `registrarContrato(payload)`
- Recibe el JSON del registro de contrato.
- Valida que el `nro_contrato` no exista previamente en el ledger.
- Escribe el registro en el ledger con clave compuesta: `CONTRATO~{nro_contrato}`.
- Retorna el `tx_id` generado por Fabric.

#### `registrarTramitePago(payload)`
- Recibe el JSON del trámite de pago aprobado.
- Valida que el contrato referenciado exista en el ledger.
- Escribe con clave compuesta: `TRAMITE~{nro_contrato}~{nro_entregable}`.
- Retorna el `tx_id`.

#### `verificarContrato(nro_contrato, hash_pdf)`
- Función de solo lectura (query).
- Busca el registro por `nro_contrato` y compara el `hash_pdf_contrato` con el valor almacenado.
- Retorna: `{ coincide: true/false, registro: {...}, tx_id: "..." }`.
- Usada por auditores y por el panel admin para verificar integridad.

---

### 4.4 Smart Contract (Polygon — alternativa MVP)

Si se elige Polygon, se despliega un contrato Solidity simple:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract PortalProveedoresBeta {

    struct RegistroContrato {
        string  nroContrato;
        string  rucProveedor;
        bytes32 hashPdfContrato;   // SHA-256 del PDF firmado
        uint32  scoreFirma;        // score * 10000 (ej. 9342 = 93.42%)
        uint256 timestamp;
        address registradoPor;
    }

    struct RegistroTramite {
        string  nroContrato;
        uint16  nroEntregable;
        string  nroComprobante;
        bytes32 hashReciboPdf;
        uint256 montoBruto;        // en céntimos (ej. 180000 = S/ 1,800.00)
        uint256 timestamp;
        address registradoPor;
    }

    mapping(bytes32 => RegistroContrato) public contratos;
    mapping(bytes32 => RegistroTramite)  public tramites;

    event ContratoRegistrado(bytes32 indexed clave, string nroContrato, string rucProveedor, uint256 timestamp);
    event TramiteRegistrado(bytes32 indexed clave, string nroContrato, uint16 nroEntregable, uint256 timestamp);

    function registrarContrato(
        string  memory _nroContrato,
        string  memory _rucProveedor,
        bytes32        _hashPdf,
        uint32         _scoreFirma
    ) external {
        bytes32 clave = keccak256(abi.encodePacked(_nroContrato));
        require(contratos[clave].timestamp == 0, "Contrato ya registrado");
        contratos[clave] = RegistroContrato({
            nroContrato:     _nroContrato,
            rucProveedor:    _rucProveedor,
            hashPdfContrato: _hashPdf,
            scoreFirma:      _scoreFirma,
            timestamp:       block.timestamp,
            registradoPor:   msg.sender
        });
        emit ContratoRegistrado(clave, _nroContrato, _rucProveedor, block.timestamp);
    }

    function registrarTramite(
        string  memory _nroContrato,
        uint16         _nroEntregable,
        string  memory _nroComprobante,
        bytes32        _hashReciboPdf,
        uint256        _montoBruto
    ) external {
        bytes32 clave = keccak256(abi.encodePacked(_nroContrato, _nroEntregable));
        require(tramites[clave].timestamp == 0, "Tramite ya registrado");
        tramites[clave] = RegistroTramite({
            nroContrato:    _nroContrato,
            nroEntregable:  _nroEntregable,
            nroComprobante: _nroComprobante,
            hashReciboPdf:  _hashReciboPdf,
            montoBruto:     _montoBruto,
            timestamp:      block.timestamp,
            registradoPor:  msg.sender
        });
        emit TramiteRegistrado(clave, _nroContrato, _nroEntregable, block.timestamp);
    }

    function verificarContrato(
        string  memory _nroContrato,
        bytes32        _hashPdf
    ) external view returns (bool coincide, uint256 timestamp, uint32 scoreFirma) {
        bytes32 clave = keccak256(abi.encodePacked(_nroContrato));
        RegistroContrato memory r = contratos[clave];
        return (r.hashPdfContrato == _hashPdf, r.timestamp, r.scoreFirma);
    }
}
```

---

### 4.5 Flujo de escritura en blockchain (lado backend)

```
1. Contrato aprobado en BD (contratos.estado = 'aprobado')
        ↓
2. Backend calcula SHA-256 del PDF firmado
        ↓
3. Backend construye el payload JSON del registro
        ↓
4. Backend llama al servicio blockchain:
   - Hyperledger: SDK fabric-network (Node.js) → chaincode.submitTransaction('registrarContrato', payload)
   - Polygon: ethers.js → contract.registrarContrato(...)
        ↓
5. Blockchain retorna tx_id (y bloque_numero en Fabric)
        ↓
6. Backend guarda en registros_blockchain:
   { tipo: 'contrato', referencia_id: contrato.id, hash_documento, tx_id, bloque_numero, estado: 'confirmado' }
        ↓
7. Backend actualiza contratos: { blockchain_tx_id: tx_id }  ← campo adicional opcional en la tabla contratos
```

---

### 4.6 Flujo de verificación / auditoría

```
Auditor ingresa nro_contrato en el panel
        ↓
Sistema busca contratos_blockchain por referencia_id
Obtiene: hash_documento y tx_id almacenados en BD
        ↓
Sistema llama a verificarContrato(nro_contrato, hash_documento)
en la red blockchain
        ↓
Blockchain retorna: { coincide: true, timestamp, scoreFirma }
        ↓
Panel muestra:
  ✅ Contrato íntegro — hash coincide con el registrado en blockchain
  📅 Registrado el: 2025-03-15 10:32:47 UTC
  🔏 Score de firma validada: 93.42%
  🔗 TX ID: 0xabc123...
```

---

## 5. ÍNDICES RECOMENDADOS

```sql
-- Búsquedas frecuentes por proveedor
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

-- Búsqueda por RUC (frecuente en validación SUNAT)
CREATE INDEX idx_proveedores_ruc         ON proveedores(ruc);
CREATE INDEX idx_proveedores_nro_doc     ON proveedores(nro_documento);
```

---

## 6. ENUMERACIONES (ENUMs de PostgreSQL)

```sql
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
```

---

## 7. RESUMEN DE TABLAS

| # | Tabla | Propósito | Registros estimados |
|---|---|---|---|
| 1 | `usuarios` | Autenticación y roles | Bajo (< 500) |
| 2 | `proveedores` | Datos personales y tributarios | Medio (cientos/campaña) |
| 3 | `direcciones_proveedor` | Ubicación del proveedor | 1:1 con proveedores |
| 4 | `datos_bancarios` | Cuentas para pago | 1-2 por proveedor |
| 5 | `documentos_proveedor` | Archivos adjuntos del registro | ~7 por proveedor |
| 6 | `campanas` | Campañas del fundo | Bajo (pocas por año) |
| 7 | `contratos` | Contratos de locación | 1 por proveedor/campaña |
| 8 | `validaciones_firma` | Intentos de validación IA | 1-3 por contrato |
| 9 | `entregables` | Periodos de pago del contrato | N por contrato (ej. 6) |
| 10 | `tramites_pago` | Trámite por cada entregable | 1:1 con entregables |
| 11 | `documentos_tramite` | Recibos y docs del trámite | ~3 por trámite |
| 12 | `historial_tramite` | Trazabilidad de estados | Varios por trámite |
| 13 | `notificaciones` | Log de correos enviados | Alto (varios por evento) |
| 14 | `administradores` | Datos del personal admin | Bajo |
| 15 | `registros_blockchain` | Referencias a txs en blockchain | 1-2 por contrato |

---

*Fin del documento — Versión 1.0 — Complejo Agroindustrial Beta / Antigravity*