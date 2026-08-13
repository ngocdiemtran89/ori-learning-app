// ============================================================
// ORI TOEIC Website V2 — Extract Learning Units Helper
// ============================================================

import { OriToeicV2Package, V2LearningUnit } from './types';

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
      if (Array.isArray(q.learning_units)) {
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
      }
    });
  }

  return {
    items: Array.from(itemsMap.values()),
    links,
  };
}
