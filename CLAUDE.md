# Aerodesign Manager

Jogo de gestão de uma equipe universitária de aerodesign, inspirado na competição SAE BRASIL AeroDesign (no jogo: Competição Aerodesign Brasil).

Antes de mexer em código, leia:

1. `docs/design/ano-1.md`: o que o jogo é (regras, tempo, custos, competição). Fonte da verdade de design.
2. `docs/architecture.md`: núcleo técnico (stack, camadas, regras de dependência, fluxo de dados, cenas, convenções). Fonte da verdade técnica.
3. Só a fase em que for mexer: `docs/phases/fase-2.md`, `fase-3.md`, `fase-4.md`, `fase-5.md`, `fase-6.md`, `fase-7.md`, `fase-8.md` ou `fase-9.md` (contratos e regras de cada fase). Não leia as outras.

Regras rápidas:

- `src/sim/` é puro: sem DOM, sem `Math.random`, sem `Date.now`. Toda regra nova tem teste em `tests/sim/`.
- Estado só muda por `Command` via `store.dispatch`.
- Fórmulas do regulamento citam a seção no comentário (Regulamento 2026 Rev01, Classe Regular).
- Antes de concluir: `npm run check` (testes, typecheck e build; imprime só ok ou o erro).
- Textos do jogo em PT-BR; código, arquivos e commits em inglês.
- O protótipo antigo (`Desktop/Aero/Aerodesign-Simulation`) está congelado; serve só de referência.
