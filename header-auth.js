/* header-auth.js — détection de session instantanée sur toutes les pages publiques */

(function () {
  const PROJECT = 'anrwoxsibhabivtkepqt';
  const STORAGE_KEY = 'sb-' + PROJECT + '-auth-token';

  /* Lecture synchrone du localStorage pour éviter le flash */
  function getLocalSession() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const user = parsed?.user || parsed?.currentSession?.user;
      if (!user) return null;
      /* Vérification basique d'expiration */
      const exp = parsed?.expires_at || parsed?.currentSession?.expires_at;
      if (exp && Date.now() / 1000 > exp) return null;
      return user;
    } catch (e) { return null; }
  }

  function applyHeader(user) {
    const actions = document.querySelector('.header-actions');
    if (!actions) return;
    const meta = user.user_metadata || {};
    const prenom = (meta.prenom || '').trim();
    const nom = (meta.nom || '').trim();
    const displayName = prenom || user.email.split('@')[0];
    const initials = ((prenom[0] || '') + (nom[0] || '')).toUpperCase() || displayName.slice(0, 2).toUpperCase();
    const isAdmin = meta.role === 'admin';

    actions.innerHTML = `
      <a href="espace.html" class="hbtn hbtn-ghost" style="display:inline-flex;align-items:center;gap:.55rem;padding:.5rem .9rem .5rem .5rem">
        <span style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,var(--bleu-roi),var(--bleu-violet));color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:.7rem;font-family:'Montserrat';font-weight:700;flex-shrink:0">${initials}</span>
        <span style="font-size:.88rem">${displayName}${isAdmin ? ' <span style="font-size:.65rem;background:rgba(92,107,192,.18);color:var(--bleu-violet);border-radius:99px;padding:.15rem .45rem;font-weight:700;vertical-align:middle">ADMIN</span>' : ''}</span>
      </a>
      <button onclick="(async()=>{await sb.auth.signOut();window.location.href='index.html'})()" class="hbtn hbtn-ghost" style="font-size:.85rem;cursor:pointer;border:1.6px solid var(--gris-bord);background:transparent;color:var(--texte-doux);font-family:'Montserrat';font-weight:600;padding:.5rem 1rem;border-radius:999px;transition:.2s" onmouseover="this.style.borderColor='#eb5757';this.style.color='#eb5757'" onmouseout="this.style.borderColor='var(--gris-bord)';this.style.color='var(--texte-doux)'">Déconnexion</button>
    `;
  }

  /* Application synchrone immédiate */
  const localUser = getLocalSession();
  if (localUser) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => applyHeader(localUser));
    } else {
      applyHeader(localUser);
    }
  }

  /* Vérification réelle via Supabase (async, corrige si session expirée) */
  window.addEventListener('load', async () => {
    if (typeof sb === 'undefined') return;
    try {
      const { data: { session } } = await sb.auth.getSession();
      if (session) {
        applyHeader(session.user);
      } else if (localUser) {
        /* Session locale expirée — remettre les boutons par défaut */
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
