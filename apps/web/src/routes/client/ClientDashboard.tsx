import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../stores/authStore';
import { changeLanguage } from '../../lib/i18n';
import { ClientDashboardTab } from './ClientDashboardTab';
import { ClientEmployeesTab } from './ClientEmployeesTab';
import { ClientForemenTab } from './ClientForemenTab';
import { ClientScheduleTab } from './ClientScheduleTab';
import { ClientHoursTab } from './ClientHoursTab';
import { ClientNotesTab } from './ClientNotesTab';
import { ClientSettingsTab } from './ClientSettingsTab';
import {
  LayoutDashboard,
  Users,
  UserCheck,
  Calendar,
  Clock,
  StickyNote,
  Settings,
  LogOut,
  Globe,
} from 'lucide-react';

export function ClientDashboard() {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'employees' | 'foremen' | 'schedule' | 'hours' | 'notes' | 'settings'
  >('dashboard');

  const { user, checkAuth, logout } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const isForeman = user?.role === 'foreman';

  const navItems = [
    { id: 'dashboard', label: t('admin.dashboard'), icon: LayoutDashboard },
    { id: 'employees', label: t('admin.employees'), icon: Users },
    ...(!isForeman ? [{ id: 'foremen', label: t('admin.foremen'), icon: UserCheck }] : []),
    { id: 'schedule', label: t('admin.schedule'), icon: Calendar },
    { id: 'hours', label: t('admin.hours'), icon: Clock },
    { id: 'notes', label: t('admin.notes'), icon: StickyNote },
    ...(!isForeman ? [{ id: 'settings', label: t('admin.settings'), icon: Settings }] : []),
  ] as const;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur px-6 py-3.5 flex justify-between items-center sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center font-black text-slate-950 text-sm shadow-md shadow-emerald-500/20">
            WT
          </div>
          <div>
            <div className="font-extrabold text-white tracking-tight flex items-center gap-2 text-sm sm:text-base">
              <span>{user?.name || 'TimeTracker'}</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${
                  isForeman
                    ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                }`}
              >
                {isForeman ? t('admin.foreman') : t('admin.manager')}
              </span>
            </div>
            <div className="text-[11px] text-slate-400">TimeTracker v2 Client Portal</div>
          </div>
        </div>

        {/* Right Header Actions: Language Switcher & Logout */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5 bg-slate-800/90 p-1 rounded-xl border border-slate-700/60">
            <Globe className="w-3.5 h-3.5 text-slate-400 ml-1 mr-0.5" />
            {(['ru', 'he', 'en', 'ar'] as const).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => changeLanguage(lang)}
                className={`px-2 py-0.5 text-[11px] font-bold rounded-lg transition ${
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
            type="button"
            onClick={() => logout()}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition border border-slate-700"
          >
            <LogOut className="w-3.5 h-3.5 text-slate-400" />
            <span>{t('admin.logout')}</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3 overflow-x-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id as any)}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 transition whitespace-nowrap ${
                  isActive
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                {item.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="flex-1">
          {activeTab === 'dashboard' && <ClientDashboardTab />}
          {activeTab === 'employees' && <ClientEmployeesTab userRole={user?.role} />}
          {activeTab === 'foremen' && !isForeman && <ClientForemenTab />}
          {activeTab === 'schedule' && <ClientScheduleTab />}
          {activeTab === 'hours' && <ClientHoursTab />}
          {activeTab === 'notes' && <ClientNotesTab />}
          {activeTab === 'settings' && !isForeman && <ClientSettingsTab />}
        </div>
      </div>
    </div>
  );
}

export default ClientDashboard;
