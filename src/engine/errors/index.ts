import type { Diagnostic } from "../types";

export function formatDiagnostic(diagnostic: Diagnostic): string {
  return `Line ${diagnostic.location.line}: ${diagnostic.message}`;
}
