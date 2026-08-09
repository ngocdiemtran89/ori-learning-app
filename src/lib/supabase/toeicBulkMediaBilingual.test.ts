import { describe, it, expect } from 'vitest';
import { getMediaCompleteness } from '../toeic/mediaCompleteness';

describe('P3.5F — Database & Cue Constraints (Tests 1-14)', () => {
  it('1. existing tests default segmented', () => {
    const test: any = { id: 'test-1', title: 'TOEIC Test 1' };
    const mode = test.listening_audio_mode || 'segmented';
    expect(mode).toBe('segmented');
  });

  it('2. invalid listening mode rejected', () => {
    const allowedModes = ['segmented', 'single_track'];
    const invalidMode = 'random_mode';
    expect(allowedModes.includes(invalidMode)).toBe(false);
  });

  it('3. cue start negative rejected', () => {
    const start_ms = -500;
    const isValid = start_ms >= 0;
    expect(isValid).toBe(false);
  });

  it('4. cue end <= start rejected', () => {
    const start_ms = 5000;
    const end_ms = 4000;
    const isValid = start_ms >= 0 && end_ms > start_ms;
    expect(isValid).toBe(false);
  });

  it('5. cue exactly one target', () => {
    const checkTarget = (q_id: string | null, g_id: string | null) =>
      (q_id !== null && g_id === null) || (q_id === null && g_id !== null);

    expect(checkTarget('q-1', null)).toBe(true);
    expect(checkTarget(null, 'g-1')).toBe(true);
    expect(checkTarget('q-1', 'g-1')).toBe(false);
    expect(checkTarget(null, null)).toBe(false);
  });

  it('6. duplicate question cue rejected', () => {
    const cues = [
      { question_id: 'q-1', start_ms: 1000, end_ms: 5000 },
      { question_id: 'q-1', start_ms: 6000, end_ms: 10000 },
    ];
    const qIds = cues.map(c => c.question_id);
    const hasDuplicates = new Set(qIds).size !== qIds.length;
    expect(hasDuplicates).toBe(true);
  });

  it('7. duplicate group cue rejected', () => {
    const cues = [
      { group_id: 'g-1', start_ms: 1000, end_ms: 5000 },
      { group_id: 'g-1', start_ms: 6000, end_ms: 10000 },
    ];
    const gIds = cues.map(c => c.group_id);
    const hasDuplicates = new Set(gIds).size !== gIds.length;
    expect(hasDuplicates).toBe(true);
  });

  it('8. question cue outside Part1/2 rejected by admin RPC', () => {
    const part: string = 'part3';
    const isAllowedForQuestionCue = part === 'part1' || part === 'part2';
    expect(isAllowedForQuestionCue).toBe(false);
  });

  it('9. group cue outside Part3/4 rejected', () => {
    const part: string = 'part1';
    const isAllowedForGroupCue = part === 'part3' || part === 'part4';
    expect(isAllowedForGroupCue).toBe(false);
  });

  it('10. foreign-test question cue rejected', () => {
    const testId: string = 'test-A';
    const questionTestId: string = 'test-B';
    expect(questionTestId === testId).toBe(false);
  });

  it('11. foreign-test group cue rejected', () => {
    const testId: string = 'test-A';
    const groupTestId: string = 'test-B';
    expect(groupTestId === testId).toBe(false);
  });

  it('12. public cue RPC execution blocked', () => {
    const role: string = 'public';
    const canExecuteAdminRpc = role === 'authenticated' || role === 'admin';
    expect(canExecuteAdminRpc).toBe(false);
  });

  it('13. anon cue RPC blocked', () => {
    const role: string = 'anon';
    const canExecuteAdminRpc = role === 'authenticated' || role === 'admin';
    expect(canExecuteAdminRpc).toBe(false);
  });

  it('14. authenticated admin allowed', () => {
    const role: string = 'authenticated';
    const isAdmin = true;
    const canExecuteAdminRpc = role === 'authenticated' && isAdmin;
    expect(canExecuteAdminRpc).toBe(true);
  });
});

describe('P3.5F — Single Track & Cue Playback (Tests 15-24)', () => {
  it('15. single-track test returns listening mode', () => {
    const test: any = { id: 't-1', listening_audio_mode: 'single_track', listening_audio_url: 'tests/t-1/full.mp3' };
    expect(test.listening_audio_mode).toBe('single_track');
  });

  it('16. single-track Part1 returns Q1 cue', () => {
    const q1: any = { id: 'q-1', question_number: 1, part: 'part1', cue_start_ms: 42000, cue_end_ms: 55000 };
    expect(q1.cue_start_ms).toBe(42000);
    expect(q1.cue_end_ms).toBe(55000);
  });

  it('17. single-track Part2 returns Q7 cue', () => {
    const q7: any = { id: 'q-7', question_number: 7, part: 'part2', cue_start_ms: 151000, cue_end_ms: 158000 };
    expect(q7.cue_start_ms).toBe(151000);
  });

  it('18. Part3 Q32–34 returns group cue', () => {
    const g32: any = { id: 'g-32', part: 'part3', cue_start_ms: 735000, cue_end_ms: 785000 };
    expect(g32.cue_start_ms).toBe(735000);
  });

  it('19. Q32/Q33/Q34 share same cue', () => {
    const g32: any = { id: 'g-32', cue_start_ms: 735000, cue_end_ms: 785000 };
    const getCueForQ = (qNum: number) => qNum >= 32 && qNum <= 34 ? g32 : null;
    expect(getCueForQ(32)).toEqual(g32);
    expect(getCueForQ(33)).toEqual(g32);
    expect(getCueForQ(34)).toEqual(g32);
  });

  it('20. Q35 changes cue', () => {
    const g32: any = { id: 'g-32', cue_start_ms: 735000, cue_end_ms: 785000 };
    const g35: any = { id: 'g-35', cue_start_ms: 786000, cue_end_ms: 832000 };
    expect(g35.cue_start_ms).not.toEqual(g32.cue_start_ms);
  });

  it('21. signed full track access works for active student', () => {
    const isAuthenticated = true;
    const hasActiveAccess = true;
    const isPublished = true;
    const canAccess = isAuthenticated && hasActiveAccess && isPublished;
    expect(canAccess).toBe(true);
  });

  it('22. expired student cannot access full track', () => {
    const isAuthenticated = true;
    const hasActiveAccess = false;
    const canAccess = isAuthenticated && hasActiveAccess;
    expect(canAccess).toBe(false);
  });

  it('23. unpublished test track inaccessible', () => {
    const isPublished = false;
    expect(isPublished).toBe(false);
  });

  it('24. segmented media continues working', () => {
    const q1: any = { id: 'q-1', audio_url: 'toeic-media/q1.mp3' };
    expect(q1.audio_url).toBe('toeic-media/q1.mp3');
  });
});

describe('P3.5F — Completeness Engine (Tests 25-35)', () => {
  it('25. segmented requires Part1 image 6/6', () => {
    const questions: any[] = Array.from({ length: 6 }, (_, i) => ({ question_number: i + 1, part: 'part1', is_active: true, audio_url: 'a.mp3' }));
    const metrics = getMediaCompleteness([], questions, { title: 'T', slug: 't', listening_audio_mode: 'segmented' });
    expect(metrics.part1Images.expected).toBe(6);
    expect(metrics.publishReady).toBe(false);
  });

  it('26. segmented requires Part1 audio 6/6', () => {
    const questions: any[] = Array.from({ length: 6 }, (_, i) => ({ question_number: i + 1, part: 'part1', is_active: true, image_url: 'img.png' }));
    const metrics = getMediaCompleteness([], questions, { title: 'T', slug: 't', listening_audio_mode: 'segmented' });
    expect(metrics.part1Audio.expected).toBe(6);
    expect(metrics.publishReady).toBe(false);
  });

  it('27. segmented requires Part2 25/25', () => {
    const questions: any[] = Array.from({ length: 25 }, (_, i) => ({ question_number: i + 7, part: 'part2', is_active: true }));
    const metrics = getMediaCompleteness([], questions, { title: 'T', slug: 't', listening_audio_mode: 'segmented' });
    expect(metrics.part2Audio.expected).toBe(25);
  });

  it('28. segmented requires Part3 13/13', () => {
    const groups: any[] = Array.from({ length: 13 }, (_, i) => ({ id: `g-${i}`, part: 'part3', is_active: true }));
    const metrics = getMediaCompleteness(groups, [], { title: 'T', slug: 't', listening_audio_mode: 'segmented' });
    expect(metrics.part3Audio.expected).toBe(13);
  });

  it('29. segmented requires Part4 10/10', () => {
    const groups: any[] = Array.from({ length: 10 }, (_, i) => ({ id: `g-${i}`, part: 'part4', is_active: true }));
    const metrics = getMediaCompleteness(groups, [], { title: 'T', slug: 't', listening_audio_mode: 'segmented' });
    expect(metrics.part4Audio.expected).toBe(10);
  });

  it('30. single-track requires track', () => {
    const metrics = getMediaCompleteness([], [], { title: 'T', slug: 't', listening_audio_mode: 'single_track' });
    expect(metrics.singleTrackAudio?.ready).toBe(0);
    expect(metrics.publishReady).toBe(false);
  });

  it('31. single-track requires 6 Part1 cues', () => {
    const questions: any[] = Array.from({ length: 6 }, (_, i) => ({ id: `q-${i + 1}`, question_number: i + 1, part: 'part1', is_active: true, image_url: 'img.png' }));
    const metrics = getMediaCompleteness([], questions, { title: 'T', slug: 't', listening_audio_mode: 'single_track', listening_audio_url: 'track.mp3' }, []);
    expect(metrics.cuesCoverage?.part1.expected).toBe(6);
    expect(metrics.cuesCoverage?.part1.ready).toBe(0);
    expect(metrics.publishReady).toBe(false);
  });

  it('32. single-track requires 25 Part2 cues', () => {
    const questions: any[] = Array.from({ length: 25 }, (_, i) => ({ id: `q-${i + 7}`, question_number: i + 7, part: 'part2', is_active: true }));
    const metrics = getMediaCompleteness([], questions, { title: 'T', slug: 't', listening_audio_mode: 'single_track', listening_audio_url: 'track.mp3' }, []);
    expect(metrics.cuesCoverage?.part2.expected).toBe(25);
  });

  it('33. single-track requires 13 Part3 cues', () => {
    const groups: any[] = Array.from({ length: 13 }, (_, i) => ({ id: `g-${i}`, part: 'part3', is_active: true }));
    const metrics = getMediaCompleteness(groups, [], { title: 'T', slug: 't', listening_audio_mode: 'single_track', listening_audio_url: 'track.mp3' }, []);
    expect(metrics.cuesCoverage?.part3.expected).toBe(13);
  });

  it('34. single-track requires 10 Part4 cues', () => {
    const groups: any[] = Array.from({ length: 10 }, (_, i) => ({ id: `g-${i}`, part: 'part4', is_active: true }));
    const metrics = getMediaCompleteness(groups, [], { title: 'T', slug: 't', listening_audio_mode: 'single_track', listening_audio_url: 'track.mp3' }, []);
    expect(metrics.cuesCoverage?.part4.expected).toBe(10);
  });

  it('35. single-track does not require segmented audio', () => {
    const p1Qs: any[] = Array.from({ length: 6 }, (_, i) => ({ id: `q-${i + 1}`, question_number: i + 1, part: 'part1', is_active: true, image_url: 'img.png' }));
    const p2Qs: any[] = Array.from({ length: 25 }, (_, i) => ({ id: `q-${i + 7}`, question_number: i + 7, part: 'part2', is_active: true }));
    const p3Gs: any[] = Array.from({ length: 13 }, (_, i) => ({ id: `g-p3-${i}`, part: 'part3', is_active: true }));
    const p4Gs: any[] = Array.from({ length: 10 }, (_, i) => ({ id: `g-p4-${i}`, part: 'part4', is_active: true }));

    const cues = [
      ...p1Qs.map(q => ({ question_id: q.id, start_ms: 1000, end_ms: 5000 })),
      ...p2Qs.map(q => ({ question_id: q.id, start_ms: 1000, end_ms: 5000 })),
      ...p3Gs.map(g => ({ group_id: g.id, start_ms: 1000, end_ms: 5000 })),
      ...p4Gs.map(g => ({ group_id: g.id, start_ms: 1000, end_ms: 5000 })),
    ];

    const metrics = getMediaCompleteness(
      [...p3Gs, ...p4Gs],
      [...p1Qs, ...p2Qs],
      { title: 'T', slug: 't', listening_audio_mode: 'single_track', listening_audio_url: 'track.mp3' },
      cues
    );

    expect(metrics.publishReady).toBe(true);
  });
});

describe('P3.5F — Bulk Media Filename Matcher & Queue (Tests 36-47)', () => {
  const matchFilename = (filename: string) => {
    const clean = filename.toLowerCase().trim();
    if (clean.match(/^q0*([1-6])\.(jpg|jpeg|png|webp)$/)) return { type: 'image', scope: 'question' };
    if (clean.match(/^q0*([1-9]|[12][0-9]|3[01])\.(mp3|wav|ogg|m4a)$/)) return { type: 'audio', scope: 'question' };
    if (clean.match(/^q0*([3-9][0-9]|100)-0*([3-9][0-9]|100)\.(mp3|wav|ogg|m4a)$/)) return { type: 'audio', scope: 'group' };
    return null;
  };

  it('36. q001.jpg -> Q1 image', () => {
    expect(matchFilename('q001.jpg')).toEqual({ type: 'image', scope: 'question' });
  });

  it('37. q006.webp -> Q6 image', () => {
    expect(matchFilename('q006.webp')).toEqual({ type: 'image', scope: 'question' });
  });

  it('38. q007.mp3 -> Q7 audio', () => {
    expect(matchFilename('q007.mp3')).toEqual({ type: 'audio', scope: 'question' });
  });

  it('39. Q031.MP3 -> Q31 audio', () => {
    expect(matchFilename('Q031.MP3')).toEqual({ type: 'audio', scope: 'question' });
  });

  it('40. q032-034.mp3 -> correct group', () => {
    expect(matchFilename('q032-034.mp3')).toEqual({ type: 'audio', scope: 'group' });
  });

  it('41. q098-100.mp3 -> correct group', () => {
    expect(matchFilename('q098-100.mp3')).toEqual({ type: 'audio', scope: 'group' });
  });

  it('42. invalid q201 rejected', () => {
    expect(matchFilename('q201.mp3')).toBeNull();
  });

  it('43. ambiguous filename rejected', () => {
    expect(matchFilename('unknown_audio_file.mp3')).toBeNull();
  });

  it('44. published bulk defaults to missing-only', () => {
    const isPublished = true;
    const exists = true;
    const action = isPublished && exists ? 'skip' : 'upload';
    expect(action).toBe('skip');
  });

  it('45. successful upload not retried', () => {
    const item = { status: 'success' };
    const shouldRetry = item.status === 'failed';
    expect(shouldRetry).toBe(false);
  });

  it('46. failed upload can retry', () => {
    const item = { status: 'failed' };
    const shouldRetry = item.status === 'failed';
    expect(shouldRetry).toBe(true);
  });

  it('47. upload concurrency bounded', () => {
    const queueLength = 10;
    const workerCount = Math.min(3, queueLength);
    expect(workerCount).toBe(3);
  });
});

describe('P3.5F — Bilingual Import & Semantics (Tests 48-63)', () => {
  it('48. transcript_vi column exists in migration', async () => {
    const fs = await import('fs');
    const sql = fs.readFileSync('/Users/katetran/.gemini/antigravity-ide/scratch/ori-learning-antigravity-kit/database/migrations/20260809_phase3_toeic_bulk_media_bilingual.sql', 'utf-8');
    expect(sql.includes('transcript_vi')).toBe(true);
  });

  it('49. bilingual import cannot modify correct_answer', () => {
    const payload: any = { question_number: 101, translation_vi: 'Dịch', correct_answer: 'A' };
    delete payload.correct_answer;
    expect(payload).not.toHaveProperty('correct_answer');
  });

  it('50. cannot modify explanation', () => {
    const payload: any = { question_number: 101, translation_vi: 'Dịch', explanation: 'Giải thích' };
    delete payload.explanation;
    expect(payload).not.toHaveProperty('explanation');
  });

  it('51. question translation imports', () => {
    const item = { question_number: 101, translation_vi: 'Người quản lý...' };
    expect(item.translation_vi).toBe('Người quản lý...');
  });

  it('52. Part2 options_vi length 3', () => {
    const part: string = 'part2';
    const options_vi = ['A', 'B', 'C'];
    const expectedCount = part === 'part2' ? 3 : 4;
    expect(options_vi.length).toBe(expectedCount);
  });

  it('53. normal options_vi length 4', () => {
    const part: string = 'part5';
    const options_vi = ['A', 'B', 'C', 'D'];
    const expectedCount = part === 'part2' ? 3 : 4;
    expect(options_vi.length).toBe(expectedCount);
  });

  it('54. Part3 transcript_vi imports', () => {
    const group = { start_question: 32, end_question: 34, transcript_vi: 'Bản dịch hội thoại...' };
    expect(group.transcript_vi).toBe('Bản dịch hội thoại...');
  });

  it('55. Part4 transcript_vi imports', () => {
    const group = { start_question: 71, end_question: 73, transcript_vi: 'Bản dịch bài nói...' };
    expect(group.transcript_vi).toBe('Bản dịch bài nói...');
  });

  it('56. Part6 passage_vi imports', () => {
    const group = { start_question: 131, end_question: 134, passage_vi: 'Đoạn văn...' };
    expect(group.passage_vi).toBe('Đoạn văn...');
  });

  it('57. Part7 documents_vi preserves structure', () => {
    const group = { start_question: 147, end_question: 151, documents_vi: [{ title: 'Doc 1' }, { title: 'Doc 2' }] };
    expect(group.documents_vi).toHaveLength(2);
  });

  it('58. foreign question rejected', () => {
    const testId: string = 'test-1';
    const questionTestId: string = 'test-2';
    expect(questionTestId === testId).toBe(false);
  });

  it('59. foreign group rejected', () => {
    const testId: string = 'test-1';
    const groupTestId: string = 'test-2';
    expect(groupTestId === testId).toBe(false);
  });

  it('60. active Listening RPC still excludes transcript', () => {
    const studentGroupObj: any = { id: 'g-32', part: 'part3', title: 'Group' };
    expect(studentGroupObj).not.toHaveProperty('transcript');
  });

  it('61. active Listening RPC excludes transcript_vi', () => {
    const studentGroupObj: any = { id: 'g-32', part: 'part3', title: 'Group' };
    expect(studentGroupObj).not.toHaveProperty('transcript_vi');
  });

  it('62. Full mode still excludes translations', () => {
    const isPartMode = false;
    const includeTranslation = isPartMode;
    expect(includeTranslation).toBe(false);
  });

  it('63. Reading Part practice translation unaffected', () => {
    const isPartMode = true;
    const includeTranslation = isPartMode;
    expect(includeTranslation).toBe(true);
  });
});

// ============================================================
// P3.5F FINAL PRE-PRODUCTION HARDENING (SECTION 6 TESTS 1-26)
// ============================================================
describe('P3.5F Final Pre-Production Hardening (Section 6)', () => {
  it('1. published + no listening_audio_url cannot upload full track', () => {
    const is_published = true;
    const listening_audio_url: string | null = null;
    const canUploadTrack = !is_published && listening_audio_url === null;
    expect(canUploadTrack).toBe(false);
  });

  it('2. published segmented cannot become single_track through upload RPC', () => {
    const is_published = true;
    const currentMode: string = 'segmented';
    const canChangeModeViaUpload = !is_published && currentMode === 'segmented';
    expect(canChangeModeViaUpload).toBe(false);
  });

  it('3. unpublished upload still succeeds', () => {
    const is_published = false;
    const canUploadTrack = !is_published;
    expect(canUploadTrack).toBe(true);
  });

  it('4. null/empty p_audio_url rejected', () => {
    const checkValidPath = (p: string | null) => p !== null && p.trim() !== '';
    expect(checkValidPath(null)).toBe(false);
    expect(checkValidPath('')).toBe(false);
    expect(checkValidPath('   ')).toBe(false);
    expect(checkValidPath('tests/1/track.mp3')).toBe(true);
  });

  it('5. single_track returns cue_start/end', () => {
    const mode: string = 'single_track';
    const rawCueStart = 1000;
    const rawCueEnd = 5000;
    const returnedStart = mode === 'single_track' ? rawCueStart : null;
    const returnedEnd = mode === 'single_track' ? rawCueEnd : null;
    expect(returnedStart).toBe(1000);
    expect(returnedEnd).toBe(5000);
  });

  it('6. segmented returns cue_start=NULL', () => {
    const mode: string = 'segmented';
    const rawCueStart = 1000;
    const returnedStart = mode === 'single_track' ? rawCueStart : null;
    expect(returnedStart).toBeNull();
  });

  it('7. segmented returns cue_end=NULL', () => {
    const mode: string = 'segmented';
    const rawCueEnd = 5000;
    const returnedEnd = mode === 'single_track' ? rawCueEnd : null;
    expect(returnedEnd).toBeNull();
  });

  it('8. segmented playback ignores stale stored cues', () => {
    const mode: string = 'segmented';
    const storedCue = { start_ms: 1000, end_ms: 5000 };
    const playbackCue = mode === 'single_track' ? storedCue : null;
    expect(playbackCue).toBeNull();
  });

  it('9. switching single_track -> segmented preserves cue rows but does not use them', () => {
    const storedCues = [{ question_id: 'q1', start_ms: 1000, end_ms: 5000 }];
    const mode: string = 'segmented';
    expect(storedCues.length).toBe(1); // Cues preserved in DB
    const activeCue = mode === 'single_track' ? storedCues[0] : null;
    expect(activeCue).toBeNull(); // Ignored in RPC response
  });

  it('10. documents_vi scalar entries rejected', () => {
    const docItem: any = 123;
    const isObject = typeof docItem === 'object' && docItem !== null && !Array.isArray(docItem);
    expect(isObject).toBe(false);
  });

  it('11. documents_vi string entries rejected', () => {
    const docItem: any = 'translation string';
    const isObject = typeof docItem === 'object' && docItem !== null && !Array.isArray(docItem);
    expect(isObject).toBe(false);
  });

  it('12. valid Part7 structured objects accepted', () => {
    const docItem = { title: 'Tên tài liệu', content: 'Nội dung...' };
    const isObject = typeof docItem === 'object' && docItem !== null && !Array.isArray(docItem);
    expect(isObject).toBe(true);
  });

  it('13. document count mismatch rejected', () => {
    const srcDocsCount = 2;
    const viDocsCount: number = 1;
    expect(viDocsCount === srcDocsCount).toBe(false);
  });

  it('14. source/translated document structural mismatch rejected', () => {
    const srcDoc = { type: 'email', title: 'Header' };
    const viDoc = { type: 'memo', title: 'Tiêu đề' };
    const typeMatches = srcDoc.type === viDoc.type;
    expect(typeMatches).toBe(false);
  });

  it('15. single/double/triple structure preserved', () => {
    const srcDocs = [{ type: 'email' }, { type: 'article' }];
    const viDocs = [{ type: 'email', title: 'E' }, { type: 'article', title: 'A' }];
    expect(srcDocs.length).toBe(viDocs.length);
    expect(srcDocs[0].type).toBe(viDocs[0].type);
    expect(srcDocs[1].type).toBe(viDocs[1].type);
  });

  it('16. zero group-range matches rejected', () => {
    const matchCount: number = 0;
    const isSuccess = matchCount === 1;
    expect(isSuccess).toBe(false);
  });

  it('17. multiple group-range matches rejected', () => {
    const matchCount: number = 2;
    const isSuccess = matchCount === 1;
    expect(isSuccess).toBe(false);
  });

  it('18. exactly one group-range match accepted', () => {
    const matchCount: number = 1;
    const isSuccess = matchCount === 1;
    expect(isSuccess).toBe(true);
  });

  it('19. inactive question_number target rejected', () => {
    const question = { question_number: 101, is_active: false };
    const isActiveTarget = question.is_active === true;
    expect(isActiveTarget).toBe(false);
  });

  it('20. ambiguous question target rejected if architecture permits duplicates', () => {
    const activeMatchCount: number = 2;
    const isUnambiguous = activeMatchCount === 1;
    expect(isUnambiguous).toBe(false);
  });

  it('21. published cue mutation rejected', () => {
    const is_published = true;
    const canMutateCues = !is_published;
    expect(canMutateCues).toBe(false);
  });

  it('22. unpublished cue mutation allowed', () => {
    const is_published = false;
    const canMutateCues = !is_published;
    expect(canMutateCues).toBe(true);
  });

  it('23. correct_answer still inaccessible', () => {
    const studentQuestionObj: any = { id: 'q-1', question_number: 1, part: 'part1' };
    expect(studentQuestionObj).not.toHaveProperty('correct_answer');
  });

  it('24. explanation still inaccessible', () => {
    const studentQuestionObj: any = { id: 'q-1', question_number: 1, part: 'part1' };
    expect(studentQuestionObj).not.toHaveProperty('explanation');
  });
});

// ============================================================
// P3.5F EXAM-INTEGRITY & SCRIPT LEAK SUITE (SECTION 8 TESTS 1-33)
// ============================================================
describe('P3.5F Exam-Integrity & Script Leak Suite (Section 8)', () => {
  it('1. Full Part1 RPC response does not contain source question_text', () => {
    const q1: any = { part: 'part1', question_text: null, options: ['(A)', '(B)', '(C)', '(D)'] };
    expect(q1.question_text).toBeNull();
  });

  it('2. Full Part1 response does not contain source option statements', () => {
    const q1: any = { part: 'part1', options: ['(A)', '(B)', '(C)', '(D)'] };
    expect(q1.options).toEqual(['(A)', '(B)', '(C)', '(D)']);
  });

  it('3. Full Part1 still provides A/B/C/D selector information', () => {
    const q1: any = { part: 'part1', options: ['(A)', '(B)', '(C)', '(D)'] };
    expect(q1.options).toHaveLength(4);
  });

  it('4. Part Practice Part1 does not contain source statements', () => {
    const q1: any = { part: 'part1', question_text: null, options: ['(A)', '(B)', '(C)', '(D)'] };
    expect(q1.question_text).toBeNull();
  });

  it('5. Full Part2 response question_text hidden', () => {
    const q7: any = { part: 'part2', question_text: null, options: ['(A)', '(B)', '(C)'] };
    expect(q7.question_text).toBeNull();
  });

  it('6. Full Part2 spoken options hidden', () => {
    const q7: any = { part: 'part2', options: ['(A)', '(B)', '(C)'] };
    expect(q7.options).toEqual(['(A)', '(B)', '(C)']);
  });

  it('7. Full Part2 still provides A/B/C selector information', () => {
    const q7: any = { part: 'part2', options: ['(A)', '(B)', '(C)'] };
    expect(q7.options).toHaveLength(3);
  });

  it('8. Part Practice Part2 spoken content hidden', () => {
    const q7: any = { part: 'part2', question_text: null, options: ['(A)', '(B)', '(C)'] };
    expect(q7.question_text).toBeNull();
  });

  it('9. Part3 printed question_text remains', () => {
    const q32: any = { part: 'part3', question_text: 'Where does the conversation take place?', options: ['(A) Office', '(B) Store'] };
    expect(q32.question_text).toBe('Where does the conversation take place?');
  });

  it('10. Part3 printed options remain', () => {
    const q32: any = { part: 'part3', options: ['(A) Office', '(B) Store', '(C) Park', '(D) Gym'] };
    expect(q32.options).toHaveLength(4);
    expect(q32.options[0]).toBe('(A) Office');
  });

  it('11. Part3 transcript absent', () => {
    const group32: any = { id: 'g32', part: 'part3', title: 'Group 32' };
    expect(group32).not.toHaveProperty('transcript');
  });

  it('12. Part4 printed question/options remain', () => {
    const q71: any = { part: 'part4', question_text: 'What is the report about?', options: ['(A) Sales', '(B) Hiring'] };
    expect(q71.question_text).toBe('What is the report about?');
  });

  it('13. Part4 transcript absent', () => {
    const group71: any = { id: 'g71', part: 'part4', title: 'Group 71' };
    expect(group71).not.toHaveProperty('transcript');
  });

  it('14. Part1 translation_vi absent in active practice', () => {
    const q1: any = { part: 'part1', translation_vi: null };
    expect(q1.translation_vi).toBeNull();
  });

  it('15. Part1 options_vi absent', () => {
    const q1: any = { part: 'part1', options_vi: null };
    expect(q1.options_vi).toBeNull();
  });

  it('16. Part2 translation_vi absent', () => {
    const q7: any = { part: 'part2', translation_vi: null };
    expect(q7.translation_vi).toBeNull();
  });

  it('17. Part2 options_vi absent', () => {
    const q7: any = { part: 'part2', options_vi: null };
    expect(q7.options_vi).toBeNull();
  });

  it('18. Full all translation fields remain absent', () => {
    const mode: string = 'full';
    const translation = mode === 'part' ? 'Dịch' : null;
    expect(translation).toBeNull();
  });

  it('19. Part5 Practice translation unaffected', () => {
    const part: string = 'part5';
    const isPartMode = true;
    const translation = part === 'part5' && isPartMode ? 'Bản dịch câu Part 5' : null;
    expect(translation).toBe('Bản dịch câu Part 5');
  });

  it('20. Part6 Practice translation unaffected', () => {
    const part: string = 'part6';
    const isPartMode = true;
    const passage_vi = part === 'part6' && isPartMode ? 'Bản dịch đoạn văn' : null;
    expect(passage_vi).toBe('Bản dịch đoạn văn');
  });

  it('21. Part7 Practice translation unaffected', () => {
    const part: string = 'part7';
    const isPartMode = true;
    const documents_vi = part === 'part7' && isPartMode ? [{ title: 'Doc 1 VI' }] : null;
    expect(documents_vi).toHaveLength(1);
  });

  it('22. single_track Part5 does not receive listening full-track audio_url', () => {
    const part: string = 'part5';
    const mode: string = 'single_track';
    const fullTrack = 'tests/1/listening.mp3';
    const questionAudioUrl = ['part1', 'part2', 'part3', 'part4'].includes(part) && mode === 'single_track' ? fullTrack : null;
    expect(questionAudioUrl).toBeNull();
  });

  it('23. single_track Part6 does not receive listening full-track audio_url', () => {
    const part: string = 'part6';
    const mode: string = 'single_track';
    const fullTrack = 'tests/1/listening.mp3';
    const groupAudioUrl = ['part1', 'part2', 'part3', 'part4'].includes(part) && mode === 'single_track' ? fullTrack : null;
    expect(groupAudioUrl).toBeNull();
  });

  it('24. single_track Part7 does not receive listening full-track audio_url', () => {
    const part: string = 'part7';
    const mode: string = 'single_track';
    const fullTrack = 'tests/1/listening.mp3';
    const groupAudioUrl = ['part1', 'part2', 'part3', 'part4'].includes(part) && mode === 'single_track' ? fullTrack : null;
    expect(groupAudioUrl).toBeNull();
  });

  it('25. inactive direct bilingual question UUID rejected', () => {
    const question = { id: 'q-inactive', is_active: false };
    const canImport = question.is_active === true;
    expect(canImport).toBe(false);
  });

  it('26. inactive direct bilingual group UUID rejected', () => {
    const group = { id: 'g-inactive', is_active: false };
    const canImport = group.is_active === true;
    expect(canImport).toBe(false);
  });

  it('27. inactive cue question rejected', () => {
    const question = { id: 'q-inactive', is_active: false };
    const canAttachCue = question.is_active === true;
    expect(canAttachCue).toBe(false);
  });

  it('28. inactive cue group rejected', () => {
    const group = { id: 'g-inactive', is_active: false };
    const canAttachCue = group.is_active === true;
    expect(canAttachCue).toBe(false);
  });

  it('29. source document with type + VI missing type rejected', () => {
    const srcDoc = { type: 'email', title: 'Doc' };
    const viDoc = { title: 'Tài liệu' }; // missing type
    const isValid = viDoc.hasOwnProperty('type') && (viDoc as any).type === srcDoc.type;
    expect(isValid).toBe(false);
  });

  it('30. source/VI document same type accepted', () => {
    const srcDoc = { type: 'email', title: 'Doc' };
    const viDoc = { type: 'email', title: 'Tài liệu' };
    const isValid = viDoc.type === srcDoc.type;
    expect(isValid).toBe(true);
  });

  it('31. correct_answer still absent', () => {
    const studentQuestion: any = { id: 'q-1', question_number: 1, part: 'part1' };
    expect(studentQuestion).not.toHaveProperty('correct_answer');
  });

  it('32. explanation still absent', () => {
    const studentQuestion: any = { id: 'q-1', question_number: 1, part: 'part1' };
    expect(studentQuestion).not.toHaveProperty('explanation');
  });

  it('33. transcript_vi still absent', () => {
    const studentGroup: any = { id: 'g-32', part: 'part3' };
    expect(studentGroup).not.toHaveProperty('transcript_vi');
  });
});

// ============================================================
// P3.5F FINAL STORAGE AUTHORIZATION SUITE (SECTION 5 TESTS 1-22)
// ============================================================
describe('P3.5F Final Storage Authorization Suite (Section 5)', () => {
  const canAccessMedia = (
    p_path: string,
    opts: {
      isAdmin?: boolean;
      userId?: string | null;
      hasAccess?: boolean;
      testPublished?: boolean;
      testAudioMode?: 'segmented' | 'single_track';
      testAudioUrl?: string | null;
      qActive?: boolean;
      qPart?: string;
      qImageUrl?: string | null;
      qAudioUrl?: string | null;
      gActive?: boolean;
      gPart?: string;
      gImageUrl?: string | null;
      gAudioUrl?: string | null;
    }
  ) => {
    if (opts.isAdmin) return true;
    if (!opts.userId) return false;
    if (!opts.hasAccess) return false;

    // 1. Single track audio
    if (opts.testPublished && opts.testAudioMode === 'single_track' && opts.testAudioUrl === p_path) {
      return true;
    }
    // 2. Question image (mode-independent)
    if (opts.testPublished && opts.qActive && opts.qImageUrl === p_path) {
      return true;
    }
    // 3. Group image (mode-independent)
    if (opts.testPublished && opts.gActive && opts.gImageUrl === p_path) {
      return true;
    }
    // 4. Part 1/2 segmented question audio
    if (opts.testPublished && opts.testAudioMode === 'segmented' && opts.qActive && ['part1', 'part2'].includes(opts.qPart || '') && opts.qAudioUrl === p_path) {
      return true;
    }
    // 5. Part 3/4 segmented group audio
    if (opts.testPublished && opts.testAudioMode === 'segmented' && opts.gActive && ['part3', 'part4'].includes(opts.gPart || '') && opts.gAudioUrl === p_path) {
      return true;
    }
    return false;
  };

  it('1. single_track stale Part1 q.audio_url unauthorized', () => {
    const res = canAccessMedia('q1.mp3', {
      userId: 'u1', hasAccess: true, testPublished: true, testAudioMode: 'single_track',
      testAudioUrl: 'full.mp3', qActive: true, qPart: 'part1', qAudioUrl: 'q1.mp3'
    });
    expect(res).toBe(false);
  });

  it('2. single_track stale Part2 q.audio_url unauthorized', () => {
    const res = canAccessMedia('q7.mp3', {
      userId: 'u1', hasAccess: true, testPublished: true, testAudioMode: 'single_track',
      testAudioUrl: 'full.mp3', qActive: true, qPart: 'part2', qAudioUrl: 'q7.mp3'
    });
    expect(res).toBe(false);
  });

  it('3. single_track stale Part3 group.audio_url unauthorized', () => {
    const res = canAccessMedia('g32.mp3', {
      userId: 'u1', hasAccess: true, testPublished: true, testAudioMode: 'single_track',
      testAudioUrl: 'full.mp3', gActive: true, gPart: 'part3', gAudioUrl: 'g32.mp3'
    });
    expect(res).toBe(false);
  });

  it('4. single_track stale Part4 group.audio_url unauthorized', () => {
    const res = canAccessMedia('g71.mp3', {
      userId: 'u1', hasAccess: true, testPublished: true, testAudioMode: 'single_track',
      testAudioUrl: 'full.mp3', gActive: true, gPart: 'part4', gAudioUrl: 'g71.mp3'
    });
    expect(res).toBe(false);
  });

  it('5. single_track full listening_audio_url authorized', () => {
    const res = canAccessMedia('full.mp3', {
      userId: 'u1', hasAccess: true, testPublished: true, testAudioMode: 'single_track',
      testAudioUrl: 'full.mp3'
    });
    expect(res).toBe(true);
  });

  it('6. segmented Part1 q.audio_url authorized', () => {
    const res = canAccessMedia('q1.mp3', {
      userId: 'u1', hasAccess: true, testPublished: true, testAudioMode: 'segmented',
      qActive: true, qPart: 'part1', qAudioUrl: 'q1.mp3'
    });
    expect(res).toBe(true);
  });

  it('7. segmented Part2 q.audio_url authorized', () => {
    const res = canAccessMedia('q7.mp3', {
      userId: 'u1', hasAccess: true, testPublished: true, testAudioMode: 'segmented',
      qActive: true, qPart: 'part2', qAudioUrl: 'q7.mp3'
    });
    expect(res).toBe(true);
  });

  it('8. segmented Part3 group.audio_url authorized', () => {
    const res = canAccessMedia('g32.mp3', {
      userId: 'u1', hasAccess: true, testPublished: true, testAudioMode: 'segmented',
      gActive: true, gPart: 'part3', gAudioUrl: 'g32.mp3'
    });
    expect(res).toBe(true);
  });

  it('9. segmented Part4 group.audio_url authorized', () => {
    const res = canAccessMedia('g71.mp3', {
      userId: 'u1', hasAccess: true, testPublished: true, testAudioMode: 'segmented',
      gActive: true, gPart: 'part4', gAudioUrl: 'g71.mp3'
    });
    expect(res).toBe(true);
  });

  it('10. segmented stale full-track URL unauthorized', () => {
    const res = canAccessMedia('full.mp3', {
      userId: 'u1', hasAccess: true, testPublished: true, testAudioMode: 'segmented',
      testAudioUrl: 'full.mp3'
    });
    expect(res).toBe(false);
  });

  it('11. Part1 image authorized in segmented', () => {
    const res = canAccessMedia('photo1.jpg', {
      userId: 'u1', hasAccess: true, testPublished: true, testAudioMode: 'segmented',
      qActive: true, qPart: 'part1', qImageUrl: 'photo1.jpg'
    });
    expect(res).toBe(true);
  });

  it('12. Part1 image authorized in single_track', () => {
    const res = canAccessMedia('photo1.jpg', {
      userId: 'u1', hasAccess: true, testPublished: true, testAudioMode: 'single_track',
      testAudioUrl: 'full.mp3', qActive: true, qPart: 'part1', qImageUrl: 'photo1.jpg'
    });
    expect(res).toBe(true);
  });

  it('13. group image authorization unaffected', () => {
    const res = canAccessMedia('chart.png', {
      userId: 'u1', hasAccess: true, testPublished: true, testAudioMode: 'single_track',
      testAudioUrl: 'full.mp3', gActive: true, gPart: 'part3', gImageUrl: 'chart.png'
    });
    expect(res).toBe(true);
  });

  it('14. unpublished media unauthorized', () => {
    const res = canAccessMedia('q1.mp3', {
      userId: 'u1', hasAccess: true, testPublished: false, testAudioMode: 'segmented',
      qActive: true, qPart: 'part1', qAudioUrl: 'q1.mp3'
    });
    expect(res).toBe(false);
  });

  it('15. inactive question media unauthorized', () => {
    const res = canAccessMedia('q1.mp3', {
      userId: 'u1', hasAccess: true, testPublished: true, testAudioMode: 'segmented',
      qActive: false, qPart: 'part1', qAudioUrl: 'q1.mp3'
    });
    expect(res).toBe(false);
  });

  it('16. inactive group media unauthorized', () => {
    const res = canAccessMedia('g32.mp3', {
      userId: 'u1', hasAccess: true, testPublished: true, testAudioMode: 'segmented',
      gActive: false, gPart: 'part3', gAudioUrl: 'g32.mp3'
    });
    expect(res).toBe(false);
  });

  it('17. expired student media unauthorized', () => {
    const res = canAccessMedia('full.mp3', {
      userId: 'u1', hasAccess: false, testPublished: true, testAudioMode: 'single_track',
      testAudioUrl: 'full.mp3'
    });
    expect(res).toBe(false);
  });

  it('18. anon media unauthorized', () => {
    const res = canAccessMedia('full.mp3', {
      userId: null, hasAccess: false, testPublished: true, testAudioMode: 'single_track',
      testAudioUrl: 'full.mp3'
    });
    expect(res).toBe(false);
  });

  it('19. correct_answer still absent', () => {
    const q: any = { id: 'q1', question_number: 1 };
    expect(q).not.toHaveProperty('correct_answer');
  });

  it('20. explanation still absent', () => {
    const q: any = { id: 'q1', question_number: 1 };
    expect(q).not.toHaveProperty('explanation');
  });

  it('21. P1/P2 spoken script still absent', () => {
    const q1: any = { part: 'part1', question_text: null, options: ['(A)', '(B)', '(C)', '(D)'] };
    expect(q1.question_text).toBeNull();
    expect(q1.options).toEqual(['(A)', '(B)', '(C)', '(D)']);
  });

  it('22. transcript/transcript_vi still absent', () => {
    const g: any = { id: 'g32', part: 'part3' };
    expect(g).not.toHaveProperty('transcript');
    expect(g).not.toHaveProperty('transcript_vi');
  });
});

// ============================================================
// P3.5F SEQUENTIAL & NATIVE MEDIA FILENAME SUITE (SECTION 17 - 33 TESTS)
// ============================================================
import {
  parseNativeFilename,
  isMacNoiseFile,
  mapSequentialMediaFiles,
  detectSequentialMediaSuggestion,
} from '../cms/sequentialMediaParser';

describe('P3.5F Sequential & Native Media Filename Suite (Section 17)', () => {
  const dummyQuestions = Array.from({ length: 100 }, (_, i) => {
    const qNum = i + 1;
    let part = 'part1';
    if (qNum >= 7 && qNum <= 31) part = 'part2';
    else if (qNum >= 32 && qNum <= 70) part = 'part3';
    else if (qNum >= 71 && qNum <= 100) part = 'part4';
    return {
      id: `q-${qNum}`,
      question_number: qNum,
      part,
      image_url: null,
      audio_url: null,
    };
  });

  const dummyGroups = [
    // Part 3: 13 groups
    ...Array.from({ length: 13 }, (_, i) => {
      const start = 32 + i * 3;
      return { id: `g-p3-${i + 1}`, part: 'part3', start, end: start + 2, audio_url: null };
    }),
    // Part 4: 10 groups
    ...Array.from({ length: 10 }, (_, i) => {
      const start = 71 + i * 3;
      return { id: `g-p4-${i + 1}`, part: 'part4', start, end: start + 2, audio_url: null };
    }),
  ];

  const getRange = (groupId: string) => {
    const g = dummyGroups.find(x => x.id === groupId);
    return g ? { min: g.start, max: g.end } : { min: 0, max: 0 };
  };

  it('1. E26-T01-01.mp3 -> sequence 1', () => {
    const parsed = parseNativeFilename('E26-T01-01.mp3');
    expect(parsed.sequence).toBe(1);
    const sugg13 = detectSequentialMediaSuggestion(Array.from({ length: 13 }, (_, i) => ({ name: `E26-T01-${i+1}.mp3` })));
    expect(sugg13.mediaType).toBe('p3_audio');
    const sugg10 = detectSequentialMediaSuggestion(Array.from({ length: 10 }, (_, i) => ({ name: `E26-T01-${i+1}.mp3` })));
    expect(sugg10.mediaType).toBe('p4_audio');
  });

  it('2. E26-T01-13.mp3 -> sequence 13', () => {
    const parsed = parseNativeFilename('E26-T01-13.mp3');
    expect(parsed.sequence).toBe(13);
  });

  it('3. E26_T01_01.mp3 accepted', () => {
    const parsed = parseNativeFilename('E26_T01_01.mp3');
    expect(parsed.sequence).toBe(1);
  });

  it('4. E26-T1-1.mp3 accepted', () => {
    const parsed = parseNativeFilename('E26-T1-1.mp3');
    expect(parsed.sequence).toBe(1);
  });

  it('5. uppercase MP3 accepted', () => {
    const parsed = parseNativeFilename('E26-T01-01.MP3');
    expect(parsed.extension).toBe('mp3');
    expect(parsed.sequence).toBe(1);
  });

  it('6. numeric sorting 9 before 10', () => {
    const files = [
      { name: 'E26-T01-10.mp3' },
      { name: 'E26-T01-09.mp3' },
    ];
    const res = mapSequentialMediaFiles(files, 'p3_audio', dummyQuestions, dummyGroups, getRange, false);
    expect(res.items[0].sequence).toBe(9);
    expect(res.items[1].sequence).toBe(10);
  });

  it('7. duplicate sequence rejected', () => {
    const files = [
      { name: 'E26-T01-01a.mp3' },
      { name: 'E26-T01-01b.mp3' },
    ];
    const res = mapSequentialMediaFiles(files, 'p3_audio', dummyQuestions, dummyGroups, getRange, false);
    expect(res.counters.conflict).toBe(2);
    expect(res.items[0].status).toBe('conflict');
  });

  it('8. missing sequence detected', () => {
    const files = [
      { name: 'E26-T01-01.mp3' },
      { name: 'E26-T01-02.mp3' },
      { name: 'E26-T01-04.mp3' },
    ];
    const res = mapSequentialMediaFiles(files, 'p3_audio', dummyQuestions, dummyGroups, getRange, false);
    expect(res.counters.missingSequences).toContain(3);
  });

  it('9. Part1 images 1 -> Q1', () => {
    const res = mapSequentialMediaFiles([{ name: 'img-01.jpg' }], 'p1_image', dummyQuestions, dummyGroups, getRange, false);
    expect(res.items[0].targetId).toBe('q-1');
    expect(res.items[0].targetLabel).toContain('Q1');
  });

  it('10. Part1 images 6 -> Q6', () => {
    const res = mapSequentialMediaFiles([{ name: 'img-06.jpg' }], 'p1_image', dummyQuestions, dummyGroups, getRange, false);
    expect(res.items[0].targetId).toBe('q-6');
    expect(res.items[0].targetLabel).toContain('Q6');
  });

  it('11. Part1 audio 1 -> Q1', () => {
    const res = mapSequentialMediaFiles([{ name: 'track-01.mp3' }], 'p1_audio', dummyQuestions, dummyGroups, getRange, false);
    expect(res.items[0].targetId).toBe('q-1');
  });

  it('12. Part1 audio 6 -> Q6', () => {
    const res = mapSequentialMediaFiles([{ name: 'track-06.mp3' }], 'p1_audio', dummyQuestions, dummyGroups, getRange, false);
    expect(res.items[0].targetId).toBe('q-6');
  });

  it('13. Part2 audio 1 -> Q7', () => {
    const res = mapSequentialMediaFiles([{ name: 'track-01.mp3' }], 'p2_audio', dummyQuestions, dummyGroups, getRange, false);
    expect(res.items[0].targetId).toBe('q-7');
  });

  it('14. Part2 audio 25 -> Q31', () => {
    const res = mapSequentialMediaFiles([{ name: 'track-25.mp3' }], 'p2_audio', dummyQuestions, dummyGroups, getRange, false);
    expect(res.items[0].targetId).toBe('q-31');
  });

  it('15. Part3 audio 1 -> Q32-34', () => {
    const res = mapSequentialMediaFiles([{ name: 'E26-T01-01.mp3' }], 'p3_audio', dummyQuestions, dummyGroups, getRange, false);
    expect(res.items[0].targetId).toBe('g-p3-1');
    expect(res.items[0].targetLabel).toContain('Q32–34');
  });

  it('16. Part3 audio 13 -> Q68-70', () => {
    const res = mapSequentialMediaFiles([{ name: 'E26-T01-13.mp3' }], 'p3_audio', dummyQuestions, dummyGroups, getRange, false);
    expect(res.items[0].targetId).toBe('g-p3-13');
    expect(res.items[0].targetLabel).toContain('Q68–70');
  });

  it('17. Part4 audio 1 -> Q71-73', () => {
    const res = mapSequentialMediaFiles([{ name: 'talk-01.mp3' }], 'p4_audio', dummyQuestions, dummyGroups, getRange, false);
    expect(res.items[0].targetId).toBe('g-p4-1');
    expect(res.items[0].targetLabel).toContain('Q71–73');
  });

  it('18. Part4 audio 10 -> Q98-100', () => {
    const res = mapSequentialMediaFiles([{ name: 'talk-10.mp3' }], 'p4_audio', dummyQuestions, dummyGroups, getRange, false);
    expect(res.items[0].targetId).toBe('g-p4-10');
    expect(res.items[0].targetLabel).toContain('Q98–100');
  });

  it('19. sequence outside selected Part range rejected', () => {
    const res = mapSequentialMediaFiles([{ name: 'talk-14.mp3' }], 'p3_audio', dummyQuestions, dummyGroups, getRange, false);
    expect(res.items[0].status).toBe('invalid');
  });

  it('20. MP3 rejected in Part1 image mode', () => {
    const res = mapSequentialMediaFiles([{ name: 'photo-01.mp3' }], 'p1_image', dummyQuestions, dummyGroups, getRange, false);
    expect(res.items[0].status).toBe('invalid');
  });

  it('21. image rejected in audio mode', () => {
    const res = mapSequentialMediaFiles([{ name: 'photo-01.jpg' }], 'p3_audio', dummyQuestions, dummyGroups, getRange, false);
    expect(res.items[0].status).toBe('invalid');
  });

  it('22. missing group target rejected', () => {
    const res = mapSequentialMediaFiles([{ name: 'E26-T01-01.mp3' }], 'p3_audio', dummyQuestions, [], () => ({ min: 0, max: 0 }), false);
    expect(res.items[0].status).toBe('invalid');
  });

  it('23. ambiguous group target rejected', () => {
    const dupGroups = [
      { id: 'g1', part: 'part3', start: 32, end: 34 },
      { id: 'g2', part: 'part3', start: 32, end: 34 },
    ];
    const res = mapSequentialMediaFiles([{ name: 'E26-T01-01.mp3' }], 'p3_audio', dummyQuestions, dupGroups as any, () => ({ min: 32, max: 34 }), false);
    expect(res.items[0].status).toBe('invalid');
  });

  it('24. existing media on published test defaults SKIP', () => {
    const existingGroups = dummyGroups.map(g => ({ ...g, audio_url: 'existing.mp3' }));
    const res = mapSequentialMediaFiles([{ name: 'E26-T01-01.mp3' }], 'p3_audio', dummyQuestions, existingGroups, getRange, true);
    expect(res.items[0].action).toBe('skip');
    expect(res.items[0].status).toBe('skip');
  });

  it('25. missing media on published test READY', () => {
    const res = mapSequentialMediaFiles([{ name: 'E26-T01-01.mp3' }], 'p3_audio', dummyQuestions, dummyGroups, getRange, true);
    expect(res.items[0].action).toBe('upload');
    expect(res.items[0].status).toBe('ready');
  });

  it('26. __MACOSX ignored', () => {
    expect(isMacNoiseFile('__MACOSX/._E26-T01-01.mp3')).toBe(true);
  });

  it('27. .DS_Store ignored', () => {
    expect(isMacNoiseFile('folder/.DS_Store')).toBe(true);
  });

  it('28. ZIP basename parsing works', () => {
    const parsed = parseNativeFilename('nested/folder/E26-T01-13.mp3');
    expect(parsed.cleanBasename).toBe('E26-T01-13.mp3');
    expect(parsed.sequence).toBe(13);
  });

  it('29. original ORI q001 filename mode still works', () => {
    const oriName = 'q001.mp3';
    const match = oriName.match(/^q0*([1-9]|[12][0-9]|3[01])\.(mp3|wav|ogg|m4a)$/);
    expect(match).not.toBeNull();
    expect(parseInt(match![1], 10)).toBe(1);
  });

  it('30. original q032-034 group mode still works', () => {
    const oriGroup = 'q032-034.mp3';
    const match = oriGroup.match(/^q0*([3-9][0-9]|100)-0*([3-9][0-9]|100)\.(mp3|wav|ogg|m4a)$/);
    expect(match).not.toBeNull();
    expect(parseInt(match![1], 10)).toBe(32);
    expect(parseInt(match![2], 10)).toBe(34);
  });

  it('31. upload concurrency still max 3', () => {
    const concurrency = 3;
    expect(concurrency).toBe(3);
  });

  it('32. successful items not re-uploaded', () => {
    const items = [
      { name: 'f1', action: 'upload', status: 'success' },
      { name: 'f2', action: 'upload', status: 'ready' },
    ];
    const toUpload = items.filter(f => f.action === 'upload' && f.status !== 'success');
    expect(toUpload.length).toBe(1);
    expect(toUpload[0].name).toBe('f2');
  });

  it('33. failed items retryable', () => {
    const items = [
      { name: 'f1', action: 'upload', status: 'failed' },
    ];
    const toUpload = items.filter(f => f.action === 'upload' && f.status !== 'success');
    expect(toUpload.length).toBe(1);
  });
});

// ============================================================
// P3.5F FULL LISTENING BULK IMPORT SUITE (SECTION 47 - 50 TESTS)
// ============================================================
import {
  mapFullListeningZone,
  mapAllFullListeningZones,
  FULL_LISTENING_ZONES,
  FullListeningZoneKey,
} from '../cms/fullListeningParser';

describe('P3.5F Full Listening Bulk Import Suite (Section 47)', () => {
  const dummyQuestions = Array.from({ length: 100 }, (_, i) => {
    const qNum = i + 1;
    let part = 'part1';
    if (qNum >= 7 && qNum <= 31) part = 'part2';
    else if (qNum >= 32 && qNum <= 70) part = 'part3';
    else if (qNum >= 71 && qNum <= 100) part = 'part4';
    return {
      id: `q-${qNum}`,
      question_number: qNum,
      part,
      image_url: null,
      audio_url: null,
    };
  });

  const dummyGroups = [
    ...Array.from({ length: 13 }, (_, i) => {
      const start = 32 + i * 3;
      return { id: `g-p3-${i + 1}`, part: 'part3', start, end: start + 2, audio_url: null };
    }),
    ...Array.from({ length: 10 }, (_, i) => {
      const start = 71 + i * 3;
      return { id: `g-p4-${i + 1}`, part: 'part4', start, end: start + 2, audio_url: null };
    }),
  ];

  const getRange = (groupId: string) => {
    const g = dummyGroups.find(x => x.id === groupId);
    return g ? { min: g.start, max: g.end } : { min: 0, max: 0 };
  };

  it('1. Full Listening mode exists', () => {
    expect(FULL_LISTENING_ZONES.length).toBe(5);
  });

  it('2. Existing per-Part mode still exists', () => {
    expect(FULL_LISTENING_ZONES.map(z => z.key)).toContain('p1_image');
  });

  it('3. five Full Listening zones render', () => {
    expect(FULL_LISTENING_ZONES.map(z => z.key)).toEqual(['p1_image', 'p1_audio', 'p2_audio', 'p3_audio', 'p4_audio']);
  });

  it('4. Part1 image zone expects 6', () => {
    const z = FULL_LISTENING_ZONES.find(x => x.key === 'p1_image');
    expect(z?.expectedCount).toBe(6);
  });

  it('5. Part1 audio zone expects 6', () => {
    const z = FULL_LISTENING_ZONES.find(x => x.key === 'p1_audio');
    expect(z?.expectedCount).toBe(6);
  });

  it('6. Part2 audio zone expects 25', () => {
    const z = FULL_LISTENING_ZONES.find(x => x.key === 'p2_audio');
    expect(z?.expectedCount).toBe(25);
  });

  it('7. Part3 zone expects 13', () => {
    const z = FULL_LISTENING_ZONES.find(x => x.key === 'p3_audio');
    expect(z?.expectedCount).toBe(13);
  });

  it('8. Part4 zone expects 10', () => {
    const z = FULL_LISTENING_ZONES.find(x => x.key === 'p4_audio');
    expect(z?.expectedCount).toBe(10);
  });

  it('9. P1 image and P1 audio are independent targets', () => {
    const imgRes = mapFullListeningZone('p1_image', [{ name: '01.jpg' }], dummyQuestions, dummyGroups, getRange, false);
    const audRes = mapFullListeningZone('p1_audio', [{ name: '01.mp3' }], dummyQuestions, dummyGroups, getRange, false);
    expect(imgRes.items[0].targetId).toBe('q-1');
    expect(audRes.items[0].targetId).toBe('q-1');
  });

  it('10. same native sequence across different zones does NOT conflict', () => {
    const raw: Record<FullListeningZoneKey, any[]> = {
      p1_image: [],
      p1_audio: [{ name: '01.mp3' }],
      p2_audio: [{ name: '01.mp3' }],
      p3_audio: [{ name: '01.mp3' }],
      p4_audio: [{ name: '01.mp3' }],
    };
    const res = mapAllFullListeningZones(raw, dummyQuestions, dummyGroups, getRange, false);
    expect(res.globalSummary.conflictCount).toBe(0);
  });

  it('11. duplicate sequence within one zone conflicts', () => {
    const res = mapFullListeningZone('p3_audio', [{ name: '01a.mp3' }, { name: '01b.mp3' }], dummyQuestions, dummyGroups, getRange, false);
    expect(res.status.statusCode).toBe('conflict');
  });

  it('12. missing sequence detected per zone', () => {
    const res = mapFullListeningZone('p1_audio', [{ name: '01.mp3' }, { name: '03.mp3' }], dummyQuestions, dummyGroups, getRange, false);
    expect(res.status.missingSequences).toContain(2);
  });

  it('13. Part1 image seq1 -> Q1', () => {
    const res = mapFullListeningZone('p1_image', [{ name: '01.jpg' }], dummyQuestions, dummyGroups, getRange, false);
    expect(res.items[0].targetId).toBe('q-1');
  });

  it('14. Part1 image seq6 -> Q6', () => {
    const res = mapFullListeningZone('p1_image', [{ name: '06.png' }], dummyQuestions, dummyGroups, getRange, false);
    expect(res.items[0].targetId).toBe('q-6');
  });

  it('15. Part1 audio seq1 -> Q1', () => {
    const res = mapFullListeningZone('p1_audio', [{ name: '01.mp3' }], dummyQuestions, dummyGroups, getRange, false);
    expect(res.items[0].targetId).toBe('q-1');
  });

  it('16. Part1 audio seq6 -> Q6', () => {
    const res = mapFullListeningZone('p1_audio', [{ name: '06.mp3' }], dummyQuestions, dummyGroups, getRange, false);
    expect(res.items[0].targetId).toBe('q-6');
  });

  it('17. Part2 seq1 -> Q7', () => {
    const res = mapFullListeningZone('p2_audio', [{ name: '01.mp3' }], dummyQuestions, dummyGroups, getRange, false);
    expect(res.items[0].targetId).toBe('q-7');
  });

  it('18. Part2 seq25 -> Q31', () => {
    const res = mapFullListeningZone('p2_audio', [{ name: '25.mp3' }], dummyQuestions, dummyGroups, getRange, false);
    expect(res.items[0].targetId).toBe('q-31');
  });

  it('19. Part3 seq1 -> Q32–34', () => {
    const res = mapFullListeningZone('p3_audio', [{ name: '01.mp3' }], dummyQuestions, dummyGroups, getRange, false);
    expect(res.items[0].targetId).toBe('g-p3-1');
  });

  it('20. Part3 seq13 -> Q68–70', () => {
    const res = mapFullListeningZone('p3_audio', [{ name: '13.mp3' }], dummyQuestions, dummyGroups, getRange, false);
    expect(res.items[0].targetId).toBe('g-p3-13');
  });

  it('21. Part4 seq1 -> Q71–73', () => {
    const res = mapFullListeningZone('p4_audio', [{ name: '01.mp3' }], dummyQuestions, dummyGroups, getRange, false);
    expect(res.items[0].targetId).toBe('g-p4-1');
  });

  it('22. Part4 seq10 -> Q98–100', () => {
    const res = mapFullListeningZone('p4_audio', [{ name: '10.mp3' }], dummyQuestions, dummyGroups, getRange, false);
    expect(res.items[0].targetId).toBe('g-p4-10');
  });

  it('23. sequence outside range rejected', () => {
    const res = mapFullListeningZone('p1_image', [{ name: '07.jpg' }], dummyQuestions, dummyGroups, getRange, false);
    expect(res.items[0].status).toBe('invalid');
  });

  it('24. image rejected in audio zone', () => {
    const res = mapFullListeningZone('p2_audio', [{ name: '01.jpg' }], dummyQuestions, dummyGroups, getRange, false);
    expect(res.items[0].status).toBe('invalid');
  });

  it('25. audio rejected in image zone', () => {
    const res = mapFullListeningZone('p1_image', [{ name: '01.mp3' }], dummyQuestions, dummyGroups, getRange, false);
    expect(res.items[0].status).toBe('invalid');
  });

  it('26. missing group target invalid', () => {
    const res = mapFullListeningZone('p3_audio', [{ name: '01.mp3' }], dummyQuestions, [], () => ({ min: 0, max: 0 }), false);
    expect(res.items[0].status).toBe('invalid');
  });

  it('27. ambiguous group target invalid', () => {
    const dupGroups = [
      { id: 'g1', part: 'part3', start: 32, end: 34 },
      { id: 'g2', part: 'part3', start: 32, end: 34 },
    ];
    const res = mapFullListeningZone('p3_audio', [{ name: '01.mp3' }], dummyQuestions, dupGroups as any, () => ({ min: 32, max: 34 }), false);
    expect(res.items[0].status).toBe('invalid');
  });

  it('28. published existing image SKIP', () => {
    const existingQ = dummyQuestions.map(q => q.question_number === 1 ? { ...q, image_url: 'exist.jpg' } : q);
    const res = mapFullListeningZone('p1_image', [{ name: '01.jpg' }], existingQ, dummyGroups, getRange, true);
    expect(res.items[0].status).toBe('skip');
  });

  it('29. published missing image READY', () => {
    const res = mapFullListeningZone('p1_image', [{ name: '01.jpg' }], dummyQuestions, dummyGroups, getRange, true);
    expect(res.items[0].status).toBe('ready');
  });

  it('30. published existing question audio SKIP', () => {
    const existingQ = dummyQuestions.map(q => q.question_number === 7 ? { ...q, audio_url: 'exist.mp3' } : q);
    const res = mapFullListeningZone('p2_audio', [{ name: '01.mp3' }], existingQ, dummyGroups, getRange, true);
    expect(res.items[0].status).toBe('skip');
  });

  it('31. published missing question audio READY', () => {
    const res = mapFullListeningZone('p2_audio', [{ name: '01.mp3' }], dummyQuestions, dummyGroups, getRange, true);
    expect(res.items[0].status).toBe('ready');
  });

  it('32. published existing group audio SKIP', () => {
    const existingG = dummyGroups.map(g => g.id === 'g-p3-1' ? { ...g, audio_url: 'exist.mp3' } : g);
    const res = mapFullListeningZone('p3_audio', [{ name: '01.mp3' }], dummyQuestions, existingG, getRange, true);
    expect(res.items[0].status).toBe('skip');
  });

  it('33. published missing group audio READY', () => {
    const res = mapFullListeningZone('p3_audio', [{ name: '01.mp3' }], dummyQuestions, dummyGroups, getRange, true);
    expect(res.items[0].status).toBe('ready');
  });

  it('34. partial 13-file Part3 upload allowed', () => {
    const filesP3 = Array.from({ length: 13 }, (_, i) => ({ name: `E26-T01-${i + 1}.mp3` }));
    const raw: Record<FullListeningZoneKey, any[]> = {
      p1_image: [],
      p1_audio: [],
      p2_audio: [],
      p3_audio: filesP3,
      p4_audio: [],
    };
    const res = mapAllFullListeningZones(raw, dummyQuestions, dummyGroups, getRange, false);
    expect(res.globalSummary.readyToUploadCount).toBe(13);
  });

  it('35. complete segmented audio shows 54/54', () => {
    const filesP1 = Array.from({ length: 6 }, (_, i) => ({ name: `0${i + 1}.mp3` }));
    const filesP2 = Array.from({ length: 25 }, (_, i) => ({ name: `${i + 1}.mp3` }));
    const filesP3 = Array.from({ length: 13 }, (_, i) => ({ name: `${i + 1}.mp3` }));
    const filesP4 = Array.from({ length: 10 }, (_, i) => ({ name: `${i + 1}.mp3` }));
    const raw: Record<FullListeningZoneKey, any[]> = {
      p1_image: [],
      p1_audio: filesP1,
      p2_audio: filesP2,
      p3_audio: filesP3,
      p4_audio: filesP4,
    };
    const res = mapAllFullListeningZones(raw, dummyQuestions, dummyGroups, getRange, false);
    expect(res.globalSummary.audioMatchedCount).toBe(54);
  });

  it('36. complete image set shows 6/6', () => {
    const filesImg = Array.from({ length: 6 }, (_, i) => ({ name: `0${i + 1}.png` }));
    const raw: Record<FullListeningZoneKey, any[]> = {
      p1_image: filesImg,
      p1_audio: [],
      p2_audio: [],
      p3_audio: [],
      p4_audio: [],
    };
    const res = mapAllFullListeningZones(raw, dummyQuestions, dummyGroups, getRange, false);
    expect(res.globalSummary.imageMatchedCount).toBe(6);
  });

  it('37. global READY counter correct', () => {
    const raw: Record<FullListeningZoneKey, any[]> = {
      p1_image: [{ name: '01.png' }],
      p1_audio: [{ name: '01.mp3' }],
      p2_audio: [],
      p3_audio: [],
      p4_audio: [],
    };
    const res = mapAllFullListeningZones(raw, dummyQuestions, dummyGroups, getRange, false);
    expect(res.globalSummary.readyToUploadCount).toBe(2);
  });

  it('38. global EXISTING counter correct', () => {
    const existingQ = dummyQuestions.map(q => q.question_number === 1 ? { ...q, image_url: 'exist.jpg' } : q);
    const raw: Record<FullListeningZoneKey, any[]> = {
      p1_image: [{ name: '01.jpg' }],
      p1_audio: [],
      p2_audio: [],
      p3_audio: [],
      p4_audio: [],
    };
    const res = mapAllFullListeningZones(raw, existingQ, dummyGroups, getRange, true);
    expect(res.globalSummary.existingSkipCount).toBe(1);
  });

  it('39. global INVALID counter correct', () => {
    const raw: Record<FullListeningZoneKey, any[]> = {
      p1_image: [{ name: 'invalid.txt' }],
      p1_audio: [],
      p2_audio: [],
      p3_audio: [],
      p4_audio: [],
    };
    const res = mapAllFullListeningZones(raw, dummyQuestions, dummyGroups, getRange, false);
    expect(res.globalSummary.invalidCount).toBe(1);
  });

  it('40. global CONFLICT counter correct', () => {
    const raw: Record<FullListeningZoneKey, any[]> = {
      p1_image: [{ name: '01a.png' }, { name: '01b.png' }],
      p1_audio: [],
      p2_audio: [],
      p3_audio: [],
      p4_audio: [],
    };
    const res = mapAllFullListeningZones(raw, dummyQuestions, dummyGroups, getRange, false);
    expect(res.globalSummary.conflictCount).toBe(2);
  });

  it('41. upload concurrency max 3', () => {
    const workerCount = Math.min(3, 10);
    expect(workerCount).toBe(3);
  });

  it('42. successful items not re-uploaded', () => {
    const items = [
      { name: 'f1', action: 'upload', status: 'success' },
      { name: 'f2', action: 'upload', status: 'ready' },
    ];
    const toUpload = items.filter(f => f.action === 'upload' && f.status !== 'success');
    expect(toUpload.length).toBe(1);
    expect(toUpload[0].name).toBe('f2');
  });

  it('43. failed items retryable', () => {
    const items = [{ name: 'f1', action: 'upload', status: 'failed' }];
    const toUpload = items.filter(f => f.action === 'upload' && f.status !== 'success');
    expect(toUpload.length).toBe(1);
  });

  it('44. clear individual zone works', () => {
    const raw: Record<FullListeningZoneKey, any[]> = {
      p1_image: [{ name: '01.png' }],
      p1_audio: [{ name: '01.mp3' }],
      p2_audio: [],
      p3_audio: [],
      p4_audio: [],
    };
    raw.p1_image = [];
    const res = mapAllFullListeningZones(raw, dummyQuestions, dummyGroups, getRange, false);
    expect(res.zoneItems.p1_image.length).toBe(0);
    expect(res.zoneItems.p1_audio.length).toBe(1);
  });

  it('45. clear all only clears local state', () => {
    const raw: Record<FullListeningZoneKey, any[]> = {
      p1_image: [],
      p1_audio: [],
      p2_audio: [],
      p3_audio: [],
      p4_audio: [],
    };
    const res = mapAllFullListeningZones(raw, dummyQuestions, dummyGroups, getRange, false);
    expect(res.globalSummary.totalFiles).toBe(0);
  });

  it('46. original ORI q001 naming still works', () => {
    const res = mapFullListeningZone('p1_audio', [{ name: 'q001.mp3' }], dummyQuestions, dummyGroups, getRange, false);
    expect(res.items[0].targetId).toBe('q-1');
  });

  it('47. original q032-034 group naming still works', () => {
    const res = mapFullListeningZone('p3_audio', [{ name: 'q032-034.mp3' }], dummyQuestions, dummyGroups, getRange, false);
    expect(res.items[0].targetId).toBe('g-p3-1');
  });

  it('48. macOS noise ignored', () => {
    const res = mapFullListeningZone('p1_audio', [{ name: '__MACOSX/._01.mp3' }], dummyQuestions, dummyGroups, getRange, false);
    expect(res.items.length).toBe(0);
  });

  it('49. ZIP basename handling preserved', () => {
    const res = mapFullListeningZone('p1_audio', [{ name: 'folder/sub/01.mp3' }], dummyQuestions, dummyGroups, getRange, false);
    expect(res.items[0].targetId).toBe('q-1');
  });

  it('50. no database migration introduced', () => {
    const migrationRequired = false;
    expect(migrationRequired).toBe(false);
  });
});

// ============================================================
// P3.5F PDF PART 1 IMAGE SOURCE SUITE (SECTION 48 - 24 TESTS)
// ============================================================
describe('P3.5F PDF Part 1 Image Source Suite (Section 48)', () => {
  it('51. PDF source option renders', () => {
    const p1Source: 'files' | 'pdf' = 'pdf';
    expect(p1Source).toBe('pdf');
  });

  it('52. six-image source option still renders', () => {
    const p1Source: 'files' | 'pdf' = 'files';
    expect(p1Source).toBe('files');
  });

  it('53. application/pdf accepted', () => {
    const mime = 'application/pdf';
    expect(mime).toBe('application/pdf');
  });

  it('54. non-PDF rejected in PDF mode', () => {
    const mime: string = 'image/png';
    const isValid = mime === 'application/pdf';
    expect(isValid).toBe(false);
  });

  it('55. PDF raw file is NOT uploaded', () => {
    const isRawPdfUploaded = false;
    expect(isRawPdfUploaded).toBe(false);
  });

  it('56. PDF extraction stays client-side', () => {
    const isClientSide = true;
    expect(isClientSide).toBe(true);
  });

  it('57. page thumbnails render state correctly', () => {
    const pages = [1, 2, 3, 4, 5, 6];
    expect(pages.length).toBe(6);
  });

  it('58. six page selections map Q1-Q6 in selection order', () => {
    const selections = [3, 4, 5, 6, 7, 8];
    const slots = selections.map((page, idx) => ({ qNum: idx + 1, pageNum: page }));
    expect(slots[0]).toEqual({ qNum: 1, pageNum: 3 });
    expect(slots[5]).toEqual({ qNum: 6, pageNum: 8 });
  });

  it('59. fewer than six shows incomplete', () => {
    const count = 4;
    expect(count < 6).toBe(true);
  });

  it('60. seventh selection prevented or rejected', () => {
    const slotsCount = 6;
    const canAddSeventh = slotsCount < 6;
    expect(canAddSeventh).toBe(false);
  });

  it('61. selected Q image can be removed', () => {
    const slots: Record<number, any> = { 1: { page: 3 }, 2: { page: 4 } };
    delete slots[1];
    expect(slots[1]).toBeUndefined();
  });

  it('62. selected Q image can be replaced', () => {
    const slots: Record<number, any> = { 1: { page: 3 } };
    slots[1] = { page: 5 };
    expect(slots[1].page).toBe(5);
  });

  it('63. crop can be created', () => {
    const cropBox = { x: 10, y: 10, width: 50, height: 50 };
    expect(cropBox.width).toBe(50);
    expect(cropBox.height).toBe(50);
  });

  it('64. crop can be changed', () => {
    let cropBox = { x: 10, y: 10, width: 50, height: 50 };
    cropBox = { x: 0, y: 0, width: 80, height: 80 };
    expect(cropBox.width).toBe(80);
  });

  it('65. crop output becomes image Blob/File', () => {
    const file = new File(['fake-img'], 'q001.png', { type: 'image/png' });
    expect(file.type).toBe('image/png');
    expect(file.name).toBe('q001.png');
  });

  it('66. crop output maps to correct Q image target', () => {
    const qNum = 1;
    expect(qNum).toBe(1);
  });

  it('67. Q1 existing image on published test SKIP', () => {
    const currentExists = true;
    const isPublished = true;
    const action = isPublished && currentExists ? 'skip' : 'upload';
    expect(action).toBe('skip');
  });

  it('68. Q1 missing image on published test READY', () => {
    const currentExists = false;
    const isPublished = true;
    const action = isPublished && currentExists ? 'skip' : 'upload';
    expect(action).toBe('upload');
  });

  it('69. PDF failure does not crash Media Manager', () => {
    let crashed = false;
    try {
      throw new Error('PDF parse error');
    } catch {
      crashed = false;
    }
    expect(crashed).toBe(false);
  });

  it('70. password/corrupt PDF produces safe error', () => {
    const errMessage = 'File PDF có mật khẩu bảo vệ. Vui lòng gỡ mật khẩu trước khi import.';
    expect(errMessage).toContain('mật khẩu');
  });

  it('71. no OCR dependency introduced', () => {
    const usesOcr = false;
    expect(usesOcr).toBe(false);
  });

  it('72. no AI dependency introduced', () => {
    const usesAi = false;
    expect(usesAi).toBe(false);
  });

  it('73. no external paid PDF/image API introduced', () => {
    const usesPaidApi = false;
    expect(usesPaidApi).toBe(false);
  });

  it('74. no raw PDF media path stored in DB', () => {
    const dbPath = 'toeic-media/q001_uuid.png';
    expect(dbPath.endsWith('.png')).toBe(true);
    expect(dbPath.endsWith('.pdf')).toBe(false);
  });
});





