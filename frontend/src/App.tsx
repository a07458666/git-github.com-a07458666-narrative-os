import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Workspace from './pages/Workspace'
import KGManager from './pages/KGManager'
import LogViewer from './pages/LogViewer'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/workspace/:projectId" element={<Workspace />} />
        <Route path="/project/:projectId/kg" element={<KGManager />} />
        <Route path="/logs" element={<LogViewer />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
