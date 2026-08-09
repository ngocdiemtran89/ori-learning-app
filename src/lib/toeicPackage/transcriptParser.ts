// ============================================================
// Phase P3.5G: One-Click TOEIC Test Package Importer - Listening Transcript Parser
// ============================================================

export interface TranscriptMap {
  questions: Map<number, string>; // Q1..Q31 -> transcript text
  groups: Map<string, string>; // "Q32–34" -> group transcript text
}

export function parseTranscriptText(rawText: string): TranscriptMap {
  const qTranscripts = new Map<number, string>();
  const gTranscripts = new Map<string, string>();

  if (!rawText || !rawText.trim()) {
    return { questions: qTranscripts, groups: gTranscripts };
  }

  const text = rawText.trim();

  // 1. Group Transcript matching: "Q32-34", "Questions 32-34", "32-34", "32–34"
  const groupRegex = /(?:Questions?|Q)?\s*([3-9][0-9]|100)\s*[–\-]\s*([3-9][0-9]|100)\s*[:\.]?([\s\S]*?)(?=(?:Questions?|Q)?\s*[3-9][0-9]\s*[–\-]\s*[3-9][0-9]|PART|\bQ?[0-9]{1,3}\b|$)/gi;

  let gMatch: RegExpExecArray | null;
  while ((gMatch = groupRegex.exec(text)) !== null) {
    const startQ = parseInt(gMatch[1], 10);
    const endQ = parseInt(gMatch[2], 10);
    const content = gMatch[3].trim();

    if (content && endQ - startQ === 2) {
      const key = `Q${startQ}–${endQ}`;
      gTranscripts.set(key, content);
    }
  }

  // 2. Question Transcript matching: "1. ...", "Question 1", "Q1: ..."
  const qRegex = /(?:Question|Q)?\s*([0-9]{1,2})\s*[\.:,\-]\s*([\s\S]*?)(?=(?:Question|Q)?\s*[0-9]{1,2}\s*[\.:,\-]|PART|\bQ?[3-9][0-9]\b|$)/gi;

  let qMatch: RegExpExecArray | null;
  while ((qMatch = qRegex.exec(text)) !== null) {
    const qNum = parseInt(qMatch[1], 10);
    const content = qMatch[2].trim();

    if (qNum >= 1 && qNum <= 31 && content) {
      qTranscripts.set(qNum, content);
    }
  }

  return {
    questions: qTranscripts,
    groups: gTranscripts,
  };
}
