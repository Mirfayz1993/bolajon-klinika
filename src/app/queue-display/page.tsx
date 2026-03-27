"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
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

function formatDateTime(date: Date): string {
  const months = [
    "Yanvar",
    "Fevral",
    "Mart",
    "Aprel",
    "May",
    "Iyun",
    "Iyul",
    "Avgust",
    "Sentabr",
    "Oktabr",
    "Noyabr",
    "Dekabr",
  ];
  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${day} ${month} ${year}, ${hours}:${minutes}:${seconds}`;
}

export default function QueueDisplayPage() {
  const { t } = useLanguage();
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [connected, setConnected] = useState(false);

  // Real-time clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // SSE connection with auto-reconnect
  const connectRef = useRef<(() => EventSource) | null>(null);

  const connect = useCallback(() => {
    const eventSource = new EventSource("/api/queue/display");

    eventSource.onopen = () => {
      setConnected(true);
    };

    eventSource.onmessage = (event: MessageEvent) => {
      try {
        const data: QueueItem[] = JSON.parse(event.data as string);
        setQueueItems(data);
      } catch {
        // ignore parse errors
      }
    };

    eventSource.onerror = () => {
      setConnected(false);
      eventSource.close();
      setTimeout(() => connectRef.current?.(), 5000);
    };

    return eventSource;
  }, []);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    const es = connect();
    return () => es.close();
  }, [connect]);

  const calledItems = queueItems.filter((item) => item.status === "CALLED");
  const waitingItems = queueItems.filter((item) => item.status === "WAITING");

  const currentCalled = calledItems[0] ?? null;

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-10 py-5 border-b border-slate-700">
        {/* Chap: Logotip + Klinika nomi */}
        <div className="flex items-center gap-4">
          <Image src="/photo_2026-03-24_20-39-19.jpg" alt="Bolajon Klinikasi" width={56} height={56} className="rounded-xl" />
          <div>
            <p className="text-white text-2xl font-bold tracking-wide">{t.queueDisplay.clinicName}</p>
            <p className="text-slate-400 text-sm">{t.queueDisplay.cmsTitle}</p>
          </div>
        </div>
        {/* O'ng: Sarlavha + Vaqt */}
        <div className="text-right">
          <h1 className="text-white text-3xl font-bold tracking-wide">
            {t.queueDisplay.title.toUpperCase()}
          </h1>
          <p className="text-slate-400 text-lg mt-1">
            {t.queueDisplay.today}: {formatDateTime(currentTime)}
          </p>
          {!connected && (
            <span className="inline-flex items-center gap-1 mt-1 text-xs text-yellow-400">
              <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
              {t.queueDisplay.connecting}
            </span>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 divide-x divide-slate-700">
        {/* Left: Currently called */}
        <div className="w-1/2 p-10 flex flex-col justify-center items-center">
          <h2 className="text-slate-400 text-xl font-semibold uppercase tracking-widest mb-8">
            {t.queueDisplay.called.toUpperCase()}
          </h2>
          {currentCalled ? (
            <div className="bg-blue-600 text-white rounded-2xl p-10 w-full max-w-sm text-center shadow-2xl">
              <div className="text-8xl font-extrabold mb-4">
                {currentCalled.queueNumber}
              </div>
              <div className="text-2xl font-bold uppercase tracking-wide mb-2">
                {currentCalled.appointment.patient.lastName}{" "}
                {currentCalled.appointment.patient.firstName}
              </div>
              <div className="text-blue-200 text-lg">
                {currentCalled.appointment.doctor.name}
              </div>
              <div className="mt-4 text-blue-300 text-sm uppercase tracking-wider">
                {currentCalled.appointment.type}
              </div>
            </div>
          ) : (
            <div className="bg-slate-800 text-slate-500 rounded-2xl p-10 w-full max-w-sm text-center">
              <div className="text-6xl font-bold mb-4">—</div>
              <div className="text-lg">{t.queueDisplay.noCalled}</div>
            </div>
          )}

          {/* Other called items if any */}
          {calledItems.length > 1 && (
            <div className="mt-6 flex flex-wrap gap-3 justify-center">
              {calledItems.slice(1).map((item) => (
                <div
                  key={item.id}
                  className="bg-blue-800 text-white rounded-xl px-5 py-3 text-center"
                >
                  <div className="text-3xl font-bold">{item.queueNumber}</div>
                  <div className="text-sm text-blue-300 mt-1">
                    {item.appointment.patient.lastName}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Waiting queue */}
        <div className="w-1/2 p-10 flex flex-col">
          <h2 className="text-slate-400 text-xl font-semibold uppercase tracking-widest mb-8 text-center">
            {t.queueDisplay.waiting.toUpperCase()}
          </h2>
          {waitingItems.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-slate-600 text-xl">
              {t.queueDisplay.noQueue}
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-4 content-start">
              {waitingItems.map((item) => (
                <div
                  key={item.id}
                  className="bg-slate-700 text-white rounded-xl p-4 flex items-center justify-center aspect-square shadow-md"
                >
                  <span className="text-4xl font-bold">
                    {item.queueNumber}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
