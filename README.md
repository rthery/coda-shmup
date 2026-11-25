# Coda Shmup
This is the base project used as teaching material for the gamedev module at Coda

## Suivre le cours commit par commit
Il faut Node.js 22.18 ou plus récent (la version LTS actuelle convient) : vérifiez avec `node -v`.

Forkez ce repo, clonez votre fork, puis lancez une seule fois, à la racine du clone (macOS, Linux, ou Windows dans PowerShell ou Git Bash, pas dans cmd) :

```bash
git config alias.go '!f() { export GIT_ASK_YESNO=false; h=$(git rev-list --reverse main | sed -n $(expr $1 + 0)p); git clean -fdq; git switch -q -fC cours $h && git log -1 --oneline; }; f'
```

Ensuite, pour aller au commit numéro 09 du cours (le numéro affiché sur les slides) :

```bash
git go 09
```

`git go` efface vos changements locaux et place la branche `cours` sur ce commit.

Le serveur de dev (`npm run dev-nolog`) peut rester lancé pendant `git go` : il recharge le jeu tout seul. Si un commit change `package.json`, arrêtez-le, lancez `npm install`, puis relancez-le.

## Matériel pédagogique
- [COURS.md](COURS.md) — support de cours : concepts Phaser, patterns, processus dev, idées de features
- [EVALUATION.md](EVALUATION.md) — sujet de l'évaluation notée (nouvel ennemi sinusoïdal + spread shot + config JSON, branche `eval` + PR)
- [docs/](docs/) — plan de cours jour par jour, outline des slides, présentation « coder avec un agent IA », review du matériel
- [slides/](slides/) — slides des 3 jours de cours (Slidev, voir [slides/README.md](slides/README.md))

## Credits
- [Phaser](https://phaser.io/) for the game engine
- [Kenney](https://kenney.nl/) for the assets (CC0 license — https://kenney.nl/support)