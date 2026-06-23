/* ━━━━ AUTH ━━━━ */
const STATE_KEY = 'divimo_state';
function ssGet(k){try{return localStorage.getItem(k);}catch(e){return null;}}
function ssSet(k,v){try{localStorage.setItem(k,v);}catch(e){}}
async function logout(){await sb.auth.signOut();window.location.href='connexion.html';}

let OWNER = null;
/* Remplace le titulaire de démo (« Marti »/« (vous) ») par le vrai nom de l'utilisateur,
   dans tous les groupes : co-indivisaires, quotes-parts, incidents. */
function applyOwnerName(){
  if(!OWNER || !GROUPES) return;
  const full = OWNER.full, short = OWNER.short, ini = OWNER.ini;
  const nameVous = (full||short) + ' (vous)';
  let changed = false;
  Object.values(GROUPES).forEach(g=>{
    if(!g) return;
    const owner = (g.coi||[]).find(c=>/\(vous\)/i.test(c.n||''));
    if(!owner) return;
    const oldIni = owner.ini, oldShort = (owner.n||'').replace(/\s*\(vous\)/i,'').trim();
    if(owner.n!==nameVous){ owner.n = nameVous; changed = true; }
    if(owner.ini!==ini){ owner.ini = ini; changed = true; }
    (g.biens||[]).forEach(b=>(b.parts||[]).forEach(p=>{
      if(p.ini===oldIni || p.name===oldShort){ if(p.name!==short||p.ini!==ini){ p.name=short; p.ini=ini; changed=true; } }
    }));
    (g.incidents||[]).forEach(it=>{ if(it.by===oldShort && it.by!==short){ it.by=short; changed=true; } });
  });
  if(changed) save();
}
function applyUser(user){
  const m = user.user_metadata || {};
  const prenom = (m.prenom||'').trim();
  const nom = (m.nom||'').trim();
  const name = prenom || user.email.split('@')[0];
  const initials = ((prenom[0]||'')+(nom[0]||'')).toUpperCase() || name.slice(0,2).toUpperCase();
  const isAdmin = m.role === 'admin';
  OWNER = { full:[prenom,nom].filter(Boolean).join(' ').trim() || name, short:prenom || name, ini:initials };
  applyOwnerName();

  /* Le header est géré par header-auth.js — on met à jour uniquement l'intérieur */
  document.getElementById('greet').textContent = 'Bonjour, ' + name;
  const profilAv = document.getElementById('profilAv');
  if(profilAv) profilAv.textContent = initials;
  const profilName = document.getElementById('profilName');
  if(profilName) profilName.textContent = [prenom,nom].filter(Boolean).join(' ') || name;
  const profilEmail = document.getElementById('profilEmail');
  if(profilEmail) profilEmail.textContent = user.email;
  if(isAdmin){
    const navAdmin = document.getElementById('nav-admin');
    if(navAdmin) navAdmin.style.display = 'flex';
    const adminName = document.getElementById('adminName');
    if(adminName) adminName.textContent = name;
    const bannerTitle = document.getElementById('bannerTitle');
    if(bannerTitle) bannerTitle.textContent = 'Espace Administrateur';
  }
}

function hideAppLoader(){ const l=document.getElementById('appLoader'); if(l){ l.classList.add('hide'); setTimeout(()=>{ if(l&&l.parentNode) l.parentNode.removeChild(l); }, 450); } }
(async()=>{
  const {data:{session}} = await sb.auth.getSession();
  if(!session){window.location.href='connexion.html';return;}
  applyUser(session.user);
  if(migrateBienLinks()) save(); else renderAll();
  hideAppLoader();
})();
/* Filet de sécurité : ne jamais laisser le loader bloqué */
window.addEventListener('load', ()=>setTimeout(hideAppLoader, 4000));

/* ━━━━ TOAST ━━━━ */
let _tt;
function toast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(_tt); _tt = setTimeout(()=>t.classList.remove('show'),2800);
}

/* ━━━━ ICÔNE & CONFIRMATION DE SUPPRESSION ━━━━ */
const DELSVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';
function askDelete(msg, onYes){
  let m = document.getElementById('confirmModal');
  if(!m){
    m = document.createElement('div'); m.id = 'confirmModal'; m.className = 'confirm-overlay';
    m.innerHTML = `<div class="confirm-box" role="dialog" aria-modal="true">
      <div class="confirm-ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/></svg></div>
      <h3>Confirmer la suppression</h3>
      <p id="confirmMsg"></p>
      <div class="confirm-actions">
        <button class="confirm-cancel" id="confirmNo">Annuler</button>
        <button class="confirm-del" id="confirmYes">Supprimer</button>
      </div>
    </div>`;
    document.body.appendChild(m);
    m.addEventListener('click', e=>{ if(e.target===m) closeConfirm(); });
    document.addEventListener('keydown', e=>{ if(e.key==='Escape' && m.classList.contains('show')) closeConfirm(); });
  }
  document.getElementById('confirmMsg').textContent = msg;
  const yes = document.getElementById('confirmYes');
  const fresh = yes.cloneNode(true); yes.parentNode.replaceChild(fresh, yes);
  fresh.addEventListener('click', ()=>{ closeConfirm(); onYes(); });
  document.getElementById('confirmNo').onclick = closeConfirm;
  requestAnimationFrame(()=>{ m.classList.add('show'); fresh.focus(); });
}
function closeConfirm(){ const m = document.getElementById('confirmModal'); if(m) m.classList.remove('show'); }

/* ━━━━ NAV ━━━━ */
function go(v){
  document.querySelectorAll('.nav-i').forEach(n=>n.classList.toggle('active',n.dataset.v===v));
  document.querySelectorAll('.view').forEach(w=>w.classList.toggle('active',w.id==='v-'+v));
  document.getElementById('siteHeader').classList.remove('open');
  window.scrollTo({top:0,behavior:'smooth'});
  if(v==='dash') setTimeout(animateDashboard,60);
  if(v==='carte')setTimeout(initMap,80);
  if(v==='votes') renderVotes();
  if(v==='messages'){ renderMessages(); setTimeout(scrollMsg,60); }
  if(v==='docs') renderDocs();
  if(v==='juri'){ renderJuri(); renderRdv(); }
  if(v==='fiscal') renderFiscal();
  if(v==='admin'){loadAdminData();clearInterval(window._adminTimer);window._adminTimer=setInterval(loadAdminData,30000);}
}
document.querySelectorAll('.nav-i').forEach(n=>n.onclick=()=>go(n.dataset.v));

/* ━━━━ STATE ━━━━ */
const DEFAULT = {
  biens:[
    {nom:'Maison familiale — Annecy',info:'74000 Annecy · 120 m²',val:'320 000 €',lat:45.8992,lng:6.1294,
     parts:[{ini:'MF',name:'Marti',pct:45},{ini:'PD',name:'Paul',pct:30},{ini:'LM',name:'Léa',pct:25}]},
    {nom:'Appartement — Lyon',info:'69003 Lyon · 58 m²',val:'265 000 €',lat:45.7640,lng:4.8357,
     parts:[{ini:'MF',name:'Marti',pct:50},{ini:'PD',name:'Paul',pct:50}]},
  ],
  docs:[
    {name:'Acte notarié.pdf',meta:'Marie · 2,4 Mo',ic:'file',bien:'Maison familiale — Annecy'},
    {name:'Factures travaux 2025',meta:'8 fichiers',ic:'receipt',bien:'Maison familiale — Annecy'},
    {name:'Relevé de charges.xlsx',meta:'Hier',ic:'spreadsheet',bien:'__all__'},
    {name:'Règlement copropriété.pdf',meta:'Lyon · 1,1 Mo',ic:'book',bien:'Appartement — Lyon'},
  ],
  coi:[{n:'Marti (vous)',r:'45% · Administrateur',ini:'MF',st:'Actif',cls:'pill-ok'},{n:'Paul Dupont',r:'30% · Co-indivisaire',ini:'PD',st:'Actif',cls:'pill-ok'},{n:'Léa Martin',r:'25% · Co-indivisaire',ini:'LM',st:'Invitée',cls:'pill-warn'}],
  juridique:[
    {name:'Maître Dubois',role:'Notaire',spec:'Indivision & successions',tel:'04 50 12 34 56',email:'dubois@etude-annecy.fr'},
    {name:'Maître Lambert',role:'Avocat',spec:'Droit immobilier & médiation',tel:'04 78 22 11 00',email:'lambert@avocat-lyon.fr'},
  ],
  loyers:[
    {id:'loy1', bien:'Appartement — Lyon', montant:1450, jour:5, freq:'mensuel', since:'2026-01'},
    {id:'loy2', bien:'Maison familiale — Annecy', montant:2400, jour:10, freq:'trimestriel', since:'2026-01'},
  ],
  loyerStatus:{'loy1|2026-01':{st:'recu'},'loy1|2026-02':{st:'recu'},'loy1|2026-03':{st:'recu'},'loy1|2026-04':{st:'recu'},'loy1|2026-05':{st:'recu'},'loy2|2026-01':{st:'recu'},'loy2|2026-04':{st:'recu'}},
  estim:[],rdv:[],
  events:[
    {titre:'Visite expert immobilier',date:'2026-06-20',type:'visite',lieu:'Maison Annecy',heure:'10:00'},
    {titre:'Réunion annuelle co-indivisaires',date:'2026-07-15',type:'reunion',lieu:'Annecy',heure:'18:30'},
    {titre:'Signature mandat de vente',date:'2026-07-02',type:'echeance',lieu:'Étude notariale',heure:'14:00'},
    {titre:'Échéance taxe foncière',date:'2026-10-15',type:'echeance',lieu:'',heure:''},
    {titre:'AG constitutive — Indivision Annecy',date:'2025-11-10',type:'reunion',lieu:'Annecy',heure:'17:00'},
    {titre:'Réunion entretien toiture',date:'2026-03-22',type:'reunion',lieu:'Visio',heure:'11:00'},
  ],
  transactions:[
    {desc:'Taxe foncière 2025',cat:'taxe',bien:'Maison Annecy',montant:-2400,date:'2026-10-15'},
    {desc:'Loyer saisonnier été',cat:'loyer',bien:'Maison Annecy',montant:1800,date:'2026-08-05'},
    {desc:'Facture plomberie',cat:'travaux',bien:'Maison Annecy',montant:-580,date:'2026-05-20'},
    {desc:'Charges copropriété T2',cat:'copro',bien:'Appt. Lyon',montant:-340,date:'2026-04-01'},
    {desc:'Assurance habitation',cat:'assurance',bien:'Maison Annecy',montant:-420,date:'2026-03-12'},
    {desc:'Loyer saisonnier printemps',cat:'loyer',bien:'Appt. Lyon',montant:1450,date:'2026-05-02'},
    {desc:'Facture énergie',cat:'energie',bien:'Maison Annecy',montant:-260,date:'2026-05-28'},
    {desc:'Travaux ravalement façade',cat:'travaux',bien:'Maison Annecy',montant:-3200,date:'2026-06-01'},
  ],
  inventaire:[
    {nom:'Canapé 3 places',val:'800 €',ic:'sofa',bien:'Maison familiale — Annecy'},
    {nom:'Table de jardin',val:'320 €',ic:'tree',bien:'Maison familiale — Annecy'},
    {nom:'Lit king size',val:'1 200 €',ic:'bed',bien:'Maison familiale — Annecy'},
    {nom:'Télévision 65"',val:'900 €',ic:'tv',bien:'Appartement — Lyon'},
    {nom:'Réfrigérateur',val:'650 €',ic:'fridge',bien:'Appartement — Lyon'},
    {nom:'Lave-linge',val:'480 €',ic:'washer',bien:'Appartement — Lyon'},
  ],
  incidents:[
    {titre:'Fuite au sous-sol', desc:'Infiltration repérée près de la chaudière.', cat:'degat_eaux', ic:'drop', bien:'Maison familiale — Annecy', statut:'encours', date:'2026-03-12', by:'Paul'},
    {titre:'Gouttière endommagée', desc:'Gouttière arrachée côté jardin après la tempête.', cat:'toiture', ic:'building', bien:'Maison familiale — Annecy', statut:'resolu', date:'2026-01-05', by:'Marti'},
  ],
  incidentsLog:[],
  /* Accès partagés : qui peut voir quoi (le propriétaire/admin a tout) */
  sharing:{
    'Paul Dupont':{planning:true, documents:true, budget:true, patrimoine:true},
    'Léa Martin':{planning:true, documents:true, budget:false, patrimoine:true},
  },
};
/* ═══════ GROUPES (multi-indivisions) ═══════
   S pointe toujours vers les données du groupe ACTIF → tout le code
   existant (S.biens, S.coi, …) fonctionne sans changement. */
const GROUPES_KEY = 'divimo_groupes';
const ACTIVE_KEY  = 'divimo_active';

/* Deuxième groupe de démonstration (autres personnes, autre indivision) */
const DEFAULT_GROUPE_2 = {
  nom:'SCI Les Oliviers — Marseille',
  biens:[
    {nom:'Villa — Marseille 8e',info:'13008 Marseille · 160 m²',val:'620 000 €',lat:43.2700,lng:5.3850,
     parts:[{ini:'MF',name:'Marti',pct:34},{ini:'SG',name:'Sophie',pct:33},{ini:'KR',name:'Karim',pct:33}]},
  ],
  docs:[
    {name:'Statuts SCI.pdf',meta:'2,0 Mo',ic:'book',bien:'__all__'},
    {name:'Bail commercial.pdf',meta:'Villa Marseille',ic:'file',bien:'Villa — Marseille 8e'},
  ],
  coi:[
    {n:'Marti (vous)',r:'34% · Gérant',ini:'MF',st:'Actif',cls:'pill-ok'},
    {n:'Sophie Garnier',r:'33% · Associée',ini:'SG',st:'Actif',cls:'pill-ok'},
    {n:'Karim Rabah',r:'33% · Associé',ini:'KR',st:'Actif',cls:'pill-ok'},
  ],
  juridique:[
    {name:'Maître Roux',role:'Notaire',spec:'Droit des sociétés & SCI',tel:'04 91 33 44 55',email:'roux@notaire-marseille.fr'},
    {name:'Cabinet Olivetti',role:'Expert-comptable',spec:'Fiscalité immobilière',tel:'04 91 77 88 99',email:'contact@olivetti-expertise.fr'},
  ],
  loyers:[{id:'loy1', bien:'Villa — Marseille 8e', montant:2600, jour:1, freq:'mensuel', since:'2026-01'}],
  loyerStatus:{'loy1|2026-01':{st:'recu'},'loy1|2026-02':{st:'recu'},'loy1|2026-03':{st:'recu'},'loy1|2026-04':{st:'recu'},'loy1|2026-05':{st:'recu'}},
  estim:[], rdv:[],
  events:[
    {titre:'AG annuelle SCI',date:'2026-09-30',type:'reunion',lieu:'Marseille',heure:'15:00'},
    {titre:'Échéance CFE',date:'2026-12-15',type:'echeance',lieu:'',heure:''},
  ],
  transactions:[
    {desc:'Loyer commercial T3',cat:'loyer',bien:'Villa — Marseille 8e',montant:2600,date:'2026-07-01'},
    {desc:'Taxe foncière',cat:'taxe',bien:'Villa — Marseille 8e',montant:-3100,date:'2026-10-15'},
  ],
  inventaire:[], incidents:[],
  sharing:{
    'Sophie Garnier':{planning:true,documents:true,budget:true,patrimoine:true},
    'Karim Rabah':{planning:true,documents:false,budget:true,patrimoine:true},
  },
};

function mkGroupe1(){ return Object.assign({nom:'Indivision familiale — Annecy & Lyon'}, JSON.parse(JSON.stringify(DEFAULT))); }
function defaultGroupes(){ return { g1: mkGroupe1(), g2: JSON.parse(JSON.stringify(DEFAULT_GROUPE_2)) }; }

function loadGroupes(){
  try{
    const raw = ssGet(GROUPES_KEY);
    if(raw){ const g = JSON.parse(raw); if(g && Object.keys(g).length) return g; }
    /* Migration : ancien état plat (1 seule indivision) → groupe g1 */
    const old = ssGet(STATE_KEY);
    if(old){
      const data = Object.assign(JSON.parse(JSON.stringify(DEFAULT)), JSON.parse(old));
      if(!data.nom) data.nom = 'Mon indivision';
      return { g1: data };
    }
  }catch(e){}
  return defaultGroupes();
}

/* Restauration des données de démo (régénère groupes/biens/budget/planning…)
   tout en conservant les biens ajoutés via le simulateur.
   Déclenché par ?restore=demo */
function restoreDemoData(){
  let salvaged=[];
  try{
    const raw=ssGet(GROUPES_KEY);
    if(raw){ const g=JSON.parse(raw);
      Object.values(g||{}).forEach(grp=>{ (grp&&grp.biens||[]).forEach(b=>{ if(b && b.info==='Ajouté depuis le simulateur') salvaged.push(b); }); });
    }
  }catch(e){}
  const demo=defaultGroupes();
  if(salvaged.length){
    const k=Object.keys(demo)[0];
    salvaged.forEach(b=>{ if(!demo[k].biens.some(x=>x.nom===b.nom)) demo[k].biens.push(b); });
  }
  ssSet(GROUPES_KEY, JSON.stringify(demo));
  ssSet(ACTIVE_KEY, Object.keys(demo)[0]);
}
if(location.search.indexOf('restore=demo')>-1){
  restoreDemoData();
  /* on retire le paramètre puis on recharge proprement */
  location.replace(location.pathname);
}

let GROUPES = loadGroupes();
let activeId = (function(){ try{ const a=ssGet(ACTIVE_KEY); if(a && GROUPES[a]) return a; }catch(e){} return Object.keys(GROUPES)[0]; })();
let S = GROUPES[activeId];

function save(){
  GROUPES[activeId] = S;
  ssSet(GROUPES_KEY, JSON.stringify(GROUPES));
  ssSet(ACTIVE_KEY, activeId);
  renderAll();
}
function switchGroupe(id){
  if(!GROUPES[id] || id===activeId){ closeGroupMenu(); return; }
  GROUPES[activeId] = S;
  activeId = id; S = GROUPES[id];
  ssSet(ACTIVE_KEY, id);
  migrateBienLinks();
  closeGroupMenu();
  go('dash');
  renderAll(); renderGroupSelector();
  toast('Groupe : ' + (S.nom||'—'));
}
function createGroupe(nom){
  const id = 'g' + Date.now().toString(36);
  GROUPES[id] = {
    nom: nom,
    biens:[], docs:[],
    coi:[{n:((OWNER&&(OWNER.full||OWNER.short))||'Vous')+' (vous)',r:'100% · Administrateur',ini:(OWNER&&OWNER.ini)||'MF',st:'Actif',cls:'pill-ok'}],
    estim:[], rdv:[], events:[], transactions:[], inventaire:[], incidents:[], sharing:{}, votes:[], messages:[], juridique:[], loyers:[], loyerStatus:{}
  };
  GROUPES[activeId] = S;
  activeId = id; S = GROUPES[id];
  ssSet(ACTIVE_KEY, id);
  save(); renderAll(); renderGroupSelector(); go('portfolio');
}
function deleteGroupe(id){
  if(Object.keys(GROUPES).length<=1){ toast('Vous devez garder au moins un groupe.'); return; }
  askDelete('Supprimer ce groupe et toutes ses données ? Cette action est définitive.', ()=>{
    delete GROUPES[id];
    if(activeId===id){ activeId=Object.keys(GROUPES)[0]; S=GROUPES[activeId]; }
    save(); renderAll(); renderGroupSelector();
    toast('Groupe supprimé.');
  });
}
function renameGroupe(id){
  const n = prompt('Renommer le groupe :', GROUPES[id]?.nom||''); if(!n)return;
  const nom = n.trim().slice(0,60);
  GROUPES[id].nom = nom;
  if(id===activeId) S.nom = nom;
  save(); renderGroupSelector();
}

/* ── UI sélecteur de groupe ── */
function groupInitials(nom){ return (nom||'?').split(/[\s—-]+/).filter(Boolean).map(w=>w[0]).join('').slice(0,2).toUpperCase()||'?'; }
function renderGroupSelector(){
  const el = document.getElementById('groupSelector');
  if(!el) return;
  const ids = Object.keys(GROUPES);
  const cur = GROUPES[activeId] || {};
  el.innerHTML = `
    <button class="gs-current" id="gsCurrent" onclick="toggleGroupMenu()">
      <span class="gs-ico">${groupInitials(cur.nom)}</span>
      <span class="gs-info">
        <span class="gs-label">Indivision</span>
        <span class="gs-name">${cur.nom||'—'}</span>
      </span>
      <svg class="gs-chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M6 9l6 6 6-6"/></svg>
    </button>
    <div class="gs-menu" id="gsMenu">
      ${ids.map((id,i)=>{
        const g=GROUPES[id]; const act=id===activeId;
        return `<div class="gs-item ${act?'active':''}" onclick="switchGroupe('${id}')">
          <span class="gs-item-ico" style="background:${PAL[i%PAL.length]}">${groupInitials(g.nom)}</span>
          <span class="gs-item-name">${g.nom||'—'}</span>
          ${act?'<svg class="gs-item-check" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 13l4 4L19 7"/></svg>':''}
          <span class="gs-item-actions">
            <button class="gs-mini" title="Renommer" onclick="event.stopPropagation();renameGroupe('${id}')"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></button>
            ${ids.length>1?`<button class="gs-mini del" title="Supprimer" onclick="event.stopPropagation();deleteGroupe('${id}')"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></button>`:''}
          </span>
        </div>`;
      }).join('')}
      <div class="gs-create" onclick="openGroupModal()">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 5v14M5 12h14"/></svg>
        Nouveau groupe
      </div>
    </div>`;
}
function toggleGroupMenu(){
  document.getElementById('gsCurrent')?.classList.toggle('open');
  document.getElementById('gsMenu')?.classList.toggle('open');
}
function closeGroupMenu(){
  document.getElementById('gsCurrent')?.classList.remove('open');
  document.getElementById('gsMenu')?.classList.remove('open');
}
document.addEventListener('click',e=>{ if(!e.target.closest('#groupSelector'))closeGroupMenu(); });
function openGroupModal(){ closeGroupMenu(); document.getElementById('groupName').value=''; document.getElementById('groupModal').classList.add('open'); setTimeout(()=>document.getElementById('groupName').focus(),60); }
function closeGroupModal(){ document.getElementById('groupModal').classList.remove('open'); }
function saveGroupModal(){
  const n=document.getElementById('groupName').value.trim();
  if(!n){ toast('Donnez un nom au groupe.'); return; }
  closeGroupModal(); createGroupe(n); renderGroupSelector(); toast('Groupe « '+n+' » créé.');
}

const PAL=['#2C5282','#2D6A6A','#4A7FB5','#4A9B8E','#1E3A5F','#3D7A7A'];
const ICONS=['file','receipt','spreadsheet','clipboard','image'];

/* ━━━━ RENDERERS ━━━━ */
function renderAll(){
  renderKpis(); renderDashBiens(); renderDashChart(); renderPortfolio(); renderDocs(); renderCoi();
  renderEstim(); renderRdv(); renderJuri(); renderFiscal(); renderEvents();
  renderBudget(); renderInventaire(); renderIncidents(); renderSharing();
  renderVotes(); renderMessages();
}

function renderKpis(){
  const v = S.biens[0]?.val || '—';
  document.getElementById('kBiens').textContent = S.biens.length;
  document.getElementById('kCoi').textContent = S.coi.length;
  document.getElementById('kDocs').textContent = S.docs.length;
  document.getElementById('kEstim').textContent = S.estim.length;
  document.getElementById('ptBiens').textContent = S.biens.length;
  document.getElementById('ptCoi').textContent = S.coi.length;
  document.getElementById('ptDocs').textContent = S.docs.length;
  // valeur totale (somme grossière)
  const totalStr = S.biens.map(b=>(b.val||'0').replace(/\s|€/g,'').replace(',','.')).reduce((a,b)=>a+(parseFloat(b)||0),0);
  document.getElementById('ptValeur').textContent = totalStr.toLocaleString('fr-FR',{maximumFractionDigits:0})+' €';
}

/* Valeur numérique d'un bien à partir de sa chaîne "320 000 €" */
function bienVal(b){ return parseFloat(String(b?.val||'0').replace(/[\s€]/g,'').replace(',','.'))||0; }
/* Co-indivisaire correspondant à l'utilisateur connecté (marqué "(vous)") */
function meCoi(){ return S.coi.find(c=>/\(vous\)/i.test(c.n||'')) || S.coi[0] || null; }

/* Tableau de bord : vue globale de TOUS les biens + ma quote-part par bien */
function renderDashBiens(){
  const el = document.getElementById('dashBiens'); if(!el) return;
  const me = meCoi();
  const meIni = me ? me.ini : null;
  const meName = me ? (me.n||'').replace(/\s*\(vous\)/i,'').trim().toLowerCase() : '';
  let total = 0, myTotal = 0;
  const rows = S.biens.map(b=>{
    const val = bienVal(b); total += val;
    const part = bienParts(b).find(p =>
      (meIni && p.ini===meIni) || (meName && (p.name||'').trim().toLowerCase()===meName));
    const pct = part ? (+part.pct||0) : 0;
    const myVal = val*pct/100; myTotal += myVal;
    return `<div class="db-row" onclick="go('portfolio')" title="Voir le détail du bien">
      <div class="db-ico">${svgIcon('home',18)}</div>
      <div class="db-main">
        <div class="db-name">${b.nom||'Bien'}</div>
        <div class="db-meta">${b.info||''}</div>
      </div>
      <div class="db-fig">
        <div class="db-val">${eur(val)}</div>
        <div class="db-share">${pct ? ('ma part '+pct+'% · '+eur(myVal)) : 'pas de part'}</div>
      </div>
    </div>`;
  }).join('') || '<div class="empty"><div class="empty-ic">'+svgIcon('home',24)+'</div>Aucun bien dans cette indivision.</div>';
  el.innerHTML = rows;
  const tv=document.getElementById('dashTotalVal'); if(tv) tv.textContent = eur(total);
  const mv=document.getElementById('dashMyVal');   if(mv) mv.textContent = eur(myTotal);
  const mp=document.getElementById('dashMyPct');
  if(mp) mp.textContent = total>0 ? ('soit '+Math.round(myTotal/total*100)+'% du patrimoine') : '';
}

/* Tableau de bord : donut de répartition de la VALEUR totale du patrimoine
   par co-indivisaire (somme de sa quote-part sur tous les biens) */
function renderDashChart(){
  const el = document.getElementById('dashChart'); if(!el) return;
  const map = {}; let grand = 0;
  S.biens.forEach(b=>{
    const val = bienVal(b);
    bienParts(b).forEach(p=>{
      const k = (p.name||p.ini||'').trim().toLowerCase(); if(!k) return;
      if(!map[k]) map[k] = {name:(p.name||p.ini||'').trim(), ini:p.ini||'?', val:0};
      const v = val*(+p.pct||0)/100;
      map[k].val += v; grand += v;
    });
  });
  const people = Object.values(map).sort((a,b)=>b.val-a.val);
  if(!people.length || grand<=0){
    el.innerHTML = '<div class="empty"><div class="empty-ic">'+svgIcon('chart',24)+'</div>Ajoutez un bien et ses parts pour voir la répartition.</div>';
    return;
  }
  const _me = meCoi()||{};
  const meIni = _me.ini;
  const meName = (_me.n||'').replace(/\s*\(vous\)/i,'').trim().toLowerCase();
  let off = 0;
  const segs = people.map((p,i)=>{
    const pct = p.val/grand*100;
    const c = `<circle cx="21" cy="21" r="15.9" fill="none" stroke="${PAL[i%PAL.length]}" stroke-width="5.5" stroke-dasharray="${pct.toFixed(2)} ${(100-pct).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}"/>`;
    off += pct; return c;
  }).join('');
  const legend = people.map((p,i)=>{
    const pct = Math.round(p.val/grand*100);
    const you = (p.ini===meIni || (p.name||'').trim().toLowerCase()===meName) ? ' <span class="db-share">(vous)</span>' : '';
    return `<span><i style="background:${PAL[i%PAL.length]}"></i>${p.name} (${pct}%)${you} <b>${eur(p.val)}</b></span>`;
  }).join('');
  el.innerHTML = `
    <svg width="150" height="150" viewBox="0 0 42 42" style="transform:rotate(-90deg);flex-shrink:0">
      <circle cx="21" cy="21" r="15.9" fill="none" stroke="#EEF2F8" stroke-width="5.5"/>
      ${segs}
    </svg>
    <div class="legend">${legend}</div>`;
}

/* Parts d'un bien : utilise bien.parts, sinon les parts globales (coiParts) */
function bienParts(b){
  if(b && Array.isArray(b.parts) && b.parts.length) return b.parts;
  return coiParts().map(p=>({ini:p.ini,name:p.name,pct:p.pct}));
}

/* ── Identifiants stables des biens + résolution des références ──
   Tout (transactions, loyers, fiscalité) se rattache à un bien par son id.
   resolveBien() accepte un id, un nom exact, ou un ancien libellé informel
   (tolérance par mots communs), pour migrer les données existantes. */
function ensureBienIds(){
  let changed=false;
  (S.biens||[]).forEach(b=>{ if(b && !b.id){ b.id='b'+Math.random().toString(36).slice(2,9); changed=true; } });
  return changed;
}
function bienById(id){ return (S.biens||[]).find(b=>b.id===id) || null; }
function _bienToks(s){ return (String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').match(/[a-z0-9]{4,}/g)||[]); }
function resolveBien(ref){
  if(!ref || ref==='__all__' || ref==='Commun') return null;
  let b=bienById(ref); if(b) return b;
  b=(S.biens||[]).find(x=>x.nom===ref); if(b) return b;
  const rt=_bienToks(ref); if(!rt.length) return null;
  return (S.biens||[]).find(x=>{ const bt=new Set(_bienToks(x.nom)); return rt.some(t=>bt.has(t)); }) || null;
}
function bienOfTx(t){ return t ? resolveBien(t.bienId || t.bien) : null; }
function migrateBienLinks(){
  let changed=ensureBienIds();
  (S.transactions||[]).forEach(t=>{ if(t && t.bienId===undefined && t.bien && t.bien!=='__all__' && t.bien!=='Commun'){ const b=resolveBien(t.bien); if(b){ t.bienId=b.id; changed=true; } } });
  (S.loyers||[]).forEach(l=>{ if(l && l.bienId===undefined && l.bien){ const b=resolveBien(l.bien); if(b){ l.bienId=b.id; changed=true; } } });
  return changed;
}

function renderPortfolio(){
  const g = document.getElementById('portfolioGrid');
  if(!g) return;
  g.innerHTML = S.biens.map((b,i)=>{
    const parts = bienParts(b);
    const sum = parts.reduce((a,p)=>a+(+p.pct||0),0);
    const nDocs = S.docs.filter(d=>d.bien===b.nom || d.bien==='__all__').length;
    const cover = (b.photos && b.photos.length)
      ? `<div class="bien-card-cover" style="background-image:url('${b.photos[0]}')"></div>`
      : `<div class="bien-card-ico">${svgIcon(bienIcon(b.type),22)}</div>`;
    return `<div class="bien-card">
      ${cover}
      <div class="bien-card-name">${b.nom}</div>
      <div class="bien-card-meta">${b.info}</div>
      <div class="bien-card-val">${b.val}</div>
      <div class="bien-parts">
        ${parts.map((p,j)=>`<div class="bp-row">
          <span class="bp-ini" style="background:${PAL[j%PAL.length]}">${p.ini}</span>
          <span class="bp-name">${p.name}</span>
          <span class="bp-pct">${p.pct}%</span>
        </div>`).join('')}
      </div>
      <div class="bien-card-pills">
        <span class="pill ${pctComplete(sum)?'pill-ok':'pill-warn'}">${parts.length} part${parts.length>1?'s':''} · ${pctDisplay(sum)}%</span>
        <span class="pill pill-info">${nDocs} doc${nDocs>1?'s':''}</span>
        <span class="del" onclick="askDelete('Supprimer ce bien ?', ()=>{ S.biens.splice(${i},1); save(); })" title="Supprimer" style="margin-left:auto">${DELSVG}</span>
      </div>
      <div class="bien-manage" onclick="openPartsModal(${i})">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>
        Gérer les parts
      </div>
    </div>`;
  }).join('') || '<div class="empty"><div class="empty-ic">'+svgIcon('home',24)+'</div>Aucun bien. Ajoutez votre premier bien ci-dessus.</div>';
}

/* ── MODAL QUOTE-PARTS PAR BIEN ── */
let partsEditIdx = -1, partsDraft = [];
function openPartsModal(idx){
  partsEditIdx = idx;
  const b = S.biens[idx];
  document.getElementById('partsBienName').textContent = b.nom;
  partsDraft = bienParts(b).map(p=>({ini:p.ini||'',name:p.name||'',pct:+p.pct||0}));
  renderPartsRows();
  document.getElementById('partsModal').classList.add('open');
}
function closePartsModal(){ document.getElementById('partsModal').classList.remove('open'); }
function renderPartsRows(){
  document.getElementById('partsRows').innerHTML = partsDraft.map((p,i)=>`
    <div class="parts-edit-row">
      <input type="text" placeholder="Prénom" value="${(p.name||'').replace(/"/g,'&quot;')}" oninput="partsDraft[${i}].name=this.value;refreshIni(${i})">
      <div style="position:relative"><input type="number" min="0" max="100" step="any" placeholder="0" value="${p.pct}" oninput="partsDraft[${i}].pct=+this.value;updatePartsSum()" style="padding-right:28px"><span style="position:absolute;right:9px;top:50%;transform:translateY(-50%);color:var(--texte-doux);font-size:.8rem">%</span></div>
      <button class="del-btn" onclick="askDelete('Retirer ce co-indivisaire ?', ()=>{ partsDraft.splice(${i},1); renderPartsRows(); })" title="Supprimer">${DELSVG}</button>
    </div>`).join('');
  updatePartsSum();
}
function refreshIni(i){
  const n=(partsDraft[i].name||'').trim();
  partsDraft[i].ini = n.split(/\s+/).map(w=>w[0]||'').join('').slice(0,2).toUpperCase() || '?';
}
function addPartRow(){ partsDraft.push({ini:'?',name:'',pct:0}); renderPartsRows(); }
/* Répartition à parts STRICTEMENT égales : chacun 100/n (ex. 3 → 33,33 chacun) */
function equalShares(n){ if(n<=0) return []; const v=Math.round(10000/n)/100; return Array(n).fill(v); }
/* Total considéré complet si arrondi à 100 (tolère l'arrondi des parts égales) */
function pctComplete(sum){ return Math.round(sum)===100; }
function pctDisplay(sum){ return pctComplete(sum)?100:Math.round(sum*100)/100; }
function partsEqual(){ const n=partsDraft.length; if(!n){ toast('Ajoutez d’abord des co-indivisaires.'); return; } const sh=equalShares(n); partsDraft.forEach((p,i)=>{ p.pct=sh[i]; }); renderPartsRows(); updatePartsSum(); }
function updatePartsSum(){
  const sum = partsDraft.reduce((a,p)=>a+(+p.pct||0),0);
  document.getElementById('partsSum').innerHTML = `<span class="parts-sum ${pctComplete(sum)?'ok':'bad'}">Total : ${pctDisplay(sum)}%${pctComplete(sum)?' ✓':' — doit faire 100%'}</span>`;
}
function savePartsModal(){
  const sum = partsDraft.reduce((a,p)=>a+(+p.pct||0),0);
  if(!pctComplete(sum)){ toast('Le total des parts doit faire 100%.'); return; }
  if(partsDraft.some(p=>!p.name.trim())){ toast('Renseignez tous les prénoms.'); return; }
  partsDraft.forEach(p=>{ if(!p.ini||p.ini==='?'){ p.ini=p.name.trim().split(/\s+/).map(w=>w[0]||'').join('').slice(0,2).toUpperCase()||'?'; }});
  S.biens[partsEditIdx].parts = partsDraft.map(p=>({ini:p.ini,name:p.name.trim(),pct:+p.pct}));
  closePartsModal(); save(); toast('Quote-parts mises à jour.');
}

/* ── DOCUMENTS (filtrables par bien) ── */
let docFilter = '__all_filter__';
function renderDocs(){
  const el = document.getElementById('docsList');
  if(!el) return;
  /* Sélecteur d'upload (garde la valeur courante) */
  const up = document.getElementById('docUploadBien');
  if(up){
    const cur = up.value;
    up.innerHTML = `<option value="__all__">Tous les biens (commun)</option>`
      + S.biens.map(b=>`<option value="${b.nom.replace(/"/g,'&quot;')}">${b.nom}</option>`).join('');
    if(cur && [...up.options].some(o=>o.value===cur)) up.value=cur;
  }
  /* Barre de filtres par bien */
  const fb = document.getElementById('docFilterBar');
  if(fb){
    fb.innerHTML = `<span class="bf-chip${docFilter==='__all_filter__'?' sel':''}" onclick="docFilter='__all_filter__';renderDocs()">Tous</span>`
      + S.biens.map(b=>`<span class="bf-chip${docFilter===b.nom?' sel':''}" onclick="docFilter='${b.nom.replace(/'/g,"\\'")}';renderDocs()">${b.nom.split('—')[0].trim()}</span>`).join('')
      + `<span class="bf-chip${docFilter==='__all__'?' sel':''}" onclick="docFilter='__all__';renderDocs()">Communs</span>`;
  }
  const list = S.docs.map((d,i)=>({...d,i})).filter(d=>{
    if(docFilter==='__all_filter__') return true;
    if(docFilter==='__all__') return d.bien==='__all__';
    return d.bien===docFilter || d.bien==='__all__';
  });
  el.innerHTML = list.map(d=>{
    const isAll = d.bien==='__all__';
    const bienLabel = isAll ? 'Tous les biens' : (d.bien? d.bien.split('—')[0].trim() : '—');
    return `<div class="row-item">
      <div class="r-ic" style="background:rgba(44,82,130,.08)">${svgIcon('file',18)}</div>
      <div style="flex:1;min-width:0"><b>${d.name}</b><span>${d.meta} · <span class="doc-bien-tag ${isAll?'all':''}">${bienLabel}</span></span></div>
      <div class="row-act"><span class="mini-link" onclick="toast('Téléchargement — bientôt disponible.')">Télécharger</span><span class="del" onclick="askDelete('Supprimer ce document ?', ()=>{ S.docs.splice(${d.i},1); save(); })" title="Supprimer">${DELSVG}</span></div>
    </div>`;
  }).join('') || '<div class="empty"><div class="empty-ic">'+svgIcon('folder',24)+'</div>Aucun document pour ce filtre.</div>';
}

function renderCoi(){
  const el = document.getElementById('coiList');
  if(!el) return;
  el.innerHTML = S.coi.map((c,i)=>`
    <div class="row-item">
      <div class="r-ic" style="background:linear-gradient(135deg,${PAL[i%PAL.length]},${PAL[(i+1)%PAL.length]});color:#fff;font-family:'Montserrat';font-weight:700;font-size:.75rem">${c.ini}</div>
      <div><b>${c.n}</b><span>${c.r}</span></div>
      <div class="row-act"><span class="pill ${c.cls}">${c.st}</span>${i>0?`<span class="del" onclick="askDelete('Retirer ce co-indivisaire ?', ()=>{ S.coi.splice(${i},1); save(); })" title="Supprimer">${DELSVG}</span>`:''}</div>
    </div>`).join('');
}

/* ── PARTAGE & ACCÈS ── */
const SHARE_ITEMS = [
  {key:'planning',   ico:'calendar', label:'Planning'},
  {key:'documents',  ico:'folder', label:'Documents'},
  {key:'budget',     ico:'coins', label:'Budget'},
  {key:'patrimoine', ico:'home', label:'Patrimoine'},
];
function renderSharing(){
  const el = document.getElementById('shareList');
  if(!el) return;
  if(!S.sharing) S.sharing = {};
  el.innerHTML = S.coi.map((c,i)=>{
    const isOwner = /vous/i.test(c.n) || i===0;
    const conf = S.sharing[c.n] || (isOwner ? {planning:true,documents:true,budget:true,patrimoine:true} : {planning:true,documents:true,budget:false,patrimoine:true});
    return `<div class="share-card">
      <div class="share-head">
        <div class="share-av" style="background:linear-gradient(135deg,${PAL[i%PAL.length]},${PAL[(i+1)%PAL.length]})">${c.ini}</div>
        <div class="share-id">
          <div class="share-name">${c.n.replace(/\s*\(vous\)/i,'')}${isOwner?'<span class="you">vous · propriétaire</span>':''}</div>
          <div class="share-role">${c.r}</div>
        </div>
        ${!isOwner?`<span class="pill ${c.cls}">${c.st}</span>`:''}
      </div>
      <div class="share-grid ${isOwner?'share-locked':''}">
        ${SHARE_ITEMS.map(it=>{
          const on = isOwner ? true : !!conf[it.key];
          return `<div class="share-toggle ${on?'on':''}">
            <span class="st-ico">${svgIcon(it.ico,18)}</span>
            <span class="st-label">${it.label}</span>
            <button class="tgl ${on?'on':''}" ${isOwner?'disabled':`onclick="toggleShare('${c.n.replace(/'/g,"\\'")}','${it.key}')"`}></button>
          </div>`;
        }).join('')}
      </div>
      ${isOwner?'<div style="font-size:.74rem;color:var(--texte-doux);margin-top:8px">En tant que propriétaire, vous avez accès à tout.</div>':''}
    </div>`;
  }).join('');
}
function toggleShare(name, key){
  if(!S.sharing[name]) S.sharing[name] = {planning:true,documents:true,budget:false,patrimoine:true};
  S.sharing[name][key] = !S.sharing[name][key];
  save();
  toast(S.sharing[name][key] ? 'Accès activé.' : 'Accès retiré.');
}
function copyShareLink(){
  const link = 'https://divimo.vercel.app/invitation/' + Math.random().toString(36).slice(2,10);
  if(navigator.clipboard){ navigator.clipboard.writeText(link).then(()=>toast('Lien d\'invitation copié.')); }
  else { toast('Lien : ' + link); }
}

/* Simulations : stockage dédié, totalement séparé des biens/patrimoine */
function divimoSims(){ try{ const a=JSON.parse(ssGet('divimo_sims')||'[]'); return Array.isArray(a)?a:[]; }catch(e){ return []; } }
function deleteSim(idx){ askDelete('Supprimer cette simulation enregistrée ?', ()=>{ const a=divimoSims(); a.splice(idx,1); ssSet('divimo_sims', JSON.stringify(a)); renderEstim(); toast('Simulation supprimée.'); }); }
function renderEstim(){
  const el = document.getElementById('estimList');
  if(!el) return;
  const TYP={estimation:{ic:'chart',lbl:'Estimation'},parts:{ic:'chart',lbl:'Calcul des parts'},vente:{ic:'key',lbl:'Vente / rachat'}};
  const sims = divimoSims();
  el.innerHTML = sims.map((e,i)=>{
    const t=TYP[e.type]||{ic:'chart',lbl:'Simulation'};
    const date=e.date?new Date(e.date).toLocaleDateString('fr-FR'):'';
    const sub=[e.bien,date].filter(Boolean).join(' · ');
    const lines=(e.lines||[]).map(l=>`<div class="sim-det-row"><span>${l[0]}</span><b>${l[1]}</b></div>`).join('');
    const body = lines || `<div class="sim-det-row"><span>${e.detail||'Aucun détail'}</span><b></b></div>`;
    return `<details class="sim-item">
      <summary>
        <span class="r-ic" style="background:rgba(44,82,130,.1)">${svgIcon(t.ic,18)}</span>
        <span class="sim-main"><b>${e.titre||t.lbl}</b><span>${sub||e.detail||''}</span></span>
        <span class="del" onclick="event.preventDefault();event.stopPropagation();deleteSim(${i})" title="Supprimer">${DELSVG}</span>
      </summary>
      <div class="sim-det">${body}</div>
    </details>`;
  }).join('') || '<div class="empty"><div class="empty-ic">'+svgIcon('chart',24)+'</div>Aucune simulation enregistrée.</div>';
}

function renderRdv(){
  const el = document.getElementById('rdvList');
  if(!el) return;
  el.innerHTML = S.rdv.map((r,i)=>{
    const sub=[r.when||'', r.motif?('Motif : '+r.motif):''].filter(Boolean).join(' · ');
    return `<div class="row-item">
      <div class="r-ic" style="background:rgba(45,106,106,.1)">${svgIcon('scale',18)}</div>
      <div style="flex:1;min-width:0"><b>${cEsc(r.pro)}</b><span>${cEsc(sub)}</span></div>
      <div class="row-act"><span class="pill pill-warn">En attente</span><span class="del" onclick="askDelete('Annuler cette demande de rendez-vous ?', ()=>{ S.rdv.splice(${i},1); save(); })" title="Supprimer">${DELSVG}</span></div>
    </div>`;
  }).join('') || '<div class="empty"><div class="empty-ic">'+svgIcon('scale',24)+'</div>Aucun rendez-vous planifié.</div>';
}

/* ── CONTACTS JURIDIQUES (privés à chaque indivision) ── */
function juriIni(name){ return String(name||'').replace(/^(maître|maitre|me|cabinet|étude|etude|sci)\s+/i,'').split(/\s+/).filter(Boolean).map(w=>w[0]).join('').slice(0,2).toUpperCase()||'?'; }
function renderJuri(){
  const el=document.getElementById('juriList'); if(!el) return;
  if(!Array.isArray(S.juridique)) S.juridique=[];
  const list=S.juridique;
  if(!list.length){ el.innerHTML='<div class="empty"><div class="empty-ic">'+svgIcon('scale',24)+'</div>Aucun contact juridique. Ajoutez votre notaire, avocat ou conseil — ils resteront privés à cette indivision.</div>'; return; }
  el.innerHTML=list.map((c,i)=>{
    const sub=[c.role,c.spec].filter(Boolean).join(' · ');
    const coord=[c.tel,c.email].filter(Boolean).join(' · ');
    const nm=String(c.name||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    return `<div class="row-item">
      <div class="r-ic" style="background:linear-gradient(135deg,var(--navy),var(--accent));color:#fff;font-family:'Montserrat';font-weight:700;font-size:.78rem">${cEsc(juriIni(c.name))}</div>
      <div style="flex:1;min-width:0"><b>${cEsc(c.name)}</b><span>${cEsc(sub)}${coord?' · '+cEsc(coord):''}</span></div>
      <div class="row-act"><button class="btn btn-ghost btn-sm" onclick="book('${nm}')">Rendez-vous</button><span class="mini-link" onclick="openJuriModal(${i})">Modifier</span><span class="del" onclick="deleteJuri(${i})" title="Supprimer">${DELSVG}</span></div>
    </div>`;
  }).join('');
}
let juriEditIdx=-1;
function openJuriModal(idx){
  juriEditIdx=(typeof idx==='number')?idx:-1;
  const c=(juriEditIdx>=0 && S.juridique)?S.juridique[juriEditIdx]:null;
  document.getElementById('juriModalTitle').textContent=c?'Modifier le contact':'Ajouter un contact';
  document.getElementById('juriNom').value=c?c.name||'':'';
  document.getElementById('juriRole').value=c?(c.role||'Notaire'):'Notaire';
  document.getElementById('juriSpec').value=c?c.spec||'':'';
  document.getElementById('juriTel').value=c?c.tel||'':'';
  document.getElementById('juriEmail').value=c?c.email||'':'';
  document.getElementById('juriModal').classList.add('open');
  setTimeout(()=>document.getElementById('juriNom').focus(),50);
}
function closeJuriModal(){ document.getElementById('juriModal').classList.remove('open'); }
function saveJuri(){
  const name=document.getElementById('juriNom').value.trim();
  if(!name){ toast('Indiquez au moins un nom.'); return; }
  const c={ name,
    role:document.getElementById('juriRole').value,
    spec:document.getElementById('juriSpec').value.trim(),
    tel:document.getElementById('juriTel').value.trim(),
    email:document.getElementById('juriEmail').value.trim() };
  if(!Array.isArray(S.juridique)) S.juridique=[];
  if(juriEditIdx>=0) S.juridique[juriEditIdx]=c; else S.juridique.unshift(c);
  closeJuriModal(); save(); renderJuri(); toast(juriEditIdx>=0?'Contact mis à jour.':'Contact ajouté.');
}
function deleteJuri(i){
  if(!S.juridique||!S.juridique[i]) return;
  askDelete('Supprimer « '+S.juridique[i].name+' » de vos contacts juridiques ?', ()=>{
    S.juridique.splice(i,1); save(); renderJuri(); toast('Contact supprimé.');
  });
}

/* ═══════ CALENDRIER ═══════ */
const EVTYPES = {
  reunion:  {label:'Réunion',  color:'#2C5282', bg:'rgba(44,82,130,.12)'},
  echeance: {label:'Échéance', color:'#C8821E', bg:'rgba(200,130,30,.14)'},
  visite:   {label:'Visite',   color:'#2D6A6A', bg:'rgba(45,106,106,.13)'},
  autre:    {label:'Autre',    color:'#6B7280', bg:'rgba(107,114,128,.13)'},
};
function evType(t){ return EVTYPES[t] || EVTYPES.autre; }

const _todayISO = new Date().toISOString().slice(0,10);
let calCursor = new Date();           // mois affiché
let selectedDay = _todayISO;          // jour sélectionné (YYYY-MM-DD)
let evEditType = 'reunion';           // type courant dans le modal

function ymd(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function frDate(iso){ const d=new Date(iso+'T00:00:00'); return d.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'}); }

/* renderEvents = point d'entrée appelé par renderAll() et save() */
function renderEvents(){ renderCalendar(); renderDayPanel(); renderUpcoming(); }

function renderUpcoming(){
  const el = document.getElementById('upcomingList');
  const sub = document.getElementById('upcomingSub');
  if(!el) return;
  const up = S.events
    .map((e,idx)=>({...e,idx}))
    .filter(e=>e.date>=_todayISO)
    .sort((a,b)=>(a.date+ (a.heure||'')).localeCompare(b.date+(b.heure||'')))
    .slice(0,6);
  if(sub) sub.textContent = up.length ? up.length+' à venir' : 'Aucun événement à venir';
  if(!up.length){
    el.innerHTML = '<div class="cal-side-empty"><div class="ic">'+svgIcon('calendar',22)+'</div>Rien de prévu.</div>';
    return;
  }
  const today = new Date(_todayISO+'T00:00:00');
  el.innerHTML = up.map(e=>{
    const t = evType(e.type);
    const d = new Date(e.date+'T00:00:00');
    const diff = Math.round((d-today)/86400000);
    const cd = diff===0?'Auj.':diff===1?'Demain':'J-'+diff;
    const soon = diff<=3;
    return `<div class="up-ev" onclick="selectDay('${e.date}');calCursor=new Date('${e.date}T00:00:00');renderCalendar();">
      <div class="up-date"><div class="ud-day">${d.getDate()}</div><div class="ud-mon">${d.toLocaleString('fr-FR',{month:'short'})}</div></div>
      <div class="up-body" style="border-color:${t.color}">
        <div class="up-title">${e.titre}</div>
        <div class="up-meta">${e.heure?e.heure+' · ':''}${e.lieu||t.label}</div>
      </div>
      <span class="up-countdown${soon?' soon':''}">${cd}</span>
    </div>`;
  }).join('');
}

function renderCalendar(){
  const grid = document.getElementById('calGrid');
  const title = document.getElementById('calTitle');
  if(!grid || !title) return;

  const year = calCursor.getFullYear(), month = calCursor.getMonth();
  title.textContent = calCursor.toLocaleDateString('fr-FR',{month:'long',year:'numeric'});

  /* Premier lundi de la grille */
  const first = new Date(year, month, 1);
  let startDow = (first.getDay()+6)%7;          // 0 = lundi
  const start = new Date(year, month, 1 - startDow);

  /* Compter les événements par jour */
  const byDay = {};
  S.events.forEach(e => { (byDay[e.date] = byDay[e.date] || []).push(e); });

  let cells = '';
  for(let i=0; i<42; i++){
    const d = new Date(start); d.setDate(start.getDate()+i);
    const iso = ymd(d);
    const isOther = d.getMonth() !== month;
    const isToday = iso === _todayISO;
    const isSel = iso === selectedDay;
    const evs = (byDay[iso]||[]).slice().sort((a,b)=>(a.heure||'').localeCompare(b.heure||''));

    let chips = '';
    evs.slice(0,3).forEach(e => {
      const t = evType(e.type);
      chips += `<div class="cal-chip" style="background:${t.bg};color:${t.color}" title="${e.titre.replace(/"/g,'&quot;')}">${e.heure?e.heure+' ':''}${e.titre}</div>`;
    });
    if(evs.length>3) chips += `<div class="cal-more">+${evs.length-3}</div>`;

    cells += `<div class="cal-cell${isOther?' other':''}${isToday?' today':''}${isSel?' selected':''}" onclick="selectDay('${iso}')">
      <div class="cal-num">${d.getDate()}</div>
      <div class="cal-events">${chips}</div>
    </div>`;
  }
  grid.innerHTML = cells;
}

function renderDayPanel(){
  const dateEl = document.getElementById('calSideDate');
  const subEl = document.getElementById('calSideSub');
  const listEl = document.getElementById('calSideEvents');
  if(!dateEl||!listEl) return;

  dateEl.textContent = frDate(selectedDay);
  const evs = S.events.map((e,idx)=>({...e,idx}))
    .filter(e=>e.date===selectedDay)
    .sort((a,b)=>(a.heure||'').localeCompare(b.heure||''));
  subEl.textContent = evs.length ? evs.length+' événement'+(evs.length>1?'s':'') : 'Aucun événement ce jour';

  if(!evs.length){
    listEl.innerHTML = '<div class="cal-side-empty"><div class="ic">'+svgIcon('calendar',22)+'</div>Rien de prévu.<br>Ajoutez un événement ci-dessous.</div>';
    return;
  }
  listEl.innerHTML = evs.map(e=>{
    const t = evType(e.type);
    return `<div class="cal-ev">
      <div class="cal-ev-bar" style="background:${t.color}"></div>
      <div class="cal-ev-body">
        <div class="cal-ev-title">${e.titre}</div>
        <div class="cal-ev-meta">
          <span class="cal-ev-type" style="background:${t.bg};color:${t.color}">${t.label}</span>
          ${e.heure?`<span>${svgIcon('clock',12)} ${e.heure}</span>`:''}
          ${e.lieu?`<span>${svgIcon('pin',12)} ${e.lieu}</span>`:''}
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;align-items:center;flex-shrink:0">
        <span class="cal-ev-export" onclick="exportOneICS(${e.idx})" title="Ajouter à mon agenda (.ics)">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M12 14v4M10 16h4"/></svg>
        </span>
        <span class="cal-ev-del" onclick="deleteEvent(${e.idx})" title="Supprimer">${DELSVG}</span>
      </div>
    </div>`;
  }).join('');
}

function selectDay(iso){ selectedDay = iso; renderCalendar(); renderDayPanel(); }
function calShift(n){ calCursor = new Date(calCursor.getFullYear(), calCursor.getMonth()+n, 1); renderCalendar(); }
function calToday(){ calCursor = new Date(); selectedDay = _todayISO; renderCalendar(); renderDayPanel(); }
function deleteEvent(idx){ askDelete('Supprimer cet événement de l\'agenda ?', ()=>{ S.events.splice(idx,1); save(); toast('Événement supprimé.'); }); }

/* ── MODAL ── */
function openEventModal(presetDate){
  document.getElementById('evModalTitle').textContent = 'Nouvel événement';
  document.getElementById('evTitle').value = '';
  document.getElementById('evDate').value = presetDate || selectedDay || _todayISO;
  document.getElementById('evTime').value = '';
  document.getElementById('evLieu').value = '';
  evEditType = 'reunion';
  document.querySelectorAll('#evTypePicker .type-opt').forEach(o=>o.classList.toggle('sel',o.dataset.v==='reunion'));
  document.getElementById('eventModal').classList.add('open');
  setTimeout(()=>document.getElementById('evTitle').focus(),60);
}
function closeEventModal(){ document.getElementById('eventModal').classList.remove('open'); }
function saveEvent(){
  const titre = document.getElementById('evTitle').value.trim();
  const date = document.getElementById('evDate').value;
  if(!titre){ toast('Indiquez un titre.'); document.getElementById('evTitle').focus(); return; }
  if(!date){ toast('Choisissez une date.'); return; }
  const heure = document.getElementById('evTime').value || '';
  const lieu = document.getElementById('evLieu').value.trim();
  S.events.push({titre, date, type:evEditType, lieu, heure});
  selectedDay = date;
  calCursor = new Date(date+'T00:00:00');
  closeEventModal();
  save();
  toast('Événement ajouté.');
}
/* Sélecteur de type dans le modal */
document.querySelectorAll('#evTypePicker .type-opt').forEach(o=>o.addEventListener('click',()=>{
  document.querySelectorAll('#evTypePicker .type-opt').forEach(x=>x.classList.remove('sel'));
  o.classList.add('sel'); evEditType = o.dataset.v;
}));
/* Échap ferme les modals */
document.addEventListener('keydown',e=>{ if(e.key==='Escape'){ closeEventModal(); if(typeof closeTxModal==='function')closeTxModal(); if(typeof closePartsModal==='function')closePartsModal(); if(typeof closeGroupModal==='function')closeGroupModal(); } });

/* ── EXPORT CALENDRIER (.ics — Google / Apple / Outlook) ── */
function icsEscape(s){ return String(s||'').replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\n/g,'\\n'); }
function pad2(n){ return String(n).padStart(2,'0'); }
function eventToVEVENT(e){
  const uid = 'divimo-' + e.date.replace(/-/g,'') + '-' + Math.random().toString(36).slice(2,8) + '@divimo';
  const stamp = new Date().toISOString().replace(/[-:]/g,'').split('.')[0] + 'Z';
  let dtStart, dtEnd;
  if(e.heure){
    const [h,m] = e.heure.split(':').map(Number);
    const d = e.date.replace(/-/g,'');
    dtStart = 'DTSTART:' + d + 'T' + pad2(h) + pad2(m) + '00';
    const endH = (h+1)%24;
    dtEnd = 'DTEND:' + d + 'T' + pad2(endH) + pad2(m) + '00';
  } else {
    const d = e.date.replace(/-/g,'');
    const nd = new Date(e.date+'T00:00:00'); nd.setDate(nd.getDate()+1);
    const dn = ymd(nd).replace(/-/g,'');
    dtStart = 'DTSTART;VALUE=DATE:' + d;
    dtEnd = 'DTEND;VALUE=DATE:' + dn;
  }
  const typeLabel = evType(e.type).label;
  return [
    'BEGIN:VEVENT',
    'UID:' + uid,
    'DTSTAMP:' + stamp,
    dtStart,
    dtEnd,
    'SUMMARY:' + icsEscape(e.titre),
    e.lieu ? 'LOCATION:' + icsEscape(e.lieu) : '',
    'DESCRIPTION:' + icsEscape('[' + typeLabel + '] Indivision · via Divimo'),
    'END:VEVENT'
  ].filter(Boolean).join('\r\n');
}
function buildICS(events){
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Divimo//Planning Indivision//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Divimo — Planning indivision',
    ...events.map(eventToVEVENT),
    'END:VCALENDAR'
  ].join('\r\n');
}
function downloadICS(events, filename){
  if(!events.length){ toast('Aucun événement à exporter.'); return; }
  const blob = new Blob([buildICS(events)], {type:'text/calendar;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename || 'divimo-planning.ics';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
}
/* Exporter tout le planning */
function exportAllICS(){ downloadICS(S.events.slice(), 'divimo-planning.ics'); toast('Calendrier exporté (.ics).'); }
/* Exporter un seul événement */
function exportOneICS(idx){
  const e = S.events[idx]; if(!e) return;
  downloadICS([e], 'divimo-' + e.titre.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,40) + '.ics');
  toast('Événement exporté (.ics).');
}

/* ═══════ BUDGET v2 ═══════ */
const eur = n => (isFinite(n)?Math.round(n).toLocaleString('fr-FR'):'0') + ' €';

/* ── Jeu d'icônes SVG (style trait fin, comme la navigation) ──
   svgIcon('home') renvoie un <svg>. Si le nom est inconnu (ex : ancienne
   donnée emoji en localStorage), la valeur est renvoyée telle quelle. */
const SVG_ICONS = {
  home:'<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
  users:'<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/>',
  file:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
  chart:'<path d="M3 3v18h18"/><path d="M7 16v-5M12 16V8M17 16v-3"/>',
  building:'<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 21v-4h6v4M8 7h.01M12 7h.01M16 7h.01M8 11h.01M12 11h.01M16 11h.01"/>',
  building2:'<path d="M3 21h18M5 21V8l6-3v16M11 21V11l8-3v13M9 11h.01M9 14h.01M15 12h.01M15 15h.01"/>',
  shop:'<path d="M3 9l1.5-5h15L21 9M4 9v11h16V9M4 9h16M9 20v-5h6v5"/>',
  tree:'<path d="M12 22v-5M8.5 17a4.5 4.5 0 0 1-1.4-8.8 5 5 0 0 1 9.8 0A4.5 4.5 0 0 1 15.5 17z"/>',
  pin:'<path d="M21 10c0 7-9 12-9 12s-9-5-9-12a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
  lock:'<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  calendar:'<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  coins:'<path d="M17 6.5a7.5 7.5 0 1 0 0 11"/><path d="M4 10.5h10M4 13.5h10"/>',
  wrench:'<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>',
  shield:'<path d="M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z"/>',
  bolt:'<path d="M13 2L3 14h7l-1 8 10-12h-7z"/>',
  bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
  folder:'<path d="M3 7a2 2 0 0 1 2-2h4l2 3h8a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  image:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>',
  key:'<circle cx="7.5" cy="15.5" r="4.5"/><path d="M10.5 12.5L20 3M16 7l3 3"/>',
  bulb:'<path d="M9 18h6M10 22h4M8 14a7 7 0 1 1 8 0c-.6.5-1 1.3-1 2.1V18H9v-1.9c0-.8-.4-1.6-1-2.1z"/>',
  box:'<path d="M21 16V8l-9-5-9 5v8l9 5z"/><path d="M3.3 7L12 12l8.7-5M12 22V12"/>',
  fire:'<path d="M12 2s5 4 5 9a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1.5 2.5 2 1 .5-1.5-1-3 1-5.5z"/>',
  drop:'<path d="M12 2.5S6 9 6 13.5a6 6 0 0 0 12 0C18 9 12 2.5 12 2.5z"/>',
  clipboard:'<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2"/>',
  save:'<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
  edit:'<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  link:'<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>',
  scale:'<path d="M12 3v18M5 7h14M7 7l-3 6a3 3 0 0 0 6 0L7 7zM17 7l-3 6a3 3 0 0 0 6 0L17 7z"/>',
  trendup:'<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  trenddown:'<path d="M3 7l6 6 4-4 8 8"/><path d="M15 17h6v-6"/>',
  hourglass:'<path d="M6 2h12M6 22h12M7 2c0 4 4 5 5 7 1-2 5-3 5-7M7 22c0-4 4-5 5-7 1 2 5 3 5 7"/>',
  mail:'<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 6l10 7 10-7"/>',
  database:'<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5M3 12c0 1.7 4 3 9 3s9-1.3 9-3"/>',
  code:'<path d="M16 18l6-6-6-6M8 6l-6 6 6 6"/>',
  tv:'<rect x="2" y="6" width="20" height="13" rx="2"/><path d="M8 3l4 3 4-3"/>',
  fridge:'<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M6 9h12M10 5v1M10 12v3"/>',
  washer:'<rect x="5" y="2" width="14" height="20" rx="2"/><circle cx="12" cy="13" r="4"/><path d="M8 5h.01M11 5h.01"/>',
  sofa:'<path d="M4 11V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3M3 11a2 2 0 0 1 2 2v4h14v-4a2 2 0 0 1 2-2M6 21v-4M18 21v-4"/>',
  bed:'<path d="M3 18v-6h18v6M3 12V7M21 18v-2M7 12V9h4v3"/>',
  chair:'<path d="M6 19v-7M18 19v-7M5 12h14M7 12V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v7"/>',
  desktop:'<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
  shower:'<path d="M4 4h6a4 4 0 0 1 4 4v1M14 9h6M9 14v.5M12 17v.5M15 14v.5M12 20v.5"/>',
  plate:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/>',
  basket:'<path d="M5 11l2-6M19 11l-2-6M2 11h20l-1.5 8.5a2 2 0 0 1-2 1.5H5.5a2 2 0 0 1-2-1.5z"/>',
  alert:'<path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h16.9a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  check:'<path d="M20 6L9 17l-5-5"/>',
  spreadsheet:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M4 9h16M4 15h16M10 3v18"/>',
  receipt:'<path d="M5 3v18l2-1 2 1 2-1 2 1 2-1 2 1V3l-2 1-2-1-2 1-2-1-2 1z"/><path d="M8 8h8M8 12h8"/>',
  book:'<path d="M4 5a2 2 0 0 1 2-2h13v18H6a2 2 0 0 1-2-2z"/><path d="M4 5v14"/>',
};
function svgIcon(name, size=18, sw=2){
  const inner = SVG_ICONS[name];
  if(!inner) return name; /* fallback : ancienne valeur (emoji) inchangée */
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle">${inner}</svg>`;
}
const TX_CATS = {
  taxe:      {label:'Taxe foncière', ic:'building', color:'#2C5282'},
  travaux:   {label:'Travaux',       ic:'wrench', color:'#C8821E'},
  copro:     {label:'Charges copro', ic:'building2', color:'#2D6A6A'},
  assurance: {label:'Assurance',     ic:'shield', color:'#7A4FBF'},
  energie:   {label:'Énergie',       ic:'bolt', color:'#E0843D'},
  loyer:     {label:'Loyer',         ic:'coins', color:'#19A974'},
  autre:     {label:'Autre',         ic:'receipt', color:'#6B7280'},
};
function catInfo(key){ return TX_CATS[key] || {label:key||'Autre', ic:'receipt', color:'#6B7280'}; }

/* ━━━━ DÉCLARATION FISCALE (revenus fonciers, privé au groupe) ━━━━ */
const FISC_DEDUCT = new Set(['taxe','travaux','copro','assurance']); /* charges déductibles des revenus fonciers */
let fiscalYear = null, fiscDetailOpen = false;
function fiscalYears(){
  const ys=new Set();
  (S.transactions||[]).forEach(t=>{ const y=String(t.date||'').slice(0,4); if(/^\d{4}$/.test(y)) ys.add(y); });
  const cur=new Date().getFullYear(); ys.add(String(cur)); ys.add(String(cur-1));
  return [...ys].sort().reverse();
}
function fiscalCfg(y){ if(!S.fiscal) S.fiscal={}; if(!S.fiscal[y]) S.fiscal[y]={regime:'auto',ov:{}}; if(!S.fiscal[y].ov) S.fiscal[y].ov={}; return S.fiscal[y]; }
function fiscalRows(y){
  const txs=(S.transactions||[]).filter(t=>String(t.date||'').slice(0,4)===String(y));
  const biens=(S.biens||[]);
  const assign=txs.map(t=>{ const b=bienOfTx(t); return b?biens.indexOf(b):-1; });
  /* Loyers récurrents encaissés cette année, rattachés au bon bien (revenus fonciers) */
  const loy=(typeof loyerReceived==='function'?loyerReceived():[]).filter(o=>String(o.ym).slice(0,4)===String(y));
  const loyByBien={};
  loy.forEach(o=>{ const b=resolveBien(o.loyer.bienId||o.loyer.bien); const k=b?b.id:'__commun__'; loyByBien[k]=(loyByBien[k]||0)+o.montant; });
  const cfg=fiscalCfg(y);
  const mk=(nom,key,parts,bi,loyExtra)=>{
    let rev=0,chg=0;
    txs.forEach((t,ti)=>{ if(assign[ti]!==bi) return; if(t.montant>0) rev+=t.montant; else if(FISC_DEDUCT.has(t.cat)) chg+=Math.abs(t.montant); });
    rev+=(loyExtra||0);
    const ov=cfg.ov[key]||{};
    return { nom, key, parts, revAuto:Math.round(rev), chgAuto:Math.round(chg),
      rev:(ov.rev!=null?ov.rev:Math.round(rev)), chg:(ov.chg!=null?ov.chg:Math.round(chg)),
      int:(ov.interets!=null?ov.interets:0) };
  };
  const rows=biens.map((b,bi)=>mk(b.nom,b.id,bienParts(b),bi, loyByBien[b.id]||0));
  const commun=mk("Commun à l'indivision",'__commun__',coiParts(),-1, loyByBien['__commun__']||0);
  if(commun.revAuto||commun.chgAuto||(cfg.ov['__commun__'])) rows.push(commun);
  return rows;
}
function fiscalSet(y,key,field,val){ const cfg=fiscalCfg(y); if(!cfg.ov[key]) cfg.ov[key]={}; cfg.ov[key][field]=Math.max(0,Math.round(+val||0)); save(); }
function fiscalPersonRegime(y,ini,r){ const cfg=fiscalCfg(y); if(!cfg.personRegime) cfg.personRegime={}; cfg.personRegime[ini]=r; save(); }
function fiscalYearSel(y){ fiscalYear=y; renderFiscal(); }
function renderFiscal(){
  const el=document.getElementById('fiscalBody'); if(!el) return;
  const escJs=s=>String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'");
  const years=fiscalYears();
  if(!fiscalYear || !years.includes(fiscalYear)) fiscalYear=years[0];
  const y=fiscalYear;
  const rows=fiscalRows(y);
  const revBrut=rows.reduce((a,r)=>a+r.rev,0);
  const chgTot=rows.reduce((a,r)=>a+r.chg,0);
  const intTot=rows.reduce((a,r)=>a+(r.int||0),0);
  const cfg=fiscalCfg(y);
  const myIni=(typeof OWNER!=='undefined'&&OWNER)?OWNER.ini:null;
  const q=t=>`<span class="fisc-help"><button class="fisc-q" type="button" onclick="fiscQ(this)" aria-label="Aide">?</button><span class="fisc-tip" hidden>${t}</span></span>`;

  /* Agrégation par indivisaire : sa part de loyers, charges, intérêts */
  const pers={};
  rows.forEach(r=>{
    const sumP=r.parts.reduce((a,p)=>a+(+p.pct||0),0)||100;
    r.parts.forEach(p=>{ const k=p.ini; if(!pers[k]) pers[k]={name:p.name,ini:p.ini,rev:0,chg:0,int:0}; const w=(+p.pct||0)/sumP; pers[k].rev+=r.rev*w; pers[k].chg+=r.chg*w; pers[k].int+=(r.int||0)*w; });
  });
  const persList=Object.values(pers).sort((a,b)=>b.rev-a.rev);
  /* Régime (par personne) + montant à déclarer, selon les règles vérifiées */
  persList.forEach(p=>{
    p.microEligible = p.rev>0 && p.rev<=15000;
    let reg=(cfg.personRegime&&cfg.personRegime[p.ini])||'auto';
    if(reg==='auto') reg=p.microEligible?'micro':'reel';
    if(!p.microEligible) reg='reel';
    p.regime=reg;
    if(reg==='micro'){ p.kind='micro'; p.declare=Math.round(p.rev*0.7); p.case='4BE'; }
    else {
      const net=p.rev-p.chg-p.int;
      if(net>=0){ p.kind='pos'; p.declare=Math.round(net); p.case='4BA'; }
      else {
        const defInt=Math.max(0,p.int-p.rev);            /* déficit dû aux intérêts → revenus fonciers uniquement */
        const defAutres=p.chg-Math.max(0,p.rev-p.int);   /* déficit dû aux autres charges → revenu global plafonné */
        const dGlobal=Math.min(Math.max(0,defAutres),10700);
        const dReport=Math.max(0,defAutres-dGlobal)+Math.max(0,defInt);
        p.kind='deficit'; p.deficit=Math.round(-net); p.dGlobal=Math.round(dGlobal); p.dReport=Math.round(dReport);
      }
    }
  });
  const me=myIni?persList.find(p=>p.ini===myIni):null;

  const docs=S.docs||[];
  const hasDoc=(re,dossier)=>docs.some(d=> (dossier&&d.dossier===dossier) || re.test(d.name||'') );
  const docChecks=[
    {lbl:'Avis de taxe foncière '+y, ok:hasDoc(/taxe.?fonci/i,'Taxe foncière')},
    {lbl:'Justificatifs de travaux et factures', ok:hasDoc(/travaux|facture/i)},
    {lbl:"Tableau d'amortissement du prêt (intérêts)", ok:hasDoc(/amortiss|prêt|pret|emprunt/i)},
    {lbl:'Quittances ou relevés de loyers', ok:hasDoc(/loyer|quittance|relev/i)},
    {lbl:"Attestation d'assurance (PNO)", ok:hasDoc(/assur/i)},
  ];
  const missingDocs=docChecks.filter(d=>!d.ok).length;
  const cfgSteps=cfg.steps||{};
  const stepDefs=['Vérifiez vos revenus, charges et intérêts','Choisissez votre régime (micro ou réel)','Réunissez vos documents fiscaux','Reportez votre part sur votre déclaration'];

  /* Verdict personnalisé */
  let heroHTML;
  if(revBrut<=0){
    heroHTML=`<div class="fisc-hero-big">Aucun loyer enregistré pour ${y}.</div>
      <div class="fisc-hero-sub">Vous n’avez probablement rien à déclarer en revenus fonciers cette année. Ajoutez vos loyers dans le Budget pour préparer la déclaration.</div>`;
  } else if(me){
    let line;
    if(me.kind==='micro') line=`vous avez <b>${eur(me.declare)}</b> à déclarer en case 4BE`;
    else if(me.kind==='pos') line=`vous avez <b>${eur(me.declare)}</b> à déclarer (régime réel, case 4BA)`;
    else line=`vous êtes en <b>déficit foncier de ${eur(me.deficit)}</b>, rien à déclarer en positif cette année`;
    heroHTML=`<div class="fisc-hero-big">Cette année, ${line}.</div>
      <div class="fisc-hero-sub">Votre régime : <b>${me.regime==='micro'?'micro-foncier':'réel'}</b>. ${me.regime==='micro'?'Un abattement de 30 % est appliqué automatiquement.':'Vous déduisez vos charges réelles, intérêts d’emprunt compris.'}${q(me.regime==='micro'?'Le micro-foncier s’applique quand votre part de loyers bruts est sous 15 000 € par an. L’administration retire 30 % d’office.':'Le régime réel : vous déduisez vos charges réelles. Un résultat négatif crée un déficit foncier, imputable sur votre revenu global jusqu’à 10 700 € par an.')}</div>`;
  } else {
    heroHTML=`<div class="fisc-hero-big">Vos biens ont rapporté <b>${eur(revBrut)}</b> de loyers en ${y}.</div>
      <div class="fisc-hero-sub">Chaque indivisaire déclare sa part selon son <b>propre régime</b> (micro ou réel), apprécié sur sa quote-part.${q('Le seuil de 15 000 € du micro-foncier s’apprécie au niveau du foyer fiscal de chaque indivisaire, et non au niveau de l’indivision. Deux indivisaires peuvent donc ne pas être au même régime.')}</div>`;
  }

  const personCard=(p,i)=>{
    const col=PAL[i%PAL.length]; const isMe=myIni&&p.ini===myIni;
    const reg=`<div class="fisc-regline"><span class="fisc-reg-badge ${p.regime}">${p.regime==='micro'?'Micro-foncier':'Régime réel'}</span>${
      p.microEligible
        ? `<span class="fisc-regtog"><button class="${p.regime==='micro'?'sel':''}" onclick="fiscalPersonRegime('${y}','${p.ini}','micro')">Micro</button><button class="${p.regime==='reel'?'sel':''}" onclick="fiscalPersonRegime('${y}','${p.ini}','reel')">Réel</button></span>`
        : `<span class="fisc-reg-note">réel obligatoire (plus de 15 000 €)</span>`
    }</div>`;
    let body;
    if(p.kind==='deficit'){
      body=`<div class="fisc-pamt neg">${eur(p.deficit)}</div>
        <div class="fisc-pcase">déficit foncier, rien à payer cette année</div>
        <div class="fisc-defbreak">
          <div><span>Imputable sur le revenu global</span><b>${eur(p.dGlobal)}</b></div>
          <div><span>Reportable 10 ans (foncier)</span><b>${eur(p.dReport)}</b></div>
        </div>`;
    } else {
      const caseTxt = p.kind==='micro' ? 'à reporter case 4BE de la 2042' : 'à reporter case 4BA de la 2042 (résultat calculé sur la 2044)';
      body=`<div class="fisc-pamt">${eur(p.declare)}</div>
        <div class="fisc-pcase">${caseTxt}</div>
        <button class="fisc-copy" type="button" onclick="fiscCopy(${p.declare})">Copier le montant</button>`;
    }
    return `<div class="fisc-person${isMe?' me':''}">
      <div class="fisc-person-top"><span class="fisc-pav" style="background:linear-gradient(135deg,${col},${col}cc)">${p.ini}</span><span class="fisc-pname">${cEsc(p.name)}${isMe?'<span class="fisc-you">Vous</span>':''}</span></div>
      ${reg}
      ${body}
    </div>`;
  };

  el.innerHTML=`
    <div class="fisc-years">${years.map(yy=>`<button class="bf-chip ${yy===y?'sel':''}" onclick="fiscalYearSel('${yy}')">${yy}</button>`).join('')}</div>

    <div class="card fisc-hero">
      <div class="res-label">Déclaration ${y}</div>
      ${heroHTML}
    </div>

    ${revBrut>0 ? `
    <div class="card">
      <div class="card-title">Ce que chacun doit déclarer</div>
      <div class="card-sub">La part de chaque indivisaire, selon son régime, prête à recopier sur sa déclaration.</div>
      <div class="fisc-people">
        ${persList.map(personCard).join('')||'<div class="empty">Renseignez les quotes-parts pour répartir.</div>'}
      </div>
      <p class="fisc-note">S’ajoutent à ces montants l’impôt sur le revenu (selon votre tranche) et les prélèvements sociaux de 17,2 %.${q('Les prélèvements sociaux (CSG, CRDS, prélèvement de solidarité) s’élèvent à 17,2 % et s’appliquent sur le revenu foncier net, en plus de l’impôt sur le revenu.')}</p>
    </div>

    <div class="card">
      <div class="card-title">Vos étapes</div>
      <div class="card-sub">Cochez au fur et à mesure : vous saurez toujours où vous en êtes.</div>
      <div class="fisc-steps2">
        ${stepDefs.map((s,i)=>`<button class="fisc-step2${cfgSteps[i]?' done':''}" type="button" onclick="fiscalStep('${y}',${i})"><span class="fisc-step2-n">${cfgSteps[i]?svgIcon('check',14):(i+1)}</span><span>${s}</span></button>`).join('')}
      </div>
    </div>

    <div class="card">
      <div class="card-head"><div><div class="card-title">Vos documents fiscaux</div><div class="card-sub">${missingDocs?('Il vous manque '+missingDocs+' justificatif(s).'):'Tous vos justificatifs semblent présents.'}</div></div><button class="btn btn-sm" onclick="go('docs')">Ouvrir mes documents</button></div>
      <div class="fisc-check">
        ${docChecks.map(d=>`<div class="fisc-check-row ${d.ok?'ok':'miss'}">${d.ok?svgIcon('check',14):svgIcon('clock',14)}<span>${cEsc(d.lbl)}</span><span class="fisc-doc-tag${d.ok?' ok':''}">${d.ok?'Présent':'À ajouter'}</span></div>`).join('')}
      </div>
    </div>` : ''}

    <details class="fisc-details" ${(fiscDetailOpen||revBrut<=0)?'open':''} ontoggle="fiscDetailOpen=this.open">
      <summary>Voir et ajuster le détail par bien</summary>
      <div class="card" style="margin-top:12px">
        <div class="card-head"><div><div class="card-title">Revenus, charges et intérêts par bien</div><div class="card-sub">Pré-rempli depuis votre budget ${y}. Les intérêts d’emprunt se saisissent à la main (non suivis dans le budget).</div></div></div>
        <div class="fisc-table fisc-table-5">
          <div class="fisc-row fisc-head"><span>Bien</span><span>Loyers</span><span>Charges</span><span>Intérêts</span><span>Résultat</span></div>
          ${rows.map(r=>{ const net=r.rev-r.chg-(r.int||0); return `<div class="fisc-row">
            <span class="fisc-bien">${cEsc(String(r.nom).split('—')[0].trim())}</span>
            <span class="fisc-num"><input type="number" min="0" value="${r.rev}" onchange="fiscalSet('${y}','${escJs(r.key)}','rev',this.value)"><i>€</i></span>
            <span class="fisc-num"><input type="number" min="0" value="${r.chg}" onchange="fiscalSet('${y}','${escJs(r.key)}','chg',this.value)"><i>€</i></span>
            <span class="fisc-num"><input type="number" min="0" value="${r.int||0}" onchange="fiscalSet('${y}','${escJs(r.key)}','interets',this.value)"><i>€</i></span>
            <span class="fisc-net ${net<0?'neg':''}">${eur(net)}</span>
          </div>`; }).join('')||'<div class="empty">Aucun bien dans cette indivision.</div>'}
          <div class="fisc-row fisc-total"><span>Total ${y}</span><span>${eur(revBrut)}</span><span>${eur(chgTot)}</span><span>${eur(intTot)}</span><span class="${(revBrut-chgTot-intTot)<0?'neg':''}">${eur(revBrut-chgTot-intTot)}</span></div>
        </div>
        <p class="fisc-note">Au réel, résultat = loyers − charges déductibles − intérêts d’emprunt. En micro-foncier, les charges sont ignorées (abattement de 30 %). Attention : les travaux de <b>construction, agrandissement ou reconstruction</b> ne sont pas déductibles, ajustez la colonne Charges le cas échéant.</p>
      </div>
    </details>

    <details class="fisc-details fisc-explain">
      <summary>Comprendre ma fiscalité en indivision</summary>
      <div class="card" style="margin-top:12px">
        <div class="fisc-ex">
          <h4>L’indivision, comment ça marche ?</h4>
          <p>En indivision, il n’y a pas de déclaration commune : <b>chaque indivisaire déclare sa propre quote-part</b> des revenus et des charges, au prorata de ses droits. La taxe foncière, elle, est établie au nom des indivisaires.</p>
          <h4>Micro-foncier ou régime réel ?</h4>
          <p>Le <b>micro-foncier</b> s’applique si votre part de loyers bruts ne dépasse pas <b>15 000 € par an</b> : l’administration applique un abattement forfaitaire de <b>30 %</b>, sans aucune charge à justifier (case 4BE). Ce seuil s’apprécie <b>par indivisaire</b>, pas pour l’indivision entière. Au-delà, ou sur option (3 ans), c’est le <b>régime réel</b> : vous déduisez vos charges réelles (formulaire 2044).</p>
          <h4>Charges déductibles au réel</h4>
          <p>Taxe foncière, primes d’assurance, frais de gestion, dépenses de réparation, d’entretien et d’amélioration, provisions de charges de copropriété, et <b>intérêts d’emprunt</b>. Les <b>travaux de construction ou d’agrandissement ne sont pas déductibles</b>.</p>
          <h4>Le déficit foncier</h4>
          <p>Si vos charges dépassent vos loyers, vous êtes en déficit. La part <b>hors intérêts</b> s’impute sur votre <b>revenu global jusqu’à 10 700 € par an</b> ; le reste et la part liée aux <b>intérêts</b> se reportent sur vos <b>revenus fonciers des 10 années suivantes</b>.</p>
          <h4>Et l’impôt au final ?</h4>
          <p>Votre revenu foncier net s’ajoute à vos autres revenus et est imposé selon votre <b>tranche marginale</b>, plus les <b>prélèvements sociaux de 17,2 %</b>.</p>
          <p class="fisc-ex-src">Informations établies à partir des règles publiques (impots.gouv.fr, service-public.gouv.fr, BOFiP). Elles restent une aide à la préparation et ne remplacent pas l’avis d’un notaire ou d’un expert-comptable.</p>
        </div>
      </div>
    </details>

    <div class="fisc-2col">
      <div class="card">
        <div class="card-title">Échéances ${+y+1}</div>
        <div class="fisc-check">
          <div class="fisc-check-row">${svgIcon('clock',14)}<span>Déclaration en ligne : avril à juin ${+y+1}</span></div>
          <div class="fisc-check-row">${svgIcon('clock',14)}<span>Avis d’impôt : été ${+y+1}</span></div>
          <div class="fisc-check-row">${svgIcon('clock',14)}<span>Taxe foncière : automne ${+y+1}</span></div>
        </div>
      </div>
      <div class="card">
        <div class="card-title">Garder une trace</div>
        <div class="card-sub">Un récapitulatif à imprimer ou enregistrer en PDF, à garder ou à remettre à votre comptable.</div>
        <button class="btn" onclick="fiscPrint()" style="margin-top:12px;background:var(--navy);color:#fff">${svgIcon('file',15)} Imprimer / enregistrer en PDF</button>
      </div>
    </div>

    <p class="fisc-disclaimer">Estimation indicative pour préparer vos démarches, fondée sur les règles fiscales publiques. Elle ne remplace pas la déclaration officielle ni l’avis d’un professionnel.</p>`;
}
function fiscQ(b){ const t=b.parentNode.querySelector('.fisc-tip'); if(t) t.hidden=!t.hidden; }
function fiscCopy(amount){ const v=String(amount); try{ navigator.clipboard.writeText(v); toast('Montant copié : '+eur(amount)); }catch(e){ toast('Montant : '+eur(amount)); } }
function fiscalStep(y,i){ const cfg=fiscalCfg(y); if(!cfg.steps) cfg.steps={}; cfg.steps[i]=!cfg.steps[i]; save(); }
function fiscPrint(){ document.body.classList.add('printing-fiscal'); window.print(); setTimeout(()=>document.body.classList.remove('printing-fiscal'),500); }

/* ── STATUTS & PAIEMENTS DES CHARGES ── */
const STATUTS = {
  apayer:  {label:'À payer',    cls:'st-apayer',  dot:'#C0392B'},
  attente: {label:'En attente', cls:'st-attente', dot:'#C8821E'},
  paye:    {label:'Payé',       cls:'st-paye',    dot:'#19A974'},
};
function statutChip(st){
  const s=STATUTS[st]; if(!s) return '';
  return `<span class="st-chip ${s.cls}"><span class="st-dot" style="background:${s.dot}"></span>${s.label}</span>`;
}
/* Répartition d'une charge entre co-indivisaires (selon les parts du bien) + état payé */
function chargeShares(t){
  const bien = bienOfTx(t);
  const parts = bienParts(bien);
  const sum = parts.reduce((a,p)=>a+(+p.pct||0),0) || 100;
  const paid = t.paid || {};
  return parts.map(p=>({
    name:p.name, ini:p.ini, pct:+p.pct||0,
    due: Math.abs(t.montant)*(+p.pct||0)/sum,
    paid: !!paid[p.ini], at: paid[p.ini]||null
  }));
}
/* Statut dérivé : apayer / attente / paye (null pour les revenus) */
function chargeStatut(t){
  if(t.montant>=0) return null;
  const sh=chargeShares(t); if(!sh.length) return 'apayer';
  const np=sh.filter(s=>s.paid).length;
  if(np===0) return 'apayer';
  return np<sh.length ? 'attente' : 'paye';
}
function addPayment(p){ S.payments=S.payments||[]; S.payments.unshift(p); }
function removePayment(t,ini){
  S.payments=S.payments||[];
  const idx=S.payments.findIndex(p=>p.ini===ini && p.desc===t.desc && p.bien===t.bien);
  if(idx>-1) S.payments.splice(idx,1);
}

/* ── MODAL DE PAIEMENT ── */
let payIdx = -1;
function openPayModal(i){ payIdx=i; renderPayModal(); document.getElementById('payModal').classList.add('open'); }
function closePayModal(){ document.getElementById('payModal').classList.remove('open'); }
function renderPayModal(){
  const t=S.transactions[payIdx]; if(!t){ closePayModal(); return; }
  const shares=chargeShares(t);
  const total=Math.abs(t.montant);
  const paidAmt=shares.filter(s=>s.paid).reduce((a,s)=>a+s.due,0);
  const pct= total ? Math.round(paidAmt/total*100) : 0;
  const st=chargeStatut(t);
  const dateStr=t.date?new Date(t.date+'T00:00:00').toLocaleDateString('fr-FR'):'';
  document.getElementById('payBody').innerHTML=`
    <div class="pay-head-card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
        <div style="min-width:0">
          <div class="pay-amount">${eur(total)}</div>
          <div class="pay-meta">${t.desc}${(t.bien&&t.bien!=='__all__')?(' · '+svgIcon('pin',12)+' '+cEsc(String(t.bien).split('—')[0].trim())):''}${dateStr?(' · '+dateStr):''}</div>
        </div>
        ${statutChip(st)}
      </div>
    </div>
    <div class="pay-progress">
      <div class="pay-prog-lbl"><span><b style="color:var(--teal)">${eur(paidAmt)}</b> réglé sur ${eur(total)}</span><span>${pct}%</span></div>
      <div class="pay-prog-bar"><div class="pay-prog-fill" style="width:${pct}%"></div></div>
    </div>
    <div style="font-family:'Montserrat',sans-serif;font-weight:700;font-size:.82rem;color:var(--navy);margin:18px 0 2px">Répartition entre co-indivisaires</div>
    <div>${shares.map((s,j)=>`
      <div class="pay-row">
        <div class="pay-av" style="background:linear-gradient(135deg,${PAL[j%PAL.length]},${PAL[j%PAL.length]}cc)">${s.ini}</div>
        <div class="pay-body">
          <div class="pay-name">${s.name}</div>
          <div class="pay-sub">${s.pct}%${s.paid&&s.at?(' · réglé le '+new Date(s.at).toLocaleDateString('fr-FR')):''}</div>
        </div>
        <div class="pay-due">${eur(s.due)}</div>
        <button class="pay-toggle ${s.paid?'on':''}" onclick="togglePay('${s.ini}')">${s.paid?'✓ Payé':'Marquer payé'}</button>
      </div>`).join('')}</div>
    <div class="modal-foot" style="justify-content:space-between">
      <button class="btn btn-ghost" onclick="resetPay()">Tout réinitialiser</button>
      <button class="btn" onclick="markAllPaid()" ${st==='paye'?'disabled style="opacity:.55;cursor:default"':''}>${st==='paye'?'Tout est réglé ✓':'Tout marquer payé'}</button>
    </div>`;
}
function togglePay(ini){
  const t=S.transactions[payIdx]; if(!t) return;
  t.paid=t.paid||{};
  const s=chargeShares(t).find(x=>x.ini===ini); if(!s) return;
  if(t.paid[ini]){
    delete t.paid[ini]; removePayment(t,ini);
    toast(`Paiement de ${s.name} annulé.`);
  } else {
    const now=new Date().toISOString();
    t.paid[ini]=now;
    addPayment({ts:now, ini, name:s.name, amount:s.due, desc:t.desc, bien:t.bien});
    toast(`${s.name} a réglé sa part : ${eur(s.due)}`);
  }
  save(); renderPayModal();
}
function markAllPaid(){
  const t=S.transactions[payIdx]; if(!t) return;
  t.paid=t.paid||{};
  const now=new Date().toISOString();
  let n=0;
  chargeShares(t).forEach(s=>{
    if(!t.paid[s.ini]){ t.paid[s.ini]=now; addPayment({ts:now, ini:s.ini, name:s.name, amount:s.due, desc:t.desc, bien:t.bien}); n++; }
  });
  if(n) toast('Charge entièrement réglée ✓');
  save(); renderPayModal();
}
function resetPay(){
  const t=S.transactions[payIdx]; if(!t) return;
  if(t.paid) Object.keys(t.paid).forEach(ini=>removePayment(t,ini));
  t.paid={};
  toast('Statut réinitialisé.');
  save(); renderPayModal();
}

/* Quote-parts des co-indivisaires (parse "45% · ...") */
function coiParts(){
  return S.coi.map((c,i)=>{
    const m=(c.r||'').match(/(\d+(?:[.,]\d+)?)\s*%/);
    return { name:(c.n||'').replace(/\s*\(vous\)/i,''), full:c.n, ini:c.ini,
             pct: m?parseFloat(m[1].replace(',','.')):0, color: PAL[i%PAL.length] };
  });
}

let txFilter = 'all';

/* ━━━━ LOYERS RÉCURRENTS (encaissement mensuel + suivi par indivisaire) ━━━━ */
function loyerList(){ if(!Array.isArray(S.loyers)) S.loyers=[]; return S.loyers; }
function loyerStatusMap(){ if(!S.loyerStatus) S.loyerStatus={}; return S.loyerStatus; }
const LOYER_FREQ = { mensuel:{step:1,label:'mois',adj:'mensuel'}, trimestriel:{step:3,label:'trimestre',adj:'trimestriel'}, semestriel:{step:6,label:'semestre',adj:'semestriel'}, annuel:{step:12,label:'an',adj:'annuel'} };
function loyerFreq(l){ return LOYER_FREQ[(l&&l.freq)||'mensuel']||LOYER_FREQ.mensuel; }
function ymNow(){ return new Date().toISOString().slice(0,7); }
function ymList(since, step){
  step=step||1;
  if(!/^\d{4}-\d{2}$/.test(since||'')) since=ymNow();
  const now=ymNow(); const out=[]; let [y,m]=since.split('-').map(Number); let cur=since;
  while(cur<=now && out.length<400){ out.push(cur); m+=step; while(m>12){m-=12;y++;} cur=y+'-'+String(m).padStart(2,'0'); }
  return out;
}
function ymLabel(ym){ const [y,m]=String(ym).split('-'); return new Date(+y,+m-1,1).toLocaleDateString('fr-FR',{month:'long',year:'numeric'}); }
function loyerOccurrences(){
  const sm=loyerStatusMap(); const occ=[];
  loyerList().forEach(l=>ymList(l.since, loyerFreq(l).step).forEach(ym=>{ const key=l.id+'|'+ym; const s=sm[key]; occ.push({loyer:l, ym, key, st:s?s.st:null, montant:(s&&s.montant!=null)?s.montant:l.montant}); }));
  return occ;
}
function loyerPending(){ return loyerOccurrences().filter(o=>!o.st).sort((a,b)=>a.ym<b.ym?-1:1); }
function loyerToHandle(){ return loyerOccurrences().filter(o=>o.st===null||o.st==='impaye').sort((a,b)=>a.ym<b.ym?-1:1); }
function loyerReceived(){ return loyerOccurrences().filter(o=>o.st==='recu'||o.st==='partiel'); }
function confirmLoyer(key, st){
  const occ=loyerOccurrences().find(o=>o.key===key); if(!occ) return;
  const sm=loyerStatusMap();
  if(st==='partiel'){ const v=prompt('Montant réellement reçu (€) :', String(occ.loyer.montant)); if(v===null) return; sm[key]={st:'partiel', montant:Math.max(0,Math.round(+v||0))}; }
  else sm[key]={st};
  save(); renderLoyers();
  toast(st==='recu'?'Loyer encaissé.':st==='impaye'?'Loyer marqué impayé.':'Loyer partiel enregistré.');
}
function resetLoyer(key){ delete loyerStatusMap()[key]; save(); renderLoyers(); }
function confirmAllThisMonth(){
  const now=ymNow(); const sm=loyerStatusMap(); let n=0;
  loyerPending().filter(o=>o.ym===now).forEach(o=>{ sm[o.key]={st:'recu'}; n++; });
  if(n){ save(); renderLoyers(); toast(n+' loyer(s) encaissé(s).'); } else toast('Aucun loyer à confirmer ce mois.');
}
function loyerPerPerson(){
  const per={};
  loyerReceived().forEach(o=>{
    const bien=resolveBien(o.loyer.bienId||o.loyer.bien); const parts=bienParts(bien); const sum=parts.reduce((a,p)=>a+(+p.pct||0),0)||100;
    parts.forEach(p=>{ if(!per[p.name]) per[p.name]={name:p.name,ini:p.ini,amount:0}; per[p.name].amount+=o.montant*(+p.pct||0)/sum; });
  });
  return Object.values(per).sort((a,b)=>b.amount-a.amount);
}
function renderLoyers(){
  const el=document.getElementById('budLoyers'); if(!el) return;
  const recs=loyerList(); const recBtn=`<button class="btn btn-sm" onclick="openLoyerModal()">+ Loyer récurrent</button>`;
  const badge=document.getElementById('budLoyersBadge');
  if(badge){ const pc=loyerToHandle().length; badge.textContent=pc; badge.hidden=!pc; }
  if(!recs.length){
    el.innerHTML=`<div class="card"><div class="card-head"><div><div class="card-title">Loyers récurrents</div><div class="card-sub">Configurez le loyer mensuel d'un bien : l'app vous demandera chaque mois si vous l'avez reçu.</div></div>${recBtn}</div><div class="empty"><div class="empty-ic">${svgIcon('coins',24)}</div>Aucun loyer récurrent. Ajoutez-en un pour suivre les encaissements.</div></div>`;
    return;
  }
  const handle=loyerToHandle(); const now=ymNow(); const pendThis=handle.filter(o=>o.st===null && o.ym===now);
  const per=loyerPerPerson(); const totalRecu=loyerReceived().reduce((a,o)=>a+o.montant,0);
  const pendN=loyerPending().length, impayesN=loyerOccurrences().filter(o=>o.st==='impaye').length;
  const kpi = `<div class="lo-kpis">
    <div class="lo-kpi"><span class="lo-k-lbl">Encaissé</span><span class="lo-k-val pos">${eur(totalRecu)}</span></div>
    <div class="lo-kpi"><span class="lo-k-lbl">À confirmer</span><span class="lo-k-val${pendN?' warn':''}">${pendN}</span></div>
    <div class="lo-kpi"><span class="lo-k-lbl">Impayés</span><span class="lo-k-val${impayesN?' neg':''}">${impayesN}</span></div>
    <div class="lo-kpi"><span class="lo-k-lbl">Loyers actifs</span><span class="lo-k-val">${recs.length}</span></div>
  </div>`;
  const inbox = handle.length ? `
    <div class="card">
      <div class="card-head"><div><div class="card-title">Loyers à suivre <span class="lo-badge">${handle.length}</span></div><div class="card-sub">Confirmez les loyers reçus. Les impayés restent ici jusqu'à régularisation.</div></div>${pendThis.length>1?`<button class="btn btn-ghost btn-sm" onclick="confirmAllThisMonth()">Tout reçu ce mois</button>`:''}</div>
      ${handle.map(o=>{ const bienN=cEsc(String(o.loyer.bien).split('—')[0].trim());
        if(o.st==='impaye') return `<div class="lo-row impaye">
          <div class="r-ic" style="background:rgba(192,57,57,.1);color:#C0392B">${svgIcon('alert',18)}</div>
          <div style="flex:1;min-width:0"><b>Loyer ${cEsc(ymLabel(o.ym))}</b><span>${bienN} · ${eur(o.loyer.montant)} · <span class="lo-tag no">Impayé</span></span></div>
          <div class="lo-acts"><button class="lo-yes" onclick="confirmLoyer('${o.key}','recu')">Marquer reçu</button><button class="lo-reset" onclick="resetLoyer('${o.key}')">Annuler</button></div>
        </div>`;
        return `<div class="lo-row">
          <div class="r-ic" style="background:rgba(25,169,116,.12);color:#13855B">${svgIcon('coins',18)}</div>
          <div style="flex:1;min-width:0"><b>Loyer ${cEsc(ymLabel(o.ym))}</b><span>${bienN} · ${eur(o.loyer.montant)}</span></div>
          <div class="lo-acts"><button class="lo-yes" onclick="confirmLoyer('${o.key}','recu')">Oui</button><button class="lo-part" onclick="confirmLoyer('${o.key}','partiel')">Partiel</button><button class="lo-no" onclick="confirmLoyer('${o.key}','impaye')">Non</button></div>
        </div>`;
      }).join('')}
    </div>` : '';
  const split = `
    <div class="card">
      <div class="card-head"><div><div class="card-title">Encaissé par indivisaire</div><div class="card-sub">Cumul des loyers perçus, réparti selon les quote-parts. Alimente les revenus du budget.</div></div><div class="lo-total">${eur(totalRecu)}</div></div>
      ${per.length?per.map((p,i)=>{const col=PAL[i%PAL.length];const pc=totalRecu?Math.round(p.amount/totalRecu*100):0;const mx=per[0].amount||1;return `<div class="split-row"><div class="split-av" style="background:linear-gradient(135deg,${col},${col}cc)">${p.ini}</div><div class="split-body"><div class="split-top"><span class="split-name">${cEsc(p.name)}<span class="pct">${pc}%</span></span><span class="split-amount">${eur(Math.round(p.amount))}</span></div><div class="split-bar"><div class="split-fill" style="width:${p.amount/mx*100}%;background:${col}"></div></div></div></div>`;}).join(''):'<div class="empty">Aucun loyer encaissé pour l\'instant.</div>'}
    </div>`;
  const config = `
    <div class="card">
      <div class="card-head"><div><div class="card-title">Loyers configurés</div><div class="card-sub">Vos récurrences actives.</div></div>${recBtn}</div>
      ${recs.map(l=>`<div class="lo-cfg"><div class="r-ic" style="background:rgba(44,82,130,.08)">${svgIcon('home',16)}</div><div style="flex:1;min-width:0"><b>${cEsc(String(l.bien).split('—')[0].trim())}</b><span>${eur(l.montant)} / ${loyerFreq(l).label} · le ${l.jour} · depuis ${cEsc(ymLabel(l.since))}</span></div><div class="row-act"><span class="mini-link" onclick="openLoyerModal('${l.id}')">Modifier</span><span class="del" onclick="deleteLoyer('${l.id}')" title="Supprimer">${DELSVG}</span></div></div>`).join('')}
    </div>`;
  el.innerHTML=kpi+inbox+split+config;
}
let loyerEditId=null, loyerFreqSel='mensuel';
function setLoyerFreq(f){ loyerFreqSel=f; document.querySelectorAll('#loyerFreqSeg button').forEach(b=>b.classList.toggle('sel', b.dataset.f===f)); }
function openLoyerModal(id){
  loyerEditId=id||null;
  const l=id?loyerList().find(x=>x.id===id):null;
  document.getElementById('loyerModalTitle').textContent=l?'Modifier le loyer':'Nouveau loyer récurrent';
  const sel=document.getElementById('loyerBien');
  const curBien=l?resolveBien(l.bienId||l.bien):null;
  sel.innerHTML=(S.biens||[]).map(b=>`<option value="${b.id}"${curBien&&curBien.id===b.id?' selected':''}>${cEsc(b.nom.split('—')[0].trim())}</option>`).join('')||'<option value="">Aucun bien</option>';
  document.getElementById('loyerMontant').value=l?String(l.montant):'';
  document.getElementById('loyerJour').value=l?l.jour:5;
  setLoyerFreq(l?(l.freq||'mensuel'):'mensuel');
  document.getElementById('loyerSince').value=l?l.since:ymNow();
  document.getElementById('loyerModal').classList.add('open');
}
function closeLoyerModal(){ document.getElementById('loyerModal').classList.remove('open'); }
function saveLoyer(){
  const selBien=resolveBien(document.getElementById('loyerBien').value);
  const montant=Math.max(0,Math.round(+String(document.getElementById('loyerMontant').value).replace(/[^\d]/g,'')||0));
  if(!selBien){ toast('Ajoutez d\'abord un bien.'); return; }
  if(!montant){ toast('Indiquez le loyer mensuel.'); return; }
  const bienId=selBien.id, bien=selBien.nom;
  const jour=Math.min(28,Math.max(1,+document.getElementById('loyerJour').value||1));
  const freq=loyerFreqSel||'mensuel';
  const since=document.getElementById('loyerSince').value||ymNow();
  if(loyerEditId){ const l=loyerList().find(x=>x.id===loyerEditId); if(l){ l.bienId=bienId; l.bien=bien; l.montant=montant; l.jour=jour; l.freq=freq; l.since=since; } }
  else loyerList().push({id:'loy'+Date.now().toString(36), bienId, bien, montant, jour, freq, since});
  closeLoyerModal(); save(); renderLoyers(); toast(loyerEditId?'Loyer mis à jour.':'Loyer récurrent ajouté.');
}
function deleteLoyer(id){
  const l=loyerList().find(x=>x.id===id); if(!l) return;
  askDelete('Supprimer ce loyer récurrent et son historique de suivi ?', ()=>{
    S.loyers=loyerList().filter(x=>x.id!==id);
    const sm=loyerStatusMap(); Object.keys(sm).forEach(k=>{ if(k.indexOf(id+'|')===0) delete sm[k]; });
    save(); renderLoyers(); toast('Loyer supprimé.');
  });
}

let budTab='apercu';
function setBudTab(t){
  budTab=t;
  document.querySelectorAll('#budSubnav .bsub').forEach(b=>b.classList.toggle('sel', b.dataset.bt===t));
  document.querySelectorAll('#v-budget .bud-panel').forEach(p=>{ p.hidden = p.dataset.bt!==t; });
}
function renderBudget(){
  S.payments = S.payments || [];
  renderLoyers();
  const txs = S.transactions;
  const loyersRecu = loyerReceived().reduce((a,o)=>a+o.montant,0);
  const revenusTx = txs.filter(t=>t.montant>0).reduce((a,b)=>a+b.montant,0);
  const revenus = revenusTx + loyersRecu;
  const chargesAbs = Math.abs(txs.filter(t=>t.montant<0).reduce((a,b)=>a+b.montant,0));
  const solde = revenus - chargesAbs;

  /* ── Suivi des paiements ── */
  let totalDue=0, totalPaid=0;
  txs.filter(t=>t.montant<0).forEach(t=>{
    chargeShares(t).forEach(s=>{ if(s.paid) totalPaid+=s.due; else totalDue+=s.due; });
  });
  const pctPaid = chargesAbs ? Math.round(totalPaid/chargesAbs*100) : 0;

  /* ── Cartes résumé ── */
  const st = document.getElementById('budStats');
  if(st) st.innerHTML = `
    <div class="bud-stat rev">
      <div class="bs-ico" style="background:rgba(45,106,106,.12)">${svgIcon('trendup',18)}</div>
      <div class="bs-label">Revenus</div>
      <div class="bs-amount">+${eur(revenus)}</div>
      <div class="bs-sub">${txs.filter(t=>t.montant>0).length} entrée(s)${loyersRecu?` · dont loyers ${eur(loyersRecu)}`:''}</div>
    </div>
    <div class="bud-stat chg">
      <div class="bs-ico" style="background:rgba(192,57,57,.1)">${svgIcon('trenddown',18)}</div>
      <div class="bs-label">Charges</div>
      <div class="bs-amount">−${eur(chargesAbs)}</div>
      <div class="bs-sub">${txs.filter(t=>t.montant<0).length} dépense(s)</div>
    </div>
    <div class="bud-stat sol">
      <div class="bs-ico" style="background:rgba(44,82,130,.1)">${svgIcon('scale',18)}</div>
      <div class="bs-label">Solde net</div>
      <div class="bs-amount" style="color:${solde>=0?'var(--teal)':'#C0392B'}">${solde>=0?'+':'−'}${eur(Math.abs(solde))}</div>
      <div class="bs-sub">${solde>=0?'Le bien est positif':'Charges supérieures aux revenus'}</div>
    </div>
    <div class="bud-stat due">
      <div class="bs-ico" style="background:rgba(200,130,30,.12)">${svgIcon('hourglass',18)}</div>
      <div class="bs-label">Reste à régler</div>
      <div class="bs-amount">${eur(totalDue)}</div>
      <div class="bs-sub">${pctPaid}% des charges réglées</div>
    </div>`;

  /* ── Situation par bien (Vue d'ensemble) ── */
  const perBienMap={};
  (S.biens||[]).forEach(b=>{ perBienMap[b.id]={nom:b.nom, rev:0, chg:0}; });
  const pbBucket=b=>{ const k=b?b.id:'__c'; if(!perBienMap[k]) perBienMap[k]={nom:b?b.nom:"Commun à l'indivision", rev:0, chg:0}; return perBienMap[k]; };
  txs.forEach(t=>{ const bk=pbBucket(bienOfTx(t)); if(t.montant>0) bk.rev+=t.montant; else bk.chg+=Math.abs(t.montant); });
  loyerReceived().forEach(o=>{ pbBucket(resolveBien(o.loyer.bienId||o.loyer.bien)).rev+=o.montant; });
  const perBienList=Object.values(perBienMap).filter(x=>x.rev||x.chg);
  const bbMax=Math.max(1,...perBienList.map(x=>x.rev+x.chg));
  const bbEl=document.getElementById('budByBien');
  if(bbEl) bbEl.innerHTML = perBienList.length ? perBienList.map(x=>{
    const net=x.rev-x.chg;
    return `<div class="bb-row">
      <div class="bb-head"><span class="bb-name">${cEsc(String(x.nom).split('—')[0].trim())}</span><span class="bb-net ${net>=0?'pos':'neg'}">${net>=0?'+':'−'}${eur(Math.abs(net))}</span></div>
      <div class="bb-bar" style="width:${Math.max(8,(x.rev+x.chg)/bbMax*100)}%">${x.rev?`<span class="seg rev" style="flex:${x.rev}"></span>`:''}${x.chg?`<span class="seg chg" style="flex:${x.chg}"></span>`:''}</div>
      <div class="bb-legend"><span><i class="d rev"></i>Revenus ${eur(x.rev)}</span><span><i class="d chg"></i>Charges ${eur(x.chg)}</span></div>
    </div>`;
  }).join('') : '<div class="empty">Aucun mouvement enregistré.</div>';

  /* ── Situation par indivisaire (perçu / dû / payé / solde) ── */
  const ledger={};
  const lg=(name,ini)=>{ if(!ledger[name]) ledger[name]={name,ini,percu:0,du:0,paye:0}; return ledger[name]; };
  txs.filter(t=>t.montant<0).forEach(t=>{ chargeShares(t).forEach(s=>{ const g=lg(s.name,s.ini); g.du+=s.due; if(s.paid) g.paye+=s.due; }); });
  loyerReceived().forEach(o=>{ const parts=bienParts(resolveBien(o.loyer.bienId||o.loyer.bien)); const sum=parts.reduce((a,p)=>a+(+p.pct||0),0)||100; parts.forEach(p=>{ lg(p.name,p.ini).percu+=o.montant*(+p.pct||0)/sum; }); });
  const ledgerList=Object.values(ledger).sort((a,b)=>(b.percu-b.du)-(a.percu-a.du));
  const plEl=document.getElementById('budByPerson');
  if(plEl) plEl.innerHTML = ledgerList.length ? ledgerList.map((p,i)=>{
    const col=PAL[i%PAL.length]; const net=p.percu-p.du; const reste=Math.max(0,p.du-p.paye); const payPct=p.du?Math.round(p.paye/p.du*100):100;
    return `<div class="pl-row">
      <div class="split-av" style="background:linear-gradient(135deg,${col},${col}cc)">${p.ini}</div>
      <div class="pl-body">
        <div class="pl-top"><span class="pl-name">${cEsc(p.name)}</span><span class="pl-net ${net>=0?'pos':'neg'}">${net>=0?'+':'−'}${eur(Math.abs(net))} <small>solde</small></span></div>
        <div class="pl-cells">
          <span class="pl-cell"><i>Perçu</i><b class="pos">+${eur(p.percu)}</b></span>
          <span class="pl-cell"><i>Dû</i><b class="neg">−${eur(p.du)}</b></span>
          <span class="pl-cell"><i>Payé</i><b>${eur(p.paye)}</b></span>
          <span class="pl-cell"><i>Reste</i><b>${eur(reste)}</b></span>
        </div>
        <div class="pl-prog" title="${payPct}% des charges réglées"><div class="pl-prog-fill" style="width:${payPct}%"></div></div>
      </div>
    </div>`;
  }).join('') : '<div class="empty">Renseignez des charges ou des loyers pour voir la répartition.</div>';

  /* ── Charges par catégorie (donut) ── */
  const byCat = {};
  txs.filter(t=>t.montant<0).forEach(t=>{ const k=t.cat||'autre'; byCat[k]=(byCat[k]||0)+Math.abs(t.montant); });
  const cats = Object.entries(byCat).sort((a,b)=>b[1]-a[1]);
  const cc = document.getElementById('budCats');
  if(cc){
    if(!cats.length){ cc.innerHTML='<div class="empty">Aucune charge.</div>'; }
    else {
      const total = cats.reduce((a,[,v])=>a+v,0);
      let off=0; const circ=2*Math.PI*15.9;
      const segs = cats.map(([k,v])=>{
        const col=catInfo(k).color, frac=v/total, dash=frac*circ;
        const s=`<circle cx="21" cy="21" r="15.9" fill="none" stroke="${col}" stroke-width="6" stroke-dasharray="${dash} ${circ-dash}" stroke-dashoffset="${-off}"/>`;
        off+=dash; return s;
      }).join('');
      cc.innerHTML = `<div class="cat-chart">
        <svg width="130" height="130" viewBox="0 0 42 42" style="transform:rotate(-90deg)"><circle cx="21" cy="21" r="15.9" fill="none" stroke="#EEF2F8" stroke-width="6"/>${segs}</svg>
        <div class="cat-legend">${cats.map(([k,v])=>{
          const ci=catInfo(k);
          return `<div class="cat-leg-row"><span class="cat-leg-dot" style="background:${ci.color}"></span><span class="cat-leg-name">${svgIcon(ci.ic,15)} ${ci.label}</span><span class="cat-leg-val">${eur(v)}</span></div>`;
        }).join('')}</div>
      </div>`;
    }
  }

  /* ── Mouvements : résumé + regroupement par mois ── */
  const filtered = txs.map((t,i)=>({...t,i})).filter(t=>{
    if(txFilter==='charge') return t.montant<0;
    if(txFilter==='revenu') return t.montant>0;
    return true;
  });
  const fRev = filtered.filter(t=>t.montant>0).reduce((a,t)=>a+t.montant,0);
  const fChg = Math.abs(filtered.filter(t=>t.montant<0).reduce((a,t)=>a+t.montant,0));
  const cnt = document.getElementById('txCount');
  if(cnt) cnt.textContent = `${filtered.length} opération(s)`;
  const sumEl = document.getElementById('txSummary');
  if(sumEl) sumEl.innerHTML = `
    <div class="mvt-kpi"><span class="mvt-k-lbl">Entrées</span><span class="mvt-k-val pos">+${eur(fRev)}</span></div>
    <div class="mvt-kpi"><span class="mvt-k-lbl">Sorties</span><span class="mvt-k-val neg">−${eur(fChg)}</span></div>
    <div class="mvt-kpi"><span class="mvt-k-lbl">Solde</span><span class="mvt-k-val ${fRev-fChg>=0?'pos':'neg'}">${fRev-fChg>=0?'+':'−'}${eur(Math.abs(fRev-fChg))}</span></div>`;
  const txRowHTML = t => {
    const ci = catInfo(t.cat);
    const pos = t.montant>=0;
    const chip = pos ? '' : statutChip(chargeStatut(t));
    return `<div class="tx-row ${pos?'':'payable'}" ${pos?'':`onclick="openPayModal(${t.i})"`}>
      <div class="tx-ico" style="background:${pos?'rgba(45,106,106,.1)':ci.color+'1f'}">${pos?svgIcon('coins',18):svgIcon(ci.ic,18)}</div>
      <div class="tx-body">
        <div class="tx-desc">${cEsc(t.desc)}</div>
        <div class="tx-meta">
          <span class="tx-tag">${ci.label}</span>
          <span>${svgIcon('pin',12)} ${cEsc((t.bien&&t.bien!=='__all__')?String(t.bien).split('—')[0].trim():'Commun')}</span>
          ${t.date?`<span>${new Date(t.date+'T00:00:00').toLocaleDateString('fr-FR',{day:'numeric',month:'short'})}</span>`:''}
          ${chip}
        </div>
      </div>
      <div class="tx-right">
        <span class="tx-amount ${pos?'pos':'neg'}">${pos?'+':'−'}${eur(Math.abs(t.montant))}</span>
        <span class="del" onclick="event.stopPropagation();askDelete('Supprimer cette opération ?', ()=>{ S.transactions.splice(${t.i},1); save(); })" title="Supprimer">${DELSVG}</span>
      </div>
    </div>`;
  };
  const groups={};
  filtered.forEach(t=>{ const ym=String(t.date||'').slice(0,7); (groups[ym]=groups[ym]||[]).push(t); });
  const ymKeys=Object.keys(groups).sort().reverse();
  const tl = document.getElementById('txList');
  if(tl) tl.innerHTML = ymKeys.length ? ymKeys.map(ym=>{
    const list=groups[ym].sort((a,b)=>String(b.date).localeCompare(String(a.date)));
    const net=list.reduce((a,t)=>a+t.montant,0);
    const label = /^\d{4}-\d{2}$/.test(ym) ? new Date(+ym.slice(0,4),+ym.slice(5,7)-1,1).toLocaleDateString('fr-FR',{month:'long',year:'numeric'}) : 'Sans date';
    return `<div class="tx-month"><span class="tx-month-lbl">${label}</span><span class="tx-month-net ${net>=0?'pos':'neg'}">${net>=0?'+':'−'}${eur(Math.abs(net))}</span></div>`
      + list.map(txRowHTML).join('');
  }).join('') : '<div class="empty">Aucune opération.</div>';
}

/* Filtre */
document.querySelectorAll('#txFilter .bf-chip').forEach(c=>c.addEventListener('click',()=>{
  document.querySelectorAll('#txFilter .bf-chip').forEach(x=>x.classList.remove('sel'));
  c.classList.add('sel'); txFilter=c.dataset.f; renderBudget();
}));

/* ── MODAL TRANSACTION ── */
let txEditType='charge', txEditCat='taxe';
function openTxModal(){
  txEditType='charge'; txEditCat='taxe';
  document.getElementById('txDesc').value='';
  document.getElementById('txMontant').value='';
  document.getElementById('txDate').value=_todayISO;
  document.querySelectorAll('#txTypePicker .type-opt').forEach(o=>o.classList.toggle('sel',o.dataset.v==='charge'));
  /* Catégories selon le type */
  buildTxCats();
  /* Sélecteur de bien */
  const sel=document.getElementById('txBien');
  sel.innerHTML=S.biens.map(b=>`<option value="${b.id}">${cEsc(b.nom)}</option>`).join('')+'<option value="__all__">Commun à l\'indivision</option>';
  updateTxSplitInfo();
  document.getElementById('txModal').classList.add('open');
  setTimeout(()=>document.getElementById('txDesc').focus(),60);
}
function closeTxModal(){ document.getElementById('txModal').classList.remove('open'); }
function buildTxCats(){
  const keys = txEditType==='revenu' ? ['loyer','autre'] : ['taxe','travaux','copro','assurance','energie','autre'];
  if(!keys.includes(txEditCat)) txEditCat=keys[0];
  document.getElementById('txCatPicker').innerHTML = keys.map(k=>{
    const ci=TX_CATS[k];
    return `<div class="type-opt${k===txEditCat?' sel':''}" data-v="${k}"><span class="dot" style="background:${ci.color}"></span>${svgIcon(ci.ic,15)} ${ci.label}</div>`;
  }).join('');
  document.querySelectorAll('#txCatPicker .type-opt').forEach(o=>o.addEventListener('click',()=>{
    document.querySelectorAll('#txCatPicker .type-opt').forEach(x=>x.classList.remove('sel'));
    o.classList.add('sel'); txEditCat=o.dataset.v;
  }));
}
function updateTxSplitInfo(){
  const info=document.getElementById('txSplitInfo');
  const m=parseFloat((document.getElementById('txMontant').value||'').replace(',','.'))||0;
  if(txEditType==='revenu'){
    info.innerHTML='Les revenus sont répartis entre indivisaires selon les quote-parts.';
    return;
  }
  if(!m){ info.innerHTML='La charge sera répartie automatiquement selon les quote-parts du bien sélectionné.'; return; }
  const bien = resolveBien(document.getElementById('txBien').value);
  const parts = bienParts(bien);
  const tot = parts.reduce((a,b)=>a+(+b.pct||0),0)||100;
  const src = (bien && bien.parts) ? bien.nom.split('—')[0].trim() : 'parts globales';
  info.innerHTML=`<b style="color:var(--navy)">Répartition (${src}) :</b><br>`+parts.map(p=>`${p.name} (${p.pct}%) → <b>${eur(m*p.pct/tot)}</b>`).join(' · ');
}
function saveTx(){
  const desc=document.getElementById('txDesc').value.trim();
  let m=parseFloat((document.getElementById('txMontant').value||'').replace(',','.'));
  if(!desc){ toast('Indiquez une description.'); document.getElementById('txDesc').focus(); return; }
  if(!m||m<=0){ toast('Indiquez un montant valide.'); document.getElementById('txMontant').focus(); return; }
  const date=document.getElementById('txDate').value||_todayISO;
  const selBien=resolveBien(document.getElementById('txBien').value);
  const bienId = selBien ? selBien.id : null;
  const bien = selBien ? selBien.nom : '__all__';
  const montant = txEditType==='revenu' ? Math.abs(m) : -Math.abs(m);
  S.transactions.unshift({desc, cat:txEditCat, bienId, bien, montant, date});
  closeTxModal(); save(); toast('Transaction ajoutée.');
}
/* Type picker du modal transaction */
document.querySelectorAll('#txTypePicker .type-opt').forEach(o=>o.addEventListener('click',()=>{
  document.querySelectorAll('#txTypePicker .type-opt').forEach(x=>x.classList.remove('sel'));
  o.classList.add('sel'); txEditType=o.dataset.v; buildTxCats(); updateTxSplitInfo();
}));
/* Mise à jour de l'aperçu de répartition en saisissant le montant */
document.getElementById('txMontant')?.addEventListener('input', updateTxSplitInfo);
document.getElementById('txBien')?.addEventListener('change', updateTxSplitInfo);

/* ── INVENTAIRE ── */
let invFilter='all', invTargets=[];
function invNum(v){ return parseFloat(String(v||'0').replace(/[^\d.,]/g,'').replace(/\s/g,'').replace(',','.'))||0; }
/* bien effectif d'un objet (rattaché à 'Commun' si bien inconnu/absent) */
function invBienOf(it){ const names=S.biens.map(b=>b.nom); return names.includes(it.bien)?it.bien:'Commun'; }
function setInvFilterIdx(k){ invFilter=invTargets[k]; renderInventaire(); }

function renderInventaire(){
  const body=document.getElementById('inventaireBody');
  if(!body) return;

  /* Vue globale : nb d'objets + valeur totale */
  const totalCount=S.inventaire.length;
  const totalVal=S.inventaire.reduce((a,it)=>a+invNum(it.val),0);
  const stEl=document.getElementById('invStats');
  if(stEl) stEl.innerHTML=`
    <div class="bud-stat"><div class="bs-ico" style="background:rgba(44,82,130,.1)">${svgIcon('box',18)}</div><div class="bs-label">Objets</div><div class="bs-amount" style="color:var(--navy)">${totalCount}</div><div class="bs-sub">dans l'inventaire</div></div>
    <div class="bud-stat"><div class="bs-ico" style="background:rgba(45,106,106,.12)">${svgIcon('coins',18)}</div><div class="bs-label">Valeur totale</div><div class="bs-amount" style="color:var(--teal)">${eur(totalVal)}</div><div class="bs-sub">tous biens confondus</div></div>`;

  /* Filtre par bien */
  const bienNames=S.biens.map(b=>b.nom);
  const hasCommun=S.inventaire.some(it=>invBienOf(it)==='Commun');
  invTargets=['all', ...bienNames.filter(n=>S.inventaire.some(it=>it.bien===n)), ...(hasCommun?['Commun']:[])];
  if(!invTargets.includes(invFilter)) invFilter='all';
  const fEl=document.getElementById('invFilter');
  if(fEl) fEl.innerHTML=invTargets.map((t,k)=>{
    const label = t==='all'?'Tous' : (t==='Commun'?'Commun' : t);
    const cnt = t==='all'?totalCount : S.inventaire.filter(it=>invBienOf(it)===t).length;
    return `<span class="bf-chip ${invFilter===t?'sel':''}" onclick="setInvFilterIdx(${k})">${label} <span style="opacity:.55">${cnt}</span></span>`;
  }).join('');

  /* Groupes affichés */
  const groupNames = invFilter==='all'
    ? invTargets.filter(t=>t!=='all')
    : [invFilter];

  body.innerHTML = groupNames.map(gn=>{
    const items=S.inventaire.map((it,i)=>({it,i})).filter(x=>invBienOf(x.it)===gn);
    if(!items.length) return '';
    const sub=items.reduce((a,x)=>a+invNum(x.it.val),0);
    return `<div class="card inv-group">
      <div class="card-head">
        <div><div class="card-title">${gn==='Commun'? svgIcon('folder',16)+' Commun (aucun bien)' : svgIcon('home',16)+' '+gn}</div><div class="card-sub">${items.length} objet(s) · ${eur(sub)}</div></div>
      </div>
      <div class="inv-grid">${items.map(x=>`
        <div class="inv-item">
          <div class="inv-item-head">
            <span class="inv-ico">${svgIcon(x.it.ic||'box',20)}</span>
            <span class="inv-acts">
              <button class="inv-act" onclick="openInvModal(${x.i})" title="Modifier">${svgIcon('edit',13)}</button>
              <button class="inv-act del" onclick="deleteInv(${x.i})" title="Supprimer">${DELSVG}</button>
            </span>
          </div>
          <div class="inv-name">${x.it.nom}</div>
          <div class="inv-val">${x.it.val}</div>
        </div>`).join('')}</div>
    </div>`;
  }).join('') || '<div class="empty">Aucun élément dans l\'inventaire. Ajoutez votre premier objet.</div>';
}

/* ── MODAL INVENTAIRE (ajout / modification) ── */
const INV_ICONS=['box','sofa','bed','tv','fridge','tree','washer','chair','desktop','shower','plate','basket','image','wrench'];
let invEditIdx=-1, invIcon='box';
function openInvModal(idx){
  invEditIdx = (typeof idx==='number') ? idx : -1;
  const it = invEditIdx>-1 ? S.inventaire[invEditIdx] : null;
  document.getElementById('invModalTitle').textContent = it ? "Modifier l'élément" : 'Ajouter un élément';
  document.getElementById('invNom').value = it ? it.nom : '';
  document.getElementById('invVal').value = it ? String(invNum(it.val)||'').replace(/\B(?=(\d{3})+(?!\d))/g,' ') : '';
  invIcon = it ? (it.ic||'box') : 'box';
  const sel=document.getElementById('invBien');
  sel.innerHTML = S.biens.map(b=>`<option value="${b.nom.replace(/"/g,'&quot;')}">${b.nom}</option>`).join('')+'<option value="Commun">Commun (aucun bien)</option>';
  sel.value = it ? (S.biens.some(b=>b.nom===it.bien)?it.bien:'Commun') : (S.biens[0]?S.biens[0].nom:'Commun');
  document.getElementById('invIconPicker').innerHTML = INV_ICONS.map(e=>`<button type="button" class="inv-emoji${e===invIcon?' sel':''}" data-ic="${e}" onclick="selectInvIcon('${e}')">${svgIcon(e,20)}</button>`).join('');
  document.getElementById('invModal').classList.add('open');
  setTimeout(()=>document.getElementById('invNom').focus(),60);
}
function closeInvModal(){ document.getElementById('invModal').classList.remove('open'); }
function selectInvIcon(e){ invIcon=e; document.querySelectorAll('#invIconPicker .inv-emoji').forEach(b=>b.classList.toggle('sel',b.dataset.ic===e)); }
function saveInv(){
  const nom=document.getElementById('invNom').value.trim();
  if(!nom){ toast('Indiquez un nom.'); document.getElementById('invNom').focus(); return; }
  const digits=document.getElementById('invVal').value.replace(/[^\d]/g,'');
  const val = digits ? (Number(digits).toLocaleString('fr-FR').replace(/\s/g,' ')+' €') : '—';
  const bien=document.getElementById('invBien').value||'Commun';
  const obj={nom, val, ic:invIcon, bien};
  if(invEditIdx>-1) S.inventaire[invEditIdx]=obj; else S.inventaire.push(obj);
  closeInvModal(); save(); toast(invEditIdx>-1?'Élément modifié.':'Élément ajouté.');
}
function deleteInv(idx){
  const it=S.inventaire[idx]; if(!it) return;
  askDelete('Supprimer « '+it.nom+' » de l\'inventaire ?', ()=>{
    S.inventaire.splice(idx,1); save(); toast('Élément supprimé.');
  });
}

/* ── INCIDENTS ── */
const INC_TYPES=[
  {k:'degat_eaux', ic:'drop', lbl:'Dégât des eaux'},
  {k:'electrique', ic:'bolt', lbl:'Électrique'},
  {k:'toiture',    ic:'building', lbl:'Toiture'},
  {k:'chauffage',  ic:'fire', lbl:'Chauffage'},
  {k:'serrurerie', ic:'key', lbl:'Serrurerie'},
  {k:'autre',      ic:'alert', lbl:'Autre'},
];
function incTypeIcon(k){ return (INC_TYPES.find(t=>t.k===k)||{}).ic || 'alert'; }
const INC_STATUTS={
  declare:{label:'Déclaré',  cls:'st-apayer',  dot:'#C0392B', ic:'alert', logbg:'rgba(192,57,57,.12)', logtxt:'#C0392B'},
  encours:{label:'En cours', cls:'st-attente', dot:'#C8821E', ic:'clock', logbg:'rgba(200,130,30,.14)', logtxt:'#9A6010'},
  resolu: {label:'Résolu',   cls:'st-paye',    dot:'#19A974', ic:'check', logbg:'rgba(25,169,116,.14)', logtxt:'#13855B'},
};
function incBienOf(inc){ const names=S.biens.map(b=>b.nom); return names.includes(inc.bien)?inc.bien:'Commun'; }
let incFilter='all', incTargets=[];
function setIncFilterIdx(k){ incFilter=incTargets[k]; renderIncidents(); }
function incLog(inc, text, statut){
  S.incidentsLog=S.incidentsLog||[];
  const s=INC_STATUTS[statut]||{ic:'•',logbg:'rgba(44,82,130,.1)',logtxt:'var(--accent)'};
  S.incidentsLog.unshift({ts:new Date().toISOString(), bien:inc.bien, text:`<b>${inc.titre}</b> — ${text}`, ic:s.ic, bg:s.logbg, txt:s.logtxt});
}

function renderIncidents(){
  S.incidentsLog = S.incidentsLog || [];
  /* normalisation (anciennes données) */
  S.incidents.forEach(inc=>{
    if(!inc.statut) inc.statut = inc.st==='Résolu'?'resolu':(inc.st==='En cours'?'encours':'declare');
    if(!inc.bien) inc.bien='Commun';
    if(!inc.ic) inc.ic=incTypeIcon(inc.cat);
  });

  /* Stats par statut */
  const c={declare:0,encours:0,resolu:0};
  S.incidents.forEach(i=>{ c[i.statut]=(c[i.statut]||0)+1; });
  const stEl=document.getElementById('incStats');
  if(stEl) stEl.innerHTML=`
    <div class="bud-stat"><div class="bs-ico" style="background:rgba(192,57,57,.1)">${svgIcon('alert',18)}</div><div class="bs-label">Déclarés</div><div class="bs-amount" style="color:#C0392B">${c.declare}</div><div class="bs-sub">à traiter</div></div>
    <div class="bud-stat"><div class="bs-ico" style="background:rgba(200,130,30,.12)">${svgIcon('clock',18)}</div><div class="bs-label">En cours</div><div class="bs-amount" style="color:#9A6010">${c.encours}</div><div class="bs-sub">en traitement</div></div>
    <div class="bud-stat"><div class="bs-ico" style="background:rgba(25,169,116,.14)">${svgIcon('check',18)}</div><div class="bs-label">Résolus</div><div class="bs-amount" style="color:#13855B">${c.resolu}</div><div class="bs-sub">clôturés</div></div>`;

  /* Filtre par bien */
  const bienNames=S.biens.map(b=>b.nom);
  const hasCommun=S.incidents.some(i=>incBienOf(i)==='Commun');
  incTargets=['all', ...bienNames.filter(n=>S.incidents.some(i=>i.bien===n)), ...(hasCommun?['Commun']:[])];
  if(!incTargets.includes(incFilter)) incFilter='all';
  const fEl=document.getElementById('incFilter');
  if(fEl) fEl.innerHTML=incTargets.map((t,k)=>{
    const label=t==='all'?'Tous':(t==='Commun'?'Commun':t);
    const cnt=t==='all'?S.incidents.length:S.incidents.filter(i=>incBienOf(i)===t).length;
    return `<span class="bf-chip ${incFilter===t?'sel':''}" onclick="setIncFilterIdx(${k})">${label} <span style="opacity:.55">${cnt}</span></span>`;
  }).join('');

  /* Liste filtrée */
  const list=S.incidents.map((inc,i)=>({inc,i})).filter(x=> incFilter==='all' || incBienOf(x.inc)===incFilter);
  const el=document.getElementById('incidentsList');
  if(el) el.innerHTML=list.map(x=>{
    const inc=x.inc, i=x.i, sc=INC_STATUTS[inc.statut]||INC_STATUTS.declare;
    const dateStr=inc.date?new Date(inc.date+'T00:00:00').toLocaleDateString('fr-FR'):'';
    return `<div class="inc-card">
      <div class="inc-ico">${svgIcon(inc.ic||'alert',20)}</div>
      <div class="inc-body">
        <div class="inc-top">
          <span class="inc-title">${inc.titre}</span>
          <span class="st-chip ${sc.cls}"><span class="st-dot" style="background:${sc.dot}"></span>${sc.label}</span>
        </div>
        ${inc.desc?`<div class="inc-desc">${inc.desc}</div>`:''}
        <div class="inc-meta">${svgIcon('pin',12)} ${inc.bien}${dateStr?(' · '+dateStr):''}${inc.by?(' · signalé par '+inc.by):''}</div>
        <div class="inc-status-seg">
          ${['declare','encours','resolu'].map(s=>`<button class="iss ${inc.statut===s?('on '+INC_STATUTS[s].cls):''}" onclick="setIncStatus(${i},'${s}')">${INC_STATUTS[s].label}</button>`).join('')}
        </div>
      </div>
      <button class="del" onclick="deleteIncident(${i})" title="Supprimer">${DELSVG}</button>
    </div>`;
  }).join('') || '<div class="empty">Aucun incident pour ce filtre.</div>';

  /* Historique */
  const log=S.incidentsLog||[];
  const lsub=document.getElementById('incLogSub'); if(lsub) lsub.textContent = log.length?`${log.length} événement(s)`:'Aucun événement pour le moment';
  const ll=document.getElementById('incLogList');
  if(ll) ll.innerHTML=log.slice(0,40).map(e=>`
    <div class="payhist-row">
      <div class="payhist-ico" style="background:${e.bg||'rgba(44,82,130,.1)'};color:${e.txt||'var(--accent)'}">${svgIcon(e.ic||'check',16)}</div>
      <div class="payhist-body">
        <div class="payhist-main">${e.text}</div>
        <div class="payhist-meta">${svgIcon('pin',12)} ${e.bien} · ${new Date(e.ts).toLocaleString('fr-FR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</div>
      </div>
    </div>`).join('') || '<div class="empty">L\'activité des incidents apparaîtra ici.</div>';
}
function setIncStatus(i,s){
  const inc=S.incidents[i]; if(!inc||inc.statut===s) return;
  inc.statut=s; inc.st=INC_STATUTS[s].label;
  incLog(inc, 'Statut : '+INC_STATUTS[s].label, s);
  save(); toast('Statut mis à jour : '+INC_STATUTS[s].label);
}
function deleteIncident(i){
  const inc=S.incidents[i]; if(!inc) return;
  askDelete('Supprimer l\'incident « '+inc.titre+' » ?', ()=>{
    S.incidents.splice(i,1); save(); toast('Incident supprimé.');
  });
}

/* ── MODAL DÉCLARATION D'INCIDENT ── */
let incType='degat_eaux';
function openIncModal(){
  incType='degat_eaux';
  document.getElementById('incTitre').value='';
  document.getElementById('incDesc').value='';
  document.getElementById('incDate').value=_todayISO;
  document.getElementById('incTypeGrid').innerHTML=INC_TYPES.map(t=>
    `<div class="type-card${t.k===incType?' sel':''}" data-k="${t.k}" onclick="selectIncType('${t.k}')">
       <span class="tc-ico">${svgIcon(t.ic,24)}</span><span class="tc-lbl">${t.lbl}</span></div>`).join('');
  const sel=document.getElementById('incBien');
  sel.innerHTML = S.biens.length
    ? S.biens.map(b=>`<option value="${b.nom.replace(/"/g,'&quot;')}">${b.nom}</option>`).join('')
    : '<option value="">— Aucun bien disponible —</option>';
  document.getElementById('incModal').classList.add('open');
  setTimeout(()=>document.getElementById('incTitre').focus(),60);
}
function closeIncModal(){ document.getElementById('incModal').classList.remove('open'); }
function selectIncType(k){ incType=k; document.querySelectorAll('#incTypeGrid .type-card').forEach(c=>c.classList.toggle('sel',c.dataset.k===k)); }
function saveIncident(){
  const titre=document.getElementById('incTitre').value.trim();
  if(!titre){ toast('Décrivez l\'incident.'); document.getElementById('incTitre').focus(); return; }
  const bien=document.getElementById('incBien').value;
  if(!bien){ toast('Sélectionnez le bien concerné.'); return; }
  const desc=document.getElementById('incDesc').value.trim();
  const date=document.getElementById('incDate').value||_todayISO;
  const me=meCoi(); const by = me ? (me.n||'').replace(/\s*\(vous\)/i,'').trim() : 'Vous';
  const inc={titre, desc, cat:incType, ic:incTypeIcon(incType), bien, statut:'declare', st:'Déclaré', date, by};
  S.incidents.unshift(inc);
  incLog(inc, 'Incident déclaré', 'declare');
  closeIncModal(); save(); toast('Incident déclaré.');
}

/* ━━━━ ACTIONS ━━━━ */
/* ━━━━ WIZARD AJOUT D'UN BIEN ━━━━ */
const BIEN_TYPES = [
  {k:'maison',   ic:'home', lbl:'Maison'},
  {k:'appart',   ic:'building', lbl:'Appartement'},
  {k:'terrain',  ic:'tree', lbl:'Terrain'},
  {k:'immeuble', ic:'building2', lbl:'Immeuble'},
  {k:'local',    ic:'shop', lbl:'Local pro'},
  {k:'autre',    ic:'pin', lbl:'Autre'},
];
function bienIcon(type){ return (BIEN_TYPES.find(t=>t.k===type)||{}).ic || 'home'; }
let wizStep = 1, wizData = {};

/* alias appelé par le bouton "+ Ajouter un bien" */
function addBien(){ openBienModal(); }

function openBienModal(){
  wizData = {type:'maison', nom:'', ville:'', surface:'', val:'', photos:[], lat:null, lng:null};
  document.getElementById('bienTypeGrid').innerHTML = BIEN_TYPES.map(t=>
    `<div class="type-card${t.k===wizData.type?' sel':''}" data-k="${t.k}" onclick="selectBienType('${t.k}')">
       <span class="tc-ico">${svgIcon(t.ic,24)}</span><span class="tc-lbl">${t.lbl}</span></div>`).join('');
  ['bienNom','bienVille','bienSurface','bienVal'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
  document.getElementById('bienPhotos').innerHTML='';
  /* Pré-remplir avec les co-indivisaires réels de l'indivision (et non le seul titulaire) */
  wizParts = (S.coi||[]).map(c=>({ ini:c.ini||'?', name:(c.n||'').replace(/\s*\(vous\)/i,'').trim()||'—', pct:0 }));
  if(!wizParts.length){ const me=meCoi()||{}; wizParts=[{ini:me.ini||'?', name:(me.n||'Vous').replace(/\s*\(vous\)/i,'').trim()||'Vous', pct:100}]; }
  else { const sh=equalShares(wizParts.length); wizParts.forEach((p,i)=>p.pct=sh[i]); }
  renderWizParts();
  wizGo(1);
  document.getElementById('bienModal').classList.add('open');
}
function closeBienModal(){ document.getElementById('bienModal').classList.remove('open'); }
function selectBienType(k){
  wizData.type=k;
  document.querySelectorAll('#bienTypeGrid .type-card').forEach(c=>c.classList.toggle('sel',c.dataset.k===k));
}
function wizGo(step){
  wizStep = step;
  document.querySelectorAll('#bienModal .wiz-pane').forEach(p=>p.hidden = (+p.dataset.step!==step));
  document.getElementById('wizBarFill').style.width = (step/5*100)+'%';
  document.querySelectorAll('#wizSteps .wiz-step').forEach((s,i)=>{
    s.classList.toggle('active', i+1===step);
    s.classList.toggle('done', i+1<step);
  });
  document.getElementById('wizPrev').style.visibility = step===1 ? 'hidden' : 'visible';
  document.getElementById('wizNext').textContent = step===5 ? 'Créer le bien ✓' : 'Suivant →';
  const focusId = {2:'bienNom',3:'bienVal'}[step];
  if(focusId) setTimeout(()=>document.getElementById(focusId)?.focus(),80);
}
function wizPrev(){ if(wizStep>1) wizGo(wizStep-1); }
function wizNext(){
  if(wizStep===2){
    const nom=document.getElementById('bienNom').value.trim();
    if(!nom){ toast('Donnez un nom au bien.'); return; }
    wizData.nom=nom;
    wizData.ville=document.getElementById('bienVille').value.trim();
    wizData.surface=document.getElementById('bienSurface').value.trim();
  }
  if(wizStep===3){ wizData.val=document.getElementById('bienVal').value.trim(); }
  if(wizStep===4){
    if(wizParts.some(p=>!(p.name||'').trim())){ toast('Renseignez le nom de chaque indivisaire.'); return; }
    const sum=wizParts.reduce((a,p)=>a+(+p.pct||0),0);
    if(!pctComplete(sum)){ toast('Le total des quote-parts doit faire 100%.'); return; }
  }
  if(wizStep===5){ saveBien(); return; }
  wizGo(wizStep+1);
}
function formatBienVal(el){
  const v = el.value.replace(/[^\d]/g,'');
  el.value = v ? Number(v).toLocaleString('fr-FR').replace(/\s/g,' ') : '';
}
/* Photos : downscale via canvas pour tenir dans localStorage, max 6 */
function handleBienPhotos(files){
  [...files].forEach(f=>{
    if(!f.type.startsWith('image/')) return;
    if(wizData.photos.length>=6){ toast('6 photos maximum.'); return; }
    const reader=new FileReader();
    reader.onload=e=>{
      const img=new Image();
      img.onload=()=>{
        const max=900, scale=Math.min(1,max/Math.max(img.width,img.height));
        const c=document.createElement('canvas');
        c.width=Math.round(img.width*scale); c.height=Math.round(img.height*scale);
        c.getContext('2d').drawImage(img,0,0,c.width,c.height);
        wizData.photos.push(c.toDataURL('image/jpeg',0.72));
        renderWizPhotos();
      };
      img.src=e.target.result;
    };
    reader.readAsDataURL(f);
  });
}
function renderWizPhotos(){
  document.getElementById('bienPhotos').innerHTML = wizData.photos.map((src,i)=>
    `<div class="wiz-photo"><img src="${src}" alt=""><button class="wp-del" onclick="wizData.photos.splice(${i},1);renderWizPhotos()" title="Retirer">${DELSVG}</button></div>`).join('');
}
function saveBien(){
  const VILLES={paris:[48.85,2.35],lyon:[45.76,4.84],marseille:[43.30,5.37],annecy:[45.90,6.13],bordeaux:[44.84,-0.58],lille:[50.63,3.06],toulouse:[43.60,1.44],nantes:[47.22,-1.55],nice:[43.71,7.26],strasbourg:[48.58,7.75],montpellier:[43.61,3.88],rennes:[48.11,-1.68]};
  const ville=(wizData.ville||'').toLowerCase();
  let lat, lng;
  if(typeof wizData.lat==='number' && typeof wizData.lng==='number'){
    lat=wizData.lat; lng=wizData.lng; /* coordonnées précises issues de l'adresse choisie */
  } else {
    lat=46.6+(Math.random()-.5)*2; lng=2.4+(Math.random()-.5)*3;
    for(const v in VILLES){ if(ville.includes(v)){ lat=VILLES[v][0]; lng=VILLES[v][1]; break; } }
  }
  const surf = wizData.surface ? (' · '+wizData.surface+' m²') : '';
  const info = (wizData.ville || 'Localisation non précisée')+surf;
  const digits=(wizData.val||'').replace(/[^\d]/g,'');
  const val = digits ? (Number(digits).toLocaleString('fr-FR').replace(/\s/g,' ')+' €') : '—';
  const parts = wizParts.map(p=>({ ini:(p.ini&&p.ini!=='?')?p.ini:((p.name||'').trim().split(/\s+/).map(w=>w[0]||'').join('').slice(0,2).toUpperCase()||'?'), name:(p.name||'').trim(), pct:+p.pct||0 }));
  S.biens.push({ id:'b'+Math.random().toString(36).slice(2,9), nom:wizData.nom, info, val, type:wizData.type, surface:wizData.surface, photos:wizData.photos, parts, lat, lng });
  save(); closeBienModal(); toast('Bien ajouté ✓'); go('portfolio');
}
/* Éditeur d'indivisaires du wizard d'ajout de bien */
let wizParts=[];
function renderWizParts(){
  const el=document.getElementById('wizPartsRows'); if(!el) return;
  el.innerHTML = wizParts.map((p,i)=>`
    <div class="parts-edit-row">
      <input type="text" placeholder="Prénom" value="${(p.name||'').replace(/"/g,'&quot;')}" oninput="wizParts[${i}].name=this.value;updateWizSum()">
      <div style="position:relative"><input type="number" min="0" max="100" step="any" placeholder="0" value="${p.pct}" oninput="wizParts[${i}].pct=+this.value;updateWizSum()" style="padding-right:28px"><span style="position:absolute;right:9px;top:50%;transform:translateY(-50%);color:var(--texte-doux);font-size:.8rem">%</span></div>
      <button class="del-btn" onclick="askDelete('Retirer ce co-indivisaire ?', ()=>{ wizParts.splice(${i},1); renderWizParts(); })" title="Supprimer">${DELSVG}</button>
    </div>`).join('');
  updateWizSum();
}
function addWizPart(){ wizParts.push({ini:'?',name:'',pct:0}); renderWizParts(); }
/* Autocomplétion d'adresse (Base Adresse Nationale) + coordonnées pour la carte */
let _bienAddrT=null, _bienAddrFeatures=[];
function bienAddrInput(v){
  wizData.lat=null; wizData.lng=null; /* tant qu'aucune adresse n'est choisie, pas de coordonnées précises */
  const sug=document.getElementById('bienAddrSug'); if(!sug) return;
  if((v||'').trim().length<3){ sug.style.display='none'; sug.innerHTML=''; return; }
  clearTimeout(_bienAddrT);
  _bienAddrT=setTimeout(async()=>{
    try{
      const res=await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(v)}&limit=6&autocomplete=1`);
      const json=await res.json(); const feats=json.features||[]; _bienAddrFeatures=feats;
      if(!feats.length){ sug.style.display='none'; sug.innerHTML=''; return; }
      sug.innerHTML=feats.map((f,i)=>`<div class="addr-item" onmousedown="bienAddrPick(${i})">${svgIcon('pin',14)}<span>${cEsc(f.properties.label)}</span></div>`).join('');
      sug.style.display='block';
    }catch(e){ sug.style.display='none'; }
  },220);
}
function bienAddrPick(i){
  const f=_bienAddrFeatures[i]; if(!f) return;
  const p=f.properties||{}, c=f.geometry&&f.geometry.coordinates;
  const inp=document.getElementById('bienVille'); if(inp) inp.value=p.label||'';
  wizData.ville=p.label||'';
  if(c && c.length===2){ wizData.lng=+c[0]; wizData.lat=+c[1]; }
  bienAddrHide();
}
function bienAddrHide(){ const sug=document.getElementById('bienAddrSug'); if(sug){ sug.style.display='none'; } }
function wizPartsEqual(){ const n=wizParts.length; if(!n){ toast('Ajoutez d’abord un indivisaire.'); return; } const sh=equalShares(n); wizParts.forEach((p,i)=>{ p.pct=sh[i]; }); renderWizParts(); }
function updateWizSum(){
  const sum=wizParts.reduce((a,p)=>a+(+p.pct||0),0);
  const el=document.getElementById('wizPartsSum'); if(el) el.innerHTML=`<span class="parts-sum ${pctComplete(sum)?'ok':'bad'}">Total : ${pctDisplay(sum)}%${pctComplete(sum)?' ✓':' — doit faire 100%'}</span>`;
}
/* Drag & drop sur la zone photo du wizard */
(function(){
  const drop=document.getElementById('bienDrop'); if(!drop) return;
  ['dragover','dragenter'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add('over');}));
  ['dragleave','dragend'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove('over');}));
  drop.addEventListener('drop',e=>{e.preventDefault();drop.classList.remove('over');handleBienPhotos(e.dataTransfer.files);});
})();
function addEstim(){
  const t=prompt('Titre :','');if(!t)return;
  const d=prompt('Résultat :','')||'—';
  const a=divimoSims(); a.unshift({type:'autre',titre:t,detail:d,date:new Date().toISOString()});
  ssSet('divimo_sims', JSON.stringify(a)); renderEstim(); toast('Simulation enregistrée.');
}
function inviteCoi(){
  const n=prompt('Prénom et nom du co-indivisaire :','');if(!n)return;
  const p=prompt('Quote-part (%) :','0')||'0';
  const ini=n.trim().split(/\s+/).map(w=>w[0]||'').join('').slice(0,2).toUpperCase()||'??';
  S.coi.push({n,r:p+'% · Co-indivisaire',ini,st:'Invité',cls:'pill-warn'});save();toast('Invitation envoyée.');
}
/* ── Prise de rendez-vous (modal) ── */
const RDV_SLOTS=['09:00','10:30','11:30','14:00','15:30','17:00'];
let rdvSlot=RDV_SLOTS[0];
function renderRdvSlots(){
  const el=document.getElementById('rdvSlots'); if(!el) return;
  el.innerHTML=RDV_SLOTS.map(s=>`<button type="button" class="rdv-slot${s===rdvSlot?' sel':''}" onclick="rdvSlot='${s}';renderRdvSlots()">${s}</button>`).join('');
}
function book(pro){
  const c=(S.juridique||[]).find(x=>x.name===pro);
  const wel=document.getElementById('rdvWith');
  if(wel){
    const sub=c?[c.role,c.spec].filter(Boolean).join(' · '):'Contact juridique';
    wel.innerHTML=`<div class="rw-ic">${cEsc(juriIni(pro))}</div><div><b>${cEsc(pro)}</b><span>${cEsc(sub)}</span></div>`;
  }
  const d=document.getElementById('rdvDate');
  if(d){ const t=new Date(Date.now()+86400e3); d.min=new Date().toISOString().slice(0,10); d.value=t.toISOString().slice(0,10); }
  rdvSlot=RDV_SLOTS[0]; renderRdvSlots();
  const mt=document.getElementById('rdvMotif'); if(mt) mt.selectedIndex=0;
  const nt=document.getElementById('rdvNote'); if(nt) nt.value='';
  window._rdvPro=pro;
  document.getElementById('rdvModal').classList.add('open');
}
function closeRdvModal(){ document.getElementById('rdvModal').classList.remove('open'); }
function confirmBook(){
  const pro=window._rdvPro; if(!pro) return;
  const dv=document.getElementById('rdvDate').value;
  if(!dv){ toast('Choisissez une date.'); return; }
  const motif=document.getElementById('rdvMotif').value;
  const note=document.getElementById('rdvNote').value.trim();
  const dt=new Date(dv+'T00:00:00');
  const dateStr=dt.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'});
  S.rdv.unshift({pro, date:dv, heure:rdvSlot, motif, note, when:dateStr+' à '+rdvSlot});
  closeRdvModal(); save(); renderRdv(); go('juri'); toast('Demande de rendez-vous envoyée.');
}
/* addEvent() conservé en alias de compatibilité → ouvre le modal */
function addEvent(){ openEventModal(); }
/* addTransaction conservé en alias → ouvre le modal */
function addTransaction(){ openTxModal(); }
/* alias de compatibilité → ouvre le modal */
function addInventaire(){ openInvModal(); }
/* alias de compatibilité → ouvre le modal */
function addIncident(){ openIncModal(); }
function addBienOnMap(){go('carte');setTimeout(()=>{placing=true;if(map)map.getContainer().style.cursor='crosshair';toast('Cliquez sur la carte pour placer le bien.');},150);}

/* ━━━━ DOCUMENTS DROP ━━━━ */
let di=0;
function uploadBienValue(){ return document.getElementById('docUploadBien')?.value || '__all__'; }
function addDoc(name, meta){ S.docs.unshift({name, meta, ic:ICONS[di++%ICONS.length], bien:uploadBienValue()}); }
const dz=document.getElementById('dropZone');
dz.addEventListener('click',()=>{const inp=document.createElement('input');inp.type='file';inp.multiple=true;inp.onchange=()=>{[...inp.files].forEach(f=>addDoc(f.name,'Ajouté à l\'instant'));save();toast('Document(s) ajouté(s).');};inp.click();});
dz.addEventListener('dragover',e=>{e.preventDefault();dz.classList.add('over');});
dz.addEventListener('dragleave',()=>dz.classList.remove('over'));
dz.addEventListener('drop',e=>{e.preventDefault();dz.classList.remove('over');[...e.dataTransfer.files].forEach(f=>addDoc(f.name,'Glissé-déposé'));save();toast('Document(s) déposé(s).');});

/* ━━━━ CARTE ━━━━ */
let map=null,markersLayer=null,placing=false;
function pinIcon(){return L.divIcon({className:'',html:'<div style="width:24px;height:24px;border-radius:50% 50% 50% 0;background:#2C5282;border:2px solid #fff;box-shadow:0 2px 8px rgba(15,31,61,.4);transform:rotate(-45deg)"></div>',iconSize:[24,24],iconAnchor:[12,24],popupAnchor:[0,-26]});}
function initMap(){
  if(typeof L==='undefined'){document.getElementById('map').innerHTML='<div class="empty">Carte indisponible.</div>';return;}
  if(!map){
    map=L.map('map',{scrollWheelZoom:true}).setView([46.6,2.4],5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);
    markersLayer=L.layerGroup().addTo(map);
    map.on('click',e=>{if(!placing)return;placing=false;map.getContainer().style.cursor='';
      const n=prompt('Nom du bien :','');if(!n)return;
      const v=prompt('Valeur :','—')||'—';
      S.biens.push({nom:n,info:'Placé sur la carte',val:v,lat:e.latlng.lat,lng:e.latlng.lng});
      save();toast('Bien ajouté.');
    });
  }
  map.invalidateSize();
  if(!markersLayer)return;
  markersLayer.clearLayers();
  const pts=[];
  S.biens.forEach(b=>{if(typeof b.lat!=='number')return;
    const m=L.marker([b.lat,b.lng],{icon:pinIcon()}).addTo(markersLayer);
    m.bindPopup('<b>'+b.nom+'</b><br>'+(b.info||'')+'<br><b>'+(b.val||'')+'</b>');
    pts.push([b.lat,b.lng]);
  });
  if(pts.length===1)map.setView(pts[0],11);
  else if(pts.length>1)map.fitBounds(pts,{padding:[40,40],maxZoom:11});
}

/* ━━━━ ADMIN ━━━━ */
async function loadAdminData(){
  try{
    const {data,error}=await sb.from('profiles').select('id,email,prenom,nom,created_at');
    if(error||!data)throw error;
    const today=new Date().toISOString().slice(0,10);
    document.getElementById('admin-users').textContent=data.length;
    document.getElementById('admin-today').textContent=data.filter(u=>u.created_at?.startsWith(today)).length;
    document.getElementById('admin-confirmed').textContent=data.length;
    document.getElementById('admin-user-list').innerHTML=data.map(u=>`
      <div class="row-item">
        <div class="r-ic" style="background:linear-gradient(135deg,var(--navy),var(--accent));color:#fff;font-family:'Montserrat';font-weight:700;font-size:.72rem">${((u.prenom||u.email||'?')[0]).toUpperCase()}</div>
        <div><b>${[u.prenom,u.nom].filter(Boolean).join(' ')||u.email}</b><span>${u.email} · ${u.created_at?new Date(u.created_at).toLocaleDateString('fr-FR'):''}</span></div>
        ${u.email==='martifiatte@gmail.com'?'<span class="pill pill-info">Admin</span>':'<span class="pill pill-ok">Utilisateur</span>'}
      </div>`).join('');
  }catch(e){
    ['admin-users','admin-today','admin-confirmed'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent='—';});
    const ul=document.getElementById('admin-user-list');
    if(ul) ul.innerHTML='<div class="empty">Données non disponibles.</div>';
  }
}

function _countUp(el){
  if(!el) return;
  const raw=el.textContent;
  const target=parseFloat(raw.replace(/[^\d.-]/g,''))||0;
  if(target<=0) return;
  const isE=/€/.test(raw), t0=performance.now(), dur=850;
  const fmt=n=> isE ? Math.round(n).toLocaleString('fr-FR')+' €' : Math.round(n).toLocaleString('fr-FR');
  (function step(t){ const p=Math.min(1,(t-t0)/dur), e=1-Math.pow(1-p,3); el.textContent=fmt(target*e); if(p<1) requestAnimationFrame(step); else el.textContent=raw; })(performance.now());
}
function animateDashboard(){ ['kBiens','kCoi','kDocs','kEstim','dashTotalVal','dashMyVal'].forEach(id=>_countUp(document.getElementById(id))); }

/* ════════════════════════════════════════════════════════════════
   COLLABORATION (démo) — Décisions & votes, PV, signature
   électronique, messagerie, visionneuse de documents, invitations
   ════════════════════════════════════════════════════════════════ */
function cEsc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function cToday(){ return new Date().toISOString().slice(0,10); }
function cFrDate(d){ try{ return new Date(d).toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'}); }catch(_){ return d||''; } }
function cFrDateTime(d){ try{ const x=new Date(d); return x.toLocaleDateString('fr-FR',{day:'numeric',month:'short'})+' · '+x.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}); }catch(_){ return ''; } }
function _plusDays(n){ const d=new Date(); d.setDate(d.getDate()+n); return d.toISOString().slice(0,10); }
function _minusDays(n){ const d=new Date(); d.setDate(d.getDate()-n); return d.toISOString().slice(0,10); }
function coiPct(c){ const m=String(c&&c.r||'').match(/(\d+(?:[.,]\d+)?)\s*%/); return m?parseFloat(m[1].replace(',','.')):0; }
function coiByIni(ini){ return (S.coi||[]).find(c=>c.ini===ini) || null; }

const DEFAULT_FOLDERS = ['Actes','Factures',"PV d'Assemblée Générale",'Taxe foncière','Assurance','Divers'];
/* Liste des dossiers du groupe actif (personnalisable). « Divers » reste un fourre-tout permanent. */
function docFolders(){
  const base = (Array.isArray(S.folders) && S.folders.length) ? S.folders.slice() : DEFAULT_FOLDERS.slice();
  if(!base.includes('Divers')) base.push('Divers');
  return base;
}
const FOLDER_ICONS = {'Actes':'file','Factures':'receipt',"PV d'Assemblée Générale":'clipboard','Taxe foncière':'building','Assurance':'shield','Divers':'box'};
function guessFolder(d){
  const n=(d&&d.name||'').toLowerCase();
  let g='Divers';
  if(/acte|notari|titre|propri/.test(n)) g='Actes';
  else if(/factur|travaux|devis|reçu|recu/.test(n)) g='Factures';
  else if(/assur/.test(n)) g='Assurance';
  else if(/\bpv\b|procès|proces|assembl|\bag\b|syndic/.test(n)) g="PV d'Assemblée Générale";
  else if(/taxe\s*fonci|fonci[èe]re|impôt|impot/.test(n)) g='Taxe foncière';
  return docFolders().includes(g) ? g : 'Divers';
}
function demoVotes(){
  const c=S.coi||[]; const ini=c.map(x=>x.ini); const me=(meCoi()||{}).ini;
  const biens=S.biens||[]; if(!biens.length) return []; /* groupe sans bien : pas de démo */
  const b0=biens[0].nom, b0s=b0.split('—')[0].trim();
  const b1=(biens[1]||biens[0]).nom, b1s=b1.split('—')[0].trim();
  const v=[];
  v.push({ id:'v'+Date.now(), titre:'Réfection de la toiture — '+b0s, bien:b0,
    desc:"Devis de 12 400 € pour la réfection de la toiture de "+b0s+", réparti au prorata des quotes-parts.",
    options:['Pour','Contre','Abstention'], deadline:_plusDays(12), status:'open',
    ballots: ini[1]?{[ini[1]]:0}:{}, signatures:[], createdBy:me });
  const ballots={}; ini.forEach((x,k)=>{ ballots[x]=k===1?1:0; });
  v.push({ id:'v'+(Date.now()+1), titre:'Mandat de vente — '+b1s, bien:b1,
    desc:"Donner mandat à l'agence pour la mise en vente de "+b1s+" au prix convenu.",
    options:['Pour','Contre','Abstention'], deadline:_minusDays(5), status:'closed',
    ballots, signatures:[], createdBy:me });
  return v;
}
function demoMessages(){
  const c=S.coi||[]; const a=c[1]||c[0]||{n:'Paul',ini:'PD'}; const b=c[0]||{n:'Vous',ini:'MF'}; const now=Date.now();
  const bn=((S.biens||[])[0]||{}).nom; const bns=bn?bn.split('—')[0].trim():'notre bien';
  return [
    {ini:a.ini, name:(a.n||'').replace(/\s*\(vous\)/i,''), text:"Bonjour à tous, j'ai reçu le devis concernant "+bns+", je le dépose dans les documents.", date:new Date(now-30*3600e3).toISOString()},
    {ini:b.ini, name:(b.n||'').replace(/\s*\(vous\)/i,''), text:"Parfait, merci. Je crée une décision pour qu'on vote dessus.", date:new Date(now-28*3600e3).toISOString()},
  ];
}
function normalizeCollab(){
  let changed=false;
  if(!Array.isArray(S.votes)){ S.votes=demoVotes(); changed=true; }
  if(!Array.isArray(S.messages)){ S.messages=demoMessages(); changed=true; }
  if(!Array.isArray(S.folders)){ S.folders=DEFAULT_FOLDERS.slice(); changed=true; }
  (S.docs||[]).forEach(d=>{
    if(!d.dossier){ d.dossier=guessFolder(d); changed=true; }
    if(d.dossier==='Juridique'){ d.dossier = (d.pvOf || /\bpv\b|procès|proces|assembl/i.test(d.name||'')) ? "PV d'Assemblée Générale" : 'Divers'; changed=true; }
    if(!docFolders().includes(d.dossier)){ d.dossier='Divers'; changed=true; }
  });
  if(changed) save();
}

/* ── Décisions & votes ── */
function voteResult(v){
  const res=(v.options||[]).map(o=>({label:o,pct:0,names:[]}));
  let voted=0;
  Object.entries(v.ballots||{}).forEach(([ini,opt])=>{
    const c=coiByIni(ini); const p=c?coiPct(c):0;
    if(res[opt]){ res[opt].pct+=p; if(c) res[opt].names.push((c.n||'').replace(/\s*\(vous\)/i,'')); voted+=p; }
  });
  return {res,voted};
}
function renderVotes(){
  const el=document.getElementById('votesList'); if(!el) return;
  normalizeCollab();
  const me=(meCoi()||{}).ini;
  const total=(S.coi||[]).reduce((a,c)=>a+coiPct(c),0)||100;
  if(!S.votes.length){ el.innerHTML='<div class="empty"><div class="empty-ic">'+svgIcon('scale',24)+'</div>Aucune décision. Lancez-en une pour recueillir l’avis des co-indivisaires.</div>'; return; }
  el.innerHTML=S.votes.map(v=>{
    const {res,voted}=voteResult(v); const myBallot=(v.ballots||{})[me]; const open=v.status==='open';
    const bars=res.map((r,oi)=>{ const w=total?Math.round(r.pct/total*100):0; const col=oi===0?'var(--teal)':oi===1?'#C0392B':'var(--texte-leger,#8896A7)';
      return `<div class="vote-bar-row"><span class="vbl">${cEsc(r.label)}</span><div class="vbar"><i style="width:${w}%;background:${col}"></i></div><span class="vbp">${w}%</span></div>`; }).join('');
    const opts=open?`<div class="vote-opts">`+v.options.map((o,oi)=>`<button class="vote-opt${myBallot===oi?' chosen':''}" onclick="castVote('${v.id}',${oi})">${cEsc(o)}${myBallot===oi?' ✓':''}</button>`).join('')+`</div>`:'';
    return `<div class="card vote-card">
      <div class="vote-top"><div><span class="vote-status ${open?'open':'closed'}">${open?'Ouvert':'Clôturé'}</span><h3 class="vote-title">${cEsc(v.titre)}</h3><span class="vote-bien">${svgIcon('home',12)} ${cEsc(voteBienLabel(v))}</span></div>
        <span class="vote-deadline">${open?('Échéance : '+cFrDate(v.deadline)):('Clôturé le '+cFrDate(v.deadline))}</span></div>
      <p class="vote-desc">${cEsc(v.desc)}</p>${opts}
      <div class="vote-result">${bars}</div>
      <div class="vote-foot"><span class="vote-part">${Math.round(voted)}% des parts exprimées</span>
        <div class="vote-actions">${open?`<button class="mini-link" onclick="closeVoteDecision('${v.id}')">Clôturer</button>`:`<button class="mini-link" onclick="generatePV('${v.id}')">${v.pvId?'Voir le PV':'Générer le PV'}</button>`}</div></div>
    </div>`;
  }).join('');
}
function castVote(id,oi){ const v=S.votes.find(x=>x.id===id); if(!v||v.status!=='open')return; const me=(meCoi()||{}).ini; if(!me)return; v.ballots=v.ballots||{}; v.ballots[me]=oi; save(); renderVotes(); toast('Vote enregistré.'); }
function closeVoteDecision(id){ const v=S.votes.find(x=>x.id===id); if(!v)return; if(!confirm("Clôturer définitivement cette décision ?\n\nLes votes seront figés et vous pourrez générer le procès-verbal.")) return; v.status='closed'; v.deadline=cToday(); save(); renderVotes(); toast('Décision clôturée.'); }
function openVoteModal(){
  document.getElementById('voteTitle').value=''; document.getElementById('voteDesc').value=''; document.getElementById('voteDeadline').value=_plusDays(14);
  const bs=document.getElementById('voteBien');
  if(bs) bs.innerHTML=`<option value="__all__">Toute l'indivision</option>`+(S.biens||[]).map(b=>`<option value="${cEsc(b.nom)}">${cEsc(b.nom.split('—')[0].trim())}</option>`).join('');
  document.getElementById('voteModal').classList.add('open');
}
function voteBienLabel(v){ return (!v||!v.bien||v.bien==='__all__')?"Toute l'indivision":v.bien.split('—')[0].trim(); }
function closeVoteModal(){ document.getElementById('voteModal').classList.remove('open'); }
function saveVote(){
  const t=document.getElementById('voteTitle').value.trim(); if(!t){ toast('Donnez un objet à la décision.'); return; }
  S.votes=S.votes||[];
  const bn=document.getElementById('voteBien'); const bien=bn?bn.value:'__all__';
  S.votes.unshift({ id:'v'+Date.now(), titre:t, bien, desc:document.getElementById('voteDesc').value.trim(), options:['Pour','Contre','Abstention'], deadline:document.getElementById('voteDeadline').value||_plusDays(14), status:'open', ballots:{}, signatures:[], createdBy:(meCoi()||{}).ini });
  save(); closeVoteModal(); renderVotes(); toast('Décision créée — les co-indivisaires peuvent voter.');
}

/* ── PV d'assemblée + signature électronique ── */
function generatePV(id){
  const v=S.votes.find(x=>x.id===id); if(!v)return;
  if(!v.pvId){ v.pvId='pv'+Date.now(); S.docs=S.docs||[];
    S.docs.unshift({ name:'PV — '+v.titre, meta:'Assemblée du '+cFrDate(v.deadline), ic:'file', bien:'__all__', dossier:"PV d'Assemblée Générale", pvOf:v.id });
    save(); renderDocs(); }
  openPV(id);
}
function openPV(id){
  const v=S.votes.find(x=>x.id===id); if(!v)return; window._pvId=id;
  const {res}=voteResult(v); const total=(S.coi||[]).reduce((a,c)=>a+coiPct(c),0)||100;
  const leading=res.reduce((a,b)=>b.pct>a.pct?b:a,res[0]||{label:'—',pct:0});
  const adopted=leading.label==='Pour' && leading.pct>total/2;
  const rows=(S.coi||[]).map(c=>{ const b=(v.ballots||{})[c.ini]; const vote=b==null?'—':v.options[b];
    return `<tr><td>${cEsc((c.n||'').replace(/\s*\(vous\)/i,''))}</td><td>${coiPct(c)} %</td><td>${cEsc(vote)}</td></tr>`; }).join('');
  const sigs=(v.signatures||[]).length? v.signatures.map(s=>`<div class="pv-sig"><span class="pv-sig-name">${cEsc(s.name)}</span><span class="pv-sig-meta">Signé électroniquement le ${cFrDate(s.date)}</span></div>`).join('') : '<p class="pv-nosig">Aucune signature pour le moment.</p>';
  const me=meCoi()||{}; const signed=(v.signatures||[]).some(s=>s.ini===me.ini);
  document.getElementById('pvBody').innerHTML=`<div class="pv-doc">
    <div class="pv-head"><div class="pv-brand">${svgIcon('scale',20)} Divimo</div><div class="pv-meta">Procès-verbal d'assemblée<br>${cEsc(S.nom||'Indivision')}</div></div>
    <h2 class="pv-h2">Procès-verbal de décision</h2>
    <p class="pv-line"><b>Objet :</b> ${cEsc(v.titre)}</p>
    <p class="pv-line"><b>Bien :</b> ${cEsc(voteBienLabel(v))}</p>
    <p class="pv-line"><b>Date :</b> ${cFrDate(v.deadline)}</p>
    <p class="pv-line">${cEsc(v.desc)}</p>
    <table class="pv-table"><thead><tr><th>Co-indivisaire</th><th>Quote-part</th><th>Vote</th></tr></thead><tbody>${rows}</tbody></table>
    <p class="pv-result ${adopted?'ok':'no'}"><b>Résultat :</b> « ${cEsc(leading.label)} » l'emporte avec ${Math.round(leading.pct)} % des quotes-parts exprimées. Décision ${adopted?'<b>adoptée</b>':'non adoptée à la majorité requise'}.</p>
    <div class="pv-sigs"><h4>Signatures</h4>${sigs}</div></div>`;
  const sb=document.getElementById('pvSignBtn'); if(sb) sb.style.display=signed?'none':'inline-flex';
  document.getElementById('pvModal').classList.add('open');
}
function closePV(){ document.getElementById('pvModal').classList.remove('open'); }
function signPV(){
  const v=S.votes.find(x=>x.id===window._pvId); if(!v)return; const me=meCoi()||{ini:'?',n:'Vous'};
  if((v.signatures||[]).some(s=>s.ini===me.ini))return;
  v.signatures=v.signatures||[]; v.signatures.push({ini:me.ini, name:(me.n||'Vous').replace(/\s*\(vous\)/i,''), date:new Date().toISOString()});
  save(); openPV(v.id); toast('Document signé électroniquement.');
}
function printPV(){ window.print(); }

/* ── Messagerie ── */
function scrollMsg(){ const el=document.getElementById('msgThread'); if(el) el.scrollTop=el.scrollHeight; }
function renderMessages(){
  const el=document.getElementById('msgThread'); if(!el) return; normalizeCollab();
  const me=(meCoi()||{}).ini;
  el.innerHTML=S.messages.map(m=>{ const mine=m.ini===me; const ci=Math.abs((m.ini||'?').charCodeAt(0))%PAL.length;
    return `<div class="msg ${mine?'mine':''}"><div class="msg-av" style="background:linear-gradient(135deg,${PAL[ci]},${PAL[(ci+1)%PAL.length]})">${cEsc(m.ini||'?')}</div><div class="msg-bub"><div class="msg-meta">${cEsc(m.name||'')} · ${cFrDateTime(m.date)}</div><div class="msg-txt">${cEsc(m.text)}</div></div></div>`; }).join('') || '<div class="empty">Aucun message. Démarrez la conversation.</div>';
  scrollMsg();
}
function postMessage_(){
  const inp=document.getElementById('msgInput'); const t=(inp.value||'').trim(); if(!t)return;
  const me=meCoi()||{ini:'MF',n:'Vous'}; S.messages=S.messages||[];
  S.messages.push({ini:me.ini, name:(me.n||'Vous').replace(/\s*\(vous\)/i,''), text:t, date:new Date().toISOString()});
  inp.value=''; save(); renderMessages();
}
function msgKey(e){ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); postMessage_(); } }

/* ── Documents : dossiers + visionneuse ── */
let docFolder='__allfold__';
function folderIcon(f){ return FOLDER_ICONS[f] || 'folder'; }
function docPick(){ const dz=document.getElementById('dropZone'); if(dz) dz.click(); }
let docBien='all';
function docRow(d){
  return `<div class="row-item doc-row" onclick="openDoc(${d.i})">
    <div class="r-ic" style="background:rgba(44,82,130,.08)">${svgIcon(d.pvOf?'scale':'file',18)}</div>
    <div style="flex:1;min-width:0"><b>${cEsc(d.name)}</b><span>${cEsc(d.meta)} · <span class="doc-fold-tag">${cEsc(d.dossier||'Divers')}</span></span></div>
    <div class="row-act" onclick="event.stopPropagation()"><span class="mini-link" onclick="openDoc(${d.i})">Ouvrir</span><span class="del" onclick="askDelete('Supprimer ce document ?', ()=>{ S.docs.splice(${d.i},1); save(); renderDocs(); })" title="Supprimer">${DELSVG}</span></div>
  </div>`;
}
function renderDocs(){
  const el=document.getElementById('docsList'); if(!el) return; normalizeCollab();
  /* Cible de dépôt = biens du groupe actif */
  const up=document.getElementById('docUploadBien');
  if(up){ const cur=up.value; up.innerHTML=`<option value="__all__">Commun à l'indivision</option>`+S.biens.map(b=>`<option value="${cEsc(b.nom)}">${cEsc(b.nom.split('—')[0].trim())}</option>`).join(''); if(cur && [...up.options].some(o=>o.value===cur)) up.value=cur; }
  /* Filtre par bien (comme l'inventaire) */
  const bb=document.getElementById('docBienBar');
  if(bb){
    const names=(S.biens||[]).map(b=>b.nom);
    const hasCommun=S.docs.some(d=>d.bien==='__all__');
    const targets=['all', ...names.filter(n=>S.docs.some(d=>d.bien===n)), ...(hasCommun?['__all__']:[])];
    if(!targets.includes(docBien)) docBien='all';
    bb.innerHTML=targets.map(t=>{
      const label=t==='all'?'Tous les biens':t==='__all__'?'Commun':t.split('—')[0].trim();
      const cnt=t==='all'?S.docs.length:S.docs.filter(d=>d.bien===t).length;
      return `<span class="bf-chip ${docBien===t?'sel':''}" onclick="docBien='${String(t).replace(/'/g,"\\'")}';renderDocs()">${cEsc(label)} <span style="opacity:.55">${cnt}</span></span>`;
    }).join('');
  }
  /* Dossiers en cartes */
  const fol=document.getElementById('docFolderBar');
  if(fol){
    const escJs=s=>String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    const fcard=(key,label,icon)=>{ const n=key==='__allfold__'?S.docs.length:S.docs.filter(d=>(d.dossier||'Divers')===key).length; return `<button class="doc-folder${docFolder===key?' sel':''}" onclick="docFolder='${escJs(key)}';renderDocs()"><span class="df-ic">${icon}</span><span class="df-name">${cEsc(label)}</span><span class="df-n">${n}</span></button>`; };
    fol.innerHTML=fcard('__allfold__','Tous',svgIcon('folder',17))
      +docFolders().map(f=>fcard(f,f,svgIcon(folderIcon(f),17))).join('')
      +`<button class="doc-folder doc-folder-add" onclick="newFolder()" title="Créer un dossier"><span class="df-ic">+</span><span class="df-name">Nouveau dossier</span></button>`
      +((docFolder!=='__allfold__'&&docFolder!=='Divers')?`<button class="doc-folder-del" onclick="deleteFolder('${escJs(docFolder)}')" title="Supprimer ce dossier">${DELSVG}<span>Supprimer « ${cEsc(docFolder)} »</span></button>`:'');
  }
  /* Filtre combiné bien + dossier */
  const docs=S.docs.map((d,i)=>({...d,i})).filter(d=>{
    const okB = docBien==='all'?true:d.bien===docBien;
    const okF = docFolder==='__allfold__'?true:(d.dossier||'Divers')===docFolder;
    return okB&&okF;
  });
  if(!docs.length){ el.innerHTML='<div class="empty"><div class="empty-ic">'+svgIcon('folder',24)+'</div>Aucun document pour cette sélection.</div>'; return; }
  /* Vue par bien, avec les dossiers (sous-sections) conservés */
  const blocks=[];
  (S.biens||[]).forEach(b=>{ const items=docs.filter(d=>d.bien===b.nom); if(items.length) blocks.push({label:b.nom.split('—')[0].trim(), items}); });
  const commun=docs.filter(d=>d.bien==='__all__'); if(commun.length) blocks.push({label:"Commun à l'indivision", items:commun});
  const known=new Set((S.biens||[]).map(b=>b.nom)); const orph=docs.filter(d=>d.bien!=='__all__'&&!known.has(d.bien)); if(orph.length) blocks.push({label:'Autres', items:orph});
  const homeIc=svgIcon('home',16);
  el.innerHTML=blocks.map(bg=>{
    const subs=docFolders().map(f=>({f,items:bg.items.filter(d=>(d.dossier||'Divers')===f)})).filter(x=>x.items.length);
    return `<div class="doc-bien-block"><div class="doc-bien-head">${homeIc} ${cEsc(bg.label)}<span>${bg.items.length}</span></div>`
      + subs.map(s=>`<div class="doc-sub"><div class="doc-sub-head">${cEsc(s.f)}</div>${s.items.map(docRow).join('')}</div>`).join('')
      + `</div>`;
  }).join('');
}
function docExt(name){ const m=String(name||'').match(/\.([a-z0-9]+)$/i); return m?m[1].toUpperCase():'DOC'; }
function openDoc(i){
  const d=S.docs[i]; if(!d)return; window._docI=i; const isAll=d.bien==='__all__';
  document.getElementById('docModalTitle').textContent=d.name;
  const opts=docFolders().map(f=>`<option value="${cEsc(f)}"${(d.dossier||'Divers')===f?' selected':''}>${cEsc(f)}</option>`).join('');
  document.getElementById('docBody').innerHTML=`<div class="doc-preview"><div class="doc-preview-ic">${svgIcon(d.pvOf?'scale':'file',46)}</div><div class="doc-preview-ext">${cEsc(docExt(d.name))}</div><p class="doc-preview-note">Aperçu indisponible en démonstration${d.pvOf?' — document généré depuis une décision votée.':'.'}</p></div>
    <div class="doc-info"><div><span>Bien</span><b>${cEsc(isAll?'Commun à l’indivision':(d.bien||'—'))}</b></div><div><span>Ajouté</span><b>${cEsc(d.meta||'—')}</b></div><div class="doc-move"><span>Dossier</span><select id="docFolderSel" onchange="moveDoc(window._docI,this.value)">${opts}</select></div></div>`;
  document.getElementById('docModal').classList.add('open');
}
function closeDoc(){ document.getElementById('docModal').classList.remove('open'); }
function moveDoc(i,f){ if(!S.docs[i])return; S.docs[i].dossier=f; save(); renderDocs(); toast('Document rangé dans « '+f+' ».'); }
function newFolder(){
  const raw=prompt('Nom du nouveau dossier :'); if(raw===null) return;
  const n=raw.trim().slice(0,40); if(!n) return;
  if(!Array.isArray(S.folders)) S.folders=DEFAULT_FOLDERS.slice();
  const exist=S.folders.find(f=>f.toLowerCase()===n.toLowerCase());
  if(exist){ docFolder=exist; renderDocs(); toast('Ce dossier existe déjà.'); return; }
  const di=S.folders.indexOf('Divers');
  if(di>=0) S.folders.splice(di,0,n); else S.folders.push(n);
  docFolder=n; save(); renderDocs(); toast('Dossier « '+n+' » créé.');
}
function deleteFolder(f){
  if(f==='Divers') return;
  askDelete('Supprimer le dossier « '+f+' » ? Les documents qu\'il contient seront déplacés dans « Divers ».', ()=>{
    (S.docs||[]).forEach(d=>{ if((d.dossier||'Divers')===f) d.dossier='Divers'; });
    if(!Array.isArray(S.folders)) S.folders=DEFAULT_FOLDERS.slice();
    S.folders=S.folders.filter(x=>x!==f);
    if(docFolder===f) docFolder='__allfold__';
    save(); renderDocs(); toast('Dossier supprimé.');
  });
}
function addDoc(name, meta){ S.docs.unshift({name, meta, ic:ICONS[di++%ICONS.length], bien:uploadBienValue(), dossier:guessFolder({name})}); }

/* ── Invitation par email ── */
function inviteCoi(){ ['inviteEmail','inviteName','invitePct'].forEach(id=>{const e=document.getElementById(id); if(e)e.value='';}); document.getElementById('inviteModal').classList.add('open'); }
function closeInviteModal(){ document.getElementById('inviteModal').classList.remove('open'); }
function sendInvite(){
  const email=document.getElementById('inviteEmail').value.trim();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ toast('Adresse email invalide.'); return; }
  const name=document.getElementById('inviteName').value.trim()||email.split('@')[0];
  const pct=document.getElementById('invitePct').value.trim()||'0';
  const ini=name.split(/\s+/).map(w=>w[0]||'').join('').slice(0,2).toUpperCase()||'??';
  S.coi.push({n:name, r:pct+'% · Co-indivisaire', ini, st:'Invité', cls:'pill-warn', email});
  save(); renderCoi(); closeInviteModal(); toast('Invitation envoyée à '+email+'.');
}

renderGroupSelector();
renderAll();
animateDashboard();
