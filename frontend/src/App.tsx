/**
 * AgentWeb - Main App Component
 * Routes configuration
 */

import { Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Identity from './pages/Identity';
import AgentWorkbench from './pages/AgentWorkbench';
import Governance from './pages/Governance';
import NewsFeed from './pages/NewsFeed';
import CognitiveMonitor from './pages/CognitiveMonitor';
import Relay from './pages/Relay';
import Credit from './pages/Credit';
import GcAncor from './pages/GcAncor';
import HGSTR from './pages/HGSTR';
import SentimentITA from './pages/SentimentITA';
import LiLiFa from './pages/LiLiFa';
import DAAMetric from './pages/DAAMetric';
import OPLC from './pages/OPLC';  // V15.0: 奇正格链 OPLC
import PPCL from './pages/PPCL';  // V16.0: 隐私保护共识层 PPCL
import ASG from './pages/ASG';    // V17.0: Agent Security Gateway ASG
import Login from './pages/Login';
import { useAuth } from './hooks/useAuth';

// Protected Route wrapper
const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

function App() {
  return (
    <div className="app">
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Login />} />

        {/* Protected routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/identity"
          element={
            <ProtectedRoute>
              <Identity />
            </ProtectedRoute>
          }
        />
        <Route
          path="/agent"
          element={
            <ProtectedRoute>
              <AgentWorkbench />
            </ProtectedRoute>
          }
        />
        <Route
          path="/governance"
          element={
            <ProtectedRoute>
              <Governance />
            </ProtectedRoute>
          }
        />
        <Route
          path="/news"
          element={
            <ProtectedRoute>
              <NewsFeed />
            </ProtectedRoute>
          }
        />
        <Route
          path="/cognitive"
          element={
            <ProtectedRoute>
              <CognitiveMonitor />
            </ProtectedRoute>
          }
        />
        {/* V12.0 Routes */}
        <Route
          path="/relay"
          element={
            <ProtectedRoute>
              <Relay />
            </ProtectedRoute>
          }
        />
        <Route
          path="/credit"
          element={
            <ProtectedRoute>
              <Credit />
            </ProtectedRoute>
          }
        />
        {/* V12.5 Routes */}
        <Route
          path="/gc-ancor"
          element={
            <ProtectedRoute>
              <GcAncor />
            </ProtectedRoute>
          }
        />
        {/* V13.0 Routes */}
        <Route
          path="/hgstr"
          element={
            <ProtectedRoute>
              <HGSTR />
            </ProtectedRoute>
          }
        />
        {/* V14.0 Routes */}
        <Route
          path="/sentiment-ita"
          element={
            <ProtectedRoute>
              <SentimentITA />
            </ProtectedRoute>
          }
        />
        <Route
          path="/li-li-fa"
          element={
            <ProtectedRoute>
              <LiLiFa />
            </ProtectedRoute>
          }
        />
        <Route
          path="/daa"
          element={
            <ProtectedRoute>
              <DAAMetric />
            </ProtectedRoute>
          }
        />
        {/* V15.0 Routes */}
        <Route
          path="/oplc"
          element={
            <ProtectedRoute>
              <OPLC />
            </ProtectedRoute>
          }
        />
        {/* V16.0 Routes */}
        <Route
          path="/ppcl"
          element={
            <ProtectedRoute>
              <PPCL />
            </ProtectedRoute>
          }
        />
        {/* V17.0 Routes */}
        <Route
          path="/asg"
          element={
            <ProtectedRoute>
              <ASG />
            </ProtectedRoute>
          }
        />

        {/* Catch all - redirect to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export default App;
