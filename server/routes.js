const express = require('express');
const router = express.Router();
const { supabase } = require('./supabase');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { getCseGraphData } = require('./cse_graph');


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
    limits: { fileSize: 25 * 1024 * 1024 }, 
});


function getResourcesDir() {
    try {
        const serverDir = path.join(__dirname, 'resources');
        if (fs.existsSync(serverDir)) return serverDir;
    } catch (_) {}
    try {
        const projectRoot = path.resolve(__dirname, '..');
        const docsDir = path.join(projectRoot, 'docs', 'BRACU-Gradesheet-Analyzer-main', 'resources');
        if (fs.existsSync(docsDir)) return docsDir;
    } catch (_) {}
    return null;
}




router.get('/test', (req, res) => {
    res.json({ message: 'API is working!' });
});


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


router.post('/auth/signup', async (req, res) => {
    try {
        const { email, password, fullName, studentId, major = 'CSE' } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

        
        const { data, error } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { full_name: fullName || null }
        });
        if (error) throw error;

        const userId = data.user.id;

        
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


router.post('/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

        
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

                
                const { error: delAttErr } = await supabase.from('course_attempts').delete().eq('user_id', userId);
                if (delAttErr) throw delAttErr;
                const { error: delSemErr } = await supabase.from('semesters').delete().eq('user_id', userId);
                if (delSemErr) throw delSemErr;

                
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



router.get('/courses/suggestions/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        if (!userId) return res.status(400).json({ error: 'Missing userId' });
        const resourcesDir = getResourcesDir();
        let allCodes = [];
        let titlesByCode = {};
        try {
            const files = resourcesDir ? fs.readdirSync(resourcesDir).filter((f) => f.endsWith('.json')) : [];
            allCodes = files.map((f) => path.basename(f, '.json').toUpperCase());
            for (const f of files) {
                const code = path.basename(f, '.json').toUpperCase();
                try {
                    const raw = fs.readFileSync(path.join(resourcesDir, f), 'utf8');
                    const j = JSON.parse(raw);
                    titlesByCode[code] = j.title || j.course_title || j.course_name || j.name || null;
                } catch (_) {}
            }
        } catch (_e) {
            
            allCodes = [];
        }

        const { data: attempts, error } = await supabase
            .from('course_attempts')
            .select('course_code')
            .eq('user_id', userId);
        if (error) throw error;

        const done = new Set((attempts || []).map((a) => String(a.course_code || '').toUpperCase()));
        const suggestions = allCodes.filter((c) => c && !done.has(c)).sort();

        res.json({ suggestions: suggestions, meta: suggestions.map((c) => ({ code: c, title: titlesByCode[c] || null })) });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// ==================== SAVE CURRENT SEMESTER COURSES ====================
// Save up to 5 selected course codes for the user's current term
router.post('/marks/current-courses', async (req, res) => {
    try {
        const { userId, courseCodes } = req.body || {};
        if (!userId) return res.status(400).json({ error: 'Missing userId' });
        const codes = Array.isArray(courseCodes) ? courseCodes.map((c) => String(c || '').toUpperCase().trim()).filter(Boolean) : [];
        const uniqueCodes = Array.from(new Set(codes));
        if (uniqueCodes.length === 0) return res.status(400).json({ error: 'No courses provided' });
        if (uniqueCodes.length > 5) return res.status(400).json({ error: 'Maximum 5 courses allowed' });

        
        const resourcesDir = getResourcesDir();
        let validCodes = new Set();
        try {
            const files = resourcesDir ? fs.readdirSync(resourcesDir).filter((f) => f.endsWith('.json')) : [];
            validCodes = new Set(files.map((f) => path.basename(f, '.json').toUpperCase()));
        } catch (_e) {
            validCodes = new Set();
        }
        const toSave = uniqueCodes.filter((c) => validCodes.size === 0 || validCodes.has(c));
        if (toSave.length === 0) return res.status(400).json({ error: 'Provided course codes are not recognized' });

        
        const { error: delErr } = await supabase
            .from('marks_courses')
            .delete()
            .eq('user_id', userId)
            .eq('term_name', 'Current');
        if (delErr) throw delErr;
        
        const rows = toSave.map((course_code) => {
            let title = null;
            try {
                if (resourcesDir) {
                    const fp = path.join(resourcesDir, `${course_code}.json`);
                    if (fs.existsSync(fp)) {
                        const raw = fs.readFileSync(fp, 'utf8');
                        const j = JSON.parse(raw);
                        title = j.title || j.course_title || j.course_name || j.name || null;
                    }
                }
            } catch (_e) {
                
            }
            return { user_id: userId, course_code, term_name: 'Current', title };
        });
        const { data: inserted, error: insErr } = await supabase
            .from('marks_courses')
            .insert(rows)
            .select('id, course_code, title');
        if (insErr) throw insErr;

        res.json({ success: true, inserted_count: inserted?.length || 0, courses: inserted || [] });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});


router.get('/marks/current-courses/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        if (!userId) return res.status(400).json({ error: 'Missing userId' });
        const { data, error } = await supabase
            .from('marks_courses')
            .select('id, course_code, title')
            .eq('user_id', userId)
            .eq('term_name', 'Current')
            .order('id', { ascending: true });
        if (error) throw error;
        
        let enriched = Array.isArray(data) ? data.slice() : [];
        const resourcesDir = getResourcesDir();
        if (resourcesDir && enriched.length) {
            for (let i = 0; i < enriched.length; i++) {
                const row = enriched[i];
                if (row && row.course_code) {
                    try {
                        const code = String(row.course_code || '').toUpperCase();
                        const currentTitle = (row.title || '').toString().trim();
                        const needsFill = !currentTitle || currentTitle.toUpperCase() === code;
                        if (!needsFill) continue;
                        const fp = path.join(resourcesDir, `${code}.json`);
                        if (fs.existsSync(fp)) {
                            const raw = fs.readFileSync(fp, 'utf8');
                            const j = JSON.parse(raw);
                            const t = j.title || j.course_title || j.course_name || j.name || null;
                            if (t) {
                                enriched[i] = { ...row, title: t };
                            }
                        }
                    } catch (_) {
                        
                    }
                }
            }
        }
        res.json({ courses: enriched });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});


router.delete('/marks/current-courses/:userId/:id', async (req, res) => {
    try {
        const { userId, id } = req.params;
        if (!userId || !id) return res.status(400).json({ error: 'Missing userId or id' });
        const { error } = await supabase
            .from('marks_courses')
            .delete()
            .eq('user_id', userId)
            .eq('id', id)
            .eq('term_name', 'Current');
        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});



router.get('/marks/summary/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        if (!userId) return res.status(400).json({ error: 'Missing userId' });

        
        const { data: courses, error: curErr } = await supabase
            .from('marks_courses')
            .select('course_code')
            .eq('user_id', userId)
            .eq('term_name', 'Current');
        if (curErr) throw curErr;
        const codes = (courses || []).map((c) => String(c.course_code || '').toUpperCase());
        if (!codes.length) return res.json({ summary: [] });

        // Aggregate marks per course from marks_items (if table exists)
        // Expected schema: marks_items(user_id, course_code, term_name, score)
        let items = [];
        try {
            const { data: rows, error: itemsErr } = await supabase
                .from('marks_items')
                .select('course_code, score')
                .eq('user_id', userId)
                .eq('term_name', 'Current');
            if (itemsErr) {
                
                items = [];
            } else {
                items = Array.isArray(rows) ? rows : [];
            }
        } catch (_e) {
            items = [];
        }

        const sumByCode = {};
        for (const it of items) {
            const code = String(it.course_code || '').toUpperCase();
            const score = Number(it.score);
            if (!codes.includes(code)) continue;
            if (!Number.isFinite(score)) continue;
            sumByCode[code] = (sumByCode[code] || 0) + score;
        }

        const summary = codes.map((code) => ({ course_code: code, total_marks: sumByCode[code] ?? null }));
        res.json({ summary });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});


// ==================== ANALYZER READ ENDPOINTS ====================
// Fetch semesters for a user
router.get('/semesters/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        if (!userId) return res.status(400).json({ error: 'Missing userId' });
        const { data, error } = await supabase
            .from('semesters')
            .select('id, name, term_index, term_gpa, term_credits, cumulative_cgpa')
            .eq('user_id', userId)
            .order('term_index', { ascending: true });
        if (error) throw error;
        res.json({ semesters: data || [] });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});


router.get('/course-attempts/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        if (!userId) return res.status(400).json({ error: 'Missing userId' });
        const { data, error } = await supabase
            .from('course_attempts')
            .select('id, semester_id, course_code, grade, gpa, credit, attempt_no, is_retake, is_latest')
            .eq('user_id', userId)
            .order('semester_id', { ascending: true });
        if (error) throw error;
        res.json({ attempts: data || [] });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});


router.get('/analyzer/summary/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        if (!userId) return res.status(400).json({ error: 'Missing userId' });

        const { data: profile, error: profErr } = await supabase
            .from('user_profiles')
            .select('user_id, full_name, student_id, major, last_parsed_at')
            .eq('user_id', userId)
            .maybeSingle();
        if (profErr) throw profErr;

        const { data: semesters, error: semErr } = await supabase
            .from('semesters')
            .select('id, cumulative_cgpa')
            .eq('user_id', userId);
        if (semErr) throw semErr;

        const { data: attempts, error: attErr } = await supabase
            .from('course_attempts')
            .select('gpa, credit, is_retake, is_latest')
            .eq('user_id', userId);
        if (attErr) throw attErr;

        const latest = (attempts || []).filter(a => a.is_latest);
        const credits = latest.reduce((s,a)=> s + (a.credit || 0), 0);
        const points = latest.reduce((s,a)=> s + ((a.gpa || 0) * (a.credit || 0)), 0);
        const cgpa = credits > 0 ? Number((points / credits).toFixed(2)) : null;
        const retakesCount = (attempts || []).filter(a => a.is_retake).length;
        const termsCount = (semesters || []).length;

        res.json({
            profile: profile || null,
            kpis: { cgpa, creditsEarned: credits, retakesCount, termsCount }
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});




router.get('/cse/graph', async (_req, res) => {
    try {
        const data = getCseGraphData();
        
        const resourcesDir = getResourcesDir();
        const titles = {};
        if (resourcesDir && Array.isArray(data.nodes)) {
            for (const code of data.nodes) {
                try {
                    const fp = path.join(resourcesDir, `${code}.json`);
                    if (fs.existsSync(fp)) {
                        const raw = fs.readFileSync(fp, 'utf8');
                        const j = JSON.parse(raw);
                        titles[code] = j.title || j.course_title || j.course_name || j.name || null;
                    }
                } catch (_) {}
            }
        }
        res.json({ ...data, titles });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

