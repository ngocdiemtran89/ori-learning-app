import { describe, it, expect, vi } from 'vitest';
import { parseRawToeicTest } from '../toeic/classifier/classifyToeicTest';
import { importToeicTestDraft } from './adminToeicClassifier';
import { supabase } from './client';

// Mock Supabase RPC
vi.mock('./client', () => {
  return {
    supabase: {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
          }))
        }))
      })),
      rpc: vi.fn().mockResolvedValue({ data: { success: true, test_id: 'test-123' }, error: null })
    }
  };
});

describe('adminToeicClassifier Integration', () => {
  it('CASE: full pipeline preserves passage', async () => {
    const rawTest = `
PART 7

Questions 147-149 refer to the following email.

To: All Employees
From: Human Resources
Subject: Training Session

A customer-service training session will be held next Monday at 9:00 A.M.
in Conference Room B. Employees should arrive ten minutes early and bring
their employee identification cards.

147. When will the training session take place?
(A) This Friday
(B) Next Monday
(C) Next Tuesday
(D) Next month

148. Where will the session be held?
(A) Conference Room A
(B) Conference Room B
(C) The cafeteria
(D) The main lobby

149. What should employees bring?
(A) A laptop
(B) A printed schedule
(C) An identification card
(D) A training manual
    `;

    const draft = parseRawToeicTest(rawTest, { title: 'Test', slug: 't', test_code: 't', description: '', test_type: 'full' });
    
    // Call the import function
    const result = await importToeicTestDraft(draft);
    
    expect(result.success).toBe(true);
    
    // Inspect the RPC call
    const rpcMock = supabase.rpc as any;
    expect(rpcMock).toHaveBeenCalledWith('admin_create_toeic_test_with_content', expect.any(Object));
    
    const payload = rpcMock.mock.calls[0][1];
    expect(payload.groups_payload.length).toBe(1);
    
    const groupPayload = payload.groups_payload[0];
    
    expect(groupPayload.passage).toContain('To: All Employees');
    expect(groupPayload.instruction).toContain('Questions 147-149 refer to the following email.');
  });
});
