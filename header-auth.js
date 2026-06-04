/* =====================================================================
   header-auth.js — Navigation contextuelle Divimo
   - Non connecté : header marketing (index.html, Se connecter, etc.)
   - Connecté     : header applicatif (Mon espace, Simulateurs, etc.)
   ===================================================================== */
(function () {
  const PROJECT    = 'anrwoxsibhabivtkepqt';
  const STORAGE_KEY = 'sb-' + PROJECT + '-auth-token';

  /* ── Lecture synchrone du localStorage (zéro flash) ── */
  function getLocalUser() {
    try {
      const p = JSON.parse(localStorage.getItem(STORAGE_KEY) || '');
      const user = p?.user || p?.currentSession?.user;
      const exp  = p?.expires_at || p?.currentSession?.expires_at;
      return (user && (!exp || Date.now() / 1000 < exp)) ? user : null;
    } catch (e) { return null; }
  }

  /* ── Page courante ── */
  function page() {
    return window.location.pathname.split('/').pop() || 'index.html';
  }
  function isActive(slug) {
    return page().startsWith(slug) ? 'active' : '';
  }

  /* ── Icônes SVG ── */
  const ICONS = {
    grid:   `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`,
    chart:  `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h4l3 8 4-16 3 8h4"/></svg>`,
    folder: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>`,
    law:    `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v18M5 7l14 0M7 7l-3 7a4 4 0 0 0 6 0L7 7zM17 7l-3 7a4 4 0 0 0 6 0L17 7z"/></svg>`,
    logout: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>`,
    menu:   `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 6h18M3 12h18M3 18h18"/></svg>`,
    logo:   `<svg width="30" height="30" viewBox="0 0 34 34" fill="none"><circle cx="17" cy="17" r="15" stroke="#0F1F3D" stroke-width="2.5"/><path d="M17 2 A15 15 0 0 1 30 24 L17 17 Z" fill="#4A7FB5"/><circle cx="17" cy="17" r="4.5" fill="#0F1F3D"/></svg>`,
  };

  /* ── Applique le header applicatif ── */
  function applyAppHeader(user) {
    const meta   = user.user_metadata || {};
    const prenom = (meta.prenom || '').trim();
    const nom    = (meta.nom    || '').trim();
    const name   = prenom || user.email.split('@')[0];
    const initials = ((prenom[0]||'')+(nom[0]||'')).toUpperCase() || name.slice(0,2).toUpperCase();
    const isAdmin  = meta.role === 'admin';
    const avatarGradient = isAdmin
      ? 'linear-gradient(135deg,#2D6A6A,#2C5282)'
      : 'linear-gradient(135deg,#0F1F3D,#2C5282)';

    const header = document.querySelector('.site-header');
    if (!header) return;

    /* Remplacer le contenu intérieur */
    header.querySelector('.site-header-inner').innerHTML = `
      <!-- Logo → Dashboard (pas la landing) -->
      <a href="espace.html" class="brand-logo" style="gap:.5rem">
        ${ICONS.logo} Divimo
      </a>

      <!-- Nav applicative -->
      <nav class="main-nav app-nav" id="appNav">
        <a href="espace.html"               class="${isActive('espace')}"               data-label="Mon espace">${ICONS.grid}  Mon espace</a>
        <a href="simulateurs.html"          class="${isActive('simulateurs')}"          data-label="Simulateurs">${ICONS.chart} Simulateurs</a>
        <a href="documents.html"            class="${isActive('documents')}"            data-label="Documents">${ICONS.folder} Documents</a>
        <a href="services-juridiques.html"  class="${isActive('services-juridiques')}"  data-label="Juridique">${ICONS.law}   Juridique</a>
      </nav>

      <!-- Actions utilisateur -->
      <div class="header-actions" id="appActions">
        <a href="espace.html" class="app-user-chip" title="Mon espace">
          <span class="app-avatar" style="background:${avatarGradient}">${initials}</span>
          <span class="app-username">${name}${isAdmin ? ' 👑' : ''}</span>
        </a>
        <button
          class="app-logout-btn"
          title="Se déconnecter"
          onclick="(async()=>{if(typeof sb!=='undefined')await sb.auth.signOut();localStorage.clear();window.location.href='index.html'})()">
          ${ICONS.logout}
          <span class="app-logout-label">Déconnexion</span>
        </button>
      </div>

      <!-- Toggle mobile -->
      <button class="nav-toggle" id="appMobileToggle" aria-label="Menu">
        ${ICONS.menu}
      </button>
    `;

    /* Mobile toggle */
    document.getElementById('appMobileToggle')?.addEventListener('click', () => {
      header.classList.toggle('open');
    });

    /* Fermer le menu mobile au clic sur un lien */
    document.querySelectorAll('.app-nav a').forEach(a =>
      a.addEventListener('click', () => header.classList.remove('open'))
    );
  }

  /* ── Styles spécifiques au header app (injectés une seule fois) ── */
  function injectAppStyles() {
    if (document.getElementById('app-header-styles')) return;
    const s = document.createElement('style');
    s.id = 'app-header-styles';
    s.textContent = `
      /* Nav app — icônes + texte */
      .app-nav a {
        display: inline-flex;
        align-items: center;
        gap: .4rem;
        font-family: 'Montserrat', sans-serif;
        font-weight: 600;
        font-size: .86rem;
        color: var(--texte-doux);
        padding: .45rem .8rem;
        border-radius: 9px;
        transition: .15s;
        text-decoration: none;
      }
      .app-nav a svg { flex-shrink: 0; opacity: .65; transition: .15s; }
      .app-nav a:hover { background: var(--gris-clair); color: var(--navy); }
      .app-nav a:hover svg { opacity: 1; }
      .app-nav a.active { color: var(--accent); background: rgba(44,82,130,.09); }
      .app-nav a.active svg { opacity: 1; }

      /* User chip */
      .app-user-chip {
        display: inline-flex;
        align-items: center;
        gap: .5rem;
        padding: .32rem .75rem .32rem .35rem;
        border-radius: 999px;
        background: #fff;
        border: 1.5px solid var(--gris-bord);
        font-family: 'Montserrat', sans-serif;
        font-weight: 600;
        font-size: .84rem;
        color: var(--navy);
        text-decoration: none;
        transition: .15s;
        cursor: pointer;
      }
      .app-user-chip:hover { border-color: var(--accent-light); }
      .app-avatar {
        width: 28px; height: 28px; border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        font-size: .68rem; font-weight: 700; color: #fff; flex-shrink: 0;
      }
      .app-username { max-width: 120px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

      /* Logout */
      .app-logout-btn {
        display: inline-flex;
        align-items: center;
        gap: .35rem;
        background: none;
        border: none;
        cursor: pointer;
        font-family: 'Montserrat', sans-serif;
        font-weight: 600;
        font-size: .82rem;
        color: var(--texte-doux);
        padding: .45rem .7rem;
        border-radius: 8px;
        transition: .15s;
      }
      .app-logout-btn:hover { background: rgba(192,57,57,.08); color: #C03939; }

      /* Mobile app nav */
      @media (max-width: 900px) {
        .app-logout-label { display: none; }
        .app-username { display: none; }
        .app-nav { display: none; }
        .site-header.open .app-nav {
          display: flex;
          flex-direction: column;
          width: 100%;
          order: 3;
          margin-top: 10px;
          border-top: 1px solid var(--gris-bord);
          padding-top: 10px;
        }
        .site-header.open .app-nav a { padding: .7rem .5rem; }
        .site-header.open #appActions {
          order: 4;
          width: 100%;
          display: flex;
          justify-content: space-between;
          padding-top: 6px;
          border-top: 1px solid var(--gris-bord);
          margin-top: 4px;
        }
        .site-header.open .app-username { display: inline; }
        .site-header.open .app-logout-label { display: inline; }
        .site-header.open .site-header-inner { flex-wrap: wrap; height: auto; padding-bottom: 14px; }
      }
    `;
    document.head.appendChild(s);
  }

  /* ── Initialisation ── */
  const localUser = getLocalUser();

  if (localUser) {
    injectAppStyles();
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => applyAppHeader(localUser));
    } else {
      applyAppHeader(localUser);
    }
  }

  /* Vérification async Supabase */
  window.addEventListener('load', async () => {
    if (typeof sb === 'undefined') return;
    try {
      const { data: { session } } = await sb.auth.getSession();
      if (session) {
        injectAppStyles();
        applyAppHeader(session.user);
      } else if (localUser) {
        /* Session expirée — restaurer header public */
        const actions = document.querySelector('.header-actions');
        if (actions) {
          actions.innerHTML = `
            <a href="connexion.html" class="hbtn hbtn-ghost">Se connecter</a>
            <a href="creer-compte.html" class="hbtn hbtn-primary">Créer mon compte</a>
          `;
        }
      }
    } catch (e) {}
  });
})();
