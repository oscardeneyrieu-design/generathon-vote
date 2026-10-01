# Design

Le produit reprend l'identité de [generathon.tech](https://generathon.tech) pour y paraître intégré : même en-tête, même police, mêmes cartes, même accent doré.

## Couleurs

| Token | Valeur | Rôle |
|---|---|---|
| fond | `#ffffff` / `#0a0a0a` en sombre | Fond de page |
| texte | `#171717` / `#ededed` en sombre | Texte principal |
| `gold` | `#e4b363` | Accent unique : onglet actif, boutons principaux, ton pari, gagnants |
| `gold-hover` | `#d9a24f` | Survol des boutons dorés |
| `gold-ink` | `#8f6420` | Texte doré sur fond clair (le `#e4b363` y serait illisible) |

Les gris sont du noir ou du blanc en transparence (`black/10` pour les bordures, `black/60` pour le texte secondaire), comme sur le site. Le mode sombre suit le réglage de l'appareil.

Le doré signifie « toi » ou « décidé » : ton pari, l'onglet que tu regardes, le podium annoncé. Un état n'est jamais porté par la couleur seule : `✓ Ton pari` et `🏆 1er` accompagnent toujours le doré.

## Typographie

**Geist** (police du site), chiffres en `tabular-nums` pour que les points ne fassent pas bouger la mise en page. Le logo `GeNerAThoN` est en serif Georgia gras avec un léger décalage rouge/cyan, copié du site.

- Titre de page : `text-3xl font-extrabold tracking-tight`
- Titre de section : petites capitales espacées grises (`.section-title`), comme « LES ÉDITIONS »
- Points à gagner : gras, `text-2xl` dans les cartes
- Teinte des cartes de projet : de `--heat-low` (gris, favori) à `--heat-high` (jaune, outsider), mélangées en `oklab` selon les points à gagner (échelle log). Une légende au-dessus de la grille, et le chiffre toujours écrit : la couleur ne porte jamais l'information seule.
- Animations : courtes et liées à un changement d'état (arrivée de page, track ouverte, cartes en cascade, pari confirmé, chiffre qui change, lignes du classement qui glissent à leur nouveau rang). Toutes coupées sous `prefers-reduced-motion`.

## Composants

Tout est dans `src/app/globals.css` (bloc `@layer components`) et `src/components/` :

- `SiteChrome` — en-tête collant flouté avec les onglets **Parier** / **Classement** et le bouton doré **Admin** ; pied de page.
- `TrackTabs` — les trois tracks en boutons, l'active en aplat doré (modèle : boutons « Vous êtes » du site).
- `MyGame` — carte « Ton jeu » en haut de la page Parier : points en jeu et gagnés, paris posés, une ligne par track qui ouvre ses projets, bouton « Revoir les règles ».
- `ProjectGrid` — cartes projet arrondies (4 par ligne sur ordinateur, 2 sur téléphone), teintées du gris au jaune ; premier tap = sélection dorée avec « Touche encore pour confirmer », second tap = pari, cadre bleu.
- `RulesIntro` — les règles en plein écran noir à la première visite, cinq écrans illustrés.
- `Leaderboard` — tableau rang / projet / paris / à gagner, barre dorée pâle en fond de ligne.
- `Podium`, `BetsChart` (évolution des paris), `JoinCode` (QR code), `ConfirmButton` (confirmation en deux clics).

Chargement : blocs gris qui pulsent, jamais une valeur par défaut. Mouvements courts et désactivés sous `prefers-reduced-motion`.
