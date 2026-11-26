# Slides du cours Coda Shmup

Les slides du cours, une par commit, faites avec [Slidev](https://sli.dev). Projet indépendant du jeu (son propre `package.json`).

```bash
npm install
npm run dev          # http://localhost:3030, mode présentateur sur /presenter
npm run build        # site statique dans dist/
npm run export:pdf   # slides-export.pdf
```

- `slides.md` importe `content/partie-1.md`, `partie-2.md`, `partie-3.md` (les parties suivent les commits).
- Layouts dans `layouts/` : `chapter` (ouverture d'une partie), `part` (intercalaire), `split` (texte à gauche, code à droite avec `::right::`).
- Thème dans `styles/index.css`, coloration du code dans `setup/shiki.ts`.
- Un bloc de code se présente avec son fichier source au-dessus : `<div class="file">src/...</div>`. `{2-3|5}` surligne des lignes, clic après clic.
- Un moment où les élèves codent : `<div class="cp"><b>À vous</b>…</div>`.
- Les notes du présentateur sont les blocs `<!-- ... -->`, avec les références `fichier:ligne`.
