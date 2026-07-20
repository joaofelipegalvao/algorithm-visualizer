# Visualizador de Algoritmos

## O que é

Um depurador interativo para aprender algoritmos recursivos visualizando cada etapa da execução no navegador.

Em vez de só ler o código e imaginar o que acontece, você navega passo a passo (avançar/voltar) em uma visualização interativa e acompanha em cada etapa: como as chamadas se acumulam, como a pilha muda e como o resultado final é resolvido no retorno da recursão.

## Recursos

- Navegação passo a passo pela execução (Voltar / Avançar)
- Visualização da execução: código destacado, pilha de chamadas e evolução da expressão recursiva
- Formulário de entrada gerado dinamicamente a partir do schema de cada algoritmo
- Alternância entre tema claro e escuro
- Interface em português
- Catálogo de algoritmos com seleção por `?algoritmo=<id>`

## Como executar

### Online

Acesse a demonstração publicada:

**[https://joaofelipegalvao.github.io/algorithm-visualizer/](https://joaofelipegalvao.github.io/algorithm-visualizer/)**

### Localmente (desenvolvimento)

O projeto utiliza ES Modules e precisa ser servido via HTTP.

```bash
python3 -m http.server 8000
# ou
npx serve
```

Depois, no navegador:

- Catálogo: acesse `index.html` na raiz
- Um algoritmo específico: `visualizer/index.html?algoritmo=<id>`

## Algoritmos disponíveis

Atualmente suporta:

- Contagem regressiva (`recursive-count`)
- Fatorial (`factorial`)
- Soma de lista (`recursive-sum`)
- Visualização de pilha de chamadas (`call-stack`)
- Máximo em lista (`max-element`)
- Busca binária (`binary-search`)

A lista oficial e atualizada está no [`manifest.js`](./manifest.js).

## Para desenvolvedores

Para adicionar novos algoritmos ou entender a arquitetura interna:

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — loader, ES Modules, decisões arquiteturais, estrutura de diretórios
- [`ENGINE.md`](./ENGINE.md) — contrato completo do `ENGINE`, campos obrigatórios, validação, histórico de versões

## Validação

```bash
npm run check
```

Executa a validação estática do projeto usando TypeScript (`checkJs`).

## Licença

Este projeto está licenciado sob a licença MIT. Veja [`LICENSE`](./LICENSE) para o texto completo.
