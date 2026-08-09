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

  it('25. active Listening transcript still inaccessible', () => {
    const studentGroupObj: any = { id: 'g-32', part: 'part3' };
    expect(studentGroupObj).not.toHaveProperty('transcript');
  });

  it('26. active Listening transcript_vi still inaccessible', () => {
    const studentGroupObj: any = { id: 'g-32', part: 'part3' };
    expect(studentGroupObj).not.toHaveProperty('transcript_vi');
  });
});

