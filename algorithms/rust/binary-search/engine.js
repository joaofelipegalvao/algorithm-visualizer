import { strong, code, highlightCode } from "../../_shared/engine-kit.js";

const ENGINE_VERSION = 3;

/* ---------- Código-fonte exibido no painel (estático) ---------- */
const CODE_LINES = [
  "fn busca_binaria(lista: &[i32], alvo: i32) -> Option<usize> {",
  "    busca_binaria_com_offset(lista, alvo, 0)",
  "}",
  "",
  "fn busca_binaria_com_offset(lista: &[i32], alvo: i32, offset: usize) -> Option<usize> {",
  "    if lista.is_empty() {",
  "        return None;",
  "    }",
  "",
  "    let meio = lista.len() / 2;",
  "    if lista[meio] == alvo {",
  "        Some(offset + meio)",
  "    } else if lista[meio] < alvo {",
  "        busca_binaria_com_offset(&lista[meio + 1..], alvo, offset + meio + 1)",
  "    } else {",
  "        busca_binaria_com_offset(&lista[..meio], alvo, offset)",
  "    }",
  "}",
];

const RUST = {
  keywords: /\b(fn|if|else|let|return)\b/g,
  types: /\b(i32|usize|Option|Some|None)\b/g,
};
function highlightRust(rawLine) {
  return highlightCode(rawLine, RUST);
}

function formatResultado(resultado) {
  return resultado === null ? "None" : `Some(${resultado})`;
}

/* ---------- Catálogo de narrativas: evento -> payload -> nós ---------- */
const messages = {
  "wrapper-enter"(p) {
    return [
      "Chamando ",
      strong(`busca_binaria(&[${p.list.join(", ")}], ${p.alvo})`),
    ];
  },
  "wrapper-delegate"() {
    return [
      "A função-fachada delega para ",
      code("busca_binaria_com_offset(lista, alvo, 0)"),
      ", passando ",
      strong("offset = 0"),
    ];
  },
  enter(p) {
    return [
      "Chamando ",
      strong(
        `busca_binaria_com_offset(&[${p.list.join(", ")}], ${p.alvo}, ${p.offset})`,
      ),
    ];
  },
  "check-empty"(p) {
    return [
      "O computador está pensando: ",
      code("lista.is_empty()"),
      `? A lista tem ${p.list.length} elemento(s). `,
      strong(p.isEmpty ? "Sim" : "Não"),
    ];
  },
  "empty-return"() {
    return [
      "Caso-base: lista vazia, o alvo não está aqui. Retorna ",
      strong("None"),
    ];
  },
  "compute-mid"(p) {
    return [
      "Calcula ",
      code("meio = lista.len() / 2"),
      ` = ${p.meio}, o elemento do meio é `,
      strong(p.meioValor),
    ];
  },
  "check-match"(p) {
    return [
      "Compara ",
      code("lista[meio] == alvo"),
      `: ${p.meioValor} == ${p.alvo}? `,
      strong(p.isMatch ? "Sim" : "Não"),
    ];
  },
  "found-return"(p) {
    return [
      "Encontrado! Retorna ",
      code("Some(offset + meio)"),
      " = ",
      strong(formatResultado(p.resultado)),
    ];
  },
  "check-direction"(p) {
    return [
      "Não é igual. Compara ",
      code("lista[meio] < alvo"),
      `: ${p.meioValor} < ${p.alvo}? `,
      strong(p.goRight ? "Sim" : "Não"),
    ];
  },
  "recurse-right"(p) {
    return [
      "Alvo é maior — descarta a metade esquerda (e o meio) e chama ",
      code("busca_binaria_com_offset(&lista[meio+1..], alvo, offset+meio+1)"),
      ", ou seja ",
      strong(
        `busca_binaria_com_offset([${p.rest.join(", ")}], ${p.alvo}, ${p.newOffset})`,
      ),
    ];
  },
  "recurse-left"(p) {
    return [
      "Alvo é menor — descarta a metade direita (e o meio) e chama ",
      code("busca_binaria_com_offset(&lista[..meio], alvo, offset)"),
      ", ou seja ",
      strong(
        `busca_binaria_com_offset([${p.rest.join(", ")}], ${p.alvo}, ${p.newOffset})`,
      ),
    ];
  },
  propagate(p) {
    return [
      "Recursão em cauda: o resultado do filho é repassado direto, sem combinar com nada. Retorna ",
      strong(formatResultado(p.resultado)),
    ];
  },
};

const EVENTS = {
  "wrapper-enter": { icon: "arrow_forward" },
  "wrapper-delegate": { icon: "call_split" },
  enter: { icon: "arrow_forward" },
  "check-empty": { icon: "check_circle" },
  "empty-return": { icon: "keyboard_return" },
  "compute-mid": { icon: "calculate" },
  "check-match": { icon: "check_circle" },
  "found-return": { icon: "adjust" },
  "check-direction": { icon: "compare_arrows" },
  "recurse-right": { icon: "call_split" },
  "recurse-left": { icon: "call_split" },
  propagate: { icon: "keyboard_return" },
};

/**
 * @param {{ lista: number[], alvo: number }} inputs
 * @returns {TraceResult}
 */
function buildTrace(inputs) {
  const inputList = inputs.lista;
  const alvo = inputs.alvo;
  /** @type {TraceStep[]} */
  const steps = [];
  let idCounter = 0;
  const callStack = [];
  let root = null;

  /** @returns {StackFrame[]} */
  function snapshotStack() {
    return callStack.map((f) => ({
      title: `busca_binaria_com_offset([${f.list.join(", ")}], ${alvo}, ${f.offset})`,
      depth: f.depth,
      vars: [
        { k: "lista", v: `[${f.list.join(", ")}]` },
        { k: "offset", v: String(f.offset) },
        {
          k: "meio",
          v: f.meio === null ? null : String(f.meio),
          status: f.meio === null ? "pending" : "active",
        },
        {
          k: "resultado",
          v: f.resultado === undefined ? null : formatResultado(f.resultado),
          status: f.resultado === undefined ? "pending" : "resolved",
        },
      ],
    }));
  }

  function elementsFor(list, meioIdx) {
    return list.map((v, idx) => ({
      text: String(v),
      role: idx === meioIdx ? "primary" : "secondary",
      status: "active",
      id: String(idx),
    }));
  }

  steps.push({
    event: "wrapper-enter",
    phase: "DESCENDO",
    line: 1,
    depth: null,
    frameId: null,
    stack: [],
    elements: elementsFor(inputList, -1),
    payload: { list: inputList, alvo },
  });
  steps.push({
    event: "wrapper-delegate",
    phase: "DESCENDO",
    line: 2,
    depth: null,
    frameId: null,
    stack: [],
    elements: elementsFor(inputList, -1),
    payload: { list: inputList, alvo },
  });

  /**
   * @param {number[]} list
   * @param {number} offset
   * @param {number} depth
   * @param {TraceTreeNode | null} parentNode
   * @returns {number | null}
   */
  function rec(list, offset, depth, parentNode) {
    const id = idCounter++;
    const frame = {
      id,
      list: [...list],
      offset,
      depth,
      meio: /** @type {number | null} */ (null),
      resultado: /** @type {number | null | undefined} */ (undefined),
    };
    const node = {
      id,
      list: [...list],
      offset,
      depth,
      resultado: /** @type {number | null | undefined} */ (undefined),
      children: [],
    };
    if (parentNode) parentNode.children.push(node);
    else root = node;
    callStack.push(frame);

    steps.push({
      event: "enter",
      phase: "DESCENDO",
      line: 5,
      depth,
      frameId: id,
      stack: snapshotStack(),
      elements: elementsFor(list, -1),
      payload: { list, offset, alvo },
    });

    const isEmpty = list.length === 0;
    steps.push({
      event: "check-empty",
      phase: "DESCENDO",
      line: 6,
      depth,
      frameId: id,
      stack: snapshotStack(),
      elements: elementsFor(list, -1),
      payload: { list, isEmpty },
    });

    let resultado;
    if (isEmpty) {
      resultado = null;
      frame.resultado = resultado;
      node.resultado = resultado;
      steps.push({
        event: "empty-return",
        phase: "DESCENDO",
        line: 7,
        depth,
        frameId: id,
        stack: snapshotStack(),
        elements: elementsFor(list, -1),
        payload: {},
      });
    } else {
      const meio = Math.floor(list.length / 2);
      frame.meio = meio;
      steps.push({
        event: "compute-mid",
        phase: "DESCENDO",
        line: 10,
        depth,
        frameId: id,
        stack: snapshotStack(),
        elements: elementsFor(list, meio),
        payload: { meio, meioValor: list[meio] },
      });

      const isMatch = list[meio] === alvo;
      steps.push({
        event: "check-match",
        phase: "DESCENDO",
        line: 11,
        depth,
        frameId: id,
        stack: snapshotStack(),
        elements: elementsFor(list, meio),
        payload: { meioValor: list[meio], alvo, isMatch },
      });

      if (isMatch) {
        resultado = offset + meio;
        frame.resultado = resultado;
        node.resultado = resultado;
        steps.push({
          event: "found-return",
          phase: "DESCENDO",
          line: 12,
          depth,
          frameId: id,
          stack: snapshotStack(),
          elements: elementsFor(list, meio),
          payload: { resultado },
        });
      } else {
        const goRight = list[meio] < alvo;
        steps.push({
          event: "check-direction",
          phase: "DESCENDO",
          line: 13,
          depth,
          frameId: id,
          stack: snapshotStack(),
          elements: elementsFor(list, meio),
          payload: { meioValor: list[meio], alvo, goRight },
        });

        let rest, newOffset;
        if (goRight) {
          rest = list.slice(meio + 1);
          newOffset = offset + meio + 1;
          steps.push({
            event: "recurse-right",
            phase: "DESCENDO",
            line: 14,
            depth,
            frameId: id,
            stack: snapshotStack(),
            elements: elementsFor(list, meio),
            payload: { rest, alvo, newOffset },
          });
        } else {
          rest = list.slice(0, meio);
          newOffset = offset;
          steps.push({
            event: "recurse-left",
            phase: "DESCENDO",
            line: 16,
            depth,
            frameId: id,
            stack: snapshotStack(),
            elements: elementsFor(list, meio),
            payload: { rest, alvo, newOffset },
          });
        }

        resultado = rec(rest, newOffset, depth + 1, node);
        frame.resultado = resultado;
        node.resultado = resultado;

        steps.push({
          event: "propagate",
          phase: "SUBINDO",
          line: goRight ? 14 : 16,
          depth,
          frameId: id,
          stack: snapshotStack(),
          elements: elementsFor(list, meio),
          payload: { resultado },
        });
      }
    }
    callStack.pop();
    return resultado;
  }

  rec(inputList, 0, 0, null);
  return { steps, tree: root };
}

/** @returns {ExpressionResult} */
function buildExpression(traceResult, stepIndex) {
  const { tree, steps } = traceResult;
  const isFinal = stepIndex === steps.length - 1;

  const resolvedIds = new Set();
  for (let k = 0; k <= stepIndex; k++) {
    const s = steps[k];
    if (
      s.event === "empty-return" ||
      s.event === "found-return" ||
      s.event === "propagate"
    ) {
      resolvedIds.add(s.frameId);
    }
  }

  function exprFor(node) {
    if (resolvedIds.has(node.id)) return formatResultado(node.resultado);

    if (node.children.length > 0) return exprFor(node.children[0]);
    return `busca_binaria_com_offset([${node.list.join(", ")}], alvo, ${node.offset})`;
  }

  const rhs = tree ? exprFor(tree) : "…";
  const lhs = `busca_binaria([${tree ? tree.list.join(", ") : ""}], alvo) = `;
  return {
    nodes: [lhs, isFinal ? { type: "strong", text: rhs, final: true } : rhs],
  };
}

/** @type {Engine} */
export const ENGINE = {
  version: ENGINE_VERSION,

  meta: {
    title: "Busca binária recursiva (com offset)",
    subtitle:
      "Visualizador passo a passo: pilha de chamadas, memória, expressão e narrativa. A lista deve estar ordenada de forma crescente.",
  },

  input: {
    schema: [
      {
        key: "lista",
        label: "Lista (ordenada)",
        type: "number-list",
        minItems: 1,
        maxItems: 15,
        default: "1, 3, 5, 7, 9, 11, 13, 15, 17",
        placeholder: "1, 3, 5, 7, 9, 11, 13, 15, 17",
      },
      {
        key: "alvo",
        label: "Alvo",
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
      {
        role: "primary",
        status: "current",
        label: "Elemento do meio (comparado)",
      },
      { role: "secondary", status: "current", label: "Resto da lista" },
    ],
  },

  events: EVENTS,

  buildTrace,
  buildExpression,
  messages,
};
