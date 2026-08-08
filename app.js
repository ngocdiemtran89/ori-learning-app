/**
 * ORI Learning - Antigravity Kit
 * Interactive Core Application Engine
 */

document.addEventListener('DOMContentLoaded', () => {
  // Global State
  const state = {
    currentTab: 'dashboard',
    theme: localStorage.getItem('ori_theme') || 'dark',
    completedQuestions: parseInt(localStorage.getItem('ori_completed') || '342'),
    streakCount: parseInt(localStorage.getItem('ori_streak') || '7'),
    savedItems: JSON.parse(localStorage.getItem('ori_saved_items') || '[]'),
    
    // Quiz state
    currentQuizIndex: 0,
    quizTimerSeconds: 45,
    quizTimerInterval: null,
    
    // Flashcard state
    currentFcIndex: 0,
    activeAirline: 'all'
  };

  // Sample TOEIC Questions Dataset
  const toeicQuestions = [
    {
      id: 'q1',
      part: 'part5',
      tag: 'TOEIC Part 5 - Grammar & Vocab',
      question: "The newly updated employee handbook contains detailed information regarding company policies and ------- procedures.",
      options: [
        { key: 'A', text: 'operate' },
        { key: 'B', text: 'operation' },
        { key: 'C', text: 'operational' },
        { key: 'D', text: 'operationally' }
      ],
      correctKey: 'C',
      explanation: "Vị trí cần điền đứng trước danh từ 'procedures' bổ nghĩa cho danh từ này, vì vậy ta cần chọn một tính từ (adjective). 'Operational' (tính từ) nghĩa là 'thuộc về vận hành'.",
      vocab: [
        { word: 'Handbook', pos: 'n', meaning: 'Sổ tay hướng dẫn' },
        { word: 'Procedure', pos: 'n', meaning: 'Quy trình, thủ tục' },
        { word: 'Operational', pos: 'adj', meaning: 'Thuộc vận hành' }
      ]
    },
    {
      id: 'q2',
      part: 'part5',
      tag: 'TOEIC Part 5 - Prepositions',
      question: "Ms. Patel will present the quarterly financial report ------- the board of directors tomorrow morning.",
      options: [
        { key: 'A', text: 'to' },
        { key: 'B', text: 'at' },
        { key: 'C', text: 'by' },
        { key: 'D', text: 'with' }
      ],
      correctKey: 'A',
      explanation: "Cấu trúc 'present something to somebody' nghĩa là 'trình bày cái gì cho ai đó'. Vì vậy giới từ đúng là 'to'.",
      vocab: [
        { word: 'Quarterly', pos: 'adj/adv', meaning: 'Hàng quý' },
        { word: 'Board of directors', pos: 'n', meaning: 'Hội đồng quản trị' }
      ]
    },
    {
      id: 'q3',
      part: 'part6',
      tag: 'TOEIC Part 6 - Text Completion',
      question: "All passengers must display their boarding pass ------- boarding the aircraft.",
      options: [
        { key: 'A', text: 'prior to' },
        { key: 'B', text: 'due to' },
        { key: 'C', text: 'in spite of' },
        { key: 'D', text: 'according to' }
      ],
      correctKey: 'A',
      explanation: "'Prior to' = 'Before' (Trước khi). Câu dịch: Tất cả hành khách phải xuất trình thẻ lên máy bay trước khi lên tàu bay.",
      vocab: [
        { word: 'Prior to', pos: 'prep', meaning: 'Trước khi' },
        { word: 'Boarding pass', pos: 'n', meaning: 'Thẻ lên máy bay' }
      ]
    }
  ];

  // Sample Flight Crew Questions Dataset
  const flightQuestions = [
    {
      airline: 'vietjet',
      airlineLabel: 'Vietjet Air',
      promptType: 'Self-Introduction & Passion',
      question: 'Why do you want to become a Cabin Crew for Vietjet Air?',
      answer: 'Express enthusiasm for Vietjet\'s dynamic growth, modern fleet, and vibrant work environment. Emphasize your customer service orientation, flexibility, and readiness to fly high-energy routes.',
      keywords: ['Dynamic environment', 'Safety first', 'Customer service', 'High energy']
    },
    {
      airline: 'vna',
      airlineLabel: 'Vietnam Airlines',
      promptType: 'Cultural Heritage & Hospitality',
      question: 'How will you represent the cultural heritage of Vietnam as an ambassador of Vietnam Airlines?',
      answer: 'Demonstrate warmth, traditional hospitality (Ao Dai grace), professionalism, and deep respect for international passengers while showcasing national pride.',
      keywords: ['National carrier', 'Ao Dai grace', 'Warm hospitality', 'Professionalism']
    },
    {
      airline: 'emirates',
      airlineLabel: 'Emirates Airways',
      promptType: '5-Star Hospitality & Diversity',
      question: 'Describe a situation where you had to resolve a conflict with a customer from a different cultural background.',
      answer: 'Use STAR method: Situation (multicultural context), Task (de-escalation), Action (active listening, empathy, offering solutions), Result (satisfied customer, positive review).',
      keywords: ['Cultural empathy', 'STAR method', 'Conflict resolution', 'Excellence']
    },
    {
      airline: 'qatar',
      airlineLabel: 'Qatar Airways',
      promptType: 'Attentiveness & Perfection',
      question: 'What does 5-star service mean to you in aviation safety and comfort?',
      answer: '5-star service means anticipating passenger needs before they ask, maintaining flawless grooming standards, and placing safety above everything else with strict compliance.',
      keywords: ['Anticipate needs', 'Flawless grooming', 'Strict compliance', 'Excellence']
    }
  ];

  // High-score Vocabulary for Speaking
  const speakingVocab = [
    { word: 'Exceed expectations', def: 'Vượt xa sự kỳ vọng của khách hàng' },
    { word: 'De-escalate tension', def: 'Xoa dịu mâu thuẫn/căng thẳng' },
    { word: 'Cultivate rapport', def: 'Xây dựng mối quan hệ tốt đẹp' },
    { word: 'Impeccable grooming', def: 'Diện mạo, tác phong hoàn hảo' }
  ];

  // DOM Elements Initialization
  const sidebar = document.getElementById('sidebar');
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const closeSidebarBtn = document.getElementById('closeSidebarBtn');
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const pageTitle = document.getElementById('pageTitle');
  const pageSubtitle = document.getElementById('pageSubtitle');
  const savedCountBadge = document.getElementById('savedCountBadge');
  const completedQuestionsCount = document.getElementById('completedQuestionsCount');

  // Navigation Logic
  const navItems = document.querySelectorAll('.nav-item');
  const tabViews = document.querySelectorAll('.tab-view');

  function switchTab(tabId) {
    state.currentTab = tabId;
    
    navItems.forEach(item => {
      if (item.dataset.tab === tabId) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    tabViews.forEach(view => {
      if (view.id === `tab-${tabId}`) {
        view.classList.add('active');
      } else {
        view.classList.remove('active');
      }
    });

    // Update Titles
    const titleMap = {
      'dashboard': { title: 'Tổng Quan Học Tập', sub: 'Chào mừng bạn trở lại với ORI Learning Antigravity Kit' },
      'toeic': { title: 'TOEIC Master Hub 🎯', sub: 'Luyện đề Part 5, 6, 7 & Listening theo chuẩn ETS 2026' },
      'flight-crew': { title: 'Phỏng Vấn Hàng Không ✈️', sub: 'Bộ câu hỏi & thẻ ghi nhớ Vietjet, VNA, Emirates & Qatar' },
      'speaking': { title: 'IELTS & Speaking Coach 🎙️', sub: 'Luyện nói phản xạ & trau dồi từ vựng cao cấp' },
      'ai-coach': { title: 'Antigravity AI Coach 🤖', sub: 'Hỏi đáp ngữ pháp & trợ lý luyện tập trực tiếp' },
      'saved-notes': { title: 'Từ Vựng & Ghi Nhớ 📑', sub: 'Danh sách các câu hỏi đã bookmark' },
      'settings': { title: 'Cấu Hình Workspace ⚙️', sub: 'Quản lý cài đặt & đường dẫn thư mục Antigravity' }
    };

    if (titleMap[tabId]) {
      pageTitle.textContent = titleMap[tabId].title;
      pageSubtitle.textContent = titleMap[tabId].sub;
    }

    if (window.innerWidth <= 1024) {
      sidebar.classList.remove('mobile-open');
    }
  }

  navItems.forEach(item => {
    item.addEventListener('click', () => switchTab(item.dataset.tab));
  });

  // Feature Card / Hero Action Navigation
  document.querySelectorAll('[data-navigate]').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.navigate));
  });
  document.querySelectorAll('.start-test-btn, .start-interview-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.target));
  });

  // Mobile Menu Toggle
  if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', () => sidebar.classList.add('mobile-open'));
  }
  if (closeSidebarBtn) {
    closeSidebarBtn.addEventListener('click', () => sidebar.classList.remove('mobile-open'));
  }

  // Theme Toggle
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('ori_theme', theme);
    themeToggleBtn.innerHTML = theme === 'dark' ? '<i class="fa-solid fa-moon"></i>' : '<i class="fa-solid fa-sun"></i>';
  }
  applyTheme(state.theme);

  themeToggleBtn.addEventListener('click', () => {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    applyTheme(state.theme);
  });

  // QUIZ ENGINE
  const quizQuestionText = document.getElementById('quizQuestionText');
  const quizPartTag = document.getElementById('quizPartTag');
  const quizOptionsContainer = document.getElementById('quizOptionsContainer');
  const quizExplanationBox = document.getElementById('quizExplanationBox');
  const quizExplanationText = document.getElementById('quizExplanationText');
  const quizVocabBox = document.getElementById('quizVocabBox');
  const quizTimerDisplay = document.getElementById('quizTimerDisplay');
  const quizNextBtn = document.getElementById('quizNextBtn');
  const quizBookmarkBtn = document.getElementById('quizBookmarkBtn');

  function renderQuizQuestion(index) {
    const q = toeicQuestions[index % toeicQuestions.length];
    quizPartTag.textContent = q.tag;
    quizQuestionText.textContent = `Q${index + 1}. ${q.question}`;
    
    quizExplanationBox.classList.add('hidden');
    quizOptionsContainer.innerHTML = '';

    q.options.forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'option-btn';
      btn.innerHTML = `<span class="opt-prefix">${opt.key}</span> <span>${opt.text}</span>`;
      
      btn.addEventListener('click', () => {
        // Disable options
        document.querySelectorAll('.option-btn').forEach(b => b.style.pointerEvents = 'none');
        
        if (opt.key === q.correctKey) {
          btn.classList.add('correct');
          state.completedQuestions++;
          updateCompletedCount();
        } else {
          btn.classList.add('wrong');
          // Highlight correct one
          document.querySelectorAll('.option-btn').forEach(b => {
            if (b.querySelector('.opt-prefix').textContent === q.correctKey) {
              b.classList.add('correct');
            }
          });
        }

        // Show Explanation
        quizExplanationText.textContent = q.explanation;
        quizVocabBox.innerHTML = q.vocab.map(v => `<div class="kw"><b>${v.word}</b> (${v.pos}): ${v.meaning}</div>`).join('');
        quizExplanationBox.classList.remove('hidden');
        clearInterval(state.quizTimerInterval);
      });

      quizOptionsContainer.appendChild(btn);
    });

    // Reset Timer
    startQuizTimer();
  }

  function startQuizTimer() {
    clearInterval(state.quizTimerInterval);
    state.quizTimerSeconds = 45;
    quizTimerDisplay.textContent = `00:${state.quizTimerSeconds}`;

    state.quizTimerInterval = setInterval(() => {
      state.quizTimerSeconds--;
      if (state.quizTimerSeconds < 10) {
        quizTimerDisplay.textContent = `00:0${state.quizTimerSeconds}`;
      } else {
        quizTimerDisplay.textContent = `00:${state.quizTimerSeconds}`;
      }

      if (state.quizTimerSeconds <= 0) {
        clearInterval(state.quizTimerInterval);
        quizTimerDisplay.textContent = "Hết giờ!";
      }
    }, 1000);
  }

  if (quizNextBtn) {
    quizNextBtn.addEventListener('click', () => {
      state.currentQuizIndex++;
      renderQuizQuestion(state.currentQuizIndex);
    });
  }

  if (quizBookmarkBtn) {
    quizBookmarkBtn.addEventListener('click', () => {
      const q = toeicQuestions[state.currentQuizIndex % toeicQuestions.length];
      if (!state.savedItems.some(item => item.id === q.id)) {
        state.savedItems.push(q);
        localStorage.setItem('ori_saved_items', JSON.stringify(state.savedItems));
        updateSavedBadge();
        alert('Đã lưu câu hỏi vào danh sách ghi nhớ!');
      } else {
        alert('Câu hỏi này đã có trong danh sách ghi nhớ của bạn.');
      }
    });
  }

  renderQuizQuestion(0);

  // FLASHCARD ENGINE
  const interviewFlashcard = document.getElementById('interviewFlashcard');
  const fcAirlineBadge = document.getElementById('fcAirlineBadge');
  const fcPromptType = document.getElementById('fcPromptType');
  const fcQuestion = document.getElementById('fcQuestion');
  const fcAnswer = document.getElementById('fcAnswer');
  const fcKeywords = document.getElementById('fcKeywords');
  const fcProgressText = document.getElementById('fcProgressText');
  const fcPrevBtn = document.getElementById('fcPrevBtn');
  const fcNextBtn = document.getElementById('fcNextBtn');
  const airlineFilter = document.getElementById('airlineFilter');

  function getFilteredFlashcards() {
    if (state.activeAirline === 'all') return flightQuestions;
    return flightQuestions.filter(item => item.airline === state.activeAirline);
  }

  function renderFlashcard() {
    const list = getFilteredFlashcards();
    if (list.length === 0) return;

    if (state.currentFcIndex >= list.length) state.currentFcIndex = 0;
    if (state.currentFcIndex < 0) state.currentFcIndex = list.length - 1;

    const item = list[state.currentFcIndex];
    fcAirlineBadge.textContent = item.airlineLabel;
    fcPromptType.textContent = item.promptType;
    fcQuestion.textContent = item.question;
    fcAnswer.textContent = item.answer;
    fcKeywords.innerHTML = item.keywords.map(kw => `<span class="kw">${kw}</span>`).join('');
    fcProgressText.textContent = `${state.currentFcIndex + 1} / ${list.length}`;

    interviewFlashcard.classList.remove('flipped');
  }

  if (interviewFlashcard) {
    interviewFlashcard.addEventListener('click', () => {
      interviewFlashcard.classList.toggle('flipped');
    });
  }

  if (fcPrevBtn) {
    fcPrevBtn.addEventListener('click', () => {
      state.currentFcIndex--;
      renderFlashcard();
    });
  }

  if (fcNextBtn) {
    fcNextBtn.addEventListener('click', () => {
      state.currentFcIndex++;
      renderFlashcard();
    });
  }

  if (airlineFilter) {
    airlineFilter.addEventListener('change', (e) => {
      state.activeAirline = e.target.value;
      state.currentFcIndex = 0;
      renderFlashcard();
    });
  }

  renderFlashcard();

  // VOICE SIMULATOR & SPEAKING VOCAB
  const simulateVoiceBtn = document.getElementById('simulateVoiceBtn');
  const voiceWaveContainer = document.getElementById('voiceWaveContainer');
  const vocabListContainer = document.getElementById('vocabListContainer');

  if (vocabListContainer) {
    vocabListContainer.innerHTML = speakingVocab.map(v => `
      <li class="vocab-item">
        <span class="vocab-word">${v.word}</span>
        <p class="vocab-def">${v.def}</p>
      </li>
    `).join('');
  }

  let isRecording = false;
  if (simulateVoiceBtn) {
    simulateVoiceBtn.addEventListener('click', () => {
      isRecording = !isRecording;
      if (isRecording) {
        simulateVoiceBtn.innerHTML = '<i class="fa-solid fa-square"></i> Dừng Ghi Âm & Nhận Phản Hồi';
        simulateVoiceBtn.classList.remove('btn-gradient');
        simulateVoiceBtn.classList.add('btn-secondary');
        voiceWaveContainer.classList.remove('hidden');
      } else {
        simulateVoiceBtn.innerHTML = '<i class="fa-solid fa-microphone"></i> Bắt đầu ghi âm / Nói thử';
        simulateVoiceBtn.classList.add('btn-gradient');
        simulateVoiceBtn.classList.remove('btn-secondary');
        voiceWaveContainer.classList.add('hidden');
        alert('AI Feedback: Bài nói của bạn đạt độ lưu loát 8.5/10! Phát âm từ "Hospitality" rất chuẩn.');
      }
    });
  }

  // AI COACH CHAT INTERACTION
  const chatMessages = document.getElementById('chatMessages');
  const chatInput = document.getElementById('chatInput');
  const sendChatBtn = document.getElementById('sendChatBtn');

  function appendChatMessage(sender, text) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-msg ${sender === 'user' ? 'user-msg' : 'ai-msg'}`;
    msgDiv.innerHTML = `
      <div class="msg-avatar"><i class="fa-solid ${sender === 'user' ? 'fa-user' : 'fa-robot'}"></i></div>
      <div class="msg-content"><p>${text}</p></div>
    `;
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function handleSendChat() {
    const text = chatInput.value.trim();
    if (!text) return;

    appendChatMessage('user', text);
    chatInput.value = '';

    // Simulated AI Response
    setTimeout(() => {
      let aiResponse = "Tôi đã ghi nhận câu hỏi của bạn. Trong bài thi TOEIC và Phỏng vấn Hàng không, trọng tâm là sự chính xác ngữ pháp và phong thái tự tin!";
      if (text.toLowerCase().includes('vietjet')) {
        aiResponse = "Với Vietjet Air, hãy chuẩn bị kỹ nụ cười rạng rỡ, thần thái năng động và trình bày lý do chọn hãng thật thuyết phục theo tiêu chuẩn tươi trẻ - thân thiện.";
      } else if (text.toLowerCase().includes('toeic')) {
        aiResponse = "Đối với TOEIC Part 5 & 6, bí quyết là nhận diện nhanh từ loại (Danh từ, Tính từ, Trạng từ) và cấu trúc giới từ đi kèm.";
      }
      appendChatMessage('ai', aiResponse);
    }, 800);
  }

  if (sendChatBtn) sendChatBtn.addEventListener('click', handleSendChat);
  if (chatInput) {
    chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleSendChat();
    });
  }

  // AI DRAWER LOGIC
  const openAiDrawerBtn = document.getElementById('openAiDrawerBtn');
  const aiDrawer = document.getElementById('aiDrawer');
  const closeDrawerBtn = document.getElementById('closeDrawerBtn');
  const drawerOverlay = document.getElementById('drawerOverlay');
  const quickPromptBtns = document.querySelectorAll('.quick-prompt-btn');

  function toggleDrawer(open) {
    if (open) {
      aiDrawer.classList.add('open');
      drawerOverlay.classList.add('open');
    } else {
      aiDrawer.classList.remove('open');
      drawerOverlay.classList.remove('open');
    }
  }

  if (openAiDrawerBtn) openAiDrawerBtn.addEventListener('click', () => toggleDrawer(true));
  if (closeDrawerBtn) closeDrawerBtn.addEventListener('click', () => toggleDrawer(false));
  if (drawerOverlay) drawerOverlay.addEventListener('click', () => toggleDrawer(false));

  quickPromptBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const promptText = btn.textContent.replace(/"/g, '');
      toggleDrawer(false);
      switchTab('ai-coach');
      chatInput.value = promptText;
      handleSendChat();
    });
  });

  // SAVED NOTES & BADGES
  function updateSavedBadge() {
    savedCountBadge.textContent = state.savedItems.length;
    const savedItemsList = document.getElementById('savedItemsList');
    if (savedItemsList) {
      if (state.savedItems.length === 0) {
        savedItemsList.innerHTML = `
          <div class="empty-state">
            <i class="fa-solid fa-folder-open"></i>
            <p>Chưa có mục nào được lưu. Hãy bấm nút "Lưu câu này" khi luyện tập TOEIC!</p>
          </div>
        `;
      } else {
        savedItemsList.innerHTML = state.savedItems.map(item => `
          <div class="glass-panel" style="margin-bottom: 12px;">
            <h4>${item.tag}</h4>
            <p style="margin: 8px 0;"><strong>Câu hỏi:</strong> ${item.question}</p>
            <p style="color: var(--accent-emerald);"><strong>Đáp án đúng:</strong> ${item.correctKey}</p>
          </div>
        `).join('');
      }
    }
  }
  updateSavedBadge();

  function updateCompletedCount() {
    if (completedQuestionsCount) {
      completedQuestionsCount.textContent = `${state.completedQuestions} câu`;
      localStorage.setItem('ori_completed', state.completedQuestions);
    }
  }

  const clearSavedBtn = document.getElementById('clearSavedBtn');
  if (clearSavedBtn) {
    clearSavedBtn.addEventListener('click', () => {
      state.savedItems = [];
      localStorage.setItem('ori_saved_items', JSON.stringify([]));
      updateSavedBadge();
    });
  }
});
