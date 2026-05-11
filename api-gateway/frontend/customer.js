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

// ─── Status → stepper state ────────────────────────────────────────────────────
function stepperHtml(status){
    const steps = [
        { key:'OPEN',        label:'Submitted' },
        { key:'IN_PROGRESS', label:'In Progress' },
        { key:'RESOLVED',    label:'Resolved' },
    ];
    const idx = steps.findIndex(s=>s.key===status);

    let dots=''; let labels='';
    steps.forEach((s,i)=>{
        const cls = i<idx?'step-done': i===idx?'step-active':'';
        const icon = i<idx?'✓': i===idx?(status==='RESOLVED'?'✓':'●'):'○';
        dots += `<div class="step-dot ${cls}">${icon}</div>`;
        if(i<steps.length-1) dots += `<div class="step-line ${i<idx?'step-done':i===idx?'step-active':''}"></div>`;
        labels += `<span class="step-lbl ${i<idx?'done':i===idx?'active':''}">${s.label}</span>`;
    });
    return `<div class="stepper">${dots}</div><div class="step-labels">${labels}</div>`;
}

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

// ─── Session ────────────────────────────────────────────────────────────────────
let currentUser = localStorage.getItem('sh_customer_name') || '';

function startSession(){
    const val = document.getElementById('nameInput').value.trim();
    if(!val){ document.getElementById('nameInput').focus(); return; }
    currentUser = val;
    localStorage.setItem('sh_customer_name', val);
    showMainView();
}

function showMainView(){
    document.getElementById('welcomeView').style.display='none';
    document.getElementById('mainView').style.display='block';
    const av=currentUser.slice(0,2).toUpperCase();
    document.getElementById('userAvatar').textContent=av;
    document.getElementById('userName').textContent=`Hello, ${currentUser}!`;
    loadMyTickets();
}

function switchUser(){
    localStorage.removeItem('sh_customer_name');
    currentUser='';
    document.getElementById('mainView').style.display='none';
    document.getElementById('welcomeView').style.display='block';
    document.getElementById('nameInput').value='';
}

// ─── Load tickets ───────────────────────────────────────────────────────────────
const openDetails=new Set();

async function loadMyTickets(){
    const list=document.getElementById('myTickets');
    list.innerHTML=`<div class="skeleton"><div class="skel-card"><div class="sk sk-t"></div><div class="sk sk-l"></div><div class="sk sk-s"></div></div></div>`;
    try{
        const res=await fetch(`/api/tickets/mine?name=${encodeURIComponent(currentUser)}`);
        if(!res.ok) throw new Error(`HTTP ${res.status}`);
        const tickets=await res.json();
        if(tickets.length===0){
            list.innerHTML=`<div class="state-msg"><div class="icon">📭</div><p>No tickets yet — submit your first one above!</p></div>`;
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
                    <p class="ticket-desc">${esc(t.description)}</p>
                    <div class="progress-wrap">
                        ${stepperHtml(t.status)}
                    </div>
                    <div class="ticket-footer">
                        <span class="ticket-meta">🕐 ${fmtDate(t.created_at)}</span>
                        ${t.assigned_agent?`<span class="ticket-meta">👤 ${esc(t.assigned_agent)}</span>`:''}
                        <span class="ticket-meta" style="color:var(--ph)">💬 View responses ▾</span>
                    </div>
                </div>
                <div class="ticket-detail" id="detail-${t.id}">
                    <div id="resp-container-${t.id}"><p class="no-resp">Loading…</p></div>
                </div>
            </div>`).join('');
    }catch(err){
        list.innerHTML=`<div class="state-msg error"><div class="icon">⚠️</div><p>Failed to load tickets: ${esc(err.message)}</p></div>`;
        toast('Could not load tickets','error');
    }
}

async function toggleDetail(id){
    const detail=document.getElementById(`detail-${id}`);
    if(!detail) return;
    if(openDetails.has(id)){ detail.classList.remove('open'); openDetails.delete(id); return; }
    detail.classList.add('open'); openDetails.add(id);
    await loadResponses(id);
}

async function loadResponses(id){
    const c=document.getElementById(`resp-container-${id}`); if(!c) return;
    try{
        const res=await fetch(`/api/tickets/${id}`);
        if(!res.ok) throw new Error(`HTTP ${res.status}`);
        const data=await res.json();

        let html='';
        if(data.assigned_agent){
            html+=`<p class="detail-title">👤 Assigned Agent</p>
            <div class="agent-card">
                <div class="agent-av">${esc(data.assigned_agent).slice(0,2).toUpperCase()}</div>
                <div><div class="agent-name">${esc(data.assigned_agent)}</div><div class="agent-role">Support Agent</div></div>
            </div>`;
        }
        html+=`<p class="detail-title">💬 Agent Responses</p>`;
        if(!data.responses||data.responses.length===0){
            html+=`<p class="no-resp">No responses yet — our team will reply shortly.</p>`;
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
        c.innerHTML=html;
    }catch(e){
        if(c) c.innerHTML=`<p class="no-resp" style="color:var(--red)">Failed to load responses.</p>`;
    }
}

// ─── Submit ticket ───────────────────────────────────────────────────────────────
document.getElementById('ticketForm').addEventListener('submit',async e=>{
    e.preventDefault();
    const title=document.getElementById('ticketTitle').value.trim();
    const email=document.getElementById('ticketEmail').value.trim();
    const description=document.getElementById('ticketDesc').value.trim();
    const btn=document.getElementById('submitBtn');
    const lbl=document.getElementById('submitLabel');
    const ico=document.getElementById('submitIcon');
    btn.disabled=true; lbl.textContent='Submitting…'; ico.textContent='⏳';
    try{
        const res=await fetch('/api/tickets',{
            method:'POST', headers:{'Content-Type':'application/json'},
            body:JSON.stringify({title,description,submitted_by:currentUser,email})
        });
        if(!res.ok){ const b=await res.json().catch(()=>({})); throw new Error(b.error??`HTTP ${res.status}`); }
        document.getElementById('ticketForm').reset();
        toast('Ticket submitted! 🎉 Our team will review it shortly.','success');
        loadMyTickets();
    }catch(err){
        toast('Error: '+err.message,'error');
    }finally{
        btn.disabled=false; lbl.textContent='Submit Ticket'; ico.textContent='🚀';
    }
});

// ─── Auto-refresh every 30s to show agent updates ────────────────────────────────
setInterval(()=>{ if(currentUser) loadMyTickets(); }, 30000);

// ─── Init ────────────────────────────────────────────────────────────────────────
document.getElementById('nameInput').addEventListener('keydown',e=>{ if(e.key==='Enter') startSession(); });
if(currentUser) showMainView();
