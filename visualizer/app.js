/** @type {Engine} */
let ENGINE;

const ROLE_CLASS = { primary: "first", secondary: "rest" };

document.documentElement.setAttribute("data-theme", "light");

/* ---------- Helpers de renderização segura (sem HTML de dados) ---------- */
function clearEl(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

function appendNode(container, node) {
  if (typeof node === "string") {
    container.appendChild(document.createTextNode(node));
    return;
  }
  let tag;
  switch (node.type) {
    case "strong":
      tag = "b";
      break;
    case "code":
      tag = "code";
      break;
    default:
      throw new Error(
        `Nó de narrativa/expressão com tipo desconhecido: "${node.type}"`,
      );
  }
  const el = document.createElement(tag);
  el.textContent = node.text;
  if (node.final) el.classList.add("final");
  container.appendChild(el);
}
function renderNodesInto(container, nodes) {
  clearEl(container);
  nodes.forEach((n) => appendNode(container, n));
}

/* ---------- Formulário genérico a partir de ENGINE.input.schema ---------- */
function fieldInputId(key) {
  return "field-" + key;
}

function parseField(field, raw) {
  const trimmed = (raw || "").trim();
  const example = field.placeholder || field.default;
  switch (field.type) {
    case "number-list": {
      const parts = trimmed
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length);
      const nums = parts.map(Number);
      if (nums.length === 0 || nums.some((n) => Number.isNaN(n))) {
        return {
          error: `${field.label || field.key}: digite números separados por vírgula, ex: ${example}`,
        };
      }
      if (field.minItems && nums.length < field.minItems) {
        return {
          error: `${field.label || field.key}: use pelo menos ${field.minItems} número(s).`,
        };
      }
      if (field.maxItems && nums.length > field.maxItems) {
        return {
          error: `${field.label || field.key}: use no máximo ${field.maxItems} números para a visualização ficar legível.`,
        };
      }
      return { value: nums };
    }
    case "number": {
      const n = Number(trimmed);
      if (trimmed === "" || Number.isNaN(n)) {
        return {
          error: `${field.label || field.key}: digite um número válido, ex: ${example}`,
        };
      }
      return { value: n };
    }
    case "string": {
      if (!trimmed) {
        return { error: `${field.label || field.key}: preencha este campo.` };
      }
      return { value: trimmed };
    }
    default:
      return {
        error: `Tipo de campo não suportado: "${field.type}" (campo "${field.key}").`,
      };
  }
}

function collectInputs(engine) {
  const inputs = {};
  const errors = [];
  engine.input.schema.forEach((field) => {
    const el = /** @type {HTMLInputElement | null} */ (
      document.getElementById(fieldInputId(field.key))
    );
    const raw = el ? el.value : "";
    const result = parseField(field, raw);
    if (result.error) errors.push(result.error);
    else inputs[field.key] = result.value;
  });
  return { inputs, errors };
}

function buildConfigForm() {
  const container = /** @type {HTMLElement} */ (
    document.getElementById("configFields")
  );
  clearEl(container);
  ENGINE.input.schema.forEach((field) => {
    const wrap = document.createElement("div");
    wrap.className = "field";

    const label = document.createElement("label");
    label.textContent = field.label || field.key;
    label.setAttribute("for", fieldInputId(field.key));
    wrap.appendChild(label);

    const input = document.createElement("input");
    input.type = "text";
    input.id = fieldInputId(field.key);
    if (field.default != null) input.value = String(field.default);
    if (field.placeholder) input.placeholder = field.placeholder;
    wrap.appendChild(input);

    container.appendChild(wrap);
  });
}

function materialIcon(name) {
  const span = document.createElement("span");
  span.className = "material-symbols-outlined";
  span.setAttribute("aria-hidden", "true");
  span.textContent = name;
  return span;
}

const ICON_MOON = "dark_mode";
const ICON_SUN = "light_mode";

/* ---------- Estado de exibição (shell) ----------
 * Transforma o TraceStep "cru" produzido pelo engine em um TraceStep
 * pronto para exibição. A trace em si (this.trace.steps) nunca é
 * alterada -- isso é puramente um detalhe de shell, aplicado uma vez
 * por render(), antes de chegar em qualquer renderizador.
 *
 * No último estado da trace, sintetiza um "estado final" genérico
 * (não é conhecimento de nenhum algoritmo específico): pilha vazia e
 * todos os elementos sem foco (role) e marcados como resolved. Fora
 * disso, o TraceStep passa direto, sem cópia.
 */
function toDisplayStep(trace, step) {
  const raw = trace.steps[step];
  const isFinal = step === trace.steps.length - 1;
  if (!isFinal) return raw;

  return {
    ...raw,
    isFinal: true,
    stack: [],
    elements: raw.elements.map((el) => ({
      ...el,
      role: "secondary",
      status: "resolved",
    })),
  };
}

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function buildFrameVarsContent(varsDiv, vars) {
  clearEl(varsDiv);
  vars.forEach((v) => {
    const kSpan = document.createElement("span");
    kSpan.className = "k";
    kSpan.textContent = v.k;

    const vSpan = document.createElement("span");
    vSpan.className =
      "v" +
      (v.status === "pending"
        ? " pending"
        : v.status === "resolved"
          ? " resolved"
          : "");
    vSpan.textContent = v.status === "pending" ? "aguardando…" : v.v;

    varsDiv.appendChild(kSpan);
    varsDiv.appendChild(vSpan);
  });
}

function updateFrameVars(card, vars) {
  const varsDiv = /** @type {HTMLElement | null} */ (
    card.querySelector(".frame-vars")
  );
  if (varsDiv) buildFrameVarsContent(varsDiv, vars);
}

/** @param {StackFrame} frame */
function buildFrameCard(frame) {
  const card = document.createElement("div");
  card.className = "frame-card";

  const titleDiv = document.createElement("div");
  titleDiv.className = "frame-title";
  const titleSpan = document.createElement("span");
  titleSpan.textContent = frame.title;
  const depthSpan = document.createElement("span");
  depthSpan.className = "depth-tag";
  depthSpan.dataset.depth = String(frame.depth);
  depthSpan.textContent = `profundidade ${frame.depth}`;
  titleDiv.appendChild(titleSpan);
  titleDiv.appendChild(depthSpan);
  card.appendChild(titleDiv);

  const varsDiv = document.createElement("div");
  varsDiv.className = "frame-vars";
  buildFrameVarsContent(varsDiv, frame.vars);
  card.appendChild(varsDiv);

  return card;
}

// Anima a saída de um frame que saiu da pilha (pop) e só remove o nó do
// DOM depois — 'animationend' no caminho normal, um timeout de segurança
// como rede caso ele nunca dispare (aba em background pode atrasar rAF
// indefinidamente, por exemplo). Com motion reduzido, pula a animação e
// remove na hora — não faz sentido esperar um efeito que o CSS já anula.
function removeFrameAnimated(el) {
  if (prefersReducedMotion()) {
    el.remove();
    return;
  }
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    el.remove();
  };
  el.addEventListener("animationend", finish, { once: true });
  setTimeout(finish, 260);
  el.classList.add("frame-exit");
}

/* ---------- TraceViewer ----------
 * Antes era um objeto literal no nível de módulo (TraceViewer.trace /
 * TraceViewer.step mutáveis direto), com no máximo uma instância
 * possível por carregamento de página, impossível de testar sem um
 * DOM ao vivo, e sem nada impedindo outro script de fazer
 * `TraceViewer.step = 999` e chamar render() num estado fora dos
 * limites (só next()/prev() checavam limites, render() em si não).
 * createTraceViewer(engine) devolve uma instância nova a cada
 * chamada, fechando sobre `engine` em vez de ler o ENGINE global do
 * módulo — cada instância é isolada e testável isoladamente.
 *
 * Os elementos do DOM usados no hot path de render() (Avançar/Voltar
 * dispara um render por clique) são resolvidos uma única vez aqui,
 * na criação da instância, em vez de um getElementById novo dentro de
 * cada renderX() a cada passo de navegação.
 */
function createTraceViewer(engine) {
  const els = {
    phase: /** @type {HTMLElement} */ (document.getElementById("phase")),
    msgIcon: /** @type {HTMLElement} */ (document.getElementById("msgIcon")),
    msgText: /** @type {HTMLElement} */ (document.getElementById("msgText")),
    list: /** @type {HTMLElement} */ (document.getElementById("list")),
    codeBox: /** @type {HTMLElement} */ (document.getElementById("codeBox")),
    stackBox: /** @type {HTMLElement} */ (
      document.getElementById("stackBox")
    ),
    exprBox: /** @type {HTMLElement} */ (document.getElementById("exprBox")),
    count: /** @type {HTMLElement} */ (document.getElementById("count")),
    btnPrev: /** @type {HTMLButtonElement} */ (
      document.getElementById("btnPrev")
    ),
    btnNext: /** @type {HTMLButtonElement} */ (
      document.getElementById("btnNext")
    ),
    listErr: /** @type {HTMLElement} */ (document.getElementById("listErr")),
  };

  // Cache de nós reaproveitados entre renders (ver renderCodePanel e
  // renderCallStackPanel): evita destruir e recriar DOM que não mudou de
  // fato entre um passo e outro.
  /** @type {HTMLElement[] | null} */
  let codeLineEls = null;
  /** @type {Map<string, HTMLElement>} */
  let stackEls = new Map();
  /** @type {string[]} */
  let stackOrder = [];

  function buildCodeLines() {
    clearEl(els.codeBox);
    return engine.code.lines.map((line, idx) => {
      const div = document.createElement("div");
      div.className = "codeline";

      const lnSpan = document.createElement("span");
      lnSpan.className = "ln";
      lnSpan.textContent = String(idx + 1);
      div.appendChild(lnSpan);

      const codeSpan = document.createElement("span");
      codeSpan.innerHTML = engine.code.highlight(line);
      div.appendChild(codeSpan);

      els.codeBox.appendChild(div);
      return div;
    });
  }

  return {
    /** @type {TraceResult | null} */
    trace: null,
    step: 0,

    regenerate() {
      const { inputs, errors } = collectInputs(engine);

      if (errors.length) {
        els.listErr.textContent = errors[0];
        return;
      }
      els.listErr.textContent = "";

      this.trace = engine.buildTrace(inputs);
      this.step = 0;
      // Uma nova trace começa uma contagem de ids nova a partir de 0 no
      // engine (idCounter reinicia a cada buildTrace) — qualquer id
      // cacheado da trace anterior não tem relação nenhuma com o novo,
      // mesmo que colidam numericamente. É uma re-execução do zero, não
      // um passo de navegação, então limpa sem animação de saída.
      stackEls.clear();
      stackOrder = [];
      clearEl(els.stackBox);
      this.render();
    },

    next() {
      if (this.trace && this.step < this.trace.steps.length - 1) {
        this.step++;
        this.render();
      }
    },
    prev() {
      if (this.step > 0) {
        this.step--;
        this.render();
      }
    },

    render() {
      if (!this.trace || this.trace.steps.length === 0) return;
      const s = toDisplayStep(this.trace, this.step);

      this.renderStatus(s);
      this.renderListPanel(s);
      this.renderCodePanel(s);
      this.renderCallStackPanel(s);
      this.renderExpressionPanel();
      this.renderTransport();
    },

    renderStatus(s) {
      if (s.isFinal) {
        els.phase.textContent = "concluído";
        els.phase.classList.add("phase-pill-done");
        els.msgIcon.classList.add("event-icon-done");
        clearEl(els.msgIcon);
        els.msgIcon.appendChild(materialIcon("task_alt"));
        renderNodesInto(els.msgText, [
          "Execução concluída — nenhum passo restante.",
        ]);
        return;
      }
      els.phase.classList.remove("phase-pill-done");
      els.msgIcon.classList.remove("event-icon-done");
      els.phase.textContent = s.phase;
      const eventIcon = engine.events && engine.events[s.event]?.icon;
      clearEl(els.msgIcon);
      if (eventIcon) els.msgIcon.appendChild(materialIcon(eventIcon));
      const narrative = engine.messages[s.event](s.payload);
      renderNodesInto(els.msgText, narrative);
    },

    renderListPanel(s) {
      clearEl(els.list);
      const row = document.createElement("div");
      row.className = "row current-frame-list";
      s.elements.forEach((item) => {
        const box = document.createElement("div");
        const statusClass = item.status === "resolved" ? " resolved" : "";
        const roleClass = ROLE_CLASS[item.role] || "rest";
        box.className = "box " + roleClass + statusClass;
        box.textContent = item.text;
        row.appendChild(box);
      });
      els.list.appendChild(row);
    },

    renderCodePanel(s) {
      // engine.code.lines nunca muda depois do primeiro render — só a
      // linha ativa troca a cada passo. Antes recriava todo o painel de
      // código (uma <div> por linha) em toda navegação; agora as <div>
      // ficam cacheadas (buildCodeLines, abaixo) e só a classe "active"
      // se move de uma pra outra.
      const lines = codeLineEls ?? (codeLineEls = buildCodeLines());
      lines.forEach((div, idx) => {
        div.classList.toggle("active", idx + 1 === s.line);
      });
    },

    renderCallStackPanel(s) {
      const newIds = s.stack.map((f) => f.id);

      // .stack é sempre um caminho raiz→atual de uma pilha de chamadas de
      // verdade (nunca uma árvore arbitrária — ver docs/ENGINE.md), então
      // dois passos quaisquer só podem diferir por um sufixo: frames que
      // saíram (pop) e/ou frames que entraram (push). Frames num prefixo
      // comum continuam sendo a mesma chamada, só com vars atualizadas.
      let common = 0;
      while (
        common < stackOrder.length &&
        common < newIds.length &&
        stackOrder[common] === newIds[common]
      ) {
        common++;
      }

      // Frames que saíram da pilha desde o último render: animação de
      // saída, remoção só depois que ela termina (ou depois de um timeout
      // de segurança, caso animationend não dispare — motion reduzido,
      // aba em background, etc).
      for (let i = stackOrder.length - 1; i >= common; i--) {
        const id = stackOrder[i];
        const el = stackEls.get(id);
        stackEls.delete(id);
        if (el) removeFrameAnimated(el);
      }

      // Frames que já existiam (prefixo comum): atualiza só as vars, sem
      // recriar o card — não deve retrigger a animação de entrada.
      for (let i = 0; i < common; i++) {
        const card = stackEls.get(newIds[i]);
        if (card) updateFrameVars(card, s.stack[i].vars);
      }

      // Frames novos: cria e anexa (a animação de entrada de .frame-card
      // já existente, slideIn, dispara sozinha por serem nós novos no DOM).
      for (let i = common; i < s.stack.length; i++) {
        const card = buildFrameCard(s.stack[i]);
        stackEls.set(newIds[i], card);
        els.stackBox.appendChild(card);
      }

      // "current" (o último frame da pilha) pode ter mudado mesmo sem
      // recriar nada — por exemplo, o frame de baixo persiste no prefixo
      // comum, mas deixou de ser o current porque um novo entrou por cima.
      stackEls.forEach((card, id) => {
        const isCurrent = id === newIds[newIds.length - 1];
        card.classList.toggle("current", isCurrent);
        const depthSpan = /** @type {HTMLElement} */ (
          card.querySelector(".depth-tag")
        );
        if (depthSpan) {
          const depth = depthSpan.dataset.depth;
          depthSpan.textContent = isCurrent
            ? `profundidade ${depth} · atual`
            : `profundidade ${depth}`;
        }
      });

      stackOrder = newIds;

      // .stack-frames usa column-reverse pra desenhar o frame atual no topo
      // da pilha física. Com overflow-y: auto, scrollTop: 0 é o padrão do
      // browser e mostra os frames mais ANTIGOS — o frame atual fica
      // escondido acima, fora da área visível. Forçar um scrollTop bem
      // negativo (o browser faz o clamp pro mínimo válido sozinho) ancora
      // a visão no topo real do conteúdo, ou seja, no frame atual.
      els.stackBox.scrollTop = -els.stackBox.scrollHeight;
    },

    renderExpressionPanel() {
      const trace = /** @type {TraceResult} */ (this.trace);
      const expr = engine.buildExpression(trace, this.step);
      renderNodesInto(els.exprBox, expr.nodes);
    },

    renderTransport() {
      const trace = /** @type {TraceResult} */ (this.trace);
      els.count.textContent =
        "Estado " + (this.step + 1) + " de " + trace.steps.length;
      els.btnPrev.disabled = this.step === 0;
      els.btnNext.disabled = this.step === trace.steps.length - 1;
    },
  };
}

/* ---------- Meta e legenda ---------- */
function initMeta() {
  document.title = ENGINE.meta.title;
  /** @type {HTMLElement} */ (
    document.getElementById("examTitle")
  ).textContent = ENGINE.meta.title;
  /** @type {HTMLElement} */ (
    document.getElementById("examSubtitle")
  ).textContent = ENGINE.meta.subtitle;
}

function renderLegend() {
  const legendEl = /** @type {HTMLElement} */ (
    document.getElementById("legend")
  );
  clearEl(legendEl);
  ENGINE.visualization.legend.forEach((item) => {
    const swatch = document.createElement("span");
    swatch.className = "swatch";
    swatch.style.background =
      "var(--" + (ROLE_CLASS[item.role] || "rest") + ")";
    legendEl.appendChild(swatch);
    legendEl.appendChild(document.createTextNode(item.label));
    legendEl.appendChild(document.createTextNode("\u00A0\u00A0"));
  });
}

/* ---------- Tema claro/escuro ---------- */
function toggleTheme() {
  const root = document.documentElement;
  const current = root.getAttribute("data-theme");
  const next = current === "dark" ? "light" : "dark";
  root.setAttribute("data-theme", next);
  /** @type {HTMLElement} */ (
    document.getElementById("themeIcon")
  ).textContent = next === "dark" ? ICON_SUN : ICON_MOON;
  /** @type {HTMLElement} */ (
    document.getElementById("themeLabel")
  ).textContent = next === "dark" ? "Modo claro" : "Modo escuro";
}

/* ---------- Validação do contrato ENGINE ---------- */
const SUPPORTED_ENGINE_VERSION = 4;

function validateEngineStructure() {
  const declaredEvents = new Set(Object.keys(ENGINE.events || {}));
  const declaredMessages = new Set(Object.keys(ENGINE.messages || {}));

  for (const event of declaredMessages) {
    if (!declaredEvents.has(event)) {
      console.warn(
        `ENGINE "${ENGINE.meta?.title}": evento "${event}" tem narrativa em ENGINE.messages mas nenhum ícone em ENGINE.events.`,
      );
    }
  }
  for (const event of declaredEvents) {
    if (!declaredMessages.has(event)) {
      throw new Error(
        `ENGINE "${ENGINE.meta?.title}": evento "${event}" tem ícone em ENGINE.events mas nenhuma narrativa em ENGINE.messages.`,
      );
    }
  }
}

function validateEngineBehavior() {
  const sampleInputs = {};
  ENGINE.input.schema.forEach((field) => {
    const parsed = parseField(field, String(field.default ?? ""));
    if (!parsed.error) sampleInputs[field.key] = parsed.value;
  });

  let sample;
  try {
    sample = ENGINE.buildTrace(sampleInputs);
  } catch (e) {
    console.warn(
      `ENGINE "${ENGINE.meta?.title}": não foi possível rodar buildTrace com os defaults para validar cobertura de eventos.`,
      e,
    );
    return;
  }

  const seen = new Set();
  for (const step of sample.steps) {
    if (seen.has(step.event)) continue;
    seen.add(step.event);

    if (typeof ENGINE.messages[step.event] !== "function") {
      throw new Error(
        `ENGINE "${ENGINE.meta?.title}": evento "${step.event}" (emitido por buildTrace) não tem narrativa em ENGINE.messages.`,
      );
    }
    if (!ENGINE.events || !ENGINE.events[step.event]?.icon) {
      console.warn(
        `ENGINE "${ENGINE.meta?.title}": evento "${step.event}" (emitido por buildTrace) sem ícone em ENGINE.events (vai renderizar sem ícone).`,
      );
    }
  }
}

function validateEngine() {
  if (ENGINE.version !== SUPPORTED_ENGINE_VERSION) {
    throw new Error(
      `ENGINE incompatível com este app.js: esperado v${SUPPORTED_ENGINE_VERSION}, recebido v${ENGINE.version}.`,
    );
  }
  validateEngineStructure();
  validateEngineBehavior();
}

/* ---------- Wiring de eventos (substitui os onclick/oninput inline) ---------- */
function wireEvents(viewer) {
  document.getElementById("themeBtn")?.addEventListener("click", toggleTheme);
  document
    .getElementById("btnRegenerate")
    ?.addEventListener("click", () => viewer.regenerate());
  document
    .getElementById("btnPrev")
    ?.addEventListener("click", () => viewer.prev());
  document
    .getElementById("btnNext")
    ?.addEventListener("click", () => viewer.next());
}

export function initApp(engine) {
  ENGINE = engine;
  validateEngine();
  initMeta();
  buildConfigForm();
  renderLegend();
  const viewer = createTraceViewer(engine);
  wireEvents(viewer);
  viewer.regenerate();
}
