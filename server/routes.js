const express = require('express');
const router = express.Router();
const { supabase } = require('./supabase');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// =============== Upload setup for PDF parsing ===============
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({
    storage: multer.diskStorage({
        destination: (_req, _file, cb) => cb(null, uploadDir),
        filename: (_req, file, cb) => {
            const ts = Date.now();
            const safe = file.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_');
            cb(null, `${ts}-${safe}`);
        },
    }),
    fileFilter: (_req, file, cb) => {
        if (file.mimetype === 'application/pdf') return cb(null, true);
        cb(new Error('Only PDF files are allowed'));
    },
    limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
});

// ==================== AUTH ROUTES ====================

// Test route
router.get('/test', (req, res) => {
    res.json({ message: 'API is working!' });
});

// Parse gradesheet: accepts multipart/form-data with field 'file'
router.post('/parse', upload.single('file'), async (req, res) => {
    const cleanup = () => {
        if (req.file && req.file.path) {
            fs.unlink(req.file.path, () => {});
        }
    };

    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const projectRoot = path.resolve(__dirname, '..');
        const pythonFromEnv = process.env.PYTHON_BIN;
        const venvPython = path.join(projectRoot, '.venv', 'bin', 'python');
        const pythonBin = pythonFromEnv || (fs.existsSync(venvPython) ? venvPython : 'python3');

        const scriptPath = path.join(__dirname, 'scripts', 'parse_to_json.py');
        if (!fs.existsSync(scriptPath)) {
            cleanup();
            return res.status(500).json({ error: 'Parser script not found' });
        }

        const child = spawn(pythonBin, [scriptPath, req.file.path], {
            cwd: projectRoot,
            env: { ...process.env },
        });

        let stdout = '';
        let stderr = '';
        child.stdout.on('data', (d) => (stdout += d.toString()));
        child.stderr.on('data', (d) => (stderr += d.toString()));

        child.on('close', (code) => {
            cleanup();
            if (code !== 0) {
                return res.status(400).json({ error: 'Parser failed', details: stderr || stdout });
            }
            try {
                const json = JSON.parse(stdout);
                if (json && json.error) {
                    return res.status(400).json(json);
                }
                return res.json(json);
            } catch (e) {
                return res.status(500).json({ error: 'Invalid JSON from parser', details: e?.message, raw: stdout });
            }
        });
    } catch (err) {
        cleanup();
        return res.status(500).json({ error: err.message });
    }
});

// Signup route (no 2FA/email confirmation; create via admin and upsert profile)
router.post('/auth/signup', async (req, res) => {
    try {
        const { email, password, fullName, studentId, major = 'CSE' } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

        // Create user via Admin API with email_confirm=true to bypass email confirmation
        const { data, error } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { full_name: fullName || null }
        });
        if (error) throw error;

        const userId = data.user.id;

        // Hash password and upsert user_profiles
        const bcrypt = require('bcryptjs');
        const hashed = await bcrypt.hash(password, 12);
        const { error: upsertErr } = await supabase
            .from('user_profiles')
            .upsert(
                {
                    user_id: userId,
                    email,
                    hashed_password: hashed,
                    full_name: fullName || null,
                    student_id: studentId || null,
                    major,
                },
                { onConflict: 'user_id' }
            );
        if (upsertErr) throw upsertErr;

        res.status(201).json({
            success: true,
            message: 'User created successfully',
            user: { id: userId, email }
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Login route (ensure profile exists and is synced)
router.post('/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

        // Use password auth
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        const userId = data.user.id;
        const { data: profile, error: profErr } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

        if (profErr) throw profErr;

        const bcrypt = require('bcryptjs');
        const hashed = await bcrypt.hash(password, 12);

        if (!profile) {
            const { error: insErr } = await supabase
                .from('user_profiles')
                .upsert({ user_id: userId, email, hashed_password: hashed }, { onConflict: 'user_id' });
            if (insErr) throw insErr;
        } else {
            const needsUpdate = (!profile.email || profile.email !== email) || !profile.hashed_password;
            if (needsUpdate) {
                const { error: updErr } = await supabase
                    .from('user_profiles')
                    .update({ email, hashed_password: hashed })
                    .eq('user_id', userId);
                if (updErr) throw updErr;
            }
        }

        res.json({ success: true, user: data.user, session: data.session });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// ==================== USER PROFILE ROUTES ====================

// Get user profile
router.get('/profile/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        const { data, error } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (error) throw error;

        res.json({ profile: data });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Update user profile
router.put('/profile/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { major, fullName, studentId } = req.body;

        const { data, error } = await supabase
            .from('user_profiles')
            .update({ major, full_name: fullName, student_id: studentId })
            .eq('user_id', userId)
            .select()
            .single();

        if (error) throw error;

        res.json({
            success: true,
            profile: data
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});


module.exports = router;

// ==================== PARSE & SAVE ROUTE ====================
// Upload a PDF, parse it via Python, purge previous records, and save to DB
router.post('/parse-and-save', upload.single('file'), async (req, res) => {
    const cleanup = () => {
        if (req.file && req.file.path) {
            fs.unlink(req.file.path, () => {});
        }
    };

    try {
        const userId = (req.body && req.body.userId) || null;
        if (!userId) {
            cleanup();
            return res.status(400).json({ error: 'Missing userId' });
        }
        if (!req.file) {
            cleanup();
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const projectRoot = path.resolve(__dirname, '..');
        const pythonFromEnv = process.env.PYTHON_BIN;
        const venvPython = path.join(projectRoot, '.venv', 'bin', 'python');
        const pythonBin = pythonFromEnv || (fs.existsSync(venvPython) ? venvPython : 'python3');

        const scriptPath = path.join(__dirname, 'scripts', 'parse_to_json.py');
        if (!fs.existsSync(scriptPath)) {
            cleanup();
            return res.status(500).json({ error: 'Parser script not found' });
        }

        // Run parser
        const child = spawn(pythonBin, [scriptPath, req.file.path], { cwd: projectRoot, env: { ...process.env } });
        let stdout = '';
        let stderr = '';
        child.stdout.on('data', (d) => (stdout += d.toString()));
        child.stderr.on('data', (d) => (stderr += d.toString()));
        child.on('close', async (code) => {
            cleanup();
            if (code !== 0) {
                return res.status(400).json({ error: 'Parser failed', details: stderr || stdout });
            }
            let parsed;
            try {
                parsed = JSON.parse(stdout);
            } catch (e) {
                return res.status(500).json({ error: 'Invalid JSON from parser', details: e?.message, raw: stdout });
            }
            if (parsed && parsed.error) {
                return res.status(400).json(parsed);
            }

            // Normalize data
            const profile = parsed.profile || {};
            const semesters = Array.isArray(parsed.semesters) ? parsed.semesters : [];
            const attempts = Array.isArray(parsed.course_attempts) ? parsed.course_attempts : [];
            const normSemesters = semesters.map((s) => ({
                user_id: userId,
                name: String(s.name || '').trim(),
                term_index: s.term_index ?? 0,
                term_gpa: s.term_gpa ?? null,
                term_credits: s.term_credits ?? null,
                cumulative_cgpa: s.cumulative_cgpa ?? null,
            }));

            try {
                // Upsert profile
                const nowIso = new Date().toISOString();
                const { error: upErr } = await supabase
                    .from('user_profiles')
                    .upsert({
                        user_id: userId,
                        full_name: profile.full_name || null,
                        student_id: profile.student_id || null,
                        last_parsed_at: nowIso,
                    }, { onConflict: 'user_id' });
                if (upErr) throw upErr;

                // Purge existing data
                const { error: delAttErr } = await supabase.from('course_attempts').delete().eq('user_id', userId);
                if (delAttErr) throw delAttErr;
                const { error: delSemErr } = await supabase.from('semesters').delete().eq('user_id', userId);
                if (delSemErr) throw delSemErr;

                // Insert semesters and get ids
                let semIdMap = {};
                if (normSemesters.length > 0) {
                    const { data: semRows, error: insSemErr } = await supabase
                        .from('semesters')
                        .insert(normSemesters)
                        .select('id,name,term_index');
                    if (insSemErr) throw insSemErr;
                    for (const row of (semRows || [])) {
                        semIdMap[String(row.name).trim()] = row.id;
                    }
                }

                // Build attempts batch
                const attemptRecords = attempts.map((att) => ({
                    user_id: userId,
                    semester_id: semIdMap[String(att.semester || '').trim()] || null,
                    course_code: att.course_code,
                    grade: att.grade,
                    gpa: att.gpa,
                    credit: att.credit ? parseInt(att.credit, 10) : null,
                    attempt_no: att.attempt_no || 1,
                    is_retake: !!att.is_retake,
                    is_latest: !!att.is_latest,
                }));

                // Chunked insert
                const CHUNK = 500;
                for (let i = 0; i < attemptRecords.length; i += CHUNK) {
                    const chunk = attemptRecords.slice(i, i + CHUNK);
                    if (chunk.length > 0) {
                        const { error: insAttErr } = await supabase.from('course_attempts').insert(chunk);
                        if (insAttErr) throw insAttErr;
                    }
                }

                return res.json({
                    success: true,
                    profile: { full_name: profile.full_name, student_id: profile.student_id },
                    semesters_inserted: normSemesters.length,
                    attempts_inserted: attemptRecords.length,
                });
            } catch (dbErr) {
                return res.status(400).json({ error: dbErr.message || String(dbErr) });
            }
        });
    } catch (err) {
        cleanup();
        return res.status(500).json({ error: err.message });
    }
});

