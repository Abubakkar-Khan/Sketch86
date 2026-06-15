import { useEffect, useRef } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import type * as monaco from "monaco-editor";
import type { Diagnostic, Instruction } from "../../engine";

type CodeEditorProps = {
  source: string;
  diagnostics: Diagnostic[];
  currentInstruction: Instruction | null;
  executedLineNumber?: number;
  onChange: (source: string) => void;
  theme: "light" | "dark";
};

export function CodeEditor({ source, diagnostics, currentInstruction, executedLineNumber, onChange, theme }: CodeEditorProps) {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof monaco | null>(null);
  const decorationsRef = useRef<string[]>([]);

  const handleMount: OnMount = (editor, monacoApi) => {
    editorRef.current = editor;
    monacoRef.current = monacoApi;
    defineThemes(monacoApi);
    monacoApi.editor.setTheme(theme === "dark" ? "sketch86-dark" : "sketch86-light");
    const model = editor.getModel();
    if (model) applyMarkers(monacoApi, model, diagnostics);

    const root = editor.getDomNode();
    const handleWheel = (event: WheelEvent) => {
      if (!event.deltaY) return;
      const layoutHeight = editor.getLayoutInfo().height;
      const maxScrollTop = Math.max(0, editor.getScrollHeight() - layoutHeight);
      const scrollTop = editor.getScrollTop();
      const atTop = scrollTop <= 0;
      const atBottom = scrollTop >= maxScrollTop - 1;
      if ((event.deltaY < 0 && atTop) || (event.deltaY > 0 && atBottom)) {
        event.preventDefault();
        window.scrollBy({ top: event.deltaY, behavior: "auto" });
      }
    };

    root?.addEventListener("wheel", handleWheel, { passive: false });
    editor.onDidDispose(() => root?.removeEventListener("wheel", handleWheel));
  };

  useEffect(() => {
    const editor = editorRef.current;
    const monacoApi = monacoRef.current;
    const model = editor?.getModel();
    if (!editor || !monacoApi || !model) return;
    applyMarkers(monacoApi, model, diagnostics);
  }, [diagnostics]);

  useEffect(() => {
    const editor = editorRef.current;
    const monacoApi = monacoRef.current;
    if (!editor || !monacoApi) return;
    monacoApi.editor.setTheme(theme === "dark" ? "sketch86-dark" : "sketch86-light");
  }, [theme]);

  useEffect(() => {
    const editor = editorRef.current;
    const monacoApi = monacoRef.current;
    if (!editor || !monacoApi) return;

    const lineNumber = executedLineNumber && executedLineNumber > 0 ? executedLineNumber : currentInstruction?.lineNumber;
    decorationsRef.current = editor.deltaDecorations(
      decorationsRef.current,
      lineNumber
        ? [
            {
              range: new monacoApi.Range(lineNumber, 1, lineNumber, 1),
              options: {
                isWholeLine: true,
                className: executedLineNumber ? "executedLineHighlight" : "nextLineHighlight",
                glyphMarginClassName: executedLineNumber ? "executedLineGlyph" : "nextLineGlyph",
                linesDecorationsClassName: executedLineNumber ? "executedLineMarker" : "nextLineMarker"
              }
            }
          ]
        : []
    );
    if (lineNumber) editor.revealLineInCenterIfOutsideViewport(lineNumber);
  }, [currentInstruction?.lineNumber, executedLineNumber]);

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
        {executedLineNumber
          ? `Executed line ${executedLineNumber}`
          : currentInstruction
            ? `Next: ${currentInstruction.text} @ ${currentInstruction.address.toString(16).toUpperCase().padStart(4, "0")}h`
            : "No active instruction"}
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
          fontFamily: "Comic Sans MS, Comic Neue, Trebuchet MS, Segoe UI, sans-serif",
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
        { token: "keyword", foreground: "236f70", fontStyle: "bold" },
        { token: "number", foreground: "9d5d33" },
        { token: "string", foreground: "6b5428" },
        { token: "comment", foreground: "7c766b", fontStyle: "italic" }
      ],
      colors: {
        "editor.background": "#fffdfa",
        "editor.foreground": "#23201c",
        "editor.lineHighlightBackground": "#f1d58a55",
        "editorCursor.foreground": "#9d5d33",
        "editorLineNumber.foreground": "#8b8271",
        "editorLineNumber.activeForeground": "#236f70"
      }
    });

  monacoApi.editor.defineTheme("sketch86-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "keyword", foreground: "7ed7c5", fontStyle: "bold" },
      { token: "number", foreground: "f1b06d" },
      { token: "string", foreground: "f4d783" },
      { token: "comment", foreground: "b8ad9b", fontStyle: "italic" }
    ],
    colors: {
      "editor.background": "#221d18",
      "editor.foreground": "#fff1cf",
      "editor.lineHighlightBackground": "#4b392866",
      "editorCursor.foreground": "#f1b06d",
      "editorLineNumber.foreground": "#9b8f7a",
      "editorLineNumber.activeForeground": "#7ed7c5"
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
