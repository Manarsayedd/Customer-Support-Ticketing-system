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

// ── Summary report ────────────────────────────────────────────────────────────
// GET /api/reports/summary
// Returns: totals by status, average resolution time, and counts by priority
app.get('/api/reports/summary', async (req, res) => {
    try {
        // Status counts
        const statusRes = await pool.query(`
            SELECT status, COUNT(*) AS count
            FROM tickets
            GROUP BY status
        `);

        // Priority counts
        const priorityRes = await pool.query(`
            SELECT priority, COUNT(*) AS count
            FROM tickets
            GROUP BY priority
        `);

        // Average resolution time (hours) for resolved tickets
        const avgRes = await pool.query(`
            SELECT
                ROUND(AVG(EXTRACT(EPOCH FROM (sa.resolved_at - t.created_at)) / 3600)::numeric, 2) AS avg_resolution_hours,
                COUNT(sa.id) AS resolved_count
            FROM tickets t
            JOIN support_assignments sa ON sa.ticket_id = t.id
            WHERE sa.resolved_at IS NOT NULL
        `);

        // Total response count
        const responseCountRes = await pool.query(`SELECT COUNT(*) AS count FROM ticket_responses`);

        // Build status map
        const statusMap = { OPEN: 0, IN_PROGRESS: 0, RESOLVED: 0 };
        statusRes.rows.forEach(r => { statusMap[r.status] = parseInt(r.count, 10); });

        const priorityMap = { LOW: 0, MEDIUM: 0, HIGH: 0, URGENT: 0 };
        priorityRes.rows.forEach(r => { priorityMap[r.priority] = parseInt(r.count, 10); });

        const total = statusMap.OPEN + statusMap.IN_PROGRESS + statusMap.RESOLVED;

        res.json({
            total_tickets: total,
            by_status: statusMap,
            by_priority: priorityMap,
            avg_resolution_hours: parseFloat(avgRes.rows[0].avg_resolution_hours) || 0,
            total_responses: parseInt(responseCountRes.rows[0].count, 10),
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// ── Per-ticket performance report ─────────────────────────────────────────────
// GET /api/reports/tickets
// Returns each ticket with created/resolved timestamps and response count
app.get('/api/reports/tickets', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                t.id,
                t.title,
                t.status,
                t.priority,
                t.created_at,
                t.updated_at,
                sa.support_agent,
                sa.assigned_at,
                sa.resolved_at,
                ROUND(
                    EXTRACT(EPOCH FROM (COALESCE(sa.resolved_at, NOW()) - t.created_at)) / 3600
                ::numeric, 2) AS age_hours,
                (SELECT COUNT(*) FROM ticket_responses tr WHERE tr.ticket_id = t.id) AS response_count
            FROM tickets t
            LEFT JOIN support_assignments sa ON sa.ticket_id = t.id
            ORDER BY t.id DESC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

const PORT = process.env.PORT || 3004;
app.listen(PORT, () => console.log(`Reporting Service running on port ${PORT}`));
