(function () {
  var catalogEl = document.getElementById("catalog");

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

  var list = document.createElement("ul");
  list.className = "algorithm-list";

  ALGORITHM_MANIFEST.forEach(function (entry) {
    var li = document.createElement("li");
    var link = document.createElement("a");
    link.href =
      "visualizer/index.html?algoritmo=" + encodeURIComponent(entry.id);

    var titleEl = document.createElement("div");
    titleEl.className = "algorithm-title";
    titleEl.textContent = entry.title || entry.id;

    var metaEl = document.createElement("div");
    metaEl.className = "algorithm-meta";
    metaEl.textContent = entry.language || "?";

    link.appendChild(titleEl);
    link.appendChild(metaEl);
    li.appendChild(link);
    list.appendChild(li);
  });

  catalogEl.appendChild(list);
})();
