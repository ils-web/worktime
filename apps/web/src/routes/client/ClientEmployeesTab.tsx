import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { apiRequest } from '../../lib/api';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { MapPicker } from '../../components/MapPicker';
import {
  Plus,
  QrCode,
  Smartphone,
  Trash2,
  Copy,
  Check,
  Search,
  Loader2,
  LogOut,
  MapPin,
} from 'lucide-react';

interface ClientEmployeesTabProps {
  userRole?: string;
}

export function ClientEmployeesTab({ userRole }: ClientEmployeesTabProps) {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [qrEmployee, setQrEmployee] = useState<any | null>(null);
  const [copied, setCopied] = useState(false);

  // Form state
  const [form, setForm] = useState({
    empId: '',
    name: '',
    isMobile: false,
    strictGps: false,
    foremanId: '',
    geofenceLat: 32.0853,
    geofenceLng: 34.7818,
    geofenceRadius: 100,
    geofenceAddress: '',
  });

  // Queries
  const { data: empData, isLoading } = useQuery({
    queryKey: ['client-employees'],
    queryFn: () => apiRequest<{ employees: any[] }>('/api/client/employees'),
  });

  const { data: foremenData } = useQuery({
    queryKey: ['client-foremen'],
    queryFn: () => apiRequest<{ foremen: any[] }>('/api/client/foremen'),
    enabled: userRole === 'client',
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (body: any) =>
      apiRequest('/api/client/employees', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-employees'] });
      setIsCreateOpen(false);
      setForm({
        empId: '',
        name: '',
        isMobile: false,
        strictGps: false,
        foremanId: '',
        geofenceLat: 32.0853,
        geofenceLng: 34.7818,
        geofenceRadius: 100,
        geofenceAddress: '',
      });
    },
  });

  const toggleMobileMutation = useMutation({
    mutationFn: (empId: string) =>
      apiRequest(`/api/client/employees/${empId}/mobile`, { method: 'PATCH' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['client-employees'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (empId: string) =>
      apiRequest(`/api/client/employees/${empId}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['client-employees'] }),
  });

  const forceExitMutation = useMutation({
    mutationFn: (empDbId: number) =>
      apiRequest(`/api/client/employees/${empDbId}/force-exit`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['client-employees'] }),
  });

  const employees = empData?.employees || [];
  const foremen = foremenData?.foremen || [];

  const filteredEmployees = employees.filter(
    (e) =>
      e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.empId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const copyQrLink = (empId: string) => {
    const url = `${window.location.origin}/w/${empId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Сотрудники компании</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Управление персоналом, геозонами объектов и ссылками для входа
          </p>
        </div>

        {userRole === 'client' && (
          <button
            onClick={() => {
              const randomEmpId = `E${Math.floor(1000 + Math.random() * 9000)}`;
              setForm((prev) => ({ ...prev, empId: randomEmpId }));
              setIsCreateOpen(true);
            }}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold flex items-center gap-2 transition shadow-lg shadow-emerald-950"
          >
            <Plus className="w-4 h-4" />
            Добавить сотрудника
          </button>
        )}
      </div>

      {/* Search Input */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Поиск по имени или ID..."
          className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      {/* Table */}
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
                  <th className="p-4">Сотрудник</th>
                  <th className="p-4">ID ссылки</th>
                  <th className="p-4">Статус смены</th>
                  <th className="p-4">Режим GPS</th>
                  <th className="p-4">Геозона</th>
                  <th className="p-4">Бригадир</th>
                  <th className="p-4 text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500">
                      Сотрудники не найдены
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-slate-800/40 transition">
                      <td className="p-4 font-semibold text-white">{emp.name}</td>
                      <td className="p-4">
                        <code className="px-2 py-0.5 bg-slate-950 border border-slate-800 rounded text-xs text-emerald-400 font-mono">
                          {emp.empId}
                        </code>
                      </td>
                      <td className="p-4">
                        {emp.isOnShift ? (
                          <Badge variant="emerald" dot>На смене</Badge>
                        ) : (
                          <Badge variant="slate">Не на смене</Badge>
                        )}
                      </td>
                      <td className="p-4">
                        {emp.isMobile ? (
                          <Badge variant="blue">Мобильный</Badge>
                        ) : emp.strictGps ? (
                          <Badge variant="amber">Строгий GPS</Badge>
                        ) : (
                          <Badge variant="slate">Стандартный</Badge>
                        )}
                      </td>
                      <td className="p-4 text-xs text-slate-400">
                        {emp.isMobile ? (
                          <span className="text-slate-500">Везде (без геозоны)</span>
                        ) : emp.geofence ? (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            {emp.geofence.address || `${emp.geofence.radius} м`}
                          </span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="p-4 text-xs text-slate-300">
                        {emp.foreman?.name || '—'}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setQrEmployee(emp)}
                            title="QR-код для подключения смартфона"
                            className="p-1.5 text-slate-400 hover:text-emerald-400 rounded-lg hover:bg-slate-800 transition"
                          >
                            <QrCode className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => toggleMobileMutation.mutate(emp.empId)}
                            title="Переключить мобильный режим"
                            className={`p-1.5 rounded-lg hover:bg-slate-800 transition ${
                              emp.isMobile
                                ? 'text-blue-400 hover:text-slate-400'
                                : 'text-slate-400 hover:text-blue-400'
                            }`}
                          >
                            <Smartphone className="w-4 h-4" />
                          </button>
                          {emp.isOnShift && (
                            <button
                              onClick={() => forceExitMutation.mutate(emp.id)}
                              title="Принудительно закрыть смену"
                              className="p-1.5 text-rose-400 hover:text-rose-300 rounded-lg hover:bg-slate-800 transition"
                            >
                              <LogOut className="w-4 h-4" />
                            </button>
                          )}
                          {userRole === 'client' && (
                            <button
                              onClick={() => deleteMutation.mutate(emp.empId)}
                              title="Удалить сотрудника"
                              className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Create Employee with Geofence Map */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Новый сотрудник"
        maxWidth="max-w-xl"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate({
              empId: form.empId,
              name: form.name,
              isMobile: form.isMobile,
              strictGps: form.strictGps,
              foremanId: form.foremanId || null,
              geofence: form.isMobile
                ? null
                : {
                    lat: form.geofenceLat,
                    lng: form.geofenceLng,
                    radius: form.geofenceRadius,
                    address: form.geofenceAddress || null,
                  },
            });
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                ФИО сотрудника
              </label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm"
                placeholder="Иван Смирнов"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                ID для ссылки (empId)
              </label>
              <input
                type="text"
                required
                value={form.empId}
                onChange={(e) => setForm({ ...form, empId: e.target.value })}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-sm"
                placeholder="E101"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="flex items-center gap-2 p-3 bg-slate-950/60 border border-slate-800 rounded-xl cursor-pointer">
              <input
                type="checkbox"
                checked={form.isMobile}
                onChange={(e) => setForm({ ...form, isMobile: e.target.checked })}
                className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500"
              />
              <span className="text-xs text-white">Мобильный сотрудник (без геозоны)</span>
            </label>

            <label className="flex items-center gap-2 p-3 bg-slate-950/60 border border-slate-800 rounded-xl cursor-pointer">
              <input
                type="checkbox"
                checked={form.strictGps}
                onChange={(e) => setForm({ ...form, strictGps: e.target.checked })}
                className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500"
              />
              <span className="text-xs text-white">Строгий режим (авто-выход при удалении)</span>
            </label>
          </div>

          {foremen.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Назначить бригадира (опционально)
              </label>
              <select
                value={form.foremanId}
                onChange={(e) => setForm({ ...form, foremanId: e.target.value })}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm"
              >
                <option value="">Без бригадира</option>
                {foremen.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Interactive Geofence Map */}
          {!form.isMobile && (
            <div className="space-y-3 pt-2">
              <div className="flex justify-between items-center">
                <label className="block text-xs font-semibold text-slate-300">
                  Геозона объекта (Интерактивная карта)
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Радиус:</span>
                  <input
                    type="number"
                    min="20"
                    max="5000"
                    step="10"
                    value={form.geofenceRadius}
                    onChange={(e) =>
                      setForm({ ...form, geofenceRadius: parseInt(e.target.value) || 100 })
                    }
                    className="w-20 px-2 py-1 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs font-mono"
                  />
                  <span className="text-xs text-slate-400">м</span>
                </div>
              </div>

              <MapPicker
                lat={form.geofenceLat}
                lng={form.geofenceLng}
                radius={form.geofenceRadius}
                onChange={(lat, lng, radius) =>
                  setForm((prev) => ({
                    ...prev,
                    geofenceLat: lat,
                    geofenceLng: lng,
                    geofenceRadius: radius,
                  }))
                }
              />

              <div>
                <input
                  type="text"
                  value={form.geofenceAddress}
                  onChange={(e) => setForm({ ...form, geofenceAddress: e.target.value })}
                  placeholder="Адрес или название объекта (например: Склад №4)"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs"
                />
              </div>
            </div>
          )}

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
              Сохранить
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: QR Code Onboarding */}
      <Modal
        isOpen={!!qrEmployee}
        onClose={() => setQrEmployee(null)}
        title="QR-код для смартфона сотрудника"
      >
        {qrEmployee && (
          <div className="space-y-6 text-center">
            <div className="p-6 bg-white rounded-2xl inline-block mx-auto shadow-xl">
              <QRCodeSVG
                value={`${window.location.origin}/w/${qrEmployee.empId}`}
                size={200}
                level="M"
              />
            </div>

            <div>
              <div className="text-sm font-bold text-white">{qrEmployee.name}</div>
              <div className="text-xs text-slate-400 mt-1">
                Отсканируйте камерой смартфона для открытия PWA-трекера без пароля
              </div>
            </div>

            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between text-xs font-mono text-emerald-400">
              <span className="truncate pr-2">{`${window.location.origin}/w/${qrEmployee.empId}`}</span>
              <button
                onClick={() => copyQrLink(qrEmployee.empId)}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition shrink-0 flex items-center gap-1 text-[11px]"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Скопировано' : 'Копировать'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
