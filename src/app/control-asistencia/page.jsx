"use client";

import { useEffect, useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { 
  getEmployees, saveEmployee, deleteEmployee,
  getAttendanceRecords, saveAttendanceRecord,
  getPayrollPeriods, savePayrollPeriod, deletePayrollPeriod,
  getPayrollConfig, savePayrollConfig,
  softDeletePayrollPeriod, restorePayrollPeriod, getTrashedPayrollPeriods,
  getLoans, saveLoan, deleteLoan
} from "@/lib/firestore";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useStore } from "@/context/StoreContext";
import { getLocalDateString, parseLocalDate } from "@/lib/dates";
import StoreHeader from "@/components/store/Header";
import StoreFooter from "@/components/store/Footer";
import { formatPrice } from "@/lib/format";
import * as XLSX from "xlsx";
import {
  HiOutlineUserGroup, HiOutlineClipboardDocumentCheck, HiOutlineBanknotes,
  HiOutlineChartBar, HiOutlineCog6Tooth, HiOutlinePlus, HiOutlineMagnifyingGlass,
  HiOutlinePencilSquare, HiOutlineTrash, HiOutlineCheckCircle, HiOutlineXCircle,
  HiOutlineClock, HiOutlineCalendarDays, HiOutlinePrinter, HiOutlineExclamationCircle,
  HiOutlineArrowUturnLeft, HiOutlineArchiveBoxXMark, HiOutlineWallet, HiOutlineReceiptPercent,
  HiOutlineArrowsRightLeft, HiOutlineDocumentArrowDown
} from "react-icons/hi2";
import styles from "./planilla.module.css";

const TABS = [
  { key: "empleados", label: "Empleados", icon: HiOutlineUserGroup },
  { key: "prestamos", label: "Préstamos", icon: HiOutlineWallet },
  { key: "asistencia", label: "Asistencia", icon: HiOutlineClipboardDocumentCheck },
  { key: "planilla", label: "Planilla", icon: HiOutlineBanknotes },
  { key: "reportes", label: "Reportes", icon: HiOutlineChartBar },
  { key: "configuracion", label: "Configuración", icon: HiOutlineCog6Tooth },
];

const ATTENDANCE_STATUS = [
  { key: "present", label: "Presente", color: "#10B981", icon: HiOutlineCheckCircle },
  { key: "late", label: "Tarde", color: "#F59E0B", icon: HiOutlineClock },
  { key: "absent", label: "Ausente", color: "#EF4444", icon: HiOutlineXCircle },
  { key: "permission", label: "Permiso", color: "#8B5CF6", icon: HiOutlineExclamationCircle },
  { key: "vacation", label: "Vacaciones", color: "#3B82F6", icon: HiOutlineCalendarDays },
  { key: "sick", label: "Incapacidad", color: "#F97316", icon: HiOutlineExclamationCircle },
  { key: "cross", label: "Cruce", color: "#6366F1", icon: HiOutlineArrowsRightLeft },
];

function timeToMinutes(t) {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function getScheduledMinutes(dayOfWeek, sched) {
  if (dayOfWeek === 0 || dayOfWeek === 6) return 0;
  const inTime = dayOfWeek === 5 ? sched.friIn : sched.monThuIn;
  const outTime = dayOfWeek === 5 ? sched.friOut : sched.monThuOut;
  return Math.max(0, timeToMinutes(outTime) - timeToMinutes(inTime) - (sched.lunchMinutes || 60));
}

function getActualMinutes(clockIn, clockOut, lunchMinutes = 0) {
  if (!clockIn || !clockOut) return 0;
  return Math.max(0, timeToMinutes(clockOut) - timeToMinutes(clockIn) - lunchMinutes);
}

function formatMinutes(m) {
  const h = Math.floor(m / 60);
  const min = Math.round(m % 60);
  return `${h}h ${min}m`;
}

function calculateISR(taxableIncome, type = "biweekly") {
  if (taxableIncome <= 0) return 0;
  
  if (type === "biweekly") {
    // Tabla Quincenal de ISR de El Salvador
    if (taxableIncome <= 236.00) {
      return 0;
    } else if (taxableIncome <= 447.62) {
      return (taxableIncome - 236.00) * 0.10 + 8.83;
    } else if (taxableIncome <= 1019.05) {
      return (taxableIncome - 447.62) * 0.20 + 30.00;
    } else {
      return (taxableIncome - 1019.05) * 0.30 + 144.28;
    }
  } else {
    // Tabla Mensual de ISR de El Salvador
    if (taxableIncome <= 472.00) {
      return 0;
    } else if (taxableIncome <= 895.24) {
      return (taxableIncome - 472.00) * 0.10 + 17.67;
    } else if (taxableIncome <= 2038.10) {
      return (taxableIncome - 895.24) * 0.20 + 60.00;
    } else {
      return (taxableIncome - 2038.10) * 0.30 + 288.57;
    }
  }
}

function numberToWordsSpan(num) {
  const integerPart = Math.floor(num);
  const decimalPart = Math.round((num - integerPart) * 100);
  return `Son: ${formatPrice(num)} Dólares USD`;
}


export default function ControlAsistenciaPage() {
  const { user, hasPermission, canManage, loading: authLoading } = useAuth();
  const { settings } = useStore();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const payrollAccess = hasPermission("payroll");
  const isAdmin = canManage("payroll");

  const [activeTab, setActiveTab] = useState("empleados");
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState([]);
  const [config, setConfig] = useState({
    minimumWage: 408.80,
    currency: "$",
    overtimeRate: 2,
    isssRate: 0.03,
    afpRate: 0.0725,
    isssEmployerRate: 0.075,
    afpEmployerRate: 0.0875,
    departments: ["Ventas", "Administración", "Bodega", "Logística"],
    positions: ["Vendedor", "Gerente", "Bodeguero", "Repartidor"],
    schedule: {
      monThuIn: "08:00", monThuOut: "18:00",
      friIn: "08:00", friOut: "17:00",
      lunchMinutes: 60
    }
  });

  const [empSearch, setEmpSearch] = useState("");
  const [showEmpModal, setShowEmpModal] = useState(false);
  const [editingEmp, setEditingEmp] = useState(null);
  const [empForm, setEmpForm] = useState({
    name: "", email: "", phone: "", dui: "", position: "", department: "",
    baseSalary: 408.80, status: "active", hireDate: getLocalDateString()
  });
  const [showNewDept, setShowNewDept] = useState(false);
  const [showNewPosition, setShowNewPosition] = useState(false);
  const [newDeptName, setNewDeptName] = useState("");
  const [newPositionName, setNewPositionName] = useState("");

  const [selectedDate, setSelectedDate] = useState(getLocalDateString());
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [attLoading, setAttLoading] = useState(false);
  const [selectedEmpIds, setSelectedEmpIds] = useState(new Set());

  const [periods, setPeriods] = useState([]);
  const [selectedPeriodDetail, setSelectedPeriodDetail] = useState(null);
  const [periodAttendance, setPeriodAttendance] = useState([]);
  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [periodForm, setPeriodForm] = useState({
    name: "", startDate: "", endDate: "", type: "monthly"
  });

  const [showGenPeriodsModal, setShowGenPeriodsModal] = useState(false);
  const [genPeriodStart, setGenPeriodStart] = useState("");
  const [genPeriodEnd, setGenPeriodEnd] = useState("");
  const [showTrashModal, setShowTrashModal] = useState(false);
  const [trashedPeriods, setTrashedPeriods] = useState([]);
  const [showEmpDeductionsModal, setShowEmpDeductionsModal] = useState(false);
  const [deductionEmp, setDeductionEmp] = useState(null);
  const [deductionDesc, setDeductionDesc] = useState("");
  const [deductionAmount, setDeductionAmount] = useState("");

  // States for loans & print receipt
  const [loans, setLoans] = useState([]);
  const [showLoanModal, setShowLoanModal] = useState(false);
  const [loanForm, setLoanForm] = useState({
    employeeId: "",
    description: "",
    amount: "",
    cuotas: 1,
    cuotaVal: "",
    frequency: "always"
  });
  const [loanSearch, setLoanSearch] = useState("");
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptData, setReceiptData] = useState(null);

  const [repDateFrom, setRepDateFrom] = useState("");
  const [repDateTo, setRepDateTo] = useState("");
  const [repEmpFilter, setRepEmpFilter] = useState("all");
  const [repSelectedEmps, setRepSelectedEmps] = useState(new Set());
  const [repColumns, setRepColumns] = useState({
    horasProg: true, horasReal: true, horasExt: true, pagoHE: true,
    presentes: true, ausencias: true, permisos: true,
    descAsist: true, isss: true, afp: true, isr: true,
    prestamos: true, descExtras: true, totalDesc: true, neto: true
  });
  const [repResults, setRepResults] = useState(null);
  const [repLoading, setRepLoading] = useState(false);

  const [toast, setToast] = useState(null);

  const loadInitialData = useCallback(async () => {
    setLoading(true);
    try {
      const [empList, confData, periodList, loanList] = await Promise.all([
        getEmployees(),
        getPayrollConfig(),
        getPayrollPeriods(),
        getLoans()
      ]);
      setEmployees(empList);
      if (confData) setConfig(confData);
      setPeriods(periodList);
      setLoans(loanList || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAttendance = useCallback(async (date) => {
    setAttLoading(true);
    try {
      const records = await getAttendanceRecords({ date });
      setAttendanceRecords(records);
    } catch (e) {
      console.error(e);
    } finally {
      setAttLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth/login", { state: { from: pathname } });
    if (!authLoading && user && !payrollAccess) navigate("/auth/login", { state: { from: pathname } });
    if (user && payrollAccess) loadInitialData();
  }, [user, authLoading, payrollAccess, navigate, loadInitialData]);

  useEffect(() => {
    if (user && payrollAccess && activeTab === "asistencia") {
      loadAttendance(selectedDate);
    }
  }, [selectedDate, activeTab, user, payrollAccess, loadAttendance]);

  useEffect(() => {
    if (selectedPeriodDetail?.startDate && selectedPeriodDetail?.endDate) {
      getAttendanceRecords({
        dateFrom: selectedPeriodDetail.startDate,
        dateTo: selectedPeriodDetail.endDate
      }).then(setPeriodAttendance);
    }
  }, [selectedPeriodDetail]);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  function normalizeNum(val) {
    return String(val ?? '').replace(',', '.')
  }

  const handleSaveEmployee = async (e) => {
    e.preventDefault();
    try {
      const { id: _, ...rest } = empForm;
      const dataToSave = {
        ...rest,
        baseSalary: parseFloat(normalizeNum(empForm.baseSalary)) || 0
      };
      await saveEmployee(editingEmp?.id || null, dataToSave);
      showToast(editingEmp ? "Empleado actualizado" : "Empleado creado");
      setShowEmpModal(false);
      const list = await getEmployees();
      setEmployees(list);
    } catch (e) {
      console.error("Save error:", e);
      alert("Error al guardar empleado: " + e.message);
    }
  };

  const handleSaveLoan = async (e) => {
    e.preventDefault();
    try {
      const emp = employees.find(emp => emp.id === loanForm.employeeId);
      if (!emp) {
        alert("Selecciona un empleado válido");
        return;
      }
      const amt = parseFloat(normalizeNum(loanForm.amount)) || 0;
      const cts = parseInt(loanForm.cuotas) || 1;
      const cVal = parseFloat(normalizeNum(loanForm.cuotaVal)) || (amt / cts);

      const dataToSave = {
        employeeId: loanForm.employeeId,
        employeeName: emp.name,
        description: loanForm.description,
        amount: amt,
        cuotas: cts,
        cuotaVal: cVal,
        remainingBalance: amt,
        paidCuotas: 0,
        frequency: loanForm.frequency,
        status: "active",
      };
      await saveLoan(null, dataToSave);
      showToast("Préstamo registrado con éxito");
      setShowLoanModal(false);
      setLoanForm({
        employeeId: "",
        description: "",
        amount: "",
        cuotas: 1,
        cuotaVal: "",
        frequency: "always",
      });
      const list = await getLoans();
      setLoans(list);
    } catch (e) {
      console.error("Save loan error:", e);
      alert("Error al guardar préstamo: " + e.message);
    }
  };

  const handleAddDept = async () => {
    const name = newDeptName.trim();
    if (!name || config.departments.includes(name)) return;
    const updated = { ...config, departments: [...config.departments, name] };
    try {
      await savePayrollConfig(updated);
      setConfig(updated);
      setEmpForm({ ...empForm, department: name });
      setNewDeptName("");
      setShowNewDept(false);
      showToast("Departamento creado");
    } catch (e) { alert("Error al guardar"); }
  };

  const handleAddPosition = async () => {
    const name = newPositionName.trim();
    if (!name || config.positions.includes(name)) return;
    const updated = { ...config, positions: [...config.positions, name] };
    try {
      await savePayrollConfig(updated);
      setConfig(updated);
      setEmpForm({ ...empForm, position: name });
      setNewPositionName("");
      setShowNewPosition(false);
      showToast("Cargo creado");
    } catch (e) { alert("Error al guardar"); }
  };

  const handleExportExcel = (tabKey) => {
    let data = [];
    let filename = "";
    switch (tabKey) {
      case "empleados":
        data = employees.map(e => ({
          "Nombre": e.name, "Email": e.email || "", "Teléfono": e.phone || "", "DUI": e.dui || "",
          "Cargo": e.position || "", "Departamento": e.department || "",
          "Salario Base": e.baseSalary, "Estado": e.status === "active" ? "Activo" : "Inactivo"
        }));
        filename = `Empleados_${getLocalDateString()}.xlsx`;
        break;
      case "prestamos":
        data = loans.map(l => ({
          "Empleado": l.employeeName, "Descripción": l.description || "",
          "Monto Total": l.amount, "Cuotas": l.cuotas, "Pagadas": l.paidCuotas || 0,
          "Saldo Pendiente": l.remainingBalance || 0,
          "Frecuencia": l.frequency === "q2" ? "Solo Q2/Fin mes" : "Cada quincena",
          "Estado": l.status === "active" ? "Activo" : "Finalizado"
        }));
        filename = `Préstamos_${getLocalDateString()}.xlsx`;
        break;
      case "asistencia":
        data = employees.filter(e => e.status === "active").map(emp => {
          const record = attendanceRecords.find(r => r.employeeId === emp.id);
          const scheduledMin = getScheduledMinutes(parseLocalDate(selectedDate).getDay(), config.schedule);
          const actualMin = getActualMinutes(record?.clockIn, record?.clockOut, config.schedule.lunchMinutes || 60);
          const diffMin = actualMin - scheduledMin;
          return {
            "Empleado": emp.name,
            "Estado": record ? (ATTENDANCE_STATUS.find(s => s.key === record.status)?.label || "—") : "—",
            "Programado": scheduledMin > 0 ? formatMinutes(scheduledMin) : "—",
            "Entrada": record?.clockIn || "—",
            "Salida": record?.clockOut || "—",
            "Real": actualMin > 0 ? formatMinutes(actualMin) : "—",
            "Diferencia": scheduledMin > 0 && record ? (diffMin >= 0 ? "+" : "") + formatMinutes(Math.abs(diffMin)) : "—"
          };
        });
        filename = `Asistencia_${selectedDate}.xlsx`;
        break;
      case "planilla":
        if (!selectedPeriodDetail) return;
        data = (selectedPeriodDetail.employees || []).map(emp => ({
          "Empleado": emp.employeeName,
          "Salario Base": emp.baseSalary || 0,
          "Hrs Prog.": emp.scheduledHours?.toFixed(1) || 0,
          "Hrs Real": emp.actualHours?.toFixed(1) || 0,
          "Hrs Ext.": emp.overtimeHours?.toFixed(1) || 0,
          "Pago HE": emp.overtimePay || 0,
          "Desc. Asist.": (emp.absentDeduction + emp.tardinessDeduction) || 0,
          "ISSS": emp.isss || 0,
          "AFP": emp.afp || 0,
          "ISR": emp.isr || 0,
          "Préstamos": emp.totalLoanDeductions || 0,
          "Desc. Extras": emp.totalExtraDeductions || 0,
          "Neto": emp.netPay || 0
        }));
        filename = `Planilla_${selectedPeriodDetail.name || selectedPeriodDetail.startDate}_${getLocalDateString()}.xlsx`;
        break;
    }
    if (data.length === 0) { showToast("No hay datos para exportar", "error"); return; }
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Datos");
    XLSX.writeFile(wb, filename);
    showToast("Excel exportado");
  };

  const handlePrintTab = (tabKey) => {
    const w = window.open("about:blank", "tabImpresion");
    if (!w) { alert("El navegador bloqueó la ventana de impresión."); return; }
    let title = "", rows = "";
    const styles = `<style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:Arial,sans-serif;padding:30px;color:#0F172A}
      h1{font-size:18px;margin-bottom:6px;color:#0F172A}
      .date{font-size:12px;color:#64748B;margin-bottom:20px}
      table{width:100%;border-collapse:collapse;font-size:13px}
      th{background:#E2E8F0;padding:8px 10px;text-align:left;font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;border-bottom:2px solid #CBD5E1}
      td{padding:7px 10px;border-bottom:1px solid #E2E8F0}
      tr:nth-child(even){background:#FAFBFC}
      tr:hover{background:#EEF2FF}
      .r{text-align:right}
      @media print{body{padding:15px}}
    </style>`;
    switch (tabKey) {
      case "empleados": {
        title = "Empleados";
        const filtered = employees.filter(e => e.name.toLowerCase().includes(empSearch.toLowerCase()));
        rows = `<table><thead><tr><th>Nombre</th><th>Cargo</th><th>DUI</th><th class="r">Salario</th><th>Estado</th></tr></thead><tbody>`
          + filtered.map(e => `<tr><td><strong>${e.name}</strong></td><td>${e.position || "—"}</td><td>${e.dui || "—"}</td><td class="r">${formatPrice(e.baseSalary)}</td><td>${e.status === "active" ? "Activo" : "Inactivo"}</td></tr>`).join("")
          + `</tbody></table>`;
        break;
      }
      case "prestamos": {
        title = "Préstamos";
        const filtered = loans.filter(l => !loanSearch || l.employeeName?.toLowerCase().includes(loanSearch.toLowerCase()) || l.description?.toLowerCase().includes(loanSearch.toLowerCase()));
        rows = `<table><thead><tr><th>Empleado</th><th>Descripción</th><th class="r">Monto</th><th>Cuotas</th><th class="r">Saldo</th><th>Estado</th></tr></thead><tbody>`
          + filtered.map(l => `<tr><td><strong>${l.employeeName}</strong></td><td>${l.description || "—"}</td><td class="r">${formatPrice(l.amount)}</td><td>${l.paidCuotas || 0}/${l.cuotas}</td><td class="r">${formatPrice(l.remainingBalance || 0)}</td><td>${l.status === "active" ? "Activo" : "Finalizado"}</td></tr>`).join("")
          + `</tbody></table>`;
        break;
      }
      case "asistencia": {
        title = `Asistencia - ${selectedDate}`;
        const active = employees.filter(e => e.status === "active");
        rows = `<table><thead><tr><th>Empleado</th><th>Estado</th><th class="r">Prog.</th><th>Entrada</th><th>Salida</th><th class="r">Real</th><th class="r">Dif.</th></tr></thead><tbody>`
          + active.map(emp => {
              const record = attendanceRecords.find(r => r.employeeId === emp.id);
              const scheduledMin = getScheduledMinutes(parseLocalDate(selectedDate).getDay(), config.schedule);
              const actualMin = getActualMinutes(record?.clockIn, record?.clockOut, config.schedule.lunchMinutes || 60);
              const diffMin = actualMin - scheduledMin;
              const diffStr = scheduledMin > 0 && record ? (diffMin >= 0 ? "+" : "") + formatMinutes(Math.abs(diffMin)) : "—";
              return `<tr><td><strong>${emp.name}</strong></td><td>${record ? (ATTENDANCE_STATUS.find(s => s.key === record.status)?.label || "—") : "—"}</td><td class="r">${scheduledMin > 0 ? formatMinutes(scheduledMin) : "—"}</td><td>${record?.clockIn || "—"}</td><td>${record?.clockOut || "—"}</td><td class="r">${actualMin > 0 ? formatMinutes(actualMin) : "—"}</td><td class="r">${diffStr}</td></tr>`;
            }).join("")
          + `</tbody></table>`;
        break;
      }
      case "planilla": {
        if (!selectedPeriodDetail) { w.close(); return; }
        title = `Planilla - ${selectedPeriodDetail.name || selectedPeriodDetail.startDate + " a " + selectedPeriodDetail.endDate}`;
        rows = `<table><thead><tr><th>Empleado</th><th class="r">Salario</th><th class="r">Hrs Prog.</th><th class="r">Hrs Real</th><th class="r">Hrs Ext.</th><th class="r">Pago HE</th><th class="r">Desc.</th><th class="r">ISSS</th><th class="r">AFP</th><th class="r">ISR</th><th class="r">Neto</th></tr></thead><tbody>`
          + (selectedPeriodDetail.employees || []).map(emp => `<tr><td><strong>${emp.employeeName}</strong></td><td class="r">${formatPrice(emp.baseSalary)}</td><td class="r">${(emp.scheduledHours || 0).toFixed(1)}</td><td class="r">${(emp.actualHours || 0).toFixed(1)}</td><td class="r">${(emp.overtimeHours || 0).toFixed(1)}</td><td class="r">${emp.overtimePay ? formatPrice(emp.overtimePay) : "—"}</td><td class="r">${(emp.absentDeduction + emp.tardinessDeduction) > 0 ? formatPrice(emp.absentDeduction + emp.tardinessDeduction) : "—"}</td><td class="r">${formatPrice(emp.isss)}</td><td class="r">${formatPrice(emp.afp)}</td><td class="r">${emp.isr ? formatPrice(emp.isr) : "—"}</td><td class="r"><strong>${formatPrice(emp.netPay)}</strong></td></tr>`).join("")
          + `</tbody></table>`;
        break;
      }
      default: return;
    }
    const dateStr = new Date().toLocaleDateString("es-SV", { day: "2-digit", month: "long", year: "numeric" });
    w.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>${title}</title>${styles}</head><body><h1>${title}</h1><div class="date">Emitido: ${dateStr}</div>${rows}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 500);
  };

  const handleGenerateReport = async () => {
    if (!repDateFrom || !repDateTo) { showToast("Seleccioná un rango de fechas", "error"); return; }
    setRepLoading(true);
    try {
      const records = await getAttendanceRecords({ dateFrom: repDateFrom, dateTo: repDateTo });
      const activeLoans = loans.filter(l => l.status === "active");
      const activeEmps = employees.filter(e => e.status === "active" && (repEmpFilter === "all" || repSelectedEmps.has(e.id)));
      if (activeEmps.length === 0) { showToast("No hay empleados seleccionados", "error"); setRepLoading(false); return; }

      const start = parseLocalDate(repDateFrom);
      const end = parseLocalDate(repDateTo);
      if (start > end) { showToast("La fecha inicio debe ser anterior a fin", "error"); setRepLoading(false); return; }

      const results = activeEmps.map(emp => {
        const empRecords = records.filter(r => r.employeeId === emp.id);
        let totalScheduledMin = 0, totalActualMin = 0, totalOvertimeMin = 0, totalLateMin = 0;
        let daysPresent = 0, daysAbsent = 0, daysPaidLeave = 0;

        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const dow = d.getDay();
          const scheduledMin = getScheduledMinutes(dow, config.schedule);
          if (scheduledMin > 0) {
            totalScheduledMin += scheduledMin;
            const dateStr = getLocalDateString(d);
            const rec = empRecords.find(r => r.date === dateStr);
            const schedIn = dow === 5 ? config.schedule.friIn : config.schedule.monThuIn;
            const schedOut = dow === 5 ? config.schedule.friOut : config.schedule.monThuOut;

            if (rec) {
              if (rec.status === "absent") { daysAbsent += 1; }
              else if (rec.status === "present" || rec.status === "late") {
                daysPresent += 1;
                totalActualMin += getActualMinutes(rec.clockIn, rec.clockOut, config.schedule.lunchMinutes || 60);
                if (rec.clockIn && schedIn) {
                  const diff = timeToMinutes(rec.clockIn) - timeToMinutes(schedIn);
                  if (diff > 0) totalLateMin += diff;
                }
                if (rec.clockOut && schedOut) {
                  const diff = timeToMinutes(rec.clockOut) - timeToMinutes(schedOut);
                  if (diff > 0) totalOvertimeMin += diff;
                  else if (diff < 0) totalLateMin += Math.abs(diff);
                }
              } else if (["permission", "vacation", "sick", "cross"].includes(rec.status)) {
                daysPaidLeave += 1;
              }
            } else {
              if (dateStr <= getLocalDateString()) daysAbsent += 1;
            }
          }
        }

        const baseSalary = emp.baseSalary;
        const dailyRate = baseSalary / 30;
        const hourlyRate = dailyRate / 8;
        const minuteRate = hourlyRate / 60;
        const overtimePay = (totalOvertimeMin / 60) * hourlyRate * (config.overtimeRate || 2);
        const absentDeduction = daysAbsent * dailyRate;
        const tardinessDeduction = totalLateMin * minuteRate;
        const taxableGross = Math.max(0, baseSalary + overtimePay - absentDeduction - tardinessDeduction);
        const isssCap = 30;
        const isssDeduction = Math.min(taxableGross * (config.isssRate || 0.03), isssCap);
        const afpDeduction = taxableGross * (config.afpRate || 0.0725);
        const taxableIncome = Math.max(0, taxableGross - isssDeduction - afpDeduction);
        const isrDeduction = calculateISR(taxableIncome, "monthly");

        const empLoans = activeLoans.filter(l => l.employeeId === emp.id && l.remainingBalance > 0);
        const totalLoanDeductions = empLoans.reduce((s, l) => s + Math.min(l.cuotaVal, l.remainingBalance), 0);

        return {
          employeeId: emp.id, employeeName: emp.name,
          scheduledHours: totalScheduledMin / 60, actualHours: totalActualMin / 60,
          overtimeHours: totalOvertimeMin / 60, overtimePay,
          daysPresent, daysAbsent, daysPaidLeave,
          absentDeduction, tardinessDeduction,
          isss: isssDeduction, afp: afpDeduction, isr: isrDeduction,
          totalLoanDeductions, totalExtraDeductions: 0,
          totalDeductions: isssDeduction + afpDeduction + isrDeduction + absentDeduction + tardinessDeduction + totalLoanDeductions,
          netPay: Math.max(0, baseSalary + overtimePay - isssDeduction - afpDeduction - isrDeduction - absentDeduction - tardinessDeduction - totalLoanDeductions)
        };
      });

      setRepResults(results);
      showToast("Reporte generado con " + results.length + " empleados");
    } catch (e) {
      console.error("Report error:", e);
      showToast("Error al generar reporte", "error");
    } finally {
      setRepLoading(false);
    }
  };

  const handlePrintReceipt = () => {
    const empDetail = employees.find(e => e.id === receiptData.employeeId);
    const periodType = selectedPeriodDetail?.type === "biweekly" ? "Quincenal" : "Mensual";
    const totalIncome = receiptData.baseSalary + (receiptData.overtimePay || 0);
    
    const html = `
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Boleta de Pago</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Courier New',Courier,monospace;color:#0F172A;max-width:720px;margin:0 auto;padding:20px}
  .hdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #CBD5E1;padding-bottom:12px;margin-bottom:12px}
  .hdr h2{font-size:16px;font-weight:800;color:#0F172A}
  .hdr-info{font-size:11px;color:#64748B}
  .hdr-right{text-align:right}
  .hdr-right h3{font-size:12px;font-weight:800;color:#4F46E5;text-transform:uppercase;letter-spacing:1px}
  .hdr-right span{font-size:11px;color:#64748B}
  .emp{display:grid;grid-template-columns:1fr 1fr;gap:4px 16px;padding:12px 0;border-bottom:2px dashed #CBD5E1;margin-bottom:12px}
  .emp div{font-size:12px;display:flex;gap:6px}
  .emp label{color:#64748B;font-weight:600;min-width:110px}
  .emp span{color:#0F172A;font-weight:500}
  .cols{display:grid;grid-template-columns:1fr 1fr;border-bottom:2px dashed #CBD5E1}
  .col{padding:12px 16px;border-right:1px dashed #CBD5E1}
  .col:last-child{border-right:none}
  .col h4{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#475569;border-bottom:1px solid #E2E8F0;padding-bottom:6px;margin-bottom:8px}
  .row{display:flex;justify-content:space-between;font-size:12px;padding:3px 0;border-bottom:1px dotted #E2E8F0;gap:8px}
  .row span:last-child{font-weight:600;text-align:right;white-space:nowrap}
  .row-total{display:flex;justify-content:space-between;font-size:13px;padding:6px 0;font-weight:700;border-top:2px solid #CBD5E1;margin-top:4px;gap:8px}
  .row-total span:last-child{text-align:right;white-space:nowrap}
  .deduction{color:#DC2626}
  .neto{border-top:2px solid #E2E8F0;text-align:center;padding:16px 0;border-bottom:2px dashed #CBD5E1}
  .neto label{font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#4F46E5;margin-bottom:4px}
  .neto .amount{font-size:30px;font-weight:900;color:#0F172A}
  .neto .words{font-size:11px;color:#64748B;font-style:italic}
  .signatures{display:flex;justify-content:space-around;padding:16px 0;border-bottom:2px dashed #CBD5E1;gap:16px}
  .sig{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;max-width:220px}
  .sig-line{width:100%;height:1px;background:#0F172A;margin-top:36px}
  .sig-label{font-size:10px;color:#475569;text-align:center;font-family:sans-serif}
  .footer{display:flex;justify-content:space-between;padding:10px 0;font-size:10px;color:#94A3B8;font-family:sans-serif}
  @media print{body{padding:0}}
</style>
</head>
<body>
  <div class="hdr">
    <div>
      <h2>${settings?.name || "Empresa"}</h2>
      <div class="hdr-info">
        ${settings?.address ? `<div>${settings.address}</div>` : ""}
        ${settings?.phone ? `<div>Tel: ${settings.phone}</div>` : ""}
        ${settings?.email ? `<div>${settings.email}</div>` : ""}
      </div>
    </div>
    <div class="hdr-right">
      <h3>BOLETA DE PAGO DE SUELDO</h3>
      <div>Período: ${selectedPeriodDetail?.startDate} al ${selectedPeriodDetail?.endDate}</div>
      <div>(${selectedPeriodDetail?.type === "biweekly" ? "Quincenal" : "Mensual"})</div>
    </div>
  </div>

  <div class="emp">
    <div><label>Empleado:</label><span><strong>${receiptData.employeeName}</strong></span></div>
    ${empDetail?.dui ? `<div><label>DUI:</label><span>${empDetail.dui}</span></div>` : ""}
    ${empDetail?.position ? `<div><label>Cargo:</label><span>${empDetail.position}</span></div>` : ""}
    ${empDetail?.department ? `<div><label>Departamento:</label><span>${empDetail.department}</span></div>` : ""}
    ${empDetail?.hireDate ? `<div><label>Contratación:</label><span>${empDetail.hireDate}</span></div>` : ""}
  </div>

  <div class="cols">
    <div class="col">
      <h4>INGRESOS (Percepciones)</h4>
      <div class="row"><span>Salario Base ${periodType}</span><span>${formatPrice(receiptData.baseSalary)}</span></div>
      ${receiptData.overtimePay > 0 ? `<div class="row"><span>Horas Extras (${receiptData.overtimeHours?.toFixed(1)}h)</span><span>${formatPrice(receiptData.overtimePay)}</span></div>` : ""}
      <div class="row-total"><span>Total Ingresos</span><span>${formatPrice(totalIncome)}</span></div>
    </div>
    <div class="col">
      <h4>DEDUCCIONES (Egresos)</h4>
      ${(receiptData.absentDeduction + receiptData.tardinessDeduction) > 0 ? `
      <div class="row deduction"><span>Desc. Asistencia${receiptData.daysAbsent > 0 ? ` (${receiptData.daysAbsent} ausencia(s))` : ""}${receiptData.lateMinutes > 0 ? ` + ${formatMinutes(receiptData.lateMinutes)} tardanza` : ""}</span><span>−${formatPrice(receiptData.absentDeduction + receiptData.tardinessDeduction)}</span></div>
      ` : ""}
      <div class="row"><span>ISSS (3.0%)</span><span>−${formatPrice(receiptData.isss)}</span></div>
      <div class="row"><span>AFP (7.25%)</span><span>−${formatPrice(receiptData.afp)}</span></div>
      ${receiptData.isr > 0 ? `<div class="row"><span>Impuesto s/Renta (ISR)</span><span>−${formatPrice(receiptData.isr)}</span></div>` : ""}
      ${(receiptData.loanDeductions || []).map(ld => `<div class="row deduction"><span>${ld.description}</span><span>−${formatPrice(ld.amount)}</span></div>`).join("")}
      ${(receiptData.deductions || []).map(d => `<div class="row deduction"><span>${d.description}</span><span>−${formatPrice(d.amount)}</span></div>`).join("")}
      <div class="row-total deduction"><span>Total Deducciones</span><span>−${formatPrice(receiptData.totalDeductions)}</span></div>
    </div>
  </div>

  <div class="neto">
    <label>NETO A RECIBIR</label>
    <div class="amount">${formatPrice(receiptData.netPay)}</div>
    <div class="words">Son: ${formatPrice(receiptData.netPay)} Dólares USD</div>
  </div>

  <div class="signatures">
    <div class="sig">
      <div class="sig-line"></div>
      <div class="sig-label">Firma Empleado</div>
      <div class="sig-label" style="font-size:11px;margin-top:2px">${receiptData.employeeName}</div>
    </div>
    <div class="sig">
      <div class="sig-line"></div>
      <div class="sig-label">Firma Patrono / Responsable</div>
    </div>
  </div>

  <div class="footer">
    <span>Emitido: ${new Date().toLocaleDateString("es-SV", { day: "2-digit", month: "long", year: "numeric" })}</span>
    <span>Sistema de Planilla · ${settings?.name || ""}</span>
  </div>
</body>
</html>`;

    const w = window.open("about:blank", "boletaImpresion");
    if (!w) {
      alert("El navegador bloqueó la ventana de impresión. Permití los pop-ups para este sitio.");
      return;
    }
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 500);
  };

  const handleSaveConfig = async () => {
    try {
      const configToSave = {
        ...config,
        minimumWage: parseFloat(normalizeNum(config.minimumWage)) || 0,
        isssRate: parseFloat(config.isssRate) || 0,
        afpRate: parseFloat(config.afpRate) || 0
      };
      await savePayrollConfig(configToSave);
      showToast("Configuración guardada");
    } catch (e) {
      alert("Error al guardar configuración");
    }
  };

  const updateClockTime = async (employee, field, value) => {
    const existing = attendanceRecords.find(r => r.employeeId === employee.id);
    try {
      if (existing) {
        await saveAttendanceRecord(existing.id, { ...existing, [field]: value });
      } else {
        await saveAttendanceRecord(null, {
          employeeId: employee.id,
          employeeName: employee.name,
          date: selectedDate,
          status: "present",
          clockIn: field === 'clockIn' ? value : "",
          clockOut: field === 'clockOut' ? value : "",
          markedBy: user.email
        });
      }
      const records = await getAttendanceRecords({ date: selectedDate });
      setAttendanceRecords(records);
    } catch (e) {
      console.error(e);
    }
  };

  const markAttendance = async (employee, status) => {
    if (!isAdmin) return;
    const existing = attendanceRecords.find(r => r.employeeId === employee.id);
    const dayOfWeek = parseLocalDate(selectedDate).getDay();
    
    let defaultIn = dayOfWeek === 5 ? config.schedule.friIn : config.schedule.monThuIn;
    let defaultOut = dayOfWeek === 5 ? config.schedule.friOut : config.schedule.monThuOut;

    const data = {
      employeeId: employee.id,
      employeeName: employee.name,
      date: selectedDate,
      status: status,
      clockIn: (status === "present" || status === "late") ? defaultIn : "",
      clockOut: (status === "present" || status === "late") ? defaultOut : "",
      markedBy: user.email
    };

    if (status === "cross") {
      data.clockIn = "";
      data.clockOut = "";
    }

    try {
      await saveAttendanceRecord(existing?.id || null, data);
      const records = await getAttendanceRecords({ date: selectedDate });
      setAttendanceRecords(records);
    } catch (e) {
      console.error(e);
    }
  };

  const toggleSelectEmp = (empId) => {
    setSelectedEmpIds(prev => {
      const next = new Set(prev);
      if (next.has(empId)) next.delete(empId);
      else next.add(empId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const active = employees.filter(e => e.status === "active");
    setSelectedEmpIds(prev => prev.size === active.length ? new Set() : new Set(active.map(e => e.id)));
  };

  const bulkMarkAttendance = async (status) => {
    if (!isAdmin || selectedEmpIds.size === 0) return;
    const dayOfWeek = parseLocalDate(selectedDate).getDay();
    const defaultIn = dayOfWeek === 5 ? config.schedule.friIn : config.schedule.monThuIn;
    const defaultOut = dayOfWeek === 5 ? config.schedule.friOut : config.schedule.monThuOut;
    try {
      await Promise.all(Array.from(selectedEmpIds).map(async (empId) => {
        const emp = employees.find(e => e.id === empId);
        if (!emp) return;
        const existing = attendanceRecords.find(r => r.employeeId === empId);
        const recData = {
          employeeId: empId,
          employeeName: emp.name,
          date: selectedDate,
          status,
          clockIn: (status === "present" || status === "late") ? defaultIn : "",
          clockOut: (status === "present" || status === "late") ? defaultOut : "",
          markedBy: user.email
        };
        if (status === "cross") { recData.clockIn = ""; recData.clockOut = ""; }
        await saveAttendanceRecord(existing?.id || null, recData);
      }));
      const records = await getAttendanceRecords({ date: selectedDate });
      setAttendanceRecords(records);
      setSelectedEmpIds(new Set());
      showToast(selectedEmpIds.size + " empleados marcados como " + ATTENDANCE_STATUS.find(s => s.key === status)?.label);
    } catch (e) {
      console.error(e);
    }
  };

  const generatePeriods = async () => {
    if (!genPeriodStart || !genPeriodEnd) {
      alert("Selecciona una fecha de inicio y fin");
      return;
    }
    if (genPeriodStart > genPeriodEnd) {
      alert("La fecha de inicio debe ser anterior a la fecha de fin");
      return;
    }
    try {
      const start = parseLocalDate(genPeriodStart);
      const end = parseLocalDate(genPeriodEnd);
      let current = new Date(start);
      let qCount = 1;
      const periodsToSave = [];
      const monthsMap = {};

      while (current <= end) {
        const y = current.getFullYear();
        const m = current.getMonth() + 1;
        const monthKey = `${y}-${String(m).padStart(2, "0")}`;
        const monthName = new Date(y, m - 1, 1).toLocaleString("es", { month: "long" });
        const capitalMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
        const lastDay = new Date(y, m, 0).getDate();

        const q1Start = `${monthKey}-01`;
        const q1End = `${monthKey}-15`;
        const q2Start = `${monthKey}-16`;
        const q2End = `${monthKey}-${String(lastDay).padStart(2, "0")}`;

        if (current <= parseLocalDate(q1End) && parseLocalDate(q1Start) <= end) {
          const name = `${capitalMonth} ${y} - Q1`;
          periodsToSave.push({ name, startDate: q1Start, endDate: q1End, type: "biweekly", status: "draft" });
          monthsMap[monthKey] = capitalMonth;
        }

        const q2StartDate = parseLocalDate(q2Start);
        if (q2StartDate <= end && q2StartDate >= start) {
          const name = `${capitalMonth} ${y} - Q2`;
          periodsToSave.push({ name, startDate: q2Start, endDate: q2End, type: "biweekly", status: "draft" });
          monthsMap[monthKey] = capitalMonth;
        }

        current.setMonth(current.getMonth() + 1);
      }

      if (periodsToSave.length === 0) {
        alert("No se generaron períodos en el rango seleccionado");
        return;
      }

      for (const p of periodsToSave) {
        await savePayrollPeriod(null, p);
      }

      setShowGenPeriodsModal(false);
      setGenPeriodStart("");
      setGenPeriodEnd("");
      showToast(`${periodsToSave.length} período(s) generados`);
      const list = await getPayrollPeriods();
      setPeriods(list);
    } catch (e) {
      console.error(e);
      alert("Error al generar períodos");
    }
  };

  const addDeduction = () => {
    const amt = parseFloat(normalizeNum(deductionAmount));
    if (!deductionDesc.trim() || !amt || amt <= 0) return;
    setDeductionEmp(prev => ({
      ...prev,
      deductions: [...(prev?.deductions || []), { description: deductionDesc.trim(), amount: amt }]
    }));
    setDeductionDesc("");
    setDeductionAmount("");
  };

  const removeDeduction = (idx) => {
    setDeductionEmp(prev => ({
      ...prev,
      deductions: (prev?.deductions || []).filter((_, i) => i !== idx)
    }));
  };

  const saveDeductions = async () => {
    if (!deductionEmp || !selectedPeriodDetail) return;
    const updatedEmployees = selectedPeriodDetail.employees.map(e =>
      e.employeeId === deductionEmp.employeeId
        ? { ...e, deductions: deductionEmp.deductions || [] }
        : e
    );
    const updatedPeriod = {
      ...selectedPeriodDetail,
      employees: updatedEmployees,
      totalExtraDeductions: updatedEmployees.reduce((s, e) => s + ((e.deductions || []).reduce((a, d) => a + (d.amount || 0), 0)), 0),
    };
    try {
      await savePayrollPeriod(updatedPeriod.id, updatedPeriod);
      setSelectedPeriodDetail(updatedPeriod);
      setShowEmpDeductionsModal(false);
      setDeductionEmp(null);
      showToast("Deducciones guardadas");
    } catch (e) {
      console.error(e);
      alert("Error al guardar deducciones");
    }
  };

  const calculatePayroll = async (period) => {
    const periodAtt = await getAttendanceRecords({
      dateFrom: period.startDate,
      dateTo: period.endDate
    });
    const activeLoans = await getLoans();

    const employeesPayroll = employees.filter(e => e.status === "active").map(emp => {
      const baseSalary = period.type === "biweekly" ? emp.baseSalary / 2 : emp.baseSalary;
      const empRecords = periodAtt.filter(r => r.employeeId === emp.id);

      let totalScheduledMinutes = 0;
      let totalActualMinutes = 0;
      let daysAbsent = 0;
      let lateMinutes = 0;
      let overtimeMinutes = 0;
      let daysPresent = 0;
      let daysPaidLeave = 0;

      const start = parseLocalDate(period.startDate);
      const end = parseLocalDate(period.endDate);

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dow = d.getDay();
        const scheduledMin = getScheduledMinutes(dow, config.schedule);
        if (scheduledMin > 0) {
          totalScheduledMinutes += scheduledMin;
          const dateStr = getLocalDateString(d);
          const rec = empRecords.find(r => r.date === dateStr);
          const schedIn = dow === 5 ? config.schedule.friIn : config.schedule.monThuIn;
          const schedOut = dow === 5 ? config.schedule.friOut : config.schedule.monThuOut;

          if (rec) {
            if (rec.status === "absent") {
              daysAbsent += 1;
            } else if (rec.status === "present" || rec.status === "late") {
              daysPresent += 1;
              totalActualMinutes += getActualMinutes(rec.clockIn, rec.clockOut, config.schedule.lunchMinutes || 60);
              if (rec.clockIn && schedIn) {
                const diffIn = timeToMinutes(rec.clockIn) - timeToMinutes(schedIn);
                if (diffIn > 0) {
                  lateMinutes += diffIn;
                }
              }
              if (rec.clockOut && schedOut) {
                const diffOut = timeToMinutes(rec.clockOut) - timeToMinutes(schedOut);
                if (diffOut > 0) {
                  overtimeMinutes += diffOut;
                } else if (diffOut < 0) {
                  lateMinutes += Math.abs(diffOut); // Early departures count as late
                }
              }
            } else if (["permission", "vacation", "sick", "cross"].includes(rec.status)) {
              daysPaidLeave += 1;
            }
          } else {
            // Count as absent if no record on a scheduled day and day is not in the future
            const todayStr = getLocalDateString();
            if (dateStr <= todayStr) {
              daysAbsent += 1;
            }
          }
        }
      }

      // Rates based on monthly salary
      const dailyRate = emp.baseSalary / 30;
      const hourlyRate = dailyRate / 8;
      const minuteRate = hourlyRate / 60;

      const totalScheduledHours = totalScheduledMinutes / 60;
      const totalActualHours = totalActualMinutes / 60;
      const overtimeHours = overtimeMinutes / 60;

      const overtimePay = overtimeHours * hourlyRate * (config.overtimeRate || 2);
      const absentDeduction = daysAbsent * dailyRate;
      const tardinessDeduction = lateMinutes * minuteRate;

      // Taxable Gross is Base Salary + Overtime - Absences - Tardiness
      const taxableGross = Math.max(0, baseSalary + overtimePay - absentDeduction - tardinessDeduction);

      // El Salvador ISSS cap: monthly cap of $1000 ($30 max worker ISSS), biweekly cap of $500 ($15 max)
      const isssCap = period.type === "biweekly" ? 15.00 : 30.00;
      const isssDeduction = Math.min(taxableGross * (config.isssRate || 0.03), isssCap);
      const afpDeduction = taxableGross * (config.afpRate || 0.0725);

      // Taxable income for ISR (Renta)
      const taxableIncome = Math.max(0, taxableGross - isssDeduction - afpDeduction);
      const isrDeduction = calculateISR(taxableIncome, period.type);

      // Apply active loans
      const empLoans = activeLoans.filter(l => l.employeeId === emp.id && l.status === "active" && l.remainingBalance > 0);
      const loanDeductions = [];
      let totalLoanDeductions = 0;
      
      const isQ2OrMonthly = period.type === "monthly" || parseLocalDate(period.endDate).getDate() > 15;
      for (const loan of empLoans) {
        if (loan.frequency === "q2" && !isQ2OrMonthly) {
          continue;
        }
        const cuotaAmount = Math.min(loan.cuotaVal, loan.remainingBalance);
        if (cuotaAmount > 0) {
          loanDeductions.push({
            loanId: loan.id,
            description: `Préstamo: ${loan.description} (Cuota ${loan.paidCuotas + 1}/${loan.cuotas})`,
            amount: cuotaAmount
          });
          totalLoanDeductions += cuotaAmount;
        }
      }

      const existingEmp = period.employees?.find(e => e.employeeId === emp.id);
      const extraDeductions = existingEmp?.deductions || [];
      const totalExtraDeductions = extraDeductions.reduce((s, d) => s + (d.amount || 0), 0);

      const totalDeductions = isssDeduction + afpDeduction + isrDeduction + absentDeduction + tardinessDeduction + totalExtraDeductions + totalLoanDeductions;
      const netPay = Math.max(0, (baseSalary + overtimePay) - totalDeductions);

      return {
        employeeId: emp.id,
        employeeName: emp.name,
        baseSalary,
        hourlyRate,
        scheduledHours: totalScheduledHours,
        actualHours: totalActualHours,
        overtimeHours,
        overtimePay,
        daysAbsent,
        absentDeduction,
        lateMinutes,
        tardinessDeduction,
        taxableGross,
        isss: isssDeduction,
        afp: afpDeduction,
        isr: isrDeduction,
        loanDeductions,
        totalLoanDeductions,
        deductions: extraDeductions,
        totalExtraDeductions,
        totalDeductions,
        netPay
      };
    });

    const newPeriod = {
      ...period,
      status: "calculated",
      employees: employeesPayroll,
      totalNet: employeesPayroll.reduce((acc, curr) => acc + curr.netPay, 0),
      totalOvertimePay: employeesPayroll.reduce((acc, curr) => acc + curr.overtimePay, 0),
      totalMissingDeductions: employeesPayroll.reduce((acc, curr) => acc + (curr.absentDeduction + curr.tardinessDeduction), 0),
      totalExtraDeductions: employeesPayroll.reduce((acc, curr) => acc + curr.totalExtraDeductions, 0),
      totalLoanDeductions: employeesPayroll.reduce((acc, curr) => acc + curr.totalLoanDeductions, 0),
    };

    await savePayrollPeriod(period.id, newPeriod);
    const list = await getPayrollPeriods();
    setPeriods(list);
    setSelectedPeriodDetail({ ...newPeriod, id: period.id });
  };

  const handlePayPeriod = async (period) => {
    if (!window.confirm(`¿Estás seguro de marcar la planilla "${period.name}" como PAGADA? Esta acción aplicará los descuentos de préstamos de forma permanente y no se puede deshacer.`)) {
      return;
    }
    setLoading(true);
    try {
      const activeLoans = await getLoans();
      for (const emp of period.employees || []) {
        if (emp.loanDeductions && emp.loanDeductions.length > 0) {
          for (const deduction of emp.loanDeductions) {
            const loan = activeLoans.find(l => l.id === deduction.loanId);
            if (loan) {
              const updatedRemaining = Math.max(0, loan.remainingBalance - deduction.amount);
              const updatedPaidCuotas = loan.paidCuotas + 1;
              const updatedStatus = updatedRemaining <= 0 ? "completed" : "active";
              
              await saveLoan(loan.id, {
                ...loan,
                remainingBalance: updatedRemaining,
                paidCuotas: updatedPaidCuotas,
                status: updatedStatus
              });
            }
          }
        }
      }

      const updatedPeriod = {
        ...period,
        status: "paid",
        paidAt: serverTimestamp()
      };
      await savePayrollPeriod(period.id, updatedPeriod);
      showToast("Planilla pagada con éxito. Saldos de préstamos actualizados.");
      await loadInitialData();
      setSelectedPeriodDetail(updatedPeriod);
    } catch (e) {
      console.error(e);
      alert("Error al pagar la planilla: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading || authLoading) {
    return <div className="loading-screen"><div className="spinner" /></div>;
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <StoreHeader />
      
      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <div className={styles.sidebarTitle}>RRHH</div>
            <div className={styles.sidebarSubtitle}>Gestión de Personal</div>
          </div>
          <nav className={styles.sidebarNav}>
            {TABS.map(tab => (
              <button
                key={tab.key}
                className={`${styles.sidebarLink} ${activeTab === tab.key ? styles.sidebarLinkActive : ""}`}
                onClick={() => setActiveTab(tab.key)}
              >
                <tab.icon className={styles.sidebarLinkIcon} />
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        <main className={styles.mainContent}>
          <div className={styles.topBar}>
            <div className={styles.topBarLeft}>
              <h1 className={styles.sidebarSubtitle}>
                {TABS.find(t => t.key === activeTab)?.label}
              </h1>
            </div>
            {toast && (
              <div               className={`${styles.toast} ${toast.type === "error" ? styles.toastError : ""}`}>
                {toast.msg}
              </div>
            )}
          </div>

          <div className={styles.contentArea}>
            {activeTab === "empleados" && (
              <div className={styles.sectionCard}>
                <div className={styles.sectionHeader}>
                  <div className={styles.searchBox}>
                    <HiOutlineMagnifyingGlass className={styles.searchIcon} />
                    <input 
                      type="text" 
                      placeholder="Buscar empleado..." 
                      className={styles.searchInput}
                      value={empSearch}
                      onChange={(e) => setEmpSearch(e.target.value)}
                    />
                  </div>
                  <div className={styles.sectionActions}>
                    {isAdmin && (
                      <button className={styles.btnPrimary} onClick={() => { setEditingEmp(null); setEmpForm({ name: "", email: "", phone: "", dui: "", position: "", department: "", baseSalary: "365", status: "active", hireDate: getLocalDateString() }); setShowEmpModal(true); }}>
                        <HiOutlinePlus /> Nuevo Empleado
                      </button>
                    )}
                    <button className={styles.toolBtn} onClick={() => handlePrintTab("empleados")}><HiOutlinePrinter size={15} /> Imprimir</button>
                    <button className={styles.toolBtn} onClick={() => handleExportExcel("empleados")}><HiOutlineDocumentArrowDown size={15} /> Excel</button>
                  </div>
                </div>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Nombre</th>
                        <th>Cargo</th>
                        <th>DUI</th>
                        <th>Salario Base</th>
                        <th>Estado</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {employees.filter(e => e.name.toLowerCase().includes(empSearch.toLowerCase())).map(emp => (
                        <tr key={emp.id}>
                          <td>{emp.name}</td>
                          <td>{emp.position}</td>
                          <td>{emp.dui}</td>
                          <td>{formatPrice(emp.baseSalary)}</td>
                          <td>
                            <span className={`${styles.badge} ${emp.status === "active" ? styles.bActive : styles.bInactive}`}>
                              {emp.status === "active" ? "Activo" : "Inactivo"}
                            </span>
                          </td>
                          <td>
                            <div className={styles.sectionActions}>
                              <button className={`${styles.actionBtn} ${styles.actionBtnEdit}`} onClick={() => { setEditingEmp(emp); setEmpForm({ ...emp, baseSalary: normalizeNum(emp.baseSalary) }); setShowEmpModal(true); }}><HiOutlinePencilSquare /></button>
                              {isAdmin && <button className={`${styles.actionBtn} ${styles.actionBtnDel}`} onClick={() => { if (window.confirm("¿Eliminar empleado " + emp.name + "?")) deleteEmployee(emp.id).then(loadInitialData); }}><HiOutlineTrash /></button>}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === "prestamos" && (
              <div className={styles.sectionCard}>
                <div className={styles.sectionHeader}>
                  <div className={styles.searchBox}>
                    <HiOutlineMagnifyingGlass className={styles.searchIcon} />
                    <input
                      type="text"
                      placeholder="Buscar préstamo..."
                      className={styles.searchInput}
                      value={loanSearch}
                      onChange={(e) => setLoanSearch(e.target.value)}
                    />
                  </div>
                  <div className={styles.sectionActions}>
                    <span className={styles.sectionBadge}>
                      {loans.filter(l => l.status === "active").length} Activos
                    </span>
                    {isAdmin && (
                      <button
                        className={styles.btnPrimary}
                        onClick={() => {
                          setLoanForm({ employeeId: "", description: "", amount: "", cuotas: 1, cuotaVal: "", frequency: "always" });
                          setShowLoanModal(true);
                        }}
                      >
                        <HiOutlinePlus /> Nuevo Préstamo
                      </button>
                    )}
                    <button className={styles.toolBtn} onClick={() => handlePrintTab("prestamos")}><HiOutlinePrinter size={15} /> Imprimir</button>
                    <button className={styles.toolBtn} onClick={() => handleExportExcel("prestamos")}><HiOutlineDocumentArrowDown size={15} /> Excel</button>
                  </div>
                </div>

                {/* KPI Row for loans */}
                <div className={styles.sectionBody}>
                  <div className={styles.loansKpiRow}>
                    <div className={styles.loanKpi}>
                      <span className={styles.loanKpiVal}>{loans.length}</span>
                      <span className={styles.loanKpiLabel}>Total Registrados</span>
                    </div>
                    <div className={styles.loanKpi}>
                      <span className={styles.loanKpiVal} style={{color:"#059669"}}>{loans.filter(l=>l.status==="active").length}</span>
                      <span className={styles.loanKpiLabel}>Activos</span>
                    </div>
                    <div className={styles.loanKpi}>
                      <span className={styles.loanKpiVal} style={{color:"#64748B"}}>{loans.filter(l=>l.status==="completed").length}</span>
                      <span className={styles.loanKpiLabel}>Finalizados</span>
                    </div>
                    <div className={styles.loanKpi}>
                      <span className={styles.loanKpiVal}>{formatPrice(loans.filter(l=>l.status==="active").reduce((a,l)=>a+(l.remainingBalance||0),0))}</span>
                      <span className={styles.loanKpiLabel}>Saldo Pendiente Total</span>
                    </div>
                  </div>
                </div>

                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Empleado</th>
                        <th>Descripción</th>
                        <th>Monto Total</th>
                        <th>Cuotas</th>
                        <th>Cuota / Período</th>
                        <th>Saldo Pendiente</th>
                        <th>Frecuencia</th>
                        <th>Estado</th>
                        {isAdmin && <th style={{width:80}}>Acciones</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {loans
                        .filter(l => {
                          const q = loanSearch.toLowerCase();
                          return !q || l.employeeName?.toLowerCase().includes(q) || l.description?.toLowerCase().includes(q);
                        })
                        .map(loan => (
                          <tr key={loan.id}>
                            <td><strong>{loan.employeeName}</strong></td>
                            <td>{loan.description}</td>
                            <td>{formatPrice(loan.amount)}</td>
                            <td>
                              <span className={styles.cuotaBadge}>
                                {loan.paidCuotas}/{loan.cuotas}
                              </span>
                            </td>
                            <td>{formatPrice(loan.cuotaVal)}</td>
                            <td>
                              <div className={styles.balanceBar}>
                                <div
                                  className={styles.balanceBarFill}
                                  style={{
                                    width: `${Math.max(0,Math.min(100, 100 - (loan.remainingBalance / loan.amount) * 100))}%`
                                  }}
                                />
                              </div>
                              <span style={{fontSize:"0.78rem",fontWeight:700,color: loan.remainingBalance > 0 ? "#DC2626" : "#059669"}}>
                                {formatPrice(loan.remainingBalance)}
                              </span>
                            </td>
                            <td>
                              <span className={styles.sectionBadge}>
                                {loan.frequency === "q2" ? "Solo Q2 / Fin mes" : "Cada quincena"}
                              </span>
                            </td>
                            <td>
                              <span className={`${styles.badge} ${loan.status === "active" ? styles.bActive : styles.bInactive}`}>
                                {loan.status === "active" ? "Activo" : "Finalizado"}
                              </span>
                            </td>
                            {isAdmin && (
                              <td>
                                <button
                                  className={`${styles.actionBtn} ${styles.actionBtnDel}`}
                                  title="Eliminar préstamo"
                                  onClick={() => {
                                    if (window.confirm(`¿Eliminar el préstamo "${loan.description}" de ${loan.employeeName}?`)) {
                                      deleteLoan(loan.id).then(async () => {
                                        const list = await getLoans();
                                        setLoans(list);
                                        showToast("Préstamo eliminado");
                                      });
                                    }
                                  }}
                                >
                                  <HiOutlineTrash size={14} />
                                </button>
                              </td>
                            )}
                          </tr>
                        ))
                      }
                      {loans.filter(l => {
                        const q = loanSearch.toLowerCase();
                        return !q || l.employeeName?.toLowerCase().includes(q) || l.description?.toLowerCase().includes(q);
                      }).length === 0 && (
                        <tr>
                          <td colSpan={isAdmin ? 9 : 8} style={{textAlign:"center",color:"#94A3B8",padding:"2rem"}}>
                            <HiOutlineWallet size={28} style={{opacity:0.3,display:"block",margin:"0 auto 0.5rem"}} />
                            No hay préstamos registrados
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === "asistencia" && (
              <div className={styles.sectionCard}>
                <div className={styles.sectionHeader}>
                  <div className={styles.dateSelector}>
                    <input 
                      type="date" 
                      className={styles.dateInput} 
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                    />
                  </div>
                  <div className={styles.sectionActions}>
                    <span className={styles.sectionBadge}>{attendanceRecords.length} Registros</span>
                    <button className={styles.toolBtn} onClick={() => handlePrintTab("asistencia")}><HiOutlinePrinter size={15} /> Imprimir</button>
                    <button className={styles.toolBtn} onClick={() => handleExportExcel("asistencia")}><HiOutlineDocumentArrowDown size={15} /> Excel</button>
                  </div>
                </div>
                {selectedEmpIds.size > 0 && isAdmin && (
                  <div className={styles.bulkBar}>
                    <span className={styles.bulkBarCount}>{selectedEmpIds.size} seleccionados</span>
                    <div className={styles.attendanceActions}>
                      {ATTENDANCE_STATUS.map(status => (
                        <button
                          key={status.key}
                          className={`${styles.attBtn} ${styles['attBtn' + status.key.charAt(0).toUpperCase() + status.key.slice(1)]}`}
                          onClick={() => bulkMarkAttendance(status.key)}
                          title={status.label}
                        >
                          {status.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {attLoading ? (
                  <div className={styles.sectionBody} style={{textAlign: "center", padding: "2rem"}}>
                    <div className="spinner" />
                  </div>
                ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th style={{width: 36}}>
                          <input type="checkbox"
                            className={styles.checkAll}
                            checked={selectedEmpIds.size === employees.filter(e => e.status === "active").length && employees.filter(e => e.status === "active").length > 0}
                            onChange={toggleSelectAll}
                          />
                        </th>
                        <th>Empleado</th>
                        <th>Estado</th>
                        <th>Programado</th>
                        <th>Entrada</th>
                        <th>Salida</th>
                        <th>Real</th>
                        <th>Dif.</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {employees.filter(e => e.status === "active").map(emp => {
                        const record = attendanceRecords.find(r => r.employeeId === emp.id);
                        const scheduledMin = getScheduledMinutes(parseLocalDate(selectedDate).getDay(), config.schedule);
                        const actualMin = getActualMinutes(record?.clockIn, record?.clockOut, config.schedule.lunchMinutes || 60);
                        const diffMin = actualMin - scheduledMin;
                        const diffClass = diffMin < -5 ? "cellRed" : diffMin > 5 ? "cellGreen" : "";
                        return (
                          <tr key={emp.id} className={selectedEmpIds.has(emp.id) ? styles.rowSelected : ""}>
                            <td>
                              <input type="checkbox"
                                checked={selectedEmpIds.has(emp.id)}
                                onChange={() => toggleSelectEmp(emp.id)}
                              />
                            </td>
                            <td>{emp.name}</td>
                            <td>
                              {record ? (
                                <span className={`${styles.badge} ${styles['b' + record.status.charAt(0).toUpperCase() + record.status.slice(1)]}`}>
                                  {ATTENDANCE_STATUS.find(s => s.key === record.status)?.label}
                                </span>
                              ) : "—"}
                            </td>
                            <td>{scheduledMin > 0 ? formatMinutes(scheduledMin) : "—"}</td>
                            <td>
                              <input type="time"
                                className={styles.timeInput}
                                value={record?.clockIn || ""}
                                onChange={(e) => updateClockTime(emp, 'clockIn', e.target.value)}
                                disabled={!isAdmin}
                              />
                            </td>
                            <td>
                              <input type="time"
                                className={styles.timeInput}
                                value={record?.clockOut || ""}
                                onChange={(e) => updateClockTime(emp, 'clockOut', e.target.value)}
                                disabled={!isAdmin}
                              />
                            </td>
                            <td className={styles[diffClass]}>{actualMin > 0 ? formatMinutes(actualMin) : "—"}</td>
                            <td className={styles[diffClass]}>{scheduledMin > 0 && record ? (diffMin >= 0 ? "+" : "") + formatMinutes(Math.abs(diffMin)) : "—"}</td>
                            <td>
                              <div className={styles.attendanceActions}>
                                {ATTENDANCE_STATUS.map(status => (
                                  <button 
                                    key={status.key}
                                    className={`${styles.attBtn} ${styles['attBtn' + status.key.charAt(0).toUpperCase() + status.key.slice(1)]} ${record?.status === status.key ? styles.attBtnActive : ""}`}
                                    onClick={() => markAttendance(emp, status.key)}
                                    title={status.label}
                                    disabled={!isAdmin}
                                  >
                                    {status.label}
                                  </button>
                                ))}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                )}
              </div>
            )}

            {activeTab === "planilla" && (
              selectedPeriodDetail ? (
                <div className={styles.sectionCard}>
                  <div className={styles.sectionHeader}>
                    <button className={styles.btnOutline} onClick={() => setSelectedPeriodDetail(null)}>
                      ← Volver
                    </button>
                    <div className={styles.sectionActions}>
                      <span className={`${styles.badge} ${styles['b' + selectedPeriodDetail.status?.charAt(0).toUpperCase() + selectedPeriodDetail.status?.slice(1)]}`}>
                        {selectedPeriodDetail.status}
                      </span>
                      {isAdmin && selectedPeriodDetail.status !== "paid" && (
                        <>
                          <button className={styles.btnPrimary} onClick={() => calculatePayroll(selectedPeriodDetail)}>
                            Recalcular
                          </button>
                          <button className={styles.btnSuccess} onClick={() => handlePayPeriod(selectedPeriodDetail)}>
                            Pagar Planilla
                          </button>
                        </>
                      )}
                      <button className={styles.toolBtn} onClick={() => handlePrintTab("planilla")}><HiOutlinePrinter size={15} /> Imprimir</button>
                      <button className={styles.toolBtn} onClick={() => handleExportExcel("planilla")}><HiOutlineDocumentArrowDown size={15} /> Excel</button>
                    </div>
                  </div>
                  <div className={styles.sectionBody}>
                    <h3 style={{margin: "0 0 0.25rem"}}>{selectedPeriodDetail.name}</h3>
                    <p style={{margin: "0 0 1rem", color: "#64748B", fontSize: "0.85rem"}}>
                      {selectedPeriodDetail.startDate} a {selectedPeriodDetail.endDate}
                      {selectedPeriodDetail.type === "biweekly" ? " (Quincenal)" : " (Mensual)"}
                    </p>
                    <div className={styles.tableWrap}>
                      <table className={styles.payrollTable}>
                        <thead>
                          <tr>
                            <th>Empleado</th>
                            <th>Salario Base</th>
                            <th>Hrs Prog.</th>
                            <th>Hrs Real</th>
                            <th>Hrs Ext.</th>
                            <th>Pago HE</th>
                            <th>Desc. Asist.</th>
                            <th>ISSS</th>
                            <th>AFP</th>
                            <th>Renta (ISR)</th>
                            <th>Préstamos</th>
                            <th>Desc. Extras</th>
                            <th className={styles.cellRight}>Neto</th>
                            <th style={{ width: 50, textAlign: "center" }}>Recibo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(selectedPeriodDetail.employees || []).map(emp => (
                            <tr key={emp.employeeId}>
                              <td>
                                <strong
                                  style={{cursor: "pointer", color: "#4F46E5"}}
                                  onClick={() => { setDeductionEmp({...emp}); setShowEmpDeductionsModal(true); }}
                                >
                                  {emp.employeeName}
                                </strong>
                              </td>
                              <td>{formatPrice(emp.baseSalary)}</td>
                              <td>{emp.scheduledHours?.toFixed(1)}</td>
                              <td>{emp.actualHours?.toFixed(1)}</td>
                              <td className={emp.overtimeHours > 0 ? styles.cellGreen : ""}>{emp.overtimeHours?.toFixed(1)}</td>
                              <td className={styles.cellGreen}>{emp.overtimePay > 0 ? formatPrice(emp.overtimePay) : "—"}</td>
                              <td className={(emp.absentDeduction + emp.tardinessDeduction) > 0 ? styles.cellRed : ""}>
                                {(emp.absentDeduction + emp.tardinessDeduction) > 0 ? formatPrice(emp.absentDeduction + emp.tardinessDeduction) : "—"}
                              </td>
                              <td>{formatPrice(emp.isss)}</td>
                              <td>{formatPrice(emp.afp)}</td>
                              <td>{emp.isr > 0 ? formatPrice(emp.isr) : "—"}</td>
                              <td className={emp.totalLoanDeductions > 0 ? styles.cellRed : ""}>
                                {emp.totalLoanDeductions > 0 ? formatPrice(emp.totalLoanDeductions) : "—"}
                              </td>
                              <td>
                                {(emp.deductions || []).length > 0
                                  ? formatPrice(emp.deductions.reduce((s, d) => s + (d.amount || 0), 0))
                                  : "—"}
                              </td>
                              <td className={styles.cellRight}><strong>{formatPrice(emp.netPay)}</strong></td>
                              <td style={{ textAlign: "center" }}>
                                <button
                                  className={styles.actionBtn}
                                  onClick={() => { setReceiptData(emp); setShowReceiptModal(true); }}
                                  title="Imprimir Boleta de Pago"
                                >
                                  <HiOutlinePrinter size={16} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className={styles.totalRow}>
                            <td><strong>Totales</strong></td>
                            <td><strong>{formatPrice((selectedPeriodDetail.employees || []).reduce((a, e) => a + (e.baseSalary || 0), 0))}</strong></td>
                            <td></td>
                            <td></td>
                            <td></td>
                            <td className={styles.cellGreen}><strong>{formatPrice(selectedPeriodDetail.totalOvertimePay || 0)}</strong></td>
                            <td className={styles.cellRed}><strong>{formatPrice(selectedPeriodDetail.totalMissingDeductions || 0)}</strong></td>
                            <td><strong>{formatPrice((selectedPeriodDetail.employees || []).reduce((a, e) => a + (e.isss || 0), 0))}</strong></td>
                            <td><strong>{formatPrice((selectedPeriodDetail.employees || []).reduce((a, e) => a + (e.afp || 0), 0))}</strong></td>
                            <td><strong>{formatPrice((selectedPeriodDetail.employees || []).reduce((a, e) => a + (e.isr || 0), 0))}</strong></td>
                            <td className={styles.cellRed}><strong>{formatPrice(selectedPeriodDetail.totalLoanDeductions || 0)}</strong></td>
                            <td><strong>{formatPrice(selectedPeriodDetail.totalExtraDeductions || 0)}</strong></td>
                            <td className={styles.cellRight}><strong>{formatPrice(selectedPeriodDetail.totalNet || 0)}</strong></td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                <div className={styles.sectionCard}>
                  <div className={styles.sectionHeader}>
                    <div className={styles.sectionTitle}><HiOutlineBanknotes /> Períodos de Planilla</div>
                    <div className={styles.sectionActions}>
                      <span className={styles.sectionBadge}>{periods.length} Períodos</span>
                      <button className={styles.toolBtn} onClick={() => handlePrintTab("planilla")}><HiOutlinePrinter size={15} /> Imprimir</button>
                      <button className={styles.toolBtn} onClick={() => handleExportExcel("planilla")}><HiOutlineDocumentArrowDown size={15} /> Excel</button>
                    </div>
                  </div>
                </div>
                <div className={styles.periodsGrid}>
                {periods.map(period => (
                  <div key={period.id} className={styles.periodCard} onClick={() => setSelectedPeriodDetail(period)}>
                    <div className={styles.periodCardHeader}>
                      <span className={styles.periodCardName}>{period.name}</span>
                      <span className={`${styles.badge} ${styles['b' + period.status.charAt(0).toUpperCase() + period.status.slice(1)]}`}>
                        {period.status}
                      </span>
                    </div>
                    <div className={styles.periodCardDates}>{period.startDate} a {period.endDate} {period.type === "biweekly" ? "(Q)" : "(M)"}</div>
                    <div className={styles.periodCardFooter}>
                      <span className={styles.periodCardAmount}>{formatPrice(period.totalNet || 0)}</span>
                      <div style={{display: "flex", gap: 4}}>
                        <HiOutlinePrinter className={styles.actionBtnView} />
                        {isAdmin && (
                          <button className={styles.actionBtn} style={{color:"#DC2626",border:"1.5px solid #FECACA"}}
                            onClick={(e) => { e.stopPropagation(); if (window.confirm(`¿Mover "${period.name}" a la papelera?`)) { softDeletePayrollPeriod(period.id).then(() => { loadInitialData(); showToast("Período movido a la papelera"); }); } }}>
                            <HiOutlineTrash size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {isAdmin && (
                  <>
                    <button className={styles.periodCard} style={{borderStyle: "dashed", alignItems: "center", justifyContent: "center"}} onClick={() => setShowGenPeriodsModal(true)}>
                      <HiOutlineCalendarDays size={24} />
                      <span>Generar Planillas</span>
                    </button>
                    <button className={styles.periodCard} style={{borderStyle: "dashed", alignItems: "center", justifyContent: "center"}} onClick={() => setShowPeriodModal(true)}>
                      <HiOutlinePlus size={24} />
                      <span>Nuevo Período</span>
                    </button>
                    <button className={styles.periodCard} style={{borderStyle: "dashed", alignItems: "center", justifyContent: "center", borderColor: "#FECACA", color: "#DC2626"}} onClick={() => { getTrashedPayrollPeriods().then(setTrashedPeriods); setShowTrashModal(true); }}>
                      <HiOutlineArchiveBoxXMark size={24} />
                      <span>Papelera</span>
                    </button>
                  </>
                )}
              </div>
              </>
              )
            )}

            {activeTab === "reportes" && (
              <div className={styles.sectionCard}>
                <div className={styles.sectionHeader}>
                  <div className={styles.sectionTitle}><HiOutlineChartBar /> Reportes</div>
                  <div className={styles.sectionActions}>
                    <button className={styles.btnPrimary} onClick={handleGenerateReport} disabled={repLoading}>
                      {repLoading ? "Generando..." : "Generar Reporte"}
                    </button>
                  </div>
                </div>
                <div className={styles.sectionBody}>
                  {/* Filtros */}
                  <div style={{display:"flex",gap:"0.75rem",flexWrap:"wrap",marginBottom:"1rem",alignItems:"end"}}>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Desde</label>
                      <input type="date" className={styles.dateInput} value={repDateFrom} onChange={e => setRepDateFrom(e.target.value)} />
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Hasta</label>
                      <input type="date" className={styles.dateInput} value={repDateTo} onChange={e => setRepDateTo(e.target.value)} />
                    </div>
                  </div>

                  <div style={{marginBottom:"1rem"}}>
                    <div style={{display:"flex",alignItems:"center",gap:"0.75rem",marginBottom:"0.5rem",flexWrap:"wrap"}}>
                      <span className={styles.formLabel} style={{margin:0}}>Empleados</span>
                      <span className={styles.sectionBadge}>{repEmpFilter === "all" ? "Todos" : repSelectedEmps.size + " seleccionados"}</span>
                      <button className={styles.btnGhost + " " + styles.btnSm} onClick={() => { setRepEmpFilter("all"); setRepSelectedEmps(new Set()); }}
                        style={repEmpFilter === "all" ? {background:"#EEF2FF",color:"#4338CA",fontWeight:700} : {}}>Todos</button>
                      <button className={styles.btnGhost + " " + styles.btnSm} onClick={() => { setRepEmpFilter("selected"); setRepSelectedEmps(new Set()); }}
                        style={repEmpFilter !== "all" ? {background:"#EEF2FF",color:"#4338CA",fontWeight:700} : {}}>Ninguno</button>
                    </div>
                    <div className={styles.chipList}>
                      {employees.filter(e => e.status === "active").map(e => {
                        const isSelected = repEmpFilter === "all" || repSelectedEmps.has(e.id);
                        return (
                          <button key={e.id} className={`${styles.chipBtn} ${isSelected ? styles.chipActive : ""}`}
                            onClick={() => {
                              if (repEmpFilter === "all") { setRepEmpFilter("selected"); setRepSelectedEmps(new Set([e.id])); return; }
                              const next = new Set(repSelectedEmps);
                              next.has(e.id) ? next.delete(e.id) : next.add(e.id);
                              setRepSelectedEmps(next);
                            }}
                          >
                            {e.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Columnas a incluir */}
                  <details style={{marginBottom:"1rem"}}>
                    <summary style={{fontSize:"0.82rem",fontWeight:600,cursor:"pointer",color:"#4F46E5"}}>
                      Columnas del reporte {Object.values(repColumns).filter(Boolean).length} seleccionadas
                    </summary>
                    <div style={{display:"flex",flexWrap:"wrap",gap:"0.5rem",padding:"0.75rem 0 0 0"}}>
                      {[
                        {key:"horasProg",label:"Horas Prog."},
                        {key:"horasReal",label:"Horas Real"},
                        {key:"horasExt",label:"Hrs Ext."},
                        {key:"pagoHE",label:"Pago HE"},
                        {key:"presentes",label:"Presentes"},
                        {key:"ausencias",label:"Ausencias"},
                        {key:"permisos",label:"Permisos"},
                        {key:"descAsist",label:"Desc. Asist."},
                        {key:"isss",label:"ISSS"},
                        {key:"afp",label:"AFP"},
                        {key:"isr",label:"ISR"},
                        {key:"prestamos",label:"Préstamos"},
                        {key:"descExtras",label:"Desc. Extras"},
                        {key:"totalDesc",label:"Total Desc."},
                        {key:"neto",label:"Neto"},
                      ].map(col => (
                        <label key={col.key} style={{fontSize:"0.78rem",display:"flex",alignItems:"center",gap:"4px",cursor:"pointer",padding:"0.25rem 0.5rem",background:repColumns[col.key] ? "#EEF2FF" : "#F8FAFC",border:"1px solid #CBD5E1",borderRadius:"6px",fontWeight:repColumns[col.key]?600:400}}>
                          <input type="checkbox" checked={repColumns[col.key]} onChange={() => setRepColumns({...repColumns, [col.key]: !repColumns[col.key]})} />
                          {col.label}
                        </label>
                      ))}
                    </div>
                  </details>

                  {/* Resultados */}
                  {!repResults ? (
                    <div style={{textAlign:"center",padding:"2rem",color:"#94A3B8"}}>
                      <HiOutlineChartBar size={40} style={{opacity:0.3,marginBottom:"0.5rem"}} />
                      <p>Seleccioná un rango de fechas y generá el reporte</p>
                    </div>
                  ) : repResults.length === 0 ? (
                    <div style={{textAlign:"center",padding:"2rem",color:"#94A3B8"}}>
                      <HiOutlineChartBar size={40} style={{opacity:0.3,marginBottom:"0.5rem"}} />
                      <p>No hay datos para el rango seleccionado</p>
                    </div>
                  ) : (
                    <>
                      <div className={styles.tableWrap}>
                        <table className={styles.table}>
                          <thead>
                            <tr>
                              <th>Empleado</th>
                              {repColumns.horasProg && <th className={styles.cellRight}>Hrs Prog.</th>}
                              {repColumns.horasReal && <th className={styles.cellRight}>Hrs Real</th>}
                              {repColumns.horasExt && <th className={styles.cellRight}>Hrs Ext.</th>}
                              {repColumns.pagoHE && <th className={styles.cellRight}>Pago HE</th>}
                              {repColumns.presentes && <th className={styles.cellRight}>Pres.</th>}
                              {repColumns.ausencias && <th className={styles.cellRight}>Aus.</th>}
                              {repColumns.permisos && <th className={styles.cellRight}>Perm.</th>}
                              {repColumns.descAsist && <th className={styles.cellRight}>Desc. Asist.</th>}
                              {repColumns.isss && <th className={styles.cellRight}>ISSS</th>}
                              {repColumns.afp && <th className={styles.cellRight}>AFP</th>}
                              {repColumns.isr && <th className={styles.cellRight}>ISR</th>}
                              {repColumns.prestamos && <th className={styles.cellRight}>Prést.</th>}
                              {repColumns.descExtras && <th className={styles.cellRight}>Desc.Ext.</th>}
                              {repColumns.totalDesc && <th className={styles.cellRight}>Total Desc.</th>}
                              {repColumns.neto && <th className={styles.cellRight}>Neto</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {repResults.map(r => (
                              <tr key={r.employeeId}>
                                <td><strong>{r.employeeName}</strong></td>
                                {repColumns.horasProg && <td className={styles.cellRight}>{r.scheduledHours.toFixed(1)}</td>}
                                {repColumns.horasReal && <td className={styles.cellRight}>{r.actualHours.toFixed(1)}</td>}
                                {repColumns.horasExt && <td className={styles.cellRight}>{r.overtimeHours.toFixed(1)}</td>}
                                {repColumns.pagoHE && <td className={styles.cellRight}>{r.overtimePay > 0 ? formatPrice(r.overtimePay) : "—"}</td>}
                                {repColumns.presentes && <td className={styles.cellRight}>{r.daysPresent}</td>}
                                {repColumns.ausencias && <td className={styles.cellRight}>{r.daysAbsent}</td>}
                                {repColumns.permisos && <td className={styles.cellRight}>{r.daysPaidLeave}</td>}
                                {repColumns.descAsist && <td className={`${styles.cellRight} ${(r.absentDeduction + r.tardinessDeduction) > 0 ? styles.cellRed : ""}`}>{(r.absentDeduction + r.tardinessDeduction) > 0 ? formatPrice(r.absentDeduction + r.tardinessDeduction) : "—"}</td>}
                                {repColumns.isss && <td className={styles.cellRight}>{formatPrice(r.isss)}</td>}
                                {repColumns.afp && <td className={styles.cellRight}>{formatPrice(r.afp)}</td>}
                                {repColumns.isr && <td className={styles.cellRight}>{r.isr > 0 ? formatPrice(r.isr) : "—"}</td>}
                                {repColumns.prestamos && <td className={`${styles.cellRight} ${r.totalLoanDeductions > 0 ? styles.cellRed : ""}`}>{r.totalLoanDeductions > 0 ? formatPrice(r.totalLoanDeductions) : "—"}</td>}
                                {repColumns.descExtras && <td className={styles.cellRight}>—</td>}
                                {repColumns.totalDesc && <td className={`${styles.cellRight} ${styles.cellRed}`}>{formatPrice(r.totalDeductions)}</td>}
                                {repColumns.neto && <td className={`${styles.cellRight}`}><strong>{formatPrice(r.netPay)}</strong></td>}
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className={styles.totalRow}>
                              <td><strong>Totales</strong></td>
                              {repColumns.horasProg && <td className={styles.cellRight}><strong>{repResults.reduce((a,r)=>a+r.scheduledHours,0).toFixed(1)}</strong></td>}
                              {repColumns.horasReal && <td className={styles.cellRight}><strong>{repResults.reduce((a,r)=>a+r.actualHours,0).toFixed(1)}</strong></td>}
                              {repColumns.horasExt && <td className={styles.cellRight}><strong>{repResults.reduce((a,r)=>a+r.overtimeHours,0).toFixed(1)}</strong></td>}
                              {repColumns.pagoHE && <td className={styles.cellRight}><strong>{formatPrice(repResults.reduce((a,r)=>a+r.overtimePay,0))}</strong></td>}
                              {repColumns.presentes && <td className={styles.cellRight}><strong>{repResults.reduce((a,r)=>a+r.daysPresent,0)}</strong></td>}
                              {repColumns.ausencias && <td className={styles.cellRight}><strong>{repResults.reduce((a,r)=>a+r.daysAbsent,0)}</strong></td>}
                              {repColumns.permisos && <td className={styles.cellRight}><strong>{repResults.reduce((a,r)=>a+r.daysPaidLeave,0)}</strong></td>}
                              {repColumns.descAsist && <td className={styles.cellRight}><strong className={styles.cellRed}>{formatPrice(repResults.reduce((a,r)=>a+r.absentDeduction+r.tardinessDeduction,0))}</strong></td>}
                              {repColumns.isss && <td className={styles.cellRight}><strong>{formatPrice(repResults.reduce((a,r)=>a+r.isss,0))}</strong></td>}
                              {repColumns.afp && <td className={styles.cellRight}><strong>{formatPrice(repResults.reduce((a,r)=>a+r.afp,0))}</strong></td>}
                              {repColumns.isr && <td className={styles.cellRight}><strong>{formatPrice(repResults.reduce((a,r)=>a+r.isr,0))}</strong></td>}
                              {repColumns.prestamos && <td className={styles.cellRight}><strong className={styles.cellRed}>{formatPrice(repResults.reduce((a,r)=>a+r.totalLoanDeductions,0))}</strong></td>}
                              {repColumns.descExtras && <td className={styles.cellRight}><strong>—</strong></td>}
                              {repColumns.totalDesc && <td className={styles.cellRight}><strong className={styles.cellRed}>{formatPrice(repResults.reduce((a,r)=>a+r.totalDeductions,0))}</strong></td>}
                              {repColumns.neto && <td className={styles.cellRight}><strong>{formatPrice(repResults.reduce((a,r)=>a+r.netPay,0))}</strong></td>}
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                      <div className={styles.sectionActions} style={{marginTop:"1rem",justifyContent:"flex-end"}}>
                        <button className={styles.toolBtn} onClick={() => {
                          const w = window.open("about:blank","repImpresion");
                          if (!w) return;
                          const col = repColumns;
                          const th = `<tr><th>Empleado</th>${col.horasProg?"<th class='r'>Hrs Prog.</th>":""}${col.horasReal?"<th class='r'>Hrs Real</th>":""}${col.horasExt?"<th class='r'>Hrs Ext.</th>":""}${col.pagoHE?"<th class='r'>Pago HE</th>":""}${col.presentes?"<th class='r'>Pres.</th>":""}${col.ausencias?"<th class='r'>Aus.</th>":""}${col.permisos?"<th class='r'>Perm.</th>":""}${col.descAsist?"<th class='r'>Desc.Asist.</th>":""}${col.isss?"<th class='r'>ISSS</th>":""}${col.afp?"<th class='r'>AFP</th>":""}${col.isr?"<th class='r'>ISR</th>":""}${col.prestamos?"<th class='r'>Prést.</th>":""}${col.descExtras?"<th class='r'>Desc.Ext.</th>":""}${col.totalDesc?"<th class='r'>Total Desc.</th>":""}${col.neto?"<th class='r'>Neto</th>":""}</tr>`;
                          const td = r => `<tr><td><strong>${r.employeeName}</strong></td>${col.horasProg?`<td class='r'>${r.scheduledHours.toFixed(1)}</td>`:""}${col.horasReal?`<td class='r'>${r.actualHours.toFixed(1)}</td>`:""}${col.horasExt?`<td class='r'>${r.overtimeHours.toFixed(1)}</td>`:""}${col.pagoHE?`<td class='r'>${r.overtimePay>0?formatPrice(r.overtimePay):"—"}</td>`:""}${col.presentes?`<td class='r'>${r.daysPresent}</td>`:""}${col.ausencias?`<td class='r'>${r.daysAbsent}</td>`:""}${col.permisos?`<td class='r'>${r.daysPaidLeave}</td>`:""}${col.descAsist?`<td class='r'>${(r.absentDeduction+r.tardinessDeduction)>0?formatPrice(r.absentDeduction+r.tardinessDeduction):"—"}</td>`:""}${col.isss?`<td class='r'>${formatPrice(r.isss)}</td>`:""}${col.afp?`<td class='r'>${formatPrice(r.afp)}</td>`:""}${col.isr?`<td class='r'>${r.isr>0?formatPrice(r.isr):"—"}</td>`:""}${col.prestamos?`<td class='r'>${r.totalLoanDeductions>0?formatPrice(r.totalLoanDeductions):"—"}</td>`:""}${col.descExtras?`<td class='r'>—</td>`:""}${col.totalDesc?`<td class='r'>${formatPrice(r.totalDeductions)}</td>`:""}${col.neto?`<td class='r'><strong>${formatPrice(r.netPay)}</strong></td>`:""}</tr>`;
                          const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Reporte ${repDateFrom} a ${repDateTo}</title><style>
                            body{font-family:Arial,sans-serif;padding:20px;color:#0F172A} h1{font-size:18px;margin-bottom:4px}
                            .date{font-size:12px;color:#64748B;margin-bottom:16px}
                            table{width:100%;border-collapse:collapse;font-size:13px}
                            th{background:#E2E8F0;padding:7px 9px;text-align:left;font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;border-bottom:2px solid #CBD5E1;white-space:nowrap}
                            td{padding:6px 9px;border-bottom:1px solid #E2E8F0} tr:nth-child(even){background:#FAFBFC}
                            .r{text-align:right} tfoot td{font-weight:700;border-top:2px solid #CBD5E1;background:#F8FAFC}
                            @media print{body{padding:10px}}
                          </style></head><body>
                          <h1>Reporte de Asistencia y Planilla</h1>
                          <div class="date">${repDateFrom} a ${repDateTo} · ${repResults.length} empleados</div>
                          <table>${th}${repResults.map(r=>td(r)).join("")}</table>
                          </body></html>`;
                          w.document.write(html);
                          w.document.close();
                          w.focus();
                          setTimeout(() => w.print(), 500);
                        }}><HiOutlinePrinter size={15} /> Imprimir</button>
                        <button className={styles.toolBtn} onClick={() => {
                          if (!repResults || repResults.length === 0) return;
                          const col = repColumns;
                          const row = r => ({
                            "Empleado": r.employeeName,
                            ...(col.horasProg ? {"Hrs Prog.": r.scheduledHours.toFixed(1)} : {}),
                            ...(col.horasReal ? {"Hrs Real": r.actualHours.toFixed(1)} : {}),
                            ...(col.horasExt ? {"Hrs Ext.": r.overtimeHours.toFixed(1)} : {}),
                            ...(col.pagoHE ? {"Pago HE": r.overtimePay} : {}),
                            ...(col.presentes ? {"Presentes": r.daysPresent} : {}),
                            ...(col.ausencias ? {"Ausencias": r.daysAbsent} : {}),
                            ...(col.permisos ? {"Permisos": r.daysPaidLeave} : {}),
                            ...(col.descAsist ? {"Desc. Asist.": r.absentDeduction + r.tardinessDeduction} : {}),
                            ...(col.isss ? {"ISSS": r.isss} : {}),
                            ...(col.afp ? {"AFP": r.afp} : {}),
                            ...(col.isr ? {"ISR": r.isr} : {}),
                            ...(col.prestamos ? {"Préstamos": r.totalLoanDeductions} : {}),
                            ...(col.descExtras ? {"Desc. Extras": 0} : {}),
                            ...(col.totalDesc ? {"Total Desc.": r.totalDeductions} : {}),
                            ...(col.neto ? {"Neto": r.netPay} : {})
                          });
                          const ws = XLSX.utils.json_to_sheet(repResults.map(row));
                          const wb = XLSX.utils.book_new();
                          XLSX.utils.book_append_sheet(wb, ws, "Reporte");
                          XLSX.writeFile(wb, `Reporte_${repDateFrom}_${repDateTo}.xlsx`);
                          showToast("Excel exportado");
                        }}><HiOutlineDocumentArrowDown size={15} /> Excel</button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
            {activeTab === "configuracion" && (
              <div className={styles.configGrid}>
                <div className={styles.configCard}>
                  <h2 className={styles.configCardTitle}><HiOutlineCog6Tooth /> Nómina</h2>
                  <div className={styles.configItem}>
                    <span className={styles.configItemLabel}>Salario Mínimo</span>
                    <input type="text" inputMode="decimal" className={styles.configInput} value={config.minimumWage} onChange={(e) => setConfig({...config, minimumWage: e.target.value.replace(',', '.')})} />
                  </div>
                  <div className={styles.configItem}>
                    <span className={styles.configItemLabel}>ISSS %</span>
                    <input type="text" inputMode="decimal" className={styles.configInput} value={(config.isssRate * 100).toFixed(2)} onChange={(e) => setConfig({...config, isssRate: parseFloat(e.target.value.replace(',', '.')) / 100 || 0})} />
                  </div>
                  <div className={styles.configItem}>
                    <span className={styles.configItemLabel}>AFP %</span>
                    <input type="text" inputMode="decimal" className={styles.configInput} value={(config.afpRate * 100).toFixed(2)} onChange={(e) => setConfig({...config, afpRate: parseFloat(e.target.value.replace(',', '.')) / 100 || 0})} />
                  </div>
                  <button className={styles.btnPrimary} style={{marginTop: "1rem"}} onClick={handleSaveConfig}>Guardar Cambios</button>
                </div>
                <div className={styles.configCard}>
                  <h2 className={styles.configCardTitle}><HiOutlineClock /> Horarios</h2>
                  <div className={styles.configItem}>
                    <span>Lun-Jue</span>
                    <div style={{display: "flex", gap: "4px"}}>
                      <input type="time" className={styles.timeInput} value={config.schedule.monThuIn} onChange={(e) => setConfig({...config, schedule: {...config.schedule, monThuIn: e.target.value}})} />
                      <input type="time" className={styles.timeInput} value={config.schedule.monThuOut} onChange={(e) => setConfig({...config, schedule: {...config.schedule, monThuOut: e.target.value}})} />
                    </div>
                  </div>
                  <div className={styles.configItem}>
                    <span>Viernes</span>
                    <div style={{display: "flex", gap: "4px"}}>
                      <input type="time" className={styles.timeInput} value={config.schedule.friIn} onChange={(e) => setConfig({...config, schedule: {...config.schedule, friIn: e.target.value}})} />
                      <input type="time" className={styles.timeInput} value={config.schedule.friOut} onChange={(e) => setConfig({...config, schedule: {...config.schedule, friOut: e.target.value}})} />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* MODALS */}
      {showEmpModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>{editingEmp ? "Editar Empleado" : "Nuevo Empleado"}</h2>
              <button className={styles.modalClose} onClick={() => setShowEmpModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSaveEmployee}>
              <div className={styles.modalBody}>
                <div className={styles.formGrid}>
                  <div className={styles.formGroupFull}>
                    <label className={styles.formLabel}>Nombre</label>
                    <input type="text" required className={styles.formInput} value={empForm.name} onChange={(e) => setEmpForm({...empForm, name: e.target.value})} />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Email</label>
                    <input type="email" className={styles.formInput} value={empForm.email} onChange={(e) => setEmpForm({...empForm, email: e.target.value})} />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Teléfono</label>
                    <input type="text" className={styles.formInput} value={empForm.phone} onChange={(e) => setEmpForm({...empForm, phone: e.target.value})} />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>DUI</label>
                    <input type="text" className={styles.formInput} value={empForm.dui} onChange={(e) => setEmpForm({...empForm, dui: e.target.value})} />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Fecha Contratación</label>
                    <input type="date" className={styles.formInput} value={empForm.hireDate} onChange={(e) => setEmpForm({...empForm, hireDate: e.target.value})} />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Departamento</label>
                    <div className={styles.inlineSelect}>
                      <select className={styles.formSelect} value={empForm.department} onChange={(e) => setEmpForm({...empForm, department: e.target.value})}>
                        <option value="">Seleccionar...</option>
                        {config.departments.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                      <button type="button" className={styles.inlineToggle} onClick={() => { setShowNewDept(!showNewDept); setNewDeptName(""); }}>
                        {showNewDept ? "−" : "+"}
                      </button>
                    </div>
                    {showNewDept && (
                      <div className={styles.inlineCreate}>
                        <input type="text" className={styles.formInput} placeholder="Nuevo departamento" value={newDeptName} onChange={(e) => setNewDeptName(e.target.value)} />
                        <button type="button" className={styles.btnPrimary} style={{padding:"0.35rem 0.7rem",fontSize:"0.78rem"}} onClick={handleAddDept}>Crear</button>
                      </div>
                    )}
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Cargo</label>
                    <div className={styles.inlineSelect}>
                      <select className={styles.formSelect} value={empForm.position} onChange={(e) => setEmpForm({...empForm, position: e.target.value})}>
                        <option value="">Seleccionar...</option>
                        {config.positions.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                      <button type="button" className={styles.inlineToggle} onClick={() => { setShowNewPosition(!showNewPosition); setNewPositionName(""); }}>
                        {showNewPosition ? "−" : "+"}
                      </button>
                    </div>
                    {showNewPosition && (
                      <div className={styles.inlineCreate}>
                        <input type="text" className={styles.formInput} placeholder="Nuevo cargo" value={newPositionName} onChange={(e) => setNewPositionName(e.target.value)} />
                        <button type="button" className={styles.btnPrimary} style={{padding:"0.35rem 0.7rem",fontSize:"0.78rem"}} onClick={handleAddPosition}>Crear</button>
                      </div>
                    )}
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Salario ($)</label>
                    <input type="text" inputMode="decimal" required className={styles.formInput} value={empForm.baseSalary} onChange={(e) => setEmpForm({...empForm, baseSalary: e.target.value.replace(',', '.')})} />
                  </div>
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={styles.btnOutline} onClick={() => setShowEmpModal(false)}>Cerrar</button>
                <button type="submit" className={styles.btnPrimary}>Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPeriodModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Nuevo Período</h2>
              <button className={styles.modalClose} onClick={() => setShowPeriodModal(false)}>&times;</button>
            </div>
              <div className={styles.modalBody}>
              <div className={styles.formGrid}>
                <div className={styles.formGroupFull}>
                  <label className={styles.formLabel}>Nombre</label>
                  <input type="text" placeholder="Ej: Enero 2026" className={styles.formInput} value={periodForm.name} onChange={(e) => setPeriodForm({...periodForm, name: e.target.value})} />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Inicio</label>
                  <input type="date" className={styles.formInput} value={periodForm.startDate} onChange={(e) => setPeriodForm({...periodForm, startDate: e.target.value})} />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Fin</label>
                  <input type="date" className={styles.formInput} value={periodForm.endDate} onChange={(e) => setPeriodForm({...periodForm, endDate: e.target.value})} />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Tipo</label>
                  <select className={styles.formSelect} value={periodForm.type} onChange={(e) => setPeriodForm({...periodForm, type: e.target.value})}>
                    <option value="monthly">Mensual</option>
                    <option value="biweekly">Quincenal</option>
                  </select>
                </div>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnPrimary} onClick={() => savePayrollPeriod(null, {...periodForm, status: "draft"}).then(() => { setShowPeriodModal(false); loadInitialData(); })}>Crear</button>
            </div>
          </div>
        </div>
      )}

      {/* GENERAR PLANILLAS MODAL */}
      {showGenPeriodsModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}><HiOutlineCalendarDays /> Generar Planillas</h2>
              <button className={styles.modalClose} onClick={() => setShowGenPeriodsModal(false)}>&times;</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Fecha Inicio</label>
                  <input type="date" className={styles.formInput} value={genPeriodStart} onChange={(e) => setGenPeriodStart(e.target.value)} />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Fecha Fin</label>
                  <input type="date" className={styles.formInput} value={genPeriodEnd} onChange={(e) => setGenPeriodEnd(e.target.value)} />
                </div>
              </div>
              <p style={{margin: "1rem 0 0", fontSize: "0.82rem", color: "#64748B"}}>
                Se generarán períodos quincenales (Q1: 1-15, Q2: 16-fin de mes) dentro del rango seleccionado.
              </p>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnOutline} onClick={() => setShowGenPeriodsModal(false)}>Cancelar</button>
              <button className={styles.btnPrimary} onClick={generatePeriods}>Generar</button>
            </div>
          </div>
        </div>
      )}

      {/* DEDUCCIONES MODAL */}
      {showEmpDeductionsModal && deductionEmp && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Deducciones: {deductionEmp.employeeName}</h2>
              <button className={styles.modalClose} onClick={() => { setShowEmpDeductionsModal(false); setDeductionEmp(null); }}>&times;</button>
            </div>
            <div className={styles.modalBody}>
              <p style={{fontSize: "0.85rem", color: "#475569", marginBottom: "0.75rem"}}>
                Salario Base: {formatPrice(deductionEmp.baseSalary)} | Neto actual: {formatPrice(deductionEmp.netPay)}
              </p>
              <h4 style={{fontSize: "0.82rem", fontWeight: 700, color: "#0F172A", marginBottom: "0.5rem"}}>Deducciones registradas</h4>
              <div className={styles.tableWrap} style={{marginBottom: "1rem"}}>
                <table className={styles.payrollTable}>
                  <thead>
                    <tr>
                      <th>Descripción</th>
                      <th className={styles.cellRight}>Monto</th>
                      <th style={{width: 40}}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(deductionEmp.deductions || []).length === 0 ? (
                      <tr><td colSpan={3} style={{textAlign: "center", color: "#94A3B8", padding: "1rem"}}>Sin deducciones</td></tr>
                    ) : (
                      (deductionEmp.deductions || []).map((d, i) => (
                        <tr key={i}>
                          <td>{d.description}</td>
                          <td className={styles.cellRed}>{formatPrice(d.amount)}</td>
                          <td><button className={styles.actionBtnDel} style={{width:28,height:28,border:"none"}} onClick={() => removeDeduction(i)}>&times;</button></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot>
                    <tr className={styles.totalRow}>
                      <td><strong>Total</strong></td>
                      <td className={styles.cellRed}><strong>{formatPrice((deductionEmp.deductions || []).reduce((s, d) => s + (d.amount || 0), 0))}</strong></td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <h4 style={{fontSize: "0.82rem", fontWeight: 700, color: "#0F172A", marginBottom: "0.5rem"}}>Agregar deducción</h4>
              <div style={{display: "flex", gap: "0.5rem", alignItems: "flex-end"}}>
                <div className={styles.formGroup} style={{flex: 1}}>
                  <label className={styles.formLabel}>Descripción</label>
                  <input type="text" className={styles.formInput} placeholder="Ej: Préstamo, Factura..." value={deductionDesc} onChange={(e) => setDeductionDesc(e.target.value)} />
                </div>
                <div className={styles.formGroup} style={{width: 120}}>
                  <label className={styles.formLabel}>Monto $</label>
                  <input type="text" inputMode="decimal" className={styles.formInput} value={deductionAmount} onChange={(e) => setDeductionAmount(e.target.value.replace(',', '.'))} />
                </div>
                <button className={styles.btnPrimary} onClick={addDeduction} style={{height: 38}}>+</button>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnOutline} onClick={() => { setShowEmpDeductionsModal(false); setDeductionEmp(null); }}>Cancelar</button>
              <button className={styles.btnPrimary} onClick={saveDeductions}>Guardar Deducciones</button>
            </div>
          </div>
        </div>
      )}

      {/* PAPELERA MODAL */}
      {showTrashModal && (
        <div className={styles.modalOverlay}>
          <div className={`${styles.modal} ${styles.modalLg}`}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}><HiOutlineArchiveBoxXMark /> Papelera</h2>
              <button className={styles.modalClose} onClick={() => setShowTrashModal(false)}>&times;</button>
            </div>
            <div className={styles.modalBody}>
              {trashedPeriods.length === 0 ? (
                <div className={styles.emptyState}>
                  <HiOutlineArchiveBoxXMark size={32} style={{opacity: 0.4}} />
                  <p>La papelera está vacía</p>
                </div>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Nombre</th>
                        <th>Inicio</th>
                        <th>Fin</th>
                        <th>Tipo</th>
                        <th>Total</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trashedPeriods.map(p => (
                        <tr key={p.id}>
                          <td><strong>{p.name}</strong></td>
                          <td>{p.startDate}</td>
                          <td>{p.endDate}</td>
                          <td>{p.type === "biweekly" ? "Quincenal" : "Mensual"}</td>
                          <td>{formatPrice(p.totalNet || 0)}</td>
                          <td>
                            <div style={{display: "flex", gap: 6}}>
                              <button className={styles.btnOutline} style={{padding: "0.35rem 0.7rem", fontSize: "0.78rem"}}
                                onClick={async () => {
                                  await restorePayrollPeriod(p.id);
                                  const [list, trash] = await Promise.all([getPayrollPeriods(), getTrashedPayrollPeriods()]);
                                  setPeriods(list);
                                  setTrashedPeriods(trash);
                                  showToast("Período restaurado");
                                }}>
                                <HiOutlineArrowUturnLeft size={14} /> Restaurar
                              </button>
                              <button className={styles.btnDanger} style={{padding: "0.35rem 0.7rem", fontSize: "0.78rem"}}
                                onClick={async () => {
                                  if (window.confirm(`¿Eliminar permanentemente "${p.name}"? Esta acción no se puede deshacer.`)) {
                                    await deletePayrollPeriod(p.id);
                                    const [list, trash] = await Promise.all([getPayrollPeriods(), getTrashedPayrollPeriods()]);
                                    setPeriods(list);
                                    setTrashedPeriods(trash);
                                    showToast("Período eliminado permanentemente");
                                  }
                                }}>
                                <HiOutlineTrash size={14} /> Eliminar
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnOutline} onClick={() => setShowTrashModal(false)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* LOAN MODAL */}
      {showLoanModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}><HiOutlineWallet /> Nuevo Préstamo / Adelanto</h2>
              <button className={styles.modalClose} onClick={() => setShowLoanModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSaveLoan}>
              <div className={styles.modalBody}>
                <div className={styles.formGrid}>
                  <div className={styles.formGroupFull}>
                    <label className={styles.formLabel}>Empleado</label>
                    <select
                      required
                      className={styles.formSelect}
                      value={loanForm.employeeId}
                      onChange={(e) => setLoanForm({...loanForm, employeeId: e.target.value})}
                    >
                      <option value="">Seleccionar empleado...</option>
                      {employees.filter(e => e.status === "active").map(e => (
                        <option key={e.id} value={e.id}>{e.name} — {formatPrice(e.baseSalary)}/mes</option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.formGroupFull}>
                    <label className={styles.formLabel}>Descripción del Préstamo</label>
                    <input
                      type="text"
                      required
                      className={styles.formInput}
                      placeholder="Ej: Anticipo de sueldo, Préstamo personal..."
                      value={loanForm.description}
                      onChange={(e) => setLoanForm({...loanForm, description: e.target.value})}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Monto Total ($)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      required
                      className={styles.formInput}
                      placeholder="0.00"
                      value={loanForm.amount}
                      onChange={(e) => {
                        const amt = e.target.value.replace(',', '.');
                        const cts = parseInt(loanForm.cuotas) || 1;
                        const numAmt = parseFloat(amt);
                        setLoanForm({...loanForm, amount: amt, cuotaVal: numAmt ? (numAmt/cts).toFixed(2) : ''});
                      }}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Número de Cuotas</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      required
                      className={styles.formInput}
                      value={loanForm.cuotas}
                      onChange={(e) => {
                        const raw = e.target.value.replace(',', '.').replace(/[^0-9]/g, '');
                        const cts = parseInt(raw) || 1;
                        const amt = parseFloat(normalizeNum(loanForm.amount)) || 0;
                        setLoanForm({...loanForm, cuotas: cts, cuotaVal: amt > 0 ? (amt/cts).toFixed(2) : loanForm.cuotaVal});
                      }}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Monto por Cuota ($) <span style={{color:"#94A3B8",fontWeight:400}}>(editable)</span></label>
                    <input
                      type="text"
                      inputMode="decimal"
                      required
                      className={styles.formInput}
                      value={loanForm.cuotaVal}
                      onChange={(e) => setLoanForm({...loanForm, cuotaVal: e.target.value.replace(',', '.')})}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Frecuencia de Cobro</label>
                    <select
                      className={styles.formSelect}
                      value={loanForm.frequency}
                      onChange={(e) => setLoanForm({...loanForm, frequency: e.target.value})}
                    >
                      <option value="always">Cada quincena (Q1 y Q2)</option>
                      <option value="q2">Solo fin de mes (Q2 o Mensual)</option>
                    </select>
                  </div>
                </div>

                {loanForm.amount && loanForm.cuotas && loanForm.cuotaVal && (
                  <div className={styles.loanPreview}>
                    <div className={styles.loanPreviewRow}>
                      <span>Monto Total:</span>
                      <strong>{formatPrice(parseFloat(normalizeNum(loanForm.amount)) || 0)}</strong>
                    </div>
                    <div className={styles.loanPreviewRow}>
                      <span>Cuotas:</span>
                      <strong>{loanForm.cuotas} × {formatPrice(parseFloat(normalizeNum(loanForm.cuotaVal)) || 0)}</strong>
                    </div>
                    <div className={styles.loanPreviewRow}>
                      <span>Frecuencia:</span>
                      <strong>{loanForm.frequency === "q2" ? "Solo Q2 / Fin de mes" : "Cada quincena"}</strong>
                    </div>
                  </div>
                )}
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={styles.btnOutline} onClick={() => setShowLoanModal(false)}>Cancelar</button>
                <button type="submit" className={styles.btnPrimary}><HiOutlineWallet /> Registrar Préstamo</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BOLETA DE PAGO MODAL */}
      {showReceiptModal && receiptData && (
        <div className={styles.receiptOverlay} id="receipt-overlay">
          <div className={styles.receiptModal} id="receipt-modal">
            {/* Header de la Boleta */}
            <div className={styles.receiptHeader}>
              <div className={styles.receiptCompany}>
                <div className={styles.receiptCompanyName}>{settings?.name || "Empresa"}</div>
                <div className={styles.receiptCompanyInfo}>
                  {settings?.address && <span>{settings.address}</span>}
                  {settings?.phone && <span>Tel: {settings.phone}</span>}
                  {settings?.email && <span>{settings.email}</span>}
                </div>
              </div>
              <div className={styles.receiptMeta}>
                <div className={styles.receiptTitle}>BOLETA DE PAGO DE SUELDO</div>
                <div className={styles.receiptPeriod}>
                  Período: {selectedPeriodDetail?.startDate} al {selectedPeriodDetail?.endDate}
                </div>
                <div className={styles.receiptPeriod}>
                  {selectedPeriodDetail?.type === "biweekly" ? "(Quincenal)" : "(Mensual)"}
                </div>
              </div>
            </div>

            {/* Datos del Empleado */}
            <div className={styles.receiptEmpInfo}>
              <div className={styles.receiptEmpRow}>
                <span className={styles.receiptEmpLabel}>Empleado:</span>
                <span className={styles.receiptEmpVal}><strong>{receiptData.employeeName}</strong></span>
              </div>
              {(() => {
                const empDetail = employees.find(e => e.id === receiptData.employeeId);
                return (
                  <>
                    {empDetail?.dui && (
                      <div className={styles.receiptEmpRow}>
                        <span className={styles.receiptEmpLabel}>DUI:</span>
                        <span className={styles.receiptEmpVal}>{empDetail.dui}</span>
                      </div>
                    )}
                    {empDetail?.position && (
                      <div className={styles.receiptEmpRow}>
                        <span className={styles.receiptEmpLabel}>Cargo:</span>
                        <span className={styles.receiptEmpVal}>{empDetail.position}</span>
                      </div>
                    )}
                    {empDetail?.department && (
                      <div className={styles.receiptEmpRow}>
                        <span className={styles.receiptEmpLabel}>Departamento:</span>
                        <span className={styles.receiptEmpVal}>{empDetail.department}</span>
                      </div>
                    )}
                    {empDetail?.hireDate && (
                      <div className={styles.receiptEmpRow}>
                        <span className={styles.receiptEmpLabel}>Fecha Contratación:</span>
                        <span className={styles.receiptEmpVal}>{empDetail.hireDate}</span>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            {/* Desglose de Ingresos y Egresos */}
            <div className={styles.receiptColumns}>
              {/* Ingresos */}
              <div className={styles.receiptCol}>
                <div className={styles.receiptColTitle}>INGRESOS (Percepciones)</div>
                <div className={styles.receiptItem}>
                  <span>Salario Base {selectedPeriodDetail?.type === "biweekly" ? "Quincenal" : "Mensual"}</span>
                  <span>{formatPrice(receiptData.baseSalary)}</span>
                </div>
                {receiptData.overtimePay > 0 && (
                  <div className={styles.receiptItem}>
                    <span>Horas Extras ({receiptData.overtimeHours?.toFixed(1)}h)</span>
                    <span>{formatPrice(receiptData.overtimePay)}</span>
                  </div>
                )}
                <div className={styles.receiptItemTotal}>
                  <span>Total Ingresos</span>
                  <span>{formatPrice(receiptData.baseSalary + (receiptData.overtimePay || 0))}</span>
                </div>
              </div>

              {/* Egresos */}
              <div className={styles.receiptCol}>
                <div className={styles.receiptColTitle}>DEDUCCIONES (Egresos)</div>

                {(receiptData.absentDeduction + receiptData.tardinessDeduction) > 0 && (
                  <div className={styles.receiptItem} style={{color:"#DC2626"}}>
                    <span>Desc. Asistencia
                      {receiptData.daysAbsent > 0 && ` (${receiptData.daysAbsent} ausencia(s))`}
                      {receiptData.lateMinutes > 0 && ` + ${formatMinutes(receiptData.lateMinutes)} tardanza`}
                    </span>
                    <span>−{formatPrice(receiptData.absentDeduction + receiptData.tardinessDeduction)}</span>
                  </div>
                )}

                <div className={styles.receiptItem}>
                  <span>ISSS (3.0%)</span>
                  <span>−{formatPrice(receiptData.isss)}</span>
                </div>

                <div className={styles.receiptItem}>
                  <span>AFP (7.25%)</span>
                  <span>−{formatPrice(receiptData.afp)}</span>
                </div>

                {receiptData.isr > 0 && (
                  <div className={styles.receiptItem}>
                    <span>Impuesto s/Renta (ISR)</span>
                    <span>−{formatPrice(receiptData.isr)}</span>
                  </div>
                )}

                {(receiptData.loanDeductions || []).map((ld, i) => (
                  <div key={i} className={styles.receiptItem} style={{color:"#DC2626"}}>
                    <span>{ld.description}</span>
                    <span>−{formatPrice(ld.amount)}</span>
                  </div>
                ))}

                {(receiptData.deductions || []).map((d, i) => (
                  <div key={i} className={styles.receiptItem} style={{color:"#DC2626"}}>
                    <span>{d.description}</span>
                    <span>−{formatPrice(d.amount)}</span>
                  </div>
                ))}

                <div className={styles.receiptItemTotal} style={{color:"#DC2626"}}>
                  <span>Total Deducciones</span>
                  <span>−{formatPrice(receiptData.totalDeductions)}</span>
                </div>
              </div>
            </div>

            {/* Neto a Recibir */}
            <div className={styles.receiptNet}>
              <div className={styles.receiptNetLabel}>NETO A RECIBIR</div>
              <div className={styles.receiptNetAmount}>{formatPrice(receiptData.netPay)}</div>
              <div className={styles.receiptNetWords}>
                {numberToWordsSpan(receiptData.netPay)}
              </div>
            </div>

            {/* Firmas */}
            <div className={styles.receiptSignatures}>
              <div className={styles.receiptSignature}>
                <div className={styles.receiptSignatureLine} />
                <div className={styles.receiptSignatureLabel}>Firma Empleado</div>
                <div className={styles.receiptSignatureLabel} style={{fontSize:"0.72rem",marginTop:"0.2rem"}}>
                  {receiptData.employeeName}
                </div>
              </div>
              <div className={styles.receiptSignature}>
                <div className={styles.receiptSignatureLine} />
                <div className={styles.receiptSignatureLabel}>Firma Patrono / Responsable</div>
              </div>
            </div>

            {/* Pie de boleta */}
            <div className={styles.receiptFooter}>
              <span>Emitido el: {new Date().toLocaleDateString("es-SV", { day: "2-digit", month: "long", year: "numeric" })}</span>
              <span>Sistema de Planilla · {settings?.name || ""}</span>
            </div>

            {/* Botones de acción (solo en pantalla, ocultos al imprimir) */}
            <div className={styles.receiptActions}>
              <button
                className={styles.btnOutline}
                onClick={() => { setShowReceiptModal(false); setReceiptData(null); }}
              >
                Cerrar
              </button>
              <button
                className={styles.btnPrimary}
                onClick={handlePrintReceipt}
              >
                <HiOutlinePrinter /> Imprimir / Guardar PDF
              </button>
            </div>
          </div>
        </div>
      )}

      <StoreFooter />
    </div>
  );
}
