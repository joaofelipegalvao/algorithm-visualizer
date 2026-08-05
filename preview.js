// A porta de entrada mostra um pedaço real de execução, não uma
// captura de tela estática nem uma promessa em texto. Importa o
// engine.js de verdade (o mesmo módulo que visualizer/app.js importa),
// roda buildTrace() de verdade, e usa 1 passo real como vitrine
// estática — o ponto de pilha mais profundo, que é o que melhor
// mostra "a pilha cresce". Um painel só, não um filmstrip: a prévia
// existe pra dar prova rápida, não pra virar mais uma coisa pra ler.
(async function () {
  var mount = document.getElementById("previewFrames");
  var wrap = document.getElementById("stackPreview");
  if (!mount || !wrap) return;

  try {
    var mod = await import("./algorithms/rust/fibonacci/engine.js");
    var ENGINE = mod.ENGINE;
    var trace = ENGINE.buildTrace({ n: 4 });
    var steps = trace.steps;

    var deepestIndex = 0;
    var deepestLen = 0;
    steps.forEach(function (s, i) {
      if (s.stack.length > deepestLen) {
        deepestLen = s.stack.length;
        deepestIndex = i;
      }
    });

    var step = steps[deepestIndex];
    var frame = document.createElement("div");
    frame.className = "preview-frame";

    var phase = document.createElement("span");
    phase.className = "preview-phase";
    phase.textContent = step.phase;
    frame.appendChild(phase);

    var stackEl = document.createElement("div");
    stackEl.className = "preview-stack";
    step.stack.forEach(function (f, depth) {
      var row = document.createElement("div");
      row.className = "preview-stack-row";
      if (depth === step.stack.length - 1) {
        row.classList.add("is-current");
      }
      row.textContent = f.title;
      stackEl.appendChild(row);
    });
    frame.appendChild(stackEl);

    var msgEl = document.createElement("p");
    msgEl.className = "preview-msg";
    var nodes = ENGINE.messages[step.event]
      ? ENGINE.messages[step.event](step.payload)
      : [];
    nodes.forEach(function (node) {
      if (typeof node === "string") {
        msgEl.appendChild(document.createTextNode(node));
      } else if (node && typeof node === "object") {
        var tag = node.type === "code" ? "code" : "strong";
        var el = document.createElement(tag);
        el.textContent = node.text;
        msgEl.appendChild(el);
      }
    });
    frame.appendChild(msgEl);

    mount.appendChild(frame);

    var caption = document.getElementById("previewCaption");
    if (caption) {
      caption.textContent =
        "Um passo real de execução — clique para ver a pilha completa.";
    }

    wrap.hidden = false;
  } catch (err) {
    // Falha ao carregar o preview (offline, bloqueio de módulo etc.)
    // não pode quebrar a página nem deixar um bloco vazio pela
    // metade — o catálogo abaixo continua funcionando sozinho.
    console.error("preview.js: falha ao gerar prévia.", err);
    wrap.hidden = true;
  }
})();
