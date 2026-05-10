const express = require('express');
const { Pool } = require('pg');

const app = express();
app.use(express.json());

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'postgres',
    database: process.env.DB_NAME || 'ticketing',
    password: process.env.DB_PASSWORD || 'postgres',
    port: 5432,
});

// ── Create a ticket (Customer) ─────────────────────────────────────────────────
app.post('/api/tickets', async (req, res) => {
    const { title, description, submitted_by } = req.body;
    if (!title || !description || !submitted_by) {
        return res.status(400).json({ error: 'title, description, and submitted_by are required' });
    }
    try {
        const result = await pool.query(
            'INSERT INTO tickets (title, description, submitted_by) VALUES ($1, $2, $3) RETURNING *',
            [title, description, submitted_by.trim()]
        );
        const newTicket = result.rows[0];

        // Notify Notification Service
        try {
            await fetch('http://notification-service:3003/notify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: `New ticket created by ${submitted_by}: ${title}`,
                    ticketId: newTicket.id
                })
            });
        } catch (e) {
            console.error('Failed to send notification:', e.message);
        }

        res.status(201).json(newTicket);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// ── Get all tickets (Agent) ───────────────────────────────────────────────────
app.get('/api/tickets', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM tickets ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// ── Get tickets by submitter name (Customer) ──────────────────────────────────
app.get('/api/tickets/mine', async (req, res) => {
    const { name } = req.query;
    if (!name) return res.status(400).json({ error: 'name query param required' });
    try {
        const result = await pool.query(
            'SELECT * FROM tickets WHERE LOWER(submitted_by) = LOWER($1) ORDER BY id DESC',
            [name.trim()]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// ── Get a single ticket with response history ─────────────────────────────────
app.get('/api/tickets/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const ticketRes = await pool.query('SELECT * FROM tickets WHERE id = $1', [id]);
        if (ticketRes.rows.length === 0) {
            return res.status(404).json({ error: 'Ticket not found' });
        }
        const responsesRes = await pool.query(
            'SELECT * FROM ticket_responses WHERE ticket_id = $1 ORDER BY created_at ASC',
            [id]
        );
        const assignmentRes = await pool.query(
            'SELECT * FROM support_assignments WHERE ticket_id = $1 ORDER BY assigned_at DESC LIMIT 1',
            [id]
        );
        res.json({
            ...ticketRes.rows[0],
            responses: responsesRes.rows,
            assignment: assignmentRes.rows[0] || null,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// ── Update ticket — priority and/or assigned_agent (Agent) ────────────────────
app.put('/api/tickets/:id', async (req, res) => {
    const { id } = req.params;
    const { priority, assigned_agent } = req.body;
    try {
        const result = await pool.query(
            `UPDATE tickets
             SET priority       = COALESCE($1, priority),
                 assigned_agent = COALESCE($2, assigned_agent),
                 updated_at     = NOW()
             WHERE id = $3
             RETURNING *`,
            [priority ? priority.toUpperCase() : null, assigned_agent || null, id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Ticket not found' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Ticket Service running on port ${PORT}`));
