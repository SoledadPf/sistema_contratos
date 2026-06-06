# ESPECIFICACIONES FUNCIONALES
## Portal de Proveedores Temporales — Sistema Inteligente de Gestión de Contratos y Pagos
### Complejo Agroindustrial Beta
**Versión 1.1 | Ica, Perú | 2025**
*Documento preparado para: Antigravity*

---

## 1. RESUMEN EJECUTIVO

El Complejo Agroindustrial Beta requiere un sistema web para gestionar de forma digital el proceso completo de contratación de personal temporal por campaña (locación de servicios). Actualmente este proceso se realiza de manera manual, con documentos físicos y sin trazabilidad. El sistema propuesto digitaliza todo el flujo: desde el registro del proveedor hasta la liberación del pago por entregable, pasando por validación de firma mediante inteligencia artificial, registro en blockchain y gestión de trámites de pago por periodo.

> **Alcance:** El sistema atiende exclusivamente al personal contratado bajo la modalidad de locación de servicios en el fundo (régimen de recibos por honorarios emitidos por el proveedor). No incluye trabajadores de planilla ni personal administrativo permanente.

---

## 2. OBJETIVO GENERAL Y ESPECÍFICOS

### 2.1 Objetivo general

Desarrollar un portal web que permita a los proveedores temporales del Complejo Agroindustrial Beta registrar sus datos, subir su documentación, firmar digitalmente su contrato de locación de servicios, gestionar sus trámites de pago por entregable mensual y recibir la confirmación de pago una vez que la empresa apruebe cada entregable.

### 2.2 Objetivos específicos

- Digitalizar el proceso de registro y onboarding del trabajador temporal por campaña.
- Implementar validación automática de la firma del contrato comparándola contra la firma extraída del DNI escaneado del proveedor, con umbral mínimo de 90% de similitud.
- Automatizar la generación de los módulos de trámite de pago por entregable mensual, conforme a lo establecido en el contrato aprobado.
- Gestionar el flujo de aprobación de cada trámite de pago: el proveedor notifica su entregable adjuntando su recibo por honorarios electrónico (emitido en SUNAT), y la empresa aprueba para liberar el pago.
- Registrar cada contrato aprobado en blockchain para garantizar su inmutabilidad y trazabilidad legal.
- Proveer un panel administrativo para que el equipo del fundo gestione campañas, contratos, trámites de pago y reportes.

---

## 3. DOCUMENTOS Y DATOS REQUERIDOS DEL PROVEEDOR

Para poder formalizar el contrato y gestionar los pagos, el sistema debe recopilar los siguientes datos y documentos del proveedor. La **firma de referencia no se registra por separado**; el sistema extrae la firma directamente del DNI escaneado que el proveedor sube durante su registro.

### 3.1 Datos personales y tributarios

| Campo | Descripción | Requerido |
|---|---|---|
| Tipo de documento | DNI (por defecto) o Extranjería | Sí |
| Número de documento | DNI vigente | Sí |
| RUC | RUC de persona natural (4ta categoría) | Sí |
| Fecha de inicio de actividad | Según ficha SUNAT | Sí |
| Nombres | Tal como figura en DNI | Sí |
| Apellido Paterno | Tal como figura en DNI | Sí |
| Apellido Materno | Tal como figura en DNI | Sí |
| País / Departamento / Provincia / Distrito de nacimiento | Datos de nacimiento | Sí |
| Fecha de nacimiento | Según DNI | Sí |
| Ocupación | Actividad declarada | Sí |
| Actividad Económica CIIU | Código CIIU registrado en SUNAT | Sí |
| Rubro | Descripción del rubro de actividad | Sí |
| Teléfono móvil | Número de celular principal (9 dígitos) | Sí |
| Teléfono fijo | Opcional | No |
| Correo electrónico | Para notificaciones y envío de documentos | Sí |
| Lugar de constitución | País de constitución (Perú por defecto) | Sí |
| Tipo de relación | Proveedor (valor fijo para este módulo) | Sí |

### 3.2 Datos de ubicación

| Campo | Descripción | Requerido |
|---|---|---|
| Departamento / Provincia / Distrito / Zona | Dirección del proveedor | Sí |
| Tipo de vía y descripción | Av., Jr., Calle, etc. + nombre | Sí |
| Tipo de zona, Manzana, Lote, Etapa, Número | Datos de urbanización | Condicional |
| Interior, Bloque y sus descripciones | Datos adicionales de dirección | No |

### 3.3 Documentos a adjuntar

| Documento | Descripción | Requerido |
|---|---|---|
| Copia DNI (anverso y reverso) | Imagen o PDF, mín. 300 dpi. La firma del DNI es la referencia biométrica para validar el contrato. | Sí |
| Ficha RUC (constancia SUNAT) | PDF descargado de SUNAT actualizado | Sí |
| Certijoven / Adulto | Según corresponda por rango de edad | Sí |
| CV | Currículum vitae del proveedor | Sí |
| Declaración Jurada de Domicilio | Documento firmado | Sí |
| Declaración Jurada de Lavado de Activos | Documento firmado | Sí |
| Registro de Proveedor | Ficha de registro según formato de la empresa | Sí |

### 3.4 Datos bancarios (para trámite de pago)

| Campo | Descripción | Requerido |
|---|---|---|
| CCI (Código de Cuenta Interbancario) | Para transferencias entre bancos | Sí |
| Banco | Entidad bancaria donde tiene la cuenta | Sí |
| Número de cuenta | Cuenta en soles | Sí |

---

## 4. MÓDULOS DEL SISTEMA

| Módulo | Descripción funcional | Prioridad |
|---|---|---|
| M1 – Registro de proveedor | Formulario de onboarding: datos personales, datos de ubicación, datos tributarios y carga de documentos requeridos. Estructura equivalente a la vista "Datos Generales" del sistema de referencia. | Alta |
| M2 – Validación de documentos | Revisión de los documentos adjuntos. El sistema valida automáticamente el estado del RUC en SUNAT y la calidad de las imágenes. El administrador puede observar o aprobar manualmente. | Alta |
| M3 – Gestión de contratos | El administrador genera el borrador del contrato de locación de servicios a partir de los datos del proveedor y la campaña. El proveedor lo descarga, lo firma y lo sube en PDF. | Alta |
| M4 – Validación IA de firma | El sistema extrae la firma del contrato subido por el proveedor y la compara contra la firma extraída del DNI escaneado. Si el score de similitud ≥ 90%, el contrato se aprueba automáticamente. Si no, se genera alerta para reenvío. | Alta |
| M5 – Blockchain | Registro inmutable del contrato aprobado: hash SHA-256 del documento, fecha y hora, score de validación, RUC del proveedor e ID de campaña. | Alta |
| M6 – Trámites de pago por entregable | Una vez aprobado el contrato, el sistema genera automáticamente los módulos de trámite de pago según el número de entregables y periodos definidos en el contrato. El proveedor los va completando mes a mes. | Alta |
| M7 – Flujo de aprobación de pago | El proveedor adjunta su recibo por honorarios electrónico (XML + PDF de SUNAT) y documentos adicionales, luego hace clic en "Notificar". La empresa recibe la notificación, revisa y aprueba o rechaza para liberar el pago. | Alta |
| M8 – Notificaciones | Envío automático por correo: confirmación de registro, estado del contrato (aprobado/rechazado), notificación de trámite de pago recibido, aprobación o rechazo de cada entregable. | Alta |
| M9 – Panel administrativo | Dashboard para el equipo del fundo: gestión de campañas, listado de proveedores por campaña, estado de contratos, trámites de pago pendientes de aprobación y reportes. | Alta |
| M10 – Alertas de rechazo | Cuando la firma no supera el umbral del 90%, o cuando un trámite de pago es rechazado, el sistema notifica al proveedor con las observaciones y solicita corrección. | Media |
| M11 – Historial y reportes | Exportación en Excel/PDF: proveedores por campaña, montos por pagar y pagados, contratos validados, estado de trámites. | Media |

---

## 5. FLUJO DE PROCESO COMPLETO

### 5.1 Registro inicial del proveedor

1. El proveedor ingresa al portal y crea su cuenta con correo y contraseña.
2. Completa el formulario de datos generales: personales, nacimiento, tributarios y ubicación (equivalente a la pantalla "Datos Generales" de referencia).
3. Sube todos los documentos requeridos: DNI (anverso y reverso), ficha RUC, certijoven/adulto, CV, declaraciones juradas y registro de proveedor.
4. El sistema valida automáticamente el RUC en SUNAT (estado activo y habido) y la calidad de las imágenes del DNI.
5. El proveedor queda en estado **"Pendiente de aprobación"** hasta que el administrador valide su documentación.
6. El administrador puede registrar observaciones y el proveedor recibe notificación para corregir o subsanar.

### 5.2 Carga y validación del contrato

1. Una vez aprobada la documentación, el administrador asigna al proveedor a una campaña con fechas, monto y número de entregables definidos.
2. El sistema genera el borrador del contrato de locación de servicios pre-llenado con los datos del proveedor y la campaña.
3. El proveedor descarga el contrato, lo firma a mano, lo escanea y lo sube en PDF. (Alternativa: firma digital en tablet si el proveedor se presenta físicamente.)
4. El módulo de IA extrae la firma del PDF mediante segmentación de imagen (OCR + detección de zona de firma).
5. La firma extraída se compara biométricamente contra la firma extraída del DNI escaneado del proveedor (que ya obra en el sistema).
6. **Si score ≥ 90% →** Contrato aprobado automáticamente.
7. **Si score < 90% →** Contrato rechazado; se notifica al proveedor para que reenvíe el documento con firma más legible o lo firme nuevamente.

### 5.3 Generación automática de trámites de pago

1. Al aprobarse el contrato, el sistema genera automáticamente los módulos de **"Trámite de Pago"**, uno por cada entregable/periodo definido en el contrato (por ejemplo, 6 entregables mensuales de S/ 1,800.00 cada uno).
2. Cada trámite muestra: nombre del entregable, monto, tipo (recibo por honorarios), número de comprobante correlativo, descripción del servicio y periodo.
3. El proveedor ve todos sus trámites listados y puede irlos completando conforme avanza la campaña.

### 5.4 Flujo de aprobación de cada entregable

1. El proveedor selecciona el trámite del mes correspondiente.
2. Completa los datos del comprobante: tipo (Recibo por honorarios), fecha de emisión, número de comprobante (serie + número emitido en SUNAT), descripción del servicio.
3. Adjunta los documentos requeridos para ese trámite:
   - Recibo por honorarios electrónico en XML (emitido por el proveedor en SUNAT).
   - Recibo por honorarios en PDF (constancia del mismo comprobante).
   - Documentos adicionales si aplica (ej. suspensión de 4ta categoría).
4. Hace clic en **"Notificar"**: el sistema envía la notificación al administrador del fundo.
5. El administrador revisa el trámite, verifica que el comprobante coincida con el monto y periodo del contrato.
6. **Si aprueba →** El trámite pasa a estado "Aprobado" y se gestiona la transferencia bancaria a los datos de cuenta registrados por el proveedor.
7. **Si rechaza →** El administrador registra una observación, el proveedor recibe notificación y debe corregir o volver a notificar.

### 5.5 Registro en blockchain

1. Al aprobarse el contrato, se genera el hash SHA-256 del PDF del contrato firmado.
2. Se escribe en la red blockchain: hash del contrato, RUC del proveedor, ID de campaña, fecha y hora de aprobación, score de validación de firma, ID del administrador que autorizó.
3. El número de transacción blockchain queda asociado al contrato y es consultable desde el panel de auditoría.
4. Cada aprobación de trámite de pago también puede registrarse en blockchain como evidencia del cumplimiento del entregable.

---

## 6. REQUISITOS TÉCNICOS SUGERIDOS

### 6.1 Frontend

- **Framework:** React.js o Next.js
- **UI:** Tailwind CSS o Material UI (interfaz similar al sistema de referencia mostrado)
- **Carga de archivos:** Soporte para PDF, JPG, PNG — máximo 10 MB por archivo
- **Firma digital en tablet:** Librería `signature_pad` para captura de firma en canvas (alternativa presencial)

### 6.2 Backend

- **Lenguaje:** Node.js (Express) o Python (FastAPI)
- **Base de datos:** PostgreSQL para datos relacionales de proveedores, contratos, trámites y pagos
- **Almacenamiento de archivos:** AWS S3, Cloudinary o almacenamiento propio (para PDFs e imágenes)
- **Autenticación:** JWT con roles: proveedor, administrador, auditor, súper admin
- **API SUNAT:** Validación de RUC en tiempo real (API SUNAT o scraping del portal)

### 6.3 Módulo de IA para validación de firma

- **Extracción de firma del contrato:** OpenCV + segmentación de zona de firma en el PDF
- **Extracción de firma del DNI:** Segmentación automática de la zona de firma en la imagen del DNI escaneado
- **Modelo de comparación biométrica:** Siamese Network entrenada con pares de firmas, o API de terceros (ej. AWS Rekognition Custom Labels)
- **Umbral de aprobación:** Score de similitud ≥ 90%
- **Servicio:** Microservicio Python (FastAPI) con endpoint `/validar-firma` que recibe las dos imágenes y devuelve el score

### 6.4 Blockchain

- **Red recomendada:** Hyperledger Fabric (red privada empresarial) o Polygon Mumbai (más rápido de implementar para MVP)
- **Smart contract / chaincode:** Registro de hash del contrato, metadata de aprobación, RUC y campaña
- **Consulta de auditoría:** Endpoint para verificar autenticidad de un contrato dado su hash

### 6.5 Notificaciones

- **Correo:** SendGrid, AWS SES o similar
- **Eventos que disparan notificación:** registro recibido, documentos aprobados/rechazados, contrato aprobado/rechazado, trámite de pago notificado (al admin), trámite aprobado/rechazado (al proveedor)

---

## 7. ROLES Y PERMISOS

| Rol | Permisos principales |
|---|---|
| Proveedor / Trabajador temporal | Crea cuenta, sube documentos, sube contrato firmado, completa y notifica trámites de pago, consulta estado. |
| Administrador del fundo | Valida documentos, crea campañas, aprueba/rechaza contratos y trámites de pago, registra observaciones, descarga reportes. |
| Auditor | Solo lectura: consulta contratos, verifica hashes en blockchain, descarga boletas y trámites. |
| Súper admin (TI / Antigravity) | Acceso total: configuración de parámetros de IA, blockchain y sistema. |

---

## 8. SEGURIDAD Y CUMPLIMIENTO LEGAL

- Todos los documentos deben almacenarse cifrados (AES-256 en reposo).
- Comunicaciones bajo HTTPS/TLS en todo momento.
- Los datos personales (DNI, cuenta bancaria, documentos tributarios) deben tratarse conforme a la **Ley N.° 29733 de Protección de Datos Personales** del Perú.
- Log de auditoría de todas las acciones administrativas (quién aprobó, cuándo, qué).
- Las imágenes de DNI no deben ser accesibles públicamente; requieren autenticación.
- 2FA (doble factor de autenticación) obligatorio para el rol de administrador.
- Los recibos por honorarios son emitidos por el proveedor en SUNAT; el sistema no los genera, solo los recibe y archiva como parte del trámite.

---

## 9. ENTREGABLES ESPERADOS DEL DESARROLLO

1. Portal web del proveedor (registro, carga de documentos, carga de contrato, gestión de trámites de pago).
2. Panel administrativo web (campañas, contratos, aprobación de trámites, reportes).
3. Servicio de IA para validación de firma contra DNI (API interna).
4. Integración con blockchain (smart contract / chaincode desplegado y documentado).
5. Sistema de notificaciones por correo electrónico.
6. Manual de usuario para proveedor y administrador.
7. Documentación técnica de la API y arquitectura del sistema.

---

## 10. EXCLUSIONES DEL ALCANCE

El presente sistema **NO incluye:**

- Gestión de trabajadores de planilla (contrato indefinido o a plazo fijo con beneficios sociales).
- Emisión de recibos por honorarios electrónicos (eso lo hace el proveedor directamente en SUNAT; el sistema solo los recibe).
- Generación de boletas de pago de planilla u otros documentos laborales de la empresa.
- Integración con sistema contable o ERP existente (se plantea como fase futura).
- Declaración automática ante SUNAT (PDT 616 u otros); los documentos generados son el insumo para que contabilidad realice la declaración manualmente.
- Módulo de nómina, CTS, gratificaciones u otros beneficios laborales.

---

## APROBACIÓN DEL DOCUMENTO

| | |
|---|---|
| **Elaborado por:** | **Revisado y aprobado por:** |
| Complejo Agroindustrial Beta | Antigravity (Proveedor de desarrollo) |
| Área: Sistemas / Operaciones | Responsable de proyecto |
| Firma: __________________________ | Firma: __________________________ |
| Fecha: ____/____/______ | Fecha: ____/____/______ |
