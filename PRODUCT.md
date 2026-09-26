# Product

## Register

product

## Platform

web

## Users

Les participants et les invités du Generathon #2, téléphone en main, entre deux sessions de build ou pendant la Live Demo du dimanche. Ils ont trente secondes d'attention et une main libre. Le job à faire tient en deux gestes : choisir la track qui les intéresse, puis désigner le projet qu'ils croient gagnant — et revenir changer d'avis à mesure que les projets se dévoilent, du samedi jusqu'à l'annonce des gagnants.

Un second utilisateur, l'organisateur, pilote depuis un écran séparé : il saisit les projets à mesure des soumissions, ouvre et ferme le vote, annonce les gagnants. Il travaille sous pression, en public, avec un vidéoprojecteur derrière lui. Ses actions doivent être irréversibles-mais-évidentes, jamais ambiguës.

## Product Purpose

Faire du public un participant. L'application ouvre un pari unique par personne sur trois tracks parallèles d'une trentaine de projets, recueille les paris anonymes et affiche en direct un classement par track, avec pourcentage et nombre de parieurs. Le succès, c'est qu'une personne comprenne le parcours sans qu'on le lui explique, et que l'écran projeté donne envie de rester devant.

## Positioning

Un pari en deux taps, sans compte ni installation, et le pronostic de la salle apparaît avant que le pouce ait quitté l'écran.

## Brand Personality

Sec, sportif, sans commentaire. L'interface ne félicite personne et ne met pas d'emoji sur les résultats : elle affiche des chiffres, gros, et les laisse parler. Le ton des libellés est celui d'un tableau d'affichage, pas celui d'une application grand public. Trois mots : direct, imprimé, implacable.

Le produit est destiné à vivre à l'intérieur de generathon.tech : il ne porte donc aucun nom propre, aucun logo, aucune signature. Il s'appelle « Public vote » parce que c'est ce qu'il est.

## Anti-references

Pas l'esthétique sondage-en-ligne (Google Forms, Slido, Mentimeter) : cartes arrondies, ombres douces, barres de progression multicolores, accents violets. Pas non plus le registre pari sportif (Betclic, Winamax) : dégradés, néons, urgence artificielle, chiffres qui clignotent. Aucune gamification décorative — pas de confettis, pas de badges, pas de sons.

## Design Principles

Le chiffre est le sujet. Les pourcentages et les totaux sont le contenu principal de chaque écran, pas une annotation dans un coin : ils dictent la hiérarchie typographique, pas l'inverse.

Deux taps, pas un formulaire. Parier ne passe par aucune étape inutile : pas de bouton « valider », pas de confirmation, pas de pseudo à saisir. Le tap est le pari, et le re-tap est le changement d'avis.

Une track, assumée. Le choix de track est structurant, pas un filtre : il occupe la pleine largeur, porte le nom complet du challenge, et l'interface dit explicitement ce qu'il advient du pari en cours quand on en change.

Lisible à trois mètres comme à trente centimètres. La même donnée sert un pouce sur un téléphone et une salle devant un vidéoprojecteur ; ce sont deux surfaces distinctes tirées du même état, pas une page responsive qui essaie les deux.

Le noir et blanc porte l'état. Ouvert, fermé, parié, gagnant : tout se dit par inversion, épaisseur de trait et masse typographique. Aucune couleur n'est disponible pour se rattraper — ce qui rend aussi le produit trivial à réhabiller aux couleurs de l'événement.

Aucun écran n'affirme avant de savoir. Tant que l'état n'est pas lu, les trois surfaces montrent un chargement, jamais une valeur par défaut : dire « vote fermé » pendant une demi-seconde sur l'écran projeté est un mensonge que personne ne rattrape.

## Accessibility & Inclusion

Cible WCAG 2.2 AA. Le contraste est structurellement acquis (encre quasi-noire sur blanc cassé, chroma 0), mais chaque état non textuel — track choisie, projet parié, gagnant — reste identifiable sans s'appuyer sur la seule inversion : un libellé ou une marque l'accompagne. Cibles tactiles ≥ 44 px, la grille de projets étant utilisée debout et dans la pénombre. Focus clavier visible partout. Toute animation — remontée des barres, réordonnancement du classement — a une alternative sous `prefers-reduced-motion: reduce`, l'information n'étant jamais portée par le mouvement seul.
