const express = require('express');
const router = express.Router();
const { supabase } = require('./supabase');

// ==================== AUTH ROUTES ====================

// Test route
router.get('/test', (req, res) => {
    res.json({ message: 'API is working!' });
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

