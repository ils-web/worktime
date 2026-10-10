import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ShieldCheck,
  Smartphone,
  FileSpreadsheet,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Calculator,
  Send,
  Building2,
  Phone,
  Mail,
  User,
  Check,
  Globe,
} from 'lucide-react';
import { api } from '../../lib/api';
import { changeLanguage } from '../../lib/i18n';
import { Modal } from '../../components/ui/Modal';
import { PasswordInput } from '../../components/ui/PasswordInput';
import { useAuthStore } from '../../stores/authStore';

type AppLang = 'ru' | 'he' | 'en' | 'ar';

export function MarketingPage() {
  const navigate = useNavigate();
  const checkAuth = useAuthStore((state) => state.checkAuth);
  const { t, i18n } = useTranslation();

  const rawLang = i18n.language === 'iw' ? 'he' : (i18n.language || 'he');
  const currentLang: AppLang = (rawLang === 'ru' || rawLang === 'he' || rawLang === 'en' || rawLang === 'ar') ? rawLang : 'he';

  // Lead contact form state
  const [contactName, setContactName] = useState('');
  const [contactCompany, setContactCompany] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [isSubmittingContact, setIsSubmittingContact] = useState(false);
  const [contactSuccess, setContactSuccess] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);

  // Self-registration (14-day trial) modal state
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regCompanyName, setRegCompanyName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);

  // ROI Calculator state
  const [workerCount, setWorkerCount] = useState(15);
  const [hourlyRate, setHourlyRate] = useState(45); // in ILS/hour

  // Saved worker on this device
  const savedWorkerEmpId = typeof window !== 'undefined' ? localStorage.getItem('worktime_last_worker_empid') : null;

  // Calculated estimates: Average wasted hours prevented = 3.5 hrs / worker / week
  const monthlySavings = Math.round(workerCount * 3.5 * 4.33 * hourlyRate);

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactName || !contactPhone) {
      setContactError(t('marketing.contact.nameReq'));
      return;
    }

    setIsSubmittingContact(true);
    setContactError(null);

    try {
      await api.post('/api/public/contact', {
        name: contactName,
        company: contactCompany,
        phone: contactPhone,
        email: contactEmail,
        message: contactMessage,
      });

      setContactSuccess(true);
      setContactName('');
      setContactCompany('');
      setContactPhone('');
      setContactEmail('');
      setContactMessage('');
    } catch (err: any) {
      setContactError(err.message || t('marketing.contact.nameReq'));
    } finally {
      setIsSubmittingContact(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regUsername || !regPassword || !regCompanyName) {
      setRegError(t('marketing.modal.reqFields'));
      return;
    }

    setIsRegistering(true);
    setRegError(null);

    try {
      const res = await api.post<{
        success: boolean;
        role: 'client';
        clientId: string;
        name: string;
      }>('/api/public/register', {
        username: regUsername,
        password: regPassword,
        name: regCompanyName,
        phone: regPhone,
      });

      if (res.success) {
        await checkAuth();
        navigate('/app');
      }
    } catch (err: any) {
      setRegError(err.message || t('marketing.modal.regError'));
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-white">
      {/* 1. Navigation Header */}
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur border-b border-slate-800/80 px-4 sm:px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-emerald-400 flex items-center justify-center font-black text-slate-950 text-xl shadow-lg shadow-emerald-600/20">
              WT
            </div>
            <div>
              <span className="text-xl font-black tracking-tight text-white block">TimeTracker</span>
              <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">
                SaaS v2 • Enterprise GPS
              </span>
            </div>
          </div>

          <nav className="hidden lg:flex items-center gap-6 xl:gap-8 text-sm font-medium text-slate-300">
            <a href="#features" className="hover:text-emerald-400 transition">
              {t('marketing.nav.features')}
            </a>
            <a href="#how-it-works" className="hover:text-emerald-400 transition">
              {t('marketing.nav.howItWorks')}
            </a>
            <a href="#calculator" className="hover:text-emerald-400 transition">
              {t('marketing.nav.calculator')}
            </a>
            <a href="#contact" className="hover:text-emerald-400 transition">
              {t('marketing.nav.contact')}
            </a>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Language Switcher */}
            <div className="flex items-center gap-0.5 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
              {(['he', 'ru', 'en', 'ar'] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => changeLanguage(l)}
                  className={`px-1.5 sm:px-2 py-0.5 rounded-lg text-[10px] sm:text-[11px] font-semibold transition ${
                    currentLang === l
                      ? 'bg-emerald-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>

            {savedWorkerEmpId ? (
              <button
                onClick={() => navigate(`/w/${savedWorkerEmpId}`)}
                className="px-3 py-1.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-xl font-bold text-xs hover:bg-emerald-500/30 transition flex items-center gap-1.5"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t('marketing.nav.myShift')}</span>
              </button>
            ) : (
              <button
                onClick={() => navigate('/worker')}
                className="hidden sm:flex px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 rounded-xl font-medium text-xs transition items-center gap-1.5"
              >
                <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                <span>{t('marketing.nav.worker')}</span>
              </button>
            )}
            <button
              onClick={() => navigate('/login')}
              className="px-2.5 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-slate-300 hover:text-white transition whitespace-nowrap"
            >
              {t('marketing.nav.login')}
            </button>
            <button
              onClick={() => setIsRegisterModalOpen(true)}
              className="px-3 sm:px-5 py-2 sm:py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs sm:text-sm shadow-lg shadow-emerald-600/25 transition active:scale-95 whitespace-nowrap"
            >
              {t('marketing.nav.startFree')}
            </button>
          </div>
        </div>
      </header>

      {/* Saved Worker Quick Notification Banner */}
      {savedWorkerEmpId && (
        <div className="bg-emerald-950/80 border-b border-emerald-600/40 px-6 py-2.5 text-xs text-emerald-200 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-emerald-400" />
            <span>{t('marketing.banner.savedWorker')}</span>
          </div>
          <button
            onClick={() => navigate(`/w/${savedWorkerEmpId}`)}
            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold rounded-lg text-xs transition"
          >
            {t('marketing.banner.goToShifts')}
          </button>
        </div>
      )}

      {/* 2. Hero Section */}
      <section className="relative overflow-hidden pt-16 pb-24 md:pt-24 md:pb-32 px-6">
        {/* Glow backdrop decorative elements */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-emerald-500/10 blur-[130px] pointer-events-none rounded-full" />
        <div className="absolute top-1/3 left-1/3 -translate-x-1/2 w-[350px] h-[250px] bg-indigo-500/10 blur-[120px] pointer-events-none rounded-full" />

        <div className="max-w-5xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-8 shadow-sm">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{t('marketing.hero.badge')}</span>
          </div>

          <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight text-white leading-[1.1] mb-8">
            {t('marketing.hero.title')} <span className="text-emerald-400">{t('marketing.hero.titleHighlight')}</span> {t('marketing.hero.titleSuffix')}
          </h1>

          <p className="text-lg sm:text-xl text-slate-400 max-w-3xl mx-auto mb-10 leading-relaxed font-normal">
            {t('marketing.hero.subtitle')}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <button
              onClick={() => setIsRegisterModalOpen(true)}
              className="w-full sm:w-auto px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-base rounded-2xl shadow-xl shadow-emerald-500/25 flex items-center justify-center gap-2 transition active:scale-95 group"
            >
              <span>{t('marketing.hero.tryTrial')}</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1 transition transform" />
            </button>
            <a
              href="#contact"
              className="w-full sm:w-auto px-8 py-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-base rounded-2xl border border-slate-700/80 transition"
            >
              {t('marketing.hero.bookDemo')}
            </a>
          </div>

          {/* Key Advantages Badges */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto pt-6 border-t border-slate-800/80 text-start">
            <div className="flex items-center gap-3 p-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center flex-shrink-0">
                <Check className="w-4 h-4 stroke-[3]" />
              </div>
              <span className="text-xs font-semibold text-slate-300">{t('marketing.badges.gps')}</span>
            </div>
            <div className="flex items-center gap-3 p-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center flex-shrink-0">
                <Check className="w-4 h-4 stroke-[3]" />
              </div>
              <span className="text-xs font-semibold text-slate-300">{t('marketing.badges.offline')}</span>
            </div>
            <div className="flex items-center gap-3 p-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center flex-shrink-0">
                <Check className="w-4 h-4 stroke-[3]" />
              </div>
              <span className="text-xs font-semibold text-slate-300">{t('marketing.badges.qr')}</span>
            </div>
            <div className="flex items-center gap-3 p-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center flex-shrink-0">
                <Check className="w-4 h-4 stroke-[3]" />
              </div>
              <span className="text-xs font-semibold text-slate-300">{t('marketing.badges.reports')}</span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Features Section */}
      <section id="features" className="py-20 bg-slate-900/40 border-y border-slate-800/80 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-2">
              {t('marketing.features.tag')}
            </h2>
            <p className="text-3xl sm:text-4xl font-black tracking-tight text-white">
              {t('marketing.features.heading')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-8 relative hover:border-slate-700 transition">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-6">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">{t('marketing.features.f1Title')}</h3>
              <p className="text-sm text-slate-400 leading-relaxed mb-4">
                {t('marketing.features.f1Desc')}
              </p>
              <ul className="space-y-2 text-xs text-slate-300">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{t('marketing.features.f1Point1')}</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{t('marketing.features.f1Point2')}</span>
                </li>
              </ul>
            </div>

            {/* Feature 2 */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-8 relative hover:border-slate-700 transition">
              <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-6">
                <Smartphone className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">{t('marketing.features.f2Title')}</h3>
              <p className="text-sm text-slate-400 leading-relaxed mb-4">
                {t('marketing.features.f2Desc')}
              </p>
              <ul className="space-y-2 text-xs text-slate-300">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>{t('marketing.features.f2Point1')}</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>{t('marketing.features.f2Point2')}</span>
                </li>
              </ul>
            </div>

            {/* Feature 3 */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-8 relative hover:border-slate-700 transition">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-6">
                <FileSpreadsheet className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">{t('marketing.features.f3Title')}</h3>
              <p className="text-sm text-slate-400 leading-relaxed mb-4">
                {t('marketing.features.f3Desc')}
              </p>
              <ul className="space-y-2 text-xs text-slate-300">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>{t('marketing.features.f3Point1')}</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>{t('marketing.features.f3Point2')}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 4. How It Works Section */}
      <section id="how-it-works" className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-2">
              {t('marketing.howItWorks.tag')}
            </h2>
            <p className="text-3xl sm:text-4xl font-black tracking-tight text-white">
              {t('marketing.howItWorks.heading')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 bg-slate-900/40 rounded-3xl border border-slate-800">
              <div className="w-10 h-10 rounded-xl bg-slate-800 font-mono font-bold text-emerald-400 flex items-center justify-center mb-4 text-lg">
                01
              </div>
              <h4 className="text-lg font-bold text-white mb-2">{t('marketing.howItWorks.step1Title')}</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                {t('marketing.howItWorks.step1Desc')}
              </p>
            </div>

            <div className="p-6 bg-slate-900/40 rounded-3xl border border-slate-800">
              <div className="w-10 h-10 rounded-xl bg-slate-800 font-mono font-bold text-emerald-400 flex items-center justify-center mb-4 text-lg">
                02
              </div>
              <h4 className="text-lg font-bold text-white mb-2">{t('marketing.howItWorks.step2Title')}</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                {t('marketing.howItWorks.step2Desc')}
              </p>
            </div>

            <div className="p-6 bg-slate-900/40 rounded-3xl border border-slate-800">
              <div className="w-10 h-10 rounded-xl bg-slate-800 font-mono font-bold text-emerald-400 flex items-center justify-center mb-4 text-lg">
                03
              </div>
              <h4 className="text-lg font-bold text-white mb-2">{t('marketing.howItWorks.step3Title')}</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                {t('marketing.howItWorks.step3Desc')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. ROI / Savings Calculator */}
      <section id="calculator" className="py-20 bg-slate-900/60 border-y border-slate-800/80 px-6">
        <div className="max-w-4xl mx-auto bg-slate-950 border border-slate-800 rounded-3xl p-8 sm:p-12 shadow-2xl relative">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold mb-3">
              <Calculator className="w-3.5 h-3.5" />
              <span>{t('marketing.calc.tag')}</span>
            </div>
            <h3 className="text-2xl sm:text-3xl font-black text-white">
              {t('marketing.calc.heading')}
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 mt-2">
              {t('marketing.calc.subtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div className="space-y-6">
              <div>
                <div className="flex justify-between text-xs font-semibold mb-2">
                  <span className="text-slate-300">{t('marketing.calc.workersLabel')}</span>
                  <span className="text-emerald-400 font-bold font-mono text-sm">{workerCount} {t('marketing.calc.workersUnit')}</span>
                </div>
                <input
                  type="range"
                  min="3"
                  max="100"
                  value={workerCount}
                  onChange={(e) => setWorkerCount(parseInt(e.target.value, 10))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold mb-2">
                  <span className="text-slate-300">{t('marketing.calc.rateLabel')}</span>
                  <span className="text-emerald-400 font-bold font-mono text-sm">{hourlyRate} {t('marketing.calc.rateUnit')}</span>
                </div>
                <input
                  type="range"
                  min="30"
                  max="150"
                  step="5"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(parseInt(e.target.value, 10))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>
            </div>

            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 text-center flex flex-col justify-center items-center">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                {t('marketing.calc.savingsLabel')}
              </span>
              <div className="text-4xl sm:text-5xl font-black text-emerald-400 font-mono mt-2 mb-2" dir="ltr">
                ~ {monthlySavings.toLocaleString()} ₪
              </div>
              <span className="text-[11px] text-slate-400">
                {t('marketing.calc.savingsNote')}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Contact & Sales Form Section */}
      <section id="contact" className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold mb-4">
                <Mail className="w-3.5 h-3.5" />
                <span>{t('marketing.contact.tag')}</span>
              </div>
              <h2 className="text-3xl font-black text-white tracking-tight mb-4">
                {t('marketing.contact.heading')}
              </h2>
              <p className="text-sm text-slate-400 leading-relaxed mb-6">
                {t('marketing.contact.desc')}
              </p>

              <div className="space-y-4 text-xs text-slate-300">
                <div className="flex items-center gap-3">
                  <Building2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{t('marketing.contact.benefit1')}</span>
                </div>
                <div className="flex items-center gap-3">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{t('marketing.contact.benefit2')}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Globe className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{t('marketing.contact.benefit3')}</span>
                </div>
              </div>
            </div>

            {/* Lead Form Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
              {contactSuccess ? (
                <div className="text-center py-8 space-y-4">
                  <div className="w-14 h-14 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-bold text-white">{t('marketing.contact.successTitle')}</h3>
                  <p className="text-xs text-slate-400 max-w-xs mx-auto">
                    {t('marketing.contact.successDesc')}
                  </p>
                  <button
                    onClick={() => setContactSuccess(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded-xl text-slate-300"
                  >
                    {t('marketing.contact.sendAnother')}
                  </button>
                </div>
              ) : (
                <form onSubmit={handleContactSubmit} className="space-y-4">
                  <h3 className="text-lg font-bold text-white mb-2">{t('marketing.contact.formTitle')}</h3>

                  {contactError && (
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                      {contactError}
                    </div>
                  )}

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      {t('marketing.contact.nameLabel')}
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 absolute ltr:left-3 rtl:right-3 top-2.5 text-slate-500" />
                      <input
                        type="text"
                        required
                        value={contactName}
                        onChange={(e) => setContactName(e.target.value)}
                        placeholder={t('marketing.contact.namePlaceholder')}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2 ltr:pl-9 rtl:pr-9 ltr:pr-3 rtl:pl-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      {t('marketing.contact.companyLabel')}
                    </label>
                    <div className="relative">
                      <Building2 className="w-4 h-4 absolute ltr:left-3 rtl:right-3 top-2.5 text-slate-500" />
                      <input
                        type="text"
                        value={contactCompany}
                        onChange={(e) => setContactCompany(e.target.value)}
                        placeholder={t('marketing.contact.companyPlaceholder')}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2 ltr:pl-9 rtl:pr-9 ltr:pr-3 rtl:pl-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        {t('marketing.contact.phoneLabel')}
                      </label>
                      <div className="relative">
                        <Phone className="w-4 h-4 absolute ltr:left-3 rtl:right-3 top-2.5 text-slate-500" />
                        <input
                          type="tel"
                          required
                          value={contactPhone}
                          onChange={(e) => setContactPhone(e.target.value)}
                          placeholder="+972..."
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2 ltr:pl-9 rtl:pr-9 ltr:pr-3 rtl:pl-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition text-start"
                          dir="ltr"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        {t('marketing.contact.emailLabel')}
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 absolute ltr:left-3 rtl:right-3 top-2.5 text-slate-500" />
                        <input
                          type="email"
                          value={contactEmail}
                          onChange={(e) => setContactEmail(e.target.value)}
                          placeholder="info@company.com"
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2 ltr:pl-9 rtl:pr-9 ltr:pr-3 rtl:pl-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition text-start"
                          dir="ltr"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      {t('marketing.contact.commentLabel')}
                    </label>
                    <textarea
                      rows={2}
                      value={contactMessage}
                      onChange={(e) => setContactMessage(e.target.value)}
                      placeholder={t('marketing.contact.commentPlaceholder')}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmittingContact}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 active:scale-95 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg transition flex items-center justify-center gap-2"
                  >
                    <Send className="w-3.5 h-3.5 rtl:rotate-180" />
                    <span>{isSubmittingContact ? t('marketing.contact.submittingBtn') : t('marketing.contact.submitBtn')}</span>
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 7. Footer */}
      <footer className="mt-auto border-t border-slate-800/80 bg-slate-950 px-6 py-8 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2 font-bold text-slate-400">
            <span>{t('marketing.footer.tagline')}</span>
            <span>•</span>
            <span>{t('marketing.footer.rights')} {new Date().getFullYear()}</span>
          </div>

          <div className="flex items-center gap-6">
            <button onClick={() => navigate('/login')} className="hover:text-slate-300 transition">
              {t('marketing.footer.clientLogin')}
            </button>
            <button onClick={() => setIsRegisterModalOpen(true)} className="hover:text-slate-300 transition">
              {t('marketing.footer.trialReg')}
            </button>
          </div>
        </div>
      </footer>

      {/* 8. Self-Registration Modal */}
      <Modal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        title={t('marketing.modal.title')}
      >
        <form onSubmit={handleRegisterSubmit} className="space-y-4">
          <p className="text-xs text-slate-400">
            {t('marketing.modal.subtitle')}
          </p>

          {regError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
              {regError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              {t('marketing.modal.companyLabel')}
            </label>
            <input
              type="text"
              required
              value={regCompanyName}
              onChange={(e) => setRegCompanyName(e.target.value)}
              placeholder={t('marketing.modal.companyPlaceholder')}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              {t('marketing.modal.loginLabel')}
            </label>
            <input
              type="text"
              required
              value={regUsername}
              onChange={(e) => setRegUsername(e.target.value)}
              placeholder={t('marketing.modal.loginPlaceholder')}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              {t('marketing.modal.passLabel')}
            </label>
            <PasswordInput
              required
              minLength={6}
              value={regPassword}
              onChange={(e) => setRegPassword(e.target.value)}
              placeholder="••••••••"
              className="bg-slate-900 border-slate-700"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              {t('marketing.modal.phoneLabel')}
            </label>
            <input
              type="tel"
              value={regPhone}
              onChange={(e) => setRegPhone(e.target.value)}
              placeholder="+972..."
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 text-start"
              dir="ltr"
            />
          </div>

          <div className="pt-2 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsRegisterModalOpen(false)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded-xl text-slate-300"
            >
              {t('marketing.modal.cancel')}
            </button>
            <button
              type="submit"
              disabled={isRegistering}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg transition active:scale-95 disabled:opacity-50"
            >
              {isRegistering ? t('marketing.modal.creatingBtn') : t('marketing.modal.createBtn')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
