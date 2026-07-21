import { strong, code, highlightCode } from "../../_shared/engine-kit.js";

const ENGINE_VERSION = 3;

const CODE_LINES = [
  "fn fat(x: u64) -> u64 {",
  "    if x == 1 {",
  "        1",
  "    } else {",
  "        x * fat(x - 1)",
  "    }",
  "}",
];

const RUST = {
  keywords: /\b(fn|if|else)\b/g,
  types: /\b(u64|usize)\b/g,
};
function highlightRust(rawLine) {
  return highlightCode(rawLine, RUST);
}

function clampX(rawX) {
  const n = Math.round(Number(rawX));
  if (!Number.isFinite(n)) return 1;
  return Math.min(20, Math.max(1, n));
}

const messages = {
  enter(p) {
    return ["Chamando ", strong(`fat(${p.x})`)];
  },
  check(p) {
    return [
      "O computador está pensando: ",
      code("x == 1"),
      `? x vale ${p.x}. `,
      strong(p.isBase ? "Sim" : "Não"),
    ];
  },
  "base-return"() {
    return ["Caso-base: x == 1, retorna ", strong("1")];
  },
  "recurse-call"(p) {
    return [
      "Chama recursivamente ",
      code("fat(x - 1)"),
      ", ou seja ",
      strong(`fat(${p.x - 1})`),
      ", e espera o resultado",
    ];
  },
  combine(p) {
    return [
      "Multiplica ",
      code("x * sub_fat"),
      `: ${p.x} × ${p.sub} = `,
      strong(p.resultado),
    ];
  },
};

const EVENTS = {
  enter: { icon: "arrow_forward" },
  check: { icon: "check_circle" },
  "base-return": { icon: "keyboard_return" },
  "recurse-call": { icon: "call_split" },
  combine: { icon: "merge_type" },
};

/**
 * @param {{ x: number }} inputs
 * @returns {TraceResult}
 */
function buildTrace(inputs) {
  const x0 = clampX(inputs.x);
  const chain = [];
  for (let v = x0; v >= 1; v--) chain.push(v);

  /** @type {TraceStep[]} */
  const steps = [];
  let idCounter = 0;
  const callStack = [];
  let root = null;

  /** @returns {StackFrame[]} */
  function snapshotStack() {
    return callStack.map((f) => ({
      title: `fat(${f.x})`,
      depth: f.depth,
      vars: [
        { k: "x", v: String(f.x) },
        {
          k: "sub_fat",
          v: f.subFat === null ? null : String(f.subFat),
          status: f.subFat === null ? "pending" : "active",
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
  function elementsFor(currentX) {
    return chain.map((v, idx) => ({
      text: String(v),
      role: v === currentX ? "primary" : "secondary",
      status: "active",
      id: String(idx),
    }));
  }

  /**
   * @param {number} x
   * @param {number} depth
   * @param {TraceTreeNode | null} parentNode
   * @returns {number}
   */
  function rec(x, depth, parentNode) {
    const id = idCounter++;
    const frame = {
      id,
      x,
      depth,
      subFat: /** @type {number | null} */ (null),
      resultado: /** @type {number | null} */ (null),
    };
    const node = {
      id,
      x,
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
      elements: elementsFor(x),
      payload: { x },
    });

    const isBase = x === 1;
    steps.push({
      event: "check",
      phase: "DESCENDO",
      line: 2,
      depth,
      frameId: id,
      stack: snapshotStack(),
      elements: elementsFor(x),
      payload: { x, isBase },
    });

    let resultado;
    if (isBase) {
      resultado = 1;
      frame.resultado = resultado;
      node.resultado = resultado;
      steps.push({
        event: "base-return",
        phase: "DESCENDO",
        line: 3,
        depth,
        frameId: id,
        stack: snapshotStack(),
        elements: elementsFor(x),
        payload: {},
      });
    } else {
      steps.push({
        event: "recurse-call",
        phase: "DESCENDO",
        line: 5,
        depth,
        frameId: id,
        stack: snapshotStack(),
        elements: elementsFor(x),
        payload: { x },
      });

      const sub = rec(x - 1, depth + 1, node);
      frame.subFat = sub;
      resultado = x * sub;
      frame.resultado = resultado;
      node.resultado = resultado;

      steps.push({
        event: "combine",
        phase: "SUBINDO",
        line: 5,
        depth,
        frameId: id,
        stack: snapshotStack(),
        elements: elementsFor(x),
        payload: { x, sub, resultado },
      });
    }
    callStack.pop();
    return resultado;
  }

  rec(x0, 0, null);
  return { steps, tree: root };
}

/** @returns {ExpressionResult} */
function buildExpression(traceResult, stepIndex) {
  const { tree, steps } = traceResult;
  const isFinal = stepIndex === steps.length - 1;

  const resolvedIds = new Set();
  for (let k = 0; k <= stepIndex; k++) {
    const s = steps[k];
    if (s.event === "base-return" || s.event === "combine") {
      resolvedIds.add(s.frameId);
    }
  }

  function exprFor(node) {
    if (resolvedIds.has(node.id)) return String(node.resultado);
    if (node.x === 1) return `fat(1)`;
    return `(${node.x} × ${exprFor(node.children[0])})`;
  }

  const rhs = exprFor(tree);
  const lhs = `fat(${tree.x}) = `;
  return {
    nodes: [lhs, isFinal ? { type: "strong", text: rhs, final: true } : rhs],
  };
}

/** @type {Engine} */
export const ENGINE = {
  version: ENGINE_VERSION,

  meta: {
    title: "Fatorial recursivo",
    subtitle:
      "Visualizador passo a passo: pilha de chamadas, memória, expressão e narrativa. x é limitado entre 1 e 20 para a visualização ficar legível.",
  },

  input: {
    schema: [
      {
        key: "x",
        label: "x",
        type: "number",
        default: "5",
        placeholder: "5",
      },
    ],
  },

  code: {
    lines: CODE_LINES,
    highlight: highlightRust,
  },

  visualization: {
    legend: [
      { role: "primary", status: "current", label: "x do frame atual" },
      {
        role: "secondary",
        status: "current",
        label: "resto da cadeia x, x-1, ..., 1",
      },
    ],
  },

  events: EVENTS,

  buildTrace,
  buildExpression,
  messages,
};
