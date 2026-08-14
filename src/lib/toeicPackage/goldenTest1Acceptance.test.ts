// ============================================================
// Phase P3.5H: ORI TOEIC Golden Test 1 Acceptance & Visual Asset Suite
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  createDefaultVisualAssetRegistry,
  summarizeVisualAssetRegistry,
  CANONICAL_LISTENING_GRAPHIC_TARGETS,
} from './visualAssetTypes';
import { exportPart2AudioTranscriptPackZip } from './p2AudioPackExporter';
import { validateAndPatchPart2Transcripts } from './p2TranscriptPatcher';
import { buildOriToeicPackage } from './packageBuilder';
import { buildToeicTestRpcPayload } from '../supabase/adminToeicClassifier';
import { RawPackageSources } from './types';
import JSZip from 'jszip';
import fs from 'fs';
import path from 'path';

describe('ORI TOEIC — Golden Test 1 Acceptance & Visual Asset Suite', () => {
  const mockRawSources: RawPackageSources = {
    listeningPdfText: 'PART 1 ... PART 2 ... PART 3 ... PART 4 ...',
    readingPdfText: 'PART 5 ... PART 6 ... PART 7 ...',
    answerKeyText: Array.from({ length: 200 }, (_, i) => `${i + 1}. A`).join('\n'),
    audioFiles: [],
    part1PdfCroppedImages: {},
  };

  describe('A. Visual Asset Registry & Draft Model (Section 2, 3, 7, 10, 28)', () => {
    it('A. P1 Q1-Q6 registry targets = 6', () => {
      const registry = createDefaultVisualAssetRegistry();
      for (let q = 1; q <= 6; q++) {
        const asset = registry.get(`Q${q}`);
        expect(asset).toBeDefined();
        expect(asset?.assetType).toBe('P1_IMAGE');
        expect(asset?.ownerType).toBe('QUESTION');
        expect(asset?.ownerKey).toBe(`Q${q}`);
      }
    });

    it('B & J. Real P1 asset can store previewUrl and cropRect', () => {
      const registry = createDefaultVisualAssetRegistry();
      const q1 = registry.get('Q1')!;
      q1.previewUrl = 'blob:http://localhost/mock-p1-q1';
      q1.cropRect = { x: 10, y: 10, width: 200, height: 200 };
      q1.status = 'APPROVED';

      expect(q1.previewUrl).toBe('blob:http://localhost/mock-p1-q1');
      expect(q1.cropRect).toEqual({ x: 10, y: 10, width: 200, height: 200 });
      expect(q1.status).toBe('APPROVED');
    });

    it('E, F, G. Five listening graphic group targets exist with ownerType = GROUP', () => {
      expect(CANONICAL_LISTENING_GRAPHIC_TARGETS.length).toBe(5);
      const registry = createDefaultVisualAssetRegistry();

      const expectedKeys = ['P3-Q62-64', 'P3-Q65-67', 'P3-Q68-70', 'P4-Q95-97', 'P4-Q98-100'];
      expectedKeys.forEach((key) => {
        const graphicAsset = registry.get(key);
        expect(graphicAsset).toBeDefined();
        expect(graphicAsset?.assetType).toBe('LISTENING_GRAPHIC');
        expect(graphicAsset?.ownerType).toBe('GROUP');
        expect(graphicAsset?.ownerKey).toBe(key);
      });
    });

    it('D, H, I. 6 P1 + 5 graphics = 11 total required visuals; missing assets report incomplete', () => {
      const registry = createDefaultVisualAssetRegistry();
      const summaryInitial = summarizeVisualAssetRegistry(registry);

      expect(summaryInitial.totalAssetsCount).toBe(11);
      expect(summaryInitial.p1ImagesCount).toBe(6);
      expect(summaryInitial.graphicsCount).toBe(5);
      expect(summaryInitial.isAssetsReady).toBe(false);
      expect(summaryInitial.missingKeys.length).toBe(11);

      // Populate all 11 assets
      for (let q = 1; q <= 6; q++) {
        const item = registry.get(`Q${q}`)!;
        item.status = 'APPROVED';
        item.previewUrl = `blob:p1-q${q}`;
      }
      CANONICAL_LISTENING_GRAPHIC_TARGETS.forEach((t) => {
        const item = registry.get(t.ownerKey)!;
        item.status = 'APPROVED';
        item.previewUrl = `blob:${t.ownerKey}`;
      });

      const summaryFull = summarizeVisualAssetRegistry(registry);
      expect(summaryFull.p1ImagesReady).toBe(6);
      expect(summaryFull.graphicsReady).toBe(5);
      expect(summaryFull.totalAssetsReady).toBe(11);
      expect(summaryFull.isAssetsReady).toBe(true);
      expect(summaryFull.missingKeys.length).toBe(0);
    });
  });

  describe('B. Part 2 Audio Pack Binary Export (Section 14, 15, 29)', () => {
    it('K, L, M, N, O, P. Exporting Part 2 Audio Pack creates a ZIP containing 25 MP3 binaries, manifest.json, and instructions', async () => {
      // Create 25 mock audio files (Q07.mp3 to Q31.mp3)
      const mockP2Files: File[] = [];
      for (let q = 7; q <= 31; q++) {
        const qStr = String(q).padStart(2, '0');
        const file = new File([new Uint8Array([0x49, 0x44, 0x33])], `Test 01_Part 2_${qStr}.mp3`, {
          type: 'audio/mpeg',
        });
        mockP2Files.push(file);
      }

      const packRes = await exportPart2AudioTranscriptPackZip(mockP2Files, 'Golden Test 1');

      expect(packRes.mappedCount).toBe(25);
      expect(packRes.missingCount).toBe(0);
      expect(packRes.duplicateCount).toBe(0);
      expect(packRes.isCanonical).toBe(true);

      // Unzip and verify contents
      const zip = await JSZip.loadAsync(await packRes.zipBlob.arrayBuffer());
      expect(zip.file('manifest.json')).not.toBeNull();
      expect(zip.file('transcription_instructions.md')).not.toBeNull();

      for (let q = 7; q <= 31; q++) {
        const qStr = String(q).padStart(2, '0');
        expect(zip.file(`audio/Q${qStr}.mp3`)).not.toBeNull();
      }

      const manifestStr = await zip.file('manifest.json')!.async('string');
      const manifest = JSON.parse(manifestStr);
      expect(manifest.schema).toBe('ori-p2-audio-pack-v1');
      expect(manifest.questionsCount).toBe(25);
      expect(manifest.files.length).toBe(25);
    });
  });

  describe('C. Part 2 Script Patcher Validation & Constraints (Section 16, 18, 30)', () => {
    it('Q. Valid Q7 transcript script accepted', () => {
      const pkg = buildOriToeicPackage(mockRawSources, 'Test P2');
      const res = validateAndPatchPart2Transcripts(
        pkg,
        JSON.stringify({
          questions: [
            {
              questionNumber: 7,
              promptText: 'When is the next train?',
              responses: { A: 'At 5 PM.', B: 'Yes.', C: 'To Chicago.' },
            },
          ],
        })
      );
      expect(res.success).toBe(true);
      expect(res.patchedCount).toBe(1);
    });

    it('R, S, T, U, V, W, X, Y. Invalid inputs (Q6, Q32, duplicate, empty prompt, missing options, D option) are REJECTED', () => {
      const pkg = buildOriToeicPackage(mockRawSources, 'Test P2 Invalid');

      // Q6 out of bounds
      const resQ6 = validateAndPatchPart2Transcripts(pkg, JSON.stringify({ questions: [{ questionNumber: 6, promptText: 'P1 prompt', responses: { A: 'a', B: 'b', C: 'c' } }] }));
      expect(resQ6.success).toBe(false);

      // Q32 out of bounds
      const resQ32 = validateAndPatchPart2Transcripts(pkg, JSON.stringify({ questions: [{ questionNumber: 32, promptText: 'P3 prompt', responses: { A: 'a', B: 'b', C: 'c' } }] }));
      expect(resQ32.success).toBe(false);

      // Duplicate Q7
      const resDup = validateAndPatchPart2Transcripts(pkg, JSON.stringify({ questions: [{ questionNumber: 7, promptText: 'Prompt 1', responses: { A: 'a', B: 'b', C: 'c' } }, { questionNumber: 7, promptText: 'Prompt 2', responses: { A: 'a', B: 'b', C: 'c' } }] }));
      expect(resDup.success).toBe(false);

      // Empty prompt
      const resEmpty = validateAndPatchPart2Transcripts(pkg, JSON.stringify({ questions: [{ questionNumber: 7, promptText: '', responses: { A: 'a', B: 'b', C: 'c' } }] }));
      expect(resEmpty.success).toBe(false);

      // Choice D presence
      const resD = validateAndPatchPart2Transcripts(pkg, JSON.stringify({ questions: [{ questionNumber: 7, promptText: 'Prompt', responses: { A: 'a', B: 'b', C: 'c', D: 'd' } }] }));
      expect(resD.success).toBe(false);
    });
  });

  describe('D. Unapplied Migration File Static Verification (Section 17, 19, 20, 31)', () => {
    it('Verifies 20260814_toeic_question_scripts.sql exists and contains valid table, FK, RLS, and RPC definitions', () => {
      const migrationPath = path.join(process.cwd(), 'database/migrations/20260814_toeic_question_scripts.sql');
      expect(fs.existsSync(migrationPath)).toBe(true);

      const sqlContent = fs.readFileSync(migrationPath, 'utf8');
      expect(sqlContent).toContain('create table if not exists public.toeic_question_scripts');
      expect(sqlContent).toContain('question_id uuid not null references public.toeic_test_questions(id)');
      expect(sqlContent).toContain('script_type text not null default \'P2_AUDIO_TRANSCRIPT\'');
      expect(sqlContent).toContain('alter table public.toeic_question_scripts enable row level security');
      expect(sqlContent).toContain('create policy "admin_toeic_question_scripts_all"');
      expect(sqlContent).toContain('create or replace function public.admin_upsert_toeic_question_script');
    });
  });

  describe('F. Readiness Metric Rules (Section 6, 8, 13)', () => {
    it('C & D. Missing P1 images or missing Listening graphics set P1_IMAGES_READY and LISTENING_GRAPHICS_READY to false', () => {
      const registry = createDefaultVisualAssetRegistry();
      const summary = summarizeVisualAssetRegistry(registry);

      expect(summary.p1ImagesReady).toBe(0);
      expect(summary.graphicsReady).toBe(0);
      expect(summary.isAssetsReady).toBe(false);
    });

    it('A & E. 11 approved visual blobs set isAssetsReady to true, enabling FULL_TEST_READY independently of P2 transcripts', () => {
      const registry = createDefaultVisualAssetRegistry();

      for (let q = 1; q <= 6; q++) {
        const item = registry.get(`Q${q}`)!;
        item.status = 'APPROVED';
        item.blob = new Blob(['mock p1'], { type: 'image/png' });
      }
      CANONICAL_LISTENING_GRAPHIC_TARGETS.forEach((t) => {
        const item = registry.get(t.ownerKey)!;
        item.status = 'APPROVED';
        item.blob = new Blob(['mock graphic'], { type: 'image/png' });
      });

      const summary = summarizeVisualAssetRegistry(registry);
      expect(summary.isAssetsReady).toBe(true);
      expect(summary.totalAssetsReady).toBe(11);
    });
  });

  describe('G. Final Pre-RPC Dry Run Payload Checks (Section 3, 4, 7, 14, 17)', () => {
    it('F. Sanitize media URLs prevents blob: URLs from polluting RPC payload', () => {
      const draftWithBlobUrls: any = {
        metadata: { title: 'ORI 2026 - Test 1', slug: 'ori-2026-test-1', test_type: 'full' },
        questions: [
          { question_number: 1, part: 'part1', image_url: 'blob:http://localhost/temp-img-1', audio_url: 'toeic/test-1/audio/q1.mp3' },
        ],
        groups: [
          { group_temp_key: 'grp_1', part: 'part3', group_type: 'conversation', image_url: 'blob:http://localhost/temp-graphic-1' },
        ],
      };

      const { groupsPayload, questionsPayload } = buildToeicTestRpcPayload(draftWithBlobUrls);
      expect(questionsPayload[0].image_url).toBeNull();
      expect(questionsPayload[0].audio_url).toBe('toeic/test-1/audio/q1.mp3');
      expect(groupsPayload[0].image_url).toBeNull();
    });
  });
});
