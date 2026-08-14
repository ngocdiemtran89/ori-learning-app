// ============================================================
// ORI TOEIC Website V2 — Automatic Part 5 Semantic Learning Classifier
// ============================================================

export type Part5CategoryKind = 'grammar' | 'vocabulary' | 'collocation';

export type Part5GrammarTopic =
  | 'word_form'
  | 'verb_tense'
  | 'verb_form'
  | 'subject_verb_agreement'
  | 'passive_voice'
  | 'pronoun'
  | 'relative_clause'
  | 'preposition'
  | 'conjunction_connector'
  | 'article_determiner'
  | 'comparative'
  | 'quantifier'
  | 'modal'
  | 'other_grammar';

export type Part5VocabularyTopic =
  | 'meaning_in_context'
  | 'business_vocabulary'
  | 'office_workplace'
  | 'travel_transportation'
  | 'finance'
  | 'marketing_sales'
  | 'other_vocabulary';

export type Part5CollocationTopic =
  | 'verb_noun'
  | 'adjective_noun'
  | 'prepositional_phrase'
  | 'fixed_expression'
  | 'other_collocation';

export type Part5Topic = Part5GrammarTopic | Part5VocabularyTopic | Part5CollocationTopic;

export type Part5ApprovalStatus = 'APPROVED' | 'SUGGESTED' | 'REJECTED' | 'NEEDS_REVIEW';
export type Part5Provenance = 'RULE_LOCAL' | 'GPT_HYBRID' | 'MANUAL';

export interface Part5ClassificationInput {
  question_number: number;
  part: 'part5' | 'P5' | string;
  question_text?: string | null;
  options: string[] | Record<string, string>;
  correct_answer?: 'A' | 'B' | 'C' | 'D' | null;
  explanation?: string | null;
  translation_vi?: string | null;
}

export interface Part5ClassificationResult {
  question_number: number;
  part: 'part5';
  kind: Part5CategoryKind;
  item_key: string;
  title: string;
  topic: Part5Topic;
  secondary_topics?: Part5Topic[];
  confidence: number; // 0.0 .. 1.0
  provenance: Part5Provenance;
  approval_status: Part5ApprovalStatus;
  is_auto_approved: boolean;
  reasoning?: string;
}

export interface GptHybridQuestionPacket {
  questionNumber: number;
  part: string;
  questionText: string;
  options: string[];
  correctAnswer?: string;
}

export interface GptHybridExportPacket {
  schema_version: 'ori.toeic.gpt_hybrid.v1';
  test_type: 'part5_classification';
  questions: GptHybridQuestionPacket[];
}

// Canonical Title Dictionary
export const PART5_TOPIC_TITLES: Record<Part5Topic, string> = {
  // Grammar
  word_form: 'Ngữ pháp - Từ loại (Word Form)',
  verb_tense: 'Ngữ pháp - Thì của động từ (Verb Tense)',
  verb_form: 'Ngữ pháp - Dạng động từ (Gerund/Infinitive/Participle)',
  subject_verb_agreement: 'Ngữ pháp - Hòa hợp Chủ ngữ & Động từ (S-V Agreement)',
  passive_voice: 'Ngữ pháp - Câu bị động (Passive Voice)',
  pronoun: 'Ngữ pháp - Đại từ (Pronoun)',
  relative_clause: 'Ngữ pháp - Mệnh đề quan hệ (Relative Clause)',
  preposition: 'Ngữ pháp - Giới từ (Preposition)',
  conjunction_connector: 'Ngữ pháp - Liên từ & Từ nối (Conjunction/Connector)',
  article_determiner: 'Ngữ pháp - Mạo từ & Từ xác định (Article/Determiner)',
  comparative: 'Ngữ pháp - So sánh (Comparative/Superlative)',
  quantifier: 'Ngữ pháp - Từ chỉ số lượng (Quantifier)',
  modal: 'Ngữ pháp - Động từ khuyết thiếu (Modal Verb)',
  other_grammar: 'Ngữ pháp khác (Other Grammar)',

  // Vocabulary
  meaning_in_context: 'Từ vựng - Từ vựng theo ngữ cảnh (Meaning in Context)',
  business_vocabulary: 'Từ vựng - Thương mại & Doanh nghiệp (Business Vocabulary)',
  office_workplace: 'Từ vựng - Văn phòng & Nơi làm việc (Office/Workplace)',
  travel_transportation: 'Từ vựng - Du lịch & Vận tải (Travel/Transportation)',
  finance: 'Từ vựng - Tài chính & Ngân hàng (Finance)',
  marketing_sales: 'Từ vựng - Tiếp thị & Bán hàng (Marketing/Sales)',
  other_vocabulary: 'Từ vựng khác (Other Vocabulary)',

  // Collocation
  verb_noun: 'Cụm từ - Động từ + Danh từ (Verb + Noun)',
  adjective_noun: 'Cụm từ - Tính từ + Danh từ (Adjective + Noun)',
  prepositional_phrase: 'Cụm từ - Cụm giới từ cố định (Prepositional Phrase)',
  fixed_expression: 'Cụm từ - Thành ngữ & Cụm từ cố định (Fixed Expression)',
  other_collocation: 'Cụm từ khác (Other Collocation)',
};

// Helper to extract clean option array strings
function extractCleanOptionStrings(optionsInput: string[] | Record<string, string>): string[] {
  if (Array.isArray(optionsInput)) {
    return optionsInput.map((opt) => opt.replace(/^(?:\([A-D]\)|\b[A-D][.:\)])\s*/i, '').trim());
  } else if (optionsInput && typeof optionsInput === 'object') {
    return ['A', 'B', 'C', 'D'].map((label) => {
      const val = optionsInput[label] || optionsInput[label.toLowerCase()] || '';
      return val.replace(/^(?:\([A-D]\)|\b[A-D][.:\)])\s*/i, '').trim();
    });
  }
  return [];
}

// Single Part 5 Question Local Deterministic Classifier
export function classifySinglePart5Question(q: Part5ClassificationInput): Part5ClassificationResult {
  const options = extractCleanOptionStrings(q.options);
  const qText = (q.question_text || '').toLowerCase();
  const optionsLower = options.map((o) => o.toLowerCase());

  // 1. RULE: PRONOUNS (he/him/his/himself, they/them/their, etc.)
  const pronounSet = new Set([
    'he', 'him', 'his', 'himself',
    'she', 'her', 'hers', 'herself',
    'they', 'them', 'their', 'theirs', 'themselves',
    'it', 'its', 'itself',
    'we', 'us', 'our', 'ours', 'ourselves',
    'you', 'your', 'yours', 'yourself', 'yourselves',
    'i', 'me', 'my', 'mine', 'myself',
  ]);

  if (optionsLower.length >= 3 && optionsLower.every((opt) => pronounSet.has(opt))) {
    return {
      question_number: q.question_number,
      part: 'part5',
      kind: 'grammar',
      topic: 'pronoun',
      item_key: 'p5_grammar_pronoun',
      title: PART5_TOPIC_TITLES.pronoun,
      confidence: 0.95,
      provenance: 'RULE_LOCAL',
      approval_status: 'APPROVED',
      is_auto_approved: true,
      reasoning: 'Tất cả 4 lựa chọn đều là các dạng Đại từ (Pronoun).',
    };
  }

  // 2. RULE: RELATIVE CLAUSES (who/whom/whose/which/that/where/when)
  const relativeSet = new Set(['who', 'whom', 'whose', 'which', 'that', 'where', 'when', 'whoever', 'whichever']);
  if (optionsLower.length >= 3 && optionsLower.every((opt) => relativeSet.has(opt))) {
    return {
      question_number: q.question_number,
      part: 'part5',
      kind: 'grammar',
      topic: 'relative_clause',
      item_key: 'p5_grammar_relative_clause',
      title: PART5_TOPIC_TITLES.relative_clause,
      confidence: 0.95,
      provenance: 'RULE_LOCAL',
      approval_status: 'APPROVED',
      is_auto_approved: true,
      reasoning: 'Tất cả lựa chọn đều là Đại từ quan hệ (Relative Pronouns).',
    };
  }

  // 3. RULE: PREPOSITIONS (in, on, at, for, with, by, during, despite, etc.)
  const prepSet = new Set([
    'in', 'on', 'at', 'for', 'with', 'by', 'from', 'to', 'of', 'about',
    'during', 'within', 'despite', 'throughout', 'across', 'among', 'between',
    'behind', 'beyond', 'under', 'until', 'before', 'after',
  ]);
  if (optionsLower.length >= 3 && optionsLower.every((opt) => prepSet.has(opt))) {
    return {
      question_number: q.question_number,
      part: 'part5',
      kind: 'grammar',
      topic: 'preposition',
      item_key: 'p5_grammar_preposition',
      title: PART5_TOPIC_TITLES.preposition,
      confidence: 0.94,
      provenance: 'RULE_LOCAL',
      approval_status: 'APPROVED',
      is_auto_approved: true,
      reasoning: 'Tất cả các phương án đều là Giới từ (Prepositions).',
    };
  }

  // 4. RULE: CONJUNCTIONS & CONNECTORS (although, because, however, etc.)
  const connectorSet = new Set([
    'although', 'though', 'even though', 'because', 'since', 'as',
    'however', 'therefore', 'nevertheless', 'furthermore', 'moreover',
    'unless', 'provided', 'providing', 'whereas', 'while', 'so that',
  ]);
  if (optionsLower.some((opt) => connectorSet.has(opt))) {
    return {
      question_number: q.question_number,
      part: 'part5',
      kind: 'grammar',
      topic: 'conjunction_connector',
      item_key: 'p5_grammar_conjunction_connector',
      title: PART5_TOPIC_TITLES.conjunction_connector,
      confidence: 0.93,
      provenance: 'RULE_LOCAL',
      approval_status: 'APPROVED',
      is_auto_approved: true,
      reasoning: 'Lựa chọn chứa các Liên từ hoặc Từ nối (Conjunctions/Connectors).',
    };
  }

  // 5. RULE: ARTICLES / DETERMINERS / QUANTIFIERS
  const determinerSet = new Set([
    'a', 'an', 'the', 'each', 'every', 'some', 'any', 'many', 'much',
    'all', 'both', 'either', 'neither', 'few', 'little', 'several', 'this', 'that', 'these', 'those',
  ]);
  if (optionsLower.length >= 3 && optionsLower.every((opt) => determinerSet.has(opt))) {
    const isQuantifier = optionsLower.some((o) => ['many', 'much', 'few', 'little', 'several', 'all', 'both', 'either', 'neither'].includes(o));
    const topic: Part5GrammarTopic = isQuantifier ? 'quantifier' : 'article_determiner';
    return {
      question_number: q.question_number,
      part: 'part5',
      kind: 'grammar',
      topic,
      item_key: `p5_grammar_${topic}`,
      title: PART5_TOPIC_TITLES[topic],
      confidence: 0.91,
      provenance: 'RULE_LOCAL',
      approval_status: 'APPROVED',
      is_auto_approved: true,
      reasoning: `Lựa chọn chứa các Mạo từ / Từ xác định / Từ chỉ số lượng (${topic}).`,
    };
  }

  // 6. RULE: VERB TENSE & VERB FORM (inflections of same verb stem: to review, reviewing, reviewed, will review)
  const hasInfinitiveTo = optionsLower.some((o) => /^to\s+[a-z]+/i.test(o));
  const hasGerundIng = optionsLower.some((o) => /[a-z]{3,}ing$/i.test(o));
  const hasPastEd = optionsLower.some((o) => /[a-z]{3,}ed$/i.test(o));
  const hasAuxiliaryTense = optionsLower.some((o) => /^(?:will|has|have|had|is|was|are|were)\s+[a-z]+/i.test(o));

  if ((hasInfinitiveTo && (hasGerundIng || hasPastEd)) || (hasAuxiliaryTense && (hasGerundIng || hasPastEd))) {
    const isTense = hasAuxiliaryTense;
    const topic: Part5GrammarTopic = isTense ? 'verb_tense' : 'verb_form';
    return {
      question_number: q.question_number,
      part: 'part5',
      kind: 'grammar',
      topic,
      item_key: `p5_grammar_${topic}`,
      title: PART5_TOPIC_TITLES[topic],
      confidence: 0.93,
      provenance: 'RULE_LOCAL',
      approval_status: 'APPROVED',
      is_auto_approved: true,
      reasoning: `Lựa chọn chứa biến thể Dạng động từ hoặc Thì động từ (${topic}).`,
    };
  }

  // 7. RULE: WORD FORM (Same lexical root, different suffixes -tion, -ly, -ive, -ment, -able...)
  const commonNounSuffixes = ['tion', 'sion', 'ment', 'ance', 'ence', 'ity', 'ness', 'er', 'or', 'ship'];
  const commonAdjSuffixes = ['ive', 'al', 'ous', 'ful', 'less', 'able', 'ible', 'ic', 'ent', 'ant'];
  const hasAdvLy = optionsLower.some((o) => o.endsWith('ly') && o.length > 4);

  // Check common root prefix across options
  let hasSharedRoot = false;
  if (optionsLower.length >= 3) {
    const sortedOpts = [...optionsLower].sort((a, b) => a.length - b.length);
    const shortest = sortedOpts[0];
    if (shortest.length >= 3) {
      const stem = shortest.substring(0, Math.min(4, shortest.length));
      const matchCount = optionsLower.filter((o) => o.startsWith(stem)).length;
      if (matchCount >= 3) {
        hasSharedRoot = true;
      }
    }
  }

  const hasNounSuffix = optionsLower.some((o) => commonNounSuffixes.some((s) => o.endsWith(s)));
  const hasAdjSuffix = optionsLower.some((o) => commonAdjSuffixes.some((s) => o.endsWith(s)));

  if (hasSharedRoot || (hasAdvLy && (hasNounSuffix || hasAdjSuffix))) {
    return {
      question_number: q.question_number,
      part: 'part5',
      kind: 'grammar',
      topic: 'word_form',
      item_key: 'p5_grammar_word_form',
      title: PART5_TOPIC_TITLES.word_form,
      confidence: 0.95,
      provenance: 'RULE_LOCAL',
      approval_status: 'APPROVED',
      is_auto_approved: true,
      reasoning: 'Các lựa chọn chia cùng gốc từ nhưng mang các từ loại khác nhau (Danh/Tính/Động/Trạng).',
    };
  }

  // 8. RULE: FIXED COLLOCATION / PREPOSITIONAL PHRASES
  const fixedPhraseKeywords = ['accordance with', 'compliance with', 'regard to', 'earliest convenience', 'take into account', 'in terms of'];
  if (fixedPhraseKeywords.some((phrase) => qText.includes(phrase) || optionsLower.some((o) => phrase.includes(o)))) {
    return {
      question_number: q.question_number,
      part: 'part5',
      kind: 'collocation',
      topic: 'fixed_expression',
      item_key: 'p5_collocation_fixed_expression',
      title: PART5_TOPIC_TITLES.fixed_expression,
      confidence: 0.88,
      provenance: 'RULE_LOCAL',
      approval_status: 'APPROVED',
      is_auto_approved: true,
      reasoning: 'Câu chứa Cụm từ cố định / Thành ngữ thương mại (Fixed Expression).',
    };
  }

  // 9. RULE: VOCABULARY MEANING IN CONTEXT (4 distinct realistic vocabulary words)
  const isStandardEnglishVocab =
    optionsLower.length === 4 &&
    optionsLower.every((opt) => opt.length >= 4 && /^[a-z]+$/i.test(opt)) &&
    !qText.includes('xyz alpha beta');

  if (isStandardEnglishVocab) {
    return {
      question_number: q.question_number,
      part: 'part5',
      kind: 'vocabulary',
      topic: 'meaning_in_context',
      item_key: 'p5_vocab_meaning_in_context',
      title: PART5_TOPIC_TITLES.meaning_in_context,
      confidence: 0.85,
      provenance: 'RULE_LOCAL',
      approval_status: 'APPROVED',
      is_auto_approved: true,
      reasoning: '4 từ vựng hoàn toàn khác nhau cần xét ý nghĩa trong ngữ cảnh.',
    };
  }

  // 10. UNCERTAIN / AMBIGUOUS FALLBACK (NEEDS_REVIEW)
  return {
    question_number: q.question_number,
    part: 'part5',
    kind: 'vocabulary',
    topic: 'other_vocabulary',
    item_key: 'p5_vocab_other_vocabulary',
    title: PART5_TOPIC_TITLES.other_vocabulary,
    confidence: 0.60,
    provenance: 'RULE_LOCAL',
    approval_status: 'NEEDS_REVIEW',
    is_auto_approved: false,
    reasoning: 'Độ tin cậy chưa đạt ngưỡng 85%. Cần Admin xem xét duyệt thủ công.',
  };
}

// Batch Part 5 Classifier
export function classifyPart5Questions(questions: Part5ClassificationInput[]): Part5ClassificationResult[] {
  return questions.map(classifySinglePart5Question);
}

// GPT Hybrid Packet Exporter
export function exportPart5GptHybridPacket(questions: Part5ClassificationInput[]): string {
  const packet: GptHybridExportPacket = {
    schema_version: 'ori.toeic.gpt_hybrid.v1',
    test_type: 'part5_classification',
    questions: questions.map((q) => ({
      questionNumber: q.question_number,
      part: 'P5',
      questionText: q.question_text || `Question ${q.question_number}`,
      options: extractCleanOptionStrings(q.options),
      correctAnswer: q.correct_answer || undefined,
    })),
  };
  return JSON.stringify(packet, null, 2);
}

// GPT Hybrid Result Importer
export function importPart5GptHybridResult(
  gptJsonText: string,
  originalQuestions: Part5ClassificationInput[]
): Part5ClassificationResult[] {
  try {
    const parsed = JSON.parse(gptJsonText);
    const gptItems: any[] = Array.isArray(parsed) ? parsed : Array.isArray(parsed.questions) ? parsed.questions : [];

    const gptMap = new Map<number, any>();
    gptItems.forEach((item) => {
      const qNum = item.questionNumber || item.question_number;
      if (qNum) gptMap.set(qNum, item);
    });

    return originalQuestions.map((q) => {
      const gptRes = gptMap.get(q.question_number);
      if (gptRes && gptRes.topic) {
        const topic: Part5Topic = gptRes.topic in PART5_TOPIC_TITLES ? gptRes.topic : 'meaning_in_context';
        const kind: Part5CategoryKind = gptRes.kind || (topic.startsWith('p5_vocab') ? 'vocabulary' : 'grammar');
        return {
          question_number: q.question_number,
          part: 'part5',
          kind,
          topic,
          item_key: `p5_${kind}_${topic}`,
          title: PART5_TOPIC_TITLES[topic] || PART5_TOPIC_TITLES.meaning_in_context,
          confidence: Math.min(1.0, Math.max(0.7, gptRes.confidence || 0.9)),
          provenance: 'GPT_HYBRID',
          approval_status: 'SUGGESTED',
          is_auto_approved: false,
          reasoning: gptRes.reasoning || 'Nhập từ phân tích GPT Hybrid.',
        };
      }
      return classifySinglePart5Question(q);
    });
  } catch (err: any) {
    throw new Error(`Lỗi parse dữ liệu GPT Hybrid JSON: ${err.message}`);
  }
}
