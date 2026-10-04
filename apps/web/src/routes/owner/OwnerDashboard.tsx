import { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { OwnerClientsTab } from './OwnerClientsTab';
import { OwnerBillingTab } from './OwnerBillingTab';
import { OwnerLeadsTab } from './OwnerLeadsTab';
import { OwnerSettingsTab } from './OwnerSettingsTab';
import { Users, Receipt, MessageSquareText, Shield, LogOut } from 'lucide-react';

export function OwnerDashboard() {
  const [activeTab, setActiveTab] = useState<'clients' | 'billing' | 'leads' | 'settings'>('clients');
  const { user, checkAuth, logout } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const navItems = [
    { id: 'clients', label: 'Клиенты', icon: Users },
    { id: 'billing', label: 'Биллинг и Счета', icon: Receipt },
    { id: 'leads', label: 'Заявки с сайта', icon: MessageSquareText },
    { id: 'settings', label: 'Безопасность', icon: Shield },
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
              TimeTracker SaaS
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase tracking-wider">
                Owner Portal
              </span>
            </div>
            <div className="text-[11px] text-slate-400">{user?.name || 'Владелец системы'}</div>
          </div>
        </div>

        <button
          onClick={() => logout()}
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition border border-slate-700"
        >
          <LogOut className="w-3.5 h-3.5 text-slate-400" />
          <span>Выйти</span>
        </button>
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
                onClick={() => setActiveTab(item.id)}
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
          {activeTab === 'clients' && <OwnerClientsTab />}
          {activeTab === 'billing' && <OwnerBillingTab />}
          {activeTab === 'leads' && <OwnerLeadsTab />}
          {activeTab === 'settings' && <OwnerSettingsTab />}
        </div>
      </div>
    </div>
  );
}

export default OwnerDashboard;
