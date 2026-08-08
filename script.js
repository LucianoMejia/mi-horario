const DAYS = ["Lun","Mar","Mié","Jue","Vie","Sáb"];
const COLORS = [
  {bg:"#E7EAF5", border:"#3B4B8C", text:"#2B3266", dbg:"#262B45", dtext:"#C7CDEE"},
  {bg:"#E3F1EA", border:"#2E7D5B", text:"#1E5A40", dbg:"#1C3229", dtext:"#B7E4CC"},
  {bg:"#F5E4DC", border:"#C6512E", text:"#8C3A20", dbg:"#3A2620", dtext:"#F2C3AC"},
  {bg:"#F5E9F0", border:"#A34D74", text:"#7A3A56", dbg:"#33222C", dtext:"#EEBBD1"},
  {bg:"#FBF0DA", border:"#B37B1E", text:"#7A5514", dbg:"#362D18", dtext:"#F0D298"},
  {bg:"#EDEAF7", border:"#6A4FA0", text:"#4C3877", dbg:"#2A2438", dtext:"#D6C7F0"},
  {bg:"#E4EFF2", border:"#2E7C8C", text:"#1F5866", dbg:"#1D2F33", dtext:"#AEDDE6"}
];
const ACCENTS = ["#3B4B8C","#2E7D5B","#C6512E","#A34D74","#B37B1E","#6A4FA0","#2E7C8C"];
const STORAGE_KEY = "horario_planner_state_v1";

function showFatalError(msg){
  const b = document.getElementById('errBanner');
  if(!b) return;
  b.style.display = 'block';
  b.textContent = '⚠ ' + msg;
}
window.addEventListener('error', (e)=>{
  showFatalError('Ocurrió un error: ' + (e.message || 'desconocido'));
});
window.addEventListener('unhandledrejection', (e)=>{
  showFatalError('Ocurrió un error: ' + (e.reason && e.reason.message ? e.reason.message : e.reason));
});

function showToast(msg){
  const old = document.querySelector('.toast');
  if(old) old.remove();
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(()=> t.remove(), 3200);
}

function showConfirmModal({title, message, confirmText, danger, onConfirm}){
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box">
      <h4>${title}</h4>
      <p>${message}</p>
      <div class="modal-actions">
        <button class="ghost" data-act="cancel">Cancelar</button>
        <button class="primary" data-act="ok" style="${danger?'background:#C6512E;':''}">${confirmText}</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  function close(){ overlay.remove(); }
  overlay.addEventListener('click', (e)=>{ if(e.target===overlay) close(); });
  overlay.querySelector('[data-act="cancel"]').addEventListener('click', close);
  overlay.querySelector('[data-act="ok"]').addEventListener('click', ()=>{ close(); onConfirm(); });
}

function showPromptModal({title, message, initialValue, confirmText, onConfirm}){
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box">
      <h4>${title}</h4>
      <p>${message}</p>
      <input type="text" id="modalInput" value="${(initialValue||'').replace(/"/g,'&quot;')}">
      <div class="modal-actions">
        <button class="ghost" data-act="cancel">Cancelar</button>
        <button class="primary" data-act="ok">${confirmText}</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  const input = overlay.querySelector('#modalInput');
  setTimeout(()=>{ input.focus(); input.select(); }, 30);
  function close(){ overlay.remove(); }
  function confirmIt(){
    const val = input.value.trim();
    close();
    if(val) onConfirm(val);
  }
  overlay.addEventListener('click', (e)=>{ if(e.target===overlay) close(); });
  input.addEventListener('keydown', (e)=>{ if(e.key==='Enter') confirmIt(); if(e.key==='Escape') close(); });
  overlay.querySelector('[data-act="cancel"]').addEventListener('click', close);
  overlay.querySelector('[data-act="ok"]').addEventListener('click', confirmIt);
}

function encodePayload(obj){
  const compact = JSON.stringify({
    n: obj.name || '',
    r: (obj.rows || []).map(r => [
      r.course || '',
      r.group || '',
      r.day || '',
      r.start || '',
      r.end || '',
      r.room || '',
      r.professor || '',
      r.enabled === false ? 0 : 1
    ].join(',')),
    c: Object.entries(obj.colorOverrides || {}).filter(([, value]) => value).map(([key, value]) => `${key},${value}`),
    s: Object.entries(obj.s || obj.selection || {}).map(([course, choice]) => `${course},${choice}`),
    o: (typeof obj.o === 'number' ? obj.o : (typeof obj.opt === 'number' ? obj.opt : 0))
  });
  const encoded = btoa(unescape(encodeURIComponent(compact)));
  return encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
function decodePayloadCode(code){
  if(typeof code !== 'string' || !code) return null;
  try{
    const normalized = code.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
    const decoded = decodeURIComponent(escape(atob(padded)));
    const parsed = JSON.parse(decoded);
    if(parsed && Array.isArray(parsed.r)){
      return {
        name: parsed.n || '',
        rows: parsed.r.map(rowStr => {
          const values = rowStr.split(',');
          return {
            course: values[0] || '',
            group: values[1] || '',
            day: values[2] || '',
            start: values[3] || '',
            end: values[4] || '',
            room: values[5] || '',
            professor: values[6] || '',
            enabled: values[7] !== '0'
          };
        }),
        colorOverrides: (parsed.c || []).reduce((acc, entry) => {
          const [key, value] = entry.split(',');
          if(key) acc[key] = value;
          return acc;
        }, {}),
        selection: (parsed.s || []).reduce((acc, entry) => {
          const idx = entry.indexOf(',');
          if(idx === -1) return acc;
          const course = entry.slice(0, idx);
          const choice = entry.slice(idx + 1);
          if(course) acc[course] = choice;
          return acc;
        }, {}),
        opt: (typeof parsed.o === 'number') ? parsed.o : 0
      };
    }
  }catch(e){}

  try{
    return JSON.parse(decodeURIComponent(code));
  }catch(e){
    try{ return JSON.parse(decodeURIComponent(escape(atob(code)))); }catch(err){ return null; }
  }
}
function getShareUrl(code){
  const base = window.location.href.split('#')[0].split('?')[0];
  return `${base}#share=${code}`;
}

function copyTextToClipboard(text){
  let copied = false;
  try{
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(text);
      copied = true;
    }
  }catch(e){}
  if(!copied){
    try{ copied = document.execCommand('copy'); }catch(e){}
  }
  return copied;
}

function showWebShareModal(){
  const shareUrl = window.location.href.split('#')[0].split('?')[0];
  const shareText = 'Mira Mi Horario, el planificador para armar tu horario ideal sin cruces.';
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box" style="max-width:460px;">
      <h4>Compartir la web</h4>
      <p>Comparte la página de Mi Horario para que otros la prueben y la descubran.</p>
      <label style="display:block; font-family:'IBM Plex Mono',monospace; font-size:10px; text-transform:uppercase; letter-spacing:.05em; color:var(--ink-soft); margin-bottom:6px;">Enlace</label>
      <textarea id="webShareLink" readonly style="width:100%; height:70px; font-family:'IBM Plex Mono',monospace; font-size:11px; padding:8px; border:1px solid var(--rule); border-radius:8px; background:var(--paper); color:var(--ink); resize:vertical; margin-bottom:14px; box-sizing:border-box;">${shareUrl}</textarea>
      <div class="modal-actions" style="justify-content:center; flex-wrap:wrap; gap:10px;">
        <div style="display:flex; gap:8px; flex-wrap:wrap; justify-content:center;">
          <button class="ghost" data-act="wa" title="WhatsApp" aria-label="Compartir por WhatsApp">
            <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16" style="display:block;"><path d="M12.04 2C6.59 2 2.16 6.43 2.16 11.88c0 2.1.56 4.12 1.6 5.87L2 22l4.43-1.16a9.86 9.86 0 0 0 5.6 1.6c5.45 0 9.88-4.43 9.88-9.88S17.49 2 12.04 2Zm0 17.89a8.03 8.03 0 0 1-4.08-1.12l-.29-.17-2.63.69.7-2.56-.19-.28A8.03 8.03 0 1 1 12.04 19.89Zm4.47-6.01c-.24-.12-1.43-.7-1.65-.78-.22-.08-.38-.12-.54.12-.16.24-.62.78-.76.94-.14.16-.28.18-.52.06-.24-.12-1.01-.37-1.93-1.19-.71-.63-1.19-1.41-1.33-1.65-.14-.24-.01-.37.11-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.78-.19-.46-.39-.4-.54-.41-.14-.01-.3-.01-.46-.01-.16 0-.42.06-.64.3-.22.24-.85.83-.85 2.02 0 1.19.87 2.35 1 2.51.13.16 1.72 2.63 4.17 3.68.58.25 1.04.4 1.4.51.58.18 1.11.16 1.53.1.47-.07 1.43-.58 1.63-1.14.2-.56.2-1.04.14-1.14-.06-.1-.22-.16-.46-.28Z"/></svg>
          </button>
          <button class="ghost" data-act="tg" title="Telegram" aria-label="Compartir por Telegram">
            <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16" style="display:block;"><path d="M9.78 14.56 9.42 19a.78.78 0 0 0 1.24.67l2.76-2.57 5.74 4.23a1.4 1.4 0 0 0 2.2-.98V4.47a1.4 1.4 0 0 0-2.2-.98L3.07 10.81a1.4 1.4 0 0 0 .16 2.52l6.55 1.23Zm.84-2.53 8.1-5.11-5.03 6.69-1.66-2.48a.58.58 0 0 0-.98-.14l-.43.44Z"/></svg>
          </button>
          <button class="ghost" data-act="fb" title="Facebook" aria-label="Compartir en Facebook">
            <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16" style="display:block;"><path d="M13.5 22v-8.5h2.85l.43-3.3H13.5V4.8c0-.95.27-1.6 1.64-1.6h1.75V.16C16.5.11 15.47 0 14.3 0c-2.53 0-4.26 1.54-4.26 4.38v2.45H7.2v3.3h2.84V22h3.46Z"/></svg>
          </button>
          <button class="ghost" data-act="x" title="Twitter (X)" aria-label="Compartir en Twitter (X)">
            <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16" style="display:block;"><path d="M18.9 2H22l-6.8 7.77L23.3 22h-5.95l-4.67-6.12L6.94 22H3.84l7.27-8.3L.7 2h6.1l4.2 5.56L18.9 2Zm-1.04 18h1.15L6.2 4H5.02l12.84 16Z"/></svg>
          </button>
          <button class="ghost" data-act="mail" title="Correo" aria-label="Compartir por correo">
            <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16" style="display:block;"><path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm0 4.2-8 5.33L4 8.2V6.8l8 5.33 8-5.33v1.4Z"/></svg>
          </button>
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap; justify-content:center;">
          <button class="ghost" data-act="copy">📋 Copiar</button>
          <button class="ghost" data-act="close">Cerrar</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  function close(){ overlay.remove(); }
  overlay.addEventListener('click', (e)=>{ if(e.target===overlay) close(); });
  overlay.querySelector('[data-act="close"]').addEventListener('click', close);
  overlay.querySelector('[data-act="copy"]').addEventListener('click', ()=>{
    const ta = overlay.querySelector('#webShareLink');
    ta.focus(); ta.select();
    const copied = copyTextToClipboard(shareUrl);
    showToast(copied ? 'Enlace copiado.' : 'No se pudo copiar el enlace.');
  });
  overlay.querySelector('[data-act="wa"]').addEventListener('click', ()=>{
    const url = `https://wa.me/?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  });
  overlay.querySelector('[data-act="tg"]').addEventListener('click', ()=>{
    const url = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  });
  overlay.querySelector('[data-act="fb"]').addEventListener('click', ()=>{
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  });
  overlay.querySelector('[data-act="x"]').addEventListener('click', ()=>{
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  });
  overlay.querySelector('[data-act="mail"]').addEventListener('click', ()=>{
    const url = `mailto:?subject=${encodeURIComponent('Mi Horario')}&body=${encodeURIComponent(`${shareText}\n${shareUrl}`)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  });
}

function showShareModal(){
  const proj = getActiveProject();
  // Selección por curso: course -> group (o 'único') para preservar la opción elegida
  const selectionMap = {};
  if(Array.isArray(schedules) && schedules.length > 0){
    const chosen = schedules[Math.max(0, Math.min(currentIdx, schedules.length - 1))].rows;
    chosen.forEach(r => { selectionMap[r.course] = (r.group && r.group !== 'único') ? r.group : (r.group || 'único'); });
  }
  // Guardar la opción actual en el proyecto antes de compartir
  // No modificar la opción guardada del proyecto al compartir.
  // Enlaces compartidos siempre abrirán en la primera opción (o: 0).
  const payloadObj = { v:1, name: proj.name, rows: proj.rows, colorOverrides: proj.colorOverrides || {}, s: selectionMap, o: 0 };
  const code = encodePayload(payloadObj);

  const shareUrl = getShareUrl(code);
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box" style="max-width:440px;">
      <h4>Compartir "${proj.name}"</h4>
      <p>Copia este enlace y envíaselo. Quien lo abra verá una pestaña nueva con este mismo horario.</p>
      <label style="display:block; font-family:'IBM Plex Mono',monospace; font-size:10px; text-transform:uppercase; letter-spacing:.05em; color:var(--ink-soft); margin-bottom:6px;">Enlace compartible</label>
      <textarea id="shareLink" readonly style="width:100%; height:70px; font-family:'IBM Plex Mono',monospace; font-size:11px; padding:8px; border:1px solid var(--rule); border-radius:8px; background:var(--paper); color:var(--ink); resize:vertical; margin-bottom:14px; box-sizing:border-box;">${shareUrl}</textarea>
      <div class="modal-actions" style="justify-content:flex-end; flex-wrap:wrap;">
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <button class="ghost" data-act="link">🔗 Copiar enlace</button>
          <button class="ghost" data-act="close">Cerrar</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  function close(){ overlay.remove(); }
  overlay.addEventListener('click', (e)=>{ if(e.target===overlay) close(); });
  overlay.querySelector('[data-act="close"]').addEventListener('click', close);
  overlay.querySelector('[data-act="link"]').addEventListener('click', ()=>{
    const ta = overlay.querySelector('#shareLink');
    ta.focus(); ta.select();
    const copied = copyTextToClipboard(shareUrl);
    showToast(copied ? 'Enlace copiado.' : 'No se pudo copiar el enlace.');
  });
}

function maybeImportSharedScheduleFromHash(){
  if(!window.location.hash.startsWith('#share=')) return;
  const payloadStr = window.location.hash.replace('#share=', '');
  const parsed = decodePayloadCode(payloadStr);
  if(!parsed || !Array.isArray(parsed.rows)){ showToast('El enlace compartido no tiene el formato esperado.'); return; }
  const newRows = parsed.rows.map(r => Object.assign(emptyRow(), r));
  const proj = {
    id: "p" + Date.now(),
    name: parsed.name || 'Horario compartido',
    rows: newRows,
    colorOverrides: parsed.colorOverrides || {},
    settings: defaultProjSettings()
  };
  state.projects.push(proj);
  state.activeId = proj.id;
  // Inicializar selectedOption del proyecto importado con el índice enviado antes de generar
  const optIndexInit = (typeof parsed.opt === 'number') ? parsed.opt : 0;
  proj.selectedOption = Math.max(0, Math.floor(optIndexInit));
  try{ saveState(); }catch(e){}
  renderTabs(); renderRows(); applySettings(); buildDrawerControls();
  currentIdx = proj.selectedOption;
  generate();
  // Si hay un mapa de selección, intentar encontrar una combinación que lo cumpla y usarla
  if(parsed && parsed.selection && typeof parsed.selection === 'object'){
    const sel = parsed.selection;
    let found = -1;
    for(let i=0;i<schedules.length;i++){
      const sch = schedules[i].rows;
      let ok = true;
      for(const course in sel){
        const choice = sel[course];
        const match = sch.some(r => r.course === course && ((r.group && r.group !== 'único' ? r.group : (r.group||'único')) === choice));
        if(!match){ ok = false; break; }
      }
      if(ok){ found = i; break; }
    }
    if(found >= 0){ currentIdx = found; generate(); }
  }
  // Guardar la opción seleccionada en el proyecto importado
  try{ proj.selectedOption = currentIdx; saveState(); }catch(e){}
  history.replaceState({}, '', window.location.pathname + window.location.search);
  showToast('Horario importado desde un enlace compartido.');
}

let storageWorks = true;
const safeStorage = {
  get(key){
    try{ return localStorage.getItem(key); }
    catch(e){ storageWorks = false; return null; }
  },
  set(key, val){
    try{ localStorage.setItem(key, val); return true; }
    catch(e){ storageWorks = false; return false; }
  }
};

let state = loadState();
let schedules = [];
let currentIdx = 0;

function defaultProjSettings(){
  return { hourStart: 7, hourEnd: 21, timeFormat: '24', includeSaturday: true, bgImage: '', bgMode: 'cover', bgOpacity: 1, bgDarken: false };
}
function defaultState(){
  return {
    projects: [{ id: "p"+Date.now(), name:"Horario 1", rows: [emptyRow(), emptyRow()], colorOverrides:{}, selectedOption: 0, settings: defaultProjSettings() }],
    activeId: null,
    settings: { accent: ACCENTS[0], dark:false, materiasCollapsed:false, styleCollapsed:false, fontScale:1, highContrast:false, reduceMotion:false }
  };
}
function emptyRow(){ return { course:"", day:"Lun", start:"08:00", end:"10:00", room:"", group:"", professor:"", enabled:true }; }

function loadState(){
  try{
    const raw = safeStorage.get(STORAGE_KEY);
    if(!raw) { const d = defaultState(); d.activeId = d.projects[0].id; return d; }
    const parsed = JSON.parse(raw);
    if(!parsed.projects || parsed.projects.length===0){ const d = defaultState(); d.activeId = d.projects[0].id; return d; }
    if(!parsed.activeId) parsed.activeId = parsed.projects[0].id;
    const defaults = defaultState();
    parsed.settings = Object.assign({}, defaults.settings, parsed.settings || {});
    parsed.projects.forEach(p=>{
      if(!p.colorOverrides) p.colorOverrides = {};
      if(typeof p.selectedOption !== 'number') p.selectedOption = 0;
      // Migrar ajustes por horario que antes eran globales
      const legacy = {};
      ['hourStart','hourEnd','timeFormat','includeSaturday','bgImage','bgMode','bgOpacity','bgDarken'].forEach(k=>{
        if(k in parsed.settings){
          legacy[k] = parsed.settings[k];
          delete parsed.settings[k];
        }
      });
      p.settings = Object.assign({}, defaultProjSettings(), legacy, p.settings || {});
      (p.rows||[]).forEach(r=>{
        if(r.section && !r.group) r.group = r.section;
        delete r.section;
        if(r.enabled === undefined) r.enabled = true;
      });
    });
    return parsed;
  }catch(e){ const d = defaultState(); d.activeId = d.projects[0].id; return d; }
}
function saveState(){
  const ok = safeStorage.set(STORAGE_KEY, JSON.stringify(state));
  const notice = document.getElementById('storageNotice');
  if(notice) notice.style.display = ok ? 'none' : 'block';
  return ok;
}

function getActiveProject(){ return state.projects.find(p=>p.id===state.activeId); }
function getProjSettings(){
  const p = getActiveProject();
  return (p && p.settings) ? p.settings : state.settings;
}

/* ---------- Tabs ---------- */
function renderTabs(){
  const bar = document.getElementById('tabsBar');
  bar.innerHTML = '';
  state.projects.forEach(p=>{
    const tab = document.createElement('div');
    tab.className = 'tab' + (p.id===state.activeId ? ' active' : '');
    tab.innerHTML = `<span class="tab-name">${p.name}</span>`;
    tab.addEventListener('click', (e)=>{
      if(e.target.classList.contains('tab-x')) return;
      state.activeId = p.id;
      // Restaurar la opción seleccionada de esta pestaña
      currentIdx = (typeof p.selectedOption === 'number') ? p.selectedOption : 0;
      saveState();
      renderTabs();
      renderRows();
      applySettings();
      buildDrawerControls();
      generate();
    });
    tab.addEventListener('dblclick', ()=>{
      showPromptModal({
        title: 'Renombrar horario',
        message: 'Escribe el nuevo nombre para esta pestaña.',
        initialValue: p.name,
        confirmText: 'Guardar',
        onConfirm: (newName)=>{ p.name = newName; saveState(); renderTabs(); generate(); }
      });
    });
    const xBtn = document.createElement('button');
    xBtn.className = 'tab-x';
    xBtn.textContent = '×';
    xBtn.title = 'Eliminar este horario';
    xBtn.addEventListener('click', (ev)=>{
      ev.stopPropagation();
      if(state.projects.length===1){ showToast('Debe existir al menos un horario.'); return; }
      showConfirmModal({
        title: 'Eliminar horario',
        message: `¿Eliminar "${p.name}"? Esta acción no se puede deshacer.`,
        confirmText: 'Eliminar',
        danger: true,
        onConfirm: ()=>{
          state.projects = state.projects.filter(pr=>pr.id!==p.id);
          if(state.activeId===p.id) state.activeId = state.projects[0].id;
          // Restaurar opción de la nueva pestaña activa
          const newActive = state.projects.find(pr=>pr.id===state.activeId);
          currentIdx = (newActive && typeof newActive.selectedOption === 'number') ? newActive.selectedOption : 0;
          saveState(); renderTabs(); renderRows(); applySettings(); buildDrawerControls(); generate();
        }
      });
    });
    tab.appendChild(xBtn);
    bar.appendChild(tab);
  });
  const addBtn = document.createElement('button');
  addBtn.className = 'add-tab';
  addBtn.textContent = '+';
  addBtn.title = 'Crear nuevo horario';
  addBtn.addEventListener('click', ()=>{
    const n = state.projects.length + 1;
    const proj = { id:"p"+Date.now(), name:`Horario ${n}`, rows:[emptyRow(), emptyRow()], selectedOption: 0, settings: defaultProjSettings() };
    state.projects.push(proj);
    state.activeId = proj.id;
    saveState(); renderTabs(); renderRows(); applySettings(); buildDrawerControls(); generate();
  });
  bar.appendChild(addBtn);
}

/* ---------- Rows / builder ---------- */
function rowTemplate(data){
  const card = document.createElement('div');
  card.className = 'row-card' + (data.enabled === false ? ' row-disabled' : '');
  const activeDays = getActiveDays();
  const dayOptions = activeDays.includes(data.day) ? activeDays : [...activeDays, data.day];
  card.innerHTML = `
    <div class="row-head">
      <label class="row-toggle" title="Mostrar/ocultar esta materia del horario">
        <input type="checkbox" data-field="enabled" ${data.enabled === false ? '' : 'checked'}>
        <span class="slider"></span>
      </label>
      <input type="text" placeholder="Nombre de la materia (ej. Cálculo II)" data-field="course" value="${data.course||''}">
      <button class="remove-btn" title="Eliminar fila">×</button>
    </div>
    <div class="row-fields">
      <div class="field"><label>Grupo</label><input type="text" placeholder="1" data-field="group" value="${data.group||''}"></div>
      <div class="field"><label>Día</label><select data-field="day">${dayOptions.map(d=>`<option value="${d}" ${d===data.day?'selected':''}>${d}</option>`).join('')}</select></div>
      <div class="field"><label>Inicio</label><input type="time" data-field="start" value="${data.start||'08:00'}"></div>
      <div class="field"><label>Fin</label><input type="time" data-field="end" value="${data.end||'10:00'}"></div>
      <div class="field"><label>Aula</label><input type="text" placeholder="B-204" data-field="room" value="${data.room||''}"></div>
      <div class="field"><label>Profesor(a)</label><input type="text" placeholder="Nombre" data-field="professor" value="${data.professor||''}"></div>
    </div>
  `;
  card.querySelectorAll('input, select').forEach(el=>{
    el.addEventListener('input', syncRowsFromDOM);
    el.addEventListener('change', syncRowsFromDOM);
  });
  card.querySelector('[data-field="enabled"]').addEventListener('change', (e)=>{
    card.classList.toggle('row-disabled', !e.target.checked);
  });
  card.querySelector('.remove-btn').addEventListener('click', ()=>{
    card.remove();
    syncRowsFromDOM();
  });
  return card;
}

function renderRows(){
  const proj = getActiveProject();
  const container = document.getElementById('rows');
  container.innerHTML = '';
  proj.rows.forEach(r=> container.appendChild(rowTemplate(r)));
}

function syncRowsFromDOM(){
  const proj = getActiveProject();
  const rows = [];
  document.querySelectorAll('#rows .row-card').forEach(card=>{
    rows.push({
      course: card.querySelector('[data-field="course"]').value,
      group: card.querySelector('[data-field="group"]').value,
      day: card.querySelector('[data-field="day"]').value,
      start: card.querySelector('[data-field="start"]').value,
      end: card.querySelector('[data-field="end"]').value,
      room: card.querySelector('[data-field="room"]').value,
      professor: card.querySelector('[data-field="professor"]').value,
      enabled: card.querySelector('[data-field="enabled"]').checked
    });
  });
  proj.rows = rows;
  saveState();
  generate();
}

function addRow(){
  document.getElementById('rows').appendChild(rowTemplate(emptyRow()));
  syncRowsFromDOM();
}

/* ---------- Schedule generation ---------- */
function toMin(t){ const [h,m]=t.split(':').map(Number); return h*60+m; }
function overlaps(a,b){ return a.day===b.day && toMin(a.start)<toMin(b.end) && toMin(b.start)<toMin(a.end); }
function cartesian(arr){
  return arr.reduce((acc,cur)=>{ const res=[]; acc.forEach(a=>cur.forEach(c=>res.push([...a,c]))); return res; },[[]]);
}
function getActiveDays(){ return getProjSettings().includeSaturday ? DAYS : DAYS.slice(0,5); }
function hexToRgb(hex){
  const h = hex.replace('#','');
  const n = parseInt(h.length===3 ? h.split('').map(c=>c+c).join('') : h, 16);
  return { r:(n>>16)&255, g:(n>>8)&255, b:n&255 };
}
function hexToRgba(hex, alpha){
  const { r, g, b } = hexToRgb(hex);
  const a = Math.max(0, Math.min(1, alpha));
  return `rgba(${r},${g},${b},${a})`;
}
function mixHex(hex, targetHex, weight){
  const a = hexToRgb(hex), b = hexToRgb(targetHex);
  const r = Math.round(a.r*weight + b.r*(1-weight));
  const g = Math.round(a.g*weight + b.g*(1-weight));
  const bl = Math.round(a.b*weight + b.b*(1-weight));
  return '#' + [r,g,bl].map(v=>v.toString(16).padStart(2,'0')).join('');
}
function buildColorFromHex(hex){
  return {
    bg: mixHex(hex, '#ffffff', 0.16),
    border: hex,
    text: mixHex(hex, '#000000', 0.72),
    dbg: mixHex(hex, '#000000', 0.32),
    dtext: mixHex(hex, '#ffffff', 0.72)
  };
}
function formatTimeStr(t){
  if(getProjSettings().timeFormat !== '12') return t;
  const [h,m] = t.split(':').map(Number);
  const period = h < 12 ? 'AM' : 'PM';
  let hh = h % 12; if(hh===0) hh = 12;
  return `${hh}:${String(m).padStart(2,'0')}${period}`;
}
function formatHourLabel(h){
  if(getProjSettings().timeFormat !== '12') return `${h}:00`;
  const period = h < 12 ? 'AM' : 'PM';
  let hh = h % 12; if(hh===0) hh = 12;
  return `${hh}\u00A0${period}`;
}

function generate(){
  const proj = getActiveProject();
  const activeDays = getActiveDays();
  const titleInput = document.getElementById('scheduleTitleInput');
  const exportTitle = document.getElementById('exportTitle');
  if(titleInput && document.activeElement !== titleInput) titleInput.value = proj.name;
  if(exportTitle) exportTitle.textContent = proj.name;

  const skippedDay = proj.rows.some(r=> r.enabled !== false && r.course.trim() && !activeDays.includes(r.day));

  const data = proj.rows.filter(r=> r.enabled !== false && r.course.trim() && r.start && r.end && activeDays.includes(r.day))
    .map(r=>({...r, course:r.course.trim(), group:(r.group.trim()||"único")}));
  const summary = document.getElementById('summary');
  const nav = document.getElementById('nav');
  const legend = document.getElementById('legend');
  const view = document.getElementById('scheduleView');
  summary.innerHTML=''; nav.innerHTML=''; legend.innerHTML=''; view.innerHTML='';

  if(data.length===0){
    summary.innerHTML = skippedDay
      ? '<p class="empty-note">Tienes materias los sábados pero desactivaste ese día en Estilo del horario. Actívalo de nuevo o cambia el día de esas materias.</p>'
      : '<p class="empty-note">Agrega al menos una materia con su horario arriba, y aquí verás tu horario armado automáticamente.</p>';
    schedules = [];
    return;
  }

  const byCourse = {};
  data.forEach(r=>{
    byCourse[r.course] = byCourse[r.course] || {};
    byCourse[r.course][r.group] = byCourse[r.course][r.group] || [];
    byCourse[r.course][r.group].push(r);
  });
  const courseNames = Object.keys(byCourse);
  const optionsPerCourse = courseNames.map(name=>{
    const bundles = Object.values(byCourse[name]).map(groupRows=>groupRows.slice());
    return [
      { skipped:true, course:name, rows:[] },
      ...bundles.map(rows=>({ course:name, rows }))
    ];
  });
  const combos = cartesian(optionsPerCourse);

  const valid = [];
  combos.forEach(combo=>{
    const selected = combo.filter(choice => !choice.skipped);
    const flat = selected.flatMap(choice => choice.rows);
    if(selected.length===0) return;

    let ok = true;
    for(let i=0;i<flat.length && ok;i++){
      for(let j=i+1;j<flat.length;j++){
        if(flat[i].course !== flat[j].course && overlaps(flat[i], flat[j])){ ok=false; break; }
      }
    }
    if(ok) valid.push({ rows: flat, includedCourses: selected.length });
  });

  valid.sort((a,b)=> b.includedCourses - a.includedCourses || b.rows.length - a.rows.length);
  schedules = valid;
  if(currentIdx >= schedules.length){
    const saved = (typeof proj.selectedOption === 'number') ? proj.selectedOption : 0;
    currentIdx = (typeof saved === 'number' && saved < schedules.length) ? saved : 0;
  }

  proj.colorOverrides = proj.colorOverrides || {};
  const colorMap = {};
  courseNames.forEach((c,i)=>{
    colorMap[c] = proj.colorOverrides[c] ? buildColorFromHex(proj.colorOverrides[c]) : COLORS[i % COLORS.length];
  });
  courseNames.forEach(c=>{
    const item = document.createElement('div');
    item.className = 'legend-item';
    item.style.cursor = 'pointer';
    item.title = 'Cambiar color de ' + c;

    const swatch = document.createElement('span');
    swatch.className = 'legend-swatch';
    swatch.style.background = colorMap[c].border;

    const label = document.createElement('span');
    label.textContent = c;

    const picker = document.createElement('input');
    picker.type = 'color';
    picker.value = colorMap[c].border;
    picker.style.cssText = 'position:absolute; width:1px; height:1px; opacity:0; pointer-events:none;';
    picker.addEventListener('input', (e)=>{
      proj.colorOverrides[c] = e.target.value;
      saveState();
      generate();
    });

    item.appendChild(swatch);
    item.appendChild(label);
    item.appendChild(picker);
    item.addEventListener('click', ()=> picker.click());
    legend.appendChild(item);
  });

  const hasAlternatives = courseNames.some(name => Object.keys(byCourse[name]).length > 1);
  const bestSchedule = schedules[0];
  const skippedCourses = bestSchedule ? courseNames.length - bestSchedule.includedCourses : 0;

  if(schedules.length===0){
    summary.innerHTML = `<p class="empty-note">Alguna de tus materias se cruza en horario con otra y no es posible armar un horario sin choques. Revisa los días y horas, o agrega una sección alternativa para la materia que se cruza.</p>`;
    return;
  }

  if(schedules.length===1){
    summary.textContent = hasAlternatives
      ? (skippedCourses > 0
        ? 'Se encontró una combinación viable al elegir la alternativa que mejor encaja y dejar fuera las materias que no pudieron combinarse.'
        : 'Solo hay una forma de combinar tus materias sin que se crucen.')
      : 'Este es el horario con las materias que agregaste.';
  } else {
    summary.textContent = hasAlternatives
      ? `Hay ${schedules.length} combinaciones viables. La mejor opción se muestra primero; usa los controles para revisar otra.`
      : `Agregaste grupos alternativos, así que hay ${schedules.length} formas distintas de armar tu horario sin cruces. Elige una para verla:`;

    const optionNav = document.createElement('div');
    optionNav.className = 'option-nav';

    const prevBtn = document.createElement('button');
    prevBtn.className = 'nav-btn prev';
    prevBtn.textContent = '← Anterior';
    prevBtn.addEventListener('click', ()=>{
      if(currentIdx>0){
        currentIdx -= 1;
        render();
        try{ const p = getActiveProject(); p.selectedOption = currentIdx; saveState(); }catch(e){}
      }
    });

    const select = document.createElement('select');
    select.className = 'option-select';
    for(let i=0;i<schedules.length;i++){
      const opt = document.createElement('option');
      opt.value = String(i+1);
      opt.textContent = `Opción ${i+1}`;
      select.appendChild(opt);
    }
    select.addEventListener('change', ()=>{ currentIdx = parseInt(select.value, 10) - 1; render(); try{ const p = getActiveProject(); p.selectedOption = currentIdx; saveState(); }catch(e){} });

    const nextBtn = document.createElement('button');
    nextBtn.className = 'nav-btn next';
    nextBtn.textContent = 'Siguiente →';
    nextBtn.addEventListener('click', ()=>{ if(currentIdx < schedules.length-1){ currentIdx += 1; render(); try{ const p = getActiveProject(); p.selectedOption = currentIdx; saveState(); }catch(e){} }});

    const label = document.createElement('span');
    label.className = 'option-label';
    label.textContent = `Opción ${currentIdx+1} de ${schedules.length}`;

    optionNav.appendChild(prevBtn);
    optionNav.appendChild(select);
    optionNav.appendChild(nextBtn);
    optionNav.appendChild(label);
    nav.appendChild(optionNav);
  }

  function render(){
    const select = nav.querySelector('.option-select');
    const prevBtn = nav.querySelector('.nav-btn.prev');
    const nextBtn = nav.querySelector('.nav-btn.next');
    const label = nav.querySelector('.option-label');
    if(select){ select.value = String(currentIdx + 1); }
    if(prevBtn){ prevBtn.disabled = currentIdx === 0; }
    if(nextBtn){ nextBtn.disabled = currentIdx >= schedules.length - 1; }
    if(label){ label.textContent = `Opción ${currentIdx + 1} de ${schedules.length}`; }
    renderGrid(schedules[currentIdx].rows, colorMap);
  }
  render();
}

function renderGrid(schedule, colorMap){
  const view = document.getElementById('scheduleView');
  const activeDays = getActiveDays();
  const numDays = activeDays.length;
  const ps = getProjSettings();
  const startHour = ps.hourStart, endHour = ps.hourEnd;
  const hourH = 36;
  const totalH = (endHour-startHour)*hourH;
  const labelColW = ps.timeFormat==='12' ? 60 : 46;
  const gridWidth = 660;
  const colWidth = gridWidth/numDays;
  const dark = state.settings.dark;

  let hourLabels = '';
  for(let h=startHour; h<=endHour; h++){
    hourLabels += `<div class="hour-label" style="top:${(h-startHour)*hourH-6}px; left:0;">${formatHourLabel(h)}</div>`;
  }
  let dayHeads = `<div style="display:grid; grid-template-columns:repeat(${numDays},1fr); margin-left:${labelColW}px; width:${gridWidth}px;">`;
  activeDays.forEach(d=> dayHeads += `<div class="day-head">${d}</div>`);
  dayHeads += `</div>`;

  let dayCols = '';
  activeDays.forEach((d,i)=>{
    dayCols += `<div class="day-col" style="position:absolute; top:0; left:${labelColW + i*colWidth}px; width:${colWidth}px; height:${totalH}px;"></div>`;
  });

  const dayIndex = {}; activeDays.forEach((d,i)=>dayIndex[d]=i);
  let blocksHtml = '';
  schedule.forEach(sec=>{
    const top = (toMin(sec.start)/60 - startHour) * hourH;
    const timeBasedHeight = Math.max((toMin(sec.end)-toMin(sec.start))/60*hourH, 22);

    const timeLine = (sec.group && sec.group !== 'único')
      ? `Grupo ${sec.group} · ${formatTimeStr(sec.start)} - ${formatTimeStr(sec.end)}`
      : `${formatTimeStr(sec.start)} - ${formatTimeStr(sec.end)}`;

    const left = labelColW + dayIndex[sec.day]*colWidth + 2;
    const c = colorMap[sec.course];
    const bg = dark ? c.dbg : c.bg;
    const text = dark ? c.dtext : c.text;
    blocksHtml += `<div class="block" style="top:${top}px; left:${left}px; width:${colWidth-6}px; height:${timeBasedHeight}px; background:${bg}; border-left-color:${c.border}; color:${text};">
      <div class="b-course">${sec.course}</div>
      ${sec.group && sec.group !== 'único' ? `<div class="b-group">Grupo ${sec.group}</div>` : ''}
      <div class="b-time">${formatTimeStr(sec.start)} - ${formatTimeStr(sec.end)}</div>
      ${sec.room ? `<div class="b-meta b-room">Aula ${sec.room}</div>` : ''}
      ${sec.professor ? `<div class="b-meta b-prof">${sec.professor}</div>` : ''}
    </div>`;
  });

  view.innerHTML = `${dayHeads}
    <div style="position:relative; height:${totalH}px; margin-top:6px;">
      ${hourLabels}${dayCols}${blocksHtml}
    </div>`;

  // Second pass: measure each block's real content height (accounting for
  // course names that wrap to 2+ lines) and drop the least essential lines
  // (profesor, then aula) if it doesn't actually fit in its time slot.
  view.querySelectorAll('.block').forEach(block=>{
    if(block.scrollHeight <= block.clientHeight) return;
    const prof = block.querySelector('.b-prof');
    if(prof) prof.remove();
    if(block.scrollHeight <= block.clientHeight) return;
    const room = block.querySelector('.b-room');
    if(room) room.remove();
    if(block.scrollHeight > block.clientHeight){
      // Even course + time alone don't fit (very short class, long name) —
      // let the box grow rather than clip the time.
      block.style.height = block.scrollHeight + 'px';
    }
  });
}

/* ---------- Customize drawer ---------- */
function bgStyleValues(mode){
  const map = {
    cover:      { size:'cover',     repeat:'no-repeat', pos:'center center', filter:'none' },
    repeat:     { size:'auto',      repeat:'repeat',    pos:'0 0',           filter:'none' },
    contain:    { size:'contain',   repeat:'no-repeat', pos:'center center', filter:'none' },
    blur:       { size:'cover',     repeat:'no-repeat', pos:'center center', filter:'blur(6px)' },
    grayscale:  { size:'cover',     repeat:'no-repeat', pos:'center center', filter:'grayscale(1)' },
    sepia:      { size:'cover',     repeat:'no-repeat', pos:'center center', filter:'sepia(0.8)' }
  };
  return map[mode] || map.cover;
}

function applySettings(){
  document.documentElement.style.setProperty('--accent', state.settings.accent);
  document.body.classList.toggle('dark', state.settings.dark);
  document.getElementById('darkToggle').checked = state.settings.dark;

  const scale = (typeof state.settings.fontScale === 'number') ? state.settings.fontScale : 1;
  document.body.style.zoom = scale;
  const drawer = document.getElementById('drawer');
  const overlay = document.getElementById('overlay');
  if(drawer) drawer.style.zoom = 1 / scale;
  if(overlay) overlay.style.zoom = 1 / scale;
  document.getElementById('fontScaleSelect').value = String(scale);
  document.body.classList.toggle('high-contrast', !!state.settings.highContrast);
  document.getElementById('contrastToggle').checked = !!state.settings.highContrast;
  document.body.classList.toggle('reduce-motion', !!state.settings.reduceMotion);
  document.getElementById('motionToggle').checked = !!state.settings.reduceMotion;

  const ps = getProjSettings();
  document.getElementById('saturdayToggle').checked = ps.includeSaturday;
  document.getElementById('timeFormatToggle').checked = ps.timeFormat === '12';
  document.getElementById('materiasBody').classList.toggle('collapsed', !!state.settings.materiasCollapsed);
  document.getElementById('collapseMateriasBtn').classList.toggle('collapsed', !!state.settings.materiasCollapsed);
  document.getElementById('styleBody').classList.toggle('collapsed', !!state.settings.styleCollapsed);
  document.getElementById('collapseStyleBtn').classList.toggle('collapsed', !!state.settings.styleCollapsed);

  const img = ps.bgImage || '';
  const gridWrap = document.querySelector('.grid-wrap');
  if(gridWrap){
    gridWrap.classList.toggle('has-bg', !!img);
    if(img){
      const panel = (getComputedStyle(document.body).getPropertyValue('--panel') || (state.settings.dark ? '#1E212C' : '#ffffff')).trim();
      const opacity = (typeof ps.bgOpacity === 'number') ? ps.bgOpacity : 1;
      const v = bgStyleValues(ps.bgMode);
      gridWrap.style.setProperty('--bg-url', `url("${img}")`);
      gridWrap.style.setProperty('--bg-size', v.size);
      gridWrap.style.setProperty('--bg-repeat', v.repeat);
      gridWrap.style.setProperty('--bg-position', v.pos);
      gridWrap.style.setProperty('--bg-filter', v.filter);
      gridWrap.style.setProperty('--bg-dark-overlay', ps.bgDarken ? 'rgba(0,0,0,0.55)' : 'transparent');
      gridWrap.style.setProperty('--bg-panel-overlay', hexToRgba(panel, 1 - opacity));
    } else {
      ['--bg-url','--bg-size','--bg-repeat','--bg-position','--bg-filter','--bg-dark-overlay','--bg-panel-overlay'].forEach(k=> gridWrap.style.removeProperty(k));
    }
  }
  syncBgControls();
}

function readImageFile(file, cb){
  const reader = new FileReader();
  reader.onload = ()=>{
    const img = new Image();
    img.onload = ()=>{
      const MAX = 1600;
      let width = img.width, height = img.height;
      if(Math.max(width, height) > MAX){
        const ratio = MAX / Math.max(width, height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      cb(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = ()=> showToast('No se pudo leer la imagen. Prueba con otro archivo.');
    img.src = reader.result;
  };
  reader.onerror = ()=> showToast('No se pudo leer el archivo.');
  reader.readAsDataURL(file);
}

function syncBgControls(){
  const preview = document.getElementById('bgPreview');
  const removeBtn = document.getElementById('bgRemoveBtn');
  const mode = document.getElementById('bgMode');
  const darken = document.getElementById('bgDarkenToggle');
  const range = document.getElementById('bgOpacityRange');
  const val = document.getElementById('bgOpacityVal');
  const ps = getProjSettings();
  const hasBg = !!ps.bgImage;
  if(preview){
    if(hasBg){
      preview.style.backgroundImage = `url("${ps.bgImage}")`;
      preview.hidden = false;
    } else {
      preview.hidden = true;
    }
  }
  if(removeBtn) removeBtn.hidden = !hasBg;
  if(mode) mode.value = ps.bgMode;
  if(darken) darken.checked = !!ps.bgDarken;
  if(range && val){
    const pct = Math.round((typeof ps.bgOpacity === 'number' ? ps.bgOpacity : 1) * 100);
    range.value = String(pct);
    val.textContent = pct + '%';
  }
}

function buildDrawerControls(){
  const sw = document.getElementById('swatches');
  sw.innerHTML = '';
  ACCENTS.forEach(color=>{
    const s = document.createElement('div');
    s.className = 'swatch' + (state.settings.accent===color ? ' selected' : '');
    s.style.background = color;
    s.addEventListener('click', ()=>{
      state.settings.accent = color;
      saveState(); applySettings(); buildDrawerControls();
      generate();
    });
    sw.appendChild(s);
  });

  const hs = document.getElementById('hourStart');
  const he = document.getElementById('hourEnd');
  const ps = getProjSettings();
  hs.innerHTML = ''; he.innerHTML = '';
  for(let h=5; h<=12; h++) hs.innerHTML += `<option value="${h}" ${h===ps.hourStart?'selected':''}>${h}:00</option>`;
  for(let h=15; h<=23; h++) he.innerHTML += `<option value="${h}" ${h===ps.hourEnd?'selected':''}>${h}:00</option>`;
  hs.onchange = ()=>{
    ps.hourStart = parseInt(hs.value);
    saveState(); generate();
  };
  he.onchange = ()=>{
    ps.hourEnd = parseInt(he.value);
    saveState(); generate();
  };
}

document.getElementById('darkToggle').addEventListener('change', (e)=>{
  state.settings.dark = e.target.checked;
  saveState(); applySettings();
  generate();
});

document.getElementById('fontScaleSelect').addEventListener('change', (e)=>{
  state.settings.fontScale = parseFloat(e.target.value);
  saveState(); applySettings();
});

document.getElementById('contrastToggle').addEventListener('change', (e)=>{
  state.settings.highContrast = e.target.checked;
  saveState(); applySettings();
});

document.getElementById('motionToggle').addEventListener('change', (e)=>{
  state.settings.reduceMotion = e.target.checked;
  saveState(); applySettings();
});

document.getElementById('saturdayToggle').addEventListener('change', (e)=>{
  getProjSettings().includeSaturday = e.target.checked;
  saveState(); renderRows(); generate();
});

document.getElementById('timeFormatToggle').addEventListener('change', (e)=>{
  getProjSettings().timeFormat = e.target.checked ? '12' : '24';
  saveState(); generate();
});

document.getElementById('bgImageInput').addEventListener('change', ()=>{
  const input = document.getElementById('bgImageInput');
  const file = input.files && input.files[0];
  input.value = '';
  if(!file) return;
  readImageFile(file, (dataUrl)=>{
    getProjSettings().bgImage = dataUrl;
    const saved = saveState();
    if(!saved){
      getProjSettings().bgImage = '';
      showToast('La imagen es demasiado grande para guardarse en este navegador.');
      syncBgControls();
      return;
    }
    applySettings();
    syncBgControls();
  });
});

document.getElementById('bgRemoveBtn').addEventListener('click', ()=>{
  getProjSettings().bgImage = '';
  saveState(); applySettings(); syncBgControls();
});

document.getElementById('bgMode').addEventListener('change', (e)=>{
  getProjSettings().bgMode = e.target.value;
  saveState(); applySettings();
});

document.getElementById('bgDarkenToggle').addEventListener('change', (e)=>{
  getProjSettings().bgDarken = e.target.checked;
  saveState(); applySettings();
});

document.getElementById('bgOpacityRange').addEventListener('input', (e)=>{
  getProjSettings().bgOpacity = parseInt(e.target.value, 10) / 100;
  document.getElementById('bgOpacityVal').textContent = e.target.value + '%';
  saveState(); applySettings();
});

document.getElementById('collapseMateriasBtn').addEventListener('click', ()=>{
  state.settings.materiasCollapsed = !state.settings.materiasCollapsed;
  saveState();
  applySettings();
});

document.getElementById('openWebShare').addEventListener('click', showWebShareModal);
document.getElementById('openShareSchedule').addEventListener('click', showShareModal);

function closeDrawerFn(){
  document.getElementById('drawer').classList.remove('open');
  document.getElementById('overlay').classList.remove('open');
}
document.getElementById('openCustomize').addEventListener('click', ()=>{
  document.getElementById('drawer').classList.add('open');
  document.getElementById('overlay').classList.add('open');
});
document.getElementById('closeDrawer').addEventListener('click', closeDrawerFn);
document.getElementById('overlay').addEventListener('click', closeDrawerFn);

document.getElementById('collapseStyleBtn').addEventListener('click', ()=>{
  state.settings.styleCollapsed = !state.settings.styleCollapsed;
  saveState();
  applySettings();
});

/* ---------- Wire up main actions ---------- */
document.getElementById('scheduleTitleInput').addEventListener('input', (e)=>{
  const proj = getActiveProject();
  proj.name = e.target.value || 'Horario sin título';
  document.getElementById('exportTitle').textContent = proj.name;
  saveState();
  renderTabs();
});

document.getElementById('addRow').addEventListener('click', addRow);
document.getElementById('clearBtn').addEventListener('click', ()=>{
  getActiveProject().rows = [emptyRow(), emptyRow()];
  saveState(); renderRows(); generate();
});
document.getElementById('downloadBtn').addEventListener('click', ()=>{
  const target = document.getElementById('exportCapture');
  if(!target || schedules.length===0) return;
  if(typeof html2canvas !== 'function'){
    showToast('La herramienta de descarga aún no ha cargado (necesita internet la primera vez). Espera unos segundos e inténtalo de nuevo.');
    return;
  }
  const btn = document.getElementById('downloadBtn');
  const original = btn.textContent;
  btn.textContent = 'Generando imagen…';
  const projName = (getActiveProject().name || 'horario').replace(/\s+/g,'_').replace(/[^\w\-]/g,'');
  html2canvas(target, {backgroundColor: state.settings.dark ? '#1E212C' : '#ffffff', scale:2}).then(canvas=>{
    const link = document.createElement('a');
    link.download = `${projName}_opcion_${currentIdx+1}_de_${schedules.length}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    btn.textContent = original;
  }).catch(()=>{ btn.textContent = original; });
});

/* ---------- Init ---------- */
try{
  applySettings();
  buildDrawerControls();
  renderTabs();
  renderRows();
  // Restaurar la opción guardada del proyecto activo antes de generar
  try{ const proj0 = getActiveProject(); currentIdx = (proj0 && typeof proj0.selectedOption === 'number') ? proj0.selectedOption : 0; }catch(e){}
  generate();
  maybeImportSharedScheduleFromHash();
  if(!storageWorks){
    document.getElementById('storageNotice').style.display = 'block';
  }
}catch(e){
  showFatalError('No se pudo iniciar el planificador: ' + e.message);
}
