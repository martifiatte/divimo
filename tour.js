/* ━━━━ VISITE GUIDÉE — première connexion + relançable depuis le profil ━━━━ */
(function(){
  const KEY = 'divimo_tour_done';
  const STEPS = [
    { welcome:true, title:'Bienvenue dans votre espace Divimo',
      text:'En une minute, découvrez tout ce que vous pouvez faire pour gérer votre indivision sereinement. Vous pourrez refaire cette visite à tout moment.' },
    { v:'dash',       title:'Tableau de bord',     text:'Votre vue d’ensemble : patrimoine, échéances et activité récente en un coup d’œil.' },
    { v:'portfolio',  title:'Mon patrimoine',      text:'Tous vos biens et la quote-part de chaque indivisaire. Vous ajoutez un bien en quelques clics.' },
    { v:'carte',      title:'Carte des biens',     text:'Visualisez l’emplacement de chacun de vos biens sur une carte.' },
    { v:'planning',   title:'Planning',            text:'Un agenda partagé pour les visites, réunions et échéances importantes.' },
    { v:'budget',     title:'Budget',              text:'Vos loyers récurrents avec confirmation chaque mois, et les charges réparties automatiquement selon les quote-parts.' },
    { v:'fiscal',     title:'Fiscalité',           text:'Vos revenus fonciers centralisés et la part à déclarer pour chaque indivisaire.' },
    { v:'inventaire', title:'Inventaire',          text:'Recensez le mobilier et les équipements, bien par bien.' },
    { v:'incidents',  title:'Incidents & sinistres', text:'Déclarez et suivez les problèmes, de la déclaration à la résolution.' },
    { v:'votes',      title:'Décisions & votes',   text:'Proposez une décision, recueillez les votes pondérés par quote-part, puis générez le procès-verbal.' },
    { v:'messages',   title:'Messagerie',          text:'Échangez avec les autres indivisaires, au même endroit que vos dossiers.' },
    { v:'docs',       title:'Documents',           text:'Rangez vos documents dans des dossiers personnalisables : actes, PV d’assemblée, taxe foncière…' },
    { v:'coi',        title:'Co-indivisaires',     text:'Gérez les membres de l’indivision et leurs quote-parts.' },
    { v:'partage',    title:'Partage & accès',     text:'Choisissez précisément ce que chaque indivisaire peut voir.' },
    { v:'estim',      title:'Simulations',         text:'Estimez un bien, calculez des quote-parts ou simulez un rachat de parts.' },
    { v:'juri',       title:'Conseil juridique',   text:'Vos contacts juridiques, privés à cette indivision, et la prise de rendez-vous.' },
    { v:'profil',     title:'Profil & compte',     text:'Vos informations, et le bouton pour relancer cette visite quand vous le voulez.' },
    { finish:true, title:'Vous êtes prêt',
      text:'Vous connaissez maintenant l’essentiel. Vous pouvez relancer cette visite depuis Profil & compte. Bonne gestion !' },
  ];

  let i = 0, root = null;

  function build(){
    if(root) return;
    root = document.createElement('div');
    root.id = 'tour';
    root.className = 'tour-ov';
    root.innerHTML =
      '<div class="tour-spot"></div>' +
      '<div class="tour-pop">' +
        '<div class="tour-meta"><span class="tour-step"></span><button class="tour-x" aria-label="Fermer">&times;</button></div>' +
        '<h4 class="tour-title"></h4>' +
        '<p class="tour-text"></p>' +
        '<div class="tour-bar"><div class="tour-bar-fill"></div></div>' +
        '<div class="tour-actions">' +
          '<button class="tour-skip">Passer la visite</button>' +
          '<div class="tour-right"><button class="tour-prev">Précédent</button><button class="tour-next">Suivant</button></div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(root);
    root.querySelector('.tour-x').onclick = end;
    root.querySelector('.tour-skip').onclick = end;
    root.querySelector('.tour-prev').onclick = function(){ if(i>0){ i--; render(); } };
    root.querySelector('.tour-next').onclick = function(){ if(i < STEPS.length-1){ i++; render(); } else { end(); } };
    window.addEventListener('resize', reposition);
  }

  function target(s){ return s && s.v ? document.querySelector('.nav-i[data-v="'+s.v+'"]') : null; }

  function render(){
    const s = STEPS[i];
    if(s.v && typeof window.go === 'function') window.go(s.v);
    const pop = root.querySelector('.tour-pop');
    root.querySelector('.tour-step').textContent = 'Étape ' + (i+1) + ' / ' + STEPS.length;
    root.querySelector('.tour-title').textContent = s.title;
    root.querySelector('.tour-text').textContent = s.text;
    root.querySelector('.tour-bar-fill').style.width = Math.round((i+1)/STEPS.length*100) + '%';
    root.querySelector('.tour-prev').style.visibility = i===0 ? 'hidden' : 'visible';
    root.querySelector('.tour-next').textContent = i===STEPS.length-1 ? 'Terminer' : 'Suivant';
    root.querySelector('.tour-skip').style.visibility = (s.welcome||s.finish) ? 'hidden' : 'visible';
    const t = target(s);
    if(t && t.scrollIntoView) t.scrollIntoView({block:'nearest'});
    // laisser le temps à go() / scroll de se stabiliser
    requestAnimationFrame(function(){ setTimeout(reposition, 30); });
  }

  function reposition(){
    if(!root || !root.classList.contains('show')) return;
    const s = STEPS[i];
    const spot = root.querySelector('.tour-spot');
    const pop = root.querySelector('.tour-pop');
    const t = target(s);
    const vw = window.innerWidth, vh = window.innerHeight;
    if(!t || s.welcome || s.finish){
      // plein écran assombri, bulle centrée
      spot.style.cssText = 'top:-9999px;left:-9999px;width:0;height:0';
      pop.classList.add('center');
      pop.style.left = ''; pop.style.top = '';
      return;
    }
    pop.classList.remove('center');
    const r = t.getBoundingClientRect();
    const pad = 6;
    spot.style.top = (r.top - pad) + 'px';
    spot.style.left = (r.left - pad) + 'px';
    spot.style.width = (r.width + pad*2) + 'px';
    spot.style.height = (r.height + pad*2) + 'px';
    const pr = pop.getBoundingClientRect();
    const popW = pr.width || 320, popH = pr.height || 180;
    let left, top;
    if(r.right + 16 + popW <= vw - 8){            // à droite de l'élément (sidebar)
      left = r.right + 16; top = r.top + r.height/2 - popH/2;
    } else if(vw - 16 - popW > 8){                 // sinon, ancré à droite de l'écran
      left = vw - popW - 16; top = r.bottom + 12;
    } else {                                       // mobile : centré en bas
      left = (vw - Math.min(popW, vw-24))/2; top = vh - popH - 16;
    }
    top = Math.max(12, Math.min(top, vh - popH - 12));
    left = Math.max(8, Math.min(left, vw - popW - 8));
    pop.style.left = left + 'px';
    pop.style.top = top + 'px';
  }

  function start(){
    build();
    i = 0;
    root.classList.add('show');
    document.body.style.overflow = 'hidden';
    render();
  }
  function end(){
    if(root){ root.classList.remove('show'); }
    document.body.style.overflow = '';
    try{ localStorage.setItem(KEY, '1'); }catch(e){}
  }

  window.startTour = start;

  // Première connexion : lancement automatique
  window.addEventListener('load', function(){
    setTimeout(function(){
      try{ if(localStorage.getItem(KEY)) return; }catch(e){ return; }
      if(document.querySelector('.side-nav')) start();
    }, 800);
  });
})();
