import { useEffect, useMemo, useRef, useState } from "react";
import { assemble, createCPU, getSupportMatrix, type CPU8086, type ExecutionState, type TraceEntry } from "./engine";
import { CodeEditor } from "./components/editor/CodeEditor";
import { RegistersPanel } from "./components/registers/RegistersPanel";
import { FlagsPanel } from "./components/flags/FlagsPanel";
import { MemoryPanel } from "./components/memory/MemoryPanel";
import { StackPanel } from "./components/stack/StackPanel";
import { ConsolePanel } from "./components/console/ConsolePanel";
import { RoughBorder } from "./components/rough/RoughBorder";
import { RoughDiagram } from "./components/rough/RoughDiagram";
import { RoughPanel } from "./components/rough/RoughPanel";
import { SupportMatrix } from "./components/docs/SupportMatrix";
import { Tabs, type AppTab } from "./components/layout/Tabs";
import { examples } from "./examples";

const SPEED_OPTIONS = [
  { id: "slow", label: "Slow", delay: 600 },
  { id: "normal", label: "Normal", delay: 220 },
  { id: "fast", label: "Fast", delay: 80 },
  { id: "turbo", label: "Turbo", delay: 20 }
] as const;

type RunSpeed = (typeof SPEED_OPTIONS)[number]["id"];
type ThemeMode = "light" | "dark";

function getInitialTheme(): ThemeMode {
  if (typeof window === "undefined") return "light";
  const saved = window.localStorage.getItem("sketch86-theme");
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function initialState(cpu?: CPU8086): ExecutionState {
  return cpu?.state() ?? {
    registers: { AX: 0, BX: 0, CX: 0, DX: 0, SI: 0, DI: 0, BP: 0, SP: 0xfffe, CS: 0, DS: 0, ES: 0, SS: 0, IP: 0x100 },
    flags: { CF: false, PF: false, AF: false, ZF: false, SF: false, TF: false, IF: false, DF: false, OF: false },
    memory: new Uint8Array(1024 * 1024),
    segments: { CS: 0, DS: 0, ES: 0, SS: 0 },
    ip: 0x100,
    halted: false,
    waitingForInput: false,
    currentInstruction: null,
    trace: [],
    output: [],
    errors: []
  };
}

export default function App() {
  const [source, setSource] = useState(examples[8].source);
  const [sourceRevision, setSourceRevision] = useState(0);
  const [activeTab, setActiveTab] = useState<AppTab>("lab");
  const assembled = useMemo(() => assemble(source), [source]);
  const cpuRef = useRef<CPU8086 | undefined>();
  const timerRef = useRef<number | undefined>();
  const pausedForInputRef = useRef(false);
  const [state, setState] = useState<ExecutionState>(() => initialState());
  const [lastTrace, setLastTrace] = useState<TraceEntry | undefined>();
  const [terminalInput, setTerminalInput] = useState("");
  const [runSpeed, setRunSpeed] = useState<RunSpeed>("normal");
  const [theme, setTheme] = useState<ThemeMode>(() => getInitialTheme());
  const [isRunning, setIsRunning] = useState(false);
  const supportMatrix = useMemo(() => getSupportMatrix(), []);
  const runDelay = SPEED_OPTIONS.find((option) => option.id === runSpeed)?.delay ?? 220;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("sketch86-theme", theme);
  }, [theme]);

  useEffect(() => {
    window.clearInterval(timerRef.current);
    setIsRunning(false);
    pausedForInputRef.current = false;
    if (assembled.program) {
      cpuRef.current = createCPU(assembled.program);
      setState(cpuRef.current.state());
      setLastTrace(undefined);
    } else {
      cpuRef.current = undefined;
      setState(initialState());
      setLastTrace(undefined);
    }
  }, [assembled.program]);

  const sync = (trace?: TraceEntry) => {
    if (!cpuRef.current) return;
    setState(cpuRef.current.state());
    if (trace) setLastTrace(trace);
  };

  const step = () => {
    if (!cpuRef.current) return;
    pausedForInputRef.current = false;
    sync(cpuRef.current.step());
  };

  const tick = () => {
    const snapshot = cpuRef.current?.state();
    if (!cpuRef.current || snapshot?.halted || snapshot?.waitingForInput) {
      pausedForInputRef.current = Boolean(snapshot?.waitingForInput);
      window.clearInterval(timerRef.current);
      setIsRunning(false);
      return;
    }
    sync(cpuRef.current.step());
  };

  const run = () => {
    window.clearInterval(timerRef.current);
    if (!cpuRef.current || state.halted || state.waitingForInput) return;
    pausedForInputRef.current = false;
    setIsRunning(true);
    timerRef.current = window.setInterval(tick, runDelay);
  };

  const stop = () => {
    window.clearInterval(timerRef.current);
    pausedForInputRef.current = false;
    setIsRunning(false);
  };

  const reset = () => {
    window.clearInterval(timerRef.current);
    setIsRunning(false);
    pausedForInputRef.current = false;
    if (assembled.program) {
      cpuRef.current = createCPU(assembled.program);
      setState(cpuRef.current.state());
      setLastTrace(undefined);
      setTerminalInput("");
    }
  };

  const updateSource = (nextSource: string) => {
    setSource(nextSource);
    setSourceRevision((revision) => revision + 1);
  };

  const loadExample = (id: string) => {
    const example = examples.find((item) => item.id === id) ?? examples[0];
    setSource(example.source);
    setSourceRevision((revision) => revision + 1);
    setTerminalInput("");
    setActiveTab("lab");
  };

  const sendTerminalInput = () => {
    if (!cpuRef.current) return;
    const wasWaiting = cpuRef.current.state().waitingForInput;
    if (!wasWaiting) return;
    const shouldResumeRun = pausedForInputRef.current;
    cpuRef.current.provideInput(terminalInput.length > 0 ? terminalInput : "\r");
    setTerminalInput("");
    sync(cpuRef.current.step());
    const snapshot = cpuRef.current.state();
    if (shouldResumeRun && !snapshot.halted && !snapshot.waitingForInput) {
      pausedForInputRef.current = false;
      setIsRunning(true);
      window.clearInterval(timerRef.current);
      timerRef.current = window.setInterval(tick, runDelay);
    }
  };

  const updateRunSpeed = (speed: RunSpeed, delay: number) => {
    setRunSpeed(speed);
    if (!isRunning) return;
    window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(tick, delay);
  };

  const currentInstruction = state.currentInstruction;
  const changes = lastTrace?.changes ?? { registers: [], flags: [], memory: [], stack: [] };

  return (
    <div className="appShell">
      <header className="topBar roughShape">
        <RoughBorder strokeWidth={1.8} roughness={1.55} inset={3} />
        <div className="brandBlock">
          <h1>Sketch86</h1>
          <p className="tagline">8086 assembly lab</p>
        </div>
        <div className="toolbarGroup executionGroup" aria-label="Execution controls">
          <button className="primary roughShape" onClick={run} disabled={!assembled.program || state.halted || state.waitingForInput}><RoughBorder />{isRunning ? "Running" : "Run"}</button>
          <button className="roughShape" onClick={step} disabled={!assembled.program || state.halted}><RoughBorder />Step</button>
          <button className="roughShape" onClick={reset} disabled={!assembled.program}><RoughBorder />Reset</button>
          <button className="roughShape" onClick={stop}><RoughBorder />Stop</button>
        </div>
        <div className="toolbarGroup settingsGroup" aria-label="Simulator settings">
          <span className="controlLabel">Speed</span>
          <div className="segmentedControl" role="group" aria-label="Run speed">
            {SPEED_OPTIONS.map((option) => (
              <button
                className={`speedButton roughShape ${runSpeed === option.id ? "active" : ""}`}
                key={option.id}
                onClick={() => updateRunSpeed(option.id, option.delay)}
                type="button"
              >
                <RoughBorder strokeWidth={1.35} roughness={1.45} inset={2} />
                {option.label}
              </button>
            ))}
          </div>
          <button className="themeToggle roughShape" onClick={() => setTheme(theme === "light" ? "dark" : "light")} type="button" aria-pressed={theme === "dark"}>
            <RoughBorder />
            {theme === "dark" ? "Light" : "Dark"}
          </button>
        </div>
      </header>

      <Tabs active={activeTab} onChange={setActiveTab} />

      {activeTab === "lab" && (
        <main className="labGrid">
          <RoughPanel className="editorPanel" redrawKey={sourceRevision}>
            <div className="panelHeader">
              <h2>Code Editor</h2>
              <span>Monaco diagnostics</span>
            </div>
            <CodeEditor
              source={source}
              diagnostics={assembled.diagnostics}
              currentInstruction={currentInstruction}
              executedLineNumber={lastTrace?.lineNumber}
              onChange={updateSource}
              theme={theme}
            />
          </RoughPanel>
          <RoughPanel className="sketchPanel">
            <div className="panelHeader">
              <h2>Execution Sketch</h2>
              <span>{state.waitingForInput ? "input needed" : state.halted ? "halted" : `IP ${state.registers.IP.toString(16).toUpperCase().padStart(4, "0")}h`}</span>
            </div>
            <RoughDiagram trace={lastTrace} theme={theme} />
          </RoughPanel>
          <RegistersPanel snapshot={state} changes={changes.registers} />
          <FlagsPanel snapshot={state} changes={changes.flags} />
          <ConsolePanel
            output={state.output}
            trace={state.trace}
            diagnostics={assembled.diagnostics}
            errors={state.errors}
            input={terminalInput}
            onInputChange={setTerminalInput}
            onSendInput={sendTerminalInput}
            disabled={!assembled.program}
            waitingForInput={state.waitingForInput}
          />
          <MemoryPanel state={state} program={assembled.program} changes={changes.memory} />
          <StackPanel state={state} changes={changes.stack} />
        </main>
      )}

      {activeTab === "examples" && (
        <main className="examplesGrid">
          {examples.map((example) => (
            <button className="exampleCard roughShape" key={example.id} onClick={() => loadExample(example.id)}>
              <RoughBorder strokeWidth={2.2} roughness={1.8} />
              <span>{example.difficulty}</span>
              <h2>{example.title}</h2>
              <p>{example.explanation}</p>
              <small>{example.concepts.join(" / ")}</small>
            </button>
          ))}
        </main>
      )}

      {activeTab === "support" && <SupportMatrix entries={supportMatrix} />}
    </div>
  );
}
