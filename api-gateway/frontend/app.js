// ═══════════════════════════════════════════════════════════════
// Utilities
// ═══════════════════════════════════════════════════════════════

function escHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function fmtDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

let toastTimer;
function showToast(msg, type = 'success') {
    const el = document.getElementById('toast');
    document.getElementById('toastMsg').textContent  = msg;
    document.getElementById('toastIcon').textContent = type === 'success' ? '✅' : '❌';
    el.className = `toast-${type}`;
    clearTimeout(toastTimer);
    el.classList.add('show');
    toastTimer = setTimeout(() => el.classList.remove('show'), 3600);
}

function skeleton() {
    return `<div class="skeleton">
        <div class="skeleton-card"><div class="sk sk-title"></div><div class="sk sk-line"></div><div class="sk sk-line-s"></div></div>
        <div class="skeleton-card"><div class="sk sk-title"></div><div class="sk sk-line"></div><div class="sk sk-line-s"></div></div>
    </div>`;
}

// ═══════════════════════════════════════════════════════════════
// Tab switching
// ═══════════════════════════════════════════════════════════════

const TABS = ['tickets', 'new', 'reports'];

function switchTab(tab) {
    TABS.forEach(t => {
        document.getElementById(`tab-${t}`).classList.toggle('active', t === tab);
        document.getElementById(`pane-${t}`).classList.toggle('active', t === tab);
    });
    if (tab === 'tickets') loadTickets();
    if (tab === 'reports') loadReports();
}

// ═══════════════════════════════════════════════════════════════
// Status & Priority badge helpers
// ═══════════════════════════════════════════════════════════════

function statusBadge(status) {
    const cls = { OPEN: 'badge-open', IN_PROGRESS: 'badge-in_progress', RESOLVED: 'badge-resolved' }[status] ?? 'badge-open';
    const lbl = status === 'IN_PROGRESS' ? 'In Progress' : (status[0] + status.slice(1).toLowerCase());
    return `<span class="badge ${cls}">${lbl}</span>`;
}

function priorityBadge(priority) {
    const map = { LOW: ['pri-low','🔵'], MEDIUM: ['pri-medium','🟡'], HIGH: ['pri-high','🟠'], URGENT: ['pri-urgent','🔴'] };
    const [cls, icon] = map[priority] ?? map['MEDIUM'];
    const lbl = priority[0] + priority.slice(1).toLowerCase();
    return `<span class="badge ${cls}">${icon} ${lbl}</span>`;
}

// ═══════════════════════════════════════════════════════════════
// Tickets tab
// ═══════════════════════════════════════════════════════════════

async function loadTickets() {
    const list = document.getElementById('ticketsList');
    list.innerHTML = skeleton();

    try {
        const res = await fetch('/api/tickets');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const tickets = await res.json();

        renderStatsBar(tickets);

        if (tickets.length === 0) {
            list.innerHTML = `<div class="state-msg"><div class="icon">📭</div><p>No tickets yet — create one in the New Ticket tab!</p></div>`;
            return;
        }

        list.innerHTML = tickets.map((t, i) => `
            <div class="ticket-card" style="animation-delay:${i * 0.04}s" id="tcard-${t.id}">
                <div class="ticket-main" onclick="toggleDetail(${t.id})">
                    <div class="ticket-header">
                        <div class="ticket-id-title">
                            <span class="ticket-num">#${t.id}</span>
                            <span class="ticket-title">${escHtml(t.title)}</span>
                        </div>
                        <div class="ticket-badges">
                            ${statusBadge(t.status)}
                            ${priorityBadge(t.priority || 'MEDIUM')}
                        </div>
                    </div>
                    <p class="ticket-desc">${escHtml(t.description)}</p>
                    <div class="ticket-footer">
                        <span class="ticket-meta">🕐 ${fmtDate(t.created_at)}</span>
                        <div class="ticket-actions" onclick="event.stopPropagation()">
                            ${t.status !== 'RESOLVED'
                                ? `<button id="resolve-btn-${t.id}" class="btn btn-sm btn-resolve" onclick="resolveTicket(${t.id})">✓ Resolve</button>`
                                : ''}
                            <button class="btn btn-sm btn-respond" onclick="toggleDetail(${t.id})">💬 History</button>
                        </div>
                    </div>
                </div>
                <div class="ticket-detail" id="detail-${t.id}">
                    <div class="response-thread" id="thread-${t.id}">
                        <p class="thread-title">💬 Interaction History</p>
                        <div id="responses-${t.id}"><em class="no-responses">Loading…</em></div>
                    </div>
                    ${t.status !== 'RESOLVED' ? `
                    <div class="divider">Add Response</div>
                    <form class="respond-form" onsubmit="submitResponse(event, ${t.id})">
                        <div class="form-group" style="flex:0 0 160px;min-width:0">
                            <input id="agent-${t.id}" type="text" placeholder="Agent name" required autocomplete="off">
                        </div>
                        <div class="form-group" style="flex:1;min-width:200px">
                            <textarea id="msg-${t.id}" placeholder="Write a response…" rows="2" required></textarea>
                        </div>
                        <div style="display:flex;align-items:flex-end">
                            <button type="submit" class="btn btn-sm btn-respond">Send</button>
                        </div>
                    </form>` : ''}
                </div>
            </div>
        `).join('');

    } catch (err) {
        list.innerHTML = `<div class="state-msg error"><div class="icon">⚠️</div><p>Failed to load tickets: ${escHtml(err.message)}</p></div>`;
        showToast('Could not load tickets', 'error');
    }
}

function renderStatsBar(tickets) {
    const bar = document.getElementById('statsBar');
    const c = { OPEN: 0, IN_PROGRESS: 0, RESOLVED: 0 };
    tickets.forEach(t => { c[t.status] = (c[t.status] ?? 0) + 1; });
    bar.innerHTML = `
        <div class="stat-chip stat-open">
            <div class="num">${c.OPEN}</div><div class="lbl">Open</div>
        </div>
        <div class="stat-chip stat-in_progress">
            <div class="num">${c.IN_PROGRESS}</div><div class="lbl">In Progress</div>
        </div>
        <div class="stat-chip stat-resolved">
            <div class="num">${c.RESOLVED}</div><div class="lbl">Resolved</div>
        </div>
        <div class="stat-chip">
            <div class="num" style="color:var(--text)">${tickets.length}</div><div class="lbl">Total</div>
        </div>`;
}

// ─── Expand / collapse ticket detail ─────────────────────────────────────────
const openDetails = new Set();

async function toggleDetail(id) {
    const detail = document.getElementById(`detail-${id}`);
    if (!detail) return;

    if (openDetails.has(id)) {
        detail.classList.remove('open');
        openDetails.delete(id);
        return;
    }

    detail.classList.add('open');
    openDetails.add(id);
    await loadResponses(id);
}

async function loadResponses(id) {
    const container = document.getElementById(`responses-${id}`);
    if (!container) return;

    try {
        const res = await fetch(`/api/tickets/${id}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        if (!data.responses || data.responses.length === 0) {
            container.innerHTML = `<p class="no-responses">No responses yet.</p>`;
            return;
        }

        container.innerHTML = data.responses.map(r => `
            <div class="response-item">
                <div class="response-avatar">${escHtml(r.agent).slice(0,2).toUpperCase()}</div>
                <div class="response-bubble">
                    <div class="response-meta">
                        <span class="response-agent">${escHtml(r.agent)}</span>
                        <span class="response-time">${fmtDate(r.created_at)}</span>
                    </div>
                    <p class="response-msg">${escHtml(r.message)}</p>
                </div>
            </div>`).join('');
    } catch (err) {
        if (container) container.innerHTML = `<p class="no-responses" style="color:var(--red)">Failed to load history.</p>`;
    }
}

// ─── Submit agent response ────────────────────────────────────────────────────
async function submitResponse(e, id) {
    e.preventDefault();
    const agent   = document.getElementById(`agent-${id}`).value.trim();
    const message = document.getElementById(`msg-${id}`).value.trim();
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true; btn.textContent = '…';

    try {
        const res = await fetch(`/api/support/${id}/respond`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ agent, message }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        e.target.reset();
        showToast('Response sent ✅', 'success');
        await loadResponses(id);
    } catch (err) {
        showToast('Failed to send response: ' + err.message, 'error');
    } finally {
        btn.disabled = false; btn.textContent = 'Send';
    }
}

// ─── Resolve ticket ───────────────────────────────────────────────────────────
window.resolveTicket = async (id) => {
    const btn = document.getElementById(`resolve-btn-${id}`);
    if (btn) { btn.disabled = true; btn.textContent = 'Resolving…'; }
    try {
        const res = await fetch(`/api/support/${id}/resolve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ resolution_notes: 'Resolved via web UI' }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        showToast(`Ticket #${id} resolved ✅`, 'success');
        openDetails.delete(id);
        loadTickets();
    } catch (err) {
        showToast('Error: ' + err.message, 'error');
        if (btn) { btn.disabled = false; btn.textContent = '✓ Resolve'; }
    }
};

// ═══════════════════════════════════════════════════════════════
// New Ticket tab
// ═══════════════════════════════════════════════════════════════

document.getElementById('ticketForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title       = document.getElementById('newTitle').value.trim();
    const description = document.getElementById('newDescription').value.trim();
    const priority    = document.getElementById('newPriority').value;
    const btn = document.getElementById('submitBtn');
    const lbl = document.getElementById('submitLabel');
    const ico = document.getElementById('submitIcon');

    btn.disabled = true; lbl.textContent = 'Submitting…'; ico.textContent = '⏳';

    try {
        const res = await fetch('/api/tickets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, description, priority }),
        });
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        document.getElementById('ticketForm').reset();
        showToast('Ticket submitted! 🎉', 'success');
        switchTab('tickets');
    } catch (err) {
        showToast('Error: ' + err.message, 'error');
    } finally {
        btn.disabled = false; lbl.textContent = 'Submit Ticket'; ico.textContent = '🚀';
    }
});

// ═══════════════════════════════════════════════════════════════
// Reports tab
// ═══════════════════════════════════════════════════════════════

async function loadReports() {
    const content = document.getElementById('reportsContent');
    content.innerHTML = skeleton();

    try {
        const [summaryRes, ticketsRes] = await Promise.all([
            fetch('/api/reports/summary'),
            fetch('/api/reports/tickets'),
        ]);
        if (!summaryRes.ok || !ticketsRes.ok) throw new Error('Failed to load report data');
        const summary = await summaryRes.json();
        const tickets = await ticketsRes.json();

        const total = summary.total_tickets || 1; // avoid div/0
        const priTotal = Math.max(
            Object.values(summary.by_priority).reduce((a,b) => a+b, 0), 1
        );

        const priBarColor = { LOW: '#64748b', MEDIUM: '#3b82f6', HIGH: '#f97316', URGENT: '#ef4444' };

        content.innerHTML = `
            <!-- KPIs -->
            <div class="report-summary">
                <div class="report-kpi">
                    <div class="kpi-val">${summary.total_tickets}</div>
                    <div class="kpi-lbl">Total Tickets</div>
                </div>
                <div class="report-kpi">
                    <div class="kpi-val" style="color:var(--yellow)">${summary.by_status.OPEN}</div>
                    <div class="kpi-lbl">Open</div>
                </div>
                <div class="report-kpi">
                    <div class="kpi-val" style="color:var(--blue)">${summary.by_status.IN_PROGRESS}</div>
                    <div class="kpi-lbl">In Progress</div>
                </div>
                <div class="report-kpi">
                    <div class="kpi-val" style="color:var(--green)">${summary.by_status.RESOLVED}</div>
                    <div class="kpi-lbl">Resolved</div>
                </div>
                <div class="report-kpi">
                    <div class="kpi-val" style="color:var(--primary-h)">${summary.avg_resolution_hours}h</div>
                    <div class="kpi-lbl">Avg Resolution</div>
                </div>
                <div class="report-kpi">
                    <div class="kpi-val" style="color:#a855f7">${summary.total_responses}</div>
                    <div class="kpi-lbl">Responses</div>
                </div>
            </div>

            <!-- Priority breakdown -->
            <div class="card pri-breakdown" style="margin-bottom:20px">
                <p class="section-label">Priority Breakdown</p>
                ${['URGENT','HIGH','MEDIUM','LOW'].map(p => `
                    <div class="pri-bar-row">
                        <span class="pri-bar-label">${p[0]+p.slice(1).toLowerCase()}</span>
                        <div class="pri-bar-track">
                            <div class="pri-bar-fill" style="width:${Math.round((summary.by_priority[p]||0)/priTotal*100)}%;background:${priBarColor[p]}"></div>
                        </div>
                        <span class="pri-bar-count">${summary.by_priority[p]||0}</span>
                    </div>`).join('')}
            </div>

            <!-- Per-ticket performance table -->
            <div class="card" style="padding:0;overflow:hidden">
                <div style="padding:18px 22px 12px"><p class="section-label">Per-Ticket Performance</p></div>
                <div class="report-table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Title</th>
                                <th>Status</th>
                                <th>Priority</th>
                                <th>Agent</th>
                                <th>Age (hrs)</th>
                                <th>Responses</th>
                                <th>Created</th>
                                <th>Resolved</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tickets.length === 0
                                ? `<tr><td colspan="9" style="text-align:center;color:var(--muted);padding:28px">No data yet</td></tr>`
                                : tickets.map(t => `
                                    <tr>
                                        <td style="color:var(--primary-h);font-weight:600">#${t.id}</td>
                                        <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(t.title)}</td>
                                        <td>${statusBadge(t.status)}</td>
                                        <td>${priorityBadge(t.priority||'MEDIUM')}</td>
                                        <td style="color:var(--muted)">${escHtml(t.support_agent||'—')}</td>
                                        <td style="color:var(--muted)">${t.age_hours ?? '—'}</td>
                                        <td style="color:var(--muted);text-align:center">${t.response_count}</td>
                                        <td style="color:var(--muted);white-space:nowrap">${fmtDate(t.created_at)}</td>
                                        <td style="color:var(--muted);white-space:nowrap">${fmtDate(t.resolved_at)}</td>
                                    </tr>`).join('')}
                        </tbody>
                    </table>
                </div>
            </div>`;

    } catch (err) {
        content.innerHTML = `<div class="state-msg error"><div class="icon">⚠️</div><p>Failed to load reports: ${escHtml(err.message)}</p></div>`;
        showToast('Could not load reports', 'error');
    }
}

// ═══════════════════════════════════════════════════════════════
// Init
// ═══════════════════════════════════════════════════════════════
loadTickets();
