"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useLanguage } from "@/hooks/useLanguage";
import {
  Plus,
  Loader2,
  AlertCircle,
  X,
  FlaskConical,
  Pencil,
  Trash2,
  Search,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  fatherName: string;
}

interface LabTestType {
  id: string;
  name: string;
  price: number;
  duration: number | null;
  normalRange: string | null;
}

interface LabTest {
  id: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  result: string | null;
  orderedAt: string;
  patient: Patient;
  testType: LabTestType;
  requestedBy: { firstName: string; lastName: string } | null;
}

type StatusFilter = "ALL" | "PENDING" | "IN_PROGRESS" | "COMPLETED";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function statusBadgeClass(status: string) {
  switch (status) {
    case "PENDING":
      return "bg-slate-100 text-slate-700";
    case "IN_PROGRESS":
      return "bg-yellow-100 text-yellow-700";
    case "COMPLETED":
      return "bg-green-100 text-green-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function nextStatuses(current: string): string[] {
  if (current === "PENDING") return ["PENDING", "IN_PROGRESS"];
  if (current === "IN_PROGRESS") return ["IN_PROGRESS", "COMPLETED"];
  return ["COMPLETED"];
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LabPage() {
  const { t } = useLanguage();
  const { data: session } = useSession();

  const role = session?.user?.role as string | undefined;
  const canManageResults =
    role === "HEAD_LAB_TECH" || role === "LAB_TECH";
  const canManageTypes = role === "ADMIN" || role === "HEAD_LAB_TECH";

  const [activeTab, setActiveTab] = useState<"tests" | "types">("tests");

  // ── Tests state ────────────────────────────────────────────────────────────
  const [tests, setTests] = useState<LabTest[]>([]);
  const [testsLoading, setTestsLoading] = useState(false);
  const [testsError, setTestsError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  // ── Test types state ───────────────────────────────────────────────────────
  const [testTypes, setTestTypes] = useState<LabTestType[]>([]);
  const [typesLoading, setTypesLoading] = useState(false);
  const [typesError, setTypesError] = useState<string | null>(null);

  // ── Order test modal ───────────────────────────────────────────────────────
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [patientSearch, setPatientSearch] = useState("");
  const [patientResults, setPatientResults] = useState<Patient[]>([]);
  const [patientSearching, setPatientSearching] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [selectedTestTypeId, setSelectedTestTypeId] = useState("");
  const [orderSaving, setOrderSaving] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  // ── Result/status modal ────────────────────────────────────────────────────
  const [showResultModal, setShowResultModal] = useState(false);
  const [activeTest, setActiveTest] = useState<LabTest | null>(null);
  const [resultStatus, setResultStatus] = useState<string>("");
  const [resultText, setResultText] = useState("");
  const [resultSaving, setResultSaving] = useState(false);
  const [resultError, setResultError] = useState<string | null>(null);

  // ── Test type modal ────────────────────────────────────────────────────────
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [editingType, setEditingType] = useState<LabTestType | null>(null);
  const [typeName, setTypeName] = useState("");
  const [typePrice, setTypePrice] = useState("");
  const [typeNormalRange, setTypeNormalRange] = useState("");
  const [typeSaving, setTypeSaving] = useState(false);
  const [typeError, setTypeError] = useState<string | null>(null);

  // ─── Data fetchers ─────────────────────────────────────────────────────────

  const fetchTests = useCallback(async () => {
    setTestsLoading(true);
    setTestsError(null);
    try {
      const res = await fetch("/api/lab-tests?page=1&limit=20");
      if (!res.ok) throw new Error(t.common.error);
      const json = await res.json();
      setTests(Array.isArray(json) ? json : json.data ?? []);
    } catch {
      setTestsError(t.common.error);
    } finally {
      setTestsLoading(false);
    }
  }, [t.common.error]);

  const fetchTestTypes = useCallback(async () => {
    setTypesLoading(true);
    setTypesError(null);
    try {
      const res = await fetch("/api/lab-test-types");
      if (!res.ok) throw new Error(t.common.error);
      const json = await res.json();
      setTestTypes(Array.isArray(json) ? json : json.data ?? []);
    } catch {
      setTypesError(t.common.error);
    } finally {
      setTypesLoading(false);
    }
  }, [t.common.error]);

  useEffect(() => {
    fetchTests();
    fetchTestTypes();
  }, [fetchTests, fetchTestTypes]);

  // ─── Patient search (debounced) ────────────────────────────────────────────
  useEffect(() => {
    if (!patientSearch.trim()) {
      setPatientResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setPatientSearching(true);
      try {
        const res = await fetch(
          `/api/patients?search=${encodeURIComponent(patientSearch)}&limit=10`
        );
        if (res.ok) {
          const json = await res.json();
          setPatientResults(Array.isArray(json) ? json : json.data ?? []);
        }
      } finally {
        setPatientSearching(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [patientSearch]);

  // ─── Filtered tests ────────────────────────────────────────────────────────
  const filteredTests =
    statusFilter === "ALL"
      ? tests
      : tests.filter((t) => t.status === statusFilter);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const selectedTestType = testTypes.find((tt) => tt.id === selectedTestTypeId);

  function openOrderModal() {
    setSelectedPatient(null);
    setPatientSearch("");
    setPatientResults([]);
    setSelectedTestTypeId("");
    setOrderError(null);
    setShowOrderModal(true);
  }

  async function handleOrderSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPatient || !selectedTestTypeId) return;
    setOrderSaving(true);
    setOrderError(null);
    try {
      const res = await fetch("/api/lab-tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: selectedPatient.id,
          testTypeId: selectedTestTypeId,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || t.common.error);
      }
      setShowOrderModal(false);
      fetchTests();
    } catch (err) {
      setOrderError(err instanceof Error ? err.message : t.common.error);
    } finally {
      setOrderSaving(false);
    }
  }

  function openResultModal(test: LabTest) {
    setActiveTest(test);
    setResultStatus(test.status);
    setResultText(test.result ?? "");
    setResultError(null);
    setShowResultModal(true);
  }

  async function handleResultSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeTest) return;
    if (resultStatus === "COMPLETED" && !resultText.trim()) {
      setResultError(t.lab.enterResult);
      return;
    }
    setResultSaving(true);
    setResultError(null);
    try {
      const body: Record<string, string> = { status: resultStatus };
      if (resultText.trim()) body.result = resultText.trim();
      const res = await fetch(`/api/lab-tests/${activeTest.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || t.common.error);
      }
      setShowResultModal(false);
      fetchTests();
    } catch (err) {
      setResultError(err instanceof Error ? err.message : t.common.error);
    } finally {
      setResultSaving(false);
    }
  }

  function openAddTypeModal() {
    setEditingType(null);
    setTypeName("");
    setTypePrice("");
    setTypeNormalRange("");
    setTypeError(null);
    setShowTypeModal(true);
  }

  function openEditTypeModal(tt: LabTestType) {
    setEditingType(tt);
    setTypeName(tt.name);
    setTypePrice(String(tt.price));
    setTypeNormalRange(tt.normalRange ?? "");
    setTypeError(null);
    setShowTypeModal(true);
  }

  async function handleTypeSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTypeSaving(true);
    setTypeError(null);
    try {
      const body: Record<string, string | number> = {
        name: typeName.trim(),
        price: Number(typePrice),
      };
      if (typeNormalRange.trim()) body.normalRange = typeNormalRange.trim();

      const url = editingType
        ? `/api/lab-test-types/${editingType.id}`
        : "/api/lab-test-types";
      const method = editingType ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || t.common.error);
      }
      setShowTypeModal(false);
      fetchTestTypes();
    } catch (err) {
      setTypeError(err instanceof Error ? err.message : t.common.error);
    } finally {
      setTypeSaving(false);
    }
  }

  async function handleDeleteType(id: string) {
    if (!confirm(t.common.delete + "?")) return;
    try {
      const res = await fetch(`/api/lab-test-types/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(t.common.error);
      fetchTestTypes();
    } catch {
      setTypesError(t.common.error);
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <FlaskConical className="w-6 h-6 text-blue-600" />
          {t.lab.title}
        </h1>
        {activeTab === "tests" && (
          <button
            onClick={openOrderModal}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            {t.lab.addTest}
          </button>
        )}
        {activeTab === "types" && canManageTypes && (
          <button
            onClick={openAddTypeModal}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            {t.lab.addTestType}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab("tests")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === "tests"
              ? "bg-white text-slate-800 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          {t.lab.tests}
        </button>
        {canManageTypes && (
          <button
            onClick={() => setActiveTab("types")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === "types"
                ? "bg-white text-slate-800 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.lab.testTypes}
          </button>
        )}
      </div>

      {/* ── Tab 1: Tests ── */}
      {activeTab === "tests" && (
        <div>
          {/* Status filter */}
          <div className="flex flex-wrap gap-2 mb-4">
            {(["ALL", "PENDING", "IN_PROGRESS", "COMPLETED"] as const).map(
              (s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    statusFilter === s
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {s === "ALL" ? t.common.all : t.lab.status[s]}
                </button>
              )
            )}
          </div>

          {/* Error */}
          {testsError && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {testsError}
            </div>
          )}

          {/* Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">
                      {t.patients.fio}
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">
                      {t.lab.testType}
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">
                      {t.lab.price}
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">
                      {t.lab.orderedAt}
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">
                      {t.common.status}
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">
                      {t.lab.result}
                    </th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-600">
                      {t.common.actions}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {testsLoading ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-500" />
                      </td>
                    </tr>
                  ) : filteredTests.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="text-center py-12 text-slate-400"
                      >
                        {t.lab.noTests}
                      </td>
                    </tr>
                  ) : (
                    filteredTests.map((test) => (
                      <tr
                        key={test.id}
                        className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                      >
                        <td className="px-4 py-3 font-medium text-slate-800">
                          {test.patient.lastName} {test.patient.firstName}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {test.testType.name}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {test.testType.price.toLocaleString()}{" "}
                          {t.common.sum}
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {new Date(test.orderedAt).toLocaleDateString(
                            "uz-UZ"
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusBadgeClass(test.status)}`}
                          >
                            {t.lab.status[test.status]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500 max-w-[160px] truncate">
                          {test.result
                            ? test.result.length > 40
                              ? test.result.slice(0, 40) + "..."
                              : test.result
                            : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {canManageResults &&
                              test.status !== "COMPLETED" && (
                                <button
                                  onClick={() => openResultModal(test)}
                                  className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-md transition-colors font-medium"
                                >
                                  <Pencil className="w-3 h-3" />
                                  {t.lab.enterResult}
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
        </div>
      )}

      {/* ── Tab 2: Test Types ── */}
      {activeTab === "types" && canManageTypes && (
        <div>
          {typesError && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {typesError}
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">
                      {t.common.name}
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">
                      {t.lab.price}
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">
                      {t.lab.normalRange}
                    </th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-600">
                      {t.common.actions}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {typesLoading ? (
                    <tr>
                      <td colSpan={4} className="text-center py-12">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-500" />
                      </td>
                    </tr>
                  ) : testTypes.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="text-center py-12 text-slate-400"
                      >
                        {t.lab.noTestTypes}
                      </td>
                    </tr>
                  ) : (
                    testTypes.map((tt) => (
                      <tr
                        key={tt.id}
                        className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                      >
                        <td className="px-4 py-3 font-medium text-slate-800">
                          {tt.name}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {tt.price.toLocaleString()} {t.common.sum}
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {tt.normalRange ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => openEditTypeModal(tt)}
                              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                              title={t.common.edit}
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteType(tt.id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                              title={t.common.delete}
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
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          MODAL: Order Test
      ═══════════════════════════════════════════════════════ */}
      {showOrderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-800">
                {t.lab.addTest}
              </h2>
              <button
                onClick={() => setShowOrderModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleOrderSubmit} className="p-6 space-y-4">
              {orderError && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {orderError}
                </div>
              )}

              {/* Patient search */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">
                  {t.lab.selectPatient}{" "}
                  <span className="text-red-500">*</span>
                </label>

                {selectedPatient ? (
                  <div className="flex items-center justify-between border border-slate-200 rounded-lg px-3 py-2 bg-blue-50">
                    <span className="text-sm text-slate-800 font-medium">
                      {selectedPatient.lastName} {selectedPatient.firstName}{" "}
                      {selectedPatient.fatherName}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPatient(null);
                        setPatientSearch("");
                      }}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={patientSearch}
                      onChange={(e) => setPatientSearch(e.target.value)}
                      placeholder={t.common.search + "..."}
                      className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    {patientSearching && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-blue-500" />
                    )}
                    {patientResults.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                        {patientResults.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              setSelectedPatient(p);
                              setPatientSearch("");
                              setPatientResults([]);
                            }}
                            className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0"
                          >
                            {p.lastName} {p.firstName} {p.fatherName}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Test type select */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">
                  {t.lab.selectTestType}{" "}
                  <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedTestTypeId}
                  onChange={(e) => setSelectedTestTypeId(e.target.value)}
                  required
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">{t.lab.selectTestType}</option>
                  {testTypes.map((tt) => (
                    <option key={tt.id} value={tt.id}>
                      {tt.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Auto-show price */}
              {selectedTestType && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm text-slate-700">
                  {t.lab.price}:{" "}
                  <span className="font-semibold">
                    {selectedTestType.price.toLocaleString()} {t.common.sum}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowOrderModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={orderSaving || !selectedPatient}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {orderSaving && (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  )}
                  {t.common.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          MODAL: Enter Result / Update Status
      ═══════════════════════════════════════════════════════ */}
      {showResultModal && activeTest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-800">
                {t.lab.updateStatus}
              </h2>
              <button
                onClick={() => setShowResultModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleResultSubmit} className="p-6 space-y-4">
              {resultError && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {resultError}
                </div>
              )}

              {/* Read-only info */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 space-y-1 text-sm">
                <p>
                  <span className="text-slate-500">{t.patients.fio}: </span>
                  <span className="font-medium text-slate-800">
                    {activeTest.patient.lastName}{" "}
                    {activeTest.patient.firstName}
                  </span>
                </p>
                <p>
                  <span className="text-slate-500">{t.lab.testType}: </span>
                  <span className="font-medium text-slate-800">
                    {activeTest.testType.name}
                  </span>
                </p>
              </div>

              {/* Status select (forward only) */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">
                  {t.common.status}
                </label>
                <select
                  value={resultStatus}
                  onChange={(e) => setResultStatus(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {nextStatuses(activeTest.status).map((s) => (
                    <option key={s} value={s}>
                      {t.lab.status[s as keyof typeof t.lab.status]}
                    </option>
                  ))}
                </select>
              </div>

              {/* Result textarea */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">
                  {t.lab.result}
                  {resultStatus === "COMPLETED" && (
                    <span className="text-red-500"> *</span>
                  )}
                </label>
                <textarea
                  value={resultText}
                  onChange={(e) => setResultText(e.target.value)}
                  rows={4}
                  placeholder={t.lab.enterResult}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowResultModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={resultSaving}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {resultSaving && (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  )}
                  {t.common.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          MODAL: Add / Edit Test Type
      ═══════════════════════════════════════════════════════ */}
      {showTypeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-800">
                {editingType ? t.common.edit : t.lab.addTestType}
              </h2>
              <button
                onClick={() => setShowTypeModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleTypeSubmit} className="p-6 space-y-4">
              {typeError && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {typeError}
                </div>
              )}

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">
                  {t.common.name} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={typeName}
                  onChange={(e) => setTypeName(e.target.value)}
                  required
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">
                  {t.lab.price} <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min={0}
                  value={typePrice}
                  onChange={(e) => setTypePrice(e.target.value)}
                  required
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">
                  {t.lab.normalRange}
                </label>
                <textarea
                  value={typeNormalRange}
                  onChange={(e) => setTypeNormalRange(e.target.value)}
                  rows={3}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTypeModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={typeSaving}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {typeSaving && (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  )}
                  {t.common.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
