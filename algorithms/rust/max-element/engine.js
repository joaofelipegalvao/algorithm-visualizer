import {
  strong,
  code,
  highlightCode,
  elementsForHeadTail,
} from "../../_shared/engine-kit.js";

const ENGINE_VERSION = 3;

const CODE_LINES = [
  "fn maior(lista: &[i32]) -> i32 {",
  "    if lista.len() == 1 {",
  "        lista[0]",
  "    } else {",
  "        let sub_maior = maior(&lista[1..]);",
  "        if lista[0] > sub_maior {",
  "            lista[0]",
  "        } else {",
  "            sub_maior",
  "        }",
  "    }",
  "}",
];

const RUST = {
  keywords: /\b(fn|if|else|let|return)\b/g,
  types: /\b(i32|bool|usize)\b/g,
};
function highlightRust(rawLine) {
  return highlightCode(rawLine, RUST);
}

const messages = {
  enter(p) {
    return ["Chamando ", strong(`maior(&[${p.list.join(", ")}])`)];
  },
  check(p) {
    return [
      "O computador está pensando: ",
      code("lista.len() == 1"),
      `? A lista tem ${p.list.length} elemento(s). `,
      strong(p.isOne ? "Sim" : "Não"),
    ];
  },
  "base-return"(p) {
    return [
      "Caso-base atingido: retorna ",
      code("lista[0]"),
      " = ",
      strong(p.resultado),
    ];
  },
  "recurse-call"(p) {
    return [
      "Chama recursivamente ",
      code("maior(&lista[1..])"),
      ", ou seja ",
      strong(`maior([${p.rest.join(", ")}])`),
      ", e espera o resultado",
    ];
  },
  compare(p) {
    return [
      "sub_maior = ",
      strong(p.sub),
      ". Compara ",
      code("lista[0] > sub_maior"),
      `: ${p.first} > ${p.sub}? `,
      strong(p.branchTrue ? "Sim" : "Não"),
    ];
  },
  "return-true"(p) {
    return [
      "Ramo ",
      code("if"),
      ` verdadeiro: lista[0] (${p.first}) é maior. Retorna `,
      strong(p.resultado),
    ];
  },
  "return-false"(p) {
    return [
      "Ramo ",
      code("else"),
      `: sub_maior (${p.sub}) é maior ou igual. Retorna `,
      strong(p.resultado),
    ];
  },
};

const EVENTS = {
  enter: { icon: "arrow_forward" },
  check: { icon: "check_circle" },
  "base-return": { icon: "keyboard_return" },
  "recurse-call": { icon: "call_split" },
  compare: { icon: "check_circle" },
  "return-true": { icon: "merge_type" },
  "return-false": { icon: "merge_type" },
};

/**
 * @param {{ lista: number[] }} inputs
 * @returns {TraceResult}
 */
function buildTrace(inputs) {
  const inputList = inputs.lista;
  const steps = [];
  let idCounter = 0;
  const callStack = [];
  let root = null;

  /** @returns {StackFrame[]} */
  function snapshotStack() {
    return callStack.map((f) => ({
      title: `maior([${f.list.join(", ")}])`,
      depth: f.depth,
      vars: [
        { k: "lista", v: `[${f.list.join(", ")}]` },
        { k: "primeiro", v: String(f.list[0]) },
        { k: "resto", v: `[${f.list.slice(1).join(", ")}]` },
        {
          k: "sub_maior",
          v: f.subMaior === null ? null : String(f.subMaior),
          status: f.subMaior === null ? "pending" : "active",
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

  // TESTE TEMPORÁRIO — remover depois
  // escapeHtmlDefinitelyNotReal("test");

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
      subMaior: /** @type {number | null} */ (null),
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

    const isOne = list.length === 1;
    steps.push({
      event: "check",
      phase: "DESCENDO",
      line: 2,
      depth,
      frameId: id,
      stack: snapshotStack(),
      elements: elementsFor(list),
      payload: { list, isOne },
    });

    let resultado;
    if (isOne) {
      resultado = list[0];
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
        payload: { resultado },
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
      frame.subMaior = sub;
      const branchTrue = list[0] > sub;

      steps.push({
        event: "compare",
        phase: "SUBINDO",
        line: 6,
        depth,
        frameId: id,
        stack: snapshotStack(),
        elements: elementsFor(list),
        payload: { first: list[0], sub, branchTrue },
      });

      resultado = branchTrue ? list[0] : sub;
      frame.resultado = resultado;
      node.resultado = resultado;

      steps.push({
        event: branchTrue ? "return-true" : "return-false",
        phase: "SUBINDO",
        line: branchTrue ? 7 : 9,
        depth,
        frameId: id,
        stack: snapshotStack(),
        elements: elementsFor(list),
        payload: { first: list[0], sub, resultado },
      });
    }
    callStack.pop();
    return resultado;
  }

  rec(inputList, 0, null);
  return { steps, tree: root };
}

function buildExpression(traceResult, stepIndex) {
  const { tree, steps } = traceResult;
  const isFinal = stepIndex === steps.length - 1;

  const resolvedIds = new Set();
  for (let k = 0; k <= stepIndex; k++) {
    const s = steps[k];
    if (
      s.event === "base-return" ||
      s.event === "return-true" ||
      s.event === "return-false"
    ) {
      resolvedIds.add(s.frameId);
    }
  }

  function exprFor(node) {
    if (resolvedIds.has(node.id)) return String(node.resultado);
    if (node.list.length === 1) return `maior([${node.list.join(", ")}])`;
    return `max(${node.list[0]}, ${exprFor(node.children[0])})`;
  }

  const rhs = exprFor(tree);
  const lhs = `maior([${tree.list.join(", ")}]) = `;
  return {
    nodes: [lhs, isFinal ? { type: "strong", text: rhs, final: true } : rhs],
  };
}
/** @type {Engine} */
export const ENGINE = {
  version: ENGINE_VERSION,
  meta: {
    title: "Encontrar o maior (Recursão)",
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
        maxItems: 9,
        default: "3, 7, 2, 9, 4",
        placeholder: "3, 7, 2, 9, 4",
      },
    ],
  },
  code: {
    lines: CODE_LINES,
    highlight: highlightRust,
  },
  visualization: {
    legend: [
      { role: "primary", status: "current", label: "Primeiro elemento" },
      { role: "secondary", status: "current", label: "Resto da lista" },
    ],
  },
  events: EVENTS,
  buildTrace,
  buildExpression,
  messages,
};
