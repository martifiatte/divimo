# 🏠 Site Divimo — Guide du code

Site vitrine + simulateurs + espace utilisateur pour la gestion de l'indivision.
Tout est en **HTML / CSS / JavaScript pur** : aucune installation, aucun serveur.
Pour voir une page, **double-clique sur le fichier `.html`** → elle s'ouvre dans ton navigateur.

## 🗂️ Organisation du dossier « Projet Divimo »

```
Projet Divimo/
├── 01_Site_web/            ← LE SITE (c'est ici qu'on travaille)
│   ├── index.html, simulateurs.html, offres.html, apropos.html,
│   ├── contact.html, connexion.html, creer-compte.html, espace.html
│   ├── style.css           ← couleurs/polices communes
│   └── README.md           ← ce guide
└── 02_Documents_sources/   ← tes documents d'origine (cahier des charges, etc.)
```

⚠️ Garde tous les fichiers du site **ensemble dans `01_Site_web/`** : c'est ce qui
permet aux pages de se relier entre elles et de charger le `style.css`.

---

## 📁 Les fichiers

| Fichier | Page | Contenu |
|---|---|---|
| `index.html` | Accueil | Hero, simulateurs, documents, juridique, témoignages, offres, FAQ |
| `simulateurs.html` | Simulateurs | Les 3 outils : estimer, calculer les parts, vente/rachat |
| `offres.html` | Nos offres | Les 2 formules, comparatif, FAQ tarifaire |
| `apropos.html` | À propos | Mission, histoire, valeurs, équipe, engagements |
| `contact.html` | Contact | Coordonnées + formulaire |
| `connexion.html` | Se connecter | Formulaire de connexion |
| `creer-compte.html` | Créer un compte | Inscription + force du mot de passe |
| `espace.html` | Mon espace | Tableau de bord « Mes biens » |
| **`style.css`** | — | **Couleurs et polices communes à tout le site** |
| `README.md` | — | Ce guide |

---

## 🎨 Changer les couleurs / le style global → `style.css`

Ouvre **`style.css`** : tout en haut, le bloc `:root` contient les couleurs du site.
Change une valeur ici et elle se met à jour **sur toutes les pages d'un coup**.

```css
:root{
  --bleu-roi:        #1A237E;   /* titres, logo */
  --bleu-violet:     #5C6BC0;   /* boutons, liens */
  --vert:            #A5C4BD;   /* validations */
  --texte:           #1F2233;   /* texte principal */
  --texte-doux:      #5A5E72;   /* texte secondaire */
  ...
}
```

Exemple : pour passer le bleu principal au vert foncé, remplace `#1A237E` par `#0B5D3B`.
Enregistre, recharge la page → c'est appliqué partout.

> 💡 Les polices (Montserrat pour les titres, Open Sans pour le texte) sont chargées
> en haut de chaque page via Google Fonts.

---

## ✏️ Modifier le contenu d'une page (textes, prix, etc.)

Chaque page `.html` est **autonome** et organisée en 3 zones :

1. **`<head>`** — le titre de l'onglet et le chargement des polices + `style.css`.
2. **`<style>`** — la mise en page *spécifique à cette page* (sa structure visuelle).
3. **`<body>`** — **le contenu visible** : c'est là que tu modifies les textes.
4. **`<script>`** (en bas) — les interactions (formulaires, simulateurs, menus).

Pour changer un **texte**, cherche-le dans le `<body>` et remplace-le. Exemples :

- **Le slogan** → dans `index.html`, cherche `Simplifiez l'indivision`.
- **Les prix** → dans `offres.html`, cherche `49 €` ou `179 €`.
- **L'email / le téléphone** → dans `contact.html`, cherche `contact@divimo.com`.
- **L'équipe** → dans `apropos.html`, cherche `Marti Fiatte` ou `Laetitia Faivre`.

---

## 🧮 Les simulateurs (`simulateurs.html`)

Les calculs sont dans la balise `<script>` en bas du fichier :

- **Estimation** : `surface × prix au m² × coefficient d'état` (−8 % si conflit).
  → fonction `estCompute()`. Tu peux ajuster les prix par défaut au m² dans la
  liste des types de bien (`data-pm="3500"`, etc.).
- **Calcul des parts** : valeur × (% de chacun). → fonction `partsCompute()`.
- **Vente / rachat** : produit net = prix − frais − dettes ; soulte de rachat.
  → fonctions `vCompute()` et `rachatCompute()`.

Les couleurs du graphique en anneau sont dans la variable `PAL` (en haut du script) :
```js
const PAL=['#1A237E','#5C6BC0','#19a974','#F2994A','#EB5757','#9B51E0','#56CCF2','#F2C94C'];
```

---

## 🔗 Comment les pages sont reliées

Les liens utilisent simplement le nom du fichier, ex. `href="contact.html"`.
Garde donc **tous les fichiers dans le même dossier** pour que la navigation marche.

---

## 🚀 Mettre le site en ligne (plus tard)

Comme tout est en fichiers statiques, tu peux l'héberger gratuitement sur
**Netlify**, **GitHub Pages** ou **Vercel** : il suffit d'y déposer ce dossier.
La page d'accueil doit s'appeler `index.html` (c'est déjà le cas).

---

## ⚠️ Bon à savoir

- Les formulaires (contact, connexion, inscription) sont **visuels** : ils valident
  les champs mais n'envoient encore rien à un serveur. Pour les rendre réels, il
  faudra les brancher à un service (formulaire email, base de données…).
- Les données affichées dans l'espace (biens, documents) sont des **exemples**.
- Projet étudiant — non destiné à la vente.
