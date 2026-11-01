// Verificação antes de concluir: testes, typecheck e build com saída curta.
// Imprime uma linha por etapa; só despeja o log de uma etapa quando ela falha.

import { spawnSync } from "node:child_process";

const steps = [
  ["testes", "npx vitest run --reporter=dot"],
  ["typecheck", "npx tsc --noEmit"],
  ["build", "npx vite build --logLevel error"]
];

let failed = false;
for (const [name, command] of steps) {
  const result = spawnSync(command, { shell: true, encoding: "utf-8" });
  if (result.status === 0) {
    const tests = name === "testes" ? (result.stdout.match(/Tests\s+(\d+ passed[^\n]*)/) ?? [])[1] : null;
    console.log(`ok  ${name}${tests ? ` (${tests.trim()})` : ""}`);
    continue;
  }
  failed = true;
  console.log(`ERRO ${name}`);
  const log = `${result.stdout}\n${result.stderr}`.trim().split("\n");
  console.log(log.slice(-60).join("\n"));
  break;
}
process.exit(failed ? 1 : 0);
