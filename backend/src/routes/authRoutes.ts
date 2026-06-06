import { Router } from 'express';
import { pool } from '../config/db';
import { sendEmailMock } from '../utils/emailService';

const router = Router();

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // 1. Check if Admin
    if (email === 'admin@agrobeta.com') {
      if (password === 'admin123') {
        return res.json({
          success: true,
          data: {
            id: 'admin-id',
            nombres: 'Administrador',
            correo: email,
            rol: 'admin',
            token: 'mock-jwt-admin'
          }
        });
      } else {
        return res.status(401).json({ success: false, message: 'Contraseña de administrador incorrecta' });
      }
    }

    // 2. Check provider via usuarios table
    const userRes = await pool.query(
      'SELECT u.*, p.nombres, p.apellido_paterno, p.id as proveedor_id, p.estado_registro FROM usuarios u JOIN proveedores p ON p.correo = u.email WHERE u.email = $1',
      [email]
    );

    if (userRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }

    const user = userRes.rows[0];

    // Check provider is approved
    if (user.estado_registro !== 'aprobado') {
      return res.status(403).json({ 
        success: false, 
        message: 'Tu registro aún está pendiente de aprobación por el administrador.' 
      });
    }

    // Check password (plain text for now — mock system)
    if (user.password_hash !== password) {
      return res.status(401).json({ success: false, message: 'Contraseña incorrecta' });
    }

    // Check if temp password has expired
    if (user.password_expira_en && new Date(user.password_expira_en) < new Date()) {
      return res.status(401).json({ 
        success: false, 
        message: 'Tu contraseña temporal ha expirado. Contacta al administrador para que te envíe una nueva.' 
      });
    }

    // Update last login
    await pool.query('UPDATE usuarios SET ultimo_login = NOW() WHERE id = $1', [user.id]);

    return res.json({
      success: true,
      mustChangePassword: user.debe_cambiar_password === true,
      data: {
        id: user.proveedor_id,
        usuario_id: user.id,
        nombres: `${user.nombres} ${user.apellido_paterno}`,
        correo: user.email,
        rol: 'proveedor',
        token: 'mock-jwt-proveedor'
      }
    });

  } catch (error: any) {
    console.error('Error in login:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/auth/cambiar-password
router.post('/cambiar-password', async (req, res) => {
  const { usuario_id, nueva_password } = req.body;

  if (!usuario_id || !nueva_password || nueva_password.length < 6) {
    return res.status(400).json({ success: false, message: 'La contraseña debe tener al menos 6 caracteres' });
  }

  try {
    await pool.query(
      'UPDATE usuarios SET password_hash = $1, debe_cambiar_password = FALSE, password_expira_en = NULL WHERE id = $2',
      [nueva_password, usuario_id]
    );
    res.json({ success: true, message: 'Contraseña actualizada correctamente' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
