# Public vote — Generathon #2

Le public parie sur le projet qui va gagner chaque track. Classements en direct, du samedi jusqu'à l'annonce des gagnants.

## Le parcours

1. **Une track** — *Three Minutes to Move*, *Animate the Shift* ou *Sell the Feeling*. Une seule, et ce choix est enregistré.
2. **Un projet** dans cette track.
3. Les cotes bougent en direct, sur le téléphone comme sur l'écran projeté.

Un pari par appareil. Modifiable à volonté — track comprise — tant que le vote est ouvert.

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
| `/` | le public | Choix de la track, grille des projets, classement en direct |
| `/board` | le vidéoprojecteur | Les trois tracks en colonnes, top 5 chacune, QR code pour rejoindre |
| `/admin` | l'organisateur | Ouvrir/fermer le vote, saisir les projets, annoncer les gagnants |

Aucun nom de produit n'apparaît dans l'interface : elle est faite pour vivre à l'intérieur de generathon.tech.

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

Le plus simple est un sous-domaine (`vote.generathon.tech`) pointé sur le déploiement Vercel, avec un lien depuis l'espace participant. L'application est aussi encapsulable en `<iframe>` : elle n'a ni en-tête ni pied de page propre, et `/` tient dans 52 rem de large. Les pages sont en `noindex` pour ne pas concurrencer le site de l'événement dans les moteurs de recherche.

---

## Le week-end

**Samedi, dès que les équipes sont formées**

1. `/admin` → pour chaque track, *Paste the whole list* → une ligne par projet, `Projet | Équipe` (et `| Marque` sur la track Ad). Le séparateur accepte aussi la tabulation, donc un copier-coller depuis un tableur fonctionne.
2. **Open betting**. Les paris commencent.

**Pendant le build** — tu peux corriger un nom, ajouter un projet en retard, tout se met à jour en direct sur les téléphones. Attention : *Replace* efface les paris de la track concernée, contrairement au bouton *Save* d'une ligne, qui les conserve.

**Dimanche 17h30, Live Demo** — `/board` en plein écran (F11) sur l'écran projeté.

**Dimanche 18h30, annonce** — **Close betting**, puis choisis le gagnant de chaque track dans le menu déroulant. Le bandeau apparaît instantanément partout, avec le pourcentage de gens qui l'avaient prédit.

Garde `/admin` sur un appareil que tu ne projettes pas. Les actions destructives demandent une confirmation en deux temps, mais mieux vaut ne pas les avoir sous les yeux de la salle.

---

## Vérifications

```bash
npm test         # calcul des classements : ex æquo, arrondis, division par zéro
npm run smoke    # parcours complet contre un serveur qui tourne
```

`smoke` crée un projet jetable, parie dessus, vérifie qu'un pari hors track et qu'un pari après clôture sont refusés, puis supprime tout et restaure l'état d'ouverture du vote. Tes vrais projets et paris ne sont pas touchés.

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
| Direction artistique (couleurs + typo) | `src/app/globals.css` → bloc `@theme` |
| Formule des cotes, plafond, seuil « peu de paris » | `src/lib/odds.ts` |
| Noms et challenges des tracks | `/admin`, ou `src/lib/tracks.ts` pour le seed |
| Fréquence de recalcul des classements (400 ms) | `src/lib/use-live.ts` → `THROTTLE_MS` |
| Filet de sécurité si le canal meurt (15 s) | `src/lib/use-live.ts` → `SAFETY_POLL_MS` |
| Lignes par track sur `/board` (5) | `src/app/board/page.tsx` → `ROWS_PER_TRACK` |
| Plafond de projets par track (40) | `src/app/api/admin/projects/route.ts` → `MAX_PER_TRACK` |
| Durée de la session admin (12 h) | `src/app/api/admin/session/route.ts` → `maxAge` |

Le système visuel — tokens, typographie, états, motion — est documenté dans [`DESIGN.md`](DESIGN.md) ; le cadrage produit dans [`PRODUCT.md`](PRODUCT.md).
