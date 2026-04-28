"use client";

import { useState, useEffect, useCallback } from "react";
import { useLanguage } from "@/hooks/useLanguage";
import { usePermissions } from "@/hooks/usePermissions";
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
  PackagePlus,
  ShieldAlert,
  CheckCircle2,
} from "lucide-react";

// --- Types -------------------------------------------------------------------

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
  floor: number | null;
  writtenOff: boolean;
  writtenOffAt: string | null;
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

type ActiveTab = "medicines" | "receive" | "expiry" | "transactions" | "suppliers";


// --- Page ---------------------------------------------------------------------

export default function PharmacyPage() {
  const { t } = useLanguage();
  const { can } = usePermissions();

  const canCreateMedicine = can('/pharmacy:create');
  const canEditMedicine = can('/pharmacy:edit');
  const canWriteoff = can('/pharmacy:writeoff');
  const canManageSuppliers = can('/pharmacy:manage_suppliers');
  const canDispense = can('/pharmacy:dispense');

  const [activeTab, setActiveTab] = useState<ActiveTab>("medicines");

  // -- Medicines state ---------------------------------------------------------
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [medicinesLoading, setMedicinesLoading] = useState(false);
  const [medicinesError, setMedicinesError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [showWrittenOff, setShowWrittenOff] = useState(false);

  // -- Suppliers state ---------------------------------------------------------
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [suppliersLoading, setSuppliersLoading] = useState(false);
  const [suppliersError, setSuppliersError] = useState<string | null>(null);

  // -- Transactions state ------------------------------------------------------
  const [transactions, setTransactions] = useState<MedicineTransaction[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [transactionsError, setTransactionsError] = useState<string | null>(null);


  // -- Receive (STOCK_IN) state ------------------------------------------------
  const [rcvMedicineId, setRcvMedicineId] = useState("");
  const [rcvQty, setRcvQty] = useState("");
  const [rcvSupplierId, setRcvSupplierId] = useState("");
  const [rcvExpiryDate, setRcvExpiryDate] = useState("");
  const [rcvFloor, setRcvFloor] = useState<string>("2");
  const [rcvSaving, setRcvSaving] = useState(false);
  const [rcvError, setRcvError] = useState<string | null>(null);
  const [rcvSuccess, setRcvSuccess] = useState<string | null>(null);

  // -- Expiry state ------------------------------------------------------------
  const [expiryMeds, setExpiryMeds] = useState<Medicine[]>([]);
  const [expiryLoading, setExpiryLoading] = useState(false);
  const [writeOffingId, setWriteOffingId] = useState<string | null>(null);

  // -- Medicine modal ----------------------------------------------------------
  const [showMedicineModal, setShowMedicineModal] = useState(false);
  const [editingMedicine, setEditingMedicine] = useState<Medicine | null>(null);
  const [medName, setMedName] = useState("");
  const [medUnit, setMedUnit] = useState("");
  const [medPrice, setMedPrice] = useState("");
  const [medMinStock, setMedMinStock] = useState("");
  const [medQuantity, setMedQuantity] = useState("");
  const [medExpiryDate, setMedExpiryDate] = useState("");
  const [medSupplierId, setMedSupplierId] = useState("");
  const [medFloor, setMedFloor] = useState<string>("");
  const [medSaving, setMedSaving] = useState(false);
  const [medError, setMedError] = useState<string | null>(null);

  // -- Dispense modal ----------------------------------------------------------
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

  // -- Supplier modal ----------------------------------------------------------
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supName, setSupName] = useState("");
  const [supPhone, setSupPhone] = useState("");
  const [supAddress, setSupAddress] = useState("");
  const [supSaving, setSupSaving] = useState(false);
  const [supError, setSupError] = useState<string | null>(null);

  // --- Fetchers --------------------------------------------------------------

  const fetchMedicines = useCallback(async () => {
    setMedicinesLoading(true);
    setMedicinesError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      params.set("writtenOff", showWrittenOff ? "true" : "false");
      const res = await fetch(`/api/medicines?${params.toString()}`);
      if (!res.ok) throw new Error(t.common.error);
      const json = await res.json();
      setMedicines(Array.isArray(json) ? json : json.data ?? []);
    } catch {
      setMedicinesError(t.common.error);
    } finally {
      setMedicinesLoading(false);
    }
  }, [search, showWrittenOff, t.common.error]);

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

  // -- Expiry medicines fetch -------------------------------------------------
  const fetchExpiryMeds = useCallback(async () => {
    setExpiryLoading(true);
    try {
      const res = await fetch("/api/medicines?expiringSoon=true&writtenOff=false");
      if (!res.ok) throw new Error();
      const json = await res.json();
      setExpiryMeds(Array.isArray(json) ? json : []);
    } catch {
      setExpiryMeds([]);
    } finally {
      setExpiryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "expiry") fetchExpiryMeds();
  }, [activeTab, fetchExpiryMeds]);

  // -- Receive submit ----------------------------------------------------------
  async function handleReceive(e: React.FormEvent) {
    e.preventDefault();
    if (!rcvMedicineId || !rcvQty) return;
    setRcvSaving(true);
    setRcvError(null);
    setRcvSuccess(null);
    try {
      const med = medicines.find(m => m.id === rcvMedicineId);
      const res = await fetch("/api/medicine-transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          medicineId: rcvMedicineId,
          type: "IN",
          quantity: Number(rcvQty),
          supplierId: rcvSupplierId || undefined,
          expiryDate: rcvExpiryDate || undefined,
          floor: rcvFloor === "3" ? 3 : 2,
        }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || t.common.error); }
      setRcvSuccess(`${med?.name ?? "Dori"} — ${rcvQty} dona qabul qilindi`);
      setRcvMedicineId(""); setRcvQty(""); setRcvSupplierId(""); setRcvExpiryDate(""); setRcvFloor("2");
      fetchMedicines();
    } catch (err) {
      setRcvError(err instanceof Error ? err.message : t.common.error);
    } finally {
      setRcvSaving(false);
    }
  }

  // -- Patient search (debounced) --------------------------------------------
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

  // --- Filtered medicines ---------------------------------------------------

  const filteredMedicines = lowStockOnly
    ? medicines.filter((m) => m.quantity <= m.minStock)
    : medicines;

  // --- Medicine CRUD --------------------------------------------------------

  function openAddMedicineModal() {
    setEditingMedicine(null);
    setMedName("");
    setMedUnit("");
    setMedPrice("");
    setMedMinStock("");
    setMedQuantity("");
    setMedExpiryDate("");
    setMedSupplierId("");
    setMedFloor("2");
    setMedError(null);
    setShowMedicineModal(true);
  }

  function openEditMedicineModal(med: Medicine) {
    setEditingMedicine(med);
    setMedName(med.name);
    setMedUnit(med.unit);
    setMedPrice(String(med.price));
    setMedMinStock(String(med.minStock));
    setMedQuantity("");
    setMedExpiryDate(
      med.expiryDate ? med.expiryDate.slice(0, 10) : ""
    );
    setMedSupplierId(med.supplier?.id ?? "");
    setMedFloor(med.floor === 3 ? "3" : "2");
    setMedError(null);
    setShowMedicineModal(true);
  }

  async function handleWriteOff(med: Medicine) {
    if (!confirm(`"${med.name}" ni hisobdan chiqarasizmi? Bu amal qaytarib bo'lmaydi.`)) return;
    try {
      const res = await fetch(`/api/medicines/${med.id}`, {
        method: "PATCH",
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || t.common.error);
        return;
      }
      fetchMedicines();
    } catch {
      alert(t.common.error);
    }
  }

  async function handleMedicineSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMedSaving(true);
    setMedError(null);
    try {
      const floorValue = medFloor === "3" ? 3 : 2;
      const body: Record<string, string | number | null> = {
        name: medName.trim(),
        unit: medUnit.trim(),
        price: Number(medPrice),
        minStock: Number(medMinStock),
        expiryDate: medExpiryDate || null,
        supplierId: medSupplierId || null,
        floor: floorValue,
      };
      if (!editingMedicine) {
        body.quantity = medQuantity ? Number(medQuantity) : 0;
      }
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

  // --- Dispense -------------------------------------------------------------

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
        type: "OUT",
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

  // --- Supplier CRUD --------------------------------------------------------

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

  // --- Render ----------------------------------------------------------------

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Pill className="w-6 h-6 text-blue-600" />
          {t.pharmacy.title}
        </h1>
        <div className="flex gap-2">
          {activeTab === "medicines" && canCreateMedicine && (
            <button
              onClick={openAddMedicineModal}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              {t.pharmacy.addMedicine}
            </button>
          )}
          {activeTab === "suppliers" && canManageSuppliers && (
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
            ...(canCreateMedicine
              ? [{ key: "receive", label: "Qabul qilish" }]
              : []),
            ...(canWriteoff
              ? [{ key: "expiry", label: "Muddati & Chiqarish" }]
              : []),
            { key: "transactions", label: t.pharmacy.transactions },
            ...(canManageSuppliers
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
            <button
              onClick={() => setShowWrittenOff((v) => !v)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                showWrittenOff
                  ? "bg-slate-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Hisobdan chiqarilganlar
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
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">
                      Joylashuv
                    </th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-600">
                      {t.common.actions}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {medicinesLoading ? (
                    <tr>
                      <td colSpan={9} className="text-center py-12">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-500" />
                      </td>
                    </tr>
                  ) : filteredMedicines.length === 0 ? (
                    <tr>
                      <td
                        colSpan={9}
                        className="text-center py-12 text-slate-400"
                      >
                        {t.pharmacy.noMedicines}
                      </td>
                    </tr>
                  ) : (
                    filteredMedicines.map((med) => {
                      const isLow = med.quantity <= med.minStock;
                      const now = new Date();
                      const expiry = med.expiryDate ? new Date(med.expiryDate) : null;
                      const isExpired = expiry ? expiry < now : false;
                      const isExpiringSoon = expiry ? !isExpired && (expiry.getTime() - now.getTime()) < 30 * 24 * 60 * 60 * 1000 : false;
                      return (
                        <tr
                          key={med.id}
                          className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${isExpired ? 'bg-red-50' : ''}`}
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
                          <td className="px-4 py-3">
                            {med.expiryDate ? (
                              <span className={`font-medium ${isExpired ? 'text-red-700' : isExpiringSoon ? 'text-orange-600' : 'text-slate-500'}`}>
                                {new Date(med.expiryDate).toLocaleDateString("uz-UZ")}
                                {isExpired && <span className="ml-1 text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">Muddati o&apos;tgan</span>}
                                {isExpiringSoon && <span className="ml-1 text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full">Tez tugaydi</span>}
                              </span>
                            ) : "—"}
                          </td>
                          <td className="px-4 py-3 text-slate-500">
                            {med.supplier?.name ?? "—"}
                          </td>
                          <td className="px-4 py-3">
                            {med.floor === 2 ? (
                              <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full font-medium">2-qavat Amb.</span>
                            ) : med.floor === 3 ? (
                              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">3-qavat Stat.</span>
                            ) : (
                              <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              {med.writtenOff ? (
                                <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Chiqarilgan</span>
                              ) : (
                                <>
                                  {canDispense && (
                                    <button
                                      onClick={() => openDispenseModal(med)}
                                      className="flex items-center gap-1 px-2 py-1 text-xs bg-orange-50 text-orange-700 hover:bg-orange-100 rounded-md transition-colors font-medium"
                                    >
                                      <Pill className="w-3 h-3" />
                                      {t.pharmacy.dispenseMedicine}
                                    </button>
                                  )}
                                  {canEditMedicine && (
                                    <button
                                      onClick={() => openEditMedicineModal(med)}
                                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                                      title={t.common.edit}
                                    >
                                      <Pencil className="w-4 h-4" />
                                    </button>
                                  )}
                                  {canWriteoff && (isExpired || med.quantity === 0) && (
                                    <button
                                      onClick={() => handleWriteOff(med)}
                                      className="p-1.5 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded-md transition-colors"
                                      title="Hisobdan chiqarish"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
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

      {/* ═══ TAB: Qabul qilish (STOCK_IN) ═══ */}
      {activeTab === "receive" && canCreateMedicine && (
        <div className="max-w-lg">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2 mb-5">
              <PackagePlus className="w-5 h-5 text-green-600" />
              Dori qabul qilish (kirim)
            </h2>
            {rcvError && (
              <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm mb-4">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />{rcvError}
              </div>
            )}
            {rcvSuccess && (
              <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm mb-4">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />{rcvSuccess}
              </div>
            )}
            <form onSubmit={handleReceive} className="space-y-4">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">Dori <span className="text-red-500">*</span></label>
                <select
                  value={rcvMedicineId}
                  onChange={e => setRcvMedicineId(e.target.value)}
                  required
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="">— Dorini tanlang —</option>
                  {medicines.filter(m => !m.writtenOff).map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.unit}) — zaxira: {m.quantity}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-400">Yangi dori bo&apos;lsa avval &ldquo;Dorilar&rdquo; tabida qo&apos;shing</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-slate-700">Miqdor <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    min={1}
                    value={rcvQty}
                    onChange={e => setRcvQty(e.target.value)}
                    required
                    placeholder="0"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-slate-700">Saqlash muddati</label>
                  <input
                    type="date"
                    value={rcvExpiryDate}
                    onChange={e => setRcvExpiryDate(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-slate-700">Yetkazib beruvchi</label>
                  <select
                    value={rcvSupplierId}
                    onChange={e => setRcvSupplierId(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">— Ixtiyoriy —</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-slate-700">Shkaf joylashuvi</label>
                  <select
                    value={rcvFloor}
                    onChange={e => setRcvFloor(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">— O&apos;zgartirmaslik —</option>
                    <option value="2">2-qavat — Ambulator shkafi</option>
                    <option value="3">3-qavat — Statsionar shkafi</option>
                  </select>
                </div>
              </div>
              <button
                type="submit"
                disabled={rcvSaving}
                className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
              >
                {rcvSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <PackagePlus className="w-4 h-4" />}
                Qabul qilish
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ═══ TAB: Muddati & Hisobdan chiqarish ═══ */}
      {activeTab === "expiry" && canWriteoff && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <ShieldAlert className="w-5 h-5 text-orange-500" />
            <h2 className="text-base font-semibold text-slate-700">Muddati tugayotgan va o&apos;tgan dorilar</h2>
            <button onClick={fetchExpiryMeds} className="ml-auto text-xs text-slate-400 hover:text-slate-600 underline">Yangilash</button>
          </div>
          {expiryLoading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-orange-400" /></div>
          ) : expiryMeds.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
              <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">Muddati tugayotgan dori yo&apos;q</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left px-4 py-3 font-semibold text-slate-600">Dori nomi</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600">Joylashuv</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600">Miqdor</th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-600">Yaroqlilik muddati</th>
                      <th className="text-right px-4 py-3 font-semibold text-slate-600">Amal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expiryMeds.map(m => {
                      const exp = new Date(m.expiryDate!);
                      const now = new Date();
                      const isExpired = exp < now;
                      return (
                        <tr key={m.id} className={`border-b border-slate-100 ${isExpired ? "bg-red-50" : "bg-orange-50/40"}`}>
                          <td className="px-4 py-3 font-medium text-slate-800">{m.name}</td>
                          <td className="px-4 py-3">
                            {m.floor === 2 ? <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full">2-qavat Amb.</span>
                            : m.floor === 3 ? <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">3-qavat Stat.</span>
                            : <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">—</span>}
                          </td>
                          <td className="px-4 py-3 text-slate-700">{m.quantity} {m.unit}</td>
                          <td className="px-4 py-3">
                            <span className={`font-medium ${isExpired ? "text-red-700" : "text-orange-600"}`}>
                              {exp.toLocaleDateString("uz-UZ")}
                            </span>
                            <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${isExpired ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"}`}>
                              {isExpired ? "Muddati o'tgan" : "Tez tugaydi"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {canWriteoff && (
                              <button
                                disabled={writeOffingId === m.id}
                                onClick={async () => {
                                  if (!confirm(`"${m.name}" ni hisobdan chiqarasizmi?`)) return;
                                  setWriteOffingId(m.id);
                                  try {
                                    const res = await fetch(`/api/medicines/${m.id}`, { method: "PATCH" });
                                    if (!res.ok) { const e = await res.json(); alert(e.error); return; }
                                    fetchExpiryMeds();
                                  } finally { setWriteOffingId(null); }
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 rounded-lg transition-colors ml-auto disabled:opacity-50"
                              >
                                {writeOffingId === m.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                Hisobdan chiqarish
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
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
      {activeTab === "suppliers" && canManageSuppliers && (
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
                            {canManageSuppliers && (
                              <>
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
                              </>
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

              {!editingMedicine && (
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-slate-700">
                    Boshlang&apos;ich miqdor
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={medQuantity}
                    onChange={(e) => setMedQuantity(e.target.value)}
                    placeholder="0"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              )}

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

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">
                  Joylashuv
                </label>
                <select
                  value={medFloor}
                  onChange={(e) => setMedFloor(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="2">2-qavat — Ambulator shkafi</option>
                  <option value="3">3-qavat — Statsionar shkafi</option>
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
