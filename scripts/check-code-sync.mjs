#!/usr/bin/env node
/**
 * Garante que `ENGINE.code.lines` de cada engine bate, linha a linha, com o
 * arquivo `.rs` que o manifest.js aponta como sua fonte.
 *
 * Contexto: manifest.js tem um campo `source: "algorithms/.../source.rs"`
 * por entrada, mas nada lia esse campo — cada engine.js mantinha seu próprio
 * array `CODE_LINES` com o conteúdo do .rs duplicado como string literal.
 * As duas cópias podiam divergir silenciosamente (nada as comparava), e o
 * manifest apontava justamente para a cópia que ninguém usava.
 *
 * Descoberta ao implementar isto: 6 dos 8 `.rs` (todos exceto fibonacci e
 * quicksort) têm um `fn main() { ... }` de demonstração no final, pra serem
 * arquivos Rust standalone compiláveis/executáveis. CODE_LINES nunca inclui
 * esse main() de demo — só a(s) função(ões) do algoritmo, que é o que o
 * painel didático deve mostrar. Isso é intencional, não drift: a comparação
 * abaixo ignora um único `fn main() { ... }` final antes de comparar.
 *
 * Este script não elimina a duplicação (fetch+parse do .rs em runtime traria
 * complexidade de parsing sem necessidade real hoje), só garante que ela não
 * pode ficar destravada: falha o `npm run check` se algum engine.js e a
 * parte do source.rs relevante pro painel saírem de sincronia.
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// Remove um único `fn main() { ... }` de demonstração do final do arquivo,
// se existir (heurística: último `fn main() {` até o `}` que fecha o
// arquivo). Não tenta parsear Rust de verdade — só cobre o padrão real
// observado nos 8 algoritmos deste repo.
function stripTrailingDemoMain(sourceText) {
  const marker = "\nfn main() {";
  const idx = sourceText.lastIndexOf(marker);
  if (idx === -1) return sourceText;
  return sourceText.slice(0, idx).replace(/\n+$/, "");
}

function loadManifest() {
  const code = fs.readFileSync(path.join(ROOT, "manifest.js"), "utf8");
  const sandbox = {};
  vm.createContext(sandbox);
  // `const ALGORITHM_MANIFEST = [...]` não vaza pro objeto sandbox sozinho
  // (const/let ficam no escopo léxico do script, não no global) — por isso
  // a atribuição extra roda no mesmo script, onde o binding ainda é visível.
  vm.runInContext(
    code + "\nthis.ALGORITHM_MANIFEST = ALGORITHM_MANIFEST;",
    sandbox,
    { filename: "manifest.js" },
  );
  if (!Array.isArray(sandbox.ALGORITHM_MANIFEST)) {
    throw new Error("manifest.js não expôs ALGORITHM_MANIFEST como array.");
  }
  return sandbox.ALGORITHM_MANIFEST;
}

async function main() {
  const manifest = loadManifest();
  const problems = [];

  for (const entry of manifest) {
    if (!entry.source) {
      problems.push(`${entry.id}: manifest não declara campo 'source'.`);
      continue;
    }

    const sourcePath = path.join(ROOT, entry.source);
    const enginePath = path.join(ROOT, entry.engine);

    if (!fs.existsSync(sourcePath)) {
      problems.push(`${entry.id}: source.rs não existe em ${entry.source}.`);
      continue;
    }

    const sourceText = stripTrailingDemoMain(
      fs.readFileSync(sourcePath, "utf8").replace(/\n$/, ""),
    );

    let engineMod;
    try {
      engineMod = await import(new URL(`file://${enginePath}`));
    } catch (err) {
      problems.push(`${entry.id}: falha ao importar ${entry.engine} (${err.message}).`);
      continue;
    }

    const lines = engineMod.ENGINE?.code?.lines;
    if (!Array.isArray(lines)) {
      problems.push(`${entry.id}: ENGINE.code.lines ausente ou não é array.`);
      continue;
    }

    const codeLinesText = lines.join("\n");
    if (codeLinesText !== sourceText) {
      problems.push(
        `${entry.id}: CODE_LINES (${entry.engine}) diverge de ${entry.source}.`,
      );
    }
  }

  if (problems.length > 0) {
    console.error("check-code-sync: CODE_LINES fora de sincronia com source.rs:\n");
    for (const p of problems) console.error(" - " + p);
    console.error(
      "\nAtualize o CODE_LINES do engine (ou o .rs) até os dois baterem exatamente.",
    );
    process.exit(1);
  }

  console.log(`check-code-sync: ${manifest.length} algoritmo(s) OK — CODE_LINES bate com source.rs.`);
}

main();
