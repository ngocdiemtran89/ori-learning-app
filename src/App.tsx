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

                <Route path="/grammar" element={<GrammarPage />} />
                <Route path="/grammar/:lessonId" element={<GrammarLessonPage />} />

                <Route path="/listening" element={<ListeningPage />} />
                <Route path="/listening/:lessonId" element={<ListeningLessonPage />} />

                <Route path="/reading" element={<ReadingPage />} />
                <Route path="/reading/:lessonId" element={<ReadingLessonPage />} />
              </Route>

              {/* Admin Only Routes (Requires Admin Role & Active Account) */}
              <Route element={<RequireAdmin />}>
                <Route path="/admin" element={<AdminPage />} />
                <Route path="/admin/students" element={<AdminStudentsPage />} />
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
