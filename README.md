# Aerodesign Manager

Jogo de gestão para notebook: você é presidente de uma equipe universitária de aerodesign recém-fundada e precisa formar gente, projetar, fabricar, ensaiar e levar um avião à Competição Aerodesign Brasil, com regras que espelham as da competição real (Classe Regular 2026).

- Design: [docs/design/ano-1.md](docs/design/ano-1.md)
- Arquitetura: [docs/architecture.md](docs/architecture.md)

## Rodar

Requer Node.js 22+.

```bash
npm install
npm run dev
```

Abra http://localhost:5173. Espaço pausa; teclas 1, 2 e 3 mudam a velocidade.

## Verificar

```bash
npm test
npm run typecheck
npm run build
```

O deploy no GitHub Pages roda a cada push na `main` (`.github/workflows/deploy.yml`).
