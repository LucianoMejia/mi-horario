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
  return btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
}
function decodePayloadCode(code){
  return decodeURIComponent(escape(atob(code)));
}

function showShareModal(){
  const proj = getActiveProject();
  const payloadObj = { v:1, name: proj.name, rows: proj.rows, colorOverrides: proj.colorOverrides || {} };
  const payloadStr = JSON.stringify(payloadObj);
  const code = encodePayload(payloadObj);

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box" style="max-width:440px;">
      <h4>Compartir "${proj.name}"</h4>
      <p>Copia este código y envíaselo a quien quieras. Al pegarlo en "Importar" se le creará una pestaña nueva con este mismo horario.</p>
      <textarea id="shareCode" readonly style="width:100%; height:90px; font-family:'IBM Plex Mono',monospace; font-size:11px; padding:8px; border:1px solid var(--rule); border-radius:8px; background:var(--paper); color:var(--ink); resize:vertical; margin-bottom:14px; box-sizing:border-box;">${code}</textarea>
      <div class="modal-actions" style="justify-content:space-between;">
        <button class="ghost" data-act="file">↓ Descargar archivo</button>
        <div style="display:flex; gap:8px;">
          <button class="ghost" data-act="close">Cerrar</button>
          <button class="primary" data-act="copy">Copiar código</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  function close(){ overlay.remove(); }
  overlay.addEventListener('click', (e)=>{ if(e.target===overlay) close(); });
  overlay.querySelector('[data-act="close"]').addEventListener('click', close);
  overlay.querySelector('[data-act="copy"]').addEventListener('click', ()=>{
    const ta = overlay.querySelector('#shareCode');
    ta.focus(); ta.select();
    let copied = false;
    try{
      if(navigator.clipboard && navigator.clipboard.writeText){
        navigator.clipboard.writeText(code);
        copied = true;
      }
    }catch(e){}
    if(!copied){
      try{ copied = document.execCommand('copy'); }catch(e){}
    }
    showToast(copied ? 'Código copiado.' : 'Selecciona el texto y cópialo con Ctrl+C.');
  });
  overlay.querySelector('[data-act="file"]').addEventListener('click', ()=>{
    const blob = new Blob([payloadStr], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (proj.name || 'horario').replace(/\s+/g,'_').replace(/[^\w\-]/g,'') + '.json';
    a.click();
    URL.revokeObjectURL(url);
  });
}

function showImportModal(){
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box" style="max-width:440px;">
      <h4>Importar horario</h4>
      <p>Pega aquí el código que te compartieron, o sube el archivo .json. Se crea una pestaña nueva sin tocar tus horarios actuales.</p>
      <textarea id="importCode" placeholder="Pega el código aquí..." style="width:100%; height:80px; font-family:'IBM Plex Mono',monospace; font-size:11px; padding:8px; border:1px solid var(--rule); border-radius:8px; background:var(--paper); color:var(--ink); resize:vertical; margin-bottom:10px; box-sizing:border-box;"></textarea>
      <input type="file" id="importFile" accept="application/json,.json" style="margin-bottom:16px; font-size:13px; width:100%;">
      <div class="modal-actions">
        <button class="ghost" data-act="cancel">Cancelar</button>
        <button class="primary" data-act="ok">Crear horario</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  function close(){ overlay.remove(); }
  overlay.addEventListener('click', (e)=>{ if(e.target===overlay) close(); });
  overlay.querySelector('[data-act="cancel"]').addEventListener('click', close);

  const fileInput = overlay.querySelector('#importFile');
  const codeInput = overlay.querySelector('#importCode');

  function finishImport(payloadStr){
    let parsed;
    try{ parsed = JSON.parse(payloadStr); }
    catch(e){ showToast('No se pudo leer ese horario. Revisa el código o el archivo.'); return; }
    if(!parsed || !Array.isArray(parsed.rows)){ showToast('El archivo no tiene el formato esperado.'); return; }
    const newRows = parsed.rows.map(r => Object.assign(emptyRow(), r));
    const proj = {
      id: "p"+Date.now(),
      name: parsed.name || 'Horario importado',
      rows: newRows,
      colorOverrides: parsed.colorOverrides || {}
    };
    state.projects.push(proj);
    state.activeId = proj.id;
    saveState(); renderTabs(); renderRows(); generate();
    close();
    showToast('Horario importado en una pestaña nueva.');
  }

  overlay.querySelector('[data-act="ok"]').addEventListener('click', ()=>{
    if(fileInput.files && fileInput.files[0]){
      const reader = new FileReader();
      reader.onload = ()=> finishImport(reader.result);
      reader.onerror = ()=> showToast('No se pudo leer el archivo.');
      reader.readAsText(fileInput.files[0]);
      return;
    }
    const raw = codeInput.value.trim();
    if(!raw){ showToast('Pega un código o selecciona un archivo.'); return; }
    let payloadStr;
    try{ payloadStr = decodePayloadCode(raw); }
    catch(e){ payloadStr = raw; } // maybe they pasted raw JSON instead of the code
    finishImport(payloadStr);
  });
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

function defaultState(){
  return {
    projects: [{ id: "p"+Date.now(), name:"Horario 1", rows: [emptyRow(), emptyRow()], colorOverrides:{} }],
    activeId: null,
    settings: { accent: ACCENTS[0], hourStart: 7, hourEnd: 21, dark:false, includeSaturday:true, timeFormat:'24', materiasCollapsed:false }
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
}

function getActiveProject(){ return state.projects.find(p=>p.id===state.activeId); }

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
      saveState();
      renderTabs();
      renderRows();
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
          saveState(); renderTabs(); renderRows(); generate();
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
    const proj = { id:"p"+Date.now(), name:`Horario ${n}`, rows:[emptyRow(), emptyRow()] };
    state.projects.push(proj);
    state.activeId = proj.id;
    saveState(); renderTabs(); renderRows(); generate();
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
function getActiveDays(){ return state.settings.includeSaturday ? DAYS : DAYS.slice(0,5); }
function hexToRgb(hex){
  const h = hex.replace('#','');
  const n = parseInt(h.length===3 ? h.split('').map(c=>c+c).join('') : h, 16);
  return { r:(n>>16)&255, g:(n>>8)&255, b:n&255 };
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
  if(state.settings.timeFormat !== '12') return t;
  const [h,m] = t.split(':').map(Number);
  const period = h < 12 ? 'AM' : 'PM';
  let hh = h % 12; if(hh===0) hh = 12;
  return `${hh}:${String(m).padStart(2,'0')}\u00A0${period}`;
}
function formatHourLabel(h){
  if(state.settings.timeFormat !== '12') return `${h}:00`;
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
      ? '<p class="empty-note">Tienes materias los sábados pero desactivaste ese día en Personalizar. Actívalo de nuevo o cambia el día de esas materias.</p>'
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
  const optionsPerCourse = courseNames.map(name=>Object.values(byCourse[name]));
  const combos = cartesian(optionsPerCourse);

  const valid = [];
  combos.forEach(combo=>{
    const flat = combo.flat();
    let ok = true;
    for(let i=0;i<flat.length && ok;i++){
      for(let j=i+1;j<flat.length;j++){
        if(flat[i].course !== flat[j].course && overlaps(flat[i], flat[j])){ ok=false; break; }
      }
    }
    if(ok) valid.push(flat);
  });

  schedules = valid;
  if(currentIdx >= schedules.length) currentIdx = 0;

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

  const hasAlternatives = optionsPerCourse.some(opts => opts.length > 1);

  if(schedules.length===0){
    summary.innerHTML = `<p class="empty-note">Alguna de tus materias se cruza en horario con otra y no es posible armar un horario sin choques. Revisa los días y horas, o agrega una sección alternativa para la materia que se cruza.</p>`;
    return;
  }

  if(schedules.length===1){
    summary.textContent = hasAlternatives
      ? 'Solo hay una forma de combinar tus materias sin que se crucen.'
      : 'Este es el horario con las materias que agregaste.';
  } else {
    summary.textContent = `Agregaste grupos alternativos, así que hay ${schedules.length} formas distintas de armar tu horario sin cruces. Elige una para verla:`;
    schedules.forEach((_, i)=>{
      const pill = document.createElement('button');
      pill.className = 'option-pill' + (i===currentIdx ? ' active' : '');
      pill.textContent = i+1;
      pill.title = `Opción ${i+1}`;
      pill.addEventListener('click', ()=>{ currentIdx = i; render(); });
      nav.appendChild(pill);
    });
  }

  function render(){
    nav.querySelectorAll('.option-pill').forEach((p,i)=> p.classList.toggle('active', i===currentIdx));
    renderGrid(schedules[currentIdx], colorMap);
  }
  render();
}

function renderGrid(schedule, colorMap){
  const view = document.getElementById('scheduleView');
  const activeDays = getActiveDays();
  const numDays = activeDays.length;
  const startHour = state.settings.hourStart, endHour = state.settings.hourEnd;
  const hourH = 36;
  const totalH = (endHour-startHour)*hourH;
  const labelColW = state.settings.timeFormat==='12' ? 60 : 46;
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
      ? `Grupo ${sec.group} · ${formatTimeStr(sec.start)}–${formatTimeStr(sec.end)}`
      : `${formatTimeStr(sec.start)}–${formatTimeStr(sec.end)}`;

    const left = labelColW + dayIndex[sec.day]*colWidth + 2;
    const c = colorMap[sec.course];
    const bg = dark ? c.dbg : c.bg;
    const text = dark ? c.dtext : c.text;
    blocksHtml += `<div class="block" style="top:${top}px; left:${left}px; width:${colWidth-6}px; height:${timeBasedHeight}px; background:${bg}; border-left-color:${c.border}; color:${text};">
      <div class="b-course">${sec.course}</div>
      <div class="b-meta">${timeLine}</div>
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
function applySettings(){
  document.documentElement.style.setProperty('--accent', state.settings.accent);
  document.body.classList.toggle('dark', state.settings.dark);
  document.getElementById('darkToggle').checked = state.settings.dark;
  document.getElementById('saturdayToggle').checked = state.settings.includeSaturday;
  document.getElementById('timeFormatToggle').checked = state.settings.timeFormat === '12';
  document.getElementById('materiasBody').classList.toggle('collapsed', !!state.settings.materiasCollapsed);
  document.getElementById('collapseMateriasBtn').classList.toggle('collapsed', !!state.settings.materiasCollapsed);
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
  hs.innerHTML = ''; he.innerHTML = '';
  for(let h=5; h<=12; h++) hs.innerHTML += `<option value="${h}" ${h===state.settings.hourStart?'selected':''}>${h}:00</option>`;
  for(let h=15; h<=23; h++) he.innerHTML += `<option value="${h}" ${h===state.settings.hourEnd?'selected':''}>${h}:00</option>`;
  hs.addEventListener('change', ()=>{
    state.settings.hourStart = parseInt(hs.value);
    saveState(); generate();
  });
  he.addEventListener('change', ()=>{
    state.settings.hourEnd = parseInt(he.value);
    saveState(); generate();
  });
}

document.getElementById('darkToggle').addEventListener('change', (e)=>{
  state.settings.dark = e.target.checked;
  saveState(); applySettings();
  generate();
});

document.getElementById('saturdayToggle').addEventListener('change', (e)=>{
  state.settings.includeSaturday = e.target.checked;
  saveState(); renderRows(); generate();
});

document.getElementById('timeFormatToggle').addEventListener('change', (e)=>{
  state.settings.timeFormat = e.target.checked ? '12' : '24';
  saveState(); generate();
});

document.getElementById('collapseMateriasBtn').addEventListener('click', ()=>{
  state.settings.materiasCollapsed = !state.settings.materiasCollapsed;
  saveState();
  applySettings();
});

document.getElementById('openShare').addEventListener('click', showShareModal);
document.getElementById('openImport').addEventListener('click', showImportModal);

document.getElementById('openCustomize').addEventListener('click', ()=>{
  document.getElementById('drawer').classList.add('open');
  document.getElementById('overlay').classList.add('open');
});
function closeDrawerFn(){
  document.getElementById('drawer').classList.remove('open');
  document.getElementById('overlay').classList.remove('open');
}
document.getElementById('closeDrawer').addEventListener('click', closeDrawerFn);
document.getElementById('overlay').addEventListener('click', closeDrawerFn);

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
  generate();
  if(!storageWorks){
    document.getElementById('storageNotice').style.display = 'block';
  }
}catch(e){
  showFatalError('No se pudo iniciar el planificador: ' + e.message);
}
