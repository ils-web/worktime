import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { Modal } from '../../components/ui/Modal';
import { PasswordInput } from '../../components/ui/PasswordInput';
import { useAuthStore } from '../../stores/authStore';

export function MarketingPage() {
  const navigate = useNavigate();
  const checkAuth = useAuthStore((state) => state.checkAuth);

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
      setContactError('Пожалуйста, укажите имя и телефон для связи');
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
      setContactError(err.message || 'Ошибка отправки заявки');
    } finally {
      setIsSubmittingContact(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regUsername || !regPassword || !regCompanyName) {
      setRegError('Заполните обязательные поля');
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
      setRegError(err.message || 'Ошибка регистрации');
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-white">
      {/* 1. Navigation Header */}
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur border-b border-slate-800/80 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
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

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
            <a href="#features" className="hover:text-emerald-400 transition">
              Возможности
            </a>
            <a href="#how-it-works" className="hover:text-emerald-400 transition">
              Как это работает
            </a>
            <a href="#calculator" className="hover:text-emerald-400 transition">
              Калькулятор выгоды
            </a>
            <a href="#contact" className="hover:text-emerald-400 transition">
              Контакты
            </a>
          </nav>

          <div className="flex items-center gap-3">
            {savedWorkerEmpId ? (
              <button
                onClick={() => navigate(`/w/${savedWorkerEmpId}`)}
                className="px-3.5 py-1.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-xl font-bold text-xs hover:bg-emerald-500/30 transition flex items-center gap-1.5"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Моя смена</span>
              </button>
            ) : (
              <button
                onClick={() => navigate('/worker')}
                className="hidden sm:flex px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 rounded-xl font-medium text-xs transition items-center gap-1.5"
              >
                <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                <span>Сотрудник</span>
              </button>
            )}
            <button
              onClick={() => navigate('/login')}
              className="px-4 py-2 text-sm font-semibold text-slate-300 hover:text-white transition"
            >
              Войти
            </button>
            <button
              onClick={() => setIsRegisterModalOpen(true)}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-emerald-600/25 transition active:scale-95"
            >
              Начать бесплатно
            </button>
          </div>
        </div>
      </header>

      {/* Saved Worker Quick Notification Banner */}
      {savedWorkerEmpId && (
        <div className="bg-emerald-950/80 border-b border-emerald-600/40 px-6 py-2.5 text-xs text-emerald-200 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-emerald-400" />
            <span>Вы сохранены как сотрудник на этом устройстве</span>
          </div>
          <button
            onClick={() => navigate(`/w/${savedWorkerEmpId}`)}
            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold rounded-lg text-xs transition"
          >
            Перейти к сменам →
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
            <span>Новое поколение учёта полевых сотрудников</span>
          </div>

          <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight text-white leading-[1.1] mb-8">
            Учёт рабочего времени по <span className="text-emerald-400">GPS-геозоне</span> без накруток
          </h1>

          <p className="text-lg sm:text-xl text-slate-400 max-w-3xl mx-auto mb-10 leading-relaxed font-normal">
            Идеально для стройки, клининга, монтажа и охраны. Сотрудники отмечаются в 1 клик со своего телефона без логинов и паролей. Система проверяет точные координаты объекта, учитывает ночные смены, обед и формирует готовые PDF-табели для бухгалтерии.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <button
              onClick={() => setIsRegisterModalOpen(true)}
              className="w-full sm:w-auto px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-base rounded-2xl shadow-xl shadow-emerald-500/25 flex items-center justify-center gap-2 transition active:scale-95 group"
            >
              <span>Попробовать 14 дней бесплатно</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition transform" />
            </button>
            <a
              href="#contact"
              className="w-full sm:w-auto px-8 py-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-base rounded-2xl border border-slate-700/80 transition"
            >
              Заказать презентацию
            </a>
          </div>

          {/* Key Advantages Badges */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto pt-6 border-t border-slate-800/80 text-left">
            <div className="flex items-center gap-3 p-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center flex-shrink-0">
                <Check className="w-4 h-4 stroke-[3]" />
              </div>
              <span className="text-xs font-semibold text-slate-300">Точность геозоны до 10 метров</span>
            </div>
            <div className="flex items-center gap-3 p-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center flex-shrink-0">
                <Check className="w-4 h-4 stroke-[3]" />
              </div>
              <span className="text-xs font-semibold text-slate-300">Офлайн-режим на IndexedDB</span>
            </div>
            <div className="flex items-center gap-3 p-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center flex-shrink-0">
                <Check className="w-4 h-4 stroke-[3]" />
              </div>
              <span className="text-xs font-semibold text-slate-300">Вход по QR без паролей</span>
            </div>
            <div className="flex items-center gap-3 p-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center flex-shrink-0">
                <Check className="w-4 h-4 stroke-[3]" />
              </div>
              <span className="text-xs font-semibold text-slate-300">Табели в PDF/CSV за 1 клик</span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Features Section */}
      <section id="features" className="py-20 bg-slate-900/40 border-y border-slate-800/80 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-2">
              Возможности системы
            </h2>
            <p className="text-3xl sm:text-4xl font-black tracking-tight text-white">
              Всё, что нужно для полного контроля выездного персонала
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-8 relative hover:border-slate-700 transition">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-6">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Защита от накруток по GPS</h3>
              <p className="text-sm text-slate-400 leading-relaxed mb-4">
                Настройте объект на интерактивной карте и задайте радиус. Работник физически не сможет нажать «Вход», пока не окажется на объекте. Функция строгого контроля (strict GPS) отслеживает попытки покинуть зону во время смены.
              </p>
              <ul className="space-y-2 text-xs text-slate-300">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Формула Haversine высокой точности</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Выход разрешен из любой точки</span>
                </li>
              </ul>
            </div>

            {/* Feature 2 */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-8 relative hover:border-slate-700 transition">
              <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-6">
                <Smartphone className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">PWA-приложение без паролей</h3>
              <p className="text-sm text-slate-400 leading-relaxed mb-4">
                Сотрудникам не нужно устанавливать тяжелые приложения из App Store или запоминать пароли. Достаточно отсканировать персональный QR-код или перейти по ссылке из мессенджера.
              </p>
              <ul className="space-y-2 text-xs text-slate-300">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-indigo-400" />
                  <span>Офлайн-накопление отметок в подвалах</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-indigo-400" />
                  <span>4 языка (RU, עברית, العربية, EN) с RTL</span>
                </li>
              </ul>
            </div>

            {/* Feature 3 */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-8 relative hover:border-slate-700 transition">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-6">
                <FileSpreadsheet className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Автоматические табели и расчёт</h3>
              <p className="text-sm text-slate-400 leading-relaxed mb-4">
                Автоматический поминутный расчет ночных часов (окно 22:00-06:00 с переходом через полночь), субботних часов, овертайма (свыше 9 часов в день) и автоматический вычет 30 мин на обед.
              </p>
              <ul className="space-y-2 text-xs text-slate-300">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-amber-400" />
                  <span>Экспорт в PDF и Excel/CSV за секунду</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-amber-400" />
                  <span>Брендирование отчетов логотипом вашей фирмы</span>
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
              Простота внедрения
            </h2>
            <p className="text-3xl sm:text-4xl font-black tracking-tight text-white">
              Запуск системы за 3 простых шага
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 bg-slate-900/40 rounded-3xl border border-slate-800">
              <div className="w-10 h-10 rounded-xl bg-slate-800 font-mono font-bold text-emerald-400 flex items-center justify-center mb-4 text-lg">
                01
              </div>
              <h4 className="text-lg font-bold text-white mb-2">Создайте объект на карте</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Откройте интерактивную карту в личном кабинете, выберите адрес и установите радиус геозоны ползунком.
              </p>
            </div>

            <div className="p-6 bg-slate-900/40 rounded-3xl border border-slate-800">
              <div className="w-10 h-10 rounded-xl bg-slate-800 font-mono font-bold text-emerald-400 flex items-center justify-center mb-4 text-lg">
                02
              </div>
              <h4 className="text-lg font-bold text-white mb-2">Отправьте QR работнику</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Сгенерируйте QR-код в карточке сотрудника и отправьте ссылку в WhatsApp или распечатайте на объекте.
              </p>
            </div>

            <div className="p-6 bg-slate-900/40 rounded-3xl border border-slate-800">
              <div className="w-10 h-10 rounded-xl bg-slate-800 font-mono font-bold text-emerald-400 flex items-center justify-center mb-4 text-lg">
                03
              </div>
              <h4 className="text-lg font-bold text-white mb-2">Получайте готовые отчёты</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Работники нажимают Вход/Выход, а система формирует сводки, выявляет опоздания и готовит документы к выплате зарплаты.
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
              <span>Калькулятор окупаемости</span>
            </div>
            <h3 className="text-2xl sm:text-3xl font-black text-white">
              Сколько денег сохранит ваша компания?
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 mt-2">
              По статистике, бумажные табели и «приписки» времени обходятся работодателю минимум в 3.5 часа на человека в неделю.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div className="space-y-6">
              <div>
                <div className="flex justify-between text-xs font-semibold mb-2">
                  <span className="text-slate-300">Количество сотрудников:</span>
                  <span className="text-emerald-400 font-bold font-mono text-sm">{workerCount} чел.</span>
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
                  <span className="text-slate-300">Средняя ставка за час:</span>
                  <span className="text-emerald-400 font-bold font-mono text-sm">{hourlyRate} ₪ / час</span>
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
                Ориентировочная экономия в месяц
              </span>
              <div className="text-4xl sm:text-5xl font-black text-emerald-400 font-mono mt-2 mb-2">
                ~ {monthlySavings.toLocaleString()} ₪
              </div>
              <span className="text-[11px] text-slate-400">
                Окупает стоимость подписки на TimeTracker в десятки раз уже в первый месяц.
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
                <span>Свяжитесь с нами</span>
              </div>
              <h2 className="text-3xl font-black text-white tracking-tight mb-4">
                Готовы навести порядок в учёте часов?
              </h2>
              <p className="text-sm text-slate-400 leading-relaxed mb-6">
                Оставьте заявку, и наш специалист свяжется с вами, чтобы провести демонстрацию системы на ваших реальных объектах и помочь с подключением.
              </p>

              <div className="space-y-4 text-xs text-slate-300">
                <div className="flex items-center gap-3">
                  <Building2 className="w-4 h-4 text-emerald-400" />
                  <span>Быстрый запуск за 1 день без интеграторов</span>
                </div>
                <div className="flex items-center gap-3">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>14 дней бесплатного пробного периода с полным функционалом</span>
                </div>
                <div className="flex items-center gap-3">
                  <Globe className="w-4 h-4 text-emerald-400" />
                  <span>Поддержка компаний в Израиле и по всему миру</span>
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
                  <h3 className="text-lg font-bold text-white">Заявка успешно отправлена!</h3>
                  <p className="text-xs text-slate-400 max-w-xs mx-auto">
                    Спасибо за обращение. Мы перезвоним вам в течение рабочего дня.
                  </p>
                  <button
                    onClick={() => setContactSuccess(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded-xl text-slate-300"
                  >
                    Отправить ещё одну заявку
                  </button>
                </div>
              ) : (
                <form onSubmit={handleContactSubmit} className="space-y-4">
                  <h3 className="text-lg font-bold text-white mb-2">Заказать консультацию</h3>

                  {contactError && (
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                      {contactError}
                    </div>
                  )}

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Ваше имя *
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                      <input
                        type="text"
                        required
                        value={contactName}
                        onChange={(e) => setContactName(e.target.value)}
                        placeholder="Алексей"
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Компания / Сфера деятельности
                    </label>
                    <div className="relative">
                      <Building2 className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                      <input
                        type="text"
                        value={contactCompany}
                        onChange={(e) => setContactCompany(e.target.value)}
                        placeholder="Строительная компания 'Олимп'"
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        Телефон *
                      </label>
                      <div className="relative">
                        <Phone className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                        <input
                          type="tel"
                          required
                          value={contactPhone}
                          onChange={(e) => setContactPhone(e.target.value)}
                          placeholder="+972 / +7"
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        Email
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                        <input
                          type="email"
                          value={contactEmail}
                          onChange={(e) => setContactEmail(e.target.value)}
                          placeholder="info@company.com"
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Комментарий
                    </label>
                    <textarea
                      rows={2}
                      value={contactMessage}
                      onChange={(e) => setContactMessage(e.target.value)}
                      placeholder="Сколько у вас объектов и сотрудников?"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmittingContact}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 active:scale-95 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg transition flex items-center justify-center gap-2"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isSubmittingContact ? 'Отправка...' : 'Отправить заявку'}</span>
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
            <span>TimeTracker SaaS v2.0</span>
            <span>•</span>
            <span>Все права защищены © {new Date().getFullYear()}</span>
          </div>

          <div className="flex items-center gap-6">
            <button onClick={() => navigate('/login')} className="hover:text-slate-300 transition">
              Вход для клиентов
            </button>
            <button onClick={() => setIsRegisterModalOpen(true)} className="hover:text-slate-300 transition">
              Регистрация триала
            </button>
          </div>
        </div>
      </footer>

      {/* 8. Self-Registration Modal */}
      <Modal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        title="Начать 14 дней бесплатно"
      >
        <form onSubmit={handleRegisterSubmit} className="space-y-4">
          <p className="text-xs text-slate-400">
            Заполните данные для создания аккаунта компании. Кредитная карта не требуется.
          </p>

          {regError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
              {regError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Название компании / ИП *
            </label>
            <input
              type="text"
              required
              value={regCompanyName}
              onChange={(e) => setRegCompanyName(e.target.value)}
              placeholder="OOO СтройМонтаж"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Логин для входа в панель *
            </label>
            <input
              type="text"
              required
              value={regUsername}
              onChange={(e) => setRegUsername(e.target.value)}
              placeholder="company_admin"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Пароль (от 6 символов) *
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
              Контактный телефон
            </label>
            <input
              type="tel"
              value={regPhone}
              onChange={(e) => setRegPhone(e.target.value)}
              placeholder="+972..."
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="pt-2 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsRegisterModalOpen(false)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded-xl text-slate-300"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={isRegistering}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg transition active:scale-95 disabled:opacity-50"
            >
              {isRegistering ? 'Создание...' : 'Создать аккаунт'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
