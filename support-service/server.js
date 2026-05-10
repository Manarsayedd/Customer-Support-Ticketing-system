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

// ── Assign ticket to an agent ─────────────────────────────────────────────────
app.post('/:id/assign', async (req, res) => {
    const ticketId = req.params.id;
    const { support_agent } = req.body;
    if (!support_agent) return res.status(400).json({ error: 'support_agent is required' });

    try {
        await pool.query(
            'INSERT INTO support_assignments (ticket_id, support_agent) VALUES ($1, $2)',
            [ticketId, support_agent]
        );
        await pool.query(
            'UPDATE tickets SET status = $1, updated_at = NOW() WHERE id = $2',
            ['IN_PROGRESS', ticketId]
        );

        // Notify
        try {
            await fetch('http://notification-service:3003/notify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: `Ticket #${ticketId} assigned to ${support_agent}`, ticketId })
            });
        } catch (e) { console.error('Notification failed:', e.message); }

        res.json({ message: 'Ticket assigned successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// ── Add an agent response / interaction ───────────────────────────────────────
app.post('/:id/respond', async (req, res) => {
    const ticketId = req.params.id;
    const { agent, message } = req.body;
    if (!agent || !message) return res.status(400).json({ error: 'agent and message are required' });

    try {
        const result = await pool.query(
            'INSERT INTO ticket_responses (ticket_id, agent, message) VALUES ($1, $2, $3) RETURNING *',
            [ticketId, agent, message]
        );
        // Touch updated_at on the ticket
        await pool.query('UPDATE tickets SET updated_at = NOW() WHERE id = $1', [ticketId]);

        // Notify
        try {
            await fetch('http://notification-service:3003/notify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: `New response on ticket #${ticketId} from ${agent}`, ticketId })
            });
        } catch (e) { console.error('Notification failed:', e.message); }

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// ── Resolve ticket ────────────────────────────────────────────────────────────
app.post('/:id/resolve', async (req, res) => {
    const ticketId = req.params.id;
    const { resolution_notes } = req.body;

    try {
        await pool.query(
            'UPDATE tickets SET status = $1, updated_at = NOW() WHERE id = $2',
            ['RESOLVED', ticketId]
        );
        await pool.query(
            'UPDATE support_assignments SET resolution_notes = $1, resolved_at = NOW() WHERE ticket_id = $2',
            [resolution_notes, ticketId]
        );

        // Notify
        try {
            await fetch('http://notification-service:3003/notify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: `Ticket #${ticketId} has been resolved.`, ticketId })
            });
        } catch (e) { console.error('Notification failed:', e.message); }

        res.json({ message: 'Ticket resolved successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => console.log(`Support Service running on port ${PORT}`));
