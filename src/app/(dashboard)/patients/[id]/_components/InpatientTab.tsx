'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import {
  BedDouble, Activity, Stethoscope, Plus, Loader2, Check,
} from 'lucide-react';
import { floorLabel } from '@/lib/utils';
import { TaskModal } from './modals/TaskModal';
import { DoctorNoteModal } from './modals/DoctorNoteModal';
import { VitalsModal } from './modals/VitalsModal';

// --- Local types --------------------------------------------------------------

interface InpatientTabAdmission {
  id: string;
  admissionDate: string;
  dischargeDate?: string | null;
  dailyRate: number;
  notes?: string | null;
  bed: { bedNumber: string; room: { floor: number; roomNumber: string; type: string } };
}

interface InpatientTask {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  deadline: string;
  createdAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
  assigner: { id: string; name: string; role: string };
  assignee: { id: string; name: string; role: string };
}

interface DoctorNote {
  id: string;
  diagnosis?: string | null;
  treatment?: string | null;
  notes?: string | null;
  createdAt: string;
  doctor: { id: string; name: string; role: string; specialization?: { name: string } | null };
  prescriptions: { id: string; medicineName: string; dosage: string; duration: string; instructions?: string | null }[];
}

interface Vital {
  id: string;
  temperature?: number | null;
  bloodPressureSystolic?: number | null;
  bloodPressureDiastolic?: number | null;
  pulse?: number | null;
  oxygenSaturation?: number | null;
  weight?: number | null;
  notes?: string | null;
  createdAt: string;
  recordedBy?: { name: string; role: string } | null;
}

interface InpatientTabProps {
  activeAdmission: InpatientTabAdmission;
  isDoctor: boolean;
  isNurse: boolean;
  canSeePrices: boolean;
  fmt: (dateStr: string) => string;
  fmtMoney: (amount: number) => string;
}

export function InpatientTab({
  activeAdmission, isDoctor, isNurse, canSeePrices, fmt, fmtMoney,
}: InpatientTabProps) {
  const { data: session } = useSession();

  // Data state
  const [inpatientTasks, setInpatientTasks] = useState<InpatientTask[]>([]);
  const [inpatientNotes, setInpatientNotes] = useState<DoctorNote[]>([]);
  const [vitals, setVitals] = useState<Vital[]>([]);
  const [inpatientLoading, setInpatientLoading] = useState(false);

  // Live cost
  const [currentDays, setCurrentDays] = useState(0);
  const [currentAmount, setCurrentAmount] = useState(0);

  // Modal triggers
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showVitalsModal, setShowVitalsModal] = useState(false);

  // Fetch tasks, notes, vitals
  const fetchInpatientData = useCallback(async () => {
    setInpatientLoading(true);
    try {
      const [tasksRes, notesRes, vitalsRes] = await Promise.all([
        fetch(`/api/admissions/${activeAdmission.id}/tasks`),
        fetch(`/api/admissions/${activeAdmission.id}/doctor-notes`),
        fetch(`/api/admissions/${activeAdmission.id}/vitals`),
      ]);
      if (tasksRes.ok) setInpatientTasks(await tasksRes.json());
      if (notesRes.ok) setInpatientNotes(await notesRes.json());
      if (vitalsRes.ok) setVitals(await vitalsRes.json());
    } finally {
      setInpatientLoading(false);
    }
  }, [activeAdmission.id]);

  useEffect(() => {
    fetchInpatientData();
  }, [fetchInpatientData]);

  // Live cost calculation — interval scoped to this component
  // (only runs while inpatient tab is active, doesn't rerender parent)
  useEffect(() => {
    if (activeAdmission.dischargeDate) return;
    const calc = () => {
      const now = new Date();
      const admDate = new Date(activeAdmission.admissionDate);
      const hours = (now.getTime() - admDate.getTime()) / (1000 * 60 * 60);
      const days = hours <= 12 ? 0 : Math.ceil(hours / 24);
      setCurrentDays(days);
      setCurrentAmount(days * Number(activeAdmission.dailyRate));
    };
    calc();
    const timer = setInterval(calc, 60000);
    return () => clearInterval(timer);
  }, [activeAdmission.id, activeAdmission.admissionDate, activeAdmission.dailyRate, activeAdmission.dischargeDate]);

  const handleCompleteTask = async (taskId: string) => {
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'complete' }),
      });
      await fetchInpatientData();
    } catch { /* ignore */ }
  };

  const handleStartTask = async (taskId: string) => {
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start' }),
      });
      await fetchInpatientData();
    } catch { /* ignore */ }
  };

  return (
    <div className="space-y-6">
      {/* Joriy to'lov kartasi */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Statsionar ma&apos;lumoti</div>
            <div className="text-sm text-slate-700 flex items-center gap-2">
              <BedDouble className="w-4 h-4 text-slate-400" />
              {floorLabel(activeAdmission.bed.room.floor)}, Xona {activeAdmission.bed.room.roomNumber}, Krovat {activeAdmission.bed.bedNumber}
              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{activeAdmission.bed.room.type}</span>
            </div>
            <div className="text-xs text-slate-400 mt-1">Yotgan: {fmt(activeAdmission.admissionDate)}</div>
            {activeAdmission.notes && <div className="text-xs text-slate-500 mt-1">Tashxis: {activeAdmission.notes}</div>}
          </div>
          {canSeePrices && (
            <div className="text-right">
              <div className="text-xs text-slate-500 mb-0.5">Kunlik narx</div>
              <div className="text-base font-semibold text-slate-700">{fmtMoney(Number(activeAdmission.dailyRate))}</div>
            </div>
          )}
        </div>
        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
          <div className="text-sm text-slate-500">
            {currentDays === 0 ? (
              <span className="text-green-600 font-medium">12 soat to&apos;lmagan — bepul</span>
            ) : (
              <span>Yig&apos;ilgan: <strong className="text-slate-800">{currentDays} kun</strong></span>
            )}
          </div>
          {canSeePrices && (
            <div className="text-lg font-bold text-blue-700">{currentDays > 0 ? fmtMoney(currentAmount) : 'Bepul'}</div>
          )}
        </div>
      </div>

      {/* Ukol / Muolaja buyurtmalari */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50">
          <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-500" /> Ukol / Muolaja buyurtmalari
            {inpatientTasks.length > 0 && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{inpatientTasks.length}</span>}
          </h3>
          {isDoctor && (
            <button onClick={() => setShowTaskModal(true)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium">
              <Plus className="w-3.5 h-3.5" /> Yangi buyurtma
            </button>
          )}
        </div>
        {inpatientLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-blue-500" /></div>
        ) : inpatientTasks.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-sm">Buyurtmalar yo&apos;q</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {inpatientTasks.map(task => {
              const statusColors: Record<string, string> = {
                PENDING: 'bg-slate-100 text-slate-600',
                IN_PROGRESS: 'bg-yellow-100 text-yellow-700',
                COMPLETED: 'bg-green-100 text-green-700',
              };
              const statusLabels: Record<string, string> = {
                PENDING: 'Kutilmoqda', IN_PROGRESS: 'Bajarilmoqda', COMPLETED: 'Bajarildi',
              };
              const isMyTask = task.assignee.id === session?.user?.id;
              return (
                <div key={task.id} className="px-5 py-3 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-800">{task.title}</div>
                    {task.description && <div className="text-xs text-slate-500 mt-0.5">{task.description}</div>}
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400">
                      <span>Hamshira: <strong className="text-slate-600">{task.assignee.name}</strong></span>
                      <span>{fmt(task.createdAt)}</span>
                      {task.completedAt && <span className="text-green-600">Bajarildi: {fmt(task.completedAt)}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[task.status] ?? ''}`}>
                      {statusLabels[task.status] ?? task.status}
                    </span>
                    {isMyTask && task.status === 'PENDING' && (
                      <button onClick={() => handleStartTask(task.id)}
                        className="text-xs px-2 py-1 bg-yellow-50 hover:bg-yellow-100 text-yellow-700 rounded-md transition-colors">
                        Boshlash
                      </button>
                    )}
                    {isMyTask && task.status === 'IN_PROGRESS' && (
                      <button onClick={() => handleCompleteTask(task.id)}
                        className="flex items-center gap-1 text-xs px-2 py-1 bg-green-50 hover:bg-green-100 text-green-700 rounded-md transition-colors">
                        <Check className="w-3 h-3" /> Bajarildi
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Vitals — harorat, bosim, puls */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50">
          <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <Activity className="w-4 h-4 text-rose-500" /> Ko&apos;rsatkichlar (Vitals)
            {vitals.length > 0 && <span className="text-xs bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full">{vitals.length}</span>}
          </h3>
          {isNurse && (
            <button onClick={() => setShowVitalsModal(true)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors font-medium">
              <Plus className="w-3.5 h-3.5" /> Kiritish
            </button>
          )}
        </div>
        {vitals.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-sm">Ko&apos;rsatkichlar kiritilmagan</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead><tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-3 py-2 text-left text-slate-500 font-medium">Sana</th>
                <th className="px-3 py-2 text-left text-slate-500 font-medium">T°C</th>
                <th className="px-3 py-2 text-left text-slate-500 font-medium">Bosim</th>
                <th className="px-3 py-2 text-left text-slate-500 font-medium">Puls</th>
                <th className="px-3 py-2 text-left text-slate-500 font-medium">SpO2</th>
                <th className="px-3 py-2 text-left text-slate-500 font-medium">Vazn</th>
                <th className="px-3 py-2 text-left text-slate-500 font-medium">Kim</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {vitals.map(v => (
                  <tr key={v.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 text-slate-500">{fmt(v.createdAt)}</td>
                    <td className="px-3 py-2">
                      {v.temperature != null ? (
                        <span className={`font-medium ${v.temperature >= 37.5 ? 'text-red-600' : v.temperature < 36 ? 'text-blue-600' : 'text-slate-700'}`}>
                          {v.temperature}°C
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      {v.bloodPressureSystolic != null && v.bloodPressureDiastolic != null
                        ? `${v.bloodPressureSystolic}/${v.bloodPressureDiastolic}`
                        : '—'}
                    </td>
                    <td className="px-3 py-2">
                      {v.pulse != null ? (
                        <span className={`font-medium ${v.pulse > 100 || v.pulse < 60 ? 'text-orange-600' : 'text-slate-700'}`}>
                          {v.pulse}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-3 py-2">
                      {v.oxygenSaturation != null ? (
                        <span className={`font-medium ${v.oxygenSaturation < 95 ? 'text-red-600' : 'text-slate-700'}`}>
                          {v.oxygenSaturation}%
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-3 py-2 text-slate-700">{v.weight != null ? `${v.weight} kg` : '—'}</td>
                    <td className="px-3 py-2 text-slate-400">{v.recordedBy?.name ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Doktor kunlik ko'rik qaydlari */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50">
          <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <Stethoscope className="w-4 h-4 text-purple-500" /> Doktor kunlik ko&apos;rik qaydlari
            {inpatientNotes.length > 0 && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">{inpatientNotes.length}</span>}
          </h3>
          {isDoctor && (
            <button onClick={() => setShowNoteModal(true)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors font-medium">
              <Plus className="w-3.5 h-3.5" /> Yangi qayd
            </button>
          )}
        </div>
        {inpatientLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-blue-500" /></div>
        ) : inpatientNotes.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-sm">Ko&apos;rik qaydlari yo&apos;q</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {inpatientNotes.map(note => (
              <div key={note.id} className="px-5 py-4">
                <div className="flex justify-between items-start mb-2">
                  <div className="text-xs text-slate-500">
                    <strong className="text-slate-700">{note.doctor.name}</strong>
                    {note.doctor.specialization && <span className="text-slate-400"> · {note.doctor.specialization.name}</span>}
                  </div>
                  <span className="text-xs text-slate-400">{fmt(note.createdAt)}</span>
                </div>
                {note.diagnosis && (
                  <div className="text-sm mb-1"><span className="text-xs font-semibold text-slate-500 uppercase">Tashxis: </span><span className="text-slate-800">{note.diagnosis}</span></div>
                )}
                {note.treatment && (
                  <div className="text-sm mb-1"><span className="text-xs font-semibold text-slate-500 uppercase">Muolaja: </span><span className="text-slate-800">{note.treatment}</span></div>
                )}
                {note.notes && (
                  <div className="text-sm text-slate-600">{note.notes}</div>
                )}
                {note.prescriptions.length > 0 && (
                  <div className="mt-2 bg-slate-50 rounded-lg px-3 py-2">
                    <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Retsept</div>
                    {note.prescriptions.map(p => (
                      <div key={p.id} className="text-xs text-slate-700">
                        {p.medicineName} — {p.dosage}, {p.duration}
                        {p.instructions && <span className="text-slate-400"> ({p.instructions})</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {showTaskModal && (
        <TaskModal
          admissionId={activeAdmission.id}
          onClose={() => setShowTaskModal(false)}
          onSaved={fetchInpatientData}
        />
      )}
      {showNoteModal && (
        <DoctorNoteModal
          admissionId={activeAdmission.id}
          onClose={() => setShowNoteModal(false)}
          onSaved={fetchInpatientData}
        />
      )}
      {showVitalsModal && (
        <VitalsModal
          admissionId={activeAdmission.id}
          onClose={() => setShowVitalsModal(false)}
          onSaved={fetchInpatientData}
        />
      )}
    </div>
  );
}
