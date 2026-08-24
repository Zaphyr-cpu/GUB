const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const PDFDocument = require('pdfkit');
const sqlite3 = require('sqlite3').verbose();
require('dotenv').config();

const app = express();

// --- CONFIGURACIÓN DE BASE DE DATOS SQLITE ---
const db = new sqlite3.Database('./gub_database.sqlite', (err) => {
    if (err) {
        console.error('[DB] Error al conectar con la base de datos SQLite:', err.message);
    } else {
        console.log('[DB] Conexión establecida con la base de datos SQLite.');
        inicializarBaseDatos();
    }
});

function inicializarBaseDatos() {
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS baneados (
            discord_id TEXT PRIMARY KEY,
            fecha_sancion TEXT
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS examenes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            discord_id TEXT,
            discord_name TEXT,
            nombre_ic TEXT,
            nombres_instructores TEXT,
            fecha_envio TEXT,
            respuestas TEXT
        )`);
    });
}

// Configuración de sesiones persistidas en SQLite
app.use(session({
    store: new SQLiteStore({ db: 'sessions.sqlite', dir: '.' }),
    secret: process.env.SESSION_SECRET || 'gub_secure_secret_2026_db',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

app.use(passport.initialize());
app.use(passport.session());
app.use(express.urlencoded({ extended: true }));

const INSTRUCTOR_USER = process.env.INSTRUCTOR_USER || "instructor";
const INSTRUCTOR_PASS = process.env.INSTRUCTOR_PASS || "gub2026";

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

passport.use(new DiscordStrategy({
    clientID: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    callbackURL: process.env.DISCORD_CALLBACK_URL || 'http://localhost:3000/auth/discord/callback',
    scope: ['identify']
}, (accessToken, refreshToken, profile, done) => done(null, profile)));

function verificarBaneado(discordId, callback) {
    db.get(`SELECT discord_id FROM baneados WHERE discord_id = ?`, [discordId], (err, row) => {
        if (err) return callback(false);
        callback(!!row);
    });
}

// --- ICONOS SVG PROFESIONALES ---
const svgIcons = {
    lock: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 6px;"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`,
    shield: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 6px;"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>`,
    alert: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 8px;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
    pdf: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 4px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`,
    discord: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 8px;"><path d="M18 5.5a16.3 16.3 0 0 0-4.2-1.3 11 11 0 0 0-.5 1.1 15 15 0 0 0-6 0 10.9 10.9 0 0 0-.5-1.1A16.3 16.3 0 0 0 2.5 5.5C.8 11.2.3 16.8 1 22.4a16.6 16.6 0 0 0 5.2 2.6 13 13 0 0 0 1.1-1.8 11 11 0 0 1-1.7-.8c.1-.1.3-.2.4-.3a12 12 0 0 0 10.4 0c.2.1.3.2.4.3a11 11 0 0 1-1.7.8 13 13 0 0 0 1.1 1.8 16.6 16.6 0 0 0 5.2-2.6c.8-6.1-.3-11.7-2-16.9zM8.5 16.5c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2zm7 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2z"></path></svg>`,
    clock: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 5px;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`
};

const estiloCSS = `
    body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; background-color: #f0f3f8; color: #2c3e50; margin: 0; padding: 30px; }
    .container { background: #ffffff; padding: 45px; border-radius: 10px; box-shadow: 0 6px 20px rgba(0,0,0,0.06); max-width: 950px; margin: 0 auto; border-top: 5px solid #003366; }
    h1, h2, h3 { color: #003366; text-align: center; font-weight: 600; }
    input[type="text"], input[type="password"], select, textarea { width: 100%; padding: 12px; margin: 8px 0 18px 0; border: 1px solid #dcdfe6; border-radius: 6px; box-sizing: border-box; font-size: 14px; background-color: #fafbfc; transition: border 0.2s; }
    input:focus, textarea:focus { border-color: #003366; outline: none; background-color: #fff; box-shadow: 0 0 0 3px rgba(0,51,102,0.1); }
    textarea { resize: vertical; min-height: 100px; font-family: inherit; }
    .question-box { background: #f8fafc; border-left: 4px solid #003366; padding: 20px; margin-bottom: 22px; border-radius: 0 6px 6px 0; border-top: 1px solid #edf2f7; border-right: 1px solid #edf2f7; border-bottom: 1px solid #edf2f7; }
    .question-box.abierta { border-left-color: #3182ce; background: #fdfefe; }
    .question-box p { font-weight: 600; color: #1a365d; margin-top: 0; line-height: 1.4; }
    label.option { display: block; margin: 10px 0; cursor: pointer; font-size: 14px; color: #4a5568; line-height: 1.4; }
    .btn-discord { background-color: #5865F2; color: white; padding: 12px 20px; text-decoration: none; display: flex; align-items: center; justify-content: center; border-radius: 6px; font-weight: 600; max-width: 300px; margin: 20px auto; transition: background 0.2s; }
    .btn-discord:hover { background-color: #4752c4; }
    .btn-primary { background-color: #003366; color: white; padding: 14px 20px; border: none; width: 100%; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 15px; margin-top: 25px; text-align: center; text-decoration: none; display: inline-block; transition: background 0.2s; }
    .btn-primary:hover { background-color: #002244; }
    .btn-danger { background-color: #e53e3e; color: white; padding: 6px 12px; border: none; border-radius: 4px; cursor: pointer; text-decoration: none; display: inline-block; font-weight: 600; font-size: 13px; }
    .btn-danger:hover { background-color: #c53030; }
    .btn-success { background-color: #38a169; color: white; padding: 6px 12px; border: none; border-radius: 4px; cursor: pointer; text-decoration: none; display: inline-block; font-weight: 600; font-size: 13px; }
    .btn-success:hover { background-color: #2f855a; }
    .btn-logout { color: #e53e3e; display: block; text-align: center; margin-top: 25px; text-decoration: none; font-weight: 600; font-size: 14px; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; background: white; }
    th, td { border: 1px solid #e2e8f0; padding: 12px; text-align: left; font-size: 14px; }
    th { background-color: #003366; color: white; font-weight: 600; }
    tr:nth-child(even) { background-color: #f8fafc; }
    #timer-bar { position: fixed; top: 0; left: 0; width: 100%; background: #1a365d; color: white; padding: 12px 25px; display: flex; justify-content: space-between; align-items: center; z-index: 1000; font-weight: 600; font-size: 14px; box-shadow: 0 2px 12px rgba(0,0,0,0.25); box-sizing: border-box; }
    #anti-cheat-overlay { display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background-color: rgba(10, 15, 30, 0.96); color: #ff6b6b; z-index: 99999; text-align: center; justify-content: center; align-items: center; flex-direction: column; font-size: 24px; font-weight: 600; padding: 40px; }
    .exam-container { margin-top: 75px; }
`;

// --- RUTAS ---
app.get('/', (req, res) => {
    const user = req.user;
    if (!user) return renderHome(res, null);

    verificarBaneado(user.id, (isBanned) => {
        if (isBanned) {
            return res.send(`<!DOCTYPE html><html><head><title>Acceso Denegado</title><style>${estiloCSS}</style></head><body>
                <div class="container" style="max-width: 480px; text-align: center; margin-top: 80px;">
                    <h2 style="color: #e53e3e;">${svgIcons.alert} Acceso Denegado Permanentemente</h2>
                    <p>Estimado/a <strong>${user.username}</strong>, su cuenta ha sido bloqueada debido a una infracción de los protocolos de seguridad.</p>
                    <a href="/logout" class="btn-logout">Cerrar sesión</a>
                </div></body></html>`);
        }
        renderHome(res, user);
    });
});

function renderHome(res, user) {
    const isLogged = !!user;
    res.send(`<!DOCTYPE html><html><head><title>GUB - Portal de Reclutamiento</title><style>${estiloCSS}</style></head><body>
        <div class="container" style="max-width: 460px; text-align: center; margin-top: 60px;">
            <h2>Guàrdia Urbana de Barcelona</h2>
            <h3 style="font-size: 15px; color: #4a5568; margin-bottom: 25px;">Portal Oficial de Selección e Ingreso</h3>
            ${!isLogged ? 
                `<p style="font-size: 14px; color: #4a5568;">Para iniciar el proceso selectivo, identifíquese mediante el sistema corporativo de Discord.</p>
                 <a href="/auth/discord" class="btn-discord">${svgIcons.discord} Autenticarse con Discord</a>` :
                `<p style="font-size: 14px;">Sesión activa: <strong>${user.username}</strong></p>
                 <a href="/formulario" class="btn-primary">Acceder al Examen Oficial de Ingreso</a>
                 <a href="/logout" class="btn-logout">Cerrar sesión</a>`
            }
            <div style="margin-top: 35px; border-top: 1px solid #edf2f7; padding-top: 20px;">
                <a href="/login-instructor" style="font-size: 13px; color: #003366; text-decoration: none; font-weight: 600;">${svgIcons.lock} Acceso al Panel de Instructores</a>
            </div>
        </div></body></html>`);
}

app.get('/auth/discord', passport.authenticate('discord'));
app.get('/auth/discord/callback', passport.authenticate('discord', { failureRedirect: '/' }), (req, res) => {
    if (!req.user) return res.redirect('/');
    verificarBaneado(req.user.id, (isBanned) => {
        if (isBanned) return res.redirect('/');
        res.redirect('/formulario');
    });
});

app.get('/logout', (req, res) => req.logout(() => res.redirect('/')));

app.get('/api/banear-trampa', (req, res) => {
    if (req.isAuthenticated() && req.user) {
        const discordId = req.user.id;
        const fecha = new Date().toLocaleString();
        db.run(`INSERT OR IGNORE INTO baneados (discord_id, fecha_sancion) VALUES (?, ?)`, [discordId, fecha], (err) => {
            if (err) return res.status(500).json({ success: false });
            res.json({ success: true });
        });
    } else {
        res.status(401).json({ success: false });
    }
});

// --- PANEL DE INSTRUCTORES ---
app.get('/login-instructor', (req, res) => {
    res.send(`<!DOCTYPE html><html><head><title>Login Instructores</title><style>${estiloCSS}</style></head><body>
        <div class="container" style="max-width: 380px; margin-top: 80px;">
            <h2>Panel de Instructores</h2>
            <form action="/login-instructor" method="POST">
                <label>Usuario:</label>
                <input type="text" name="usuario" required>
                <label>Contraseña:</label>
                <input type="password" name="password" required>
                <button type="submit" class="btn-primary">Iniciar Sesión</button>
            </form>
            <a href="/" style="display:block; text-align:center; margin-top:20px; text-decoration:none; color:#003366; font-size:13px; font-weight:600;">Volver</a>
        </div></body></html>`);
});

app.post('/login-instructor', (req, res) => {
    const { usuario, password } = req.body;
    if (usuario === INSTRUCTOR_USER && password === INSTRUCTOR_PASS) {
        req.session.esInstructor = true;
        return res.redirect('/instructor/panel');
    }
    res.send(`<script>alert('Credenciales incorrectas'); window.location.href='/login-instructor';</script>`);
});

app.get('/instructor/panel', (req, res) => {
    if (!req.session.esInstructor) return res.redirect('/login-instructor');

    db.all(`SELECT * FROM examenes ORDER BY id DESC`, [], (err, examenes) => {
        if (err) return res.status(500).send('Error al cargar exámenes.');

        db.all(`SELECT * FROM baneados`, [], (err, baneadosList) => {
            if (err) return res.status(500).send('Error al cargar baneos.');

            let examenesHTML = examenes.map((ex) => `
                <tr>
                    <td><strong>#${ex.id}</strong></td>
                    <td>${ex.discord_name}</td>
                    <td>${ex.nombre_ic}</td>
                    <td>${ex.nombres_instructores}</td>
                    <td>${ex.fecha_envio}</td>
                    <td style="text-align: center;">
                        <a href="/instructor/ver-examen/${ex.id}" target="_blank" class="btn-primary" style="padding: 6px 12px; font-size: 12px; margin:0; width:auto; display:inline-block;">Revisar</a>
                        <a href="/instructor/descargar-pdf/${ex.id}" class="btn-success" style="padding: 6px 12px; font-size: 12px; margin-left: 5px;">${svgIcons.pdf} PDF</a>
                    </td>
                </tr>
            `).join('') || '<tr><td colspan="6" style="text-align:center; color:#718096;">No hay exámenes registrados.</td></tr>';

            let baneadosHTML = baneadosList.map(b => `
                <tr>
                    <td><code>${b.discord_id}</code></td>
                    <td style="color: #718096; font-size: 13px;">${b.fecha_sancion}</td>
                    <td style="text-align: center;"><a href="/instructor/quitar-ban/${b.discord_id}" class="btn-success" style="padding: 6px 12px; font-size: 12px;">Revocar</a></td>
                </tr>
            `).join('') || '<tr><td colspan="3" style="text-align:center; color:#718096;">No hay usuarios sancionados.</td></tr>';

            res.send(`<!DOCTYPE html><html><head><title>Panel de Instructores</title><style>${estiloCSS}</style></head><body>
                <div class="container" style="max-width: 950px; margin-top: 30px;">
                    <h2>Centro de Control e Instrucción</h2>
                    <div style="text-align: right; margin-bottom: 20px;"><a href="/instructor/logout" class="btn-danger" style="display:inline-block;">Cerrar Sesión</a></div>

                    <h3 style="text-align:left; font-size: 16px; border-bottom: 2px solid #003366; padding-bottom: 8px;">Exámenes Recibidos</h3>
                    <table>
                        <thead>
                            <tr><th>ID</th><th>Discord</th><th>Nombre IC</th><th>Instructores</th><th>Fecha</th><th style="text-align: center;">Acciones</th></tr>
                        </thead>
                        <tbody>${examenesHTML}</tbody>
                    </table>

                    <h3 style="text-align:left; font-size: 16px; border-bottom: 2px solid #003366; padding-bottom: 8px; margin-top: 40px;">Sanciones Anti-Fraude</h3>
                    <table>
                        <thead><tr><th>ID Discord</th><th>Fecha de Sanción</th><th style="text-align: center;">Gestión</th></tr></thead>
                        <tbody>${baneadosHTML}</tbody>
                    </table>
                    <br><a href="/" style="display:block; text-align:center; margin-top:30px; text-decoration:none; color:#003366; font-weight:600; font-size:13px;">Volver</a>
                </div></body></html>`);
        });
    });
});

app.get('/instructor/logout', (req, res) => {
    req.session.esInstructor = false;
    res.redirect('/');
});

app.get('/instructor/quitar-ban/:id', (req, res) => {
    if (!req.session.esInstructor) return res.redirect('/login-instructor');
    db.run(`DELETE FROM baneados WHERE discord_id = ?`, [req.params.id], () => {
        res.redirect('/instructor/panel');
    });
});

app.get('/instructor/ver-examen/:id', (req, res) => {
    if (!req.session.esInstructor) return res.redirect('/login-instructor');
    
    db.get(`SELECT * FROM examenes WHERE id = ?`, [req.params.id], (err, ex) => {
        if (err || !ex) return res.send('Examen no encontrado.');

        let respuestasObj = {};
        try { respuestasObj = JSON.parse(ex.respuestas); } catch(e) {}

        const preguntasData = obtenerListaPreguntas();
        let detalleHTML = preguntasData.map(q => {
            const respuestaElegida = respuestasObj[`p${q.id}`] || '<span style="color:#a0aec0; font-style:italic;">Sin responder</span>';
            const esAbierta = q.tipo === 'abierta';
            return `
                <div style="background: #fff; padding: 15px; margin-bottom: 15px; border-radius: 6px; border: 1px solid #e2e8f0;">
                    <p style="color: #003366; font-weight: 600; margin: 0 0 8px 0;">Pregunta ${q.id}: ${q.text}</p>
                    <div style="font-size: 14px; color: #2d3748;">
                        <strong>Respuesta:</strong> ${esAbierta ? `<div style="background: #f7fafc; padding: 10px; margin-top: 5px; border-radius: 4px; border:1px solid #edf2f7;">${respuestaElegida}</div>` : `<span style="background: #edf2f7; padding: 2px 8px; border-radius: 4px; color: #003366; font-weight: 600;">[ ${respuestaElegida.toUpperCase()} ]</span>`}
                    </div>
                </div>
            `;
        }).join('');

        res.send(`<!DOCTYPE html><html><head><title>Revisión</title><style>${estiloCSS}</style></head><body>
            <div class="container" style="max-width: 800px; margin-top: 30px;">
                <h2>Expediente Detallado #${ex.id}</h2>
                <div style="background: #f8fafc; padding: 15px; border-radius: 6px; margin-bottom: 25px; border: 1px solid #cbd5e0;">
                    <p style="margin: 4px 0;"><strong>Nombre IC:</strong> ${ex.nombre_ic}</p>
                    <p style="margin: 4px 0;"><strong>Instructores a Cargo:</strong> ${ex.nombres_instructores}</p>
                    <p style="margin: 4px 0;"><strong>Discord:</strong> ${ex.discord_name} (ID: ${ex.discord_id})</p>
                    <p style="margin: 4px 0;"><strong>Fecha:</strong> ${ex.fecha_envio}</p>
                </div>
                <h3 style="text-align: left; font-size: 16px;">Cuestiones</h3>
                ${detalleHTML}
                <a href="/instructor/panel" class="btn-primary" style="text-align:center; display:block;">Volver</a>
            </div></body></html>`);
    });
});

app.get('/instructor/descargar-pdf/:id', (req, res) => {
    if (!req.session.esInstructor) return res.redirect('/login-instructor');
    
    db.get(`SELECT * FROM examenes WHERE id = ?`, [req.params.id], (err, ex) => {
        if (err || !ex) return res.send('Examen no encontrado.');

        let respuestasObj = {};
        try { respuestasObj = JSON.parse(ex.respuestas); } catch(e) {}

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Expediente_${ex.nombre_ic.replace(/\s+/g, '_')}.pdf`);

        const doc = new PDFDocument({ margin: 40 });
        doc.pipe(res);

        doc.fontSize(16).fillColor('#003366').text('GUÀRDIA URBANA DE BARCELONA', { align: 'center' });
        doc.fontSize(10).fillColor('#555555').text('DEPARTAMENTO DE SELECCIÓN Y RECLUTAMIENTO', { align: 'center' });
        doc.moveDown();
        
        doc.fontSize(12).fillColor('#000000').text('INFORME OFICIAL DE EXAMEN DE INGRESO', { align: 'center' });
        doc.moveTo(40, doc.y + 5).lineTo(570, doc.y + 5).strokeColor('#003366').lineWidth(1.5).stroke();
        doc.moveDown(1);

        doc.fontSize(10).fillColor('#333333');
        doc.text(`Expediente N.º: #${ex.id}`);
        doc.text(`Nombre y Apellido IC: ${ex.nombre_ic}`);
        doc.text(`Nombres de Instructores: ${ex.nombres_instructores}`);
        doc.text(`Usuario de Discord: ${ex.discord_name} (ID: ${ex.discord_id})`);
        doc.text(`Fecha de Registro: ${ex.fecha_envio}`);
        doc.moveDown();

        doc.fontSize(12).fillColor('#003366').text('DETALLE DE PREGUNTAS Y RESPUESTAS:');
        doc.moveDown(0.5);

        const preguntasData = obtenerListaPreguntas();
        preguntasData.forEach(q => {
            const respuesta = respuestasObj[`p${q.id}`] || 'Sin responder';
            doc.fontSize(9).fillColor('#1a202c').text(`Pregunta ${q.id}: ${q.text}`);
            doc.fontSize(9).fillColor('#003366').text(`   -> Respuesta: ${respuesta}`);
            doc.moveDown(0.3);
        });

        doc.moveDown(1);
        doc.fontSize(8).fillColor('#718096').text('Documento oficial generado por el Portal de Reclutament de la Guàrdia Urbana.', { align: 'center' });
        doc.end();
    });
});

// --- LISTA DE PREGUNTAS ---
function obtenerListaPreguntas() {
    return [
        { id: 1, tipo: 'test', text: "¿Cuáles son las seis grandes áreas de competencias de la Guàrdia Urbana indicadas en el manual?" },
        { id: 2, tipo: 'test', text: "¿Qué finalidad principal persigue el área de Seguridad Ciudadana en la Guàrdia Urbana?" },
        { id: 3, tipo: 'test', text: "¿Qué ámbito de actuación cubre la Policía Administrativa?" },
        { id: 4, tipo: 'test', text: "¿Cuál es el objetivo primordial del área de Tráfico y Seguridad Vial?" },
        { id: 5, tipo: 'test', text: "¿Qué comprende la función de la Policía Asistencial y Judicial?" },
        { id: 6, tipo: 'test', text: "¿Qué rangos componen la Escala Superior de la Guàrdia Urbana?" },
        { id: 7, tipo: 'test', text: "¿Qué rangos integran la Escala de Inspección de la Guàrdia Urbana?" },
        { id: 8, tipo: 'test', text: "¿A qué escala pertenece el rango de Sots-Inspector dentro de la jerarquía?" },
        { id: 9, tipo: 'test', text: "¿Qué rango acompaña al Sots-Inspector dentro de la Escala Intermedia?" },
        { id: 10, tipo: 'test', text: "¿Cuáles son los rangos que conforman la Escala Básica de la Guàrdia Urbana?" },
        { id: 11, tipo: 'test', text: "¿Cuál es el rango de mayor jerarquía de toda la Guàrdia Urbana de Barcelona según el organigrama del manual?" },
        { id: 12, tipo: 'test', text: "En los botones rápidos físicos de la radio, ¿qué acción indica el botón 1 (EN ESCENA)?" },
        { id: 13, tipo: 'test', text: "¿Qué indica el botón rápido de radio 2 (DISPONIBLE)?" },
        { id: 14, tipo: 'test', text: "¿Qué acción ejecuta el botón rápido 3 (EN RUTA) en la radio?" },
        { id: 15, tipo: 'test', text: "¿Qué función realiza el botón rápido 4 (DAR UBICACIÓN)?" },
        { id: 16, tipo: 'test', text: "¿Qué función cumple el botón rápido 5 (SOLICITAR) en la radio del agente?" },
        { id: 17, tipo: 'test', text: "En la interfaz táctil superior de la radio, ¿para qué sirve la opción TRANSMITIR (T) junto a (Y) RADIO RÁPIDA?" },
        { id: 18, tipo: 'test', text: "Según la norma número 1 de los protocolos generales de radio, ¿cómo debe iniciar cada transmisión?" },
        { id: 19, tipo: 'test', text: "¿Qué indica la norma número 2 de radio respecto a la escucha?" },
        { id: 20, tipo: 'test', text: "¿Qué tono y estilo exige la norma número 3 en las comunicaciones por radio?" },
        { id: 21, tipo: 'test', text: "Según la norma número 4, ¿qué información se debe priorizar al transmitir un incidente?" },
        { id: 22, tipo: 'test', text: "¿Qué instrucción detalla la norma número 5 si una transmisión no se entiende con claridad?" },
        { id: 23, tipo: 'test', text: "¿Qué exige la norma número 6 de radio en cuanto a la confidencialidad?" },
        { id: 24, tipo: 'test', text: "¿Qué significa el código de radio 10-00?" },
        { id: 25, tipo: 'test', text: "¿Qué indica el código de radio 10-03?" },
        { id: 26, tipo: 'test', text: "¿Qué significa el código de radio 10-04?" },
        { id: 27, tipo: 'test', text: "¿Qué código de radio se emplea para indicar 'Disponible / fuera de servicio' u operaciones rutinarias?" },
        { id: 28, tipo: 'test', text: "¿Qué significa el código de radio 10-20?" },
        { id: 29, tipo: 'test', text: "¿Qué código se utiliza para solicitar refuerzos urgentes en la posición del agente?" },
        { id: 30, tipo: 'test', text: "¿Qué indica el código de radio 10-38?" },
        { id: 31, tipo: 'test', text: "¿Qué representa el código de radio 10-55?" },
        { id: 32, tipo: 'test', text: "Según los códigos del temario, ¿a qué corresponde el código 415?" },
        { id: 33, tipo: 'test', text: "¿Qué situación describe el código 417?" },
        { id: 34, tipo: 'test', text: "¿A qué delito hace referencia el código penal 187?" },
        { id: 35, tipo: 'test', text: "¿Qué significa el código 207?" },
        { id: 36, tipo: 'test', text: "¿Cuál es el código penal correspondiente a 'Robo a mano armada'?" },
        { id: 37, tipo: 'test', text: "¿Qué representa el código 245 en el manual?" },
        { id: 38, tipo: 'test', text: "¿Qué significa el código 459?" },
        { id: 39, tipo: 'test', text: "¿A qué delito o infracción corresponde el código 487V?" },
        { id: 40, tipo: 'test', text: "En el procedimiento ante accidentes de tráfico, ¿cuál es la primera actuación obligatoria?" },
        { id: 41, tipo: 'test', text: "En el mismo procedimiento de accidentes de tráfico, tras asegurar la zona, ¿qué se debe comprobar inmediatamente?" },
        { id: 42, tipo: 'test', text: "Ante un resultado positivo en las pruebas de alcoholemia o drogas, ¿cuál es el procedimiento inmediato?" },
        { id: 43, tipo: 'test', text: "¿Qué busca lograr el área de Regulación de la Movilidad Urbana?" },
        { id: 44, tipo: 'test', text: "En el control de normativas municipales, ¿qué pasos sigue el agente?" },
        { id: 45, tipo: 'test', text: "¿Qué se debe comprobar específicamente al inspeccionar terrazas de hostelería?" },
        { id: 46, tipo: 'test', text: "Ante un caso de venta ambulante no autorizada, ¿cómo actúa la Guàrdia Urbana?" },
        { id: 47, tipo: 'test', text: "¿Qué objetivo persiguen las actuaciones sobre las Ordenanzas de Civismo?" },
        { id: 48, tipo: 'test', text: "¿En qué situaciones concretas se debe activar el Botón de Pánico?" },
        { id: 49, tipo: 'test', text: "¿Qué protocolo se activa en primer lugar en la central (CIM) al pulsar el Botón de Pánico?" },
        { id: 50, tipo: 'test', text: "¿Qué función de posicionamiento se activa instantáneamente en la central al usar el botón?" },
        { id: 51, tipo: 'test', text: "¿Qué alerta y despliegue genera el Botón de Pánico en la central?" },
        { id: 52, tipo: 'test', text: "¿Qué directrices rigen el uso del arma reglamentaria (herramienta de defensa)?" },
        { id: 53, tipo: 'test', text: "¿Cómo se debe portar y revisar el bastón extensible (extensible)?" },
        { id: 54, tipo: 'test', text: "Al colocar las esposas como elemento de restricción de movimientos durante una detención:" },
        { id: 55, tipo: 'test', text: "¿Qué utilidad principal tiene el spray de defensa dentro del equipamiento básico del agente?" },
        // Preguntas Abiertas de Situaciones
        { id: 56, tipo: 'abierta', text: "CASO PRÁCTICO 1: Durante un patrullaje a pie por el centro, observa a dos individuos forcejeando violentamente y uno de ellos extrae un objeto punzante. Describa detalladamente su protocolo de actuación inicial y comunicación por radio." },
        { id: 57, tipo: 'abierta', text: "CASO PRÁCTICO 2: Es usted comisionado a un accidente de tráfico con un vehículo volcado y principios de incendio en el motor, con dos ocupantes atrapados en su interior. Explique paso a paso el orden de sus prioridades de intervención." },
        { id: 58, tipo: 'abierta', text: "CASO PRÁCTICO 3: Un propietario de un establecimiento comercial se niega rotundamente a identificarse y prohíbe la inspección de su terraza que excede los límites autorizados. ¿Cómo debe proceder jurídicamente?" },
        { id: 59, tipo: 'abierta', text: "CASO PRÁCTICO 4: Recibe una alerta por radio de alteración grave del orden público con código 415 en una plaza con aglomeración de personas. Indique qué transmisión exacta realizaría al llegar a la escena." },
        { id: 60, tipo: 'abierta', text: "CASO PRÁCTICO 5: Ante una situación en la que su compañero de patrulla resulta herido de bala en un tiroteo imprevisto, desglose el uso del Botón de Pánico y los códigos de radio a emplear de forma prioritaria." }
    ];
}

app.get('/formulario', (req, res) => {
    if (!req.isAuthenticated() || !req.user) return res.redirect('/');
    
    verificarBaneado(req.user.id, (isBanned) => {
        if (isBanned) return res.redirect('/');

        const opcionesOpciones = [
            ["Seguridad ciudadana, policía administrativa, protección municipal, tráfico y seguridad vial, policía asistencial y policía judicial.", "Únicamente tráfico, orden público estatal y aduanas.", "Vigilancia marítima, fronteras y seguridad nacional.", "Gestión penitenciaria y control fiscal corporativo."],
            ["Garantizar el orden, prevenir la delincuencia y proteger a los ciudadanos en el ámbito municipal.", "Investigar delitos fiscales a nivel internacional.", "Inspeccionar exclusivamente establecimientos industriales pesados.", "Gestionar el tráfico aéreo de la ciudad."],
            ["Control del cumplimiento de normativas municipales, terrazas, venta ambulante no autorizada y ordenanzas de civismo.", "Delitos graves contra la vida y homicidios.", "Regulación de transportes ferroviarios estatales.", "Control de fronteras y pasaportes en el aeropuerto."],
            ["Reducir la siniestralidad, mejorar la fluidez del tráfico y proteger la vida de las personas.", "Imponer sanciones económicas máximas sin atender a la fluidez.", "Construir y diseñar nuevas autovías interurbanas.", "Gestionar exclusivamente el tráfico marítimo y portuario."],
            ["Asistencia a ciudadanos en situaciones de necesidad, auxilio y colaboración en la investigación de delitos e instrucción de diligencias.", "Auditorías financieras a empresas privadas.", "Inspección de barcos de mercancías internacionales.", "Operaciones militares en el extranjero."],
            ["Major y Superintendent", "Inspector y Sots-inspector", "Sargent y Caporal", "Guardia Urbana y Alumno"],
            ["Comisario, Intendente y Comandante", "Inspector Jefe, Inspector e Inspector Alumno", "Sots-Inspector y Sargent", "Caporal y Guardia Urbana"],
            ["Escala Superior", "Escala de Inspección", "Escala Intermedia", "Escala Básica"],
            ["Sargent", "Caporal", "Major", "Comisario"],
            ["Caporal +, Caporal y Guardia Urbana", "Inspector y Sargent", "Major y Sots-Inspector", "Comandante y Alumno"],
            ["Major / Superintendent", "Inspector Jefe", "Comisario", "Sots-Inspector"],
            ["Avisas que estás disponible.", "Avisas que ya has llegado al aviso.", "Envías la ubicación en la que te encuentras.", "Solicitas apoyo inmediato."],
            ["Avisas que estás disponible para un nuevo servicio.", "Avisas que estás en dirección a un aviso.", "Solicitas una grúa municipal.", "Envías un código QR a todos los agentes."],
            ["Avisas que estás en dirección a un aviso.", "Avisas que has finalizado tu turno de trabajo.", "Solicitas asistencia médica (EMS).", "Te reúnes en comisaría."],
            ["Envías la ubicación exacta en la que te encuentras.", "Solicitas refuerzos policiales urgentes.", "Apagas el sistema de transmisión de radio.", "Cambias de canal operativo de emergencia."],
            ["Solicitas apoyo.", "Avisas que ya has llegado a la escena.", "Envías tu ubicación GPS.", "Cierras la comunicación."],
            ["Hablar por radio (escrito), hablar con el resto de cuerpos de seguridad, hablar con emergencias y abrir radio rápida.", "Configurar el volumen y brillo de la pantalla táctil.", "Apagar físicamente el terminal de comunicaciones.", "Formatear el software interno de la emisora."],
            ["Identifícate siempre con tu código de unidad al inicio de cada transmisión y cada vez que cambies de canal.", "Hablar rápido para ocupar poco tiempo en la frecuencia.", "Transmitir libremente sin identificarse para ganar agilidad.", "Utilizar apodos personales."],
            ["Escucha la respuesta completa antes de transmitir y evita interrupciones.", "Habla al mismo tiempo que los demás operadores.", "Ignora las respuestas de la central si estás ocupado.", "Desconecta el altavoz durante los avisos."],
            ["Comunícate de forma breve, clara y precisa, evitando ambigüedades y lenguaje innecesario.", "Usar un tono informal y bromista para relajar la tensión.", "Hablar de forma extensa y detallada sobre asuntos personales.", "Utilizar refranes populares."],
            ["Tipo de incidente, ubicación exacta, estado actual y recursos necesarios.", "La opinión personal del agente sobre los implicados.", "El nombre completo de todos los vecinos de la manzana.", "La previsión meteorológica del día."],
            ["Solicitar repetir el mensaje usando el código 10-09.", "Colgar y apagar la radio.", "Ignorar la llamada y seguir patrullando.", "Activar el botón de pánico de inmediato."],
            ["No compartas información por radio que no sea relevante para el servicio y respeta la privacidad de las comunicaciones.", "Publicar los partes de radio en redes sociales.", "Difundir los datos privados de los detenidos por canales abiertos.", "Permitir que los ciudadanos escuchen canales encriptados."],
            ["Agente herido", "Afirmativo / Recibido", "Ubicación del agente", "Necesito grúa"],
            ["Ir con precaución", "Negativo", "Ocupado en operación", "Salida del servicio"],
            ["Afirmativo / Recibido", "Agente herido", "Volver a comisaría", "Solicito refuerzos"],
            ["10-07", "10-04", "10-20", "10-32"],
            ["Ubicación / posición del agente", "Requiere escolta técnica", "Sujeto bajo custodia", "Reunión en comisaría"],
            ["10-32", "10-05", "10-14", "10-37"],
            ["Solicito EMS / ambulancia inmediata", "Necesito una grúa", "Intento de suicidio", "Procesamiento de detenido"],
            ["Intento de suicidio / caso crítico", "Patrullaje activo por zona X", "En camino al aviso", "Fin de turno"],
            ["Disturbio / peleas", "Persona con un arma", "Homicidio", "Allanamiento de morada"],
            ["Persona con un arma", "Secuestro de persona", "Choque y fuga", "Robo a un banco"],
            ["Homicidio", "Hurto menor", "Exhibicionismo", "Resistencia al arresto"],
            ["Secuestro", "Detención de tránsito", "Asalto con armas", "Disparos en el lugar"],
            ["211", "187", "245", "459"],
            ["Asalto con armas", "Disparos en el lugar", "Persecución de vehículo", "Exhibicionismo"],
            ["Allanamiento", "Choque y fuga", "Hurto", "Robo grande"],
            ["Robo de vehículo", "Robo a un banco", "Robo pequeño", "Hurto simple"],
            ["Asegurar la zona: señalizar y proteger a los implicados.", "Tomar declaración detallada a los testigos presenciales.", "Redactar el croquis y el atestado definitivo.", "Llamar a la grúa para retirar los vehículos."],
            ["Comprobar personas: asistencia a heridos y aviso a emergencias (112).", "Revisar la documentación del seguro obligatorio.", "Multar a los conductores implicados.", "Abrir la calzada al tráfico rodado."],
            ["Inmovilización del vehículo y diligencias.", "Permitir que el conductor continúe bajo supervisión.", "Sanción administrativa leve sin inmovilizar el coche.", "Traslado peatonal del conductor sin más trámites."],
            ["Gestionar el tráfico en actos, obras, cortes y desvíos, priorizando la seguridad de peatones y transporte público.", "Prohibir totalmente el tránsito de vehículos privados en toda la ciudad.", "Recaudar tasas de aparcamiento regulado.", "Construir carriles exclusivos para bicicletas."],
            ["Solicitar documentación acreditativa, comprobar cumplimiento de condiciones, instruir acta e informar al responsable.", "Clausurar el local de inmediato sin previo aviso.", "Multar sin verificar licencias ni aforos.", "Dejar una advertencia verbal sin levantar acta."],
            ["Comprobar licencia y superficie autorizada, verificar horarios y revisar elementos permitidos (toldos, estufas, separadores).", "Exclusivamente el color de las sillas y mesas.", "La nacionalidad de los camareros contratados.", "El tipo de café que sirven a los clientes."],
            ["Identificar, requerir documentación, informar de la prohibición, retirar mercancía si procede, levantar acta y derivar a servicios sociales si hay vulnerabilidad.", "Ignorar la venta si se realiza en zonas comerciales.", "Comprar la mercancía requisada para evitar conflictos.", "Decomisar efectos personales sin levantar acta oficial."],
            ["Vigilar conductas incívicas (suciedad, ruidos, orines, grafitis), requerir cese, imponer sanciones y fomentar la mediación y convivencia.", "Encarcelar de inmediato a cualquier infractor leve.", "Recaudar fondos para el presupuesto municipal.", "Limpiar personalmente las pintadas de las paredes."],
            ["En situaciones de riesgo vital inminente para el agente o terceros, o ante agresiones graves en curso.", "Para comprobar si la cobertura de radio funciona correctamente.", "Al finalizar el turno diario de trabajo.", "Para pedir un relevo en un puesto estático."],
            ["Priorización de frecuencias: la comunicación del agente se prioriza automáticamente sobre el resto.", "Se apagan las luces de emergencia de la central.", "Se envía un correo electrónico al intendente.", "Se bloquea el canal general de radio."],
            ["Geolocalización instantánea: la central visualiza en tiempo real la ubicación exacta del agente en el mapa.", "Envío de coordenadas por SMS al ayuntamiento.", "Reinicio del navegador GPS del vehículo patrulla.", "Borrado de historial de ruta."],
            ["Alarma sonora y visual de prioridad máxima y despliegue automático de las unidades más cercanas y disponibles.", "Aviso por megafonía pública en toda la ciudad.", "Llamada automática a los medios de comunicación.", "Envío de una patrulla a pie de forma opcional."],
            ["Uso proporcional y legal, exclusivamente en situaciones de legítima defensa o riesgo inminente, manteniéndola siempre en perfecto estado.", "Uso libre y preventivo en controles rutinarios de tráfico.", "No requiere mantenimiento ni comprobación de seguridad.", "Puede llevarse sin fundar dentro del vehículo patrulla."],
            ["Portar cerrado y asegurado, revisando su estado periódicamente como herramienta de uso proporcional y legal.", "Llevarlo siempre abierto en la mano durante los patrullajes.", "Emplearlo sin restricciones ante faltas leves.", "Guardarlo permanentemente en la comisaría central."],
            ["Se deben colocar con la doble cerradura hacia fuera, comprobando que el ajuste no sea ni excesivo ni insuficiente.", "La doble cerradura debe orientarse siempre hacia el interior de las muñecas.", "No hace falta comprobar el ajuste si se escucha el clic.", "Pueden llevarse colgadas libremente del uniforme."],
            ["Uso disuasorio ante agresiones, manteniendo una distancia adecuada de 1 a 2 metros.", "Extinción de incendios urbanos eléctricos.", "Iluminación nocturna de espacios oscuros.", "Limpieza y desinfección de material sanitario."]
        ];

        const preguntasData = obtenerListaPreguntas();
        let testIndex = 0;
        const preguntasHTML = preguntasData.map((q) => {
            if (q.tipo === 'test') {
                const currentOptions = opcionesOpciones[testIndex++] || [];
                return `
                    <div class="question-box">
                        <p>Pregunta ${q.id}: ${q.text}</p>
                        ${currentOptions.map((opt, oIndex) => `
                            <label class="option">
                                <input type="radio" name="p${q.id}" value="${String.fromCharCode(97 + oIndex)}"> 
                                ${String.fromCharCode(97 + oIndex)}) ${opt}
                            </label>
                        `).join('')}
                    </div>
                `;
            } else {
                return `
                    <div class="question-box abierta">
                        <p>Pregunta ${q.id} (Caso Práctico / Abierta): ${q.text}</p>
                        <textarea name="p${q.id}" placeholder="Escriba su respuesta o protocolo de actuación aquí... (Opcional)"></textarea>
                    </div>
                `;
            }
        }).join('');

        res.send(`<!DOCTYPE html><html><head><title>Examen Oficial GUB</title><style>${estiloCSS}</style></head><body>
            <div id="timer-bar">
                <span>${svgIcons.shield} Guàrdia Urbana de Barcelona - Examen Oficial</span>
                <span id="timer-display" style="background: #2c5282; padding: 4px 12px; border-radius: 4px; font-family: monospace; display: inline-flex; align-items: center;">${svgIcons.clock} 30:00</span>
            </div>

            <div id="anti-cheat-overlay">
                ${svgIcons.alert} INFRACCIÓN DE SEGURIDAD DETECTADA<br>
                Se ha detectado salida de pantalla completa o cambio de pestaña.<br>
                <span style="font-size: 15px; color: #cbd5e0; margin-top: 15px; font-weight: normal;">Su cuenta ha sido sancionada de forma irreversible. Redirigiendo...</span>
            </div>

            <div class="container exam-container">
                <h2>Examen Oficial de Ingreso y Situaciones</h2>
                <h3 style="font-size: 15px; color: #4a5568; margin-bottom: 25px;">Portal Selectivo de Reclutament</h3>
                <p style="text-align:center; font-size: 14px;">Aspirante autenticado: <strong>${req.user.username}</strong></p>
                <div style="background: #ebf8ff; padding: 12px; border-radius: 6px; margin-bottom: 25px; font-size: 13px; color: #2b6cb0; text-align: center; border: 1px solid #bee3f8;">
                    ${svgIcons.shield} <strong>AVISO:</strong> Las preguntas pueden dejarse en blanco si se prefiere omitir. Dispone de un límite estricto de 30 minutos. Al agotarse el tiempo, el examen se enviará automáticamente.
                </div>

                <form action="/enviar" method="POST" id="examen-form">
                    <label style="font-weight: 600;">Nombre y Apellido IC:</label>
                    <input type="text" name="nombreIC" required placeholder="Introduce tu nombre y apellido IC">

                    <label style="font-weight: 600;">Nombres de Instructores:</label>
                    <input type="text" name="nombresInstructores" required placeholder="Introduce los nombres de los instructores a cargo">

                    <h3 style="margin-top: 40px; font-size: 16px; border-bottom: 2px solid #003366; padding-bottom: 8px; text-align: left;">Cuestionario y Casos Prácticos (60 Cuestiones)</h3>

                    ${preguntasHTML}

                    <button type="submit" class="btn-primary">Enviar Examen Definitivo</button>
                </form>
                <a href="/" style="display:block; text-align:center; margin-top:25px; text-decoration:none; color:#003366; font-size:13px; font-weight:600;">Cancelar y volver al inicio</a>
            </div>

            <script>
                let examenEnviado = false;

                // Cronómetro de 30 minutos con icono SVG de reloj
                let tiempoRestante = 30 * 60;
                const timerDisplay = document.getElementById('timer-display');
                const clockSvg = \`${svgIcons.clock}\`;

                const cuentaRegresiva = setInterval(() => {
                    let minutos = Math.floor(tiempoRestante / 60);
                    let segundos = tiempoRestante % 60;
                    timerDisplay.innerHTML = clockSvg + ' ' + String(minutos).padStart(2, '0') + ':' + String(segundos).padStart(2, '0');

                    if (tiempoRestante <= 0) {
                        clearInterval(cuentaRegresiva);
                        alert('¡El tiempo reglamentario de 30 minutos ha finalizado! El formulario se enviará automáticamente.');
                        document.getElementById('examen-form').submit();
                    }
                    tiempoRestante--;
                }, 1000);

                window.onload = function() {
                    document.body.addEventListener('click', function() {
                        if (!document.fullscreenElement) {
                            document.documentElement.requestFullscreen().catch(err => {});
                        }
                    }, { once: true });
                };

                const overlay = document.getElementById('anti-cheat-overlay');
                function activarTrampaYBaneo() {
                    if (examenEnviado) return;
                    overlay.style.display = 'flex';
                    fetch('/api/banear-trampa')
                        .then(res => res.json())
                        .then(() => { setTimeout(() => { window.location.href = '/'; }, 3000); })
                        .catch(() => { window.location.href = '/'; });
                }

                document.addEventListener('visibilitychange', function() { if (document.hidden && !examenEnviado) activarTrampaYBaneo(); });
                window.addEventListener('blur', function() { if (!examenEnviado) activarTrampaYBaneo(); });
                document.addEventListener('fullscreenchange', function() { if (!document.fullscreenElement && !examenEnviado) activarTrampaYBaneo(); });
                document.getElementById('examen-form').addEventListener('submit', function() { examenEnviado = true; });
            </script>
        </body></html>`);
    });
});

app.post('/enviar', (req, res) => {
    if (!req.isAuthenticated() || !req.user) return res.redirect('/');
    
    verificarBaneado(req.user.id, (isBanned) => {
        if (isBanned) return res.redirect('/');
        
        const datos = req.body;
        const discordId = req.user.id;
        const discordName = req.user.username;
        const nombreIC = datos.nombreIC || 'Sin nombre';
        const nombresInstructores = datos.nombresInstructores || 'Sin instructores';
        const fechaEnvio = new Date().toLocaleString();
        const respuestasJSON = JSON.stringify(datos);

        db.run(`INSERT INTO examenes (discord_id, discord_name, nombre_ic, nombres_instructores, fecha_envio, respuestas) VALUES (?, ?, ?, ?, ?, ?)`,
            [discordId, discordName, nombreIC, nombresInstructores, fechaEnvio, respuestasJSON], (err) => {
                if (err) return res.status(500).send('Error al guardar en base de datos.');

                res.send(`<!DOCTYPE html><html><head><title>Examen Enviado</title><style>${estiloCSS}</style></head><body>
                    <div class="container" style="text-align:center; max-width: 480px; margin-top: 80px;">
                        <h2>Examen Registrado con Éxito</h2>
                        <p style="color: #4a5568; font-size: 14px;">Sus respuestas han sido almacenadas de forma segura y permanente en la base de datos de la Guàrdia Urbana.</p>
                        <a href="/" class="btn-primary" style="margin-top:25px; display:inline-block; text-decoration:none;">Volver al Portal Principal</a>
                    </div></body></html>`);
            });
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor GUB Profesional operativo en http://localhost:${PORT}`));