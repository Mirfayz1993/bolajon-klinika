'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useLanguage } from '@/hooks/useLanguage';
import { usePermissions } from '@/hooks/usePermissions';
import {
  CheckSquare,
  Clock,
  Plus,
  X,
  AlertCircle,
  Loader2,
  ChevronRight,
  User,
  Calendar,
  CheckCircle2,
  PlayCircle,
  ClipboardList,
  Settings,
  Trash2,
  Send,
} from 'lucide-react';

// --- Types -------------------------------------------------------------------

interface TaskUser {
  id: string;
  name: string;
  role: string;
}

interface TaskAssignee extends TaskUser {
  hasTelegram: boolean;
}

interface Task {
  id: string;
  title: string;
  description?: string | null;
  deadline: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  progressNote?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  seenByAssignee: boolean;
  seenByAssigner: boolean;
  notifiedAt?: string | null;
  telegramMessageId?: number | null;
  createdAt: string;
  assignerId: string;
  assigneeId: string;
  assigner: TaskUser;
  assignee: TaskAssignee;
}

interface TaskPermission {
  id: string;
  assignerId: string;
  targetUserId: string;
  assigner: TaskUser;
  targetUser: TaskUser;
}

interface StaffUser {
  id: string;
  name: string;
  role: string;
}

// --- Constants ---------------------------------------------------------------

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Admin',
  HEAD_DOCTOR: 'Bosh shifokor',
  DOCTOR: 'Shifokor',
  HEAD_NURSE: 'Bosh hamshira',
  NURSE: 'Hamshira',
  HEAD_LAB_TECH: 'Bosh laborant',
  LAB_TECH: 'Laborant',
  RECEPTIONIST: 'Registrator',
  SPEECH_THERAPIST: 'Nutq terapevti',
  MASSAGE_THERAPIST: 'Massajchi',
  SANITARY_WORKER: 'Sanitariya xodimi',
  PHARMACIST: 'Dorixonachi',
};

type ActiveTab = 'my' | 'assigned' | 'all' | 'permissions';

// --- Helper ------------------------------------------------------------------

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('uz-UZ', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function isOverdue(deadline: string): boolean {
  return new Date(deadline) < new Date();
}

// --- Status Badge ------------------------------------------------------------

function StatusBadge({ status }: { status: Task['status'] }) {
  if (status === 'PENDING') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
        <Clock size={11} /> Kutilmoqda
      </span>
    );
  }
  if (status === 'IN_PROGRESS') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
        <PlayCircle size={11} /> Jarayonda
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
      <CheckCircle2 size={11} /> Bajarildi
    </span>
  );
}

// --- Task Card (My Tab) ------------------------------------------------------

function MyTaskCard({
  task,
  userId,
  isAdmin,
  expanded,
  onToggle,
  onStart,
  onComplete,
  completeNote,
  onNoteChange,
  markCompleting,
  canStart,
  canComplete,
}: {
  task: Task;
  userId: string;
  isAdmin: boolean;
  expanded: boolean;
  onToggle: () => void;
  onStart: (id: string) => void;
  onComplete: (id: string) => void;
  completeNote: string;
  onNoteChange: (v: string) => void;
  markCompleting: string | null;
  canStart: boolean;
  canComplete: boolean;
}) {
  const overdue = isOverdue(task.deadline) && task.status !== 'COMPLETED';
  // canAct: o'z vazifasi yoki admin — bu task egaligi tekshiruvi
  const canAct = task.assigneeId === userId || isAdmin;

  return (
    <div className={`bg-white rounded-xl border shadow-sm transition-all ${!task.seenByAssignee && task.assigneeId === userId ? 'border-blue-400 ring-1 ring-blue-200' : 'border-gray-200'}`}>
      <button
        className="w-full text-left px-4 py-3 flex items-start gap-3"
        onClick={onToggle}
      >
        <div className="mt-0.5 flex-shrink-0">
          {task.status === 'PENDING' && <Clock size={18} className="text-red-500" />}
          {task.status === 'IN_PROGRESS' && <PlayCircle size={18} className="text-yellow-500" />}
          {task.status === 'COMPLETED' && <CheckCircle2 size={18} className="text-green-500" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-gray-900 text-sm">{task.title}</span>
            {!task.seenByAssignee && task.assigneeId === userId && (
              <span className="text-xs bg-blue-500 text-white px-1.5 py-0.5 rounded-full">Yangi</span>
            )}
            <StatusBadge status={task.status} />
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
            <span className="flex items-center gap-1">
              <User size={11} />
              {task.assigner.name}
            </span>
            <span className={`flex items-center gap-1 ${overdue ? 'text-red-600 font-medium' : ''}`}>
              <Calendar size={11} />
              {formatDate(task.deadline)}
              {overdue && ' (Muddat o\'tgan)'}
            </span>
          </div>
        </div>
        <ChevronRight size={16} className={`text-gray-400 flex-shrink-0 transition-transform mt-1 ${expanded ? 'rotate-90' : ''}`} />
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3">
          {task.description && (
            <p className="text-sm text-gray-600">{task.description}</p>
          )}

          {task.status === 'COMPLETED' && (
            <div className="space-y-1">
              <div className="text-xs text-gray-500">Tugallandi: {formatDate(task.completedAt)}</div>
              {task.progressNote && (
                <div className="bg-green-50 border border-green-100 rounded-lg p-2 text-sm text-gray-700">
                  <span className="font-medium text-green-700">Izoh: </span>{task.progressNote}
                </div>
              )}
            </div>
          )}

          {task.status === 'PENDING' && canAct && canStart && (
            <button
              onClick={() => onStart(task.id)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              <PlayCircle size={15} />
              Boshlash
            </button>
          )}

          {task.status === 'IN_PROGRESS' && canAct && canComplete && (
            <div className="space-y-2">
              <textarea
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-300"
                rows={2}
                placeholder="Bajarish bo'yicha izoh (ixtiyoriy)..."
                value={completeNote}
                onChange={(e) => onNoteChange(e.target.value)}
              />
              <button
                onClick={() => onComplete(task.id)}
                disabled={markCompleting === task.id}
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-60"
              >
                {markCompleting === task.id ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                Tugatish
              </button>
            </div>
          )}

          {task.status === 'IN_PROGRESS' && task.startedAt && (
            <div className="text-xs text-gray-400">Boshlangan: {formatDate(task.startedAt)}</div>
          )}
        </div>
      )}
    </div>
  );
}

// --- Assigned Task Card ------------------------------------------------------

function AssignedTaskCard({
  task,
  userId,
  isAdmin,
  expanded,
  onToggle,
  onMarkSeenAssigner,
  canNotify,
}: {
  task: Task;
  userId: string;
  isAdmin: boolean;
  expanded: boolean;
  onToggle: () => void;
  onMarkSeenAssigner: (id: string) => void;
  canNotify: boolean;
}) {
  const { t } = useLanguage();
  const overdue = isOverdue(task.deadline) && task.status !== 'COMPLETED';
  const showCompletedAlert = task.status === 'COMPLETED' && !task.seenByAssigner && (task.assignerId === userId || isAdmin);

  return (
    <div className={`bg-white rounded-xl border shadow-sm transition-all ${showCompletedAlert ? 'border-orange-400 ring-1 ring-orange-200' : 'border-gray-200'}`}>
      <button
        className="w-full text-left px-4 py-3 flex items-start gap-3"
        onClick={() => {
          if (showCompletedAlert) onMarkSeenAssigner(task.id);
          onToggle();
        }}
      >
        <div className="mt-0.5 flex-shrink-0">
          {task.status === 'PENDING' && <Clock size={18} className="text-red-500" />}
          {task.status === 'IN_PROGRESS' && <PlayCircle size={18} className="text-yellow-500" />}
          {task.status === 'COMPLETED' && <CheckCircle2 size={18} className="text-green-500" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-gray-900 text-sm">{task.title}</span>
            {showCompletedAlert && (
              <span className="text-xs bg-orange-500 text-white px-1.5 py-0.5 rounded-full">Bajarildi!</span>
            )}
            <StatusBadge status={task.status} />
            {canNotify && (task.assignee.hasTelegram ? (
              task.notifiedAt ? (
                <span title={t.tasks.deliveredViaTelegram} className="inline-flex items-center text-blue-500">
                  <Send className="w-3.5 h-3.5" />
                </span>
              ) : (
                <span title={t.tasks.notDelivered} className="inline-flex items-center text-slate-400">
                  <Send className="w-3.5 h-3.5 opacity-50" />
                </span>
              )
            ) : (
              <span title={t.tasks.assigneeNotLinked} className="inline-flex items-center text-orange-500">
                <AlertCircle className="w-3.5 h-3.5" />
              </span>
            ))}
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
            <span className="flex items-center gap-1">
              <User size={11} />
              Ijrochi: {task.assignee.name}
            </span>
            <span className={`flex items-center gap-1 ${overdue ? 'text-red-600 font-medium' : ''}`}>
              <Calendar size={11} />
              {formatDate(task.deadline)}
              {overdue && ' (Muddat o\'tgan)'}
            </span>
          </div>
        </div>
        <ChevronRight size={16} className={`text-gray-400 flex-shrink-0 transition-transform mt-1 ${expanded ? 'rotate-90' : ''}`} />
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-2">
          {task.description && (
            <p className="text-sm text-gray-600">{task.description}</p>
          )}
          {task.status === 'COMPLETED' && task.completedAt && (
            <div className="text-xs text-gray-500">Tugallandi: {formatDate(task.completedAt)}</div>
          )}
          {task.progressNote && (
            <div className="bg-green-50 border border-green-100 rounded-lg p-2 text-sm text-gray-700">
              <span className="font-medium text-green-700">Ijrochi izohi: </span>{task.progressNote}
            </div>
          )}
          {task.startedAt && (
            <div className="text-xs text-gray-400">Boshlangan: {formatDate(task.startedAt)}</div>
          )}
        </div>
      )}
    </div>
  );
}

// --- New Task Modal -----------------------------------------------------------

function NewTaskModal({
  staff,
  allowedTargets,
  form,
  onFormChange,
  onClose,
  onSave,
  saving,
}: {
  staff: StaffUser[];
  allowedTargets: string[];
  form: { title: string; description: string; deadline: string; assigneeId: string };
  onFormChange: (f: { title: string; description: string; deadline: string; assigneeId: string }) => void;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  const { t } = useLanguage();
  const targets = allowedTargets.length > 0
    ? staff.filter((s) => allowedTargets.includes(s.id))
    : staff;

  // Tanlangan xodim Telegram'ga ulanganligini aniqlash
  // Staff ro'yxati hasTelegram qaytarmaydi, shuning uchun /api/staff/[id] orqali olamiz.
  const [assigneeHasTelegram, setAssigneeHasTelegram] = useState<boolean | null>(null);
  const [checkingTelegram, setCheckingTelegram] = useState(false);

  useEffect(() => {
    if (!form.assigneeId) {
      setAssigneeHasTelegram(null);
      return;
    }
    let cancelled = false;
    setCheckingTelegram(true);
    fetch(`/api/staff/${form.assigneeId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { hasTelegram?: boolean } | null) => {
        if (cancelled) return;
        setAssigneeHasTelegram(data?.hasTelegram ?? false);
      })
      .catch(() => {
        if (!cancelled) setAssigneeHasTelegram(null);
      })
      .finally(() => {
        if (!cancelled) setCheckingTelegram(false);
      });
    return () => {
      cancelled = true;
    };
  }, [form.assigneeId]);

  const showWarning = !!form.assigneeId && !checkingTelegram && assigneeHasTelegram === false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Yangi vazifa</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sarlavha *</label>
            <input
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              placeholder="Vazifa sarlavhasi..."
              value={form.title}
              onChange={(e) => onFormChange({ ...form, title: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tavsif</label>
            <textarea
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
              rows={3}
              placeholder="Qo'shimcha ma'lumot (ixtiyoriy)..."
              value={form.description}
              onChange={(e) => onFormChange({ ...form, description: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Muddat *</label>
            <input
              type="datetime-local"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              value={form.deadline}
              onChange={(e) => onFormChange({ ...form, deadline: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ijrochi *</label>
            <select
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              value={form.assigneeId}
              onChange={(e) => onFormChange({ ...form, assigneeId: e.target.value })}
            >
              <option value="">— Tanlang —</option>
              {targets.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({ROLE_LABELS[s.role] ?? s.role})
                </option>
              ))}
            </select>
            {showWarning && (
              <div className="flex items-center gap-2 mt-2 p-2 rounded-md bg-orange-50 text-orange-700 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{t.tasks.assigneeNotLinkedWarning}</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 px-5 pb-5">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Bekor qilish
          </button>
          <button
            onClick={onSave}
            disabled={saving || !form.title || !form.deadline || !form.assigneeId}
            className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
            Saqlash
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Main Page ---------------------------------------------------------------

export default function TasksPage() {
  const { data: session } = useSession();
  const { t } = useLanguage();
  const { can, isAdmin } = usePermissions();
  const userId = session?.user?.id ?? '';
  const canStartTask = can('/tasks:start');
  const canCompleteTask = can('/tasks:complete');
  const canNotifyTask = can('/tasks:notify');

  const [tasks, setTasks] = useState<Task[]>([]);
  const [permissions, setPermissions] = useState<TaskPermission[]>([]);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>('my');

  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [newTaskForm, setNewTaskForm] = useState({
    title: '',
    description: '',
    deadline: '',
    assigneeId: '',
  });
  const [taskSaving, setTaskSaving] = useState(false);

  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [completeNote, setCompleteNote] = useState('');
  const [markCompleting, setMarkCompleting] = useState<string | null>(null);

  // Permissions form
  const [permAssignerId, setPermAssignerId] = useState('');
  const [permTargetId, setPermTargetId] = useState('');
  const [permSaving, setPermSaving] = useState(false);
  const [permError, setPermError] = useState('');

  const [error, setError] = useState('');

  // Fetch tasks
  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch('/api/tasks');
      if (!res.ok) throw new Error('Xatolik');
      const data = await res.json() as Task[];
      setTasks(data);
    } catch {
      setError("Vazifalarni yuklashda xatolik yuz berdi");
    }
  }, []);

  // Fetch permissions (admin only)
  const fetchPermissions = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const res = await fetch('/api/task-permissions');
      if (!res.ok) return;
      const data = await res.json() as TaskPermission[];
      setPermissions(data);
    } catch {
      // ignore
    }
  }, [isAdmin]);

  // Fetch staff
  const fetchStaff = useCallback(async () => {
    try {
      const res = await fetch('/api/staff');
      if (!res.ok) return;
      const data = await res.json() as StaffUser[];
      setStaff(data);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    async function init() {
      setLoading(true);
      await Promise.all([fetchTasks(), fetchPermissions(), fetchStaff()]);
      setLoading(false);
    }
    if (session) void init();
  }, [session, fetchTasks, fetchPermissions, fetchStaff]);

  // Allowed targets for creating tasks
  const allowedTargets: string[] = isAdmin
    ? staff.map((s) => s.id)
    : permissions.filter((p) => p.assignerId === userId).map((p) => p.targetUserId);

  // Tabs
  const myTasks = tasks.filter((t) => t.assigneeId === userId);
  const assignedTasks = tasks.filter((t) => t.assignerId === userId);
  const allTasks = [...tasks].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Actions
  async function handleStart(id: string) {
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start' }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json() as Task;
      setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
    } catch {
      setError("Vazifani boshlashda xatolik");
    }
  }

  async function handleComplete(id: string) {
    setMarkCompleting(id);
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'complete', progressNote: completeNote }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json() as Task;
      setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
      setCompleteNote('');
      setExpandedTaskId(null);
    } catch {
      setError("Vazifani tugatishda xatolik");
    } finally {
      setMarkCompleting(null);
    }
  }

  async function handleMarkSeenAssigner(id: string) {
    try {
      await fetch(`/api/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'seen_assigner' }),
      });
      setTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, seenByAssigner: true } : t))
      );
    } catch {
      // ignore
    }
  }

  async function handleMarkSeen(id: string) {
    try {
      await fetch(`/api/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'seen' }),
      });
      setTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, seenByAssignee: true } : t))
      );
    } catch {
      // ignore
    }
  }

  async function handleCreateTask() {
    setTaskSaving(true);
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTaskForm.title,
          description: newTaskForm.description || undefined,
          deadline: new Date(newTaskForm.deadline).toISOString(),
          assigneeId: newTaskForm.assigneeId,
        }),
      });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error ?? 'Xatolik');
      }
      const created = await res.json() as Task;
      setTasks((prev) => [created, ...prev]);
      setShowNewTaskModal(false);
      setNewTaskForm({ title: '', description: '', deadline: '', assigneeId: '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Yaratishda xatolik');
    } finally {
      setTaskSaving(false);
    }
  }

  async function handleAddPermission() {
    if (!permAssignerId || !permTargetId) return;
    setPermSaving(true);
    setPermError('');
    try {
      const res = await fetch('/api/task-permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignerId: permAssignerId, targetUserId: permTargetId }),
      });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error ?? 'Xatolik');
      }
      await fetchPermissions();
      setPermAssignerId('');
      setPermTargetId('');
    } catch (err) {
      setPermError(err instanceof Error ? err.message : 'Xatolik');
    } finally {
      setPermSaving(false);
    }
  }

  async function handleDeletePermission(id: string) {
    try {
      await fetch(`/api/task-permissions/${id}`, { method: 'DELETE' });
      setPermissions((prev) => prev.filter((p) => p.id !== id));
    } catch {
      setPermError("O'chirishda xatolik");
    }
  }

  function toggleTask(id: string) {
    if (expandedTaskId === id) {
      setExpandedTaskId(null);
    } else {
      setExpandedTaskId(id);
      setCompleteNote('');
      // Mark seen when expanding a task assigned to me
      const task = tasks.find((t) => t.id === id);
      if (task && task.assigneeId === userId && !task.seenByAssignee) {
        void handleMarkSeen(id);
      }
    }
  }

  const canCreateTask = can('/tasks:create') && (isAdmin || allowedTargets.length > 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 size={32} className="animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-xl">
            <ClipboardList size={24} className="text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Vazifalar</h1>
            <p className="text-sm text-gray-500">Topshiriqlar boshqaruvi</p>
          </div>
        </div>
        {canCreateTask && (
          <button
            onClick={() => setShowNewTaskModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus size={16} />
            Yangi vazifa
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          <AlertCircle size={16} />
          {error}
          <button className="ml-auto" onClick={() => setError('')}><X size={14} /></button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 mb-6 shadow-sm overflow-x-auto">
        {([
          { key: 'my', label: 'Mening vazifalarim', icon: <User size={15} /> },
          { key: 'assigned', label: 'Men berganlar', icon: <CheckSquare size={15} /> },
          ...(isAdmin ? [
            { key: 'all', label: 'Barchasi', icon: <ClipboardList size={15} /> },
            { key: 'permissions', label: 'Ruxsatlar', icon: <Settings size={15} /> },
          ] : []),
        ] as { key: ActiveTab; label: string; icon: React.ReactNode }[]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === tab.key
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {tab.icon}
            {tab.label}
            {tab.key === 'my' && myTasks.filter((t) => !t.seenByAssignee).length > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${activeTab === 'my' ? 'bg-white text-blue-600' : 'bg-blue-500 text-white'}`}>
                {myTasks.filter((t) => !t.seenByAssignee).length}
              </span>
            )}
            {tab.key === 'assigned' && assignedTasks.filter((t) => t.status === 'COMPLETED' && !t.seenByAssigner).length > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${activeTab === 'assigned' ? 'bg-white text-blue-600' : 'bg-orange-500 text-white'}`}>
                {assignedTasks.filter((t) => t.status === 'COMPLETED' && !t.seenByAssigner).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}

      {/* My Tasks */}
      {activeTab === 'my' && (
        <div className="space-y-3">
          {myTasks.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <ClipboardList size={40} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">Sizga biriktirilgan vazifalar yo&apos;q</p>
            </div>
          ) : (
            <>
              {/* Group by status */}
              {(['PENDING', 'IN_PROGRESS', 'COMPLETED'] as Task['status'][]).map((status) => {
                const group = myTasks.filter((t) => t.status === status);
                if (group.length === 0) return null;
                return (
                  <div key={status} className="space-y-2">
                    <div className="flex items-center gap-2 mb-1">
                      <StatusBadge status={status} />
                      <span className="text-xs text-gray-400">{group.length} ta</span>
                    </div>
                    {group.map((task) => (
                      <MyTaskCard
                        key={task.id}
                        task={task}
                        userId={userId}
                        isAdmin={isAdmin}
                        expanded={expandedTaskId === task.id}
                        onToggle={() => toggleTask(task.id)}
                        onStart={handleStart}
                        onComplete={handleComplete}
                        completeNote={completeNote}
                        onNoteChange={setCompleteNote}
                        markCompleting={markCompleting}
                        canStart={canStartTask}
                        canComplete={canCompleteTask}
                      />
                    ))}
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}

      {/* Assigned by me */}
      {activeTab === 'assigned' && (
        <div className="space-y-3">
          {assignedTasks.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <CheckSquare size={40} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">Siz bergan vazifalar yo&apos;q</p>
            </div>
          ) : (
            assignedTasks.map((task) => (
              <AssignedTaskCard
                key={task.id}
                task={task}
                userId={userId}
                isAdmin={isAdmin}
                expanded={expandedTaskId === task.id}
                onToggle={() => toggleTask(task.id)}
                onMarkSeenAssigner={handleMarkSeenAssigner}
                canNotify={canNotifyTask}
              />
            ))
          )}
        </div>
      )}

      {/* All Tasks (admin) */}
      {activeTab === 'all' && isAdmin && (
        <div className="space-y-3">
          {allTasks.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <ClipboardList size={40} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">Hech qanday vazifa yo&apos;q</p>
            </div>
          ) : (
            allTasks.map((task) => (
              <div key={task.id} className="bg-white rounded-xl border border-gray-200 shadow-sm">
                <button
                  className="w-full text-left px-4 py-3 flex items-start gap-3"
                  onClick={() => toggleTask(task.id)}
                >
                  <div className="mt-0.5 flex-shrink-0">
                    {task.status === 'PENDING' && <Clock size={18} className="text-red-500" />}
                    {task.status === 'IN_PROGRESS' && <PlayCircle size={18} className="text-yellow-500" />}
                    {task.status === 'COMPLETED' && <CheckCircle2 size={18} className="text-green-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900 text-sm">{task.title}</span>
                      <StatusBadge status={task.status} />
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                      <span>{task.assigner.name} → {task.assignee.name}</span>
                      <span className={`flex items-center gap-1 ${isOverdue(task.deadline) && task.status !== 'COMPLETED' ? 'text-red-600 font-medium' : ''}`}>
                        <Calendar size={11} />
                        {formatDate(task.deadline)}
                      </span>
                    </div>
                  </div>
                  <ChevronRight size={16} className={`text-gray-400 flex-shrink-0 transition-transform mt-1 ${expandedTaskId === task.id ? 'rotate-90' : ''}`} />
                </button>
                {expandedTaskId === task.id && (
                  <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-2">
                    {task.description && <p className="text-sm text-gray-600">{task.description}</p>}
                    {task.progressNote && (
                      <div className="bg-green-50 border border-green-100 rounded-lg p-2 text-sm text-gray-700">
                        <span className="font-medium text-green-700">Izoh: </span>{task.progressNote}
                      </div>
                    )}
                    <div className="text-xs text-gray-400 space-y-0.5">
                      <div>Yaratilgan: {formatDate(task.createdAt)}</div>
                      {task.startedAt && <div>Boshlangan: {formatDate(task.startedAt)}</div>}
                      {task.completedAt && <div>Tugallangan: {formatDate(task.completedAt)}</div>}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Permissions (admin) */}
      {activeTab === 'permissions' && isAdmin && (
        <div className="space-y-4">
          {/* Add new permission */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <h3 className="font-semibold text-gray-800 text-sm mb-3">Yangi ruxsat qo&apos;shish</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Vazifa beruvchi</label>
                <select
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  value={permAssignerId}
                  onChange={(e) => setPermAssignerId(e.target.value)}
                >
                  <option value="">— Tanlang —</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({ROLE_LABELS[s.role] ?? s.role})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Ijrochi (vazifa oluvchi)</label>
                <select
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  value={permTargetId}
                  onChange={(e) => setPermTargetId(e.target.value)}
                >
                  <option value="">— Tanlang —</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({ROLE_LABELS[s.role] ?? s.role})</option>
                  ))}
                </select>
              </div>
            </div>
            {permError && (
              <p className="mt-2 text-xs text-red-600 flex items-center gap-1">
                <AlertCircle size={12} /> {permError}
              </p>
            )}
            <div className="mt-3">
              <button
                onClick={handleAddPermission}
                disabled={permSaving || !permAssignerId || !permTargetId}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-60"
              >
                {permSaving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Ruxsat qo&apos;shish
              </button>
            </div>
          </div>

          {/* Existing permissions */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="font-semibold text-gray-800 text-sm">Mavjud ruxsatlar ({permissions.length})</h3>
            </div>
            {permissions.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-sm">
                Hech qanday ruxsat yo&apos;q
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {permissions.map((perm) => (
                  <div key={perm.id} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-2 text-sm">
                      <div className="font-medium text-gray-800">{perm.assigner.name}</div>
                      <ChevronRight size={14} className="text-gray-400" />
                      <div className="text-gray-600">{perm.targetUser.name}</div>
                      <span className="text-xs text-gray-400">({ROLE_LABELS[perm.targetUser.role] ?? perm.targetUser.role})</span>
                    </div>
                    <button
                      onClick={() => handleDeletePermission(perm.id)}
                      className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* New Task Modal */}
      {showNewTaskModal && (
        <NewTaskModal
          staff={staff}
          allowedTargets={allowedTargets}
          form={newTaskForm}
          onFormChange={setNewTaskForm}
          onClose={() => {
            setShowNewTaskModal(false);
            setNewTaskForm({ title: '', description: '', deadline: '', assigneeId: '' });
          }}
          onSave={handleCreateTask}
          saving={taskSaving}
        />
      )}
    </div>
  );
}
