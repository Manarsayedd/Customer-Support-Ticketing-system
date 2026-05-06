// ─── Utilities ────────────────────────────────────────────────────────────────
function esc(s){ return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function fmtDate(iso){ return iso ? new Date(iso).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'}) : '—'; }

let toastT;
function toast(msg, type='success'){
    const el=document.getElementById('toast');
    document.getElementById('toastMsg').textContent=msg;
    document.getElementById('toastIcon').textContent=type==='success'?'✅':'❌';
    el.className=`toast-${type}`; clearTimeout(toastT);
    el.classList.add('show'); toastT=setTimeout(()=>el.classList.remove('show'),3500);
}

// ─── Badges ────────────────────────────────────────────────────────────────────
function statusBadge(s){
    const map={OPEN:'badge-open',IN_PROGRESS:'badge-in_progress',RESOLVED:'badge-resolved'};
    const lbl=s==='IN_PROGRESS'?'In Progress':(s[0]+s.slice(1).toLowerCase());
    return `<span class="badge ${map[s]??'badge-open'}">${lbl}</span>`;
}
function prioBadge(p){
    if(!p) return '';
    const map={LOW:'badge-low',MEDIUM:'badge-medium',HIGH:'badge-high',URGENT:'badge-urgent'};
    const icons={LOW:'🔵',MEDIUM:'🟡',HIGH:'🟠',URGENT:'🔴'};
    return `<span class="badge ${map[p]??'badge-medium'}">${icons[p]??''} ${p[0]+p.slice(1).toLowerCase()}</span>`;
}

// ─── Tabs ──────────────────────────────────────────────────────────────────────
function switchTab(tab){
    ['all','reports'].forEach(t=>{
        document.getElementById(`tab-${t}`).classList.toggle('active', t===tab);
        document.getElementById(`pane-${t}`).classList.toggle('active', t===tab);
    });
    if(tab==='all') loadAllTickets();
    if(tab==='reports') loadReports();
}

// ─── Load All Tickets ─────────────────────────────────────────────────────────
const openDetails=new Set();

async function loadAllTickets(){
    const list=document.getElementById('ticketsList');
    list.innerHTML=`<div class="skeleton"><div class="skel-card"><div class="sk sk-t"></div><div class="sk sk-l"></div><div class="sk sk-s"></div></div><div class="skel-card"><div class="sk sk-t"></div><div class="sk sk-l"></div><div class="sk sk-s"></div></div></div>`;
    try{
        const res=await fetch('/api/tickets');
        if(!res.ok) throw new Error(`HTTP ${res.status}`);
        const tickets=await res.json();
        
        renderStatsBar(tickets);
        
        if(tickets.length===0){
            list.innerHTML=`<div class="state-msg"><div class="icon">📭</div><p>No tickets in the system yet.</p></div>`;
            return;
        }
        
        list.innerHTML=tickets.map((t,i)=>`
            <div class="ticket-card" style="animation-delay:${i*0.04}s" id="tc-${t.id}">
                <div class="ticket-main" onclick="toggleDetail(${t.id})">
                    <div class="ticket-top">
                        <div class="ticket-id-row">
                            <span class="ticket-num">#${t.id}</span>
                            <span class="ticket-title-text">${esc(t.title)}</span>
                        </div>
                        <div class="ticket-badges">
                            ${statusBadge(t.status)}
                            ${prioBadge(t.priority)}
                        </div>
                    </div>
                    <div class="ticket-submitter">Submitted by: <strong>${esc(t.submitted_by)}</strong></div>
                    <p class="ticket-desc">${esc(t.description)}</p>
                    <div class="ticket-footer">
                        <span class="ticket-meta">🕐 ${fmtDate(t.created_at)}</span>
                        ${t.assigned_agent?`<span class="ticket-meta">👤 ${esc(t.assigned_agent)}</span>`:''}
                        <div class="ticket-actions" onclick="event.stopPropagation()">
                            ${t.status!=='RESOLVED' ? `<button class="btn btn-sm btn-resolve" onclick="resolveTicket(${t.id})">✓ Resolve</button>` : ''}
                            <button class="btn btn-sm btn-respond" onclick="toggleDetail(${t.id})">⚙️ Manage</button>
                        </div>
                    </div>
                </div>
                <div class="ticket-detail" id="detail-${t.id}">
                    <div id="manage-container-${t.id}"><p class="no-resp">Loading…</p></div>
                </div>
            </div>`).join('');
    }catch(err){
        list.innerHTML=`<div class="state-msg error"><div class="icon">⚠️</div><p>Failed to load tickets: ${esc(err.message)}</p></div>`;
        toast('Could not load tickets','error');
    }
}

function renderStatsBar(tickets){
    const bar = document.getElementById('statsBar');
    const c = { OPEN:0, IN_PROGRESS:0, RESOLVED:0 };
    tickets.forEach(t=>{ c[t.status]=(c[t.status]??0)+1; });
    bar.innerHTML = `
        <div class="stat-chip stat-open"><div class="num">${c.OPEN}</div><div class="lbl">Open</div></div>
        <div class="stat-chip stat-ip"><div class="num">${c.IN_PROGRESS}</div><div class="lbl">In Progress</div></div>
        <div class="stat-chip stat-res"><div class="num">${c.RESOLVED}</div><div class="lbl">Resolved</div></div>
        <div class="stat-chip"><div class="num" style="color:var(--text)">${tickets.length}</div><div class="lbl">Total</div></div>`;
}

async function toggleDetail(id){
    const detail=document.getElementById(`detail-${id}`);
    if(!detail) return;
    if(openDetails.has(id)){ detail.classList.remove('open'); openDetails.delete(id); return; }
    detail.classList.add('open'); openDetails.add(id);
    await loadManageView(id);
}

async function loadManageView(id){
    const c=document.getElementById(`manage-container-${id}`); if(!c) return;
    try{
        const res=await fetch(`/api/tickets/${id}`);
        if(!res.ok) throw new Error(`HTTP ${res.status}`);
        const data=await res.json();
        
        let html=`
            <div class="divider">Manage Ticket</div>
            <form class="assign-form" onsubmit="updateTicket(event, ${id})">
                <div class="form-group">
                    <label>Priority</label>
                    <select id="prio-${id}">
                        <option value="LOW" ${data.priority==='LOW'?'selected':''}>Low</option>
                        <option value="MEDIUM" ${data.priority==='MEDIUM'?'selected':''}>Medium</option>
                        <option value="HIGH" ${data.priority==='HIGH'?'selected':''}>High</option>
                        <option value="URGENT" ${data.priority==='URGENT'?'selected':''}>Urgent</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Assigned Agent</label>
                    <input type="text" id="agent-${id}" placeholder="Agent name…" value="${esc(data.assigned_agent||'')}" autocomplete="off">
                </div>
                <div style="padding-bottom:1px">
                    <button type="submit" class="btn btn-save">💾 Save</button>
                </div>
            </form>
            
            <p class="detail-title" style="margin-top:20px">💬 Interaction History</p>
        `;
        
        if(!data.responses||data.responses.length===0){
            html+=`<p class="no-resp">No responses yet.</p>`;
        } else {
            html+=data.responses.map(r=>`
                <div class="resp-item">
                    <div class="resp-av">${esc(r.agent).slice(0,2).toUpperCase()}</div>
                    <div class="resp-bubble">
                        <div class="resp-meta">
                            <span class="resp-agent">${esc(r.agent)}</span>
                            <span class="resp-time">${fmtDate(r.created_at)}</span>
                        </div>
                        <p class="resp-msg">${esc(r.message)}</p>
                    </div>
                </div>`).join('');
        }
        
        if(data.status!=='RESOLVED'){
            html+=`
                <div class="divider">Add Response</div>
                <form class="respond-form" onsubmit="submitResponse(event, ${id})">
                    <div class="form-group">
                        <input id="resp-agent-${id}" type="text" placeholder="Your name" value="${esc(data.assigned_agent||'')}" required autocomplete="off">
                    </div>
                    <div class="form-group">
                        <textarea id="resp-msg-${id}" placeholder="Write a response to the customer…" rows="2" required></textarea>
                    </div>
                    <div style="display:flex;align-items:flex-end;padding-bottom:1px">
                        <button type="submit" class="btn btn-respond">Send</button>
                    </div>
                </form>
            `;
        }
        c.innerHTML=html;
    }catch(e){
        if(c) c.innerHTML=`<p class="no-resp" style="color:var(--red)">Failed to load ticket details.</p>`;
    }
}

async function updateTicket(e, id){
    e.preventDefault();
    const btn=e.target.querySelector('button[type=submit]');
    btn.disabled=true; btn.textContent='…';
    const priority = document.getElementById(`prio-${id}`).value;
    const assigned_agent = document.getElementById(`agent-${id}`).value.trim();
    
    try{
        let res=await fetch(`/api/tickets/${id}`, {
            method:'PUT', headers:{'Content-Type':'application/json'},
            body:JSON.stringify({ priority, assigned_agent })
        });
        if(!res.ok) throw new Error('Update failed');
        
        if(assigned_agent){
            await fetch(`/api/support/${id}/assign`, {
                method:'POST', headers:{'Content-Type':'application/json'},
                body:JSON.stringify({ support_agent: assigned_agent })
            });
        }
        
        toast('Ticket updated successfully', 'success');
        loadAllTickets();
    }catch(err){
        toast('Failed to update ticket: '+err.message, 'error');
        btn.disabled=false; btn.textContent='💾 Save';
    }
}

async function submitResponse(e, id){
    e.preventDefault();
    const btn=e.target.querySelector('button[type=submit]');
    btn.disabled=true; btn.textContent='…';
    const agent = document.getElementById(`resp-agent-${id}`).value.trim();
    const message = document.getElementById(`resp-msg-${id}`).value.trim();
    try{
        const res=await fetch(`/api/support/${id}/respond`, {
            method:'POST', headers:{'Content-Type':'application/json'},
            body:JSON.stringify({ agent, message })
        });
        if(!res.ok) throw new Error('Response failed');
        toast('Response sent', 'success');
        await loadManageView(id);
    }catch(err){
        toast('Error: '+err.message, 'error');
        btn.disabled=false; btn.textContent='Send';
    }
}

window.resolveTicket = async (id) => {
    try{
        const res=await fetch(`/api/support/${id}/resolve`, {
            method:'POST', headers:{'Content-Type':'application/json'},
            body:JSON.stringify({ resolution_notes: 'Resolved by agent' })
        });
        if(!res.ok) throw new Error('Resolve failed');
        toast(`Ticket #${id} resolved`, 'success');
        openDetails.delete(id);
        loadAllTickets();
    }catch(err){
        toast('Error: '+err.message, 'error');
    }
};

// ─── Reports ──────────────────────────────────────────────────────────────────
async function loadReports(){
    const content = document.getElementById('reportsContent');
    content.innerHTML=`<div class="skeleton"><div class="skel-card"><div class="sk sk-t"></div><div class="sk sk-l"></div><div class="sk sk-s"></div></div></div>`;
    try{
        const [sumRes, tkRes] = await Promise.all([ fetch('/api/reports/summary'), fetch('/api/reports/tickets') ]);
        if(!sumRes.ok || !tkRes.ok) throw new Error('Failed to load reports');
        const summary = await sumRes.json();
        const tickets = await tkRes.json();
        
        const total=summary.total_tickets||1;
        const priTotal=Math.max(Object.values(summary.by_priority).reduce((a,b)=>a+b,0),1);
        const priColor={LOW:'#64748b',MEDIUM:'#3b82f6',HIGH:'#f97316',URGENT:'#ef4444'};
        
        content.innerHTML=`
            <div class="report-kpis">
                <div class="kpi"><div class="kval">${summary.total_tickets}</div><div class="klbl">Total Tickets</div></div>
                <div class="kpi"><div class="kval" style="color:var(--yellow)">${summary.by_status.OPEN}</div><div class="klbl">Open</div></div>
                <div class="kpi"><div class="kval" style="color:var(--blue)">${summary.by_status.IN_PROGRESS}</div><div class="klbl">In Progress</div></div>
                <div class="kpi"><div class="kval" style="color:var(--green)">${summary.by_status.RESOLVED}</div><div class="klbl">Resolved</div></div>
                <div class="kpi"><div class="kval" style="color:var(--primary)">${summary.avg_resolution_hours}h</div><div class="klbl">Avg Resol.</div></div>
            </div>
            
            <div class="card pri-rows">
                <p class="section-label">Priority Breakdown</p>
                ${['URGENT','HIGH','MEDIUM','LOW'].map(p=>`
                    <div class="pri-row">
                        <div class="pri-lbl">${p[0]+p.slice(1).toLowerCase()}</div>
                        <div class="pri-track">
                            <div class="pri-fill" style="width:${Math.round((summary.by_priority[p]||0)/priTotal*100)}%;background:${priColor[p]}"></div>
                        </div>
                        <div class="pri-count">${summary.by_priority[p]||0}</div>
                    </div>`).join('')}
            </div>
            
            <div class="card" style="padding:0;overflow:hidden">
                <div style="padding:18px 22px 12px"><p class="section-label">Per-Ticket Performance</p></div>
                <div class="tbl-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Title</th>
                                <th>Customer</th>
                                <th>Status</th>
                                <th>Priority</th>
                                <th>Agent</th>
                                <th>Age (h)</th>
                                <th>Created</th>
                                <th>Resolved</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tickets.length===0?`<tr><td colspan="9" style="text-align:center;color:var(--muted);padding:20px">No data</td></tr>`:
                            tickets.map(t=>`
                                <tr>
                                    <td style="color:var(--ph);font-weight:600">#${t.id}</td>
                                    <td style="max-width:140px;overflow:hidden;text-overflow:ellipsis">${esc(t.title)}</td>
                                    <td>${esc(t.submitted_by)}</td>
                                    <td>${statusBadge(t.status)}</td>
                                    <td>${prioBadge(t.priority||'MEDIUM')}</td>
                                    <td>${esc(t.support_agent||'—')}</td>
                                    <td style="text-align:center">${t.age_hours??'—'}</td>
                                    <td style="white-space:nowrap">${fmtDate(t.created_at)}</td>
                                    <td style="white-space:nowrap">${fmtDate(t.resolved_at)}</td>
                                </tr>`).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }catch(err){
        content.innerHTML=`<div class="state-msg error"><div class="icon">⚠️</div><p>Failed to load reports: ${esc(err.message)}</p></div>`;
        toast('Could not load reports','error');
    }
}

// ─── Init ──────────────────────────────────────────────────────────────────────
loadAllTickets();
