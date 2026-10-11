import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth";
import Layout from "./components/Layout";
import { Spinner } from "./components/ui";
import AuthPage from "./pages/AuthPage";
import Dashboard from "./pages/Dashboard";
import Add from "./pages/Add";
import CalendarPage from "./pages/CalendarPage";
import AskPage from "./pages/AskPage";
import HistoryPage from "./pages/HistoryPage";
import SettingsPage from "./pages/SettingsPage";

function Protected() {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  return user ? <Layout /> : <Navigate to="/login" replace />;
}

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <AuthPage mode="login" />} />
      <Route path="/signup" element={user ? <Navigate to="/" replace /> : <AuthPage mode="signup" />} />
      <Route element={<Protected />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/add" element={<Add />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/ask" element={<AskPage />} />
        <Route path="/upload" element={<Navigate to="/add?mode=upload" replace />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
