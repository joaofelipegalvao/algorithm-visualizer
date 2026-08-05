(function () {
  var catalogEl = /** @type {HTMLElement} */ (
    document.getElementById("catalog")
  );

  if (!catalogEl) {
    console.error("catalog.js: elemento #catalog não encontrado no DOM.");
    return;
  }

  if (
    typeof ALGORITHM_MANIFEST === "undefined" ||
    !Array.isArray(ALGORITHM_MANIFEST)
  ) {
    catalogEl.innerHTML =
      '<p class="empty-state">manifest.js não encontrado ou ALGORITHM_MANIFEST inválido.</p>';
    return;
  }

  if (ALGORITHM_MANIFEST.length === 0) {
    catalogEl.innerHTML =
      '<p class="empty-state">Nenhum algoritmo cadastrado no manifest ainda.</p>';
    return;
  }

  catalogEl.innerHTML = "";

  // Filtro por linguagem: calculado a partir do manifest, não uma
  // categoria fixa no código. Com 1 linguagem só (hoje: Rust), não
  // faz sentido nenhum filtrar entre 1 opção — então o controle nem
  // é renderizado. No dia em que uma 2ª linguagem for adicionada em
  // manifest.js, isso aparece sozinho, sem precisar tocar em
  // catalog.js/catalog.css de novo. É por isso que o preparo pra
  // multi-linguagem vive aqui como mecanismo, e não como uma seção
  // "RUST" decorativa envolvendo os únicos 8 itens que existem hoje.
  var languages = [];
  ALGORITHM_MANIFEST.forEach(function (entry) {
    if (entry.language && languages.indexOf(entry.language) === -1) {
      languages.push(entry.language);
    }
  });

  var activeLanguage = "all";

  function applyFilter() {
    var groups = /** @type {NodeListOf<HTMLElement>} */ (
      catalogEl.querySelectorAll(".group")
    );
    groups.forEach(function (group) {
      var items = /** @type {NodeListOf<HTMLElement>} */ (
        group.querySelectorAll(".frame")
      );
      var visibleCount = 0;
      items.forEach(function (li) {
        var match =
          activeLanguage === "all" || li.dataset.language === activeLanguage;
        li.hidden = !match;
        if (match) visibleCount++;
      });
      group.hidden = visibleCount === 0;
    });
  }

  if (languages.length > 1) {
    var filterBar = document.createElement("div");
    filterBar.className = "lang-filter";
    filterBar.setAttribute("role", "group");
    filterBar.setAttribute("aria-label", "Filtrar por linguagem");

    function makePill(value, label) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "lang-pill";
      btn.textContent = label;
      btn.setAttribute("aria-pressed", value === activeLanguage ? "true" : "false");
      if (value === activeLanguage) btn.classList.add("is-active");
      btn.addEventListener("click", function () {
        activeLanguage = value;
        filterBar.querySelectorAll(".lang-pill").forEach(function (p) {
          p.classList.remove("is-active");
          p.setAttribute("aria-pressed", "false");
        });
        btn.classList.add("is-active");
        btn.setAttribute("aria-pressed", "true");
        applyFilter();
      });
      return btn;
    }

    filterBar.appendChild(makePill("all", "Todas"));
    languages.forEach(function (lang) {
      filterBar.appendChild(makePill(lang, lang.toUpperCase()));
    });

    catalogEl.appendChild(filterBar);
  }

  // Agrupamento por padrão de recursão real (ver docs/ENGINE.md:
  // tree === null é "sem recursão"; node.children pode ter 1 filho
  // real por frame, ou 2 nos casos que o contrato já antecipa —
  // Fibonacci e Quicksort). Não é uma ordem inventada pra decorar a
  // tela; é a mesma distinção que o próprio ENGINE já documenta.
  var GROUPS = [
    { key: "none", title: "Sem recursão" },
    { key: "single", title: "Uma chamada recursiva por vez" },
    { key: "multiple", title: "Duas chamadas recursivas por frame" },
  ];

  GROUPS.forEach(function (group) {
    var entries = ALGORITHM_MANIFEST.filter(function (e) {
      return e.pattern === group.key;
    });
    if (entries.length === 0) return;

    var section = document.createElement("section");
    section.className = "group";

    var heading = document.createElement("h2");
    heading.className = "group-title";
    heading.textContent = group.title;
    section.appendChild(heading);

    var list = document.createElement("ol");
    list.className = "call-stack";

    entries.forEach(function (entry) {
      var li = document.createElement("li");
      li.className = "frame";
      li.dataset.language = entry.language || "";

      var link = document.createElement("a");
      link.href =
        "visualizer/index.html?algoritmo=" + encodeURIComponent(entry.id);

      var body = document.createElement("span");
      body.className = "frame-body";

      var titleRow = document.createElement("span");
      titleRow.className = "frame-title-row";

      var titleEl = document.createElement("span");
      titleEl.className = "frame-title";
      titleEl.textContent = entry.title || entry.id;

      var langEl = document.createElement("span");
      langEl.className = "frame-lang";
      langEl.textContent = entry.language || "?";

      titleRow.appendChild(titleEl);
      titleRow.appendChild(langEl);
      if (entry.complexity) {
        var complexityEl = document.createElement("span");
        complexityEl.className = "frame-complexity";
        complexityEl.textContent = entry.complexity;
        titleRow.appendChild(complexityEl);
      }

      var descEl = document.createElement("span");
      descEl.className = "frame-desc";
      descEl.textContent = entry.description || "";

      body.appendChild(titleRow);
      body.appendChild(descEl);

      var arrowEl = document.createElement("span");
      arrowEl.className = "material-symbols-outlined frame-arrow";
      arrowEl.setAttribute("aria-hidden", "true");
      arrowEl.textContent = "arrow_forward";

      link.appendChild(body);
      link.appendChild(arrowEl);
      li.appendChild(link);
      list.appendChild(li);
    });

    section.appendChild(list);
    catalogEl.appendChild(section);
  });
})();
