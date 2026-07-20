// types/engine.d.ts
//
// Tipos ambiente para o contrato ENGINE v3 (ver docs/ENGINE.md).
// Sem import/export de propósito: isso faz deste arquivo um "script",
// não um módulo, então toda interface abaixo fica global — acessível
// via /** @type {Engine} */ em qualquer engine.js ou em app.js, sem
// precisar de import.

type InputFieldType = "number" | "number-list" | "string";

interface InputField {
  key: string;
  label: string;
  type: InputFieldType;
  default: string;
  placeholder: string;
  minItems?: number;
  maxItems?: number;
}

interface EngineInput {
  schema: InputField[];
}

interface CodeBlock {
  lines: string[];
  highlight: (rawLine: string) => string;
}

type ElementRole = "primary" | "secondary";

interface LegendEntry {
  role: ElementRole;
  status: string;
  label: string;
}

interface Visualization {
  legend: LegendEntry[];
}

interface EventDef {
  icon: string;
}

type EngineEvents = Record<string, EventDef>;

interface TraceElement {
  text: string;
  role: ElementRole;
  status: string;
}

interface StackVar {
  k: string;
  v: string | null;
  pending?: boolean;
  emphasis?: string | null;
}

interface StackFrame {
  title: string;
  depth: number;
  vars: StackVar[];
}

interface TraceStep {
  event: string;
  phase: "DESCENDO" | "SUBINDO";
  line: number;
  depth: number | null;
  frameId: number | null;
  stack: StackFrame[];
  elements: TraceElement[];
  payload: any;
}

interface TraceTreeNode {
  id: number;
  children: TraceTreeNode[];
  [extra: string]: unknown;
}

interface TraceResult {
  steps: TraceStep[];
  tree: TraceTreeNode | null;
}

type MessageNode =
  string | { type: "strong" | "code"; text: string; final?: boolean };

type MessagesMap = Record<string, (payload: any) => MessageNode[]>;

interface ExpressionResult {
  nodes: MessageNode[];
}

interface Engine {
  version: number;
  meta: {
    title: string;
    subtitle: string;
  };
  input: EngineInput;
  code: CodeBlock;
  visualization: Visualization;
  events: EngineEvents;
  buildTrace: (inputs: any) => TraceResult;
  buildExpression: (
    traceResult: TraceResult,
    stepIndex: number,
  ) => ExpressionResult;
  messages: MessagesMap;
}
