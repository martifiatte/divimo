(async () => {
  if (typeof sb === 'undefined') return;
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return;

  const actions = document.querySelector('.header-actions');
  if (!actions) return;

  const meta = session.user.user_metadata || {};
  const prenom = (meta.prenom || '').trim();
  const displayName = prenom || (session.user.email || '').split('@')[0];
  const initials = ((meta.prenom?.[0] || '') + (meta.nom?.[0] || '')).toUpperCase()
    || displayName.slice(0, 2).toUpperCase();

  actions.innerHTML = `
    <a href="espace.html" class="hbtn hbtn-ghost" style="display:flex;align-items:center;gap:.5rem">
      <span style="width:26px;height:26px;border-radius:50%;background:linear-gradient(135deg,var(--bleu-roi),var(--bleu-violet));color:#fff;display:flex;align-items:center;justify-content:center;font-size:.7rem;font-family:'Montserrat';font-weight:700">${initials}</span>
      ${displayName}
    </a>
    <button onclick="sb.auth.signOut().then(()=>window.location.href='index.html')" class="hbtn hbtn-ghost" style="cursor:pointer;border:none;background:transparent;color:var(--texte-doux);font-family:'Montserrat';font-weight:600;font-size:.88rem">Déconnexion</button>
  `;
})();
