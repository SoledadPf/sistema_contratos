import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { pool } from '../config/db';

const router = Router();

// Configure Multer
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const toRelativePath = (filePath: string): string => {
  const normalized = filePath.replace(/\\/g, '/');
  const idx = normalized.indexOf('uploads/');
  if (idx !== -1) return normalized.slice(idx); // e.g., absolute path with uploads/
  // Just a filename — prepend uploads/
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

// Test connection
router.get('/test', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() as current_time');
    res.json({
      success: true,
      message: 'Base de datos conectada correctamente!',
      time: result.rows[0].current_time
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error de conexión a la BD' });
  }
});

// Create a new provider
router.post('/', upload.fields([
  { name: 'antecedentes_pdf', maxCount: 1 },
  { name: 'certijoven_pdf', maxCount: 1 },
  { name: 'dni_pdf', maxCount: 1 },
  { name: 'ruc_pdf', maxCount: 1 }
]), async (req: any, res: any) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { 
      tipo_documento, nro_documento, ruc, nombres, apellido_paterno, apellido_materno, 
      correo, telefono_movil, fecha_nacimiento, fecha_inicio_actividad,
      departamento, provincia, distrito, direccion
    } = req.body;

    const files = req.files as { [fieldname: string]: Express.Multer.File[] };

    let antecedentes_pdf = '';
    let certijoven_pdf = '';
    let dni_pdf = '';
    let ruc_pdf = '';

    if (files && files.antecedentes_pdf) antecedentes_pdf = files.antecedentes_pdf[0].filename;
    if (files && files.certijoven_pdf) certijoven_pdf = files.certijoven_pdf[0].filename;
    if (files && files.dni_pdf) dni_pdf = files.dni_pdf[0].filename;
    if (files && files.ruc_pdf) ruc_pdf = files.ruc_pdf[0].filename;

    // Create dummy user for the provider
    const userResult = await client.query(`
      INSERT INTO usuarios (email, password_hash, rol) 
      VALUES ($1, $2, 'proveedor') RETURNING id
    `, [correo, 'hashed_password_mock']);
    
    const userId = userResult.rows[0].id;

    const query = `
      INSERT INTO proveedores (
        usuario_id, tipo_documento, nro_documento, ruc, fecha_inicio_actividad, 
        nombres, apellido_paterno, apellido_materno, fecha_nacimiento, 
        telefono_movil, correo
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *
    `;
    
    const values = [
      userId, tipo_documento, nro_documento, ruc, fecha_inicio_actividad,
      nombres, apellido_paterno, apellido_materno, fecha_nacimiento,
      telefono_movil, correo
    ];

    const result = await client.query(query, values);
    const proveedorId = result.rows[0].id;

    // Insert documents (store relative paths)
    const docQuery = `INSERT INTO documentos_proveedor (proveedor_id, tipo_documento, mime_type, nombre_archivo, ruta_storage) VALUES ($1, $2, $3, $4, $5)`;
    if (antecedentes_pdf) await client.query(docQuery, [proveedorId, 'dj_lavado', files.antecedentes_pdf[0].mimetype, files.antecedentes_pdf[0].originalname, toRelativePath(files.antecedentes_pdf[0].path)]);
    if (certijoven_pdf) await client.query(docQuery, [proveedorId, 'certijoven', files.certijoven_pdf[0].mimetype, files.certijoven_pdf[0].originalname, toRelativePath(files.certijoven_pdf[0].path)]);
    if (dni_pdf) await client.query(docQuery, [proveedorId, 'dni_anverso', files.dni_pdf[0].mimetype, files.dni_pdf[0].originalname, toRelativePath(files.dni_pdf[0].path)]);
    if (ruc_pdf) await client.query(docQuery, [proveedorId, 'ficha_ruc', files.ruc_pdf[0].mimetype, files.ruc_pdf[0].originalname, toRelativePath(files.ruc_pdf[0].path)]);

    // ── BASE DE CONOCIMIENTOS: guardar DNI como firma de referencia inicial ──
    if (dni_pdf) {
      await client.query(`
        INSERT INTO base_conocimientos_firma (proveedor_id, tipo_origen, ruta_archivo, nombre_archivo, score_confianza)
        VALUES ($1, 'dni', $2, $3, 1.0000)
      `, [proveedorId, toRelativePath(files.dni_pdf[0].path), files.dni_pdf[0].originalname]);
    }
    // ── También guardar la declaración jurada como fuente de firma ──
    if (antecedentes_pdf) {
      await client.query(`
        INSERT INTO base_conocimientos_firma (proveedor_id, tipo_origen, ruta_archivo, nombre_archivo, score_confianza)
        VALUES ($1, 'declaracion_jurada', $2, $3, 1.0000)
      `, [proveedorId, toRelativePath(files.antecedentes_pdf[0].path), files.antecedentes_pdf[0].originalname]);
    }

    // Insert into direcciones_proveedor
    if (departamento || provincia || distrito || direccion) {
      await client.query(`
        INSERT INTO direcciones_proveedor (
          proveedor_id, departamento, provincia, distrito, descripcion_via
        ) VALUES ($1, $2, $3, $4, $5)
      `, [proveedorId, departamento || '', provincia || '', distrito || '', direccion || '']);
    }

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Proveedor registrado con éxito',
      data: result.rows[0]
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error registering provider:', error);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
});

export default router;
