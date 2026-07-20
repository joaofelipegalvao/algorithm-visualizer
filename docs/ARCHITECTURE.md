# Arquitetura

Este documento descreve o estado atual do projeto: onde as coisas
moram, como as peças se encontram em runtime, e como validar uma
mudança.

Para o contrato entre `engine.js` e o shell (o que um algoritmo novo
precisa implementar), ver [ENGINE.md](./ENGINE.md). Este documento não
trata do shape do objeto `ENGINE` — só de como os arquivos se
encontram.

## Mapa do código

```
algorithms/
├── _shared/
│   └── engine-kit.js     # utilidades compartilhadas entre engines
│                          # (escapeHtml, strong, code, highlightCode,
│                          # elementsForHeadTail) — ver ENGINE.md
└── <language>/<id>/
    ├── engine.js          # motor + narrativa de um algoritmo
    └── source.<ext>       # código-fonte de referência exibido na UI

types/
└── engine.d.ts            # interfaces do contrato ENGINE (Engine,
                             # TraceStep, TraceResult, etc.) — global,
                             # sem import/export de propósito

visualizer/
├── index.html              # o visualizador; loader + painéis
└── app.js                  # shell: renderização, estado, validação
                             # do contrato (initApp, TraceViewer)

manifest.js                 # catálogo de algoritmos (ALGORITHM_MANIFEST),
                             # compartilhado entre index.html e visualizer/
index.html                  # página de catálogo
catalog.js                  # consumidor de manifest.js no catálogo

tsconfig.json                # configuração única de type-checking
                             # (checkJs sobre todo o projeto)
```

Regra geral: `algorithms/` não sabe nada sobre `visualizer/`; a
comunicação é só via o contrato `ENGINE` (ver ENGINE.md). `visualizer/`
não sabe nada sobre nenhum algoritmo específico.

## Como o loader funciona hoje

Dois pontos de entrada HTML, cada um com sua própria cadeia de
carregamento:

```
index.html (catálogo)          visualizer/index.html (visualizador)
    │                                    │
    ├── manifest.js (clássico)          ├── manifest.js (clássico)
    └── catalog.js (clássico)           └── loader (type="module")
                                              │
                                              ├── import() dinâmico do
                                              │   engine.js do algoritmo
                                              │
                                              └── import() de app.js,
                                                  chamando initApp(ENGINE)
```

- **`index.html`** (raiz) — catálogo. Lista os algoritmos a partir de
  `ALGORITHM_MANIFEST`. Inteiramente scripts clássicos
  (`manifest.js` + `catalog.js`), sem módulos — não há problema de
  escopo a resolver aqui, cada script roda uma vez só.
- **`visualizer/index.html`** — o visualizador em si. Usa ES Modules
  para carregar o `engine.js` do algoritmo selecionado e `app.js`.

**`manifest.js` é compartilhado, mas não é módulo.** Continua sendo um
script clássico, e disponibiliza `ALGORITHM_MANIFEST` para os scripts
carregados depois dele — inclusive para o loader do visualizador,
mesmo sendo um módulo. Não há necessidade de tocar em `manifest.js`
nem em `catalog.js` por causa de `visualizer/`.

```html
<!-- visualizer/index.html -->
<script src="../manifest.js"></script>
<script type="module">
  // ALGORITHM_MANIFEST já está disponível aqui, declarada pelo
  // <script> clássico acima.
  const item = ALGORITHM_MANIFEST.find(...);
</script>
```

**O loader** é o único componente responsável por conectar a
infraestrutura de carregamento ao contrato dos engines: ele resolve
qual algoritmo mostrar, importa o `engine.js` correspondente e entrega
o `ENGINE` resultante para `app.js` iniciar. Nenhum outro arquivo
decide isso. Responsabilidades, nessa ordem:

1. Ler `?algoritmo=` da URL e resolver o item correspondente em
   `ALGORITHM_MANIFEST` (fallback: primeiro item da lista).
2. Importar dinamicamente o `engine.js` do algoritmo (`import()`).
3. Importar `app.js` e chamar `initApp(engineMod.ENGINE)`.

```js
const engineMod = await import(`../${item.engine}`);
const { initApp } = await import("./app.js");
initApp(engineMod.ENGINE);
```

`engine-kit.js` **não** é importado pelo loader — cada `engine.js` já
importa dele diretamente o que precisa (ver ENGINE.md). O loader só
cuida de resolver qual `engine.js` carregar e passar o resultado para
`app.js`.

`app.js` não lê nenhum global (`window.ENGINE` não existe) — ele é um
módulo que exporta `initApp(engine)`, e mantém `ENGINE` como binding
de módulo (`let ENGINE`), atribuída dentro de `initApp`.

**Handlers de evento** seguem a mesma lógica: `visualizer/index.html`
não usa atributos inline (`onclick`, `oninput`) em nenhum elemento
interativo. `app.js` liga os listeners explicitamente dentro de
`wireEvents()`, chamada por `initApp()`:

```js
document
  .getElementById("btnRegenerate")
  ?.addEventListener("click", () => TraceViewer.regenerate());
```

Isso é necessário porque `app.js` é módulo — escopo de módulo não vaza
para `window` como escopo de script clássico vaza, então
`TraceViewer`/`toggleTheme` não estariam acessíveis para atributos
inline no HTML. Todo elemento que precisa de handler tem `id` no HTML.

## Requisito: servidor HTTP

ES Modules não funcionam abrindo `file://` direto no navegador
(bloqueio de CORS do browser a módulos). Essa necessidade nasce
diretamente do uso de `import()` no loader acima — o projeto precisa
ser servido por HTTP, mesmo que um servidor estático simples:

```bash
python3 -m http.server 8000
# ou: npx serve
```

Isso vale só para `visualizer/`. O catálogo (`index.html` raiz),
sendo inteiramente scripts clássicos, continuaria funcionando via
`file://` — mas na prática ambos são servidos juntos.

## Verificando uma mudança

Type-checking cobre tipos e sintaxe, mas não runtime — as duas
verificações são complementares, não substitutas uma da outra.

**Tipos** (rápido, cobre todo o projeto de uma vez):

```bash
npx tsc -p tsconfig.json
```

**Runtime** (necessário para qualquer mudança em `app.js`,
`engine.js`, `engine-kit.js`, ou nos HTMLs — o `tsc` limpo não garante
que a página funciona):

```bash
python3 -m http.server 8000
```

Depois, no browser, testar cada algoritmo do `manifest.js` via
`visualizer/index.html?algoritmo=<id>`: formulário carrega com os
campos certos, avançar/voltar passo funciona, "Gerar visualização"
com input novo funciona, alternância de tema funciona, console sem
erros. Testar também `index.html` (catálogo) separadamente.

## Decisões arquiteturais relevantes

### ES Modules nativos, sem bundler

Cada `engine.js` exporta seu próprio `ENGINE`, com escopo de módulo
isolado por construção — nada de `window.ENGINE` nem estado global
compartilhado entre engines. Isso permite que todos os algoritmos
sejam processados juntos por um único `tsconfig.json`, sem risco de
colisão entre eles, mesmo declarando o mesmo nome (`ENGINE`) cada um.

A alternativa seria um bundler (Vite, esbuild, etc.). Descartado por
ora: um bundler resolveria o mesmo isolamento de escopo que os
módulos nativos já resolvem sozinhos, com custo adicional de build
step, configuração e uma camada extra entre código-fonte e o que
roda — sem benefício proporcional para um projeto deste tamanho (sem
necessidade de code-splitting, tree-shaking ou transpilação). Se a
superfície crescer muito (dezenas de algoritmos, necessidade de
otimizar carregamento), vale reavaliar.

Essa mesma lógica orienta as demais escolhas do projeto: preferir
recursos nativos do navegador a ferramentas adicionais, e manter a
infraestrutura de carregamento (este documento) separada do contrato
dos engines (ENGINE.md).

**Trade-off aceito.** Como `app.js` é módulo, ele não tem acesso
automático a `window` — por isso os listeners de evento são ligados
explicitamente via `addEventListener` (ver seção anterior), em vez de
atributos inline no HTML.
