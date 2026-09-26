# Design

Affiche suisse : encre noire sur papier blanc cassé, grotesque à axe de largeur variable, filets noirs épais, grain d'impression. Deux accents seulement, chacun attaché à un rôle — tout le reste passe par l'inversion, l'épaisseur et la masse.

## Color

Les neutres sont en OKLCH à chroma 0, et le restent : le chroma nul interdit de régler un problème de hiérarchie en ajoutant une teinte au hasard.

Deux accents s'ajoutent, et deux seulement. Chacun porte un rôle, jamais une décoration :

- **Bleu — « toi »** : ta track, ton pari. C'est l'état que chaque personne voit le plus souvent, et le seul qui la concerne personnellement.
- **Rouge — « résultat »** : le gagnant annoncé. Trois occurrences dans la soirée, pour l'évènement le plus important de l'écran.

Une tuile pariée est un aplat bleu ; un gagnant, un aplat rouge. Avoir parié sur le gagnant se lit comme un aplat rouge cerclé de bleu. Ailleurs, les accents n'apparaissent qu'en teinte claire derrière une ligne de classement, ou en couleur de libellé sur papier.

Ce qui reste interdit : colorer une cote (la couleur qualifierait le chiffre alors qu'elle qualifie la ligne), colorer les trois tracks pour les distinguer (elles ne se classent pas entre elles), et faire porter un état à la seule couleur — `● YOUR BET` et `WINNER` accompagnent toujours l'aplat.

Contrastes vérifiés : 7.7:1 pour les deux accents contre le papier, dans les deux sens (libellé coloré sur papier, papier sur aplat coloré).

| Token | Valeur | Rôle |
|---|---|---|
| `--paper` | `oklch(0.968 0 0)` | Fond de page. Blanc cassé neutre, jamais crème ni tinté chaud. |
| `--paper-sunk` | `oklch(0.930 0 0)` | Pistes de barres, champs de saisie, surfaces en retrait. |
| `--ink` | `oklch(0.155 0 0)` | Texte et filets. Quasi-noir, pas `#000` : le noir pur vibre sur blanc. |
| `--ink-muted` | `oklch(0.430 0 0)` | Libellés secondaires et métadonnées. 7.2:1 sur `--paper`, au-dessus du minimum AA. |
| `--ink-faint` | `oklch(0.620 0 0)` | Texte désactivé et séparateurs uniquement. Jamais de texte porteur de sens. |
| `--color-mine` | `oklch(0.42 0.13 252)` | Bleu « toi » : aplat d'une tuile pariée, libellé `● YOUR BET`. |
| `--color-mine-tint` | `oklch(0.905 0.045 252)` | Barre de fond de ta ligne dans le classement. |
| `--color-win` | `oklch(0.44 0.17 27)` | Rouge « résultat » : aplat du gagnant, bandeau d'annonce. |
| `--color-win-tint` | `oklch(0.905 0.055 27)` | Barre de fond de la ligne gagnante. |

`--ink-faint` sur `--paper` vaut 4.0:1 : réservé au texte désactivé et aux filets, interdit pour du contenu.

### Réhabillage

Le produit est destiné à être intégré à generathon.tech, donc à changer de direction artistique. Toute l'identité tient dans le bloc `@theme` de `src/app/globals.css` : sept variables de couleur et une famille typographique. Passer le fond en noir, introduire une couleur d'accent de marque ou changer de grotesque ne demande de toucher à aucun composant. Deux réserves si une couleur est introduite : les états ci-dessous doivent rester distinguables sans elle, et `--color-ink` doit conserver 4.5:1 sur `--color-paper`.

### États

Aucune couleur sémantique. L'état se lit par la forme :

- **Non parié** — filet 2px, papier, texte encre. La tuile affiche sa cote sous le libellé `ODDS`.
- **Parié** — aplat bleu, texte papier, plus la mention `● YOUR BET` (`● YOUR TRACK` sur une track).
- **Vote fermé** — filets en `--ink-faint`, opacité 0.55, curseur interdit, bandeau `CLOSED` en tête de page.
- **Gagnant** — aplat rouge, double contour à 3px de décalage, libellé `WINNER`.
- **Gagnant et parié** — aplat rouge, anneau bleu, libellé `WINNER · YOURS`. Les deux informations coexistent au lieu que l'une écrase l'autre.
- **Chargement** — squelettes en `--paper-sunk` à la place du contenu. Jamais une valeur par défaut : aucun écran n'annonce « vote fermé » avant d'avoir lu la base.
- **Focus** — `outline: 3px solid var(--ink); outline-offset: 3px`. Identique partout, jamais supprimé.

## Typography

Une seule famille : **Archivo** (Google, variable, axe `wdth` 62–125). Le grotesque néo-suisse couvre titres, libellés, boutons et données ; l'axe de largeur fournit le contraste d'affiche sans introduire une seconde police. Chiffres en `font-variant-numeric: tabular-nums` partout — les cotes changent en direct et ne doivent pas faire danser la mise en page.

Les colonnes du classement sont surmontées d'un en-tête `PROJECT / BETS / ODDS` : sans lui, un nombre comme `4.20` ne se lit pas spontanément comme une cote.

Échelle fixe en rem (registre produit), ratio ~1.2, sauf deux exceptions assumées : le score de l'écran de projection et le titre de manche, qui sont du registre affiche et utilisent `clamp()` plafonné à 6rem.

| Rôle | Taille | Graisse / largeur | Interlettrage |
|---|---|---|---|
| Score projection | `clamp(3.5rem, 11vw, 6rem)` | 800 / wdth 80 | `-0.035em` |
| Titre de manche | `clamp(1.75rem, 5vw, 3rem)` | 800 / wdth 85 | `-0.03em` |
| Nom d'équipe (grille) | `1.0625rem` | 700 / wdth 100 | `-0.01em` |
| Cote (liste) | `1.5rem` | 800 / wdth 90 | `-0.02em` |
| Corps | `0.9375rem` | 400 | `0` |
| Libellé / méta | `0.75rem` | 600, `uppercase` | `0.08em` |

Le libellé capitales-espacées est un élément de système ici — il sert de marqueur de données (`VOTES`, `PARTICIPANTS`, `MANCHE 03`), jamais de sur-titre décoratif au-dessus d'une section.

Plancher d'interlettrage : `-0.04em`. Longueur de ligne des textes suivis : 65–70ch.

## Layout

Grille de 12 colonnes, gouttière 1px d'encre là où une séparation structurelle est utile — les filets sont la grille, visible, comme sur une affiche. Rayon de bordure **0** partout : aucun angle arrondi dans le système.

- **Espacement** : échelle 4px (`4 8 12 16 24 32 48 64 96`). Rythme volontairement irrégulier — 64px au-dessus d'un titre de section, 12px entre deux lignes de données.
- **Sélecteur de track** : trois cartes `repeat(auto-fit, minmax(230px, 1fr))`. Pleine largeur et nom complet du challenge — c'est le choix structurant du parcours, pas un filtre.
- **Grille de projets** : `repeat(auto-fit, minmax(160px, 1fr))`, sans point de rupture. Une colonne sous 360px.
- **Classement** : liste pleine largeur, une ligne par projet, barre de proportion en fond de ligne plutôt qu'en élément séparé.
- **Projection** (`/board`) : hors flux du reste, les trois tracks en colonnes `minmax(340px, 1fr)`, 5 lignes par track au maximum, pensée pour être lue à trois mètres.
- **Ombres** : aucune. La profondeur se fait par filet et inversion.
- **Échelle z** : `--z-grain: 100`, `--z-sticky: 200`, `--z-overlay: 300`. Pas de valeur arbitraire.

## Texture

Grain d'impression : `feTurbulence` SVG inline en data-URI, `baseFrequency 0.8`, superposé en `position: fixed`, `mix-blend-mode: multiply`, `opacity: 0.16`, `pointer-events: none`. Statique — jamais animé, pour ne pas coûter de frames sur téléphone. Masqué sous `prefers-reduced-transparency` et sur `/board` au-delà de 1600px, où il devient du bruit à la projection.

## Motion

150–250 ms, `cubic-bezier(0.16, 1, 0.3, 1)` (ease-out-expo). Le mouvement ne sert que le changement d'état.

- **Barre de proportion** : `transform: scaleX()` 220 ms. Jamais `width` — la barre est dans le flux d'une ligne de liste.
- **Réordonnancement du classement** : FLIP sur `transform: translateY()`, 260 ms, échelonné de 18 ms par ligne. C'est le seul moment chorégraphié du produit, et il porte une information réelle : un projet vient d'en doubler un autre.
- **Confirmation de pari** : inversion instantanée du bloc, sans transition. Le retour doit précéder la perception, pas l'accompagner.
- **Reduced motion** : les barres se positionnent sans transition, le FLIP est désactivé, le réordonnancement est instantané. Aucune information n'est perdue.

## Components

Vocabulaire fermé, réutilisé tel quel sur les trois surfaces :

- `TrackPicker` / `ProjectGrid` — cibles de pari, même vocabulaire de tuile. États : défaut, survol (filet 3px), focus, sélectionné, désactivé.
- `RankRow` — ligne de classement : rang, nom, équipe (et marque sur la track Ad), barre de fond, pourcentage, nombre de paris.
- `StatPair` — un chiffre et son libellé capitales. Utilisé pour les totaux, jamais groupé en rangée de quatre façon tableau de bord.
- `Rule` — filet horizontal, 1px `--ink` par défaut, 3px pour une séparation de section.
- `Button` — rectangle, filet 2px, fond papier ; en variante pleine, bloc inversé. Une seule forme dans tout le produit.
- `Banner` — bandeau pleine largeur inversé, pour l'état de manche (`CLÔTURÉ`, `RÉPONSE : …`).

Chaque composant interactif expose défaut, survol, focus, actif, désactivé. Chargement : squelettes en `--paper-sunk`, jamais de spinner. État vide : une track sans projet explique d'où ils viennent et que la page se mettra à jour seule, elle n'affiche pas « aucune donnée ».
