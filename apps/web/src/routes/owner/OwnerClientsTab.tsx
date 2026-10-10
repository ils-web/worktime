import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../lib/api';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { PasswordInput } from '../../components/ui/PasswordInput';
import { Plus, Key, ToggleLeft, ToggleRight, DollarSign, Trash2, Loader2, AlertTriangle, Building2 } from 'lucide-react';
import { DatePicker } from '../../components/ui/DatePicker';
import { formatIsoToDisplayDate } from '@timetracker/shared';

export function OwnerClientsTab() {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [resetClientId, setResetClientId] = useState<string | null>(null);
  const [tariffClientId, setTariffClientId] = useState<any | null>(null);
  const [deleteClient, setDeleteClient] = useState<{ id: string; name: string; username: string; empCount: number } | null>(null);
  const [isCleanupOpen, setIsCleanupOpen] = useState(false);
  const [billingDetailsClient, setBillingDetailsClient] = useState<any | null>(null);

  // Form states
  const [createForm, setCreateForm] = useState({
    username: '',
    password: '',
    name: '',
    tariffMode: 'PER_USER',
    pricePerUser: 10,
    pricePerHour: 2.5,
    trialDays: 14,
  });

  const [newPassword, setNewPassword] = useState('');
  const [tariffForm, setTariffForm] = useState({
    tariffMode: 'PER_USER',
    pricePerUser: 0,
    pricePerHour: 0,
    trialEndsAt: '',
  });

  const [billingDetailsForm, setBillingDetailsForm] = useState({
    legalName: '',
    taxId: '',
    billingAddress: '',
    billingEmail: '',
    billingPhone: '',
    externalCustId: '',
  });

  // Queries
  const { data, isLoading } = useQuery({
    queryKey: ['owner-clients'],
    queryFn: () => apiRequest<{ clients: any[] }>('/api/owner/clients'),
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (body: any) =>
      apiRequest('/api/owner/clients', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owner-clients'] });
      setIsCreateOpen(false);
      setCreateForm({
        username: '',
        password: '',
        name: '',
        tariffMode: 'PER_USER',
        pricePerUser: 10,
        pricePerHour: 2.5,
        trialDays: 14,
      });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/owner/clients/${id}/toggle`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['owner-clients'] }),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: ({ id, pass }: { id: string; pass: string }) =>
      apiRequest(`/api/owner/clients/${id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ newPassword: pass }),
      }),
    onSuccess: () => {
      setResetClientId(null);
      setNewPassword('');
    },
  });

  const updateTariffMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) =>
      apiRequest(`/api/owner/clients/${id}/tariff`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owner-clients'] });
      setTariffClientId(null);
    },
  });

  const updateBillingDetailsMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) =>
      apiRequest(`/api/owner/clients/${id}/billing-details`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owner-clients'] });
      setBillingDetailsClient(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/owner/clients/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owner-clients'] });
      setDeleteClient(null);
    },
  });

  const cleanupTestMutation = useMutation({
    mutationFn: () =>
      apiRequest<{ success: boolean; count: number }>('/api/owner/clients/cleanup-test', {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owner-clients'] });
      setIsCleanupOpen(false);
    },
  });

  const clients = data?.clients || [];
  const testClients = clients.filter(
    (c: any) => c.username.startsWith('testclient_') || c.name.includes('Тестовая')
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Компании-клиенты (Тенанты)</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Управление организациями, тарифами, доступом и триалами
          </p>
        </div>
        <div className="flex items-center gap-3">
          {testClients.length > 0 && (
            <button
              onClick={() => setIsCleanupOpen(true)}
              className="px-3.5 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-sm font-semibold flex items-center gap-2 transition shadow-sm"
              title="Удалить тестовые компании, созданные тестами"
            >
              <Trash2 className="w-4 h-4" />
              <span>Очистить тестовые ({testClients.length})</span>
            </button>
          )}
          <button
            onClick={() => setIsCreateOpen(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold flex items-center gap-2 transition shadow-lg shadow-emerald-950"
          >
            <Plus className="w-4 h-4" />
            Добавить компанию
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/50 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="p-4">Компания</th>
                  <th className="p-4">Логин</th>
                  <th className="p-4">Сотрудники</th>
                  <th className="p-4">Тариф</th>
                  <th className="p-4">Статус</th>
                  <th className="p-4">Триал до</th>
                  <th className="p-4 text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {clients.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500">
                      Клиенты ещё не добавлены
                    </td>
                  </tr>
                ) : (
                  clients.map((c) => {
                    const isTrialActive = c.trialEndsAt && new Date(c.trialEndsAt) > new Date();
                    return (
                      <tr key={c.id} className="hover:bg-slate-800/40 transition">
                        <td className="p-4">
                          <div className="font-semibold text-white">{c.name}</div>
                          {c.legalName && c.legalName !== c.name && (
                            <div className="text-[11px] text-slate-400">{c.legalName}</div>
                          )}
                          {c.taxId ? (
                            <div className="text-[11px] font-mono text-emerald-400 mt-0.5">ח.פ: {c.taxId}</div>
                          ) : (
                            <div className="text-[10px] text-amber-500/80 mt-0.5">Реквизиты не указаны</div>
                          )}
                        </td>
                        <td className="p-4 text-slate-300 font-mono text-xs">{c.username}</td>
                        <td className="p-4 text-slate-300">
                          <span className="font-semibold text-emerald-400">
                            {c._count?.employees || 0}
                          </span>{' '}
                          сотрудников
                        </td>
                        <td className="p-4">
                          <Badge variant="blue">
                            {c.tariffMode === 'PER_USER'
                              ? `₪${c.pricePerUser}/чел`
                              : `₪${c.pricePerHour}/час`}
                          </Badge>
                        </td>
                        <td className="p-4">
                          {c.isActive ? (
                            <Badge variant="emerald" dot>Активен</Badge>
                          ) : (
                            <Badge variant="rose">Заблокирован</Badge>
                          )}
                        </td>
                        <td className="p-4 text-xs">
                          {c.trialEndsAt ? (
                            <span className={isTrialActive ? 'text-emerald-400' : 'text-rose-400'}>
                              {formatIsoToDisplayDate(c.trialEndsAt.slice(0, 10))}
                            </span>
                          ) : (
                            <span className="text-slate-500">Бессрочно</span>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => {
                                setBillingDetailsClient(c);
                                setBillingDetailsForm({
                                  legalName: c.legalName || c.name || '',
                                  taxId: c.taxId || '',
                                  billingAddress: c.billingAddress || '',
                                  billingEmail: c.billingEmail || '',
                                  billingPhone: c.billingPhone || '',
                                  externalCustId: c.externalCustId || '',
                                });
                              }}
                              title="Реквизиты и Налоги (ח.פ / חשבוניות)"
                              className="p-1.5 text-slate-400 hover:text-emerald-400 rounded-lg hover:bg-slate-800 transition"
                            >
                              <Building2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setTariffClientId(c.id);
                                setTariffForm({
                                  tariffMode: c.tariffMode,
                                  pricePerUser: c.pricePerUser,
                                  pricePerHour: c.pricePerHour,
                                  trialEndsAt: c.trialEndsAt
                                    ? new Date(c.trialEndsAt).toISOString().slice(0, 10)
                                    : '',
                                });
                              }}
                              title="Настроить тариф"
                              className="p-1.5 text-slate-400 hover:text-amber-400 rounded-lg hover:bg-slate-800 transition"
                            >
                              <DollarSign className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setResetClientId(c.id)}
                              title="Сбросить пароль"
                              className="p-1.5 text-slate-400 hover:text-blue-400 rounded-lg hover:bg-slate-800 transition"
                            >
                              <Key className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => toggleMutation.mutate(c.id)}
                              title={c.isActive ? 'Заблокировать' : 'Разблокировать'}
                              className={`p-1.5 rounded-lg hover:bg-slate-800 transition ${
                                c.isActive
                                  ? 'text-emerald-400 hover:text-rose-400'
                                  : 'text-rose-400 hover:text-emerald-400'
                              }`}
                            >
                              {c.isActive ? (
                                <ToggleRight className="w-5 h-5" />
                              ) : (
                                <ToggleLeft className="w-5 h-5" />
                              )}
                            </button>
                            <button
                              onClick={() =>
                                setDeleteClient({
                                  id: c.id,
                                  name: c.name,
                                  username: c.username,
                                  empCount: c._count?.employees || 0,
                                })
                              }
                              title="Удалить компанию"
                              className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Create Client */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Новая компания (Клиент)"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate(createForm);
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Название компании</label>
            <input
              type="text"
              required
              value={createForm.name}
              onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm"
              placeholder="ООO Строительные Технологии"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Логин</label>
              <input
                type="text"
                required
                value={createForm.username}
                onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm"
                placeholder="stroyka"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Пароль</label>
              <PasswordInput
                required
                minLength={6}
                value={createForm.password}
                onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                placeholder="••••••••"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Режим тарифа</label>
              <select
                value={createForm.tariffMode}
                onChange={(e) => setCreateForm({ ...createForm, tariffMode: e.target.value })}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm"
              >
                <option value="PER_USER">За сотрудника (человеко-дни)</option>
                <option value="PER_HOUR">За отработанный час</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                {createForm.tariffMode === 'PER_USER' ? 'Цена за чел/день (₪)' : 'Цена за час (₪)'}
              </label>
              <input
                type="number"
                step="0.1"
                value={createForm.tariffMode === 'PER_USER' ? createForm.pricePerUser : createForm.pricePerHour}
                onChange={(e) =>
                  createForm.tariffMode === 'PER_USER'
                    ? setCreateForm({ ...createForm, pricePerUser: parseFloat(e.target.value) || 0 })
                    : setCreateForm({ ...createForm, pricePerHour: parseFloat(e.target.value) || 0 })
                }
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Дней триала</label>
            <input
              type="number"
              value={createForm.trialDays}
              onChange={(e) => setCreateForm({ ...createForm, trialDays: parseInt(e.target.value) || 0 })}
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm"
            />
          </div>
          <div className="flex justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold flex items-center gap-2"
            >
              {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Создать
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Reset Password */}
      <Modal
        isOpen={!!resetClientId}
        onClose={() => setResetClientId(null)}
        title="Сброс пароля клиента"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (resetClientId) {
              resetPasswordMutation.mutate({ id: resetClientId, pass: newPassword });
            }
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Новый пароль</label>
            <PasswordInput
              required
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Минимум 6 символов"
            />
          </div>
          <div className="flex justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={() => setResetClientId(null)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={resetPasswordMutation.isPending}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold flex items-center gap-2"
            >
              {resetPasswordMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Обновить пароль
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Tariff & Trial */}
      <Modal
        isOpen={!!tariffClientId}
        onClose={() => setTariffClientId(null)}
        title="Настройки тарифа и триала"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (tariffClientId) {
              updateTariffMutation.mutate({ id: tariffClientId, body: tariffForm });
            }
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Режим тарифа</label>
            <select
              value={tariffForm.tariffMode}
              onChange={(e) => setTariffForm({ ...tariffForm, tariffMode: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm"
            >
              <option value="PER_USER">PER_USER (За сотрудников)</option>
              <option value="PER_HOUR">PER_HOUR (За часы)</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Цена/чел (₪)</label>
              <input
                type="number"
                step="0.1"
                value={tariffForm.pricePerUser}
                onChange={(e) => setTariffForm({ ...tariffForm, pricePerUser: parseFloat(e.target.value) || 0 })}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Цена/час (₪)</label>
              <input
                type="number"
                step="0.1"
                value={tariffForm.pricePerHour}
                onChange={(e) => setTariffForm({ ...tariffForm, pricePerHour: parseFloat(e.target.value) || 0 })}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Дата окончания триала</label>
            <DatePicker
              value={tariffForm.trialEndsAt}
              onChange={(val) => setTariffForm({ ...tariffForm, trialEndsAt: val })}
              placeholder="ДД/ММ/ГГГГ"
            />
            <span className="text-[11px] text-slate-500 mt-1 block">
              Оставьте пустым для бессрочного доступа
            </span>
          </div>
          <div className="flex justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={() => setTariffClientId(null)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={updateTariffMutation.isPending}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-sm font-semibold flex items-center gap-2"
            >
              {updateTariffMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Сохранить
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Delete Client Confirmation */}
      <Modal
        isOpen={!!deleteClient}
        onClose={() => setDeleteClient(null)}
        title="Удаление компании"
      >
        <div className="space-y-4">
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-sm">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-rose-200">
                  Удалить организацию «{deleteClient?.name}»?
                </p>
                <p className="text-xs text-rose-300/80 mt-1 font-mono">
                  Логин: {deleteClient?.username}
                </p>
                <p className="text-xs text-rose-300/80 mt-2">
                  Это действие необратимо. Будут безвозвратно удалены все связанные сотрудники ({deleteClient?.empCount || 0}), графики смен, отметки времени, заметки и настройки.
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setDeleteClient(null)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm transition"
            >
              Отмена
            </button>
            <button
              type="button"
              disabled={deleteMutation.isPending}
              onClick={() => deleteClient && deleteMutation.mutate(deleteClient.id)}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-sm font-semibold flex items-center gap-2 transition shadow-lg shadow-rose-950"
            >
              {deleteMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Удалить навсегда
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: Cleanup Test Clients */}
      <Modal
        isOpen={isCleanupOpen}
        onClose={() => setIsCleanupOpen(false)}
        title="Очистка тестовых компаний"
      >
        <div className="space-y-4">
          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-sm">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-200">
                  Найдено тестовых компаний: {testClients.length}
                </p>
                <p className="text-xs text-amber-300/80 mt-1.5 leading-relaxed">
                  Будут удалены все организации с логином <code className="bg-slate-900/60 px-1 py-0.5 rounded text-amber-200">testclient_*</code> или именем <code className="bg-slate-900/60 px-1 py-0.5 rounded text-amber-200">«Тестовая Компания»</code>.
                </p>
                <p className="text-xs text-amber-300/80 mt-1.5">
                  Ваши реальные компании останутся в полной сохранности.
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsCleanupOpen(false)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm transition"
            >
              Отмена
            </button>
            <button
              type="button"
              disabled={cleanupTestMutation.isPending}
              onClick={() => cleanupTestMutation.mutate()}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-sm font-semibold flex items-center gap-2 transition shadow-lg shadow-rose-950"
            >
              {cleanupTestMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Очистить все тестовые ({testClients.length})
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: Client Tax & Billing Details (ח.פ / פרטי עסק לחשבוניות) */}
      <Modal
        isOpen={!!billingDetailsClient}
        onClose={() => setBillingDetailsClient(null)}
        title={`Реквизиты и Налоги: ${billingDetailsClient?.name || ''}`}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (billingDetailsClient) {
              updateBillingDetailsMutation.mutate({
                id: billingDetailsClient.id,
                body: billingDetailsForm,
              });
            }
          }}
          className="space-y-4"
        >
          <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl text-xs text-slate-300 leading-relaxed">
            Данные используются для автоматической выписки счетов и квитанций (<strong className="text-emerald-400">חשבונית מס קבלה</strong>) через сервисы электронных счетов в Израиле (Morning / Green Invoice / iCount).
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Юридическое название для счёта (שם העסק לחשבונית)
            </label>
            <input
              type="text"
              value={billingDetailsForm.legalName}
              onChange={(e) => setBillingDetailsForm({ ...billingDetailsForm, legalName: e.target.value })}
              placeholder="например, א.ב. בנייה והנדסה בע״מ"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Налоговый номер компании (ח.פ / עוסק מורשה / ת.ז)
            </label>
            <input
              type="text"
              value={billingDetailsForm.taxId}
              onChange={(e) => setBillingDetailsForm({ ...billingDetailsForm, taxId: e.target.value })}
              placeholder="9 цифр, например 516123456"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500 text-start"
              dir="ltr"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Email бухгалтерии (אימייל הנה״ח)
              </label>
              <input
                type="email"
                value={billingDetailsForm.billingEmail}
                onChange={(e) => setBillingDetailsForm({ ...billingDetailsForm, billingEmail: e.target.value })}
                placeholder="accounting@company.co.il"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 text-start"
                dir="ltr"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Телефон бухгалтерии
              </label>
              <input
                type="tel"
                value={billingDetailsForm.billingPhone}
                onChange={(e) => setBillingDetailsForm({ ...billingDetailsForm, billingPhone: e.target.value })}
                placeholder="050-1234567"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 text-start"
                dir="ltr"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Юридический адрес для счетов (כתובת מלאה)
            </label>
            <input
              type="text"
              value={billingDetailsForm.billingAddress}
              onChange={(e) => setBillingDetailsForm({ ...billingDetailsForm, billingAddress: e.target.value })}
              placeholder="ул. Жаботински 7, Рамат-Ган, 5252007"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              ID клиента в Morning / iCount (External Customer ID)
            </label>
            <input
              type="text"
              value={billingDetailsForm.externalCustId}
              onChange={(e) => setBillingDetailsForm({ ...billingDetailsForm, externalCustId: e.target.value })}
              placeholder="Опционально (привязка к контрагенту в платёжной системе)"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500 text-start"
              dir="ltr"
            />
          </div>

          <div className="pt-2 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setBillingDetailsClient(null)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded-xl text-slate-300 transition"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={updateBillingDetailsMutation.isPending}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg transition active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
            >
              {updateBillingDetailsMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Сохранить реквизиты</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
