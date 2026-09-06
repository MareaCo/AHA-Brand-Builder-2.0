import { Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard.jsx";
import SessionWorkspace from "./pages/SessionWorkspace.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";

export default function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/sessions/:id" element={<SessionWorkspace />} />
      </Routes>
    </ErrorBoundary>
  );
}
