import { Router } from 'express';
import { pool } from '../config/db';
import { sendEmailMock } from '../utils/emailService';
import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';

const router = Router();

// GET all providers
router.get('/proveedores', async (req, res) => {
  try {
    const query = `
      SELECT p.*, 
             u.id as user_id,
             MAX(CASE WHEN d.tipo_documento = 'dj_lavado' THEN d.ruta_storage END) as declaracion_jurada_pdf,
             MAX(CASE WHEN d.tipo_documento = 'certijoven' THEN d.ruta_storage END) as certijoven_pdf,
             MAX(CASE WHEN d.tipo_documento = 'dni_anverso' THEN d.ruta_storage END) as dni_pdf,
             MAX(CASE WHEN d.tipo_documento = 'ficha_ruc' THEN d.ruta_storage END) as ruc_pdf
      FROM proveedores p
      LEFT JOIN usuarios u ON p.correo = u.email
      LEFT JOIN documentos_proveedor d ON d.proveedor_id = p.id
      GROUP BY p.id, u.id
      ORDER BY p.created_at DESC
    `;
    const result = await pool.query(query);
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST Reject provider
router.post('/proveedores/:id/rechazar', async (req, res) => {
  const { id } = req.params;
  const { observacion } = req.body;
  
  try {
    const provRes = await pool.query(`
      UPDATE proveedores 
      SET estado_registro = 'rechazado' 
      WHERE id = $1 RETURNING nombres, correo
    `, [id]);

    if (provRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Proveedor no encontrado' });
    }
    const prov = provRes.rows[0];

    const emailBody = `Hola ${prov.nombres},\n\nLamentablemente, tu registro en el Portal AgroBeta no ha podido ser aprobado.\n\nMotivo/Observación: ${observacion || 'Documentos inválidos'}\n\nPor favor, comunícate con soporte.\n\nSaludos,\nEquipo AgroBeta`;
    await sendEmailMock(prov.correo, 'Registro Observado - AgroBeta', emailBody);

    res.json({ success: true, message: 'Proveedor rechazado y notificado' });
  } catch (error: any) {
    console.error('Error rejecting provider:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST Approve provider
router.post('/proveedores/:id/aprobar', async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // 1. Aprobar proveedor
    const provRes = await client.query(`
      UPDATE proveedores 
      SET estado_registro = 'aprobado' 
      WHERE id = $1 RETURNING id, nombres, apellido_paterno, ruc, correo
    `, [id]);

    if (provRes.rows.length === 0) {
      throw new Error('Proveedor no encontrado');
    }
    const prov = provRes.rows[0];

    // 2. MOCK: Asumimos una campaña activa
    const campanaRes = await client.query('SELECT id FROM campanas LIMIT 1');
    let campanaId = campanaRes.rows.length > 0 ? campanaRes.rows[0].id : null;

    if (!campanaId) {
      const newCampana = await client.query(`
        INSERT INTO campanas (nombre, fecha_inicio, fecha_fin) 
        VALUES ('Campaña Beta 2026', CURRENT_DATE, CURRENT_DATE + INTERVAL '6 months') RETURNING id
      `);
      campanaId = newCampana.rows[0].id;
    }

    // 3. Crear Contrato (Borrador) en DB
    const timestamp = Date.now().toString().slice(-6);
    const nroContrato = `LOC-${timestamp}`;
    const filename = `contrato_${nroContrato}.pdf`;
    
    // Directorio de contratos
    const contratosDir = path.join(__dirname, '../../uploads/contratos');
    if (!fs.existsSync(contratosDir)) {
      fs.mkdirSync(contratosDir, { recursive: true });
    }
    const filePath = path.join(contratosDir, filename);

    // 4. Generar PDF Físico con pdfkit
    const doc = new PDFDocument({ margin: 50 });
    const writeStream = fs.createWriteStream(filePath);
    doc.pipe(writeStream);
    
    doc.fontSize(20).text('CONTRATO DE LOCACIÓN DE SERVICIOS', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Conste por el presente documento, el Contrato de Locación de Servicios (Nro: ${nroContrato}) que celebran de una parte AgroBeta S.A.C., y de la otra parte el LOCADOR:`);
    doc.moveDown();
    doc.text(`Nombre Completo: ${prov.nombres} ${prov.apellido_paterno}`);
    doc.text(`RUC: ${prov.ruc}`);
    doc.moveDown();
    doc.text('CLAUSULA PRIMERA: El LOCADOR se compromete a prestar servicios agrícolas temporales para la Campaña Beta 2026.');
    doc.text('CLAUSULA SEGUNDA: El monto total de los honorarios asciende a S/ 10,800.00, pagaderos en 6 entregables mensuales de S/ 1,800.00.');
    doc.moveDown(3);
    doc.text('_____________________________', { align: 'center' });
    doc.text('Firma del LOCADOR', { align: 'center' });
    
    doc.end();

    // Esperar a que el archivo se termine de escribir
    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    // 3b. Generate temp password (8 chars random)
    const tempPassword = Math.random().toString(36).slice(-8).toUpperCase();
    const expiraEn = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas

    // Update usuario with temp password + must change flag
    await client.query(`
      UPDATE usuarios 
      SET password_hash = $1, debe_cambiar_password = TRUE, password_expira_en = $2, estado = 'activo'
      WHERE email = $3
    `, [tempPassword, expiraEn, prov.correo]);

    const contratoRes = await client.query(`
      INSERT INTO contratos (
        proveedor_id, campana_id, nro_contrato, descripcion_servicio, 
        fecha_inicio, fecha_fin, monto_total, nro_entregables, monto_por_entregable, estado,
        pdf_borrador_ruta
      ) VALUES ($1, $2, $3, 'Servicios Agrícolas de Locación', CURRENT_DATE, CURRENT_DATE + INTERVAL '6 months', 10800.00, 6, 1800.00, 'pendiente_firma', $4) RETURNING id
    `, [prov.id, campanaId, nroContrato, `uploads/contratos/${filename}`]);

    await client.query('COMMIT');

    // 5. Enviar Notificación con contraseña temporal
    const emailBody = `Hola ${prov.nombres},\n\nTu registro en el Portal AgroBeta ha sido APROBADO. ¡Bienvenido!\n\nYa hemos generado tu contrato en PDF. Para acceder al portal, usa las siguientes credenciales temporales (válidas por 24 horas):\n\n📧 Correo: ${prov.correo}\n🔑 Contraseña temporal: ${tempPassword}\n\n⚠️ Al iniciar sesión, el sistema te pedirá que cambies tu contraseña.\n\nDespués de ingresar: descarga tu contrato, fírmalo y súbelo junto a tu DNI.\n\nSaludos,\nEquipo AgroBeta`;
    await sendEmailMock(prov.correo, 'Registro Aprobado - Tus credenciales de acceso', emailBody);

    res.json({ success: true, message: 'Proveedor aprobado, Contrato PDF generado y credenciales enviadas' });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error approving provider:', error);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
});

// GET all pending payments (Trámites en_revision)
router.get('/tramites', async (req, res) => {
  try {
    const query = `
      SELECT 
        tp.id, tp.monto_bruto as monto, tp.monto_neto, tp.estado,
        e.nro_entregable, e.periodo, e.id as entregable_id,
        MAX(CASE WHEN dt.tipo_documento = 'recibo_pdf' THEN dt.ruta_storage END) as recibo_pdf,
        MAX(CASE WHEN dt.tipo_documento = 'recibo_xml' THEN dt.ruta_storage END) as recibo_xml,
        MAX(CASE WHEN dt.tipo_documento = 'suspension_4ta' THEN dt.ruta_storage END) as suspension_pdf,
        pr.nombres, pr.apellido_paterno, pr.ruc
      FROM tramites_pago tp
      JOIN entregables e ON tp.entregable_id = e.id
      JOIN contratos c ON e.contrato_id = c.id
      JOIN proveedores pr ON c.proveedor_id = pr.id
      LEFT JOIN documentos_tramite dt ON dt.tramite_id = tp.id
      WHERE tp.estado = 'en_revision'
      GROUP BY tp.id, e.id, pr.id
      ORDER BY tp.created_at ASC
    `;
    const result = await pool.query(query);
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST Approve payment
router.post('/tramites/:id/aprobar', async (req, res) => {
  const { id } = req.params; // tramite_pago id
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Update tramite_pago status
    const tpRes = await client.query(`
      UPDATE tramites_pago SET estado = 'aprobado' WHERE id = $1 RETURNING entregable_id
    `, [id]);

    const entregableId = tpRes.rows[0].entregable_id;

    // Update entregable
    const entRes = await client.query(`
      UPDATE entregables SET estado = 'aprobado' WHERE id = $1 RETURNING contrato_id, nro_entregable
    `, [entregableId]);
    
    // Get provider email for notification
    const provRes = await client.query(`
      SELECT pr.correo, pr.nombres FROM proveedores pr
      JOIN contratos c ON pr.id = c.proveedor_id
      WHERE c.id = $1
    `, [entRes.rows[0].contrato_id]);

    await client.query('COMMIT');

    const emailBody = `Hola ${provRes.rows[0].nombres},\n\nTu trámite de pago (Mes ${entRes.rows[0].nro_entregable}) ha sido APROBADO.\nEl depósito se realizará en las próximas 48 horas.\n\nSaludos,\nEquipo AgroBeta`;
    await sendEmailMock(provRes.rows[0].correo, 'Pago Aprobado - AgroBeta', emailBody);

    res.json({ success: true, message: 'Trámite aprobado' });
  } catch (error: any) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
});

// POST Reject payment
router.post('/tramites/:id/rechazar', async (req, res) => {
  const { id } = req.params; // tramite_pago id
  const { observacion } = req.body;
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Get entregable_id
    const tpRes = await client.query(`SELECT entregable_id FROM tramites_pago WHERE id = $1`, [id]);
    const entregableId = tpRes.rows[0].entregable_id;
    
    // Revert entregable to 'pendiente' so provider can upload again
    const entRes = await client.query(`
      UPDATE entregables SET estado = 'pendiente' WHERE id = $1 RETURNING contrato_id, nro_entregable
    `, [entregableId]);
    
    // Delete payment documents and tramite so it can be re-submitted
    await client.query('DELETE FROM documentos_tramite WHERE tramite_id = $1', [id]);
    await client.query('DELETE FROM tramites_pago WHERE id = $1', [id]);

    const provRes = await client.query(`
      SELECT pr.correo, pr.nombres FROM proveedores pr
      JOIN contratos c ON pr.id = c.proveedor_id
      WHERE c.id = $1
    `, [entRes.rows[0].contrato_id]);

    await client.query('COMMIT');

    const emailBody = `Hola ${provRes.rows[0].nombres},\n\nTu trámite de pago (Mes ${entRes.rows[0].nro_entregable}) ha sido OBSERVADO/RECHAZADO.\n\nMotivo: ${observacion || 'Documentos incorrectos'}\n\nPor favor, ingresa al portal y vuelve a subir tus documentos corregidos.\n\nSaludos,\nEquipo AgroBeta`;
    await sendEmailMock(provRes.rows[0].correo, 'Pago Observado - AgroBeta', emailBody);

    res.json({ success: true, message: 'Trámite rechazado' });
  } catch (error: any) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
});

export default router;
