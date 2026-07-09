import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import ProjectShell from './layouts/ProjectShell'
import Overview from './pages/project/Overview'
import Workspace from './pages/Workspace'
import KGManager from './pages/KGManager'
import Timeline from './pages/Timeline'
import StoryHealth from './pages/StoryHealth'
import LogViewer from './pages/LogViewer'

// Legacy-route redirect helpers
function LegacyRedirect({ to }: { to: string }) {
  const { projectId } = useParams<{ projectId: string }>()
  return <Navigate to={`/project/${projectId}/${to}`} replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Landing */}
        <Route path="/" element={<Dashboard />} />

        {/* ── Project shell — all project pages nested ── */}
        <Route path="/project/:projectId" element={<ProjectShell />}>
          <Route index      element={<Overview   />} />
          <Route path="write"   element={<Workspace  />} />
          <Route path="plan"    element={<Timeline   />} />
          <Route path="world"   element={<KGManager  />} />
          <Route path="analyze" element={<StoryHealth />} />
        </Route>

        {/* Legacy routes → redirect into shell */}
        <Route path="/workspace/:projectId"           element={<LegacyRedirect to="write"   />} />
        <Route path="/project/:projectId/kg"          element={<LegacyRedirect to="world"   />} />
        <Route path="/project/:projectId/timeline"    element={<LegacyRedirect to="plan"    />} />
        <Route path="/project/:projectId/health"      element={<LegacyRedirect to="analyze" />} />

        {/* System */}
        <Route path="/logs" element={<LogViewer />} />
        <Route path="*"     element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
