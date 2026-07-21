import {
  strong,
  code,
  highlightCode,
  elementsForHeadTail,
} from "../../_shared/engine-kit.js";

const ENGINE_VERSION = 3;

const CODE_LINES = [
  "fn conta(lista: &[i32]) -> i32 {",
  "    if lista.is_empty() {",
  "        0",
  "    } else {",
  "        1 + conta(&lista[1..])",
  "    }",
  "}",
];

const RUST = {
  keywords: /\b(fn|if|else)\b/g,
  types: /\b(i32|usize)\b/g,
};
function highlightRust(rawLine) {
  return highlightCode(rawLine, RUST);
}

const messages = {
  enter(p) {
    return ["Chamando ", strong(`conta(&[${p.list.join(", ")}])`)];
  },
  check(p) {
    return [
      "O computador está pensando: ",
      code("lista.is_empty()"),
      `? A lista tem ${p.list.length} elemento(s). `,
      strong(p.isEmpty ? "Sim" : "Não"),
    ];
  },
  "base-return"() {
    return [
      "Caso-base: lista vazia, não há mais nada para contar. Retorna ",
      strong("0"),
    ];
  },
  "recurse-call"(p) {
    return [
      "Chama recursivamente ",
      code("conta(&lista[1..])"),
      ", ou seja ",
      strong(`conta([${p.rest.join(", ")}])`),
      ", e espera o resultado",
    ];
  },
  combine(p) {
    return [
      "Conta o elemento atual + o resto: ",
      code("1 + sub_conta"),
      `: 1 + ${p.sub} = `,
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
 * @param {{ lista: number[] }} inputs
 * @returns {TraceResult}
 */
function buildTrace(inputs) {
  const inputList = inputs.lista;
  /** @type {TraceStep[]} */
  const steps = [];
  let idCounter = 0;
  const callStack = [];
  let root = null;

  /** @returns {StackFrame[]} */
  function snapshotStack() {
    return callStack.map((f) => ({
      title: `conta([${f.list.join(", ")}])`,
      depth: f.depth,
      vars: [
        { k: "lista", v: `[${f.list.join(", ")}]` },
        { k: "resto", v: `[${f.list.slice(1).join(", ")}]` },
        {
          k: "sub_conta",
          v: f.subConta === null ? null : String(f.subConta),
          status: f.subConta === null ? "pending" : "active",
        },
        {
          k: "resultado",
          v: f.resultado === null ? null : String(f.resultado),
          status: f.resultado === null ? "pending" : "resolved",
        },
      ],
    }));
  }

  const elementsFor = elementsForHeadTail;

  /**
   * @param {number[]} list
   * @param {number} depth
   * @param {TraceTreeNode | null} parentNode
   * @returns {number}
   */
  function rec(list, depth, parentNode) {
    const id = idCounter++;
    const frame = {
      id,
      list: [...list],
      depth,
      subConta: /** @type {number | null} */ (null),
      resultado: /** @type {number | null} */ (null),
    };
    const node = {
      id,
      list: [...list],
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
      elements: elementsFor(list),
      payload: { list },
    });

    const isEmpty = list.length === 0;
    steps.push({
      event: "check",
      phase: "DESCENDO",
      line: 2,
      depth,
      frameId: id,
      stack: snapshotStack(),
      elements: elementsFor(list),
      payload: { list, isEmpty },
    });

    let resultado;
    if (isEmpty) {
      resultado = 0;
      frame.resultado = resultado;
      node.resultado = resultado;
      steps.push({
        event: "base-return",
        phase: "DESCENDO",
        line: 3,
        depth,
        frameId: id,
        stack: snapshotStack(),
        elements: elementsFor(list),
        payload: {},
      });
    } else {
      const rest = list.slice(1);
      steps.push({
        event: "recurse-call",
        phase: "DESCENDO",
        line: 5,
        depth,
        frameId: id,
        stack: snapshotStack(),
        elements: elementsFor(list),
        payload: { rest },
      });

      const sub = rec(rest, depth + 1, node);
      frame.subConta = sub;
      resultado = 1 + sub;
      frame.resultado = resultado;
      node.resultado = resultado;

      steps.push({
        event: "combine",
        phase: "SUBINDO",
        line: 5,
        depth,
        frameId: id,
        stack: snapshotStack(),
        elements: elementsFor(list),
        payload: { sub, resultado },
      });
    }
    callStack.pop();
    return resultado;
  }

  rec(inputList, 0, null);
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
    if (node.list.length === 0) return `conta([])`;
    return `(1 + ${exprFor(node.children[0])})`;
  }

  const rhs = exprFor(tree);
  const lhs = `conta([${tree.list.join(", ")}]) = `;
  return {
    nodes: [lhs, isFinal ? { type: "strong", text: rhs, final: true } : rhs],
  };
}

/** @type {Engine} */
export const ENGINE = {
  version: ENGINE_VERSION,

  meta: {
    title: "Conta recursiva de uma lista",
    subtitle:
      "Visualizador passo a passo: pilha de chamadas, memória, expressão e narrativa.",
  },

  input: {
    schema: [
      {
        key: "lista",
        label: "Lista",
        type: "number-list",
        minItems: 1,
        maxItems: 10,
        default: "2, 4, 6, 8",
        placeholder: "2, 4, 6, 8",
      },
    ],
  },

  code: {
    lines: CODE_LINES,
    highlight: highlightRust,
  },

  visualization: {
    legend: [
      {
        role: "primary",
        status: "current",
        label: "Elemento atual (só a posição importa)",
      },
      { role: "secondary", status: "current", label: "Resto da lista" },
    ],
  },

  events: EVENTS,

  buildTrace,
  buildExpression,
  messages,
};
