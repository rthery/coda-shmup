# Evaluation

## Objectif

Ajouter un nouvel ennemi suivant ces critères :
- Mouvement sinusoidal
- Attaque en 'Spread Shot', l'ennemi tire plusieurs projectiles en même temps, qui s'espacent en éventail.
- Spawn rate de ce nouvel ennemi, mouvement et spread shot doivent être configurables via JSON (Ex : tirer aussi bien 3 dans un angle
  de 30 deg, que 60 bullets à 360 deg)
- Ce nouvel ennemi doit être visuellement different de l'autre

Suivez bien les instructions dans les [cours](COURS.md) sur le **Processus de développement**  
Créez une branche depuis la `main` après les cours (il faut que votre branche ne contienne QUE les ajouts nécessaires à 
cette évaluation), nommez la `eval`, travaillez et faites vos commits puis soumettez-la via une PR.   
Vous pouvez la merge, mais n'effacez pas votre branche `eval`!

Joignez votre tech plan à la PR, en fichier `.md`.

Rappel pour le TD : si vous voulez ensuite ajouter d'autres ennemis/monstres, faites d'abord cette évaluation (règle aussi rappelée dans [COURS.md](COURS.md)).

## Critères de notation

La note sur 20 se fera sur ces critères

### Fonctionnalité 7
L'ennemi spawn, se déplace en sinusoïde, tire en spread shot ; les 3 sont pilotés par le JSON (on peut changer les valeurs sans toucher au code)
### Architecture 7
Pattern Entity/Composants respecté, pooling avec reset d'état correct, config JSON + type TS, pas de dépendance logique → UI, constantes nommées
### Qualité du code 5
Lisibilité, pas de code mort ni de `console.log` de debug, `npm run build-nolog` passe, playtest manuel décrit
### Git 1
Branche `eval` propre (uniquement les ajouts de l'éval), commits atomiques, PR ouverte