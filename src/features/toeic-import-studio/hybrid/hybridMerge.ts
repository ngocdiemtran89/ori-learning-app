/**
 * Hybrid Merge Engine: Blends Local Parser + ChatGPT JSON with Field Provenance Tracking
 */

import { StagingQuestion, StagingGroup } from '../types';

export interface MergeResult {
  questions: StagingQuestion[];
  groups: StagingGroup[];
  conflictsCount: number;
  warnings: string[];
}

export function mergeHybridPayload(
  currentQuestions: StagingQuestion[],
  currentGroups: StagingGroup[],
  importedQuestions: StagingQuestion[],
  importedGroups: StagingGroup[]
): MergeResult {
  const mergedQuestionsMap = new Map<number, StagingQuestion>();
  const mergedGroupsMap = new Map<string, StagingGroup>();
  const globalWarnings: string[] = [];
  let conflictsCount = 0;

  // Initialize map with current questions
  currentQuestions.forEach((q) => {
    mergedQuestionsMap.set(q.questionNumber, { ...q });
  });

  // Merge Imported Questions
  importedQuestions.forEach((impQ) => {
    const existing = mergedQuestionsMap.get(impQ.questionNumber);

    if (!existing) {
      // New question brought by ChatGPT or Import
      mergedQuestionsMap.set(impQ.questionNumber, {
        ...impQ,
        provenance: {
          questionTextSource: impQ.provenance?.questionTextSource || 'CHATGPT',
          optionsSource: impQ.provenance?.optionsSource || 'CHATGPT',
          translationSource: impQ.provenance?.translationSource || 'CHATGPT',
          groupSource: impQ.provenance?.groupSource || 'CHATGPT',
        },
      });
    } else {
      // Existing question - merge field by field respecting MANUAL provenance
      const merged: StagingQuestion = { ...existing };
      const warnings: string[] = [...(existing.warnings || [])];

      // Question Text Merge
      if (existing.provenance.questionTextSource !== 'MANUAL') {
        if (impQ.questionText && impQ.questionText !== existing.questionText) {
          merged.questionText = impQ.questionText;
          merged.provenance.questionTextSource = 'CHATGPT';
        }
      }

      // Question Translation Merge
      if (existing.provenance.translationSource !== 'MANUAL') {
        if (impQ.questionVi) {
          merged.questionVi = impQ.questionVi;
          merged.provenance.translationSource = 'CHATGPT';
        }
      }

      // Options Merge
      if (existing.provenance.optionsSource !== 'MANUAL') {
        if (impQ.options && Object.values(impQ.options).some(Boolean)) {
          merged.options = { ...existing.options, ...impQ.options };
          merged.provenance.optionsSource = 'CHATGPT';
        }
      }

      // Options Translation Merge
      if (existing.provenance.translationSource !== 'MANUAL') {
        if (impQ.optionsVi && Object.values(impQ.optionsVi).some(Boolean)) {
          merged.optionsVi = { ...(existing.optionsVi || {}), ...impQ.optionsVi };
          merged.provenance.translationSource = 'CHATGPT';
        }
      }

      // Correct Answer Merge
      if (impQ.correctAnswer) {
        merged.correctAnswer = impQ.correctAnswer;
      }

      // Group Assignment Merge
      if (existing.provenance.groupSource !== 'MANUAL' && impQ.groupKey) {
        merged.groupKey = impQ.groupKey;
        merged.provenance.groupSource = 'CHATGPT';
      }

      merged.warnings = Array.from(new Set(warnings));
      mergedQuestionsMap.set(impQ.questionNumber, merged);
    }
  });

  // Initialize map with current groups
  currentGroups.forEach((g) => {
    mergedGroupsMap.set(g.groupKey, { ...g });
  });

  // Merge Imported Groups
  importedGroups.forEach((impG) => {
    const existingG = mergedGroupsMap.get(impG.groupKey);

    if (!existingG) {
      mergedGroupsMap.set(impG.groupKey, { ...impG });
    } else {
      const mergedG: StagingGroup = { ...existingG };

      if (existingG.provenance !== 'MANUAL') {
        if (impG.passage) mergedG.passage = impG.passage;
        if (impG.passageVi) mergedG.passageVi = impG.passageVi;
        if (impG.instruction) mergedG.instruction = impG.instruction;
        if (impG.documents && impG.documents.length > 0) mergedG.documents = impG.documents;
        mergedG.provenance = 'CHATGPT';
      }

      mergedGroupsMap.set(impG.groupKey, mergedG);
    }
  });

  const finalQuestions = Array.from(mergedQuestionsMap.values()).sort(
    (a, b) => a.questionNumber - b.questionNumber
  );
  const finalGroups = Array.from(mergedGroupsMap.values()).sort(
    (a, b) => a.startQuestion - b.startQuestion
  );

  return {
    questions: finalQuestions,
    groups: finalGroups,
    conflictsCount,
    warnings: globalWarnings,
  };
}
