import { strong, code, highlightCode } from "../../_shared/engine-kit.js";

const ENGINE_VERSION = 3;

/* ---------- Código-fonte exibido no painel (estático) ---------- */
const CODE_LINES = [
  "fn quicksort(lista: &mut Vec<i32>) {",
  "    let fim = lista.len() as isize - 1;",
  "    quicksort_rec(lista, 0, fim);",
  "}",
  "",
  "fn quicksort_rec(lista: &mut Vec<i32>, baixo: isize, alto: isize) {",
  "    if baixo < alto {",
  "        let p = particionar(lista, baixo, alto);",
  "        quicksort_rec(lista, baixo, p - 1);",
  "        quicksort_rec(lista, p + 1, alto);",
  "    }",
  "}",
  "",
  "fn particionar(lista: &mut Vec<i32>, baixo: isize, alto: isize) -> isize {",
  "    let pivo = lista[alto as usize];",
  "    let mut i = baixo - 1;",
  "    for j in baixo..alto {",
  "        if lista[j as usize] <= pivo {",
  "            i += 1;",
  "            lista.swap(i as usize, j as usize);",
  "        }",
  "    }",
  "    lista.swap((i + 1) as usize, alto as usize);",
  "    i + 1",
  "}",
];

const RUST = {
  keywords: /\b(fn|if|let|mut|for|in|return)\b/g,
  types: /\b(i32|usize|isize|Vec)\b/g,
};
function highlightRust(rawLine) {
  return highlightCode(rawLine, RUST);
}

/* ---------- Catálogo de narrativas: evento -> payload -> nós ---------- */
const messages = {
  "wrapper-enter"(p) {
    return ["Chamando ", strong(`quicksort([${p.list.join(", ")}])`)];
  },
  "wrapper-delegate"(p) {
    return [
      "A função-fachada delega para ",
      code("quicksort_rec(lista, 0, fim)"),
      ", com ",
      strong(`fim = ${p.fim}`),
    ];
  },
  enter(p) {
    return [
      "Chamando ",
      strong(`quicksort_rec(lista, ${p.baixo}, ${p.alto})`),
    ];
  },
  "check-base"(p) {
    return [
      "O computador está pensando: ",
      code("baixo < alto"),
      `? ${p.baixo} < ${p.alto}. `,
      strong(p.isBase ? "Não" : "Sim"),
    ];
  },
  "base-case"(p) {
    return [
      "Caso-base: sub-lista com 0 ou 1 elemento (",
      code(`baixo=${p.baixo}, alto=${p.alto}`),
      "), já está ordenada. Nada a fazer.",
    ];
  },
  "pick-pivot"(p) {
    return [
      "Escolhe o pivô: ",
      code("pivo = lista[alto]"),
      " = ",
      strong(p.pivo),
    ];
  },
  "init-i"(p) {
    return ["Inicializa ", code("i = baixo - 1"), " = ", strong(p.i)];
  },
  compare(p) {
    return [
      "Compara ",
      code("lista[j] <= pivo"),
      `: ${p.valorJ} <= ${p.pivo}? `,
      strong(p.menorOuIgual ? "Sim" : "Não"),
    ];
  },
  swap(p) {
    return [
      "Incrementa ",
      code("i"),
      ` para ${p.i} e troca `,
      code("lista.swap(i, j)"),
      `: posições ${p.i} e ${p.j} (valores ${p.valorAnteriorI} ↔ ${p.valorJ})`,
    ];
  },
  "no-swap"(p) {
    return [
      `Elemento ${p.valorJ} é maior que o pivô ${p.pivo} — fica do lado direito. `,
      code("j"),
      " avança.",
    ];
  },
  "place-pivot"(p) {
    return [
      "Posiciona o pivô no lugar certo: ",
      code("lista.swap(i + 1, alto)"),
      `: troca o pivô (${p.pivo}) com o valor ${p.valorTrocado} na posição ${p.posPivoFinal}`,
    ];
  },
  "partition-return"(p) {
    return ["Partição concluída. Retorna ", code("i + 1"), " = ", strong(p.p)];
  },
  "recurse-left"(p) {
    return [
      "Chama ",
      code("quicksort_rec(lista, baixo, p - 1)"),
      ", ordenando a metade menor que o pivô",
    ];
  },
  "post-left"() {
    return [strong("quicksort_rec"), " da metade esquerda retornou"];
  },
  "recurse-right"(p) {
    return [
      "Chama ",
      code("quicksort_rec(lista, p + 1, alto)"),
      ", ordenando a metade maior que o pivô",
    ];
  },
  "post-right"() {
    return [
      strong("quicksort_rec"),
      " da metade direita retornou — este frame está pronto",
    ];
  },
};

const EVENTS = {
  "wrapper-enter": { icon: "arrow_forward" },
  "wrapper-delegate": { icon: "call_split" },
  enter: { icon: "arrow_forward" },
  "check-base": { icon: "check_circle" },
  "base-case": { icon: "keyboard_return" },
  "pick-pivot": { icon: "push_pin" },
  "init-i": { icon: "calculate" },
  compare: { icon: "compare_arrows" },
  swap: { icon: "swap_horiz" },
  "no-swap": { icon: "arrow_forward" },
  "place-pivot": { icon: "adjust" },
  "partition-return": { icon: "keyboard_return" },
  "recurse-left": { icon: "call_split" },
  "post-left": { icon: "keyboard_return" },
  "recurse-right": { icon: "call_split" },
  "post-right": { icon: "keyboard_return" },
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

  // Estado real do array, mutado in-place pelos swaps -- ao contrário da
  // busca binária (que fatia um novo sub-vetor a cada chamada), o
  // Quicksort opera sobre o mesmo array do início ao fim. `id` é
  // atribuído uma vez, na criação, e viaja com o valor através dos swaps
  // (identidade segue o elemento, não o slot) -- essa é a escolha que
  // pressiona a hipótese registrada no ENGINE.md sobre `TraceElement.id`.
  const arrState = inputList.map((v, idx) => ({ value: v, id: String(idx) }));

  /**
   * @param {number[]} focus - índices em foco no passo atual (role: "primary")
   * @returns {TraceElement[]}
   */
  function elementsFor(focus) {
    const focusSet = new Set(focus);
    return arrState.map((cell, idx) => ({
      text: String(cell.value),
      role: focusSet.has(idx) ? "primary" : "secondary",
      status: "active",
      id: cell.id,
    }));
  }

  /** @returns {StackFrame[]} */
  function snapshotStack() {
    return callStack.map((f) => ({
      title: `quicksort_rec(lista, ${f.baixo}, ${f.alto})`,
      depth: f.depth,
      vars: [
        { k: "baixo", v: String(f.baixo) },
        { k: "alto", v: String(f.alto) },
        {
          k: "pivo",
          v: f.pivo === null ? null : String(f.pivo),
          status: f.pivo === null ? "pending" : "active",
        },
        {
          k: "i",
          v: f.i === null ? null : String(f.i),
          status: f.i === null ? "pending" : "active",
        },
        {
          k: "p",
          v: f.p === null ? null : String(f.p),
          status: f.p === null ? "pending" : "resolved",
        },
      ],
    }));
  }

  const fim = inputList.length - 1;

  steps.push({
    event: "wrapper-enter",
    phase: "DESCENDO",
    line: 1,
    depth: null,
    frameId: null,
    stack: [],
    elements: elementsFor([]),
    payload: { list: inputList },
  });
  steps.push({
    event: "wrapper-delegate",
    phase: "DESCENDO",
    line: 3,
    depth: null,
    frameId: null,
    stack: [],
    elements: elementsFor([]),
    payload: { fim },
  });

  /**
   * @param {number} baixo
   * @param {number} alto
   * @param {any} frame
   * @param {number} depth
   * @returns {number}
   */
  function particionar(baixo, alto, frame, depth) {
    const pivo = arrState[alto].value;
    frame.pivo = pivo;
    steps.push({
      event: "pick-pivot",
      phase: "DESCENDO",
      line: 14,
      depth,
      frameId: frame.id,
      stack: snapshotStack(),
      elements: elementsFor([alto]),
      payload: { pivo, alto },
    });

    let i = baixo - 1;
    frame.i = i;
    steps.push({
      event: "init-i",
      phase: "DESCENDO",
      line: 15,
      depth,
      frameId: frame.id,
      stack: snapshotStack(),
      elements: elementsFor([alto]),
      payload: { i },
    });

    for (let j = baixo; j < alto; j++) {
      const valorJ = arrState[j].value;
      const menorOuIgual = valorJ <= pivo;
      steps.push({
        event: "compare",
        phase: "DESCENDO",
        line: 17,
        depth,
        frameId: frame.id,
        stack: snapshotStack(),
        elements: elementsFor([j, alto]),
        payload: { j, valorJ, pivo, menorOuIgual },
      });

      if (menorOuIgual) {
        i += 1;
        frame.i = i;
        const valorAnteriorI = arrState[i].value;
        [arrState[i], arrState[j]] = [arrState[j], arrState[i]];
        steps.push({
          event: "swap",
          phase: "DESCENDO",
          line: 19,
          depth,
          frameId: frame.id,
          stack: snapshotStack(),
          elements: elementsFor([i, j]),
          payload: { i, j, valorAnteriorI, valorJ },
        });
      } else {
        steps.push({
          event: "no-swap",
          phase: "DESCENDO",
          line: 17,
          depth,
          frameId: frame.id,
          stack: snapshotStack(),
          elements: elementsFor([j]),
          payload: { j, valorJ, pivo },
        });
      }
    }

    const posPivoFinal = i + 1;
    const valorTrocado = arrState[posPivoFinal].value;
    [arrState[posPivoFinal], arrState[alto]] = [
      arrState[alto],
      arrState[posPivoFinal],
    ];
    steps.push({
      event: "place-pivot",
      phase: "DESCENDO",
      line: 22,
      depth,
      frameId: frame.id,
      stack: snapshotStack(),
      elements: elementsFor([posPivoFinal, alto]),
      payload: { posPivoFinal, pivo, valorTrocado },
    });

    frame.p = posPivoFinal;
    steps.push({
      event: "partition-return",
      phase: "DESCENDO",
      line: 23,
      depth,
      frameId: frame.id,
      stack: snapshotStack(),
      elements: elementsFor([posPivoFinal]),
      payload: { p: posPivoFinal },
    });

    return posPivoFinal;
  }

  /**
   * @param {number} baixo
   * @param {number} alto
   * @param {number} depth
   * @param {TraceTreeNode | null} parentNode
   */
  function rec(baixo, alto, depth, parentNode) {
    const id = idCounter++;
    const frame = {
      id,
      baixo,
      alto,
      depth,
      pivo: /** @type {number | null} */ (null),
      i: /** @type {number | null} */ (null),
      p: /** @type {number | null} */ (null),
    };
    const node = { id, baixo, alto, depth, children: [] };
    if (parentNode) parentNode.children.push(node);
    else root = node;
    callStack.push(frame);

    steps.push({
      event: "enter",
      phase: "DESCENDO",
      line: 6,
      depth,
      frameId: id,
      stack: snapshotStack(),
      elements: elementsFor([]),
      payload: { baixo, alto },
    });

    const isBase = !(baixo < alto);
    steps.push({
      event: "check-base",
      phase: "DESCENDO",
      line: 7,
      depth,
      frameId: id,
      stack: snapshotStack(),
      elements: elementsFor([]),
      payload: { baixo, alto, isBase },
    });

    if (isBase) {
      steps.push({
        event: "base-case",
        phase: "DESCENDO",
        line: 7,
        depth,
        frameId: id,
        stack: snapshotStack(),
        elements: elementsFor(baixo === alto ? [baixo] : []),
        payload: { baixo, alto },
      });
    } else {
      const p = particionar(baixo, alto, frame, depth);

      steps.push({
        event: "recurse-left",
        phase: "DESCENDO",
        line: 9,
        depth,
        frameId: id,
        stack: snapshotStack(),
        elements: elementsFor([p]),
        payload: { baixo, p },
      });
      rec(baixo, p - 1, depth + 1, node);
      steps.push({
        event: "post-left",
        phase: "SUBINDO",
        line: 9,
        depth,
        frameId: id,
        stack: snapshotStack(),
        elements: elementsFor([p]),
        payload: {},
      });

      steps.push({
        event: "recurse-right",
        phase: "DESCENDO",
        line: 10,
        depth,
        frameId: id,
        stack: snapshotStack(),
        elements: elementsFor([p]),
        payload: { p, alto },
      });
      rec(p + 1, alto, depth + 1, node);
      steps.push({
        event: "post-right",
        phase: "SUBINDO",
        line: 10,
        depth,
        frameId: id,
        stack: snapshotStack(),
        elements: elementsFor([p]),
        payload: {},
      });
    }

    callStack.pop();
  }

  rec(0, fim, 0, null);
  return { steps, tree: root };
}

/** @returns {ExpressionResult} */
function buildExpression(traceResult, stepIndex) {
  const { steps } = traceResult;
  const isFinal = stepIndex === steps.length - 1;

  // Diferente dos engines recursivos com valor de retorno: quicksort_rec
  // não retorna nada (ordena in-place), então não há árvore de
  // sub-expressões para combinar. O "resultado parcial" é simplesmente
  // o estado atual do array -- que já evolui a cada swap, e é
  // exatamente o efeito que estamos testando (movimentação de
  // elementos como o próprio veículo de representação, sem precisar de
  // um canal visual novo).
  const original = steps[0].elements.map((e) => e.text);
  const atual = steps[stepIndex].elements.map((e) => e.text);

  const lhs = `quicksort([${original.join(", ")}]) = `;
  const rhs = `[${atual.join(", ")}]`;
  return {
    nodes: [lhs, isFinal ? { type: "strong", text: rhs, final: true } : rhs],
  };
}

/** @type {Engine} */
export const ENGINE = {
  version: ENGINE_VERSION,

  meta: {
    title: "Quicksort (partição de Lomuto)",
    subtitle:
      "Visualizador passo a passo: pivô = último elemento, partição in-place, recursão nas duas metades.",
  },

  input: {
    schema: [
      {
        key: "lista",
        label: "Lista",
        type: "number-list",
        minItems: 2,
        maxItems: 12,
        default: "8, 3, 5, 4, 7, 6, 1, 2",
        placeholder: "8, 3, 5, 4, 7, 6, 1, 2",
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
        label: "Elemento(s) em foco no passo atual",
      },
      { role: "secondary", status: "current", label: "Resto da lista" },
    ],
  },

  events: EVENTS,

  buildTrace,
  buildExpression,
  messages,
};
