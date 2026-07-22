import { strong, code, highlightCode } from "../../_shared/engine-kit.js";

const ENGINE_VERSION = 3;

const CODE_LINES = [
  "fn fib(n: u64) -> u64 {",
  "    if n <= 1 {",
  "        return n;",
  "    }",
  "",
  "    let a = fib(n - 1);",
  "    let b = fib(n - 2);",
  "",
  "    a + b",
  "}",
];

const RUST = {
  keywords: /\b(fn|if|let|return)\b/g,
  types: /\b(u64)\b/g,
};
function highlightRust(rawLine) {
  return highlightCode(rawLine, RUST);
}

const messages = {
  enter(p) {
    return ["Chamando ", strong(`fib(${p.n})`)];
  },
  check(p) {
    return [
      "O computador está pensando: ",
      code("n <= 1"),
      `? n = ${p.n}. `,
      strong(p.isBase ? "Sim" : "Não"),
    ];
  },
  "base-return"(p) {
    return ["Caso-base: retorna o próprio ", code("n"), " = ", strong(p.resultado)];
  },
  "call-a"(p) {
    return [
      "Chama ",
      code("fib(n - 1)"),
      ", ou seja ",
      strong(`fib(${p.arg})`),
      ", e espera o resultado",
    ];
  },
  "post-a"(p) {
    return [strong(`fib(${p.n} - 1)`), " retornou. ", code("a"), " = ", strong(p.a)];
  },
  "call-b"(p) {
    return [
      "Chama ",
      code("fib(n - 2)"),
      ", ou seja ",
      strong(`fib(${p.arg})`),
      ", e espera o resultado",
    ];
  },
  "post-b"(p) {
    return [strong(`fib(${p.n} - 2)`), " retornou. ", code("b"), " = ", strong(p.b)];
  },
  combine(p) {
    return [
      "Soma ",
      code("a + b"),
      `: ${p.a} + ${p.b} = `,
      strong(p.resultado),
    ];
  },
};

const EVENTS = {
  enter: { icon: "arrow_forward" },
  check: { icon: "check_circle" },
  "base-return": { icon: "keyboard_return" },
  "call-a": { icon: "call_split" },
  "post-a": { icon: "keyboard_return" },
  "call-b": { icon: "call_split" },
  "post-b": { icon: "keyboard_return" },
  combine: { icon: "merge_type" },
};

/**
 * @param {{ n: number }} inputs
 * @returns {TraceResult}
 */
function buildTrace(inputs) {
  return { steps: [], tree: null };
}

/** @returns {ExpressionResult} */
function buildExpression(traceResult, stepIndex) {
  return { nodes: ["…"] };
}

/** @type {Engine} */
export const ENGINE = {
  version: ENGINE_VERSION,

  meta: {
    title: "Fibonacci ingênuo (recursão dupla)",
    subtitle:
      "Visualizador passo a passo: cada chamada não-base dispara duas chamadas recursivas.",
  },

  input: {
    schema: [
      {
        key: "n",
        label: "n",
        type: "number",
        default: "6",
        placeholder: "6",
      },
    ],
  },

  code: {
    lines: CODE_LINES,
    highlight: highlightRust,
  },

  visualization: {
    legend: [{ role: "primary", status: "current", label: "n na chamada atual" }],
  },

  events: EVENTS,

  buildTrace,
  buildExpression,
  messages,
};
