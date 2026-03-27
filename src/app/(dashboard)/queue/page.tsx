"use client";

import { useState, useEffect, useCallback } from "react";
import { useLanguage } from "@/hooks/useLanguage";

interface QueueItem {
  id: string;
  queueNumber: number;
  status: "WAITING" | "CALLED" | "DONE";
  calledAt: string | null;
  createdAt: string;
  appointment: {
    id: string;
    type: string;
    dateTime: string;
    status: string;
    patient: { firstName: string; lastName: string };
    doctor: { name: string };
  };
}

export default function QueuePage() {
  const { t } = useLanguage();
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchQueue = useCallback(async () => {
    try {
      const res = await fetch(`/api/queue?showAll=${showAll}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data: QueueItem[] = await res.json();
      setQueueItems(data);
    } catch {
      // silently fail on polling errors
    } finally {
      setLoading(false);
    }
  }, [showAll]);

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, 10000);
    return () => clearInterval(interval);
  }, [fetchQueue]);

  const handleCall = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/queue/${id}/call`, { method: "PATCH" });
      if (res.ok) await fetchQueue();
    } finally {
      setActionLoading(null);
    }
  };

  const handleDone = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/queue/${id}/done`, { method: "PATCH" });
      if (res.ok) await fetchQueue();
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (status: QueueItem["status"]) => {
    switch (status) {
      case "WAITING":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            {t.queue.waiting}
          </span>
        );
      case "CALLED":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            {t.queue.called}
          </span>
        );
      case "DONE":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            {t.queue.completed}
          </span>
        );
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString("uz-UZ", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">{t.queue.title}</h1>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <span className="text-sm text-slate-600">{t.queue.showAll}</span>
          <div
            onClick={() => setShowAll((v) => !v)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              showAll ? "bg-blue-600" : "bg-slate-300"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                showAll ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </div>
        </label>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-500">
            {t.common.loading}
          </div>
        ) : queueItems.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-slate-500">
            {t.queue.noQueue}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-16">
                    {t.queue.queueNumber}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    {t.queue.patient}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    {t.queue.doctor}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    {t.queue.type}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    {t.queue.time}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    {t.common.status}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    {t.common.actions}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {queueItems.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-bold text-sm">
                        {item.queueNumber}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900 font-medium">
                      {item.appointment.patient.lastName}{" "}
                      {item.appointment.patient.firstName}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {item.appointment.doctor.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {item.appointment.type}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {formatTime(item.appointment.dateTime)}
                    </td>
                    <td className="px-4 py-3">
                      {getStatusBadge(item.status)}
                    </td>
                    <td className="px-4 py-3">
                      {item.status === "WAITING" && (
                        <button
                          onClick={() => handleCall(item.id)}
                          disabled={actionLoading === item.id}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
                        >
                          {actionLoading === item.id
                            ? "..."
                            : t.queue.callNext}
                        </button>
                      )}
                      {item.status === "CALLED" && (
                        <button
                          onClick={() => handleDone(item.id)}
                          disabled={actionLoading === item.id}
                          className="px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
                        >
                          {actionLoading === item.id ? "..." : t.queue.done}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
