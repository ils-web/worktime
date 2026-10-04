import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../lib/api';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Calculator, FileText, CheckCircle, Clock, Trash2, Plus, Loader2 } from 'lucide-react';

export function OwnerBillingTab() {
  const queryClient = useQueryClient();
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1); // 1st of current month
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));

  const [isCreateInvoiceOpen, setIsCreateInvoiceOpen] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({
    clientId: '',
    periodMonth: new Date().toISOString().slice(0, 7),
    amount: 0,
  });

  // Queries
  const { data: billingData, isLoading: isBillingLoading } = useQuery({
    queryKey: ['owner-billing', startDate, endDate],
    queryFn: () =>
      apiRequest<{ billing: any[] }>(`/api/owner/billing?startDate=${startDate}&endDate=${endDate}`),
  });

  const { data: invoicesData, isLoading: isInvoicesLoading } = useQuery({
    queryKey: ['owner-invoices'],
    queryFn: () => apiRequest<{ invoices: any[] }>('/api/owner/invoices'),
  });

  // Mutations
  const toggleInvoiceMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/owner/invoices/${id}/toggle`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['owner-invoices'] }),
  });

  const deleteInvoiceMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/owner/invoices/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['owner-invoices'] }),
  });

  const createInvoiceMutation = useMutation({
    mutationFn: (body: any) =>
      apiRequest('/api/owner/invoices', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owner-invoices'] });
      setIsCreateInvoiceOpen(false);
    },
  });

  const billingList = billingData?.billing || [];
  const invoicesList = invoicesData?.invoices || [];

  return (
    <div className="space-y-8">
      {/* 1. Billing Calculation Preview */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Calculator className="w-5 h-5 text-emerald-400" />
              Расчёт биллинга за период
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Автоматический расчёт сумм по тарифам клиентов
            </p>
          </div>
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 p-1.5 rounded-xl text-xs">
            <span className="text-slate-400 px-1">Период:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-white"
            />
            <span className="text-slate-500">—</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-white"
            />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          {isBillingLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/50 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    <th className="p-4">Клиент</th>
                    <th className="p-4">Тариф</th>
                    <th className="p-4">Человеко-дни</th>
                    <th className="p-4">Отработано часов</th>
                    <th className="p-4">К оплате</th>
                    <th className="p-4 text-right">Действие</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {billingList.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-slate-500">
                        Нет данных за выбранный период
                      </td>
                    </tr>
                  ) : (
                    billingList.map((b) => (
                      <tr key={b.clientId} className="hover:bg-slate-800/40 transition">
                        <td className="p-4 font-semibold text-white">{b.name}</td>
                        <td className="p-4">
                          <Badge variant="blue">{b.tariffMode}</Badge>
                        </td>
                        <td className="p-4 text-slate-300">
                          {b.tariffMode === 'PER_USER' ? `${b.totalWorkerDays} дн.` : '—'}
                        </td>
                        <td className="p-4 text-slate-300">
                          {b.tariffMode === 'PER_HOUR' ? `${b.totalHours.toFixed(1)} ч.` : '—'}
                        </td>
                        <td className="p-4 font-bold text-emerald-400">
                          ₪{b.totalAmount.toLocaleString()}
                        </td>
                        <td className="p-4 text-right">
                          <button
                            onClick={() => {
                              setInvoiceForm({
                                clientId: b.clientId,
                                periodMonth: startDate.slice(0, 7),
                                amount: b.totalAmount,
                              });
                              setIsCreateInvoiceOpen(true);
                            }}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition"
                          >
                            Сформировать счёт
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* 2. Invoices Management */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-400" />
              Выставленные счета (Invoices)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Учёт платежей и выставление счетов клиентам</p>
          </div>
          <button
            onClick={() => {
              setInvoiceForm({
                clientId: billingList[0]?.clientId || '',
                periodMonth: new Date().toISOString().slice(0, 7),
                amount: 0,
              });
              setIsCreateInvoiceOpen(true);
            }}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <Plus className="w-4 h-4" />
            Выставить вручную
          </button>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          {isInvoicesLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/50 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    <th className="p-4">Клиент</th>
                    <th className="p-4">Период</th>
                    <th className="p-4">Сумма</th>
                    <th className="p-4">Статус</th>
                    <th className="p-4">Дата выставления</th>
                    <th className="p-4 text-right">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {invoicesList.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-slate-500">
                        Счета ещё не выставлялись
                      </td>
                    </tr>
                  ) : (
                    invoicesList.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-800/40 transition">
                        <td className="p-4 font-semibold text-white">{inv.client?.name}</td>
                        <td className="p-4 text-slate-300 font-mono text-xs">{inv.periodMonth}</td>
                        <td className="p-4 font-bold text-white">₪{inv.amount.toLocaleString()}</td>
                        <td className="p-4">
                          {inv.status === 'paid' ? (
                            <Badge variant="emerald" dot>Оплачен</Badge>
                          ) : (
                            <Badge variant="amber">Ожидает оплаты</Badge>
                          )}
                        </td>
                        <td className="p-4 text-xs text-slate-400">
                          {new Date(inv.createdAt).toLocaleDateString()}
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => toggleInvoiceMutation.mutate(inv.id)}
                              title={inv.status === 'paid' ? 'Отметить как неоплачен' : 'Отметить как оплачен'}
                              className={`p-1.5 rounded-lg hover:bg-slate-800 transition ${
                                inv.status === 'paid' ? 'text-emerald-400' : 'text-slate-400 hover:text-emerald-400'
                              }`}
                            >
                              {inv.status === 'paid' ? (
                                <CheckCircle className="w-4 h-4" />
                              ) : (
                                <Clock className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              onClick={() => deleteInvoiceMutation.mutate(inv.id)}
                              title="Удалить счёт"
                              className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Create Invoice */}
      <Modal
        isOpen={isCreateInvoiceOpen}
        onClose={() => setIsCreateInvoiceOpen(false)}
        title="Выставить счёт клиенту"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createInvoiceMutation.mutate(invoiceForm);
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Клиент</label>
            <select
              required
              value={invoiceForm.clientId}
              onChange={(e) => setInvoiceForm({ ...invoiceForm, clientId: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm"
            >
              <option value="">Выберите клиента</option>
              {billingList.map((c) => (
                <option key={c.clientId} value={c.clientId}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Период (YYYY-MM)</label>
              <input
                type="text"
                required
                value={invoiceForm.periodMonth}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, periodMonth: e.target.value })}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm"
                placeholder="2026-10"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Сумма к оплате (₪)</label>
              <input
                type="number"
                step="0.1"
                required
                value={invoiceForm.amount}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, amount: parseFloat(e.target.value) || 0 })}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={() => setIsCreateInvoiceOpen(false)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={createInvoiceMutation.isPending}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold flex items-center gap-2"
            >
              {createInvoiceMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Сохранить счёт
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
