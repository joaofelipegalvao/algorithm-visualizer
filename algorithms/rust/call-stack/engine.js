import { strong, code, highlightCode } from "../../_shared/engine-kit.js";

const ENGINE_VERSION = 3;

const CODE_LINES = [
  "fn saudacao(nome: &str) {",
  '    println!("Olá, {}!", nome);',
  "    saudacao2(nome);",
  '    println!("preparando para dizer tchau...");',
  "    tchau();",
  "}",
  "",
  "fn saudacao2(nome: &str) {",
  '    println!("Como vai {}?", nome);',
  "}",
  "",
  "fn tchau() {",
  '    println!("Ok, tchau!");',
  "}",
];

const RUST = {
  keywords: /\b(fn)\b/g,
  macros: /println!/g,
};
function highlightRust(rawLine) {
  return highlightCode(rawLine, RUST);
}

const messages = {
  enter(p) {
    const args = p.nome !== undefined ? `"${p.nome}"` : "";
    return ["Chamando ", strong(`${p.fn}(${args})`)];
  },
  print(p) {
    return [
      "Executa ",
      code("println!(...)"),
      " e imprime: ",
      strong(`"${p.text}"`),
    ];
  },
  call(p) {
    return [
      "Chama ",
      strong(`${p.callee}(${p.args})`),
      " e espera essa chamada terminar antes de continuar",
    ];
  },
  return(p) {
    return [
      strong(p.fn),
      " terminou. A pilha desempilha este frame e a execução volta pra quem chamou.",
    ];
  },
};

const EVENTS = {
  enter: { icon: "arrow_forward" },
  print: { icon: "print" },
  call: { icon: "call_split" },
  return: { icon: "keyboard_return" },
};

/**
 * @param {{ nome: string }} inputs
 * @returns {TraceResult}
 */
function buildTrace(inputs) {
  const nome = inputs.nome;
  const steps = [];
  const callStack = [];

  function snapshotStack() {
    return callStack.map((f) => ({
      title: f.title,
      depth: f.depth,
      vars: f.vars,
    }));
  }

  function elementsFor(showNome) {
    return showNome ? [{ text: nome, role: "primary", status: "current" }] : [];
  }

  function pushFrame(title, depth, vars) {
    callStack.push({ title, depth, vars });
  }
  function popFrame() {
    callStack.pop();
  }

  function runTchau(depth) {
    pushFrame("tchau()", depth, []);
    steps.push({
      event: "enter",
      phase: "DESCENDO",
      line: 12,
      stack: snapshotStack(),
      elements: elementsFor(false),
      payload: { fn: "tchau" },
    });
    steps.push({
      event: "print",
      phase: "DESCENDO",
      line: 13,
      stack: snapshotStack(),
      elements: elementsFor(false),
      payload: { fn: "tchau", text: "Ok, tchau!" },
    });
    steps.push({
      event: "return",
      phase: "SUBINDO",
      line: 14,
      stack: snapshotStack(),
      elements: elementsFor(false),
      payload: { fn: "tchau" },
    });
    popFrame();
  }

  function runSaudacao2(depth) {
    pushFrame(`saudacao2("${nome}")`, depth, [{ k: "nome", v: nome }]);
    steps.push({
      event: "enter",
      phase: "DESCENDO",
      line: 8,
      stack: snapshotStack(),
      elements: elementsFor(true),
      payload: { fn: "saudacao2", nome },
    });
    steps.push({
      event: "print",
      phase: "DESCENDO",
      line: 9,
      stack: snapshotStack(),
      elements: elementsFor(true),
      payload: { fn: "saudacao2", text: `Como vai ${nome}?` },
    });
    steps.push({
      event: "return",
      phase: "SUBINDO",
      line: 10,
      stack: snapshotStack(),
      elements: elementsFor(true),
      payload: { fn: "saudacao2" },
    });
    popFrame();
  }

  function runSaudacao(depth) {
    pushFrame(`saudacao("${nome}")`, depth, [{ k: "nome", v: nome }]);
    steps.push({
      event: "enter",
      phase: "DESCENDO",
      line: 1,
      stack: snapshotStack(),
      elements: elementsFor(true),
      payload: { fn: "saudacao", nome },
    });
    steps.push({
      event: "print",
      phase: "DESCENDO",
      line: 2,
      stack: snapshotStack(),
      elements: elementsFor(true),
      payload: { fn: "saudacao", text: `Olá, ${nome}!` },
    });
    steps.push({
      event: "call",
      phase: "DESCENDO",
      line: 3,
      stack: snapshotStack(),
      elements: elementsFor(true),
      payload: { fn: "saudacao", callee: "saudacao2", args: `"${nome}"` },
    });
    runSaudacao2(depth + 1);
    steps.push({
      event: "print",
      phase: "DESCENDO",
      line: 4,
      stack: snapshotStack(),
      elements: elementsFor(true),
      payload: { fn: "saudacao", text: "preparando para dizer tchau..." },
    });
    steps.push({
      event: "call",
      phase: "DESCENDO",
      line: 5,
      stack: snapshotStack(),
      elements: elementsFor(true),
      payload: { fn: "saudacao", callee: "tchau", args: "" },
    });
    runTchau(depth + 1);
    steps.push({
      event: "return",
      phase: "SUBINDO",
      line: 6,
      stack: snapshotStack(),
      elements: elementsFor(true),
      payload: { fn: "saudacao" },
    });
    popFrame();
  }

  runSaudacao(0);
  return { steps, tree: null };
}

/** @returns {ExpressionResult} */
function buildExpression(traceResult, stepIndex) {
  const { steps } = traceResult;
  const isFinal = stepIndex === steps.length - 1;

  const printed = [];
  for (let k = 0; k <= stepIndex; k++) {
    if (steps[k].event === "print") printed.push(steps[k].payload.text);
  }
  const rhs = printed.length ? printed.join(" → ") : "(nada impresso ainda)";
  const lhs = "Saída acumulada: ";
  return {
    nodes: [lhs, isFinal ? { type: "strong", text: rhs, final: true } : rhs],
  };
}

/** @type {Engine} */
export const ENGINE = {
  version: ENGINE_VERSION,

  meta: {
    title: "Pilha de chamadas — sem recursão",
    subtitle:
      "Visualizador passo a passo: mesmo sem recursão, cada chamada de função empilha um frame e o desempilha ao terminar.",
  },

  input: {
    schema: [
      {
        key: "nome",
        label: "Nome",
        type: "string",
        default: "maggie",
        placeholder: "maggie",
      },
    ],
  },

  code: {
    lines: CODE_LINES,
    highlight: highlightRust,
  },

  visualization: {
    legend: [{ role: "primary", status: "current", label: "Parâmetro nome" }],
  },

  events: EVENTS,

  buildTrace,
  buildExpression,
  messages,
};
