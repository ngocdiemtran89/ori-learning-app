// ============================================================
// ORI TOEIC Website V2 — Extract Learning Units Helper
// ============================================================

import { OriToeicV2Package, V2LearningUnit } from './types';
import { classifySinglePart5Question } from './part5Classifier';

export interface ExtractedQuestionLearningLink {
  question_number: number;
  item_key: string;
  kind: string;
  ai_suggested: boolean;
}

export interface ExtractedLearningData {
  items: V2LearningUnit[];
  links: ExtractedQuestionLearningLink[];
}

export function extractLearningUnitsFromV2Package(pkg: OriToeicV2Package): ExtractedLearningData {
  const itemsMap = new Map<string, V2LearningUnit>();
  const links: ExtractedQuestionLearningLink[] = [];

  // Top-level learning_units
  if (Array.isArray(pkg.learning_units)) {
    pkg.learning_units.forEach((unit) => {
      if (unit.item_key && unit.title) {
        itemsMap.set(unit.item_key, {
          kind: unit.kind || 'vocabulary',
          item_key: unit.item_key,
          title: unit.title,
          definition: unit.definition || '',
          example: unit.example || '',
          difficulty_level: unit.difficulty_level || 3,
          ai_suggested: unit.ai_suggested ?? true,
        });
      }
    });
  }

  // Question-level learning_units
  if (Array.isArray(pkg.questions)) {
    pkg.questions.forEach((q) => {
      // 1. Explicit learning_units on question
      if (Array.isArray(q.learning_units) && q.learning_units.length > 0) {
        q.learning_units.forEach((unit) => {
          if (unit.item_key && unit.title) {
            if (!itemsMap.has(unit.item_key)) {
              itemsMap.set(unit.item_key, {
                kind: unit.kind || 'vocabulary',
                item_key: unit.item_key,
                title: unit.title,
                definition: unit.definition || '',
                example: unit.example || '',
                difficulty_level: unit.difficulty_level || 3,
                ai_suggested: unit.ai_suggested ?? true,
              });
            }

            links.push({
              question_number: q.question_number,
              item_key: unit.item_key,
              kind: unit.kind || 'vocabulary',
              ai_suggested: unit.ai_suggested ?? true,
            });
          }
        });
      } else if ((q.part as string) === 'P5' || (q.part as string) === 'part5' || (q.question_number >= 101 && q.question_number <= 130)) {
        // 2. Automatic Part 5 Classifier fallback
        const classified = classifySinglePart5Question({
          question_number: q.question_number,
          part: 'part5',
          question_text: q.question_text,
          options: q.options,
          correct_answer: q.correct_answer,
          explanation: q.explanation,
          translation_vi: q.translation_vi,
        });

        if (!itemsMap.has(classified.item_key)) {
          itemsMap.set(classified.item_key, {
            kind: classified.kind,
            item_key: classified.item_key,
            title: classified.title,
            definition: classified.reasoning || '',
            example: q.question_text || '',
            difficulty_level: 3,
            ai_suggested: true,
          });
        }

        links.push({
          question_number: q.question_number,
          item_key: classified.item_key,
          kind: classified.kind,
          ai_suggested: true,
        });
      }
    });
  }

  return {
    items: Array.from(itemsMap.values()),
    links,
  };
}
