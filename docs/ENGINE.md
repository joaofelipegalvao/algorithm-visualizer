# Contrato ENGINE (v3)

Este documento descreve o contrato real entre `engine.js` (um por
algoritmo, em `algorithms/<language>/<id>/engine.js`) e o shell
(`visualizer/app.js` + `visualizer/index.html`). Esta é a forma
**implementada**, não uma proposta.

Para como `engine.js` é carregado em runtime (ES Modules, loader,
`manifest.js`, requisito de servidor HTTP), ver
[ARCHITECTURE.md](./ARCHITECTURE.md). Este documento cobre apenas o
que um `engine.js` precisa implementar.

## Princípio geral

O shell não conhece nada sobre nenhum algoritmo específico. Tudo que
`app.js` sabe fazer é ler o objeto `ENGINE` exportado por um
`engine.js` e renderizar a partir dele. Um algoritmo novo = um
`engine.js` novo seguindo este contrato + uma entrada em
`manifest.js`. `index.html`, `app.js`, `style.css` não mudam.

## O que um `engine.js` precisa fazer

Um `engine.js` é um módulo ES. Ele deve:

1. Importar de `algorithms/_shared/engine-kit.js` o que usar:

   ```js
   import {
     strong,
     code,
     highlightCode,
     elementsForHeadTail,
   } from "../../_shared/engine-kit.js";
   ```

   (importe só o que o algoritmo usa — nem todo engine precisa de
   `elementsForHeadTail`, por exemplo, se tiver seu próprio
   `elementsFor` local.)

2. Exportar o objeto `ENGINE`:

   ```js
   /** @type {Engine} */
   export const ENGINE = {
     version: 3,
     meta: { title, subtitle },
     input: { schema: [...] },
     code: { lines, highlight },
     visualization: { legend: [...] },
     events: { [eventName]: { icon } },
     buildTrace,
     buildExpression,
     messages,
   };
   ```

O shell (via o loader em `visualizer/index.html`) importa esse módulo
dinamicamente e passa `ENGINE` para `app.js` — mas isso é mecanismo de
carregamento, não parte deste contrato (ver ARCHITECTURE.md).

## O objeto `ENGINE`

### `version`

Número inteiro. `app.js` recusa carregar (`validateEngine()`) se não
bater com `SUPPORTED_ENGINE_VERSION`. Suba este número só em mudança
de contrato que quebra compatibilidade (como v2→v3 fez).

### `meta: { title, subtitle }`

Texto exibido no cabeçalho do visualizador. **Não** é o mesmo texto de
`manifest.js.title` (que aparece no catálogo) — são dois textos com
propósitos diferentes (catálogo curto vs. cabeçalho descritivo), não
duplicação a ser eliminada.

### `input.schema: [{ key, label, type, default, placeholder, minItems?, maxItems? }]`

Um ou mais campos de entrada. `app.js` gera o formulário genericamente
a partir daqui (`buildConfigForm`) e valida/converte com `parseField`.
Tipos suportados hoje: `"number"`, `"number-list"`, `"string"`.
Adicionar um tipo novo = um `case` novo em `parseField`, único lugar
em `app.js` que precisa saber disso.

### `code: { lines: string[], highlight: (line) => htmlString }`

`lines` é o código-fonte estático exibido, um item por linha (1-index
correspondendo a `step.line`). `highlight` recebe uma linha crua e
devolve HTML — **exceção documentada** à regra de nunca gerar HTML a
partir de dado do usuário, porque opera só sobre `CODE_LINES`, string
estática do próprio engine.

### `visualization.legend: [{ role, status, label }]`

Alimenta a legenda de cores abaixo da lista (`renderLegend`).

### `events: { [eventName]: { icon } }`

Vocabulário de apresentação: qual ícone (nome de um Material Symbol)
mostrar pra cada evento. Introduzido na v3 pra tirar do `app.js` o
dicionário `EVENT_ICON` + aliases que crescia a cada engine novo — o
shell só lê `ENGINE.events[step.event]?.icon`, nunca precisa conhecer
os eventos de nenhum algoritmo específico.

> **Hipótese em aberto:** desde a unificação do `StatusToken`
> (`types/engine.d.ts`), `elements[].status` e `stack[].vars[].status`
> compartilham o mesmo vocabulário fechado (`neutral`/`pending`/
> `active`/`resolved`). Hoje só `stack[].vars[].status` tem consumidor
> visual (`.pending`/`.resolved`/`.expr-box .final` em `style.css`,
> ligados aos tokens `--state-*`) — `elements[].status` é sempre
> `"active"` em todo algoritmo atual e não tem nenhum tratamento visual
> em `.box`; só `role` (`--first`/`--rest`) pinta a lista. Quando um
> algoritmo produzir elementos com `status` variando de verdade num
> mesmo passo (candidato: quicksort, comparando vários elementos ao
> pivô ao mesmo tempo), `role` e `status` devem ocupar canais visuais
> independentes em `.box` — não decidir agora _qual_ canal (borda,
> halo, animação etc.), só que não podem colidir no canal que `role`
> já ocupa hoje (`background-color`). Decidir o canal só com o caso
> real na tela, não especulativamente.

### `buildTrace(inputs) => { steps, tree }`

O motor do algoritmo. `inputs` vem de `collectInputs()` (já validado
pelo schema). Devolve:

- `steps`: array linear de passos, na ordem de execução — o que
  alimenta a timeline, o slider e o autoplay. Cada `step` tem:

  ```js
  {
    event: string,       // chave em ENGINE.events / ENGINE.messages
    phase: "DESCENDO" | "SUBINDO",
    line: number,        // 1-index em ENGINE.code.lines
    depth: number | null, // null = fora de qualquer frame (ex.: wrapper)
    frameId: number | null,
    stack: [{ title, depth, vars: [{k, v, status?}] }],
    elements: [{ text, role, status, id }],
    payload: object,      // dado bruto, consumido por ENGINE.messages[event]
  }
  ```

- `tree`: árvore de chamadas via `node.children` (nunca `childId =
frameId + 1` — isso quebraria em algoritmos com mais de uma chamada
  recursiva por frame, ex. quicksort/mergesort/Fibonacci, que o design
  já antecipa). `null` em algoritmos sem recursão (ex. `call-stack`).

`payload` guarda só o dado bruto — a narrativa não é pré-computada
dentro do step, pra não manter duas cópias da mesma informação.

### `buildExpression(traceResult, stepIndex) => { nodes }`

Constrói a expressão matemática (ou análogo — no `call-stack` é o log
de saída acumulada) até o passo atual, navegando por `tree.children`.
`nodes` é um array de strings simples e/ou `{type, text, final?}` —
nunca HTML pronto.

### `messages: { [eventName]: (payload) => nodes[] }`

Catálogo de narrativas. Cada função devolve nós estruturados (mesma
forma de `nodes` acima). `app.js` resolve
`ENGINE.messages[step.event](step.payload)` na hora de renderizar —
nunca pré-computado.

## Regra de ouro (vale para `messages`, `buildExpression`, e qualquer coisa que chegue a `render()`)

Nada, além de `code.highlight` (exceção documentada acima), produz
HTML a partir de dado do usuário. Narrativa e expressão só devolvem
strings simples ou `{type: "strong"|"code", text}` — `app.js` decide
como isso vira DOM via `createElement`/`textContent`, nunca
`innerHTML`.

## `algorithms/_shared/engine-kit.js`

Utilidades mecânicas, idênticas entre engines. Exporta cada função;
cada `engine.js` importa só o que usa:

- `escapeHtml(str)`
- `strong(v)` / `code(v)` — construtores dos nós estruturados acima
- `highlightCode(rawLine, { keywords?, types?, macros? })` —
  highlight de sintaxe agnóstico de linguagem
- `elementsForHeadTail(list)` — gera `elements` pro padrão "cabeça =
  primary, resto = secondary" (recursão cabeça+cauda: soma, conta,
  maior). Engines com destaque diferente (o meio, uma cadeia, um
  parâmetro único) escrevem seu próprio `elementsFor` — a regra de
  destaque é genuinamente diferente, não cópia.

**Não** vive aqui: `buildTrace`, `messages`, `buildExpression`,
`CODE_LINES` — isso é o conteúdo de cada algoritmo, nunca abstraído.

## Validação (`app.js`, `validateEngine()`)

Duas checagens complementares, rodadas na inicialização (dentro de
`initApp(engine)`), que definem o que torna um `engine.js` válido:

1. **Estrutural** (`validateEngineStructure`) — compara
   `Object.keys(ENGINE.events)` com `Object.keys(ENGINE.messages)`
   diretamente, sem rodar nada. Pega eventos que existem no código mas
   que os defaults do schema nunca exercitariam via `buildTrace` (ex.:
   `recurse-right` na busca binária só aparece se o alvo cair na
   metade direita).
2. **Comportamental** (`validateEngineBehavior`) — roda `buildTrace`
   com os defaults do próprio schema e confere que todo evento
   _realmente emitido_ tem narrativa. Pega o erro oposto: uma string
   de evento usada dentro de `buildTrace` mas nunca declarada em
   `ENGINE.events`/`ENGINE.messages` (típico erro de digitação).

Em ambas: narrativa ausente é erro (`render()` quebraria);
ícone ausente é só warning (engine pode escolher não ter ícone pra um
evento).

Um `engine.js` novo precisa passar nas duas checagens com os defaults
do próprio `input.schema` — isso é testado automaticamente toda vez
que a página carrega esse algoritmo.

## Histórico de versões do contrato

- **v2**: contrato original com `event/phase/line/depth/frameId/
stack/elements/payload`, `messages`, `buildTrace`, `buildExpression`.
  Ícone por evento vivia hardcoded em `app.js` (`EVENT_ICON` + aliases).
- **v3**: `ENGINE.events` — cada engine passa a ser dono do ícone dos
  próprios eventos. `app.js` para de conhecer o vocabulário de eventos
  de qualquer algoritmo específico. `validateEngine()` ganha checagem
  estrutural além da comportamental. Duplicação mecânica
  (`escapeHtml`/`strong`/`code`/`highlightRust`/`elementsFor`
  cabeça+cauda) extraída para `algorithms/_shared/engine-kit.js`.

## Próximas hipóteses a testar (não implementar preventivamente)

Ordem sugerida ao adicionar algoritmos, do que menos tensiona o
contrato pro que mais tensiona:

1. **Fibonacci ingênuo** — `node.children` com múltiplos filhos +
   volume grande de steps (testa a timeline com milhares de passos).
   Barato de implementar, dois sinais de uma vez.
2. **Quicksort** — provável primeira fricção real de vocabulário
   visual (`role`/`status` — ver hipótese acima).
3. **Mergesort** — fase de combinação de duas recursões.
4. **DFS** — árvore/grafo arbitrário; deve caber sem fricção (mesmo
   modelo de pilha de chamadas).
5. **BFS** — candidato a genuinamente não caber: não é recursivo, não
   tem pilha, tem fila. Se aparecer `if (algorithm === "bfs")` em
   `app.js`, isso não é falha de arquitetura — é o sinal de decidir se
   o projeto é "visualizador de recursão" ou "visualizador de
   algoritmos" em geral. (Essa última pergunta já é mais de
   arquitetura do que de contrato — ver também ARCHITECTURE.md se
   isso avançar.)
