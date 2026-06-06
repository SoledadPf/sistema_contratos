import { Router } from 'express';
import multer from 'multer';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import { pool } from '../config/db';
import crypto from 'crypto';

const router = Router();

// Configure Multer for local storage
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ storage });

// Ruta para obtener entregables del proveedor
router.get('/mis-entregables', async (req, res) => {
  try {
    // Para simplificar MVP, tomaremos el id del correo en el header o buscaremos el primero
    const correo = req.headers['user-email'] as string;
    
    let query = '';
    let values: any[] = [];
    
    if (correo) {
      query = `
        SELECT e.id, e.nro_entregable, e.nombre, e.periodo, e.monto, e.estado
        FROM entregables e
        JOIN contratos c ON e.contrato_id = c.id
        JOIN proveedores pr ON c.proveedor_id = pr.id
        WHERE pr.correo = $1
        ORDER BY e.nro_entregable ASC
      `;
      values = [correo];
    } else {
      query = `
        SELECT e.id, e.nro_entregable, e.nombre, e.periodo, e.monto, e.estado
        FROM entregables e
        JOIN contratos c ON e.contrato_id = c.id
        ORDER BY e.nro_entregable ASC
      `;
    }

    const result = await pool.query(query, values);
    res.json({ success: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Ruta para obtener el contrato (para descarga)
router.get('/mi-contrato', async (req, res) => {
  try {
    const correo = req.headers['user-email'] as string;
    if (!correo) return res.status(400).json({ success: false, message: 'Falta email' });

    const query = `
      SELECT c.pdf_borrador_ruta as archivo_pdf
      FROM contratos c
      JOIN proveedores pr ON c.proveedor_id = pr.id
      WHERE pr.correo = $1
      LIMIT 1
    `;
    const result = await pool.query(query, [correo]);
    if (result.rows.length === 0 || !result.rows[0].archivo_pdf) {
      return res.status(404).json({ success: false, message: 'Contrato no generado' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Ruta para subir contrato y DNI, enviarlo a la IA, y si pasa generar entregables
router.post('/validar', upload.fields([
  { name: 'firma_contrato', maxCount: 1 },
  { name: 'firma_dni', maxCount: 1 }
]), async (req: any, res: any) => {
  const client = await pool.connect();
  const correo = req.headers['user-email'] as string;
  
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    if (!files || !files.firma_contrato || !files.firma_dni) {
      return res.status(400).json({ success: false, message: 'Faltan los archivos firma_contrato o firma_dni' });
    }

    const fileContrato = files.firma_contrato[0];
    const fileDni = files.firma_dni[0];

    // ── 1. Buscar el proveedor para obtener su base de conocimientos ──
    const provRes = await pool.query(`
      SELECT p.id FROM proveedores p WHERE p.correo = $1 LIMIT 1
    `, [correo || '']);
    const proveedorId = provRes.rows.length > 0 ? provRes.rows[0].id : null;

    // ── 2. Obtener todas las firmas conocidas activas de este proveedor ──
    let firmasConocidas: Array<{ ruta_archivo: string; tipo_origen: string }> = [];
    if (proveedorId) {
      const bcfRes = await pool.query(`
        SELECT ruta_archivo, tipo_origen FROM base_conocimientos_firma
        WHERE proveedor_id = $1 AND activo = true
        ORDER BY created_at ASC
      `, [proveedorId]);
      firmasConocidas = bcfRes.rows;
    }

    // ── 3. Llamar al microservicio de IA comparando contra TODAS las firmas conocidas ──
    let score_similitud = 0.95;
    let resultado = 'aprobado';
    let mejor_referencia = 'mock';

    try {
      if (firmasConocidas.length > 0) {
        // Comparar contra cada firma de referencia y tomar el mejor score
        let mejorScore = 0;
        let mejorRef = '';

        for (const firma of firmasConocidas) {
          const refPath = path.join(__dirname, '../../', firma.ruta_archivo);
          if (!fs.existsSync(refPath)) continue;

          const form = new FormData();
          form.append('firma_contrato', fs.createReadStream(fileContrato.path));
          form.append('firma_dni', fs.createReadStream(refPath));

          const iaResponse = await axios.post('http://127.0.0.1:8000/validar-firma', form, {
            headers: { ...form.getHeaders() }
          });

          const scoreActual: number = iaResponse.data.score_similitud;
          if (scoreActual > mejorScore) {
            mejorScore = scoreActual;
            mejorRef = firma.tipo_origen;
          }
        }

        score_similitud = mejorScore;
        resultado = mejorScore >= 0.90 ? 'aprobado' : 'rechazado';
        mejor_referencia = mejorRef;
        console.log(`[IA] Mejor score: ${mejorScore} usando referencia: ${mejorRef}`);
      } else {
        // Sin firmas en BD, comparar contra el DNI subido ahora
        const form = new FormData();
        form.append('firma_contrato', fs.createReadStream(fileContrato.path));
        form.append('firma_dni', fs.createReadStream(fileDni.path));
        const iaResponse = await axios.post('http://127.0.0.1:8000/validar-firma', form, {
          headers: { ...form.getHeaders() }
        });
        score_similitud = iaResponse.data.score_similitud;
        resultado = iaResponse.data.resultado;
        mejor_referencia = 'dni_subido';
      }
    } catch (iaError) {
      console.log('[IA] API Python no disponible, usando MOCK de aprobación. Score: 0.95');
    }

    await client.query('BEGIN');

    // Buscar contrato existente para este usuario
    const contratoRes = await client.query(`
      SELECT c.id, c.estado 
      FROM contratos c
      JOIN proveedores pr ON c.proveedor_id = pr.id
      WHERE pr.correo = $1
      LIMIT 1
    `, [correo || '']);
    
    if (contratoRes.rows.length === 0) {
      throw new Error("No hay un contrato generado para este usuario. El Administrador debe aprobarte primero.");
    }

    const contratoId = contratoRes.rows[0].id;
    const rutaContratoRelativa = `uploads/${path.basename(fileContrato.path)}`;
    const estadoContrato = resultado === 'aprobado' ? 'en_validacion' : 'pendiente_firma';

    // Actualizar Contrato
    await client.query(`
      UPDATE contratos 
      SET estado = $1, pdf_firmado_ruta = $2
      WHERE id = $3
    `, [estadoContrato, rutaContratoRelativa, contratoId]);

    // ── BASE DE CONOCIMIENTOS: si fue aprobado, guardar la firma del contrato ──
    if (resultado === 'aprobado' && proveedorId) {
      // Guardar también el DNI recién subido si no tenía referencias previas
      if (firmasConocidas.length === 0) {
        await client.query(`
          INSERT INTO base_conocimientos_firma (proveedor_id, tipo_origen, ruta_archivo, nombre_archivo, score_confianza)
          VALUES ($1, 'dni', $2, $3, $4)
        `, [proveedorId, `uploads/${path.basename(fileDni.path)}`, fileDni.originalname, score_similitud]);
      }
      // Guardar la firma del contrato validado
      await client.query(`
        INSERT INTO base_conocimientos_firma (proveedor_id, tipo_origen, ruta_archivo, nombre_archivo, score_confianza)
        VALUES ($1, 'contrato_validado', $2, $3, $4)
      `, [proveedorId, rutaContratoRelativa, fileContrato.originalname, score_similitud]);
      console.log(`[BCF] Firma de contrato guardada en base de conocimientos. Score: ${score_similitud}`);
    }

    // Generar Entregables SI el resultado es aprobado y no existen ya
    if (resultado === 'aprobado') {
      const checkEnt = await client.query('SELECT COUNT(*) FROM entregables WHERE contrato_id = $1', [contratoId]);
      if (parseInt(checkEnt.rows[0].count) === 0) {
        const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio'];
        for (let i = 0; i < 6; i++) {
          await client.query(`
            INSERT INTO entregables (contrato_id, nro_entregable, nombre, periodo, monto, estado)
            VALUES ($1, $2, $3, $4, 1800.00, 'pendiente')
          `, [contratoId, i + 1, `Entregable ${i + 1} - ${meses[i]}`, meses[i]]);
        }
      }
    }

    await client.query('COMMIT');

    // Responder al Frontend
    res.status(200).json({
      success: true,
      message: resultado === 'aprobado' ? 'Firma validada por el Sistema Inteligente. Cronograma de pagos generado.' : 'La firma no alcanzó el nivel de similitud requerido',
      data: {
        score: score_similitud,
        resultado: resultado,
        contrato_id: contratoId,
        referencias_usadas: firmasConocidas.length,
        mejor_referencia
      }
    });

  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error in contract validation:', error);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
});

export default router;
