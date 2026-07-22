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
  const n0 = inputs.n;
  /** @type {TraceStep[]} */
  const steps = [];
  let idCounter = 0;
  const callStack = [];
  let root = null;

  /** @returns {StackFrame[]} */
  function snapshotStack() {
    return callStack.map((f) => ({
      title: `fib(${f.n})`,
      depth: f.depth,
      vars: [
        { k: "n", v: String(f.n) },
        {
          k: "a",
          v: f.a === null ? null : String(f.a),
          status: f.a === null ? "pending" : "active",
        },
        {
          k: "b",
          v: f.b === null ? null : String(f.b),
          status: f.b === null ? "pending" : "active",
        },
        {
          k: "resultado",
          v: f.resultado === null ? null : String(f.resultado),
          status: f.resultado === null ? "pending" : "resolved",
        },
      ],
    }));
  }

  /** @returns {TraceElement[]} */
  function elementsFor(n) {
    return [{ text: String(n), role: "primary", status: "active", id: "0" }];
  }

  /**
   * @param {number} n
   * @param {number} depth
   * @param {TraceTreeNode | null} parentNode
   * @returns {number}
   */
  function rec(n, depth, parentNode) {
    const id = idCounter++;
    const frame = {
      id,
      n,
      depth,
      a: /** @type {number | null} */ (null),
      b: /** @type {number | null} */ (null),
      resultado: /** @type {number | null} */ (null),
    };
    const node = {
      id,
      n,
      depth,
      resultado: /** @type {number | null} */ (null),
      children: [],
    };
    if (parentNode) parentNode.children.push(node);
    else root = node;
    callStack.push(frame);

    steps.push({
      event: "enter",
      phase: "DESCENDO",
      line: 1,
      depth,
      frameId: id,
      stack: snapshotStack(),
      elements: elementsFor(n),
      payload: { n },
    });

    const isBase = n <= 1;
    steps.push({
      event: "check",
      phase: "DESCENDO",
      line: 2,
      depth,
      frameId: id,
      stack: snapshotStack(),
      elements: elementsFor(n),
      payload: { n, isBase },
    });

    let resultado;
    if (isBase) {
      resultado = n;
      frame.resultado = resultado;
      node.resultado = resultado;
      steps.push({
        event: "base-return",
        phase: "DESCENDO",
        line: 3,
        depth,
        frameId: id,
        stack: snapshotStack(),
        elements: elementsFor(n),
        payload: { n, resultado },
      });
    } else {
      steps.push({
        event: "call-a",
        phase: "DESCENDO",
        line: 6,
        depth,
        frameId: id,
        stack: snapshotStack(),
        elements: elementsFor(n),
        payload: { n, arg: n - 1 },
      });

      const a = rec(n - 1, depth + 1, node);
      frame.a = a;
      steps.push({
        event: "post-a",
        phase: "SUBINDO",
        line: 6,
        depth,
        frameId: id,
        stack: snapshotStack(),
        elements: elementsFor(n),
        payload: { n, a },
      });

      steps.push({
        event: "call-b",
        phase: "DESCENDO",
        line: 7,
        depth,
        frameId: id,
        stack: snapshotStack(),
        elements: elementsFor(n),
        payload: { n, arg: n - 2 },
      });

      const b = rec(n - 2, depth + 1, node);
      frame.b = b;
      steps.push({
        event: "post-b",
        phase: "SUBINDO",
        line: 7,
        depth,
        frameId: id,
        stack: snapshotStack(),
        elements: elementsFor(n),
        payload: { n, b },
      });

      resultado = a + b;
      frame.resultado = resultado;
      node.resultado = resultado;
      steps.push({
        event: "combine",
        phase: "SUBINDO",
        line: 9,
        depth,
        frameId: id,
        stack: snapshotStack(),
        elements: elementsFor(n),
        payload: { a, b, resultado },
      });
    }
    callStack.pop();
    return resultado;
  }

  rec(n0, 0, null);
  return { steps, tree: root };
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
