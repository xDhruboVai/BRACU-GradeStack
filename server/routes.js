const express = require('express');
const router = express.Router();
const { supabase } = require('./supabase');

// ==================== AUTH ROUTES ====================

// Test route
router.get('/test', (req, res) => {
    res.json({ message: 'API is working!' });
});

// Signup route
router.post('/auth/signup', async (req, res) => {
    try {
        const { email, password, fullName } = req.body;

        // Create user in Supabase Auth
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: fullName
                }
            }
        });

        if (error) throw error;

        res.json({
            success: true,
            message: 'User created successfully',
            user: data.user
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Login route
router.post('/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw error;

        res.json({
            success: true,
            user: data.user,
            session: data.session
        });
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

