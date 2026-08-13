import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { RequireAuth, RequireActiveAccess, RequireAdmin } from './components/auth/ProtectedRoutes';
import { AppShell } from './components/layout/AppShell';

import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { VocabularyPage } from './pages/VocabularyPage';
import { VocabularyDeckPage } from './pages/VocabularyDeckPage';
import { VocabularyReviewTodayPage } from './pages/VocabularyReviewTodayPage';
import { SavedWordsPage } from './pages/SavedWordsPage';
import { MistakesPage } from './pages/MistakesPage';
import { ProgressAnalysisPage } from './pages/ProgressAnalysisPage';
import { GrammarPage } from './pages/GrammarPage';
import { GrammarLessonPage } from './pages/GrammarLessonPage';
import { ListeningPage } from './pages/ListeningPage';
import { ListeningLessonPage } from './pages/ListeningLessonPage';
import { ReadingPage } from './pages/ReadingPage';
import { ReadingLessonPage } from './pages/ReadingLessonPage';
import { AccountPage } from './pages/AccountPage';
import { ExpiredPage } from './pages/ExpiredPage';
import { AdminPage } from './pages/AdminPage';
import { AdminStudentsPage } from './pages/AdminStudentsPage';
import { AdminStudentProgressPage } from './pages/AdminStudentProgressPage';
import { AdminContentPage } from './pages/AdminContentPage';
import { AdminVocabularyDecksPage } from './pages/AdminVocabularyDecksPage';
import { AdminVocabularyDeckEditPage } from './pages/AdminVocabularyDeckEditPage';
import { AdminVocabularyItemsPage } from './pages/AdminVocabularyItemsPage';
import { AdminVocabularyItemEditPage } from './pages/AdminVocabularyItemEditPage';
import { AdminGrammarLessonsPage } from './pages/AdminGrammarLessonsPage';
import { AdminGrammarLessonEditPage } from './pages/AdminGrammarLessonEditPage';
import { AdminListeningLessonsPage } from './pages/AdminListeningLessonsPage';
import { AdminListeningLessonEditPage } from './pages/AdminListeningLessonEditPage';
import { AdminReadingLessonsPage } from './pages/AdminReadingLessonsPage';
import { AdminReadingLessonEditPage } from './pages/AdminReadingLessonEditPage';
import { AdminContentImportPage } from './pages/AdminContentImportPage';
import { AdminToeicTestBankPage } from './pages/AdminToeicTestBankPage';
import { AdminToeicTestEditPage } from './pages/AdminToeicTestEditPage';
import { AdminToeicClassifierPage } from './pages/AdminToeicClassifierPage';
import { AdminToeicAudioCutterPage } from './pages/AdminToeicAudioCutterPage';
import { ImportStudioPage } from './features/toeic-import-studio/components/ImportStudioPage';
import { ToeicTestLibraryPage } from './pages/ToeicTestLibraryPage';
import { ToeicTestOverviewPage } from './pages/ToeicTestOverviewPage';
import { ToeicTestRunnerPage } from './pages/ToeicTestRunnerPage';
import { NotFoundPage } from './pages/NotFoundPage';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public / Auth Standalone Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/expired" element={<ExpiredPage />} />

          {/* Protected Routes (Requires Supabase Authentication) */}
          <Route element={<RequireAuth />}>
            <Route element={<AppShell />}>
              <Route path="/account" element={<AccountPage />} />

              {/* Paid Learning Content Routes (Requires Active & Non-Expired Access) */}
              <Route element={<RequireActiveAccess />}>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                
                <Route path="/vocabulary" element={<VocabularyPage />} />
                <Route path="/vocabulary/review-today" element={<VocabularyReviewTodayPage />} />
                <Route path="/vocabulary/:deckId" element={<VocabularyDeckPage />} />
                <Route path="/notebook" element={<SavedWordsPage />} />
                <Route path="/mistakes" element={<MistakesPage />} />
                <Route path="/progress" element={<ProgressAnalysisPage />} />

                <Route path="/grammar" element={<GrammarPage />} />
                <Route path="/grammar/:lessonId" element={<GrammarLessonPage />} />

                <Route path="/listening" element={<ListeningPage />} />
                <Route path="/listening/:lessonId" element={<ListeningLessonPage />} />

                <Route path="/reading" element={<ReadingPage />} />
                <Route path="/reading/:lessonId" element={<ReadingLessonPage />} />

                {/* P3.6A Student TOEIC Test Runner Routes */}
                <Route path="/tests" element={<ToeicTestLibraryPage />} />
                <Route path="/tests/:testId" element={<ToeicTestOverviewPage />} />
                <Route path="/tests/:testId/take" element={<ToeicTestRunnerPage />} />
              </Route>

              {/* Admin Only Routes (Requires Admin Role & Active Account) */}
              <Route element={<RequireAdmin />}>
                <Route path="/admin" element={<AdminPage />} />
                <Route path="/admin/students" element={<AdminStudentsPage />} />
                <Route path="/admin/students/:studentId/progress" element={<AdminStudentProgressPage />} />
                
                {/* Phase 3.1 Vocabulary CMS Routes */}
                <Route path="/admin/content" element={<AdminContentPage />} />
                <Route path="/admin/content/vocabulary" element={<AdminVocabularyDecksPage />} />
                <Route path="/admin/content/vocabulary/decks/new" element={<AdminVocabularyDeckEditPage />} />
                <Route path="/admin/content/vocabulary/decks/:deckId/edit" element={<AdminVocabularyDeckEditPage />} />
                <Route path="/admin/content/vocabulary/decks/:deckId" element={<AdminVocabularyItemsPage />} />
                <Route path="/admin/content/vocabulary/decks/:deckId/words/new" element={<AdminVocabularyItemEditPage />} />
                <Route path="/admin/content/vocabulary/words/:wordId/edit" element={<AdminVocabularyItemEditPage />} />

                {/* Phase 3.2 Grammar CMS Routes */}
                <Route path="/admin/content/grammar" element={<AdminGrammarLessonsPage />} />
                <Route path="/admin/content/grammar/new" element={<AdminGrammarLessonEditPage />} />
                <Route path="/admin/content/grammar/:lessonId/edit" element={<AdminGrammarLessonEditPage />} />

                {/* Phase 3.3 Listening CMS Routes */}
                <Route path="/admin/content/listening" element={<AdminListeningLessonsPage />} />
                <Route path="/admin/content/listening/new" element={<AdminListeningLessonEditPage />} />
                <Route path="/admin/content/listening/:lessonId/edit" element={<AdminListeningLessonEditPage />} />

                {/* Phase 3.4 Reading CMS Routes */}
                <Route path="/admin/content/reading" element={<AdminReadingLessonsPage />} />
                <Route path="/admin/content/reading/new" element={<AdminReadingLessonEditPage />} />
                <Route path="/admin/content/reading/:lessonId/edit" element={<AdminReadingLessonEditPage />} />

                {/* Phase 3.5 Bulk Content Import Center Route */}
                <Route path="/admin/content/import" element={<AdminContentImportPage />} />

                {/* Phase 3.5C TOEIC Test Bank Routes */}
                <Route path="/admin/content/test-bank" element={<AdminToeicTestBankPage />} />
                <Route path="/admin/content/test-bank/classify" element={<AdminToeicClassifierPage />} />
                <Route path="/admin/content/test-bank/new" element={<AdminToeicTestEditPage />} />
                <Route path="/admin/content/test-bank/:testId/edit" element={<AdminToeicTestEditPage />} />

                {/* Admin Tools: TOEIC Audio Cutter & Import Studio */}
                <Route path="/admin/tools/toeic-audio-cutter" element={<AdminToeicAudioCutterPage />} />
                <Route path="/admin/tools/toeic-import-studio" element={<ImportStudioPage />} />
              </Route>

              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
