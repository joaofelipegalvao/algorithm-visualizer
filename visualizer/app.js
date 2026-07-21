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

function collectInputs() {
  const inputs = {};
  const errors = [];
  ENGINE.input.schema.forEach((field) => {
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
  return `<span class="material-symbols-outlined" aria-hidden="true">${name}</span>`;
}

const ICON_MOON = "dark_mode";
const ICON_SUN = "light_mode";

/* ---------- TraceViewer ---------- */
const TraceViewer = {
  /** @type {TraceResult | null} */
  trace: null,
  step: 0,

  regenerate() {
    const errEl = /** @type {HTMLElement} */ (
      document.getElementById("listErr")
    );
    const { inputs, errors } = collectInputs();

    if (errors.length) {
      errEl.textContent = errors[0];
      return;
    }
    errEl.textContent = "";

    this.trace = ENGINE.buildTrace(inputs);
    this.step = 0;
    /** @type {HTMLInputElement} */ (document.getElementById("slider")).max =
      String(this.trace.steps.length - 1);
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
  onSlider(v) {
    this.step = Number(v);
    this.render();
  },

  render() {
    if (!this.trace || this.trace.steps.length === 0) return;
    const s = this.trace.steps[this.step];

    this.renderStatus(s);
    this.renderListPanel(s);
    this.renderCodePanel(s);
    this.renderCallStackPanel(s);
    this.renderExpressionPanel();
    this.renderTransport();
  },

  renderStatus(s) {
    /** @type {HTMLElement} */ (document.getElementById("phase")).textContent =
      s.phase;
    const eventIcon = ENGINE.events && ENGINE.events[s.event]?.icon;
    /** @type {HTMLElement} */ (document.getElementById("msgIcon")).innerHTML =
      eventIcon ? materialIcon(eventIcon) : "";
    const narrative = ENGINE.messages[s.event](s.payload);
    renderNodesInto(
      /** @type {HTMLElement} */ (document.getElementById("msgText")),
      narrative,
    );
  },

  renderListPanel(s) {
    const listEl = /** @type {HTMLElement} */ (document.getElementById("list"));
    clearEl(listEl);
    const row = document.createElement("div");
    row.className = "row current-frame-list";
    s.elements.forEach((item) => {
      const box = document.createElement("div");
      box.className = "box " + (ROLE_CLASS[item.role] || "rest");
      box.textContent = item.text;
      row.appendChild(box);
    });
    listEl.appendChild(row);
  },

  renderCodePanel(s) {
    const codeBox = /** @type {HTMLElement} */ (
      document.getElementById("codeBox")
    );
    clearEl(codeBox);
    ENGINE.code.lines.forEach((line, idx) => {
      const ln = idx + 1;
      const div = document.createElement("div");
      div.className = "codeline" + (ln === s.line ? " active" : "");

      const lnSpan = document.createElement("span");
      lnSpan.className = "ln";
      lnSpan.textContent = String(ln);
      div.appendChild(lnSpan);

      const codeSpan = document.createElement("span");
      codeSpan.innerHTML = ENGINE.code.highlight(line);
      div.appendChild(codeSpan);

      codeBox.appendChild(div);
    });
  },

  renderCallStackPanel(s) {
    const stackBox = /** @type {HTMLElement} */ (
      document.getElementById("stackBox")
    );
    clearEl(stackBox);
    s.stack.forEach((frame, idx) => {
      const isCurrent = idx === s.stack.length - 1;

      const card = document.createElement("div");
      card.className = "frame-card" + (isCurrent ? " current" : "");

      const titleDiv = document.createElement("div");
      titleDiv.className = "frame-title";
      const titleSpan = document.createElement("span");
      titleSpan.textContent = frame.title;
      const depthSpan = document.createElement("span");
      depthSpan.className = "depth-tag";
      depthSpan.textContent = `profundidade ${frame.depth}`;
      titleDiv.appendChild(titleSpan);
      titleDiv.appendChild(depthSpan);
      card.appendChild(titleDiv);

      const varsDiv = document.createElement("div");
      varsDiv.className = "frame-vars";
      frame.vars.forEach((v) => {
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
      card.appendChild(varsDiv);
      stackBox.appendChild(card);
    });
  },

  renderExpressionPanel() {
    const trace = /** @type {TraceResult} */ (this.trace);
    const expr = ENGINE.buildExpression(trace, this.step);
    renderNodesInto(
      /** @type {HTMLElement} */ (document.getElementById("exprBox")),
      expr.nodes,
    );
  },

  renderTransport() {
    const trace = /** @type {TraceResult} */ (this.trace);
    /** @type {HTMLInputElement} */ (document.getElementById("slider")).value =
      String(this.step);
    /** @type {HTMLElement} */ (document.getElementById("count")).textContent =
      "Estado " + (this.step + 1) + " de " + trace.steps.length;

    /** @type {HTMLButtonElement} */ (
      document.getElementById("btnPrev")
    ).disabled = this.step === 0;
    /** @type {HTMLButtonElement} */ (
      document.getElementById("btnNext")
    ).disabled = this.step === trace.steps.length - 1;
  },
};

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
const SUPPORTED_ENGINE_VERSION = 3;

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
function wireEvents() {
  document.getElementById("themeBtn")?.addEventListener("click", toggleTheme);
  document
    .getElementById("btnRegenerate")
    ?.addEventListener("click", () => TraceViewer.regenerate());
  document
    .getElementById("btnPrev")
    ?.addEventListener("click", () => TraceViewer.prev());
  document
    .getElementById("btnNext")
    ?.addEventListener("click", () => TraceViewer.next());
  document
    .getElementById("slider")
    ?.addEventListener("input", (e) =>
      TraceViewer.onSlider(/** @type {HTMLInputElement} */ (e.target).value),
    );
}

export function initApp(engine) {
  ENGINE = engine;
  validateEngine();
  initMeta();
  buildConfigForm();
  renderLegend();
  wireEvents();
  TraceViewer.regenerate();
}
