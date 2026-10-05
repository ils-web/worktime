import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { MarketingPage } from './routes/marketing/MarketingPage';
import { LoginPage } from './routes/auth/LoginPage';
import { OwnerDashboard } from './routes/owner/OwnerDashboard';
import { ClientDashboard } from './routes/client/ClientDashboard';
import { WorkerAppPage } from './routes/worker/WorkerAppPage';
import { Smartphone, ArrowRight, QrCode } from 'lucide-react';

function StandaloneWorkerEntry() {
  const [empIdInput, setEmpIdInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleGo = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = empIdInput.trim();
    if (!cleanId) {
      setError('Введите ID сотрудника или отсканируйте QR-код');
      return;
    }
    // If user pasted a full URL like https://worktime-nu.vercel.app/w/EMP_123
    const match = cleanId.match(/\/w\/([a-zA-Z0-9_-]+)/);
    const finalId = (match && match[1]) ? match[1] : cleanId;

    try {
      localStorage.setItem('worktime_last_worker_empid', finalId);
    } catch {}

    navigate(`/w/${finalId}`, { replace: true });
  };

  return (
    <div className="min-h-screen max-w-md mx-auto flex flex-col justify-between bg-slate-950 text-white p-6 antialiased select-none">
      <div className="pt-8 flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-5 shadow-lg shadow-emerald-500/10">
          <Smartphone className="w-8 h-8" />
        </div>

        <h1 className="text-2xl font-black tracking-tight mb-2">WorkTime</h1>
        <p className="text-sm text-slate-400 mb-8 max-w-xs">
          Приложение учёта рабочего времени сотрудника.
        </p>

        <form onSubmit={handleGo} className="w-full space-y-4">
          <div className="text-left">
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
              ID или персональная ссылка
            </label>
            <input
              type="text"
              value={empIdInput}
              onChange={(e) => {
                setEmpIdInput(e.target.value);
                setError(null);
              }}
              placeholder="Например: EMP_... или ссылка"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition font-mono"
              autoFocus
            />
          </div>

          {error && (
            <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg p-2.5">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 active:scale-98 font-bold rounded-xl text-white transition text-sm shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2"
          >
            <span>Войти в табель смен</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-8 p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400 text-left flex items-start gap-3">
          <QrCode className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-slate-200 mb-0.5">Вход по QR-коду</div>
            Отсканируйте ваш персональный QR-код с экрана руководителя камерой телефона — приложение откроется автоматически и сохранит ваш профиль.
          </div>
        </div>
      </div>

      <div className="pt-6 border-t border-slate-900 text-center">
        <a
          href="/login"
          className="text-xs text-slate-500 hover:text-slate-300 transition"
        >
          Вход для руководителя компании →
        </a>
      </div>
    </div>
  );
}

function RootRedirect() {
  const isStandalone =
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://'));

  const savedWorkerEmpId =
    typeof window !== 'undefined' ? localStorage.getItem('worktime_last_worker_empid') : null;

  // 1. If running as installed standalone PWA and worker ID is known:
  if (isStandalone && savedWorkerEmpId) {
    return <Navigate to={`/w/${savedWorkerEmpId}`} replace />;
  }

  // 2. If running as installed standalone PWA but no worker ID saved yet:
  if (isStandalone && !savedWorkerEmpId) {
    return <StandaloneWorkerEntry />;
  }

  // 3. Regular browser on desktop or phone:
  return <MarketingPage />;
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
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
