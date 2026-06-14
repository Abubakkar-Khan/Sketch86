import type { Diagnostic, RuntimeError, TraceEntry } from "../../engine";
import { RoughBorder } from "../rough/RoughBorder";
import { RoughPanel } from "../rough/RoughPanel";

type ConsolePanelProps = {
  output: string[];
  trace: TraceEntry[];
  diagnostics: Diagnostic[];
  errors: RuntimeError[];
  input: string;
  disabled?: boolean;
  waitingForInput?: boolean;
  onInputChange: (value: string) => void;
  onSendInput: () => void;
};

export function ConsolePanel({ output, trace, diagnostics, errors, input, disabled = false, waitingForInput = false, onInputChange, onSendInput }: ConsolePanelProps) {
  const last = trace.at(-1);
  return (
    <RoughPanel className="consolePanel">
      <div className="panelHeader">
        <h2>Console / Explanation</h2>
        <span>{waitingForInput ? "waiting for stdin" : last ? `line ${last.lineNumber}` : "ready"}</span>
      </div>
      <pre className="outputBox">{output.join("") || "No program output yet."}</pre>
      <div className="terminalInputRow">
        <span className="terminalPrompt">stdin</span>
        <span className="terminalInputWrap roughShape">
          <RoughBorder strokeWidth={1.6} roughness={1.8} />
          <input
            value={input}
            disabled={disabled}
            placeholder={waitingForInput ? "Input needed now" : "Type characters for INT 21h AH=01h"}
            onChange={(event) => onInputChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onSendInput();
              }
            }}
          />
        </span>
        <button className="terminalSend roughShape" disabled={disabled} onClick={onSendInput}>
          <RoughBorder strokeWidth={1.6} roughness={1.8} />
          Send
        </button>
      </div>
      <div className="explanationBox">
        {last?.explanation ?? "Assemble and step through a program to see explanations."}
      </div>
      {(diagnostics.length > 0 || errors.length > 0) && (
        <div className="diagnosticsBox">
          {[...diagnostics, ...errors.map((error) => ({ message: error.message, location: { line: error.lineNumber ?? 0, column: 1, offset: 0 }, severity: "error" as const }))].map((item, index) => (
            <div key={`${item.message}-${index}`}>Line {item.location.line || "runtime"}: {item.message}</div>
          ))}
        </div>
      )}
    </RoughPanel>
  );
}
