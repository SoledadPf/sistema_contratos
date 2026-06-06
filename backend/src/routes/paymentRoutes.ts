import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { pool } from '../config/db';
import { sendEmailMock } from '../utils/emailService';

const router = Router();

// Configure Multer
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const toRelativePath = (filePath: string): string => {
  const normalized = filePath.replace(/\\/g, '/');
  const idx = normalized.indexOf('uploads/');
  if (idx !== -1) return normalized.slice(idx);
  return `uploads/${path.basename(normalized)}`;
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ storage });

router.post('/tramite', upload.fields([
  { name: 'recibo_pdf', maxCount: 1 },
  { name: 'recibo_xml', maxCount: 1 }, // Added XML
  { name: 'suspension_pdf', maxCount: 1 }
]), async (req: any, res: any) => {
  const client = await pool.connect();
  
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const { entregable_id, tiene_suspension_4ta } = req.body;

    if (!files || !files.recibo_pdf) {
      return res.status(400).json({ success: false, message: 'Falta el archivo del Recibo por Honorarios (PDF)' });
    }

    if (!entregable_id) {
      return res.status(400).json({ success: false, message: 'Falta el ID del entregable' });
    }

    await client.query('BEGIN');

    // 1. Obtener el monto del entregable real de la BD
    const entRes = await client.query('SELECT monto FROM entregables WHERE id = $1', [entregable_id]);
    if (entRes.rows.length === 0) {
      throw new Error("Entregable no encontrado");
    }
    const montoBrutoNum = Number(entRes.rows[0].monto);
    const tieneSuspension = tiene_suspension_4ta === 'true';

    // Regla Tributaria SUNAT
    let porcentajeRetencion = 0;
    if (montoBrutoNum > 1500 && !tieneSuspension) {
      porcentajeRetencion = 8.00;
    }

    const montoRetencion = (montoBrutoNum * porcentajeRetencion) / 100;
    const montoNeto = montoBrutoNum - montoRetencion;

    // 2. Actualizar Entregable a 'notificado'
    await client.query(`UPDATE entregables SET estado = 'notificado' WHERE id = $1`, [entregable_id]);

    // 3. Guardar Trámite de Pago
    const tramiteQuery = `
      INSERT INTO tramites_pago (
        entregable_id, tipo_comprobante, monto_bruto, tiene_suspension_4ta, 
        retencion_porcentaje, monto_retencion, monto_neto, estado
      ) VALUES ($1, 'recibo_honorarios', $2, $3, $4, $5, $6, 'en_revision') RETURNING id
    `;
    const tramiteRes = await client.query(tramiteQuery, [
      entregable_id, montoBrutoNum, tieneSuspension, porcentajeRetencion, montoRetencion, montoNeto
    ]);
    const tramiteId = tramiteRes.rows[0].id;

    // 4. Guardar Documentos en BD
    const fileRecibo = files.recibo_pdf[0];
    await client.query(`
      INSERT INTO documentos_tramite (tramite_id, tipo_documento, nombre_archivo, ruta_storage) 
      VALUES ($1, 'recibo_pdf', $2, $3)
    `, [tramiteId, fileRecibo.originalname, toRelativePath(fileRecibo.path)]);

    if (files.recibo_xml && files.recibo_xml.length > 0) {
      const fileXml = files.recibo_xml[0];
      await client.query(`
        INSERT INTO documentos_tramite (tramite_id, tipo_documento, nombre_archivo, ruta_storage) 
        VALUES ($1, 'recibo_xml', $2, $3)
      `, [tramiteId, fileXml.originalname, toRelativePath(fileXml.path)]);
    }

    if (files.suspension_pdf && files.suspension_pdf.length > 0) {
      const fileSuspension = files.suspension_pdf[0];
      await client.query(`
        INSERT INTO documentos_tramite (tramite_id, tipo_documento, nombre_archivo, ruta_storage) 
        VALUES ($1, 'suspension_4ta', $2, $3)
      `, [tramiteId, fileSuspension.originalname, toRelativePath(fileSuspension.path)]);
    }

    await client.query('COMMIT');

    // 5. MOCK EMAIL AL ADMIN
    await sendEmailMock(
      'admin@agrobeta.com',
      'Nuevo Trámite de Pago Recibido',
      `Se ha recibido un nuevo recibo por honorarios para el entregable ID: ${entregable_id}.\nMonto Bruto: S/ ${montoBrutoNum}\nPor favor ingrese al panel administrativo para revisarlo y autorizar el pago.`
    );

    res.status(201).json({
      success: true,
      message: 'Trámite de pago registrado correctamente y notificado al área de pagos',
      data: {
        tramite_id: tramiteId,
        monto_bruto: montoBrutoNum,
        porcentaje_retencion: porcentajeRetencion,
        monto_retencion: montoRetencion,
        monto_neto: montoNeto
      }
    });

  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error al procesar pago:', error);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
});

export default router;
