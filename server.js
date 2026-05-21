const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3000;

// MIDDLEWARE
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// DATABASE
const dbPath = path.join(__dirname, 'asistencia.db');
const db = new sqlite3.Database(dbPath);

db.run = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function(err) {
    if (err) reject(err);
    else resolve({ lastID: this.lastID, changes: this.changes });
  });
});

db.get = (sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => {
    if (err) reject(err);
    else resolve(row);
  });
});

db.all = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => {
    if (err) reject(err);
    else resolve(rows || []);
  });
});

// INIT DB
async function inicializarDB() {
  try {
    await db.run(`CREATE TABLE IF NOT EXISTS operadores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      dni TEXT UNIQUE NOT NULL,
      telefono TEXT,
      area TEXT,
      funcion TEXT,
      fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    await db.run(`CREATE TABLE IF NOT EXISTS asistencia (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      operador_id INTEGER NOT NULL,
      fecha DATE NOT NULL,
      hora_entrada TIME,
      hora_salida TIME,
      FOREIGN KEY (operador_id) REFERENCES operadores(id),
      UNIQUE(operador_id, fecha)
    )`);

    console.log('✓ Tablas inicializadas');
  } catch (error) {
    console.error('Error:', error);
  }
}

inicializarDB();

// API ROUTES
app.get('/api/operadores', async (req, res) => {
  try {
    const operadores = await db.all('SELECT * FROM operadores ORDER BY nombre');
    res.json(operadores);
  } catch (error) {
    res.status(500).json({ error: 'Error' });
  }
});

app.post('/api/operadores', async (req, res) => {
  const { nombre, dni, telefono, area, funcion } = req.body;
  if (!nombre || !dni) return res.status(400).json({ error: 'Requeridos' });
  try {
    const result = await db.run(
      'INSERT INTO operadores (nombre, dni, telefono, area, funcion) VALUES (?, ?, ?, ?, ?)',
      [nombre, dni, telefono || '', area || 'COMPUTO', funcion || 'OPERADOR DE COMPUTO']
    );
    res.json({ success: true, id: result.lastID });
  } catch (error) {
    res.status(500).json({ error: 'Error' });
  }
});

app.post('/api/asistencia/entrada', async (req, res) => {
  const { operador_id } = req.body;
  const hoy = new Date().toISOString().split('T')[0];
  const hora = new Date().toTimeString().slice(0, 8);
  try {
    let registro = await db.get(
      'SELECT * FROM asistencia WHERE operador_id = ? AND fecha = ?',
      [operador_id, hoy]
    );
    if (registro) {
      await db.run('UPDATE asistencia SET hora_entrada = ? WHERE operador_id = ? AND fecha = ?',
        [hora, operador_id, hoy]);
    } else {
      await db.run('INSERT INTO asistencia (operador_id, fecha, hora_entrada) VALUES (?, ?, ?)',
        [operador_id, hoy, hora]);
    }
    res.json({ success: true, hora });
  } catch (error) {
    res.status(500).json({ error: 'Error' });
  }
});

app.post('/api/asistencia/salida', async (req, res) => {
  const { operador_id } = req.body;
  const hoy = new Date().toISOString().split('T')[0];
  const hora = new Date().toTimeString().slice(0, 8);
  try {
    let registro = await db.get(
      'SELECT * FROM asistencia WHERE operador_id = ? AND fecha = ?',
      [operador_id, hoy]
    );
    if (registro) {
      await db.run('UPDATE asistencia SET hora_salida = ? WHERE operador_id = ? AND fecha = ?',
        [hora, operador_id, hoy]);
    } else {
      await db.run('INSERT INTO asistencia (operador_id, fecha, hora_salida) VALUES (?, ?, ?)',
        [operador_id, hoy, hora]);
    }
    res.json({ success: true, hora });
  } catch (error) {
    res.status(500).json({ error: 'Error' });
  }
});

app.get('/api/asistencia/hoy', async (req, res) => {
  const hoy = new Date().toISOString().split('T')[0];
  try {
    const registros = await db.all('SELECT * FROM asistencia WHERE fecha = ?', [hoy]);
    res.json(registros);
  } catch (error) {
    res.status(500).json({ error: 'Error' });
  }
});

app.get('/api/reportes/rango', async (req, res) => {
  const { fecha_inicio, fecha_fin } = req.query;
  if (!fecha_inicio || !fecha_fin) return res.status(400).json({ error: 'Fechas requeridas' });
  try {
    const registros = await db.all(`
      SELECT o.id, o.nombre, o.dni, o.telefono, o.area, a.fecha, a.hora_entrada, a.hora_salida,
      CASE WHEN a.hora_entrada IS NOT NULL THEN 'Presente' ELSE 'Ausente' END as estado
      FROM operadores o
      LEFT JOIN asistencia a ON o.id = a.operador_id 
      WHERE a.fecha BETWEEN ? AND ?
      ORDER BY o.nombre, a.fecha DESC
    `, [fecha_inicio, fecha_fin]);
    res.json(registros);
  } catch (error) {
    res.status(500).json({ error: 'Error' });
  }
});

app.get('/api/reportes/operador/:id', async (req, res) => {
  const { fecha_inicio, fecha_fin } = req.query;
  if (!fecha_inicio || !fecha_fin) return res.status(400).json({ error: 'Fechas requeridas' });
  try {
    const registros = await db.all(`
      SELECT o.id, o.nombre, o.dni, o.telefono, o.area, a.fecha, a.hora_entrada, a.hora_salida,
      CASE WHEN a.hora_entrada IS NOT NULL THEN 'Presente' ELSE 'Ausente' END as estado
      FROM operadores o
      LEFT JOIN asistencia a ON o.id = a.operador_id 
      WHERE o.id = ? AND a.fecha BETWEEN ? AND ?
      ORDER BY a.fecha DESC
    `, [req.params.id, fecha_inicio, fecha_fin]);
    res.json(registros);
  } catch (error) {
    res.status(500).json({ error: 'Error' });
  }
});

app.get('/api/reportes/exportar', async (req, res) => {
  const { fecha_inicio, fecha_fin } = req.query;
  if (!fecha_inicio || !fecha_fin) return res.status(400).json({ error: 'Fechas requeridas' });
  try {
    const registros = await db.all(`
      SELECT o.nombre, o.dni, o.telefono, o.area, a.fecha, a.hora_entrada, a.hora_salida,
      CASE WHEN a.hora_entrada IS NOT NULL THEN 'Presente' ELSE 'Ausente' END as estado
      FROM operadores o
      LEFT JOIN asistencia a ON o.id = a.operador_id 
      WHERE a.fecha BETWEEN ? AND ?
      ORDER BY o.nombre, a.fecha DESC
    `, [fecha_inicio, fecha_fin]);
    
    let csv = 'Nombre,DNI,Teléfono,Área,Fecha,Entrada,Salida,Estado\n';
    registros.forEach(r => {
      csv += `"${r.nombre}","${r.dni}","${r.telefono}","${r.area}","${r.fecha}","${r.hora_entrada || ''}","${r.hora_salida || ''}","${r.estado}"\n`;
    });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="reporte_${fecha_inicio}_${fecha_fin}.csv"`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({ error: 'Error' });
  }
});

app.listen(PORT, () => {
  console.log(`✓ http://localhost:${PORT}`);
});
