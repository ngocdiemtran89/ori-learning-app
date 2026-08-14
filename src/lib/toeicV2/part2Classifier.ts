// ============================================================
// ORI TOEIC Website V2 — Automatic Part 2 Listening Semantic Classifier
// ============================================================

export type Part2QuestionType =
  // WH Family
  | 'WHEN'
  | 'WHERE'
  | 'WHO'
  | 'WHAT'
  | 'WHY'
  | 'WHICH'
  // How Family
  | 'HOW_GENERAL'
  | 'HOW_MUCH'
  | 'HOW_MANY'
  | 'HOW_LONG'
  | 'HOW_OFTEN'
  | 'HOW_FAR'
  | 'HOW_SOON'
  // Yes/No & Auxiliary
  | 'YES_NO_BE'
  | 'YES_NO_DO'
  | 'YES_NO_HAVE'
  | 'YES_NO_MODAL'
  // Action / Function
  | 'REQUEST'
  | 'OFFER'
  | 'SUGGESTION'
  | 'PERMISSION'
  | 'INVITATION'
  // Other Forms
  | 'CHOICE_OR'
  | 'TAG_QUESTION'
  | 'NEGATIVE_QUESTION'
  | 'STATEMENT'
  | 'OTHER_PART2';

export type Part2SituationalTopic =
  | 'TIME_SCHEDULE'
  | 'MEETING'
  | 'OFFICE_WORKPLACE'
  | 'DOCUMENTS_REPORTS'
  | 'PHONE_EMAIL'
  | 'PEOPLE_ROLES'
  | 'HR_RECRUITMENT'
  | 'TRAVEL'
  | 'TRANSPORTATION'
  | 'HOTEL'
  | 'RESTAURANT_FOOD'
  | 'SHOPPING_PURCHASE'
  | 'PAYMENT_FINANCE'
  | 'DELIVERY_SHIPPING'
  | 'WAREHOUSE_INVENTORY'
  | 'CUSTOMER_SERVICE'
  | 'SALES_MARKETING'
  | 'EVENT_CONFERENCE'
  | 'RESERVATION_APPOINTMENT'
  | 'BUILDING_LOCATION'
  | 'EQUIPMENT_TECHNOLOGY'
  | 'MAINTENANCE_REPAIR'
  | 'WEATHER'
  | 'OTHER_TOPIC';

export type Part2ApprovalStatus = 'APPROVED' | 'SUGGESTED' | 'REJECTED' | 'NEEDS_REVIEW' | 'NEEDS_TRANSCRIPT';
export type Part2Provenance = 'RULE_LOCAL' | 'GPT_HYBRID' | 'MANUAL';

export interface Part2ClassificationInput {
  question_number: number;
  part: 'part2' | 'P2' | string;
  transcript?: string | null; // Prompt transcript
  responses?: { A?: string; B?: string; C?: string } | string[] | null;
  correct_answer?: 'A' | 'B' | 'C' | null;
  explanation?: string | null;
}

export interface Part2ClassificationResult {
  question_number: number;
  part: 'part2';
  question_type: Part2QuestionType;
  question_type_label_vi: string;
  question_type_item_key: string;
  primary_topic: Part2SituationalTopic;
  primary_topic_label_vi: string;
  primary_topic_item_key: string;
  secondary_topics?: Part2SituationalTopic[];
  confidence: number; // 0.0 .. 1.0
  provenance: Part2Provenance;
  approval_status: Part2ApprovalStatus;
  is_auto_approved: boolean;
  reasoning?: string;
}

export interface GptHybridPart2QuestionPacket {
  questionNumber: number;
  part: string;
  transcript?: string;
  responses?: Record<string, string>;
  correctAnswer?: string;
}

export interface GptHybridPart2ExportPacket {
  schema_version: 'ori.toeic.gpt_hybrid_p2.v1';
  test_type: 'part2_classification';
  questions: GptHybridPart2QuestionPacket[];
}

// Friendly Vietnamese Labels for Question Types
export const PART2_QTYPE_LABELS_VI: Record<Part2QuestionType, string> = {
  WHEN: 'Câu hỏi Khi nào (When)',
  WHERE: 'Câu hỏi Ở đâu (Where)',
  WHO: 'Câu hỏi Ai (Who)',
  WHAT: 'Câu hỏi Cái gì / Việc gì (What)',
  WHY: 'Câu hỏi Tại sao (Why)',
  WHICH: 'Câu hỏi Which',

  HOW_GENERAL: 'Câu hỏi How (Thế nào)',
  HOW_MUCH: 'Câu hỏi How much (Bao nhiêu tiền)',
  HOW_MANY: 'Câu hỏi How many (Bao nhiêu lượng)',
  HOW_LONG: 'Câu hỏi How long (Bao lâu)',
  HOW_OFTEN: 'Câu hỏi How often (Tần suất)',
  HOW_FAR: 'Câu hỏi How far (Khoảng cách)',
  HOW_SOON: 'Câu hỏi How soon (Bao sớm)',

  YES_NO_BE: 'Câu hỏi Be (Is/Are/Was/Were)',
  YES_NO_DO: 'Câu hỏi trợ động từ Do (Do/Does/Did)',
  YES_NO_HAVE: 'Câu hỏi Have (Have/Has/Had)',
  YES_NO_MODAL: 'Câu hỏi Modal (Can/Will/Could/Would...)',

  REQUEST: 'Câu yêu cầu / nhờ vả (Request)',
  OFFER: 'Câu đề nghị giúp đỡ (Offer)',
  SUGGESTION: 'Câu gợi ý (Suggestion)',
  PERMISSION: 'Câu xin phép (Permission)',
  INVITATION: 'Câu mời (Invitation)',

  CHOICE_OR: 'Câu lựa chọn OR',
  TAG_QUESTION: 'Câu hỏi đuôi (Tag Question)',
  NEGATIVE_QUESTION: 'Câu hỏi phủ định (Negative Question)',
  STATEMENT: 'Câu trần thuật (Statement)',
  OTHER_PART2: 'Câu hỏi Part 2 khác',
};

// Friendly Vietnamese Labels for Situational Topics
export const PART2_TOPIC_LABELS_VI: Record<Part2SituationalTopic, string> = {
  TIME_SCHEDULE: 'Chủ đề: Lịch trình & Thời gian',
  MEETING: 'Chủ đề: Cuộc họp & Hội thảo',
  OFFICE_WORKPLACE: 'Chủ đề: Văn phòng & Nơi làm việc',
  DOCUMENTS_REPORTS: 'Chủ đề: Tài liệu & Báo cáo',
  PHONE_EMAIL: 'Chủ đề: Điện thoại & Email',
  PEOPLE_ROLES: 'Chủ đề: Nhân sự & Vai trò',
  HR_RECRUITMENT: 'Chủ đề: Tuyển dụng & Nhân sự',
  TRAVEL: 'Chủ đề: Du lịch & Công tác',
  TRANSPORTATION: 'Chủ đề: Phương tiện & Giao thông',
  HOTEL: 'Chủ đề: Khách sạn & Đặt phòng',
  RESTAURANT_FOOD: 'Chủ đề: Nhà hàng & Ẩm thực',
  SHOPPING_PURCHASE: 'Chủ đề: Mua sắm & Đặt hàng',
  PAYMENT_FINANCE: 'Chủ đề: Thanh toán & Tài chính',
  DELIVERY_SHIPPING: 'Chủ đề: Vận chuyển & Giao hàng',
  WAREHOUSE_INVENTORY: 'Chủ đề: Kho hàng & Kiểm kê',
  CUSTOMER_SERVICE: 'Chủ đề: Dịch vụ khách hàng',
  SALES_MARKETING: 'Chủ đề: Bán hàng & Tiếp thị',
  EVENT_CONFERENCE: 'Chủ đề: Sự kiện & Hội nghị',
  RESERVATION_APPOINTMENT: 'Chủ đề: Đặt chỗ & Lịch hẹn',
  BUILDING_LOCATION: 'Chủ đề: Tòa nhà & Địa điểm',
  EQUIPMENT_TECHNOLOGY: 'Chủ đề: Thiết bị & Công nghệ',
  MAINTENANCE_REPAIR: 'Chủ đề: Sửa chữa & Bảo trì',
  WEATHER: 'Chủ đề: Thời tiết',
  OTHER_TOPIC: 'Chủ đề khác',
};

// Helper: Classify Topic from Transcript Text
export function classifyPart2Topic(text: string): { primary: Part2SituationalTopic; secondary?: Part2SituationalTopic[] } {
  const t = text.toLowerCase();

  if (t.includes('repair') || t.includes('fix') || t.includes('broken') || t.includes('not working') || t.includes('maintenance')) {
    return { primary: 'MAINTENANCE_REPAIR', secondary: ['EQUIPMENT_TECHNOLOGY'] };
  }
  if (t.includes('shipment') || t.includes('package') || t.includes('deliver') || t.includes('shipping') || t.includes('carrier') || t.includes('order')) {
    return { primary: 'DELIVERY_SHIPPING', secondary: ['WAREHOUSE_INVENTORY'] };
  }
  if (t.includes('meeting') || t.includes('conference') || t.includes('agenda') || t.includes('presentation') || t.includes('session')) {
    return { primary: 'MEETING', secondary: ['TIME_SCHEDULE'] };
  }
  if (t.includes('train') || t.includes('bus') || t.includes('flight') || t.includes('airport') || t.includes('taxi') || t.includes('drive')) {
    return { primary: 'TRANSPORTATION', secondary: ['TRAVEL'] };
  }
  if (t.includes('hotel') || t.includes('room') || t.includes('reservation') || t.includes('check-in') || t.includes('key')) {
    return { primary: 'HOTEL', secondary: ['RESERVATION_APPOINTMENT'] };
  }
  if (t.includes('lunch') || t.includes('dinner') || t.includes('restaurant') || t.includes('menu') || t.includes('meal') || t.includes('coffee')) {
    return { primary: 'RESTAURANT_FOOD' };
  }
  if (t.includes('report') || t.includes('document') || t.includes('contract') || t.includes('form') || t.includes('invoice') || t.includes('file')) {
    return { primary: 'DOCUMENTS_REPORTS', secondary: ['OFFICE_WORKPLACE'] };
  }
  if (t.includes('phone') || t.includes('call') || t.includes('email') || t.includes('message') || t.includes('voicemail')) {
    return { primary: 'PHONE_EMAIL' };
  }
  if (t.includes('printer') || t.includes('computer') || t.includes('laptop') || t.includes('software') || t.includes('device')) {
    return { primary: 'EQUIPMENT_TECHNOLOGY', secondary: ['OFFICE_WORKPLACE'] };
  }
  if (t.includes('schedule') || t.includes('deadline') || t.includes('clock') || t.includes('hour') || t.includes('time') || t.includes('date') || t.includes('late')) {
    return { primary: 'TIME_SCHEDULE' };
  }

  return { primary: 'OTHER_TOPIC' };
}

export const classifyPart2Question = classifySinglePart2Question;

// Single Part 2 Question Deterministic Classifier
export function classifySinglePart2Question(q: Part2ClassificationInput): Part2ClassificationResult {
  const transcript = (q.transcript || '').trim();

  // If transcript is missing, return NEEDS_TRANSCRIPT status immediately (no guessing)
  if (!transcript) {
    return {
      question_number: q.question_number,
      part: 'part2',
      question_type: 'OTHER_PART2',
      question_type_label_vi: PART2_QTYPE_LABELS_VI.OTHER_PART2,
      question_type_item_key: 'p2_qtype_other_part2',
      primary_topic: 'OTHER_TOPIC',
      primary_topic_label_vi: PART2_TOPIC_LABELS_VI.OTHER_TOPIC,
      primary_topic_item_key: 'p2_topic_other_topic',
      confidence: 0.0,
      provenance: 'RULE_LOCAL',
      approval_status: 'NEEDS_TRANSCRIPT',
      is_auto_approved: false,
      reasoning: 'Thiếu transcript bài nghe Part 2. Không thể phân loại chính xác.',
    };
  }

  const tLower = transcript.toLowerCase();
  const topicRes = classifyPart2Topic(transcript);

  // 1. RULE: CHOICE_OR (contains " or " inside choices/prompt)
  if (/\b or \b/i.test(tLower)) {
    return {
      question_number: q.question_number,
      part: 'part2',
      question_type: 'CHOICE_OR',
      question_type_label_vi: PART2_QTYPE_LABELS_VI.CHOICE_OR,
      question_type_item_key: 'p2_qtype_choice_or',
      primary_topic: topicRes.primary,
      primary_topic_label_vi: PART2_TOPIC_LABELS_VI[topicRes.primary],
      primary_topic_item_key: `p2_topic_${topicRes.primary.toLowerCase()}`,
      secondary_topics: topicRes.secondary,
      confidence: 0.95,
      provenance: 'RULE_LOCAL',
      approval_status: 'APPROVED',
      is_auto_approved: true,
      reasoning: 'Câu hỏi lựa chọn chứa từ "or".',
    };
  }

  // 2. RULE: TAG QUESTION (ends with tag e.g. ", isn't it?", ", don't you?")
  if (/,\s*(?:isn't|aren't|wasn't|weren't|don't|doesn't|didn't|haven't|hasn't|won't|can't|shouldn't)\s+[a-z]+\?$/i.test(transcript)) {
    return {
      question_number: q.question_number,
      part: 'part2',
      question_type: 'TAG_QUESTION',
      question_type_label_vi: PART2_QTYPE_LABELS_VI.TAG_QUESTION,
      question_type_item_key: 'p2_qtype_tag_question',
      primary_topic: topicRes.primary,
      primary_topic_label_vi: PART2_TOPIC_LABELS_VI[topicRes.primary],
      primary_topic_item_key: `p2_topic_${topicRes.primary.toLowerCase()}`,
      secondary_topics: topicRes.secondary,
      confidence: 0.95,
      provenance: 'RULE_LOCAL',
      approval_status: 'APPROVED',
      is_auto_approved: true,
      reasoning: 'Câu hỏi đuôi (Tag Question).',
    };
  }

  // 3. RULE: NEGATIVE QUESTION (starts with negative contraction)
  if (/^(?:isn't|aren't|wasn't|weren't|don't|doesn't|didn't|haven't|hasn't|won't|can't|shouldn't)\b/i.test(transcript)) {
    return {
      question_number: q.question_number,
      part: 'part2',
      question_type: 'NEGATIVE_QUESTION',
      question_type_label_vi: PART2_QTYPE_LABELS_VI.NEGATIVE_QUESTION,
      question_type_item_key: 'p2_qtype_negative_question',
      primary_topic: topicRes.primary,
      primary_topic_label_vi: PART2_TOPIC_LABELS_VI[topicRes.primary],
      primary_topic_item_key: `p2_topic_${topicRes.primary.toLowerCase()}`,
      secondary_topics: topicRes.secondary,
      confidence: 0.94,
      provenance: 'RULE_LOCAL',
      approval_status: 'APPROVED',
      is_auto_approved: true,
      reasoning: 'Câu hỏi phủ định (Negative Question).',
    };
  }

  // 4. RULE: OFFER ("Would you like me to...", "Can I help...", "Shall I...")
  if (/^(?:would you like me to|can i help|shall i|let me)\b/i.test(tLower)) {
    return {
      question_number: q.question_number,
      part: 'part2',
      question_type: 'OFFER',
      question_type_label_vi: PART2_QTYPE_LABELS_VI.OFFER,
      question_type_item_key: 'p2_qtype_offer',
      primary_topic: topicRes.primary,
      primary_topic_label_vi: PART2_TOPIC_LABELS_VI[topicRes.primary],
      primary_topic_item_key: `p2_topic_${topicRes.primary.toLowerCase()}`,
      secondary_topics: topicRes.secondary,
      confidence: 0.94,
      provenance: 'RULE_LOCAL',
      approval_status: 'APPROVED',
      is_auto_approved: true,
      reasoning: 'Câu đề nghị giúp đỡ (Offer).',
    };
  }

  // 5. RULE: SUGGESTION ("Why don't we...", "Why not...", "How about...", "What about...", "Shall we...")
  if (/^(?:why don't we|why not|how about|what about|shall we)\b/i.test(tLower)) {
    return {
      question_number: q.question_number,
      part: 'part2',
      question_type: 'SUGGESTION',
      question_type_label_vi: PART2_QTYPE_LABELS_VI.SUGGESTION,
      question_type_item_key: 'p2_qtype_suggestion',
      primary_topic: topicRes.primary,
      primary_topic_label_vi: PART2_TOPIC_LABELS_VI[topicRes.primary],
      primary_topic_item_key: `p2_topic_${topicRes.primary.toLowerCase()}`,
      secondary_topics: topicRes.secondary,
      confidence: 0.94,
      provenance: 'RULE_LOCAL',
      approval_status: 'APPROVED',
      is_auto_approved: true,
      reasoning: 'Câu gợi ý (Suggestion).',
    };
  }

  // 6. RULE: PERMISSION ("May I...", "Could I...")
  if (/^(?:may i|could i)\b/i.test(tLower)) {
    return {
      question_number: q.question_number,
      part: 'part2',
      question_type: 'PERMISSION',
      question_type_label_vi: PART2_QTYPE_LABELS_VI.PERMISSION,
      question_type_item_key: 'p2_qtype_permission',
      primary_topic: topicRes.primary,
      primary_topic_label_vi: PART2_TOPIC_LABELS_VI[topicRes.primary],
      primary_topic_item_key: `p2_topic_${topicRes.primary.toLowerCase()}`,
      secondary_topics: topicRes.secondary,
      confidence: 0.93,
      provenance: 'RULE_LOCAL',
      approval_status: 'APPROVED',
      is_auto_approved: true,
      reasoning: 'Câu xin phép (Permission).',
    };
  }

  // 7. RULE: INVITATION ("Would you like to join...", "Can you come to...")
  if (/^(?:would you like to join|can you come to|are you free to join)\b/i.test(tLower)) {
    return {
      question_number: q.question_number,
      part: 'part2',
      question_type: 'INVITATION',
      question_type_label_vi: PART2_QTYPE_LABELS_VI.INVITATION,
      question_type_item_key: 'p2_qtype_invitation',
      primary_topic: topicRes.primary,
      primary_topic_label_vi: PART2_TOPIC_LABELS_VI[topicRes.primary],
      primary_topic_item_key: `p2_topic_${topicRes.primary.toLowerCase()}`,
      secondary_topics: topicRes.secondary,
      confidence: 0.93,
      provenance: 'RULE_LOCAL',
      approval_status: 'APPROVED',
      is_auto_approved: true,
      reasoning: 'Câu mời (Invitation).',
    };
  }

  // 8. RULE: REQUEST ("Could you please...", "Would you mind...", "Can you send...", "Please...")
  if (/^(?:could you please|would you mind|please|could you send|can you send|would you open)\b/i.test(tLower)) {
    return {
      question_number: q.question_number,
      part: 'part2',
      question_type: 'REQUEST',
      question_type_label_vi: PART2_QTYPE_LABELS_VI.REQUEST,
      question_type_item_key: 'p2_qtype_request',
      primary_topic: topicRes.primary,
      primary_topic_label_vi: PART2_TOPIC_LABELS_VI[topicRes.primary],
      primary_topic_item_key: `p2_topic_${topicRes.primary.toLowerCase()}`,
      secondary_topics: topicRes.secondary,
      confidence: 0.94,
      provenance: 'RULE_LOCAL',
      approval_status: 'APPROVED',
      is_auto_approved: true,
      reasoning: 'Câu yêu cầu / nhờ vả (Request).',
    };
  }

  // 9. RULE: WH FAMILY (When, Where, Who, What, Why, Which)
  if (/^when\b/i.test(tLower)) {
    return {
      question_number: q.question_number,
      part: 'part2',
      question_type: 'WHEN',
      question_type_label_vi: PART2_QTYPE_LABELS_VI.WHEN,
      question_type_item_key: 'p2_qtype_when',
      primary_topic: topicRes.primary === 'OTHER_TOPIC' ? 'TIME_SCHEDULE' : topicRes.primary,
      primary_topic_label_vi: PART2_TOPIC_LABELS_VI[topicRes.primary === 'OTHER_TOPIC' ? 'TIME_SCHEDULE' : topicRes.primary],
      primary_topic_item_key: `p2_topic_${(topicRes.primary === 'OTHER_TOPIC' ? 'TIME_SCHEDULE' : topicRes.primary).toLowerCase()}`,
      confidence: 0.96,
      provenance: 'RULE_LOCAL',
      approval_status: 'APPROVED',
      is_auto_approved: true,
      reasoning: 'Câu hỏi When (Khi nào).',
    };
  }

  if (/^where\b/i.test(tLower)) {
    return {
      question_number: q.question_number,
      part: 'part2',
      question_type: 'WHERE',
      question_type_label_vi: PART2_QTYPE_LABELS_VI.WHERE,
      question_type_item_key: 'p2_qtype_where',
      primary_topic: topicRes.primary === 'OTHER_TOPIC' ? 'BUILDING_LOCATION' : topicRes.primary,
      primary_topic_label_vi: PART2_TOPIC_LABELS_VI[topicRes.primary === 'OTHER_TOPIC' ? 'BUILDING_LOCATION' : topicRes.primary],
      primary_topic_item_key: `p2_topic_${(topicRes.primary === 'OTHER_TOPIC' ? 'BUILDING_LOCATION' : topicRes.primary).toLowerCase()}`,
      confidence: 0.96,
      provenance: 'RULE_LOCAL',
      approval_status: 'APPROVED',
      is_auto_approved: true,
      reasoning: 'Câu hỏi Where (Ở đâu).',
    };
  }

  if (/^who\b/i.test(tLower)) {
    return {
      question_number: q.question_number,
      part: 'part2',
      question_type: 'WHO',
      question_type_label_vi: PART2_QTYPE_LABELS_VI.WHO,
      question_type_item_key: 'p2_qtype_who',
      primary_topic: topicRes.primary === 'OTHER_TOPIC' ? 'PEOPLE_ROLES' : topicRes.primary,
      primary_topic_label_vi: PART2_TOPIC_LABELS_VI[topicRes.primary === 'OTHER_TOPIC' ? 'PEOPLE_ROLES' : topicRes.primary],
      primary_topic_item_key: `p2_topic_${(topicRes.primary === 'OTHER_TOPIC' ? 'PEOPLE_ROLES' : topicRes.primary).toLowerCase()}`,
      confidence: 0.96,
      provenance: 'RULE_LOCAL',
      approval_status: 'APPROVED',
      is_auto_approved: true,
      reasoning: 'Câu hỏi Who (Ai).',
    };
  }

  if (/^what\b/i.test(tLower)) {
    return {
      question_number: q.question_number,
      part: 'part2',
      question_type: 'WHAT',
      question_type_label_vi: PART2_QTYPE_LABELS_VI.WHAT,
      question_type_item_key: 'p2_qtype_what',
      primary_topic: topicRes.primary,
      primary_topic_label_vi: PART2_TOPIC_LABELS_VI[topicRes.primary],
      primary_topic_item_key: `p2_topic_${topicRes.primary.toLowerCase()}`,
      confidence: 0.95,
      provenance: 'RULE_LOCAL',
      approval_status: 'APPROVED',
      is_auto_approved: true,
      reasoning: 'Câu hỏi What (Cái gì / Việc gì).',
    };
  }

  if (/^why\b/i.test(tLower)) {
    return {
      question_number: q.question_number,
      part: 'part2',
      question_type: 'WHY',
      question_type_label_vi: PART2_QTYPE_LABELS_VI.WHY,
      question_type_item_key: 'p2_qtype_why',
      primary_topic: topicRes.primary,
      primary_topic_label_vi: PART2_TOPIC_LABELS_VI[topicRes.primary],
      primary_topic_item_key: `p2_topic_${topicRes.primary.toLowerCase()}`,
      confidence: 0.95,
      provenance: 'RULE_LOCAL',
      approval_status: 'APPROVED',
      is_auto_approved: true,
      reasoning: 'Câu hỏi Why (Tại sao).',
    };
  }

  if (/^which\b/i.test(tLower)) {
    return {
      question_number: q.question_number,
      part: 'part2',
      question_type: 'WHICH',
      question_type_label_vi: PART2_QTYPE_LABELS_VI.WHICH,
      question_type_item_key: 'p2_qtype_which',
      primary_topic: topicRes.primary,
      primary_topic_label_vi: PART2_TOPIC_LABELS_VI[topicRes.primary],
      primary_topic_item_key: `p2_topic_${topicRes.primary.toLowerCase()}`,
      confidence: 0.95,
      provenance: 'RULE_LOCAL',
      approval_status: 'APPROVED',
      is_auto_approved: true,
      reasoning: 'Câu hỏi Which (Nào).',
    };
  }

  // 10. RULE: HOW SUBTYPES
  if (/^how much\b/i.test(tLower)) {
    return {
      question_number: q.question_number,
      part: 'part2',
      question_type: 'HOW_MUCH',
      question_type_label_vi: PART2_QTYPE_LABELS_VI.HOW_MUCH,
      question_type_item_key: 'p2_qtype_how_much',
      primary_topic: 'PAYMENT_FINANCE',
      primary_topic_label_vi: PART2_TOPIC_LABELS_VI.PAYMENT_FINANCE,
      primary_topic_item_key: 'p2_topic_payment_finance',
      confidence: 0.96,
      provenance: 'RULE_LOCAL',
      approval_status: 'APPROVED',
      is_auto_approved: true,
      reasoning: 'Câu hỏi How much (Bao nhiêu tiền).',
    };
  }

  if (/^how many\b/i.test(tLower)) {
    return {
      question_number: q.question_number,
      part: 'part2',
      question_type: 'HOW_MANY',
      question_type_label_vi: PART2_QTYPE_LABELS_VI.HOW_MANY,
      question_type_item_key: 'p2_qtype_how_many',
      primary_topic: topicRes.primary,
      primary_topic_label_vi: PART2_TOPIC_LABELS_VI[topicRes.primary],
      primary_topic_item_key: `p2_topic_${topicRes.primary.toLowerCase()}`,
      confidence: 0.96,
      provenance: 'RULE_LOCAL',
      approval_status: 'APPROVED',
      is_auto_approved: true,
      reasoning: 'Câu hỏi How many (Bao nhiêu số lượng).',
    };
  }

  if (/^how long\b/i.test(tLower)) {
    return {
      question_number: q.question_number,
      part: 'part2',
      question_type: 'HOW_LONG',
      question_type_label_vi: PART2_QTYPE_LABELS_VI.HOW_LONG,
      question_type_item_key: 'p2_qtype_how_long',
      primary_topic: 'TIME_SCHEDULE',
      primary_topic_label_vi: PART2_TOPIC_LABELS_VI.TIME_SCHEDULE,
      primary_topic_item_key: 'p2_topic_time_schedule',
      confidence: 0.96,
      provenance: 'RULE_LOCAL',
      approval_status: 'APPROVED',
      is_auto_approved: true,
      reasoning: 'Câu hỏi How long (Bao lâu).',
    };
  }

  if (/^how often\b/i.test(tLower)) {
    return {
      question_number: q.question_number,
      part: 'part2',
      question_type: 'HOW_OFTEN',
      question_type_label_vi: PART2_QTYPE_LABELS_VI.HOW_OFTEN,
      question_type_item_key: 'p2_qtype_how_often',
      primary_topic: 'TIME_SCHEDULE',
      primary_topic_label_vi: PART2_TOPIC_LABELS_VI.TIME_SCHEDULE,
      primary_topic_item_key: 'p2_topic_time_schedule',
      confidence: 0.96,
      provenance: 'RULE_LOCAL',
      approval_status: 'APPROVED',
      is_auto_approved: true,
      reasoning: 'Câu hỏi How often (Tần suất).',
    };
  }

  if (/^how far\b/i.test(tLower)) {
    return {
      question_number: q.question_number,
      part: 'part2',
      question_type: 'HOW_FAR',
      question_type_label_vi: PART2_QTYPE_LABELS_VI.HOW_FAR,
      question_type_item_key: 'p2_qtype_how_far',
      primary_topic: 'TRANSPORTATION',
      primary_topic_label_vi: PART2_TOPIC_LABELS_VI.TRANSPORTATION,
      primary_topic_item_key: 'p2_topic_transportation',
      confidence: 0.96,
      provenance: 'RULE_LOCAL',
      approval_status: 'APPROVED',
      is_auto_approved: true,
      reasoning: 'Câu hỏi How far (Khoảng cách).',
    };
  }

  if (/^how soon\b/i.test(tLower)) {
    return {
      question_number: q.question_number,
      part: 'part2',
      question_type: 'HOW_SOON',
      question_type_label_vi: PART2_QTYPE_LABELS_VI.HOW_SOON,
      question_type_item_key: 'p2_qtype_how_soon',
      primary_topic: 'TIME_SCHEDULE',
      primary_topic_label_vi: PART2_TOPIC_LABELS_VI.TIME_SCHEDULE,
      primary_topic_item_key: 'p2_topic_time_schedule',
      confidence: 0.96,
      provenance: 'RULE_LOCAL',
      approval_status: 'APPROVED',
      is_auto_approved: true,
      reasoning: 'Câu hỏi How soon (Bao sớm).',
    };
  }

  if (/^how\b/i.test(tLower)) {
    return {
      question_number: q.question_number,
      part: 'part2',
      question_type: 'HOW_GENERAL',
      question_type_label_vi: PART2_QTYPE_LABELS_VI.HOW_GENERAL,
      question_type_item_key: 'p2_qtype_how_general',
      primary_topic: topicRes.primary,
      primary_topic_label_vi: PART2_TOPIC_LABELS_VI[topicRes.primary],
      primary_topic_item_key: `p2_topic_${topicRes.primary.toLowerCase()}`,
      confidence: 0.94,
      provenance: 'RULE_LOCAL',
      approval_status: 'APPROVED',
      is_auto_approved: true,
      reasoning: 'Câu hỏi How (Thế nào / Bằng cách nào).',
    };
  }

  // 11. RULE: YES/NO AUXILIARY
  if (/^(?:is|are|was|were)\b/i.test(tLower)) {
    return {
      question_number: q.question_number,
      part: 'part2',
      question_type: 'YES_NO_BE',
      question_type_label_vi: PART2_QTYPE_LABELS_VI.YES_NO_BE,
      question_type_item_key: 'p2_qtype_yes_no_be',
      primary_topic: topicRes.primary,
      primary_topic_label_vi: PART2_TOPIC_LABELS_VI[topicRes.primary],
      primary_topic_item_key: `p2_topic_${topicRes.primary.toLowerCase()}`,
      confidence: 0.93,
      provenance: 'RULE_LOCAL',
      approval_status: 'APPROVED',
      is_auto_approved: true,
      reasoning: 'Câu hỏi Yes/No với động từ To Be.',
    };
  }

  if (/^(?:do|does|did)\b/i.test(tLower)) {
    return {
      question_number: q.question_number,
      part: 'part2',
      question_type: 'YES_NO_DO',
      question_type_label_vi: PART2_QTYPE_LABELS_VI.YES_NO_DO,
      question_type_item_key: 'p2_qtype_yes_no_do',
      primary_topic: topicRes.primary,
      primary_topic_label_vi: PART2_TOPIC_LABELS_VI[topicRes.primary],
      primary_topic_item_key: `p2_topic_${topicRes.primary.toLowerCase()}`,
      confidence: 0.93,
      provenance: 'RULE_LOCAL',
      approval_status: 'APPROVED',
      is_auto_approved: true,
      reasoning: 'Câu hỏi Yes/No với trợ động từ Do/Does/Did.',
    };
  }

  if (/^(?:have|has|had)\b/i.test(tLower)) {
    return {
      question_number: q.question_number,
      part: 'part2',
      question_type: 'YES_NO_HAVE',
      question_type_label_vi: PART2_QTYPE_LABELS_VI.YES_NO_HAVE,
      question_type_item_key: 'p2_qtype_yes_no_have',
      primary_topic: topicRes.primary,
      primary_topic_label_vi: PART2_TOPIC_LABELS_VI[topicRes.primary],
      primary_topic_item_key: `p2_topic_${topicRes.primary.toLowerCase()}`,
      confidence: 0.93,
      provenance: 'RULE_LOCAL',
      approval_status: 'APPROVED',
      is_auto_approved: true,
      reasoning: 'Câu hỏi Yes/No với trợ động từ Have/Has/Had.',
    };
  }

  if (/^(?:can|could|will|would|should|may|must)\b/i.test(tLower)) {
    return {
      question_number: q.question_number,
      part: 'part2',
      question_type: 'YES_NO_MODAL',
      question_type_label_vi: PART2_QTYPE_LABELS_VI.YES_NO_MODAL,
      question_type_item_key: 'p2_qtype_yes_no_modal',
      primary_topic: topicRes.primary,
      primary_topic_label_vi: PART2_TOPIC_LABELS_VI[topicRes.primary],
      primary_topic_item_key: `p2_topic_${topicRes.primary.toLowerCase()}`,
      confidence: 0.92,
      provenance: 'RULE_LOCAL',
      approval_status: 'APPROVED',
      is_auto_approved: true,
      reasoning: 'Câu hỏi Yes/No với Động từ khuyết thiếu (Modal).',
    };
  }

  // 12. RULE: STATEMENT (Declarative sentence without initial auxiliary or question word)
  if (!tLower.endsWith('?') || /^[a-z0-9\s]+(?:is|are|was|were|has|have|will|can|should|isn't|working|arriving|booked)\b/i.test(tLower)) {
    return {
      question_number: q.question_number,
      part: 'part2',
      question_type: 'STATEMENT',
      question_type_label_vi: PART2_QTYPE_LABELS_VI.STATEMENT,
      question_type_item_key: 'p2_qtype_statement',
      primary_topic: topicRes.primary,
      primary_topic_label_vi: PART2_TOPIC_LABELS_VI[topicRes.primary],
      primary_topic_item_key: `p2_topic_${topicRes.primary.toLowerCase()}`,
      confidence: 0.90,
      provenance: 'RULE_LOCAL',
      approval_status: 'APPROVED',
      is_auto_approved: true,
      reasoning: 'Câu trần thuật (Statement).',
    };
  }

  // 13. FALLBACK: OTHER_PART2 (NEEDS_REVIEW)
  return {
    question_number: q.question_number,
    part: 'part2',
    question_type: 'OTHER_PART2',
    question_type_label_vi: PART2_QTYPE_LABELS_VI.OTHER_PART2,
    question_type_item_key: 'p2_qtype_other_part2',
    primary_topic: topicRes.primary,
    primary_topic_label_vi: PART2_TOPIC_LABELS_VI[topicRes.primary],
    primary_topic_item_key: `p2_topic_${topicRes.primary.toLowerCase()}`,
    confidence: 0.65,
    provenance: 'RULE_LOCAL',
    approval_status: 'NEEDS_REVIEW',
    is_auto_approved: false,
    reasoning: 'Độ tin cậy chưa đạt ngưỡng. Cần Admin xem xét duyệt.',
  };
}

// Batch Part 2 Classifier
export function classifyPart2Questions(questions: Part2ClassificationInput[]): Part2ClassificationResult[] {
  return questions.map(classifySinglePart2Question);
}

// GPT Hybrid Packet Exporter for Part 2
export function exportPart2GptHybridPacket(questions: Part2ClassificationInput[]): string {
  const packet: GptHybridPart2ExportPacket = {
    schema_version: 'ori.toeic.gpt_hybrid_p2.v1',
    test_type: 'part2_classification',
    questions: questions.map((q) => ({
      questionNumber: q.question_number,
      part: 'P2',
      transcript: q.transcript || undefined,
      correctAnswer: q.correct_answer || undefined,
    })),
  };
  return JSON.stringify(packet, null, 2);
}

// GPT Hybrid Result Importer for Part 2
export function importPart2GptHybridResult(
  gptJsonText: string,
  originalQuestions: Part2ClassificationInput[]
): Part2ClassificationResult[] {
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
      if (gptRes && gptRes.questionType) {
        const qType: Part2QuestionType = gptRes.questionType in PART2_QTYPE_LABELS_VI ? gptRes.questionType : 'OTHER_PART2';
        const topic: Part2SituationalTopic = gptRes.primaryTopic in PART2_TOPIC_LABELS_VI ? gptRes.primaryTopic : 'OTHER_TOPIC';
        return {
          question_number: q.question_number,
          part: 'part2',
          question_type: qType,
          question_type_label_vi: PART2_QTYPE_LABELS_VI[qType],
          question_type_item_key: `p2_qtype_${qType.toLowerCase()}`,
          primary_topic: topic,
          primary_topic_label_vi: PART2_TOPIC_LABELS_VI[topic],
          primary_topic_item_key: `p2_topic_${topic.toLowerCase()}`,
          confidence: Math.min(1.0, Math.max(0.7, gptRes.confidence || 0.9)),
          provenance: 'GPT_HYBRID',
          approval_status: 'SUGGESTED',
          is_auto_approved: false,
          reasoning: gptRes.reasoning || 'Nhập từ phân tích GPT Hybrid Part 2.',
        };
      }
      return classifySinglePart2Question(q);
    });
  } catch (err: any) {
    throw new Error(`Lỗi parse dữ liệu GPT Hybrid Part 2 JSON: ${err.message}`);
  }
}
