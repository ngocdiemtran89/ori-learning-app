import { describe, it, expect } from 'vitest';
import {
  summarizeTextPanel,
  getNumberContextsForPanel,
  getCandidateLineDiagnosticsForPanel,
  generatePart6DebugSnapshot,
} from './part6DiagnosticUtils';
import { parseSeparateBilingualPartContent } from './partContentBulkParser';

describe('Part 6 Diagnostic Instrumentation Suite', () => {
  const sampleInput = `QUESTIONS 131-134\nPassage with ------- 131.\n\n**131.**\n(A) Candy\n(B) Cheese\n(C) Bread\n(D) Pasta\n`;

  it('1. summarizeTextPanel captures counts and whitespace metrics', () => {
    const summary = summarizeTextPanel(sampleInput);
    expect(summary.characterCount).toBeGreaterThan(0);
    expect(summary.lineCount).toBe(9);
    expect(summary.nonEmptyLineCount).toBe(7);
    expect(summary.escapedSnippet).toContain('QUESTIONS 131-134');
    expect(summary.whitespaceCounts.lf).toBeGreaterThan(0);
  });

  it('2. getNumberContextsForPanel captures context snippets around 131', () => {
    const contexts = getNumberContextsForPanel(sampleInput, 'Test Panel');
    expect(contexts.length).toBeGreaterThan(0);
    expect(contexts[0].number).toBe(131);
    expect(contexts[0].sourcePanel).toBe('Test Panel');
    expect(contexts[0].snippet).toContain('131');
  });

  it('3. getCandidateLineDiagnosticsForPanel analyzes candidate question lines', () => {
    const diags = getCandidateLineDiagnosticsForPanel(sampleInput, 'Test Panel');
    expect(diags.length).toBeGreaterThan(0);

    const line131 = diags.find(d => d.recognizedQuestionNumber === 131);
    expect(line131).toBeDefined();
    expect(line131?.bareQuestionMatch).toBe(true);
    expect(line131?.codePoints.length).toBeGreaterThan(0);
  });

  it('4. generatePart6DebugSnapshot produces complete diagnostic JSON payload', () => {
    const merged = parseSeparateBilingualPartContent(sampleInput, '', 'part6');
    const snapshot = generatePart6DebugSnapshot(sampleInput, '', '', '', '', 'questions', 'part6', merged);

    expect(snapshot.debugBuild).toBe('P6-RUNTIME-01');
    expect(snapshot.normPart).toBe('part6');
    expect(snapshot.panelSummaries.enQuestion.characterCount).toBe(sampleInput.length);
    expect(snapshot.mergedResult.groupsCount).toBe(1);
    expect(snapshot.mergedResult.questionsCount).toBe(1);
  });
});
