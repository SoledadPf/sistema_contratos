import express from 'express';
import cors from 'cors';
import path from 'path';
import { pool } from './config/db';
import providerRoutes from './routes/providerRoutes';
import contractRoutes from './routes/contractRoutes';
import paymentRoutes from './routes/paymentRoutes';
import adminRoutes from './routes/adminRoutes';
import authRoutes from './routes/authRoutes';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api/proveedores', providerRoutes);
app.use('/api/contratos', contractRoutes);
app.use('/api/pagos', paymentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/auth', authRoutes);

app.get('/', (req, res) => {
  res.send('AgroBeta API is running');
});

// Auto-migrations al iniciar
async function runMigrations() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS base_conocimientos_firma (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        proveedor_id UUID NOT NULL REFERENCES proveedores(id) ON DELETE CASCADE,
        tipo_origen VARCHAR(60) NOT NULL,
        ruta_archivo VARCHAR(500) NOT NULL,
        nombre_archivo VARCHAR(300),
        score_confianza DECIMAL(5,4) DEFAULT 1.0000,
        activo BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_bcf_proveedor ON base_conocimientos_firma(proveedor_id);
    `);
    console.log('✅ Migrations OK — base_conocimientos_firma lista');
  } catch (e: any) {
    console.error('⚠️  Migration warning:', e.message);
  }
}

app.listen(PORT, async () => {
  console.log(`🚀 Backend server is running on http://localhost:${PORT}`);
  await runMigrations();
});
