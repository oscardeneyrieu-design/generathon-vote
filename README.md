# Pronostics du public — Generathon #2

Le public parie sur le projet qui va gagner chaque track. Classements en direct, du samedi jusqu'à l'annonce des gagnants.

## Le parcours

1. **Une track** — *Three Minutes to Move*, *Animate the Shift* ou *Sell the Feeling*.
2. **Un projet** dans cette track : chaque carte montre les personnes de l'équipe, avec leur photo.
3. On recommence dans les autres tracks : **un pari par track**, donc jusqu'à trois paris par personne.
4. Les cotes bougent en direct, sur le téléphone comme sur l'écran projeté. Tes paris ressortent en bleu partout.

Un pari par appareil et par track, modifiable à volonté tant que les paris sont ouverts.

## L'horloge

Dans `/admin`, choisis le jour et l'heure de fin (par défaut le prochain dimanche à 14 h), puis **Lancer le compte à rebours**. Les paris s'ouvrent, le compte à rebours défile sur les téléphones, sur le grand écran et dans l'admin, et à l'heure dite tout se ferme seul : les écrans basculent d'eux-mêmes et le serveur refuse tout pari arrivé après (c'est l'heure du serveur qui fait foi, pas celle du téléphone). On peut changer l'heure, fermer plus tôt, ou ouvrir sans heure de fin.

## L'accès admin

Le bouton **Admin** mène à `/admin`, protégé par un code : la valeur de `ADMIN_CODE` dans `.env.local` (et, une fois en ligne, dans les variables d'environnement Vercel). Le code n'est jamais stocké dans le navigateur : après connexion, le serveur pose un cookie signé avec ce code, valable 12 h. Changer `ADMIN_CODE` déconnecte tout le monde. Après 8 essais ratés en une minute, la connexion est bloquée une minute.

**Chaque track a son gagnant. Il n'y a pas de vainqueur au-dessus des trois** : elles ne sont jamais comparées entre elles, et aucun écran n'affiche de part d'une track dans le total.

## Les cotes

Cote décimale pari-mutuel : ce que rapporterait une mise de 1 sur un projet s'il gagne. Moins un projet est soutenu, plus sa cote est longue.

La formule brute d'un pool serait `total de la track ÷ paris sur le projet`. À l'échelle d'une soirée — de l'ordre de 70 parieurs sur trois tracks — elle casse : un projet sans pari donne une cote infinie, et une track à trois parieurs voit ses cotes tripler à chaque clic. On ajoute donc un pari virtuel sur chaque projet (lissage de Laplace) :

```
cote = (total de la track + nombre de projets) / (paris sur le projet + 1)
```

Conséquences voulues : la cote est toujours finie, jamais inférieure à 1.00, identique pour tous les projets tant que personne n'a parié — ce qui est exactement ce qu'on sait d'eux — et elle bouge d'autant plus doucement que la track est peu fournie. En dessous de 8 parieurs sur une track, l'interface prévient que les cotes vont encore beaucoup bouger.

Tout est dans [`src/lib/odds.ts`](src/lib/odds.ts).

## Les trois écrans

| Route | Pour qui | Quoi |
|---|---|---|
| `/` (onglet **Parier**) | le public | Choix de la track, cartes des projets, classement en direct, courbe des cotes |
| `/board` (onglet **Classement**) | le public et le vidéoprojecteur | Les trois tracks en colonnes, top 5 chacune, QR code pour rejoindre |
| `/admin` (bouton **Admin**) | l'organisateur | Ouvrir/fermer les paris, saisir les projets, annoncer le podium |

L'interface reprend l'identité de generathon.tech (en-tête, police Geist, accent doré, cartes arrondies) pour y paraître intégrée. Elle est en français et suit le mode clair/sombre de l'appareil.

---

## Deux modes

Une seule ligne de `.env.local` décide de tout :

```
NEXT_PUBLIC_DATA_BACKEND=sqlite     # ou supabase
```

| | `sqlite` | `supabase` |
|---|---|---|
| Où vivent les données | fichier `.data/votes.db` sur ton PC | Postgres dans le cloud |
| Temps réel | SSE depuis ton serveur | canal Realtime de Supabase |
| Internet nécessaire | **non**, ni pour toi ni pour les téléphones | oui, pour tout le monde |
| Compte à créer | aucun | Supabase (gratuit) |
| Les participants doivent | être sur ton wifi | avoir de la data |
| Bon pour | un test, un repli | **l'événement** |

Le code applicatif est identique : deux implémentations d'une même interface (`src/lib/store/` côté serveur, `src/lib/live/` côté navigateur).

> **Pour le Generathon, prends `supabase`.** Les paris courent du samedi au dimanche soir : en mode local, ton PC devrait rester allumé une trentaine d'heures et tout le monde rester sur le même wifi, sans compter l'isolation des clients que beaucoup de réseaux invités appliquent. Le mode SQLite est là pour développer et pour te dépanner.

> **En production, changer de mode impose un `npm run build`.** Next fige les variables `NEXT_PUBLIC_*` dans le bundle navigateur au moment du build. En développement, un redémarrage suffit.

---

## Démarrage en local (SQLite)

```bash
npm install
cp .env.local.example .env.local   # puis change ADMIN_CODE
npm run dev
```

→ [localhost:3000](http://localhost:3000). La base se crée toute seule avec les trois tracks. Les projets s'ajoutent depuis `/admin`.

Pour ouvrir aux téléphones du même wifi : `npm run build` puis `npm run start:lan`, et les téléphones vont sur `http://<ton-ip>:3000` (`ipconfig` → *Adresse IPv4*). Windows demandera d'autoriser Node.js sur les réseaux privés.

---

## Déploiement (Supabase + Vercel)

1. [supabase.com](https://supabase.com) → *New project* (plan gratuit).
2. **SQL Editor** → *New query* → colle tout [`supabase/schema.sql`](supabase/schema.sql) → *Run*. Le script crée les tables, active les RLS en lecture seule, branche le Realtime et insère les trois tracks. Il est rejouable sans rien écraser.
3. Dans `.env.local`, passe `NEXT_PUBLIC_DATA_BACKEND=supabase` et remplis les trois clés (Supabase → *Project Settings* → *API*).
4. `npx vercel`, puis **Settings → Environment Variables** : recopie `NEXT_PUBLIC_DATA_BACKEND`, les trois clés Supabase et `ADMIN_CODE`. Redéploie.

L'URL de déploiement est celle qui s'affiche en QR code sur `/board`.

### Intégration à generathon.tech

Le plus simple est un sous-domaine (`vote.generathon.tech`) pointé sur le déploiement Vercel, avec un lien depuis l'espace participant. Les pages sont en `noindex` pour ne pas concurrencer le site de l'événement dans les moteurs de recherche.

---

## Le week-end

**Samedi, dès que les équipes sont formées**

1. `/admin` → pour chaque track, *Coller toute la liste* → une ligne par projet, `Projet | Équipe | Membres` (et `Projet | Équipe | Marque | Membres` sur la track Ad), les membres séparés par des virgules. Le séparateur accepte aussi la tabulation, donc un copier-coller depuis un tableur fonctionne.
2. Les photos : sous chaque projet, *Ajouter les membres* → *Ajouter une photo* pour chaque personne. La photo est recadrée en carré et allégée automatiquement.
3. Choisis l'heure de fin et **Lancer le compte à rebours**. Les paris commencent.

**Pendant le build** — tu peux corriger un nom, ajouter un projet en retard, tout se met à jour en direct sur les téléphones. Attention : *Remplacer* efface les paris de la track concernée, contrairement au bouton *Enregistrer* d'une ligne, qui les conserve.

**Dimanche 17h30, Live Demo** — `/board` en plein écran (F11) sur l'écran projeté.

**À l'heure de fin**, les paris se ferment seuls. **Annonce** — choisis le 1er, le 2e et le 3e de chaque track dans les menus du podium. Le podium apparaît instantanément sur les téléphones et le grand écran.

Garde `/admin` sur un appareil que tu ne projettes pas. Les actions destructives demandent une confirmation en deux temps, mais mieux vaut ne pas les avoir sous les yeux de la salle.

---

## Vérifications

```bash
npm test         # calcul des classements : ex æquo, arrondis, division par zéro
npm run smoke    # parcours complet contre un serveur qui tourne
```

`smoke` crée deux projets jetables, leur ajoute un membre avec photo, parie dans deux tracks, vérifie qu'un pari hors track, qu'un pari après l'heure de fin et qu'un pari après clôture sont refusés, puis supprime tout et restaure l'état des paris (heure de fin comprise). Tes vrais projets et paris ne sont pas touchés.

À lancer contre le déploiement une fois en ligne :

```bash
npm run smoke -- https://vote.generathon.tech mon-code-admin
```

---

## Sécurité du modèle

**Aucune écriture n'est possible depuis le navigateur.** En mode Supabase les RLS n'accordent que le `SELECT` ; dans les deux modes, parier, ouvrir le vote ou renommer un projet passent par des Route Handlers côté serveur. Rejouer les requêtes à la main avec la clé anon ne permet ni de parier deux fois ni de fermer le vote. Le serveur vérifie aussi que le projet parié appartient bien à la track annoncée — sinon un appel forgé fausserait la répartition entre tracks.

L'identité du parieur est un UUID en `localStorage`. C'est ce qui permet de parier sans compte, et c'est la limite du modèle : vider le stockage local ou ouvrir une fenêtre privée donne un second pari. Assumé pour un vote du public — un pari infalsifiable exigerait une authentification, donc un écran de connexion pour chaque participant.

Le cookie admin est un HMAC dont la clé est `ADMIN_CODE` : il n'est pas forgeable sans connaître le code, et changer `ADMIN_CODE` invalide toutes les sessions ouvertes.

---

## Réglages utiles

| Quoi | Où |
|---|---|
| Couleurs (doré, fonds) et composants | `src/app/globals.css` → blocs `@theme` et `@layer components` |
| Formule des cotes, plafond, seuil « peu de paris » | `src/lib/odds.ts` |
| Noms et challenges des tracks | `/admin`, ou `src/lib/tracks.ts` pour le seed |
| Fréquence de recalcul des classements (400 ms) | `src/lib/use-live.ts` → `THROTTLE_MS` |
| Filet de sécurité si le canal meurt (15 s) | `src/lib/use-live.ts` → `SAFETY_POLL_MS` |
| Lignes par track sur `/board` (5) | `src/app/board/page.tsx` → `ROWS_PER_TRACK` |
| Plafond de projets par track (40) | `src/app/api/admin/projects/route.ts` → `MAX_PER_TRACK` |
| Durée de la session admin (12 h) | `src/app/api/admin/session/route.ts` → `maxAge` |

Le système visuel est documenté dans [`DESIGN.md`](DESIGN.md) ; le cadrage produit dans [`PRODUCT.md`](PRODUCT.md).
