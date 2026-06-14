import Editor, { type OnMount } from "@monaco-editor/react";
import type * as monaco from "monaco-editor";
import type { Diagnostic, Instruction } from "../../engine";

type CodeEditorProps = {
  source: string;
  diagnostics: Diagnostic[];
  currentInstruction: Instruction | null;
  onChange: (source: string) => void;
  theme: "light" | "dark";
};

export function CodeEditor({ source, diagnostics, currentInstruction, onChange, theme }: CodeEditorProps) {
  const handleMount: OnMount = (editor, monacoApi) => {
    defineThemes(monacoApi);
    monacoApi.editor.setTheme(theme === "dark" ? "sketch86-dark" : "sketch86-light");
    const model = editor.getModel();
    if (model) applyMarkers(monacoApi, model, diagnostics);
  };

  const beforeMount = (monacoApi: typeof monaco) => {
    monacoApi.languages.register({ id: "sketch86asm" });
    monacoApi.languages.setMonarchTokensProvider("sketch86asm", {
      tokenizer: {
        root: [
          [/;.*$/, "comment"],
          [/"[^"]*"|'[^']*'/, "string"],
          [/\b(?:MOV|ADD|SUB|CMP|JMP|JE|JNE|JNZ|LOOP|CALL|RET|INT|HLT|PUSH|POP|DIV|MUL|AND|OR|XOR|NOT|TEST|SHL|SHR)\b/i, "keyword"],
          [/\b(?:AX|BX|CX|DX|AH|AL|BH|BL|CH|CL|DH|DL|SI|DI|BP|SP|CS|DS|ES|SS|IP)\b/i, "type.identifier"],
          [/\b(?:[0-9A-F]+h|[01]+b|\d+)\b/i, "number"]
        ]
      }
    });
    defineThemes(monacoApi);
  };

  return (
    <div className="editorShell">
      <div className="activeLineNote">
        {currentInstruction ? `Next: ${currentInstruction.text} @ ${currentInstruction.address.toString(16).toUpperCase().padStart(4, "0")}h` : "No active instruction"}
      </div>
      <Editor
        height="100%"
        language="sketch86asm"
        value={source}
        theme={theme === "dark" ? "sketch86-dark" : "sketch86-light"}
        beforeMount={beforeMount}
        onMount={handleMount}
        onChange={(value) => onChange(value ?? "")}
        options={{
          minimap: { enabled: false },
          fontFamily: "Comic Code, Comic Mono, Cascadia Mono, Fira Code, Consolas, monospace",
          fontSize: 14,
          lineHeight: 22,
          wordWrap: "on",
          scrollBeyondLastLine: false,
          smoothScrolling: true,
          glyphMargin: true,
          lineNumbersMinChars: 3
        }}
      />
    </div>
  );
}

function defineThemes(monacoApi: typeof monaco) {
  monacoApi.editor.defineTheme("sketch86-light", {
      base: "vs",
      inherit: true,
      rules: [
        { token: "keyword", foreground: "27706c", fontStyle: "bold" },
        { token: "number", foreground: "a85f38" },
        { token: "string", foreground: "6f5632" },
        { token: "comment", foreground: "7b817f", fontStyle: "italic" }
      ],
      colors: {
        "editor.background": "#fffdfa",
        "editor.foreground": "#23201c",
        "editor.lineHighlightBackground": "#f1d58a55",
        "editorCursor.foreground": "#a85f38",
        "editorLineNumber.foreground": "#8b8271",
        "editorLineNumber.activeForeground": "#27706c"
      }
    });

  monacoApi.editor.defineTheme("sketch86-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "keyword", foreground: "82d7cc", fontStyle: "bold" },
      { token: "number", foreground: "f0aa75" },
      { token: "string", foreground: "f3d989" },
      { token: "comment", foreground: "9da6a0", fontStyle: "italic" }
    ],
    colors: {
      "editor.background": "#181b1a",
      "editor.foreground": "#f4ead3",
      "editor.lineHighlightBackground": "#31413d88",
      "editorCursor.foreground": "#f0aa75",
      "editorLineNumber.foreground": "#7f8983",
      "editorLineNumber.activeForeground": "#82d7cc"
    }
  });
}

function applyMarkers(monacoApi: typeof monaco, model: monaco.editor.ITextModel, diagnostics: Diagnostic[]) {
  monacoApi.editor.setModelMarkers(
    model,
    "sketch86",
    diagnostics.map((diagnostic) => ({
      severity: diagnostic.severity === "error" ? monacoApi.MarkerSeverity.Error : monacoApi.MarkerSeverity.Warning,
      message: diagnostic.message,
      startLineNumber: diagnostic.location.line,
      startColumn: diagnostic.location.column,
      endLineNumber: diagnostic.location.line,
      endColumn: diagnostic.location.column + 1
    }))
  );
}
