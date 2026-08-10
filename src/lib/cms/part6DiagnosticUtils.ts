// ============================================================
// Phase P3.5J Diagnostic Tooling: Read-Only Part 6 Runtime Diagnostic Helper
// Does NOT modify any parser logic or application state.
// ============================================================

import { parseSingleLanguagePartText, PartParseResult } from './partContentBulkParser';

export interface PanelTextSummary {
  characterCount: number;
  lineCount: number;
  nonEmptyLineCount: number;
  escapedSnippet: string;
  whitespaceCounts: {
    crlf: number;
    lf: number;
    cr: number;
    nbsp: number;
    zwsp: number;
    nnbsp: number;
    bom: number;
  };
}

export interface CandidateLineDiagnostic {
  lineNumber: number;
  sourcePanel: string;
  rawLine: string;
  trimmedLine: string;
  cleanHeader: string;
  normalizedHeader: string;
  codePoints: string[];
  rangeHeaderMatch: boolean;
  explicitQuestionMatch: boolean;
  bareQuestionMatch: boolean;
  sameLineOptionMatch: boolean;
  optionMatch: boolean;
  recognizedQuestionNumber: number | null;
}

export interface NumberOccurrenceContext {
  number: number;
  sourcePanel: string;
  index: number;
  snippet: string;
}

export interface Part6DiagnosticSnapshot {
  debugBuild: string;
  timestamp: string;
  normPart: string;
  mainTab: string;
  panelSummaries: {
    enQuestion: PanelTextSummary;
    viQuestion: PanelTextSummary;
    enTranscript: PanelTextSummary;
    viTranscript: PanelTextSummary;
    combined: PanelTextSummary;
  };
  independentParses: {
    enQuestion: { groupsCount: number; questionsCount: number; questionNumbers: number[]; groupRanges: string[]; outOfPartErrors: string[] };
    viQuestion: { groupsCount: number; questionsCount: number; questionNumbers: number[]; groupRanges: string[]; outOfPartErrors: string[] };
    enTranscript: { groupsCount: number; questionsCount: number; questionNumbers: number[]; groupRanges: string[]; outOfPartErrors: string[] };
    viTranscript: { groupsCount: number; questionsCount: number; questionNumbers: number[]; groupRanges: string[]; outOfPartErrors: string[] };
  };
  mergedResult: {
    groupsCount: number;
    questionsCount: number;
    questionNumbers: number[];
    metrics: any;
    outOfPartErrors: string[];
  };
  candidateLineDiagnostics: CandidateLineDiagnostic[];
  numberContexts: NumberOccurrenceContext[];
}

export function isDebugPart6Enabled(): boolean {
  if (typeof window === 'undefined' || !window.location) return false;
  return window.location.search.includes('debugPart6=1');
}

export function summarizeTextPanel(input: string): PanelTextSummary {
  const lines = input.split('\n');
  const nonEmptyLines = lines.filter(l => l.trim().length > 0);

  const crlfCount = (input.match(/\r\n/g) || []).length;
  const lfOnlyCount = (input.match(/[^\r]\n/g) || []).length;
  const crOnlyCount = (input.match(/\r[^\n]/g) || []).length;
  const nbspCount = (input.match(/\u00A0/g) || []).length;
  const zwspCount = (input.match(/\u200B/g) || []).length;
  const nnbspCount = (input.match(/\u202F/g) || []).length;
  const bomCount = (input.match(/\uFEFF/g) || []).length;

  return {
    characterCount: input.length,
    lineCount: lines.length,
    nonEmptyLineCount: nonEmptyLines.length,
    escapedSnippet: JSON.stringify(input.slice(0, 1500)),
    whitespaceCounts: {
      crlf: crlfCount,
      lf: lfOnlyCount,
      cr: crOnlyCount,
      nbsp: nbspCount,
      zwsp: zwspCount,
      nnbsp: nnbspCount,
      bom: bomCount,
    },
  };
}

export function getNumberContextsForPanel(input: string, sourcePanel: string): NumberOccurrenceContext[] {
  const contexts: NumberOccurrenceContext[] = [];
  if (!input) return contexts;

  for (let num = 131; num <= 146; num++) {
    const numStr = `${num}`;
    let idx = input.indexOf(numStr);
    while (idx !== -1) {
      const start = Math.max(0, idx - 50);
      const end = Math.min(input.length, idx + numStr.length + 50);
      const snippet = JSON.stringify(input.slice(start, end));
      contexts.push({
        number: num,
        sourcePanel,
        index: idx,
        snippet,
      });
      idx = input.indexOf(numStr, idx + numStr.length);
    }
  }

  return contexts;
}

export function getCandidateLineDiagnosticsForPanel(input: string, sourcePanel: string): CandidateLineDiagnostic[] {
  const results: CandidateLineDiagnostic[] = [];
  if (!input) return results;

  const lines = input.split('\n');
  const partRange = { startNumber: 131, endNumber: 146 };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmedLine = rawLine.trim();

    // Check if line contains candidate question numbers 131..146 or range headers
    const containsNumber = /\b(13[1-9]|14[0-6])\b/.test(trimmedLine) || /131|132|133|134|135|136|137|138|139|140|141|142|143|144|145|146/.test(trimmedLine);
    if (!containsNumber && !/QUESTIONS|CÂU|CAU|Q/i.test(trimmedLine)) continue;

    const cleanHeader = trimmedLine
      .replace(/^[#\s]+/, '')
      .replace(/^[\*\_\s]+/, '')
      .replace(/[\*\_\s]+$/, '')
      .trim();

    const normalizedHeader = cleanHeader.replace(/[\u2013\u2014–—~]/g, '-').replace(/\bTO\b/gi, '-');

    const codePoints = Array.from(rawLine).map(ch => `U+${ch.charCodeAt(0).toString(16).padStart(4, '0').toUpperCase()}`);

    const rangeHeaderMatch = Boolean(normalizedHeader.match(/^(?:CÂU|CAU|Q|QUESTIONS?)\s*#?\s*(\d+)\s*-\s*(\d+)/i));

    const explicitQMatch = normalizedHeader.match(/^(?:QUESTIONS?|CÂU|CAU)\s*#?\s*(\d+)\b\s*[:\.]?\s*$/i) ||
                           normalizedHeader.match(/^Q\s*#?\s*(\d+)\b\s*[:\.]?\s*$/i) ||
                           normalizedHeader.match(/^(?:QUESTIONS?|CÂU|CAU)\s*#?\s*(\d+)\b\s*[:\.]?\s+(.*)$/i);

    const explicitQuestionMatch = Boolean(explicitQMatch);

    const bareQMatch = normalizedHeader.match(/^\s*(\d{1,3})\s*[\.\)]?\s*$/);
    const bareQuestionMatch = Boolean(bareQMatch && parseInt(bareQMatch[1], 10) >= partRange.startNumber && parseInt(bareQMatch[1], 10) <= partRange.endNumber);

    const sameLineOptMatch = normalizedHeader.match(/^\s*(\d{1,3})\s*[\.\)]?\s*(?=(?:\(?[A-D][\)\.\:\s]))/i);
    const sameLineOptionMatch = Boolean(sameLineOptMatch && parseInt(sameLineOptMatch[1], 10) >= partRange.startNumber && parseInt(sameLineOptMatch[1], 10) <= partRange.endNumber);

    const optMatch = trimmedLine.match(/^\s*(?:[\(\[]?([A-D])[\)\]\.\:]\s*|\b([A-D])\.\s+)(.*)$/i);
    const optionMatch = Boolean(optMatch);

    let recognizedQuestionNumber: number | null = null;
    if (explicitQMatch) {
      recognizedQuestionNumber = parseInt(explicitQMatch[1], 10);
    } else if (bareQMatch) {
      const n = parseInt(bareQMatch[1], 10);
      if (n >= partRange.startNumber && n <= partRange.endNumber) recognizedQuestionNumber = n;
    } else if (sameLineOptMatch) {
      const n = parseInt(sameLineOptMatch[1], 10);
      if (n >= partRange.startNumber && n <= partRange.endNumber) recognizedQuestionNumber = n;
    }

    results.push({
      lineNumber: i + 1,
      sourcePanel,
      rawLine,
      trimmedLine,
      cleanHeader,
      normalizedHeader,
      codePoints,
      rangeHeaderMatch,
      explicitQuestionMatch,
      bareQuestionMatch,
      sameLineOptionMatch,
      optionMatch,
      recognizedQuestionNumber,
    });
  }

  return results;
}

export function generatePart6DebugSnapshot(
  enQuestionInput: string,
  viQuestionInput: string,
  enTranscriptInput: string,
  viTranscriptInput: string,
  combinedInput: string,
  mainTab: string,
  normPart: string,
  mergedResult: PartParseResult
): Part6DiagnosticSnapshot {
  const enQParsed = parseSingleLanguagePartText(enQuestionInput, 'en', 'part6');
  const viQParsed = parseSingleLanguagePartText(viQuestionInput, 'vi', 'part6');
  const enTrParsed = parseSingleLanguagePartText(enTranscriptInput, 'en', 'part6');
  const viTrParsed = parseSingleLanguagePartText(viTranscriptInput, 'vi', 'part6');

  const candidateLineDiagnostics: CandidateLineDiagnostic[] = [
    ...getCandidateLineDiagnosticsForPanel(enQuestionInput, 'EN Question Panel'),
    ...getCandidateLineDiagnosticsForPanel(viQuestionInput, 'VI Question Panel'),
    ...getCandidateLineDiagnosticsForPanel(enTranscriptInput, 'EN Script/Passage Panel'),
    ...getCandidateLineDiagnosticsForPanel(viTranscriptInput, 'VI Script/Passage Panel'),
    ...getCandidateLineDiagnosticsForPanel(combinedInput, 'Combined Advanced Panel'),
  ];

  const numberContexts: NumberOccurrenceContext[] = [
    ...getNumberContextsForPanel(enQuestionInput, 'EN Question Panel'),
    ...getNumberContextsForPanel(viQuestionInput, 'VI Question Panel'),
    ...getNumberContextsForPanel(enTranscriptInput, 'EN Script/Passage Panel'),
    ...getNumberContextsForPanel(viTranscriptInput, 'VI Script/Passage Panel'),
    ...getNumberContextsForPanel(combinedInput, 'Combined Advanced Panel'),
  ];

  return {
    debugBuild: 'P6-RUNTIME-01',
    timestamp: new Date().toISOString(),
    normPart,
    mainTab,
    panelSummaries: {
      enQuestion: summarizeTextPanel(enQuestionInput),
      viQuestion: summarizeTextPanel(viQuestionInput),
      enTranscript: summarizeTextPanel(enTranscriptInput),
      viTranscript: summarizeTextPanel(viTranscriptInput),
      combined: summarizeTextPanel(combinedInput),
    },
    independentParses: {
      enQuestion: {
        groupsCount: enQParsed.groups.length,
        questionsCount: enQParsed.questions.length,
        questionNumbers: enQParsed.questions.map(q => q.question_number),
        groupRanges: enQParsed.groups.map(g => g.range),
        outOfPartErrors: enQParsed.outOfPartErrors,
      },
      viQuestion: {
        groupsCount: viQParsed.groups.length,
        questionsCount: viQParsed.questions.length,
        questionNumbers: viQParsed.questions.map(q => q.question_number),
        groupRanges: viQParsed.groups.map(g => g.range),
        outOfPartErrors: viQParsed.outOfPartErrors,
      },
      enTranscript: {
        groupsCount: enTrParsed.groups.length,
        questionsCount: enTrParsed.questions.length,
        questionNumbers: enTrParsed.questions.map(q => q.question_number),
        groupRanges: enTrParsed.groups.map(g => g.range),
        outOfPartErrors: enTrParsed.outOfPartErrors,
      },
      viTranscript: {
        groupsCount: viTrParsed.groups.length,
        questionsCount: viTrParsed.questions.length,
        questionNumbers: viTrParsed.questions.map(q => q.question_number),
        groupRanges: viTrParsed.groups.map(g => g.range),
        outOfPartErrors: viTrParsed.outOfPartErrors,
      },
    },
    mergedResult: {
      groupsCount: mergedResult.groups.length,
      questionsCount: mergedResult.questions.length,
      questionNumbers: mergedResult.questions.map(q => q.question_number),
      metrics: mergedResult.metrics,
      outOfPartErrors: mergedResult.outOfPartErrors,
    },
    candidateLineDiagnostics,
    numberContexts,
  };
}
