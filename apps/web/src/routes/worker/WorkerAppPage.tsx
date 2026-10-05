import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Clock,
  MapPin,
  Wifi,
  WifiOff,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  FileText,
  DollarSign,
  Download,
  DownloadCloud,
  Compass,
  Globe,
  Calendar,
  Smartphone,
  Share2,
  LogOut,
} from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { api } from '../../lib/api';
import { changeLanguage } from '../../lib/i18n';
import { getCurrentCoordinates, evaluateGeofence, GeoLocationResult, GeofenceStatus } from '../../lib/geo';
import {
  enqueueOfflineLog,
  getPendingCount,
  flushOfflineQueue,
  onQueueChange,
  OfflineLogItem,
} from '../../lib/offlineQueue';

interface WorkerProfile {
  id: string;
  empId: string;
  name: string;
  companyName: string;
  isMobile: boolean;
  strictGps: boolean;
  geofence?: {
    lat: number;
    lng: number;
    radius: number;
  } | null;
  shifts?: any;
}

interface WorkerStatus {
  isOnShift: boolean;
  lastAction: string | null;
  lastActionTime: string | null;
}

interface MonthlyReportSummary {
  totalNet: number;
  totalNight: number;
  totalSaturday: number;
  totalOvertime: number;
}

interface DailyReportRow {
  date: string;
  grossHours: number;
  lunchDeducted: number;
  netHours: number;
  nightHours: number;
  saturdayHours: number;
  overtimeHours: number;
}

export function WorkerAppPage() {
  const { empId } = useParams<{ empId: string }>();
  const { t, i18n } = useTranslation();

  const [activeTab, setActiveTab] = useState<'clock' | 'history' | 'notes'>('clock');
  const [profile, setProfile] = useState<WorkerProfile | null>(null);
  const [status, setStatus] = useState<WorkerStatus>({
    isOnShift: false,
    lastAction: null,
    lastActionTime: null,
  });
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Network & Offline Queue
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [pendingQueueCount, setPendingQueueCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [offlineNotice, setOfflineNotice] = useState<string | null>(null);

  // Geolocation
  const [geoResult, setGeoResult] = useState<GeoLocationResult | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [geofenceEval, setGeofenceEval] = useState<GeofenceStatus | null>(null);

  // Shift Timer
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Action Loading
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);

  // Notes tab state
  const [noteText, setNoteText] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [noteStatusMessage, setNoteStatusMessage] = useState<string | null>(null);
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);

  // History tab state
  const currentMonthStr = useMemo(() => new Date().toISOString().slice(0, 7), []);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);
  const [monthlySummary, setMonthlySummary] = useState<MonthlyReportSummary | null>(null);
  const [monthlyDays, setMonthlyDays] = useState<DailyReportRow[]>([]);
  const [isLoadingReport, setIsLoadingReport] = useState(false);

  // PWA Install State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIosDevice, setIsIosDevice] = useState(false);
  const [showInstallGuideModal, setShowInstallGuideModal] = useState(false);
  const [isInstallBannerDismissed, setIsInstallBannerDismissed] = useState(false);

  // 1. Detect PWA standalone mode and listen for install prompt
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://');
    setIsStandalone(standalone);

    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIosDevice(ios);

    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  // 1.1 Persist current empId to localStorage and point manifest to dynamic endpoint
  useEffect(() => {
    if (empId) {
      try {
        localStorage.setItem('worktime_last_worker_empid', empId);
      } catch {}
      const manifestEl = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
      if (manifestEl) {
        manifestEl.href = `/api/manifest?empId=${encodeURIComponent(empId)}`;
      }
    }
  }, [empId]);

  // 2. Fetch worker profile
  const fetchProfile = useCallback(async () => {
    if (!empId) return;
    try {
      setIsLoadingProfile(true);
      setProfileError(null);
      const res = await api.get<{
        success: boolean;
        employee: WorkerProfile;
        status: WorkerStatus;
      }>(`/api/worker/profile/${empId}`);

      setProfile(res.employee);
      setStatus(res.status);
    } catch (err: any) {
      setProfileError(err.message || 'Worker not found');
    } finally {
      setIsLoadingProfile(false);
    }
  }, [empId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // 3. Online/Offline & Sync Listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (empId) {
        triggerSync(empId);
      }
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    let unsubscribe = () => {};
    if (empId) {
      getPendingCount(empId).then(setPendingQueueCount);
      unsubscribe = onQueueChange((count) => setPendingQueueCount(count));
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe();
    };
  }, [empId]);

  // 4. Offline Queue Sync function
  const triggerSync = async (targetEmpId: string) => {
    if (!navigator.onLine || isSyncing) return;
    setIsSyncing(true);
    try {
      const res = await flushOfflineQueue(targetEmpId, async (logs: OfflineLogItem[]) => {
        try {
          const syncRes = await api.post<{ success: boolean; count: number }>(
            '/api/worker/sync',
            {
              empId: targetEmpId,
              logs: logs.map((l) => ({
                empId: l.empId,
                action: l.action,
                lat: l.lat,
                lng: l.lng,
                dateTime: l.dateTime,
                note: l.note,
                expense: l.expense,
              })),
            }
          );
          return syncRes.success;
        } catch (e) {
          return false;
        }
      });

      if (res.success && res.count > 0) {
        setOfflineNotice(t('worker.syncSuccess'));
        setTimeout(() => setOfflineNotice(null), 4000);
        fetchProfile();
      }
    } catch (e) {
      // Sync failed
    } finally {
      setIsSyncing(false);
    }
  };

  // 5. GPS Location Check
  const refreshLocation = useCallback(async () => {
    setIsLocating(true);
    setGeoError(null);
    try {
      const coords = await getCurrentCoordinates(10000);
      setGeoResult(coords);

      if (profile && !profile.isMobile && profile.geofence?.lat && profile.geofence?.lng) {
        const ev = evaluateGeofence(
          coords.lat,
          coords.lng,
          profile.geofence.lat,
          profile.geofence.lng,
          profile.geofence.radius
        );
        setGeofenceEval(ev);
      }
    } catch (err: any) {
      setGeoError(err.message || t('worker.gpsError'));
    } finally {
      setIsLocating(false);
    }
  }, [profile, t]);

  useEffect(() => {
    if (profile) {
      refreshLocation();
    }
  }, [profile, refreshLocation]);

  // Strict GPS Watcher when on shift
  useEffect(() => {
    if (!profile?.strictGps || !status.isOnShift || typeof navigator === 'undefined' || !navigator.geolocation) {
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setGeoResult({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp,
        });

        if (profile.geofence?.lat && profile.geofence?.lng) {
          const ev = evaluateGeofence(
            pos.coords.latitude,
            pos.coords.longitude,
            profile.geofence.lat,
            profile.geofence.lng,
            profile.geofence.radius
          );
          setGeofenceEval(ev);
        }
      },
      () => {},
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [profile, status.isOnShift]);

  // 6. Live Shift Timer
  useEffect(() => {
    if (!status.isOnShift || !status.lastActionTime) {
      setElapsedSeconds(0);
      return;
    }

    const calcElapsed = () => {
      const startMs = new Date(status.lastActionTime!).getTime();
      const nowMs = Date.now();
      const diffSec = Math.max(0, Math.floor((nowMs - startMs) / 1000));
      setElapsedSeconds(diffSec);
    };

    calcElapsed();
    const interval = setInterval(calcElapsed, 1000);
    return () => clearInterval(interval);
  }, [status.isOnShift, status.lastActionTime]);

  const formattedTimer = useMemo(() => {
    const hours = Math.floor(elapsedSeconds / 3600);
    const minutes = Math.floor((elapsedSeconds % 3600) / 60);
    const seconds = elapsedSeconds % 60;
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }, [elapsedSeconds]);

  // 7. Clock In / Out Action Handlers
  const handleClockAction = async (action: 'CLOCK_IN' | 'CLOCK_OUT') => {
    if (!empId || isSubmittingAction) return;

    if (navigator.vibrate) {
      navigator.vibrate([100, 50, 100]);
    }

    setIsSubmittingAction(true);
    setOfflineNotice(null);

    // If CLOCK_IN, check geofence boundary locally
    if (action === 'CLOCK_IN' && profile && !profile.isMobile && profile.geofence) {
      if (geofenceEval && !geofenceEval.isInside) {
        alert(
          t('worker.geoOutBlock', {
            dist: geofenceEval.distanceMeters,
            radius: geofenceEval.allowedRadius,
          })
        );
        setIsSubmittingAction(false);
        return;
      }
    }

    const actionTime = new Date().toISOString();
    const lat = geoResult?.lat ?? null;
    const lng = geoResult?.lng ?? null;

    if (!isOnline) {
      // Offline: Enqueue to IndexedDB
      await enqueueOfflineLog({
        empId,
        action,
        lat,
        lng,
        dateTime: actionTime,
      });

      setStatus({
        isOnShift: action === 'CLOCK_IN',
        lastAction: action,
        lastActionTime: actionTime,
      });

      setOfflineNotice(t('worker.offlineNotice'));
      setIsSubmittingAction(false);
      return;
    }

    // Online: Send direct API request
    try {
      const res = await api.post<{ success: boolean; log: any }>('/api/worker/log', {
        empId,
        action,
        lat,
        lng,
      });

      if (res.success) {
        setStatus({
          isOnShift: action === 'CLOCK_IN',
          lastAction: action,
          lastActionTime: res.log.dateTime,
        });
        refreshLocation();
      }
    } catch (err: any) {
      // If network failed during online attempt, gracefully fallback to offline queue
      if (err.message?.includes('network') || err.message?.includes('Failed to fetch') || !navigator.onLine) {
        await enqueueOfflineLog({
          empId,
          action,
          lat,
          lng,
          dateTime: actionTime,
        });

        setStatus({
          isOnShift: action === 'CLOCK_IN',
          lastAction: action,
          lastActionTime: actionTime,
        });

        setOfflineNotice(t('worker.offlineNotice'));
      } else {
        alert(err.message || 'Error recording shift action');
      }
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // 8. Notes & Expenses Handler
  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empId || isSubmittingNote || (!noteText && !expenseAmount)) return;

    setIsSubmittingNote(true);
    setNoteStatusMessage(null);

    const expenseNum = expenseAmount ? parseFloat(expenseAmount) : 0;
    const actionTime = new Date().toISOString();

    if (!isOnline) {
      await enqueueOfflineLog({
        empId,
        action: 'AUTO_PAUSE', // marker action for offline note
        lat: geoResult?.lat ?? null,
        lng: geoResult?.lng ?? null,
        dateTime: actionTime,
        note: noteText,
        expense: expenseNum,
      });
      setNoteStatusMessage(t('worker.noteSaved'));
      setNoteText('');
      setExpenseAmount('');
      setIsSubmittingNote(false);
      return;
    }

    try {
      await api.post('/api/worker/notes', {
        empId,
        noteText,
        expense: expenseNum,
      });
      setNoteStatusMessage(t('worker.noteSaved'));
      setNoteText('');
      setExpenseAmount('');
    } catch (err: any) {
      setNoteStatusMessage('Failed to save note');
    } finally {
      setIsSubmittingNote(false);
    }
  };

  // 9. Load Monthly Report
  const loadMonthlyReport = useCallback(async () => {
    if (!empId) return;
    try {
      setIsLoadingReport(true);
      const res = await api.get<{
        success: boolean;
        summary: MonthlyReportSummary;
        days: DailyReportRow[];
      }>(`/api/worker/report/${empId}?month=${selectedMonth}`);

      setMonthlySummary(res.summary);
      setMonthlyDays(res.days);
    } catch (err) {
      // Failed to load report
    } finally {
      setIsLoadingReport(false);
    }
  }, [empId, selectedMonth]);

  useEffect(() => {
    if (activeTab === 'history') {
      loadMonthlyReport();
    }
  }, [activeTab, loadMonthlyReport]);

  const handleDownloadPdf = () => {
    if (!empId) return;
    window.open(`/api/worker/report/${empId}/pdf?month=${selectedMonth}`, '_blank');
  };

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        setIsStandalone(true);
      }
    } else {
      setShowInstallGuideModal(true);
    }
  };

  // Profile Loading / Error screens
  if (isLoadingProfile) {
    return (
      <div className="min-h-screen max-w-md mx-auto flex flex-col items-center justify-center p-4 bg-slate-950 text-white">
        <RefreshCw className="w-10 h-10 text-emerald-500 animate-spin mb-4" />
        <p className="text-slate-400 font-medium">Загрузка профиля сотрудника...</p>
      </div>
    );
  }

  if (profileError || !profile) {
    return (
      <div className="min-h-screen max-w-md mx-auto flex flex-col items-center justify-center p-6 bg-slate-950 text-white text-center">
        <AlertCircle className="w-14 h-14 text-rose-500 mb-4" />
        <h1 className="text-xl font-bold mb-2">Сотрудник не найден</h1>
        <p className="text-slate-400 text-sm mb-6">
          Проверьте правильность персональной ссылки или обратитесь к менеджеру компании.
        </p>
        <div className="text-xs text-slate-600 font-mono">ID: {empId}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen max-w-md mx-auto flex flex-col justify-between bg-slate-950 text-white antialiased select-none pb-20">
      {/* 1. Header with Statuses & Language Switcher */}
      <header className="p-4 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur sticky top-0 z-20">
        <div className="flex justify-between items-center mb-2.5">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400">
              {profile.companyName}
            </div>
            <h1 className="text-lg font-black tracking-tight text-white">{profile.name}</h1>
          </div>

          {/* Language Switcher Buttons & Logout */}
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-xl border border-slate-700/60">
              <Globe className="w-3.5 h-3.5 text-slate-400 ml-1 mr-0.5" />
              {(['ru', 'he', 'en', 'ar'] as const).map((lang) => (
                <button
                  key={lang}
                  onClick={() => changeLanguage(lang)}
                  className={`px-2 py-0.5 text-xs font-bold rounded-lg transition ${
                    i18n.language === lang
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {lang.toUpperCase()}
                </button>
              ))}
            </div>

            <button
              onClick={() => {
                if (window.confirm('Выйти из профиля этого сотрудника на этом телефоне?')) {
                  try {
                    localStorage.removeItem('worktime_last_worker_empid');
                  } catch {}
                  window.location.href = '/';
                }
              }}
              className="p-1.5 bg-slate-800 hover:bg-rose-950/50 text-slate-400 hover:text-rose-400 rounded-xl border border-slate-700/60 transition"
              title="Сменить сотрудника"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Status badges row */}
        <div className="flex items-center justify-between text-xs pt-1">
          <div className="flex items-center gap-2">
            {/* Online / Offline status */}
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-medium border ${
                isOnline
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
              }`}
            >
              {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {isOnline ? t('worker.online') : t('worker.offline')}
            </span>

            {/* Pending queue badge */}
            {pendingQueueCount > 0 && (
              <button
                onClick={() => empId && triggerSync(empId)}
                disabled={!isOnline || isSyncing}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-medium bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/30 transition"
              >
                <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                {t('worker.syncQueue', { count: pendingQueueCount })}
              </button>
            )}

            {/* PWA Install Button (shown when opened in standard browser) */}
            {!isStandalone && (
              <button
                onClick={handleInstallClick}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 transition text-[11px]"
                title={t('worker.installPwa')}
              >
                <Smartphone className="w-3 h-3" />
                <span>{t('worker.installPwa')}</span>
              </button>
            )}
          </div>

          {/* GPS Quick Status */}
          <button
            onClick={refreshLocation}
            className="inline-flex items-center gap-1 text-slate-400 hover:text-emerald-400 transition"
            title="Обновить GPS"
          >
            <Compass className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin text-emerald-400' : ''}`} />
            <span className="text-[11px] font-mono">
              {geoResult ? `±${Math.round(geoResult.accuracy)}m` : 'GPS'}
            </span>
          </button>
        </div>
      </header>

      {/* Prominent PWA Install Notice Banner for Mobile Browser */}
      {!isStandalone && !isInstallBannerDismissed && (
        <div className="bg-gradient-to-r from-emerald-950/90 via-teal-950/90 to-slate-900 border-b border-emerald-500/30 p-3 text-xs text-emerald-100 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2.5 flex-1 min-w-0 mr-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0 text-emerald-400">
              <Smartphone className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-white text-xs truncate">
                {t('worker.installPwaTitle')}
              </div>
              <div className="text-[11px] text-emerald-300/80 truncate">
                {t('worker.installPwaSubtitle')}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleInstallClick}
              className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-bold rounded-lg transition text-xs shadow-sm flex items-center gap-1"
            >
              <Download className="w-3 h-3" />
              <span>{t('worker.installPwa')}</span>
            </button>
            <button
              onClick={() => setIsInstallBannerDismissed(true)}
              className="text-slate-400 hover:text-white font-bold px-1.5 text-base leading-none"
              title="Закрыть"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Offline Alert Banner */}
      {offlineNotice && (
        <div className="bg-amber-950/80 border-b border-amber-700/50 p-3 text-xs text-amber-200 flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-400" />
            <span>{offlineNotice}</span>
          </div>
          <button onClick={() => setOfflineNotice(null)} className="text-amber-400 font-bold px-2">
            ×
          </button>
        </div>
      )}

      {/* Main Tab Content Area */}
      <main className="flex-1 p-4 flex flex-col justify-start">
        {/* ================= TAB 1: CLOCK IN / OUT ================= */}
        {activeTab === 'clock' && (
          <div className="flex-1 flex flex-col justify-between py-2">
            {/* Geofence / Location Card */}
            <div className="bg-slate-900/80 rounded-2xl p-3.5 border border-slate-800/80 shadow-md mb-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                      profile.isMobile
                        ? 'bg-slate-800 text-slate-300'
                        : geofenceEval?.isInside
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    }`}
                  >
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-200">
                      {profile.isMobile
                        ? t('worker.mobileWorker')
                        : geofenceEval?.isInside
                        ? t('worker.insideGeofence', { dist: geofenceEval?.distanceMeters ?? 0 })
                        : geofenceEval
                        ? t('worker.outsideGeofence', {
                            dist: geofenceEval.distanceMeters,
                            radius: geofenceEval.allowedRadius,
                          })
                        : isLocating
                        ? t('worker.gpsSearching')
                        : t('worker.gpsActive')}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {geoError ? (
                        <span className="text-rose-400">{geoError}</span>
                      ) : geoResult ? (
                        `Координаты: ${geoResult.lat.toFixed(4)}, ${geoResult.lng.toFixed(4)}`
                      ) : (
                        'Определение положения...'
                      )}
                    </div>
                  </div>
                </div>

                <button
                  onClick={refreshLocation}
                  disabled={isLocating}
                  className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition active:scale-95"
                >
                  <RefreshCw className={`w-4 h-4 ${isLocating ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Live Shift Timer Display */}
            <div className="text-center my-4 py-4 px-6 bg-slate-900/50 rounded-3xl border border-slate-800/50 shadow-inner">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                {status.isOnShift ? t('worker.shiftTimer') : t('worker.notOnShift')}
              </span>
              <div
                className={`text-5xl font-mono font-black tracking-tight mt-1 transition ${
                  status.isOnShift ? 'text-emerald-400 drop-shadow-md' : 'text-slate-600'
                }`}
              >
                {status.isOnShift ? formattedTimer : '00:00:00'}
              </div>
              {status.isOnShift && status.lastActionTime && (
                <div className="text-xs text-slate-400 mt-2 flex items-center justify-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-emerald-400" />
                  <span>
                    {t('worker.startedAt', {
                      time: new Date(status.lastActionTime).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      }),
                    })}
                  </span>
                </div>
              )}
            </div>

            {/* Giant Tactile Clock In / Out Buttons */}
            <div className="space-y-4 my-auto">
              {!status.isOnShift ? (
                /* CLOCK IN BUTTON */
                <button
                  onClick={() => handleClockAction('CLOCK_IN')}
                  disabled={isSubmittingAction}
                  className="w-full h-36 bg-gradient-to-br from-emerald-500 to-emerald-700 hover:from-emerald-400 hover:to-emerald-600 active:scale-[0.98] text-white font-black text-3xl rounded-3xl shadow-2xl shadow-emerald-950/60 flex flex-col items-center justify-center transition border-t border-emerald-400/30 group"
                >
                  <span className="tracking-wider flex items-center gap-2 group-hover:scale-105 transition transform">
                    {t('worker.clockIn')}
                  </span>
                  <span className="text-xs font-normal text-emerald-100/90 mt-1.5">
                    {t('worker.clockInSub')}
                  </span>
                </button>
              ) : (
                /* CLOCK OUT BUTTON */
                <button
                  onClick={() => handleClockAction('CLOCK_OUT')}
                  disabled={isSubmittingAction}
                  className="w-full h-36 bg-gradient-to-br from-rose-600 to-rose-800 hover:from-rose-500 hover:to-rose-700 active:scale-[0.98] text-white font-black text-3xl rounded-3xl shadow-2xl shadow-rose-950/60 flex flex-col items-center justify-center transition border-t border-rose-400/30 group"
                >
                  <span className="tracking-wider flex items-center gap-2 group-hover:scale-105 transition transform">
                    {t('worker.clockOut')}
                  </span>
                  <span className="text-xs font-normal text-rose-100/90 mt-1.5">
                    {t('worker.clockOutSub')}
                  </span>
                </button>
              )}
            </div>

            {/* Bottom info caption */}
            <div className="text-center text-[11px] text-slate-500 mt-4 flex items-center justify-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>Офлайн-режим активен • Автоматическая синхронизация</span>
            </div>
          </div>
        )}

        {/* ================= TAB 2: MY HOURS & REPORTS ================= */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-400" />
                {t('worker.tabHistory')}
              </h2>

              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-slate-900 text-white text-xs px-3 py-1.5 rounded-xl border border-slate-700 font-medium"
              />
            </div>

            {/* Month Summary Cards */}
            {monthlySummary && (
              <div className="grid grid-cols-2 gap-2.5">
                <div className="bg-slate-900/80 p-3 rounded-2xl border border-slate-800">
                  <span className="text-[11px] font-semibold text-slate-400">
                    {t('worker.totalNet')}
                  </span>
                  <div className="text-2xl font-black text-emerald-400 mt-0.5">
                    {monthlySummary.totalNet} ч
                  </div>
                </div>

                <div className="bg-slate-900/80 p-3 rounded-2xl border border-slate-800">
                  <span className="text-[11px] font-semibold text-slate-400">
                    {t('worker.nightHours')}
                  </span>
                  <div className="text-2xl font-black text-indigo-400 mt-0.5">
                    {monthlySummary.totalNight} ч
                  </div>
                </div>

                <div className="bg-slate-900/80 p-3 rounded-2xl border border-slate-800">
                  <span className="text-[11px] font-semibold text-slate-400">
                    {t('worker.satHours')}
                  </span>
                  <div className="text-2xl font-black text-amber-400 mt-0.5">
                    {monthlySummary.totalSaturday} ч
                  </div>
                </div>

                <div className="bg-slate-900/80 p-3 rounded-2xl border border-slate-800">
                  <span className="text-[11px] font-semibold text-slate-400">
                    {t('worker.overtime')}
                  </span>
                  <div className="text-2xl font-black text-purple-400 mt-0.5">
                    {monthlySummary.totalOvertime} ч
                  </div>
                </div>
              </div>
            )}

            {/* Direct PDF Download Button */}
            <button
              onClick={handleDownloadPdf}
              className="w-full py-3 bg-slate-800 hover:bg-slate-700 active:scale-95 text-emerald-400 font-bold text-xs rounded-2xl border border-slate-700/80 flex items-center justify-center gap-2 transition"
            >
              <Download className="w-4 h-4" />
              <span>{t('worker.downloadPdf')}</span>
            </button>

            {/* Days list */}
            <div className="bg-slate-900/60 rounded-2xl border border-slate-800 overflow-hidden">
              <div className="px-3.5 py-2.5 bg-slate-800/40 border-b border-slate-800 flex justify-between text-[11px] font-semibold text-slate-400 uppercase">
                <span>{t('worker.date')}</span>
                <span>{t('worker.net')}</span>
              </div>

              {isLoadingReport ? (
                <div className="p-8 text-center text-xs text-slate-400">Загрузка данных...</div>
              ) : monthlyDays.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  {t('worker.noShiftsYet')}
                </div>
              ) : (
                <div className="divide-y divide-slate-800/60 max-h-60 overflow-y-auto">
                  {monthlyDays.map((d) => (
                    <div key={d.date} className="px-3.5 py-2.5 flex justify-between items-center text-xs">
                      <span className="font-mono text-slate-300">{d.date}</span>
                      <div className="text-right">
                        <span className="font-bold text-emerald-400">{d.netHours} ч</span>
                        {d.lunchDeducted > 0 && (
                          <span className="text-[10px] text-slate-500 block">
                            (обед -{d.lunchDeducted}ч)
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= TAB 3: NOTES & EXPENSES ================= */}
        {activeTab === 'notes' && (
          <form onSubmit={handleSaveNote} className="space-y-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2 mb-1">
                <FileText className="w-4 h-4 text-emerald-400" />
                {t('worker.notesTitle')}
              </h2>
              <p className="text-xs text-slate-400">
                Зафиксируйте выполненные работы, непредвиденные расходы или комментарии по объекту.
              </p>
            </div>

            {noteStatusMessage && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{noteStatusMessage}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Описание / Комментарий
              </label>
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder={t('worker.notePlaceholder')}
                rows={4}
                className="w-full bg-slate-900 border border-slate-700 rounded-2xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-amber-400" />
                {t('worker.expenseLabel')}
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={expenseAmount}
                onChange={(e) => setExpenseAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-slate-900 border border-slate-700 rounded-2xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono transition"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmittingNote || (!noteText && !expenseAmount)}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 disabled:opacity-50 text-white font-bold text-sm rounded-2xl shadow-lg transition"
            >
              {isSubmittingNote ? 'Сохранение...' : t('worker.saveNote')}
            </button>
          </form>
        )}
      </main>

      {/* PWA Add to Home Screen Quick Prompt (if deferredPrompt is ready and not standalone) */}
      {!isStandalone && deferredPrompt && (
        <div className="px-4 py-2 bg-indigo-950/60 border-t border-indigo-700/40 flex items-center justify-between text-xs text-indigo-200">
          <div className="flex items-center gap-2">
            <DownloadCloud className="w-4 h-4 text-indigo-400" />
            <span>{t('worker.installPwa')}</span>
          </div>
          <button
            onClick={handleInstallClick}
            className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 font-bold rounded-lg text-white transition text-[11px]"
          >
            {t('worker.installPwa')}
          </button>
        </div>
      )}

      {/* Modal with step-by-step instructions for iOS / Android */}
      <Modal
        isOpen={showInstallGuideModal}
        onClose={() => setShowInstallGuideModal(false)}
        title={t('worker.installPwaTitle')}
      >
        <div className="space-y-4 py-2">
          <div className="flex items-start gap-3 p-3.5 bg-slate-800/80 rounded-xl border border-slate-700">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
              {isIosDevice ? <Share2 className="w-5 h-5" /> : <Smartphone className="w-5 h-5" />}
            </div>
            <div className="text-sm font-medium text-slate-200 leading-relaxed">
              {isIosDevice ? t('worker.installIosStep') : t('worker.installAndroidStep')}
            </div>
          </div>

          <p className="text-xs text-slate-400 text-center">
            {t('worker.installPwaSubtitle')}
          </p>

          <button
            onClick={() => setShowInstallGuideModal(false)}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-98 font-bold rounded-xl text-white transition text-sm shadow"
          >
            OK
          </button>
        </div>
      </Modal>

      {/* Bottom Sticky Tab Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-slate-900/90 backdrop-blur border-t border-slate-800 p-2 flex justify-around z-30">
        <button
          onClick={() => setActiveTab('clock')}
          className={`flex flex-col items-center py-1 px-4 rounded-xl transition ${
            activeTab === 'clock'
              ? 'text-emerald-400 font-bold'
              : 'text-slate-400 hover:text-slate-200 font-medium'
          }`}
        >
          <Clock className="w-5 h-5 mb-0.5" />
          <span className="text-[11px]">{t('worker.tabClock')}</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex flex-col items-center py-1 px-4 rounded-xl transition ${
            activeTab === 'history'
              ? 'text-emerald-400 font-bold'
              : 'text-slate-400 hover:text-slate-200 font-medium'
          }`}
        >
          <Calendar className="w-5 h-5 mb-0.5" />
          <span className="text-[11px]">{t('worker.tabHistory')}</span>
        </button>

        <button
          onClick={() => setActiveTab('notes')}
          className={`flex flex-col items-center py-1 px-4 rounded-xl transition ${
            activeTab === 'notes'
              ? 'text-emerald-400 font-bold'
              : 'text-slate-400 hover:text-slate-200 font-medium'
          }`}
        >
          <FileText className="w-5 h-5 mb-0.5" />
          <span className="text-[11px]">{t('worker.tabNotes')}</span>
        </button>
      </nav>
    </div>
  );
}
