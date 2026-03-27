"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useLanguage } from "@/hooks/useLanguage";
import {
  Plus,
  Loader2,
  AlertCircle,
  X,
  Pill,
  Pencil,
  Trash2,
  Search,
  AlertTriangle,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Supplier {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
}

interface Medicine {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  minStock: number;
  price: number;
  expiryDate: string | null;
  supplier: Supplier | null;
}

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  fatherName: string;
}

interface MedicineTransaction {
  id: string;
  type: "STOCK_IN" | "STOCK_OUT";
  quantity: number;
  createdAt: string;
  notes: string | null;
  medicine: { name: string; unit: string };
  patient: Patient | null;
  performedBy?: { firstName: string; lastName: string } | null;
}

type ActiveTab = "medicines" | "transactions" | "suppliers";

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PharmacyPage() {
  const { t } = useLanguage();
  const { data: session } = useSession();

  const role = session?.user?.role as string | undefined;
  const canManage = role === "ADMIN" || role === "HEAD_NURSE";
  const canDispense =
    role === "ADMIN" || role === "HEAD_NURSE" || role === "NURSE";

  const [activeTab, setActiveTab] = useState<ActiveTab>("medicines");

  // ── Medicines state ─────────────────────────────────────────────────────────
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [medicinesLoading, setMedicinesLoading] = useState(false);
  const [medicinesError, setMedicinesError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);

  // ── Suppliers state ─────────────────────────────────────────────────────────
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [suppliersLoading, setSuppliersLoading] = useState(false);
  const [suppliersError, setSuppliersError] = useState<string | null>(null);

  // ── Transactions state ──────────────────────────────────────────────────────
  const [transactions, setTransactions] = useState<MedicineTransaction[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [transactionsError, setTransactionsError] = useState<string | null>(
    null
  );

  // ── Medicine modal ──────────────────────────────────────────────────────────
  const [showMedicineModal, setShowMedicineModal] = useState(false);
  const [editingMedicine, setEditingMedicine] = useState<Medicine | null>(null);
  const [medName, setMedName] = useState("");
  const [medUnit, setMedUnit] = useState("");
  const [medPrice, setMedPrice] = useState("");
  const [medMinStock, setMedMinStock] = useState("");
  const [medExpiryDate, setMedExpiryDate] = useState("");
  const [medSupplierId, setMedSupplierId] = useState("");
  const [medSaving, setMedSaving] = useState(false);
  const [medError, setMedError] = useState<string | null>(null);

  // ── Dispense modal ──────────────────────────────────────────────────────────
  const [showDispenseModal, setShowDispenseModal] = useState(false);
  const [dispenseMedicine, setDispenseMedicine] = useState<Medicine | null>(
    null
  );
  const [dispenseQty, setDispenseQty] = useState("");
  const [dispenseNotes, setDispenseNotes] = useState("");
  const [patientSearch, setPatientSearch] = useState("");
  const [patientResults, setPatientResults] = useState<Patient[]>([]);
  const [patientSearching, setPatientSearching] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [dispenseSaving, setDispenseSaving] = useState(false);
  const [dispenseError, setDispenseError] = useState<string | null>(null);

  // ── Supplier modal ──────────────────────────────────────────────────────────
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supName, setSupName] = useState("");
  const [supPhone, setSupPhone] = useState("");
  const [supAddress, setSupAddress] = useState("");
  const [supSaving, setSupSaving] = useState(false);
  const [supError, setSupError] = useState<string | null>(null);

  // ─── Fetchers ──────────────────────────────────────────────────────────────

  const fetchMedicines = useCallback(async () => {
    setMedicinesLoading(true);
    setMedicinesError(null);
    try {
      const res = await fetch(
        `/api/medicines?search=${encodeURIComponent(search)}`
      );
      if (!res.ok) throw new Error(t.common.error);
      const json = await res.json();
      setMedicines(Array.isArray(json) ? json : json.data ?? []);
    } catch {
      setMedicinesError(t.common.error);
    } finally {
      setMedicinesLoading(false);
    }
  }, [search, t.common.error]);

  const fetchSuppliers = useCallback(async () => {
    setSuppliersLoading(true);
    setSuppliersError(null);
    try {
      const res = await fetch("/api/suppliers");
      if (!res.ok) throw new Error(t.common.error);
      const json = await res.json();
      setSuppliers(Array.isArray(json) ? json : json.data ?? []);
    } catch {
      setSuppliersError(t.common.error);
    } finally {
      setSuppliersLoading(false);
    }
  }, [t.common.error]);

  const fetchTransactions = useCallback(async () => {
    setTransactionsLoading(true);
    setTransactionsError(null);
    try {
      const res = await fetch("/api/medicine-transactions?page=1&limit=20");
      if (!res.ok) throw new Error(t.common.error);
      const json = await res.json();
      setTransactions(Array.isArray(json) ? json : json.data ?? []);
    } catch {
      setTransactionsError(t.common.error);
    } finally {
      setTransactionsLoading(false);
    }
  }, [t.common.error]);

  useEffect(() => {
    fetchMedicines();
    fetchSuppliers();
    fetchTransactions();
  }, [fetchMedicines, fetchSuppliers, fetchTransactions]);

  // ── Patient search (debounced) ────────────────────────────────────────────
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

  // ─── Filtered medicines ───────────────────────────────────────────────────

  const filteredMedicines = lowStockOnly
    ? medicines.filter((m) => m.quantity <= m.minStock)
    : medicines;

  // ─── Medicine CRUD ────────────────────────────────────────────────────────

  function openAddMedicineModal() {
    setEditingMedicine(null);
    setMedName("");
    setMedUnit("");
    setMedPrice("");
    setMedMinStock("");
    setMedExpiryDate("");
    setMedSupplierId("");
    setMedError(null);
    setShowMedicineModal(true);
  }

  function openEditMedicineModal(med: Medicine) {
    setEditingMedicine(med);
    setMedName(med.name);
    setMedUnit(med.unit);
    setMedPrice(String(med.price));
    setMedMinStock(String(med.minStock));
    setMedExpiryDate(
      med.expiryDate ? med.expiryDate.slice(0, 10) : ""
    );
    setMedSupplierId(med.supplier?.id ?? "");
    setMedError(null);
    setShowMedicineModal(true);
  }

  async function handleMedicineSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMedSaving(true);
    setMedError(null);
    try {
      const body: Record<string, string | number | null> = {
        name: medName.trim(),
        unit: medUnit.trim(),
        price: Number(medPrice),
        minStock: Number(medMinStock),
        expiryDate: medExpiryDate || null,
        supplierId: medSupplierId || null,
      };
      const url = editingMedicine
        ? `/api/medicines/${editingMedicine.id}`
        : "/api/medicines";
      const method = editingMedicine ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || t.common.error);
      }
      setShowMedicineModal(false);
      fetchMedicines();
    } catch (err) {
      setMedError(err instanceof Error ? err.message : t.common.error);
    } finally {
      setMedSaving(false);
    }
  }

  async function handleDeleteMedicine(id: string) {
    if (!confirm(t.common.delete + "?")) return;
    try {
      const res = await fetch(`/api/medicines/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(t.common.error);
      fetchMedicines();
    } catch {
      setMedicinesError(t.common.error);
    }
  }

  // ─── Dispense ─────────────────────────────────────────────────────────────

  function openDispenseModal(med: Medicine) {
    setDispenseMedicine(med);
    setDispenseQty("");
    setDispenseNotes("");
    setPatientSearch("");
    setPatientResults([]);
    setSelectedPatient(null);
    setDispenseError(null);
    setShowDispenseModal(true);
  }

  async function handleDispenseSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!dispenseMedicine) return;
    setDispenseSaving(true);
    setDispenseError(null);
    try {
      const body: Record<string, string | number | null | undefined> = {
        medicineId: dispenseMedicine.id,
        type: "STOCK_OUT",
        quantity: Number(dispenseQty),
        patientId: selectedPatient?.id ?? undefined,
        notes: dispenseNotes.trim() || null,
      };
      const res = await fetch("/api/medicine-transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || t.common.error);
      }
      setShowDispenseModal(false);
      fetchMedicines();
      fetchTransactions();
    } catch (err) {
      setDispenseError(err instanceof Error ? err.message : t.common.error);
    } finally {
      setDispenseSaving(false);
    }
  }

  // ─── Supplier CRUD ────────────────────────────────────────────────────────

  function openAddSupplierModal() {
    setEditingSupplier(null);
    setSupName("");
    setSupPhone("");
    setSupAddress("");
    setSupError(null);
    setShowSupplierModal(true);
  }

  function openEditSupplierModal(sup: Supplier) {
    setEditingSupplier(sup);
    setSupName(sup.name);
    setSupPhone(sup.phone ?? "");
    setSupAddress(sup.address ?? "");
    setSupError(null);
    setShowSupplierModal(true);
  }

  async function handleSupplierSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSupSaving(true);
    setSupError(null);
    try {
      const body = {
        name: supName.trim(),
        phone: supPhone.trim() || null,
        address: supAddress.trim() || null,
      };
      const url = editingSupplier
        ? `/api/suppliers/${editingSupplier.id}`
        : "/api/suppliers";
      const method = editingSupplier ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || t.common.error);
      }
      setShowSupplierModal(false);
      fetchSuppliers();
      fetchMedicines();
    } catch (err) {
      setSupError(err instanceof Error ? err.message : t.common.error);
    } finally {
      setSupSaving(false);
    }
  }

  async function handleDeleteSupplier(id: string) {
    if (!confirm(t.common.delete + "?")) return;
    try {
      const res = await fetch(`/api/suppliers/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(t.common.error);
      fetchSuppliers();
    } catch {
      setSuppliersError(t.common.error);
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Pill className="w-6 h-6 text-blue-600" />
          {t.pharmacy.title}
        </h1>
        <div className="flex gap-2">
          {activeTab === "medicines" && canManage && (
            <button
              onClick={openAddMedicineModal}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              {t.pharmacy.addMedicine}
            </button>
          )}
          {activeTab === "suppliers" && canManage && (
            <button
              onClick={openAddSupplierModal}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              {t.pharmacy.addSupplier}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-lg w-fit">
        {(
          [
            { key: "medicines", label: t.pharmacy.medicines },
            { key: "transactions", label: t.pharmacy.transactions },
            ...(canManage
              ? [{ key: "suppliers", label: t.pharmacy.suppliers }]
              : []),
          ] as { key: ActiveTab; label: string }[]
        ).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === key
                ? "bg-white text-slate-800 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ═══ TAB 1: Medicines ═══ */}
      {activeTab === "medicines" && (
        <div>
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t.common.search + "..."}
                className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={() => setLowStockOnly((v) => !v)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                lowStockOnly
                  ? "bg-red-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
              {t.pharmacy.lowStock}
            </button>
          </div>

          {/* Error */}
          {medicinesError && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {medicinesError}
            </div>
          )}

          {/* Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">
                      {t.pharmacy.medicineName}
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">
                      {t.pharmacy.unit}
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">
                      {t.pharmacy.quantity}
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">
                      {t.pharmacy.minStock}
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">
                      {t.pharmacy.price}
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">
                      {t.pharmacy.expiryDate}
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">
                      {t.pharmacy.supplier}
                    </th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-600">
                      {t.common.actions}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {medicinesLoading ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-500" />
                      </td>
                    </tr>
                  ) : filteredMedicines.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="text-center py-12 text-slate-400"
                      >
                        {t.pharmacy.noMedicines}
                      </td>
                    </tr>
                  ) : (
                    filteredMedicines.map((med) => {
                      const isLow = med.quantity <= med.minStock;
                      return (
                        <tr
                          key={med.id}
                          className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                        >
                          <td className="px-4 py-3 font-medium text-slate-800">
                            {med.name}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {med.unit}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={
                                isLow
                                  ? "text-red-600 font-semibold"
                                  : "text-slate-700"
                              }
                            >
                              {med.quantity}
                              {isLow && (
                                <AlertTriangle className="inline w-3 h-3 ml-1 text-red-500" />
                              )}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-500">
                            {med.minStock}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {med.price.toLocaleString()} {t.common.sum}
                          </td>
                          <td className="px-4 py-3 text-slate-500">
                            {med.expiryDate
                              ? new Date(med.expiryDate).toLocaleDateString(
                                  "uz-UZ"
                                )
                              : "—"}
                          </td>
                          <td className="px-4 py-3 text-slate-500">
                            {med.supplier?.name ?? "—"}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              {canDispense && (
                                <button
                                  onClick={() => openDispenseModal(med)}
                                  className="flex items-center gap-1 px-2 py-1 text-xs bg-orange-50 text-orange-700 hover:bg-orange-100 rounded-md transition-colors font-medium"
                                >
                                  <Pill className="w-3 h-3" />
                                  {t.pharmacy.dispenseMedicine}
                                </button>
                              )}
                              {canManage && (
                                <>
                                  <button
                                    onClick={() => openEditMedicineModal(med)}
                                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                                    title={t.common.edit}
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() =>
                                      handleDeleteMedicine(med.id)
                                    }
                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                    title={t.common.delete}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </>
                              )}
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
        </div>
      )}

      {/* ═══ TAB 2: Transactions ═══ */}
      {activeTab === "transactions" && (
        <div>
          {transactionsError && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {transactionsError}
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">
                      {t.pharmacy.medicineName}
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">
                      {t.common.status}
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">
                      {t.pharmacy.quantity}
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">
                      {t.pharmacy.transactionDate}
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">
                      {t.appointments.patient}
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">
                      {t.pharmacy.notes}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {transactionsLoading ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-500" />
                      </td>
                    </tr>
                  ) : transactions.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="text-center py-12 text-slate-400"
                      >
                        {t.pharmacy.noTransactions}
                      </td>
                    </tr>
                  ) : (
                    transactions.map((tx) => (
                      <tr
                        key={tx.id}
                        className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                      >
                        <td className="px-4 py-3 font-medium text-slate-800">
                          {tx.medicine.name}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                              tx.type === "STOCK_IN"
                                ? "bg-green-100 text-green-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {t.pharmacy.type[tx.type]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {tx.quantity} {tx.medicine.unit}
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {new Date(tx.createdAt).toLocaleDateString("uz-UZ")}
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {tx.patient
                            ? `${tx.patient.lastName} ${tx.patient.firstName}`
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-slate-400 max-w-[160px] truncate">
                          {tx.notes ?? "—"}
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

      {/* ═══ TAB 3: Suppliers ═══ */}
      {activeTab === "suppliers" && canManage && (
        <div>
          {suppliersError && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {suppliersError}
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">
                      {t.pharmacy.supplierName}
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">
                      {t.pharmacy.phone}
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">
                      {t.pharmacy.address}
                    </th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-600">
                      {t.common.actions}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {suppliersLoading ? (
                    <tr>
                      <td colSpan={4} className="text-center py-12">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-500" />
                      </td>
                    </tr>
                  ) : suppliers.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="text-center py-12 text-slate-400"
                      >
                        {t.pharmacy.noSuppliers}
                      </td>
                    </tr>
                  ) : (
                    suppliers.map((sup) => (
                      <tr
                        key={sup.id}
                        className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                      >
                        <td className="px-4 py-3 font-medium text-slate-800">
                          {sup.name}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {sup.phone ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {sup.address ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => openEditSupplierModal(sup)}
                              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                              title={t.common.edit}
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteSupplier(sup.id)}
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
          MODAL: Add / Edit Medicine
      ═══════════════════════════════════════════════════════ */}
      {showMedicineModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-800">
                {editingMedicine ? t.common.edit : t.pharmacy.addMedicine}
              </h2>
              <button
                onClick={() => setShowMedicineModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleMedicineSubmit} className="p-6 space-y-4">
              {medError && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {medError}
                </div>
              )}

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">
                  {t.pharmacy.medicineName} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={medName}
                  onChange={(e) => setMedName(e.target.value)}
                  required
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">
                  {t.pharmacy.unit} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={medUnit}
                  onChange={(e) => setMedUnit(e.target.value)}
                  required
                  placeholder="dona, ml, g..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-slate-700">
                    {t.pharmacy.price} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={medPrice}
                    onChange={(e) => setMedPrice(e.target.value)}
                    required
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-slate-700">
                    {t.pharmacy.minStock} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={medMinStock}
                    onChange={(e) => setMedMinStock(e.target.value)}
                    required
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">
                  {t.pharmacy.expiryDate}
                </label>
                <input
                  type="date"
                  value={medExpiryDate}
                  onChange={(e) => setMedExpiryDate(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">
                  {t.pharmacy.supplier}
                </label>
                <select
                  value={medSupplierId}
                  onChange={(e) => setMedSupplierId(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">{t.pharmacy.supplier}</option>
                  {suppliers.map((sup) => (
                    <option key={sup.id} value={sup.id}>
                      {sup.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowMedicineModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={medSaving}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {medSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {t.common.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          MODAL: Dispense Medicine
      ═══════════════════════════════════════════════════════ */}
      {showDispenseModal && dispenseMedicine && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-800">
                {t.pharmacy.dispenseMedicine}
              </h2>
              <button
                onClick={() => setShowDispenseModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleDispenseSubmit} className="p-6 space-y-4">
              {dispenseError && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {dispenseError}
                </div>
              )}

              {/* Medicine info (read-only) */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 space-y-1 text-sm">
                <p>
                  <span className="text-slate-500">
                    {t.pharmacy.medicineName}:{" "}
                  </span>
                  <span className="font-medium text-slate-800">
                    {dispenseMedicine.name}
                  </span>
                </p>
                <p>
                  <span className="text-slate-500">
                    {t.pharmacy.inStock}:{" "}
                  </span>
                  <span
                    className={`font-medium ${
                      dispenseMedicine.quantity <= dispenseMedicine.minStock
                        ? "text-red-600"
                        : "text-slate-800"
                    }`}
                  >
                    {dispenseMedicine.quantity} {dispenseMedicine.unit}
                  </span>
                </p>
              </div>

              {/* Quantity */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">
                  {t.pharmacy.quantity} <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  max={dispenseMedicine.quantity}
                  value={dispenseQty}
                  onChange={(e) => setDispenseQty(e.target.value)}
                  required
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Patient search (optional) */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">
                  {t.pharmacy.selectPatient}
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

              {/* Notes */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">
                  {t.pharmacy.notes}
                </label>
                <textarea
                  value={dispenseNotes}
                  onChange={(e) => setDispenseNotes(e.target.value)}
                  rows={3}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDispenseModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={dispenseSaving}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {dispenseSaving && (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  )}
                  {t.pharmacy.dispenseMedicine}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          MODAL: Add / Edit Supplier
      ═══════════════════════════════════════════════════════ */}
      {showSupplierModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-800">
                {editingSupplier ? t.common.edit : t.pharmacy.addSupplier}
              </h2>
              <button
                onClick={() => setShowSupplierModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSupplierSubmit} className="p-6 space-y-4">
              {supError && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {supError}
                </div>
              )}

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">
                  {t.pharmacy.supplierName} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={supName}
                  onChange={(e) => setSupName(e.target.value)}
                  required
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">
                  {t.pharmacy.phone}
                </label>
                <input
                  type="text"
                  value={supPhone}
                  onChange={(e) => setSupPhone(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">
                  {t.pharmacy.address}
                </label>
                <input
                  type="text"
                  value={supAddress}
                  onChange={(e) => setSupAddress(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSupplierModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={supSaving}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {supSaving && <Loader2 className="w-4 h-4 animate-spin" />}
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
