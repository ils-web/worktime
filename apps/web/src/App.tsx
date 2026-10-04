import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MarketingPage } from './routes/marketing/MarketingPage';
import { LoginPage } from './routes/auth/LoginPage';
import { OwnerDashboard } from './routes/owner/OwnerDashboard';
import { ClientDashboard } from './routes/client/ClientDashboard';
import { WorkerAppPage } from './routes/worker/WorkerAppPage';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MarketingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/owner/*" element={<OwnerDashboard />} />
        <Route path="/app/*" element={<ClientDashboard />} />
        <Route path="/w/:empId" element={<WorkerAppPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
