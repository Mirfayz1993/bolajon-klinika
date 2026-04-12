"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
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
  Printer,
} from "lucide-react";

// --- Types -------------------------------------------------------------------

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
  unit: string | null;
  category: string | null;
}

interface LabTest {
  id: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  result: string | null;
  createdAt: string;
  notes: string | null;
  patient: Patient;
  testType: LabTestType & { normalRange: string | null; unit: string | null };
  labTech: { id: string; name: string };
}

type StatusFilter = "ALL" | "PENDING" | "IN_PROGRESS" | "COMPLETED";

// --- Helpers -----------------------------------------------------------------

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

// --- Page ---------------------------------------------------------------------

export default function LabPage() {
  const { t } = useLanguage();
  const { data: session } = useSession();
  const router = useRouter();

  const role = session?.user?.role as string | undefined;
  const canManageResults = role === "ADMIN" || role === "HEAD_LAB_TECH" || role === "LAB_TECH";
  const canOrderTest = role === "ADMIN" || role === "HEAD_DOCTOR" || role === "DOCTOR" || role === "RECEPTIONIST";
  const canManageTypes = role === "ADMIN" || role === "HEAD_LAB_TECH";
  const isHeadLabTech = role === "ADMIN" || role === "HEAD_LAB_TECH";

  const [activeTab, setActiveTab] = useState<"tests" | "types" | "reagents">("tests");

  // -- Reagents state ---------------------------------------------------------
  const [reagents, setReagents] = useState<{ id: string; name: string; unit: string; quantity: number; minQuantity: number; expiryDate: string | null; pricePerUnit: number }[]>([]);
  const [reagentsLoading, setReagentsLoading] = useState(false);
  const [showReagentModal, setShowReagentModal] = useState(false);
  const [editingReagent, setEditingReagent] = useState<{ id: string; name: string; unit: string; quantity: number; minQuantity: number; expiryDate: string; pricePerUnit: number } | null>(null);
  const [showKirimModal, setShowKirimModal] = useState(false);
  const [kirimReagent, setKirimReagent] = useState<{ id: string; name: string } | null>(null);
  const [kirimQty, setKirimQty] = useState('');
  const [kirimNote, setKirimNote] = useState('');
  const [reagentForm, setReagentForm] = useState({ name: '', unit: 'ml', quantity: '0', minQuantity: '10', expiryDate: '', pricePerUnit: '0' });
  const [reagentSaving, setReagentSaving] = useState(false);

  // -- Tests state ------------------------------------------------------------
  const [tests, setTests] = useState<LabTest[]>([]);
  const [testsLoading, setTestsLoading] = useState(false);
  const [testsError, setTestsError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  // -- Test types state -------------------------------------------------------
  const [testTypes, setTestTypes] = useState<LabTestType[]>([]);
  const [typesLoading, setTypesLoading] = useState(false);
  const [typesError, setTypesError] = useState<string | null>(null);

  // -- Order test modal -------------------------------------------------------
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [patientSearch, setPatientSearch] = useState("");
  const [patientResults, setPatientResults] = useState<Patient[]>([]);
  const [patientSearching, setPatientSearching] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [selectedTestTypeIds, setSelectedTestTypeIds] = useState<string[]>([]);
  const [openTypeGroups, setOpenTypeGroups] = useState<Set<string>>(new Set());
  const [openOrderGroups, setOpenOrderGroups] = useState<Set<string>>(new Set());
  const [orderSaving, setOrderSaving] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  // -- Result modal -----------------------------------------------------------
  const [showResultModal, setShowResultModal] = useState(false);
  const [activeTest, setActiveTest] = useState<LabTest | null>(null);
  const [resultText, setResultText] = useState("");
  const [resultSaving, setResultSaving] = useState(false);
  const [resultError, setResultError] = useState<string | null>(null);

  // -- Test type modal --------------------------------------------------------
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [editingType, setEditingType] = useState<LabTestType | null>(null);
  const [typeName, setTypeName] = useState("");
  const [typePrice, setTypePrice] = useState("");
  const [typeNormalRange, setTypeNormalRange] = useState("");
  const [typeUnit, setTypeUnit] = useState("");
  const [typeCategory, setTypeCategory] = useState("");
  const [typeSaving, setTypeSaving] = useState(false);
  const [typeError, setTypeError] = useState<string | null>(null);

  // -- Print modal ------------------------------------------------------------
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printTest, setPrintTest] = useState<LabTest | null>(null);

  // --- Data fetchers ---------------------------------------------------------

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

  const fetchReagents = useCallback(async () => {
    setReagentsLoading(true);
    try {
      const res = await fetch('/api/reagents');
      if (res.ok) setReagents(await res.json());
    } finally {
      setReagentsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTests();
    fetchTestTypes();
    fetchReagents();
  }, [fetchTests, fetchTestTypes, fetchReagents]);

  async function saveReagent() {
    setReagentSaving(true);
    try {
      const url = editingReagent ? `/api/reagents/${editingReagent.id}` : '/api/reagents';
      const method = editingReagent ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: reagentForm.name,
          unit: reagentForm.unit,
          quantity: Number(reagentForm.quantity),
          minQuantity: Number(reagentForm.minQuantity),
          expiryDate: reagentForm.expiryDate || null,
          pricePerUnit: Number(reagentForm.pricePerUnit),
        }),
      });
      if (res.ok) {
        setShowReagentModal(false);
        setEditingReagent(null);
        setReagentForm({ name: '', unit: 'ml', quantity: '0', minQuantity: '10', expiryDate: '', pricePerUnit: '0' });
        fetchReagents();
      }
    } finally {
      setReagentSaving(false);
    }
  }

  async function saveKirim() {
    if (!kirimReagent || !kirimQty) return;
    setReagentSaving(true);
    try {
      const res = await fetch(`/api/reagents/${kirimReagent.id}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: Number(kirimQty), note: kirimNote }),
      });
      if (res.ok) {
        setShowKirimModal(false);
        setKirimQty('');
        setKirimNote('');
        fetchReagents();
      }
    } finally {
      setReagentSaving(false);
    }
  }

  function reagentStatus(r: { quantity: number; minQuantity: number; expiryDate: string | null }) {
    const today = new Date();
    if (r.expiryDate && new Date(r.expiryDate) < today) return { label: "Muddati o'tgan", color: 'bg-red-100 text-red-700' };
    if (r.quantity === 0) return { label: 'Tugagan', color: 'bg-red-100 text-red-700' };
    if (r.quantity < r.minQuantity) return { label: 'Kam', color: 'bg-yellow-100 text-yellow-700' };
    return { label: 'Yetarli', color: 'bg-green-100 text-green-700' };
  }

  // --- Patient search (debounced) --------------------------------------------
  useEffect(() => {
    const timer = setTimeout(async () => {
      setPatientSearching(true);
      try {
        const url = patientSearch.trim()
          ? `/api/patients?search=${encodeURIComponent(patientSearch.trim())}&limit=10`
          : `/api/patients?limit=8`;
        const res = await fetch(url);
        if (res.ok) {
          const json = await res.json();
          setPatientResults(Array.isArray(json) ? json : json.data ?? []);
        }
      } finally {
        setPatientSearching(false);
      }
    }, patientSearch.trim() ? 350 : 0);
    return () => clearTimeout(timer);
  }, [patientSearch, showOrderModal]);

  // --- Filtered tests --------------------------------------------------------
  const filteredTests =
    statusFilter === "ALL"
      ? tests
      : tests.filter((t) => t.status === statusFilter);

  // --- Handlers -------------------------------------------------------------

  function openOrderModal() {
    setSelectedPatient(null);
    setPatientSearch("");
    setPatientResults([]);
    setSelectedTestTypeIds([]);
    setOpenOrderGroups(new Set());
    setOrderError(null);
    setShowOrderModal(true);
  }

  function toggleOrderTestType(id: string) {
    setSelectedTestTypeIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  function toggleOrderGroup(cat: string) {
    setOpenOrderGroups(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  }

  function toggleTypeGroup(cat: string) {
    setOpenTypeGroups(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  }

  async function handleOrderSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPatient || selectedTestTypeIds.length === 0) return;
    setOrderSaving(true);
    setOrderError(null);
    try {
      const results = await Promise.all(
        selectedTestTypeIds.map(id =>
          fetch("/api/lab-tests", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ patientId: selectedPatient.id, testTypeId: id }),
          })
        )
      );
      const failed = results.filter(r => !r.ok);
      if (failed.length > 0) throw new Error(t.common.error);
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
    setResultText(test.result ?? "");
    setResultError(null);
    setShowResultModal(true);
  }

  async function handleResultSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeTest || !resultText.trim()) {
      setResultError("Natija majburiy");
      return;
    }
    setResultSaving(true);
    setResultError(null);
    try {
      const res = await fetch(`/api/lab-tests/${activeTest.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ result: resultText.trim() }),
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
    setTypeUnit("");
    setTypeCategory("");
    setTypeError(null);
    setShowTypeModal(true);
  }

  function openEditTypeModal(tt: LabTestType) {
    setEditingType(tt);
    setTypeName(tt.name);
    setTypePrice(String(tt.price));
    setTypeNormalRange(tt.normalRange ?? "");
    setTypeUnit(tt.unit ?? "");
    setTypeCategory(tt.category ?? "");
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
      if (typeUnit.trim()) body.unit = typeUnit.trim();
      if (typeCategory.trim()) body.category = typeCategory.trim();

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

  function openPrintModal(test: LabTest) {
    setPrintTest(test);
    setShowPrintModal(true);
  }

  // --- Render ----------------------------------------------------------------

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <FlaskConical className="w-6 h-6 text-blue-600" />
          {t.lab.title}
        </h1>
        {activeTab === "tests" && canOrderTest && (
          <button
            onClick={openOrderModal}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Tahlil buyurtma
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
        <button
          onClick={() => setActiveTab("reagents")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === "reagents"
              ? "bg-white text-slate-800 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Reaktivlar
        </button>
      </div>

      {/* -- Tab 1: Tests -- */}
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
                      Buyurtma sanasi
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
                          {new Date(test.createdAt).toLocaleDateString("uz-UZ")}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusBadgeClass(test.status)}`}>
                            {t.lab.status[test.status]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500 max-w-[160px] truncate">
                          {test.result ? (test.result.length > 40 ? test.result.slice(0, 40) + "..." : test.result) : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {canManageResults && test.status !== "COMPLETED" && (
                              <button
                                onClick={() => openResultModal(test)}
                                className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-md transition-colors font-medium"
                              >
                                <Pencil className="w-3 h-3" />
                                Natija kiriting
                              </button>
                            )}
                            {test.status === "COMPLETED" && isHeadLabTech && (
                              <button
                                onClick={() => openResultModal(test)}
                                className="flex items-center gap-1 px-2 py-1 text-xs bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-md transition-colors font-medium"
                              >
                                <Pencil className="w-3 h-3" />
                                O&apos;zgartirish
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

      {/* -- Tab 2: Test Types (Accordion by category) -- */}
      {activeTab === "types" && canManageTypes && (
        <div>
          {typesError && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {typesError}
            </div>
          )}

          {typesLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            </div>
          ) : testTypes.length === 0 ? (
            <div className="text-center py-12 text-slate-400">{t.lab.noTestTypes}</div>
          ) : (
            <div className="space-y-2">
              {(() => {
                const groups: Record<string, LabTestType[]> = {};
                for (const tt of testTypes) {
                  const cat = tt.category ?? 'Boshqalar';
                  if (!groups[cat]) groups[cat] = [];
                  groups[cat].push(tt);
                }
                return Object.entries(groups).map(([cat, items]) => {
                  const isOpen = openTypeGroups.has(cat);
                  return (
                    <div key={cat} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => toggleTypeGroup(cat)}
                        className="w-full flex items-center justify-between px-5 py-3.5 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-slate-800 text-sm uppercase tracking-wide">{cat}</span>
                          <span className="text-xs text-slate-400 font-normal">{items.length} ta tahlil</span>
                        </div>
                        <svg className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                      </button>
                      {isOpen && (
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-slate-100">
                              <th className="text-left px-5 py-2.5 font-semibold text-slate-500 text-xs">Nomi</th>
                              <th className="text-left px-4 py-2.5 font-semibold text-slate-500 text-xs">Narxi</th>
                              <th className="text-left px-4 py-2.5 font-semibold text-slate-500 text-xs">Norma</th>
                              <th className="text-left px-4 py-2.5 font-semibold text-slate-500 text-xs">O&apos;lchov</th>
                              <th className="text-right px-4 py-2.5 font-semibold text-slate-500 text-xs">Amallar</th>
                            </tr>
                          </thead>
                          <tbody>
                            {items.map((tt, i) => (
                              <tr key={tt.id} className={`border-b border-slate-50 hover:bg-slate-50 transition-colors ${i % 2 === 0 ? '' : 'bg-slate-50/40'}`}>
                                <td className="px-5 py-2.5 font-medium text-slate-800">{tt.name}</td>
                                <td className="px-4 py-2.5 text-slate-600">{tt.price.toLocaleString()} {t.common.sum}</td>
                                <td className="px-4 py-2.5 text-slate-500">{tt.normalRange ?? '—'}</td>
                                <td className="px-4 py-2.5 text-slate-500">{tt.unit ?? '—'}</td>
                                <td className="px-4 py-2.5">
                                  <div className="flex items-center justify-end gap-1">
                                    <button onClick={() => openEditTypeModal(tt)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors" title={t.common.edit}>
                                      <Pencil className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => handleDeleteType(tt.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors" title={t.common.delete}>
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </div>
      )}

      {/* -- Tab 3: Reagents -- */}
      {activeTab === "reagents" && (
        <div>
          {/* Add button */}
          {role === 'ADMIN' && (
            <div className="flex justify-end mb-4">
              <button
                onClick={() => { setEditingReagent(null); setReagentForm({ name: '', unit: 'ml', quantity: '0', minQuantity: '10', expiryDate: '', pricePerUnit: '0' }); setShowReagentModal(true); }}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
              >
                <Plus className="w-4 h-4" /> Reaktiv qo&apos;shish
              </button>
            </div>
          )}
          {reagentsLoading ? (
            <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>
          ) : reagents.length === 0 ? (
            <div className="text-center py-12 text-slate-400">Reaktivlar yo&apos;q</div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Nomi</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Birlik</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Miqdori</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Min.miqdor</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Yaroqlilik</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Status</th>
                    {role === 'ADMIN' && <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Amallar</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {reagents.map((r, i) => {
                    const st = reagentStatus(r);
                    return (
                      <tr key={r.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}>
                        <td className="px-5 py-3 font-semibold text-slate-800">{r.name}</td>
                        <td className="px-4 py-3 text-center text-slate-600">{r.unit}</td>
                        <td className="px-4 py-3 text-center font-bold text-slate-800">{r.quantity}</td>
                        <td className="px-4 py-3 text-center text-slate-500">{r.minQuantity}</td>
                        <td className="px-4 py-3 text-center text-slate-500">
                          {r.expiryDate ? new Date(r.expiryDate).toLocaleDateString('uz-UZ') : '—'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${st.color}`}>{st.label}</span>
                        </td>
                        {role === 'ADMIN' && (
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => { setKirimReagent({ id: r.id, name: r.name }); setKirimQty(''); setKirimNote(''); setShowKirimModal(true); }}
                                className="text-xs px-2 py-1 bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100"
                              >
                                + Kirim
                              </button>
                              <button
                                onClick={() => { setEditingReagent({ id: r.id, name: r.name, unit: r.unit, quantity: r.quantity, minQuantity: r.minQuantity, expiryDate: r.expiryDate ? r.expiryDate.split('T')[0] : '', pricePerUnit: r.pricePerUnit }); setReagentForm({ name: r.name, unit: r.unit, quantity: String(r.quantity), minQuantity: String(r.minQuantity), expiryDate: r.expiryDate ? r.expiryDate.split('T')[0] : '', pricePerUnit: String(r.pricePerUnit) }); setShowReagentModal(true); }}
                                className="text-xs px-2 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100"
                              >
                                Tahrir
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Kirim modal */}
      {showKirimModal && kirimReagent && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-800">Kirim — {kirimReagent.name}</h2>
              <button onClick={() => setShowKirimModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="px-6 py-4 flex flex-col gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Miqdor *</label>
                <input type="number" value={kirimQty} onChange={e => setKirimQty(e.target.value)} placeholder="0" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Izoh</label>
                <textarea value={kirimNote} onChange={e => setKirimNote(e.target.value)} rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 bg-white" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => setShowKirimModal(false)} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Bekor</button>
              <button onClick={saveKirim} disabled={reagentSaving || !kirimQty} className="px-4 py-2 text-sm font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-60">
                {reagentSaving ? 'Saqlanmoqda...' : 'Saqlash'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reaktor qo'shish/tahrirlash modal */}
      {showReagentModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-800">{editingReagent ? 'Reaktivni tahrirlash' : 'Yangi reaktiv'}</h2>
              <button onClick={() => setShowReagentModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="px-6 py-4 flex flex-col gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Nomi *</label>
                <input type="text" value={reagentForm.name} onChange={e => setReagentForm(p => ({ ...p, name: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">Birlik *</label>
                  <select value={reagentForm.unit} onChange={e => setReagentForm(p => ({ ...p, unit: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-slate-900">
                    {['ml', 'l', 'g', 'mg', 'dona', 'упак'].map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">Boshlang&apos;ich miqdor</label>
                  <input type="number" value={reagentForm.quantity} onChange={e => setReagentForm(p => ({ ...p, quantity: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">Min.miqdor (ogohlantirish)</label>
                  <input type="number" value={reagentForm.minQuantity} onChange={e => setReagentForm(p => ({ ...p, minQuantity: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">Narxi (so&apos;m)</label>
                  <input type="number" value={reagentForm.pricePerUnit} onChange={e => setReagentForm(p => ({ ...p, pricePerUnit: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Yaroqlilik muddati</label>
                <input type="date" value={reagentForm.expiryDate} onChange={e => setReagentForm(p => ({ ...p, expiryDate: e.target.value }))} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
              <button onClick={() => setShowReagentModal(false)} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Bekor</button>
              <button onClick={saveReagent} disabled={reagentSaving || !reagentForm.name} className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60">
                {reagentSaving ? 'Saqlanmoqda...' : 'Saqlash'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          MODAL: Order Test (Accordion)
      ═══════════════════════════════════════════════════════ */}
      {showOrderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl flex flex-col" style={{ maxHeight: '90vh' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
              <h2 className="text-lg font-semibold text-slate-800">Tahlil buyurtma</h2>
              <button onClick={() => setShowOrderModal(false)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleOrderSubmit} className="flex flex-col flex-1 min-h-0">
              <div className="px-6 py-4 border-b border-slate-100 flex-shrink-0">
                {orderError && (
                  <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm mb-4">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {orderError}
                  </div>
                )}
                {/* Patient search */}
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-slate-700">{t.lab.selectPatient} <span className="text-red-500">*</span></label>
                  {selectedPatient ? (
                    <div className="flex items-center justify-between border border-slate-200 rounded-lg px-3 py-2 bg-blue-50">
                      <span className="text-sm text-slate-800 font-medium">{selectedPatient.lastName} {selectedPatient.firstName} {selectedPatient.fatherName}</span>
                      <button type="button" onClick={() => { setSelectedPatient(null); setPatientSearch(""); }} className="text-slate-400 hover:text-slate-600">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input type="text" value={patientSearch} onChange={(e) => setPatientSearch(e.target.value)} placeholder={t.common.search + "..."} className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                      {patientSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-blue-500" />}
                      {patientResults.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                          {patientResults.map((p) => (
                            <button key={p.id} type="button" onClick={() => { setSelectedPatient(p); setPatientSearch(""); setPatientResults([]); }} className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
                              {p.lastName} {p.firstName} {p.fatherName}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Accordion test list */}
              <div className="overflow-y-auto flex-1 px-6 py-4">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                  Tahlil turini tanlang <span className="text-red-500">*</span>
                  {selectedTestTypeIds.length > 0 && (
                    <span className="ml-2 normal-case font-normal text-blue-600">({selectedTestTypeIds.length} ta tanlandi)</span>
                  )}
                </div>
                {(() => {
                  const groups: Record<string, LabTestType[]> = {};
                  for (const tt of testTypes) {
                    const cat = tt.category ?? 'Boshqalar';
                    if (!groups[cat]) groups[cat] = [];
                    groups[cat].push(tt);
                  }
                  return Object.entries(groups).map(([cat, items]) => {
                    const isOpen = openOrderGroups.has(cat);
                    const groupSelected = items.filter(it => selectedTestTypeIds.includes(it.id));
                    return (
                      <div key={cat} className="mb-2 border border-slate-200 rounded-xl overflow-hidden">
                        <button type="button" onClick={() => toggleOrderGroup(cat)} className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left">
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-slate-800 text-sm uppercase tracking-wide">{cat}</span>
                            {groupSelected.length > 0 && (
                              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">{groupSelected.length} ta</span>
                            )}
                          </div>
                          <svg className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </button>
                        {isOpen && (
                          <div className="divide-y divide-slate-50">
                            {items.map(tt => {
                              const checked = selectedTestTypeIds.includes(tt.id);
                              return (
                                <label key={tt.id} className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-slate-50 transition-colors ${checked ? 'bg-blue-50/50' : ''}`}>
                                  <input type="checkbox" checked={checked} onChange={() => toggleOrderTestType(tt.id)} className="w-4 h-4 accent-blue-600 flex-shrink-0" />
                                  <span className="flex-1 text-sm text-slate-800">{tt.name}</span>
                                  <span className="text-sm text-slate-500 font-medium">{tt.price.toLocaleString()} {t.common.sum}</span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>

              {/* Payment summary + footer */}
              <div className="px-6 py-4 border-t border-slate-100 flex-shrink-0">
                {selectedTestTypeIds.length > 0 && (() => {
                  const groups: Record<string, { name: string; total: number }> = {};
                  for (const id of selectedTestTypeIds) {
                    const tt = testTypes.find(x => x.id === id);
                    if (!tt) continue;
                    const cat = tt.category ?? 'Boshqalar';
                    if (!groups[cat]) groups[cat] = { name: cat, total: 0 };
                    groups[cat].total += Number(tt.price);
                  }
                  const grandTotal = Object.values(groups).reduce((s, g) => s + g.total, 0);
                  const groupEntries = Object.values(groups);
                  return (
                    <div className="mb-4 bg-slate-50 rounded-xl px-4 py-3 space-y-1.5">
                      {groupEntries.map(g => (
                        <div key={g.name} className="flex justify-between text-sm text-slate-600">
                          <span>{g.name}</span>
                          <span className="font-medium">{g.total.toLocaleString()} {t.common.sum}</span>
                        </div>
                      ))}
                      {groupEntries.length > 1 && (
                        <div className="flex justify-between text-sm font-bold text-slate-800 pt-1.5 border-t border-slate-200">
                          <span>Jami</span>
                          <span>{grandTotal.toLocaleString()} {t.common.sum}</span>
                        </div>
                      )}
                    </div>
                  );
                })()}
                <div className="flex items-center justify-end gap-3">
                  <button type="button" onClick={() => setShowOrderModal(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors">
                    {t.common.cancel}
                  </button>
                  <button type="submit" disabled={orderSaving || !selectedPatient || selectedTestTypeIds.length === 0} className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors">
                    {orderSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                    Buyurtma berish ({selectedTestTypeIds.length})
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          MODAL: Enter / Edit Result
      ═══════════════════════════════════════════════════════ */}
      {showResultModal && activeTest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-800">
                {activeTest.status === "COMPLETED" ? "Natijani o'zgartirish" : "Natija kiriting"}
              </h2>
              <button onClick={() => setShowResultModal(false)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors">
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

              {/* Info */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 space-y-1.5 text-sm">
                <p><span className="text-slate-500">Bemor: </span><span className="font-semibold text-slate-800">{activeTest.patient.lastName} {activeTest.patient.firstName}</span></p>
                <p><span className="text-slate-500">Tahlil: </span><span className="font-semibold text-slate-800">{activeTest.testType.name}</span></p>
                {activeTest.testType.normalRange && (
                  <p className="flex items-center gap-2">
                    <span className="text-slate-500">Norma: </span>
                    <span className="font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded">
                      {activeTest.testType.normalRange}{activeTest.testType.unit ? ` ${activeTest.testType.unit}` : ''}
                    </span>
                  </p>
                )}
              </div>

              {/* Result input */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">
                  Natija <span className="text-red-500">*</span>
                  {activeTest.testType.unit && <span className="ml-1 text-slate-400 font-normal">({activeTest.testType.unit})</span>}
                </label>
                <textarea
                  value={resultText}
                  onChange={(e) => setResultText(e.target.value)}
                  rows={3}
                  placeholder="Natijani kiriting..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>

              {/* Change history (HEAD_LAB_TECH only) */}
              {activeTest.notes && (() => {
                type HistoryEntry = { date: string; from: string | null; to: string; by: string };
                let history: HistoryEntry[] = [];
                try { history = JSON.parse(activeTest.notes) as HistoryEntry[]; } catch { return null; }
                if (!history.length) return null;
                return (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                    <p className="text-xs font-semibold text-amber-700 uppercase mb-2">O&apos;zgarishlar tarixi</p>
                    <div className="space-y-1.5 max-h-28 overflow-y-auto">
                      {history.map((h, i) => (
                        <div key={i} className="text-xs text-amber-800">
                          <span className="text-amber-500">{new Date(h.date).toLocaleString('uz-UZ')}</span>
                          {' · '}<span className="font-medium">{h.by}</span>
                          {' · '}{h.from != null ? `${h.from} → ${h.to}` : `Natija kiritildi: ${h.to}`}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowResultModal(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors">
                  {t.common.cancel}
                </button>
                <button type="submit" disabled={resultSaving || !resultText.trim()} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors">
                  {resultSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Natijani saqlash
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          MODAL: Add / Edit Test Type
      ═══════════════════════════════════════════════════════ */}
      {/* -- Print Modal ------------------------------------------------------- */}
      {showPrintModal && printTest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal header - ekranda ko'rinadi, print da ko'rinmaydi */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 print:hidden">
              <h2 className="text-lg font-semibold text-slate-800">Tahlil natijasi</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const el = document.getElementById('print-content');
                    if (!el) return;
                    const win = window.open('', '_blank');
                    if (!win) return;
                    win.document.write(`<html><head><title>Tahlil natijasi</title><style>body{font-family:Arial,sans-serif;margin:20px;}table{border-collapse:collapse;width:100%;}th,td{border:1px solid #94a3b8;padding:8px 12px;}th{background:#dbeafe;font-weight:bold;text-align:center;}td:first-child{text-align:left;}h2{text-align:center;color:#1e40af;text-transform:uppercase;letter-spacing:1px;}h1{text-align:center;}.patient-info{display:flex;justify-content:space-between;border-bottom:1px solid #e2e8f0;padding-bottom:12px;margin-bottom:16px;font-size:14px;}.footer{margin-top:32px;padding-top:12px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:11px;color:#94a3b8;}</style></head><body>${el.innerHTML}</body></html>`);
                    win.document.close();
                    win.print();
                  }}
                  className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
                >
                  <Printer className="w-4 h-4" />
                  Chop etish
                </button>
                <button
                  onClick={() => setShowPrintModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Print content */}
            <div
              id="print-content"
              className="p-8"
              style={{ fontFamily: 'Arial, sans-serif' }}
            >
              {/* Clinic header */}
              <div className="text-center mb-6">
                <h1 className="text-xl font-bold text-slate-800">BOLAJON KLINIKASI</h1>
                <p className="text-sm text-slate-500 mt-1">Laboratoriya tahlil natijalari</p>
              </div>

              {/* Patient info */}
              <div className="patient-info flex justify-between mb-6 text-sm border-b border-slate-200 pb-4">
                <div>
                  <span className="font-semibold">Bemor:</span>{" "}
                  {printTest.patient.lastName} {printTest.patient.firstName}{" "}
                  {printTest.patient.fatherName}
                </div>
                <div>
                  <span className="font-semibold">Sana:</span>{" "}
                  {new Date(printTest.createdAt).toLocaleDateString("ru-RU")}
                </div>
              </div>

              {/* Category header if exists */}
              {printTest.testType.category && (
                <div className="text-center mb-3">
                  <h2
                    className="text-base font-bold uppercase tracking-wide"
                    style={{ color: '#1e40af' }}
                  >
                    {printTest.testType.category}
                  </h2>
                </div>
              )}

              {/* Results table */}
              <table
                className="w-full text-sm"
                style={{ borderCollapse: 'collapse', width: '100%' }}
              >
                <thead>
                  <tr style={{ backgroundColor: '#dbeafe' }}>
                    <th
                      className="border border-slate-300 px-3 py-2 text-left font-bold text-slate-700"
                      style={{ border: '1px solid #94a3b8', padding: '8px 12px', textAlign: 'left', fontWeight: 'bold' }}
                    >
                      Наименование Анализа
                    </th>
                    <th
                      className="border border-slate-300 px-3 py-2 text-center font-bold text-slate-700"
                      style={{ border: '1px solid #94a3b8', padding: '8px 12px', textAlign: 'center', fontWeight: 'bold' }}
                    >
                      Результат
                    </th>
                    <th
                      className="border border-slate-300 px-3 py-2 text-center font-bold text-slate-700"
                      style={{ border: '1px solid #94a3b8', padding: '8px 12px', textAlign: 'center', fontWeight: 'bold' }}
                    >
                      Норма
                    </th>
                    <th
                      className="border border-slate-300 px-3 py-2 text-center font-bold text-slate-700"
                      style={{ border: '1px solid #94a3b8', padding: '8px 12px', textAlign: 'center', fontWeight: 'bold' }}
                    >
                      Ед.изм
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td
                      className="border border-slate-300 px-3 py-2 text-slate-800"
                      style={{ border: '1px solid #94a3b8', padding: '8px 12px' }}
                    >
                      {printTest.testType.name}
                    </td>
                    <td
                      className="border border-slate-300 px-3 py-2 text-center font-medium text-slate-900"
                      style={{ border: '1px solid #94a3b8', padding: '8px 12px', textAlign: 'center', fontWeight: '600' }}
                    >
                      {printTest.result ?? "—"}
                    </td>
                    <td
                      className="border border-slate-300 px-3 py-2 text-center text-slate-600"
                      style={{ border: '1px solid #94a3b8', padding: '8px 12px', textAlign: 'center' }}
                    >
                      {printTest.testType.normalRange ?? "—"}
                    </td>
                    <td
                      className="border border-slate-300 px-3 py-2 text-center text-slate-600"
                      style={{ border: '1px solid #94a3b8', padding: '8px 12px', textAlign: 'center' }}
                    >
                      {printTest.testType.unit ?? "—"}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Footer */}
              <div className="footer mt-8 pt-4 border-t border-slate-200 flex justify-between text-xs text-slate-400">
                <span>Laboratoriya mutaxassisi: _______________</span>
                <span>Imzo: _______________</span>
              </div>
            </div>
          </div>
        </div>
      )}

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

              {/* Guruh nomi (category) */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">
                  Guruh nomi <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={typeCategory}
                  onChange={(e) => setTypeCategory(e.target.value)}
                  placeholder="Masalan: ЩИТОВИДНАЯ ЖЕЛЕЗА"
                  required
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
                <p className="text-xs text-slate-400">Chop etishda guruh sarlavhasi sifatida ko&apos;rinadi</p>
              </div>

              {/* O'lchov birligi (unit) */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">
                  O&apos;lchov birligi (ixtiyoriy)
                </label>
                <input
                  type="text"
                  value={typeUnit}
                  onChange={(e) => setTypeUnit(e.target.value)}
                  placeholder="Masalan: IU/mL, ng/mL, ОП"
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
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
