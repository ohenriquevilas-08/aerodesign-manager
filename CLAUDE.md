# Aerodesign Manager

Jogo de gestão de uma equipe universitária de aerodesign, inspirado na competição SAE BRASIL AeroDesign (no jogo: Competição Aerodesign Brasil).

Antes de mexer em código, leia:

1. `docs/design/ano-1.md`: o que o jogo é (regras, tempo, custos, competição). Fonte da verdade de design.
2. `docs/architecture.md`: camadas, regras de dependência e fluxo de dados. Fonte da verdade técnica.

Regras rápidas:

- `src/sim/` é puro: sem DOM, sem `Math.random`, sem `Date.now`. Toda regra nova tem teste em `tests/sim/`.
- Estado só muda por `Command` via `store.dispatch`.
- Fórmulas do regulamento citam a seção no comentário (Regulamento 2026 Rev01, Classe Regular).
- Antes de concluir: `npm run check` (testes, typecheck e build; imprime só ok ou o erro).
- Textos do jogo em PT-BR; código, arquivos e commits em inglês.
- O protótipo antigo (`Desktop/Aero/Aerodesign-Simulation`) está congelado; serve só de referência.
