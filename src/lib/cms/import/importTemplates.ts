/**
 * Sample Import Templates & Download Helpers for Phase 3.5
 */

export const VOCABULARY_CSV_TEMPLATE = `word,ipa,part_of_speech,meaning_vi,example_en,example_vi,topic,toeic_parts,collocations,common_mistake,sort_order
appointment,/əˈpɔɪnt.mənt/,noun,cuộc hẹn,"I have an appointment with the manager.","Tôi có một cuộc hẹn với người quản lý.",Business,part2|part5,make an appointment|schedule an appointment,Dùng nhầm động từ make/do,1
implement,/ˈɪm.plɪ.ment/,verb,thực thi,"We will implement the new safety policy.",Chúng tôi sẽ thực thi chính sách an toàn mới.,Office,part5|part7,implement a policy|implement changes,Viết sai chính tả thành inplement,2`;

export const GRAMMAR_JSON_TEMPLATE = JSON.stringify(
  [
    {
      title: "Thì Hiện Tại Đơn (Present Simple Tense)",
      slug: "grammar-present-simple-import-demo",
      level: "foundation",
      summary: "Tổng quan định nghĩa và cách dùng thì hiện tại đơn trong bài thi TOEIC.",
      skill_tag: "Present Simple",
      sort_order: 1,
      sections: [
        {
          heading: "1. Công thức thì hiện tại đơn",
          body: "Đối với động từ thường: S + V(s/es) + O. Đối với động từ To-be: S + am/is/are + N/Adj.",
          examples: [
            "The train arrives at 8:00 AM every morning.",
            "She works in the accounting department."
          ]
        }
      ],
      quiz: [
        {
          question: "The director _____ weekly reports every Monday.",
          options: ["reviews", "review", "reviewing", "reviewed"],
          answer: "reviews",
          explanation: "Chủ ngữ The director số ít, dùng động từ reviews ở hiện tại đơn."
        }
      ]
    }
  ],
  null,
  2
);

export const LISTENING_JSON_TEMPLATE = JSON.stringify(
  [
    {
      title: "Listening Part 2 — Question & Response #1",
      slug: "listening-part2-import-demo",
      level: "foundation",
      toeic_part: "part2",
      audio_url: "https://example.com/audio/listening-part2-1.mp3",
      transcript: "Where is the conference taking place?\n(A) Room 302.\n(B) Yes, yesterday.\n(C) Next month.",
      sort_order: 1,
      questions: [
        {
          question_text: "Where is the conference taking place?",
          options: ["Room 302.", "Yes, yesterday.", "Next month."],
          correct_answer: "Room 302.",
          explanation: "Câu hỏi bắt đầu bằng Where (Ở đâu), đáp án đúng chỉ địa điểm Room 302.",
          skill_tag: "Location & Directions",
          topic: "Office Meetings",
          image_url: null
        }
      ]
    }
  ],
  null,
  2
);

export const READING_JSON_TEMPLATE = JSON.stringify(
  [
    {
      title: "Reading Part 7 — Single Passage Email #1",
      slug: "reading-part7-import-demo",
      level: "intermediate",
      toeic_part: "part7",
      passage: "To: All Staff\nFrom: Executive Board\nDate: October 12\nSubject: Office Renovation\n\nPlease be advised that the main cafeteria will be closed for maintenance next Monday.",
      sort_order: 1,
      questions: [
        {
          question_text: "What is the main purpose of the notice?",
          options: [
            "To inform staff about a temporary cafeteria closure",
            "To invite employees to a company dinner",
            "To announce a promotion in management",
            "To request updated contact details"
          ],
          correct_answer: "To inform staff about a temporary cafeteria closure",
          explanation: "Văn bản thông báo về việc căng tin đóng cửa tạm thời để bảo trì.",
          skill_tag: "Main Purpose",
          topic: "Office Facilities",
          image_url: null
        }
      ]
    }
  ],
  null,
  2
);

/**
 * Trigger browser file download of template content
 */
export function downloadTemplateFile(filename: string, content: string, mimeType: string = 'text/plain;charset=utf-8;') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
