import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { 
  Clock, 
  Users, 
  CheckCircle2, 
  XCircle, 
  Activity, 
  Search, 
  Filter, 
  Eye, 
  RefreshCw, 
  Shield, 
  Laptop, 
  Globe, 
  Calendar, 
  X,
  ListFilter,
  UserCheck,
  Zap,
  ChevronLeft,
  ChevronRight,
  FileText,
  Compass,
  PlusCircle,
  Pencil,
  Trash2,
  UploadCloud,
  DownloadCloud,
  AlertTriangle,
  Lock,
  LogOut
} from "lucide-react";
import { useUIStore, useAuthStore } from "../store";

export interface LogAcao {
  id: string;
  timestamp: string;
  modulo: string;
  acao: string;
  detalhe: string;
  submodulo?: string;
  tela?: string;
  rota?: string;
  tipo?: "NAVEGACAO" | "FILTRO" | "CRIACAO" | "EDICAO" | "EXCLUSAO" | "UPLOAD" | "DOWNLOAD" | "AUTH" | "ERRO";
  antes?: string;
  depois?: string;
  arquivo?: string;
  tamanho?: string;
  obra?: string;
}

export interface FlatActionLog extends LogAcao {
  usuario_id: string;
  usuario_nome: string;
  usuario_email: string;
  usuario_nivel: string;
  ip_address: string;
  session_id: string;
  session_status: string;
}

export interface AccessLogItem {
  id: string;
  session_token: string;
  usuario_id: string;
  usuario_nome: string;
  usuario_email: string;
  usuario_nivel: string;
  ip_address: string;
  user_agent: string;
  login_at: string;
  logout_at: string | null;
  last_heartbeat: string;
  last_activity?: string;
  status: "ONLINE" | "AFK" | "OFFLINE" | "DESCONECTADO";
  duracao_segundos: number;
  motivo_encerramento?: string | null;
  acoes: LogAcao[];
}

const getActionTypeDetails = (tipo?: string) => {
  switch (tipo) {
    case "NAVEGACAO":
      return {
        icon: Compass,
        colorClass: "bg-blue-50 text-blue-700 border-blue-100",
        bulletColor: "bg-blue-500"
      };
    case "FILTRO":
      return {
        icon: Filter,
        colorClass: "bg-amber-50 text-amber-700 border-amber-100",
        bulletColor: "bg-amber-500"
      };
    case "CRIACAO":
      return {
        icon: PlusCircle,
        colorClass: "bg-emerald-50 text-emerald-700 border-emerald-100",
        bulletColor: "bg-emerald-500"
      };
    case "EDICAO":
      return {
        icon: Pencil,
        colorClass: "bg-indigo-50 text-indigo-700 border-indigo-100",
        bulletColor: "bg-indigo-500"
      };
    case "EXCLUSAO":
      return {
        icon: Trash2,
        colorClass: "bg-rose-50 text-rose-700 border-rose-100",
        bulletColor: "bg-rose-500"
      };
    case "UPLOAD":
      return {
        icon: UploadCloud,
        colorClass: "bg-cyan-50 text-cyan-700 border-cyan-100",
        bulletColor: "bg-cyan-500"
      };
    case "DOWNLOAD":
      return {
        icon: DownloadCloud,
        colorClass: "bg-teal-50 text-teal-700 border-teal-100",
        bulletColor: "bg-teal-500"
      };
    case "AUTH":
      return {
        icon: Lock,
        colorClass: "bg-purple-50 text-purple-700 border-purple-100",
        bulletColor: "bg-purple-500"
      };
    case "ERRO":
      return {
        icon: AlertTriangle,
        colorClass: "bg-red-50 text-red-700 border-red-100 animate-pulse",
        bulletColor: "bg-red-500"
      };
    default:
      return {
        icon: Activity,
        colorClass: "bg-slate-50 text-slate-700 border-slate-100",
        bulletColor: "bg-slate-400"
      };
  }
};

const formatTimeWithDate = (dateStr: string) => {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const date = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
    return `${time} ${date}`;
  } catch {
    return "";
  }
};

export default function LogsAcessoView() {
  const usuariosSubView = useUIStore((state) => state.usuariosSubView);
  const setUsuariosSubView = useUIStore((state) => state.setUsuariosSubView);
  const token = useAuthStore((state) => state.token);
  const currentUser = useAuthStore((state) => state.user);
  const isAdmin = currentUser?.nivel === "ADMIN";
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"TODOS" | "ONLINE" | "AFK" | "OFFLINE">("TODOS");
  const [nivelFilter, setNivelFilter] = useState<string>("TODOS");
  const [startDateFilter, setStartDateFilter] = useState<string>("");
  const [endDateFilter, setEndDateFilter] = useState<string>("");
  const [selectedLogForDetail, setSelectedLogForDetail] = useState<AccessLogItem | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [nowTimestamp, setNowTimestamp] = useState(Date.now());
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());

  // Tabs state: "sessoes" vs "acoes"
  const [activeTab, setActiveTab] = useState<"sessoes" | "acoes">("sessoes");
  const [actionTipoFilter, setActionTipoFilter] = useState<string>("TODOS");
  const [actionModuloFilter, setActionModuloFilter] = useState<string>("TODOS");
  const [selectedSingleActionDetail, setSelectedSingleActionDetail] = useState<FlatActionLog | null>(null);

  // Click outside to close calendar popover
  useEffect(() => {
    if (!isCalendarOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".calendar-popover-container")) {
        setIsCalendarOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isCalendarOpen]);

  // Force Logout Modal State
  const [disconnectingLog, setDisconnectingLog] = useState<AccessLogItem | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [disconnectError, setDisconnectError] = useState<string | null>(null);
  const [disconnectSuccess, setDisconnectSuccess] = useState<string | null>(null);

  const handleForceDisconnect = async () => {
    if (!disconnectingLog) return;
    setIsDisconnecting(true);
    setDisconnectError(null);
    setDisconnectSuccess(null);

    try {
      const res = await fetch("/api/logs-acesso/desconectar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          logId: disconnectingLog.id,
          session_token: disconnectingLog.session_token,
          usuario_id: disconnectingLog.usuario_id
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro ao desconectar sessão.");
      }

      setDisconnectSuccess(`Sessão de ${disconnectingLog.usuario_nome} encerrada com sucesso!`);
      setTimeout(() => {
        setDisconnectingLog(null);
        setDisconnectSuccess(null);
      }, 1200);

      queryClient.invalidateQueries({ queryKey: ["logs-acesso"] });
      refetch();
    } catch (err: any) {
      setDisconnectError(err.message || "Erro de conexão ao solicitar encerramento da sessão.");
    } finally {
      setIsDisconnecting(false);
    }
  };

  // Local ticker every 1 second when autoRefresh is enabled for live stopwatches
  useEffect(() => {
    if (!autoRefresh) return;
    setNowTimestamp(Date.now());
    const ticker = setInterval(() => {
      setNowTimestamp(Date.now());
    }, 1000);
    return () => clearInterval(ticker);
  }, [autoRefresh]);

  // Fetch access logs every 5 seconds when autoRefresh is ON
  const { data, isLoading, isFetching, refetch } = useQuery<{ logs: AccessLogItem[] }>({
    queryKey: ["logs-acesso"],
    queryFn: async () => {
      const res = await fetch("/api/logs-acesso", {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error("Erro ao carregar logs");
      return res.json();
    },
    refetchInterval: autoRefresh ? 5000 : false,
    refetchOnWindowFocus: true
  });

  const rawLogs = data?.logs || [];

  // Compute live presence status & stopwatch duration in real time
  const computedLogs: AccessLogItem[] = rawLogs.map((log) => {
    const hasLogout = !!log.logout_at;
    const loginTime = new Date(log.login_at).getTime();
    const heartbeatTime = new Date(log.last_heartbeat || log.login_at).getTime();
    const activityTime = new Date(log.last_activity || log.last_heartbeat || log.login_at).getTime();

    if (hasLogout) {
      const logoutTime = new Date(log.logout_at!).getTime();
      const dur = Math.max(0, Math.floor((logoutTime - loginTime) / 1000));
      const motivo = log.motivo_encerramento === "SESSION_EXPIRED" ? "LOGOUT" : (log.motivo_encerramento || "LOGOUT");
      return {
        ...log,
        status: "OFFLINE",
        duracao_segundos: dur,
        motivo_encerramento: motivo
      };
    }

    const hbAgeMs = nowTimestamp - heartbeatTime;
    const activityAgeMs = nowTimestamp - activityTime;

    if (hbAgeMs > 30000) {
      // Missing heartbeat (>30s) -> DESCONECTADO (Timeout)
      const dur = Math.max(0, Math.floor((heartbeatTime - loginTime) / 1000));
      return {
        ...log,
        status: "OFFLINE",
        logout_at: log.last_heartbeat,
        duracao_segundos: dur,
        motivo_encerramento: log.motivo_encerramento || "TIMEOUT"
      };
    } else if (activityAgeMs > 30000) {
      // Heartbeat ok, but activity > 30s -> AFK (Inativo / Ausente - sessão mantida aberta)
      const dur = Math.max(0, Math.floor((nowTimestamp - loginTime) / 1000));
      return {
        ...log,
        status: "AFK",
        logout_at: null,
        duracao_segundos: dur,
        motivo_encerramento: null
      };
    } else {
      // Heartbeat ok & activity <= 30s -> ONLINE
      const dur = Math.max(0, Math.floor((nowTimestamp - loginTime) / 1000));
      return {
        ...log,
        status: "ONLINE",
        logout_at: null,
        duracao_segundos: dur,
        motivo_encerramento: null
      };
    }
  });

  // Date filtering helpers
  const getTodayStr = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayStr = getTodayStr();
  const isTodaySelected = startDateFilter === todayStr && endDateFilter === todayStr;

  const handleSetToday = () => {
    const today = getTodayStr();
    setStartDateFilter(today);
    setEndDateFilter(today);
  };

  const handleDateDoubleClick = (e: React.MouseEvent<HTMLInputElement>) => {
    const val = e.currentTarget.value;
    if (val) {
      setStartDateFilter(val);
      setEndDateFilter(val);
    }
  };

  const handlePrevMonth = () => {
    setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const getDaysArrayForMonth = (monthDate: Date) => {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayIndex = new Date(year, month, 1).getDay();

    const days = [];
    const prevMonthDaysCount = new Date(year, month, 0).getDate();
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = prevMonthDaysCount - i;
      const prevMonth = month === 0 ? 11 : month - 1;
      const prevYear = month === 0 ? year - 1 : year;
      days.push({
        day: d,
        isCurrentMonth: false,
        dateStr: `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      days.push({
        day: d,
        isCurrentMonth: true,
        dateStr: `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      });
    }

    const totalCells = 42;
    const nextDaysNeeded = totalCells - days.length;
    for (let d = 1; d <= nextDaysNeeded; d++) {
      const nextMonth = month === 11 ? 0 : month + 1;
      const nextYear = month === 11 ? year + 1 : year;
      days.push({
        day: d,
        isCurrentMonth: false,
        dateStr: `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      });
    }

    return days;
  };

  const handleDayClick = (dateStr: string) => {
    if (!startDateFilter || (startDateFilter && endDateFilter)) {
      setStartDateFilter(dateStr);
      setEndDateFilter("");
    } else {
      if (dateStr < startDateFilter) {
        setStartDateFilter(dateStr);
      } else {
        setEndDateFilter(dateStr);
      }
    }
  };

  const handleDayDoubleClick = (dateStr: string) => {
    setStartDateFilter(dateStr);
    setEndDateFilter(dateStr);
    setIsCalendarOpen(false);
  };

  const applyQuickFilter = (type: "HOJE" | "ONTEM" | "SEMANA" | "MES" | "MES_PASSADO" | "ANO" | "ANO_PASSADO" | "TUDO") => {
    const today = new Date();
    const formatDate = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    switch (type) {
      case "HOJE": {
        const str = formatDate(today);
        setStartDateFilter(str);
        setEndDateFilter(str);
        break;
      }
      case "ONTEM": {
        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);
        const str = formatDate(yesterday);
        setStartDateFilter(str);
        setEndDateFilter(str);
        break;
      }
      case "SEMANA": {
        const currentDay = today.getDay();
        const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
        const monday = new Date(today);
        monday.setDate(today.getDate() + distanceToMonday);
        
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        
        setStartDateFilter(formatDate(monday));
        setEndDateFilter(formatDate(sunday));
        break;
      }
      case "MES": {
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        setStartDateFilter(formatDate(firstDay));
        setEndDateFilter(formatDate(lastDay));
        break;
      }
      case "MES_PASSADO": {
        const firstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastDay = new Date(today.getFullYear(), today.getMonth(), 0);
        setStartDateFilter(formatDate(firstDay));
        setEndDateFilter(formatDate(lastDay));
        break;
      }
      case "ANO": {
        const firstDay = new Date(today.getFullYear(), 0, 1);
        const lastDay = new Date(today.getFullYear(), 11, 31);
        setStartDateFilter(formatDate(firstDay));
        setEndDateFilter(formatDate(lastDay));
        break;
      }
      case "ANO_PASSADO": {
        const firstDay = new Date(today.getFullYear() - 1, 0, 1);
        const lastDay = new Date(today.getFullYear() - 1, 11, 31);
        setStartDateFilter(formatDate(firstDay));
        setEndDateFilter(formatDate(lastDay));
        break;
      }
      case "TUDO": {
        setStartDateFilter("");
        setEndDateFilter("");
        break;
      }
    }
  };

  const getActiveQuickFilter = () => {
    if (!startDateFilter && !endDateFilter) return "TUDO";
    
    const today = new Date();
    const formatDate = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const todayStr = formatDate(today);
    if (startDateFilter === todayStr && endDateFilter === todayStr) return "HOJE";

    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    const yesterdayStr = formatDate(yesterday);
    if (startDateFilter === yesterdayStr && endDateFilter === yesterdayStr) return "ONTEM";

    const currentDay = today.getDay();
    const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
    const monday = new Date(today);
    monday.setDate(today.getDate() + distanceToMonday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    if (startDateFilter === formatDate(monday) && endDateFilter === formatDate(sunday)) return "SEMANA";

    const firstDayMes = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDayMes = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    if (startDateFilter === formatDate(firstDayMes) && endDateFilter === formatDate(lastDayMes)) return "MES";

    const firstDayPrevMes = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastDayPrevMes = new Date(today.getFullYear(), today.getMonth(), 0);
    if (startDateFilter === formatDate(firstDayPrevMes) && endDateFilter === formatDate(lastDayPrevMes)) return "MES_PASSADO";

    const firstDayAno = new Date(today.getFullYear(), 0, 1);
    const lastDayAno = new Date(today.getFullYear(), 11, 31);
    if (startDateFilter === formatDate(firstDayAno) && endDateFilter === formatDate(lastDayAno)) return "ANO";

    const firstDayPrevAno = new Date(today.getFullYear() - 1, 0, 1);
    const lastDayPrevAno = new Date(today.getFullYear() - 1, 11, 31);
    if (startDateFilter === formatDate(firstDayPrevAno) && endDateFilter === formatDate(lastDayPrevAno)) return "ANO_PASSADO";

    return "";
  };

  const handleClearDates = () => {
    setStartDateFilter("");
    setEndDateFilter("");
  };

  const formatDateBR = (isoDateStr: string) => {
    if (!isoDateStr) return "";
    const parts = isoDateStr.split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return isoDateStr;
  };

  // Filter logs by Date Range first
  const dateFilteredLogs = computedLogs.filter((log) => {
    if (!startDateFilter && !endDateFilter) return true;
    if (!log.login_at) return true;

    const d = new Date(log.login_at);
    const logYear = d.getFullYear();
    const logMonth = String(d.getMonth() + 1).padStart(2, '0');
    const logDay = String(d.getDate()).padStart(2, '0');
    const logDateStr = `${logYear}-${logMonth}-${logDay}`;

    if (startDateFilter && logDateStr < startDateFilter) return false;
    if (endDateFilter && logDateStr > endDateFilter) return false;

    return true;
  });

  // Filter logs by search, status, nivel
  const filteredLogs = dateFilteredLogs.filter((log) => {
    const matchesSearch = 
      log.usuario_nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.usuario_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.ip_address.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = 
      statusFilter === "TODOS" || log.status === statusFilter;

    const matchesNivel = 
      nivelFilter === "TODOS" || log.usuario_nivel === nivelFilter;

    return matchesSearch && matchesStatus && matchesNivel;
  });

  // Flatten all action logs from dateFilteredLogs for the Actions Tab
  const allFlatActions: FlatActionLog[] = dateFilteredLogs.flatMap((log) => {
    if (!log.acoes || log.acoes.length === 0) return [];
    return log.acoes.map((action, idx) => ({
      ...action,
      id: action.id || `${log.id}-action-${idx}`,
      usuario_id: log.usuario_id,
      usuario_nome: log.usuario_nome,
      usuario_email: log.usuario_email,
      usuario_nivel: log.usuario_nivel,
      ip_address: log.ip_address,
      session_id: log.id,
      session_status: log.status
    }));
  }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const availableModules = Array.from(new Set(allFlatActions.map((a) => a.modulo).filter(Boolean)));

  const filteredFlatActions = allFlatActions.filter((item) => {
    const matchesSearch =
      !searchTerm ||
      item.usuario_nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.usuario_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.modulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.submodulo && item.submodulo.toLowerCase().includes(searchTerm.toLowerCase())) ||
      item.acao.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.detalhe && item.detalhe.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.obra && item.obra.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.arquivo && item.arquivo.toLowerCase().includes(searchTerm.toLowerCase())) ||
      item.ip_address.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesTipo =
      actionTipoFilter === "TODOS" || item.tipo === actionTipoFilter;

    const matchesModulo =
      actionModuloFilter === "TODOS" || item.modulo === actionModuloFilter;

    const matchesNivel =
      nivelFilter === "TODOS" || item.usuario_nivel === nivelFilter;

    return matchesSearch && matchesTipo && matchesModulo && matchesNivel;
  });

  const totalActionsCount = allFlatActions.length;
  const dataChangesCount = allFlatActions.filter((a) => a.tipo === "CRIACAO" || a.tipo === "EDICAO" || a.tipo === "EXCLUSAO").length;
  const fileOpsCount = allFlatActions.filter((a) => a.tipo === "UPLOAD" || a.tipo === "DOWNLOAD").length;
  const navigationOpsCount = allFlatActions.filter((a) => a.tipo === "NAVEGACAO" || a.tipo === "FILTRO" || a.tipo === "AUTH").length;

  // Analytics calculation based on dateFilteredLogs
  const totalLogs = dateFilteredLogs.length;
  const onlineCount = dateFilteredLogs.filter(l => l.status === "ONLINE").length;
  const afkCount = dateFilteredLogs.filter(l => l.status === "AFK").length;
  const disconnectedCount = dateFilteredLogs.filter(l => l.status === "OFFLINE" || l.status === "DESCONECTADO" || (l as any).status === "SESSION_EXPIRED" || l.logout_at !== null).length;
  const totalDuration = dateFilteredLogs.reduce((acc, l) => acc + (l.duracao_segundos || 0), 0);
  const avgDuration = totalLogs > 0 ? Math.floor(totalDuration / totalLogs) : 0;

  // Format session duration helper
  const formatDuration = (seconds: number) => {
    const totalSeconds = Math.max(0, Math.floor(seconds || 0));
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    if (hrs > 0) {
      return `${hrs}h ${mins}m ${secs}s`;
    }
    return `${mins}m ${secs}s`;
  };

  // Format date helper
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "— Em andamento";
    try {
      const d = new Date(dateStr);
      return d.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6" id="logs_acesso_container">
      {/* Module Selector Banner Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-brand-primary/10 rounded-xl text-brand-primary">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black tracking-tight text-slate-800 uppercase">Controle de Acessos</h1>
                <span className="px-2 py-0.5 bg-brand-primary/10 text-brand-primary text-[10px] font-extrabold uppercase rounded-full">
                  Submódulo
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Selecione um submódulo de acesso para gerenciar permissões ou visualizar históricos em tempo real.
              </p>
            </div>
          </div>
        </div>

        {/* Dropdownlist Selector requested by User */}
        <div className="flex items-center gap-3 w-full md:w-auto self-stretch md:self-auto">
          <div className="relative w-full md:w-64">
            <label htmlFor="submodule_select_dropdown" className="block text-[10px] font-black uppercase text-slate-400 mb-1">
              Submódulo Selecionado:
            </label>
            <div className="relative">
              <select
                id="submodule_select_dropdown"
                value={usuariosSubView}
                onChange={(e) => setUsuariosSubView(e.target.value as "gestao" | "logs")}
                className="w-full bg-slate-50 border-2 border-brand-primary/20 hover:border-brand-primary text-slate-800 text-xs font-black uppercase py-2.5 pl-3 pr-8 rounded-xl shadow-xs transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
              >
                <option value="gestao">👥 Gestão de Usuários & Permissões</option>
                <option value="logs">📜 Logs de Acesso e Sessões</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                <ListFilter className="w-4 h-4 text-brand-primary" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation Bar: Logs de Sessões vs Logs de Ações */}
      <div className="bg-white rounded-2xl border border-slate-100 p-2 shadow-xs flex flex-wrap items-center gap-2">
        <button
          onClick={() => setActiveTab("sessoes")}
          className={`flex-1 min-w-[200px] py-3 px-5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2.5 transition-all cursor-pointer ${
            activeTab === "sessoes"
              ? "bg-brand-primary text-white shadow-md shadow-brand-primary/20"
              : "bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-100"
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>Sessões de Acesso ({filteredLogs.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("acoes")}
          className={`flex-1 min-w-[200px] py-3 px-5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2.5 transition-all cursor-pointer ${
            activeTab === "acoes"
              ? "bg-brand-primary text-white shadow-md shadow-brand-primary/20"
              : "bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-100"
          }`}
        >
          <Zap className="w-4 h-4" />
          <span>Logs de Ações ({filteredFlatActions.length})</span>
        </button>
      </div>

      {activeTab === "sessoes" && (
        <>
          {/* Analytics KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 🟢 Usuários Online */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">🟢 Usuários Online</p>
            <div className="flex items-center gap-2 mt-1">
              <h3 className="text-2xl font-black text-emerald-600">{onlineCount}</h3>
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium mt-0.5">Conectados & Ativos agora</p>
          </div>
          <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600">
            <UserCheck className="w-6 h-6" />
          </div>
        </div>

        {/* 🟡 Usuários AFK */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">🟡 Usuários AFK</p>
            <h3 className="text-2xl font-black text-amber-600 mt-1">{afkCount}</h3>
            <p className="text-[10px] text-slate-400 font-medium mt-0.5">Conectados porém Ausentes (&gt; 30s)</p>
          </div>
          <div className="p-3 bg-amber-50 rounded-2xl text-amber-600">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        {/* 🔴 Usuários Desconectados */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">🔴 Desconectados</p>
            <h3 className="text-2xl font-black text-rose-600 mt-1">{disconnectedCount}</h3>
            <p className="text-[10px] text-slate-400 font-medium mt-0.5">Sem heartbeat ou Logout</p>
          </div>
          <div className="p-3 bg-rose-50 rounded-2xl text-rose-600">
            <XCircle className="w-6 h-6" />
          </div>
        </div>

        {/* ⏱️ Tempo Médio de Sessão */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">⏱️ Duração Média</p>
            <h3 className="text-2xl font-black text-slate-800 mt-1">{formatDuration(avgDuration)}</h3>
            <p className="text-[10px] text-slate-400 font-medium mt-0.5">Tempo médio de sessão</p>
          </div>
          <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600">
            <Clock className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por usuário, e-mail ou IP..."
              className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold pl-10 pr-4 py-2.5 rounded-xl focus:bg-white focus:border-brand-primary focus:outline-none transition-all"
            />
          </div>

          {/* Status Filter buttons */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl shrink-0 overflow-x-auto">
            <button
              onClick={() => setStatusFilter("TODOS")}
              className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                statusFilter === "TODOS" 
                  ? "bg-white text-slate-800 shadow-xs font-black" 
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Todos ({totalLogs})
            </button>
            <button
              onClick={() => setStatusFilter("ONLINE")}
              className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                statusFilter === "ONLINE" 
                  ? "bg-emerald-600 text-white shadow-xs font-black" 
                  : "text-emerald-700 hover:bg-emerald-50"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              🟢 Online ({onlineCount})
            </button>
            <button
              onClick={() => setStatusFilter("AFK")}
              className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                statusFilter === "AFK" 
                  ? "bg-amber-500 text-white shadow-xs font-black" 
                  : "text-amber-700 hover:bg-amber-50"
              }`}
            >
              🟡 AFK ({afkCount})
            </button>
            <button
              onClick={() => setStatusFilter("OFFLINE")}
              className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                statusFilter === "OFFLINE" 
                  ? "bg-rose-600 text-white shadow-xs font-black" 
                  : "text-rose-700 hover:bg-rose-50"
              }`}
            >
              🔴 Desconectados ({disconnectedCount})
            </button>
          </div>

          {/* Controls: Refresh and Auto Refresh toggle */}
          <div className="flex items-center gap-2 border-t md:border-t-0 md:border-l border-slate-100 pt-2 md:pt-0 md:pl-3">
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-2 transition-all cursor-pointer shrink-0"
              title="Atualizar Logs de Acesso"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin text-brand-primary" : ""}`} />
              <span className="hidden sm:inline">Atualizar</span>
            </button>

            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-3 py-2 text-xs font-extrabold rounded-xl flex items-center gap-2 border transition-all cursor-pointer shrink-0 ${
                autoRefresh 
                  ? "bg-emerald-50 border-emerald-300 text-emerald-800 shadow-xs" 
                  : "bg-slate-50 border-slate-200 text-slate-500"
              }`}
              title={autoRefresh ? "Tempo Real ATIVO: atualização a cada 5s e cronômetros locais a cada 1s" : "Clique para ativar monitoramento em tempo real"}
            >
              <Zap className={`w-3.5 h-3.5 ${autoRefresh ? "fill-emerald-600 text-emerald-600" : ""}`} />
              <span className="flex items-center gap-1.5">
                {autoRefresh && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>}
                <span>{autoRefresh ? "Tempo Real: ATIVO" : "Tempo Real: PAUSADO"}</span>
              </span>
            </button>
          </div>
        </div>

        {/* Date Filter Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Popover container */}
            <div className="relative calendar-popover-container">
              <div 
                onClick={() => setIsCalendarOpen(!isCalendarOpen)}
                className={`flex items-center border rounded-xl overflow-hidden cursor-pointer shadow-2xs transition-all bg-white ${
                  isCalendarOpen ? "border-brand-primary ring-2 ring-brand-primary/10" : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="bg-slate-50 border-r border-slate-200 p-2.5 flex items-center justify-center text-slate-600">
                  <Calendar className="w-4 h-4 text-slate-500" />
                </div>
                <div className="px-3 py-2 text-xs font-bold text-slate-700 min-w-[210px] select-none text-center">
                  {startDateFilter 
                    ? `${formatDateBR(startDateFilter)} - ${formatDateBR(endDateFilter || startDateFilter)}` 
                    : "Calendário"}
                </div>
              </div>

              {isCalendarOpen && (
                <div className="absolute left-0 mt-2 z-50 flex bg-white border border-slate-200 rounded-2xl shadow-xl p-4 gap-4 w-[680px]">
                  {/* Left Sidebar for Quick Filters */}
                  <div className="w-36 shrink-0 flex flex-col gap-1 border-r border-slate-100 pr-3">
                    {[
                      { label: "Hoje", key: "HOJE" },
                      { label: "Ontem", key: "ONTEM" },
                      { label: "Semana", key: "SEMANA" },
                      { label: "Mês", key: "MES" },
                      { label: "Mês passado", key: "MES_PASSADO" },
                      { label: "Ano", key: "ANO" },
                      { label: "Ano passado", key: "ANO_PASSADO" },
                      { label: "Tudo", key: "TUDO" }
                    ].map((item) => {
                      const active = getActiveQuickFilter() === item.key;
                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => applyQuickFilter(item.key as any)}
                          className={`w-full text-left px-3 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                            active
                              ? "bg-[#4a5f73] text-white font-black"
                              : "text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Right Side: Header Boxes + Two Calendars */}
                  <div className="flex-1 flex flex-col gap-4">
                    {/* Upper Selection Preview Boxes */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-500 font-bold select-none">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-slate-700">{startDateFilter ? formatDateBR(startDateFilter) : "Início"}</span>
                      </div>
                      <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-500 font-bold select-none">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-slate-700">{endDateFilter ? formatDateBR(endDateFilter) : "Fim"}</span>
                      </div>
                    </div>

                    {/* Side-by-side Calendars */}
                    <div className="grid grid-cols-2 gap-4">
                      {/* Left Month Calendar */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between px-1">
                          <button
                            type="button"
                            onClick={handlePrevMonth}
                            className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <span className="font-bold text-slate-800 text-xs capitalize">
                            {calendarMonth.toLocaleString('pt-BR', { month: 'short', year: 'numeric' })}
                          </span>
                          <div className="w-6"></div>
                        </div>

                        <div className="grid grid-cols-7 text-center text-[10px] font-black uppercase text-slate-400">
                          <span>Dom</span>
                          <span>Seg</span>
                          <span>Ter</span>
                          <span>Qua</span>
                          <span>Qui</span>
                          <span>Sex</span>
                          <span>Sáb</span>
                        </div>

                        <div className="grid grid-cols-7 gap-1">
                          {getDaysArrayForMonth(calendarMonth).map((cell, idx) => {
                            const isSelectedStart = cell.dateStr === startDateFilter;
                            const isSelectedEnd = cell.dateStr === endDateFilter;
                            const isInRange = startDateFilter && endDateFilter && cell.dateStr > startDateFilter && cell.dateStr < endDateFilter;
                            const isToday = cell.dateStr === todayStr;

                            let cellClass = "h-7 w-7 flex items-center justify-center rounded-lg text-[10px] font-bold transition-all cursor-pointer select-none ";
                            if (isSelectedStart || isSelectedEnd) {
                              cellClass += "bg-[#4a5f73] text-white shadow-xs font-black scale-105";
                            } else if (isInRange) {
                              cellClass += "bg-[#4a5f73]/15 text-[#4a5f73]";
                            } else if (!cell.isCurrentMonth) {
                              cellClass += "text-slate-300 hover:bg-slate-50";
                            } else {
                              cellClass += "text-slate-700 hover:bg-slate-100";
                            }

                            if (isToday && !isSelectedStart && !isSelectedEnd) {
                              cellClass += " ring-2 ring-[#4a5f73]/20 ring-offset-1";
                            }

                            return (
                              <div
                                key={idx}
                                onClick={() => handleDayClick(cell.dateStr)}
                                onDoubleClick={() => handleDayDoubleClick(cell.dateStr)}
                                className={cellClass}
                                title={`${formatDateBR(cell.dateStr)}`}
                              >
                                {cell.day}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Right Month Calendar */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between px-1">
                          <div className="w-6"></div>
                          <span className="font-bold text-slate-800 text-xs capitalize">
                            {new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1).toLocaleString('pt-BR', { month: 'short', year: 'numeric' })}
                          </span>
                          <button
                            type="button"
                            onClick={handleNextMonth}
                            className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="grid grid-cols-7 text-center text-[10px] font-black uppercase text-slate-400">
                          <span>Dom</span>
                          <span>Seg</span>
                          <span>Ter</span>
                          <span>Qua</span>
                          <span>Qui</span>
                          <span>Sex</span>
                          <span>Sáb</span>
                        </div>

                        <div className="grid grid-cols-7 gap-1">
                          {getDaysArrayForMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1)).map((cell, idx) => {
                            const isSelectedStart = cell.dateStr === startDateFilter;
                            const isSelectedEnd = cell.dateStr === endDateFilter;
                            const isInRange = startDateFilter && endDateFilter && cell.dateStr > startDateFilter && cell.dateStr < endDateFilter;
                            const isToday = cell.dateStr === todayStr;

                            let cellClass = "h-7 w-7 flex items-center justify-center rounded-lg text-[10px] font-bold transition-all cursor-pointer select-none ";
                            if (isSelectedStart || isSelectedEnd) {
                              cellClass += "bg-[#4a5f73] text-white shadow-xs font-black scale-105";
                            } else if (isInRange) {
                              cellClass += "bg-[#4a5f73]/15 text-[#4a5f73]";
                            } else if (!cell.isCurrentMonth) {
                              cellClass += "text-slate-300 hover:bg-slate-50";
                            } else {
                              cellClass += "text-slate-700 hover:bg-slate-100";
                            }

                            if (isToday && !isSelectedStart && !isSelectedEnd) {
                              cellClass += " ring-2 ring-[#4a5f73]/20 ring-offset-1";
                            }

                            return (
                              <div
                                key={idx}
                                onClick={() => handleDayClick(cell.dateStr)}
                                onDoubleClick={() => handleDayDoubleClick(cell.dateStr)}
                                className={cellClass}
                                title={`${formatDateBR(cell.dateStr)}`}
                              >
                                {cell.day}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {(startDateFilter || endDateFilter) && (
            <div className="text-[11px] font-bold text-[#4a5f73] bg-[#4a5f73]/10 px-3 py-1 rounded-xl flex items-center gap-1.5 shrink-0">
              <Filter className="w-3 h-3" />
              <span>
                {startDateFilter === endDateFilter && startDateFilter === todayStr
                  ? `Logs de Hoje (${formatDateBR(todayStr)})`
                  : `Período: ${startDateFilter ? formatDateBR(startDateFilter) : "Início"} a ${endDateFilter ? formatDateBR(endDateFilter) : "Hoje"}`}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
            <p className="text-xs font-semibold text-slate-400">Carregando histórico de acessos...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
            <div className="p-4 bg-slate-50 rounded-full text-slate-300">
              <Clock className="w-8 h-8" />
            </div>
            <p className="text-sm font-bold text-slate-600">Nenhum log de acesso encontrado</p>
            <p className="text-xs text-slate-400">Tente ajustar os termos de busca ou filtros selecionados.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-400">
                  <th className="py-3.5 px-4">Usuário / Nível</th>
                  <th className="py-3.5 px-4">Status Atual</th>
                  <th className="py-3.5 px-4">Horário do Login</th>
                  <th className="py-3.5 px-4">Horário do Logout / Saída</th>
                  <th className="py-3.5 px-4">Tempo de Sessão</th>
                  <th className="py-3.5 px-4">IP & Dispositivo</th>
                  <th className="py-3.5 px-4 text-center">Registros de Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredLogs.map((log) => {
                  const isOnline = log.status === "ONLINE";
                  const isAfk = log.status === "AFK";

                  return (
                    <tr 
                      key={log.id} 
                      className={`hover:bg-slate-50/80 transition-all ${
                        isOnline ? "bg-emerald-50/20" : isAfk ? "bg-amber-50/10" : ""
                      }`}
                    >
                      {/* Usuário */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs uppercase text-white shrink-0 ${
                            isOnline ? "bg-emerald-600 shadow-xs shadow-emerald-500/20" : isAfk ? "bg-amber-500" : "bg-slate-700"
                          }`}>
                            {log.usuario_nome.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-800 truncate">{log.usuario_nome}</p>
                            <p className="text-[11px] text-slate-400 truncate">{log.usuario_email}</p>
                            <span className="inline-block mt-0.5 text-[9px] font-black uppercase px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded">
                              {log.usuario_nivel}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Status no momento */}
                      <td className="py-3.5 px-4">
                        {isOnline ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-extrabold text-[11px]">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            <span>🟢 Online</span>
                          </div>
                        ) : isAfk ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 font-extrabold text-[11px]" title="Conectado porém sem interações por mais de 30s">
                            <Clock className="w-3.5 h-3.5 text-amber-600 animate-spin" style={{ animationDuration: "3s" }} />
                            <span>🟡 AFK (Ausente)</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 font-extrabold text-[11px]" title={log.motivo_encerramento === "DESCONECTADO_PELO_ADMIN" ? "Sessão encerrada por um administrador" : log.motivo_encerramento === "TIMEOUT" ? "Desconectado por ausência de heartbeat (> 30s)" : "Sessão encerrada por logout"}>
                            <XCircle className="w-3.5 h-3.5 text-rose-500" />
                            <span>🔴 Desconectado ({log.motivo_encerramento === "DESCONECTADO_PELO_ADMIN" ? "Por Admin" : log.motivo_encerramento === "TIMEOUT" ? "Timeout" : "Saída"})</span>
                          </div>
                        )}
                      </td>

                      {/* Horário do Login */}
                      <td className="py-3.5 px-4 font-semibold text-slate-700 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-slate-800 font-bold">
                          <Calendar className="w-3.5 h-3.5 text-brand-primary shrink-0" />
                          <span>{formatDate(log.login_at)}</span>
                        </div>
                      </td>

                      {/* Horário do Logout / Saída */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {isOnline || isAfk ? (
                          <span className="text-emerald-600 font-extrabold text-[11px] flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
                            Conectado agora
                          </span>
                        ) : (
                          <span className="text-slate-600 font-semibold">{formatDate(log.logout_at)}</span>
                        )}
                      </td>

                      {/* Tempo de Sessão */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-black text-xs ${
                          isOnline || isAfk ? "bg-emerald-100/60 text-emerald-800" : "bg-slate-100 text-slate-700"
                        }`}>
                          <Clock className="w-3.5 h-3.5" />
                          {formatDuration(log.duracao_segundos)}
                        </span>
                      </td>

                      {/* IP & Dispositivo */}
                      <td className="py-3.5 px-4 text-slate-500">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1 font-mono text-[11px] font-bold text-slate-700">
                            <Globe className="w-3 h-3 text-slate-400" />
                            <span>{log.ip_address}</span>
                          </div>
                          <p className="text-[10px] text-slate-400 truncate max-w-[140px]" title={log.user_agent}>
                            {log.user_agent.includes("Chrome") ? "Google Chrome" : log.user_agent.includes("Firefox") ? "Mozilla Firefox" : "Navegador Web"}
                          </p>
                        </div>
                      </td>

                      {/* Ações Registradas e Desconexão */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => setSelectedLogForDetail(log)}
                            className="px-3 py-1.5 bg-brand-primary/10 hover:bg-brand-primary hover:text-white text-brand-primary text-xs font-bold rounded-xl transition-all inline-flex items-center gap-1.5 cursor-pointer shrink-0"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Ações ({log.acoes?.length || 0})</span>
                          </button>

                          {isAdmin && (isOnline || isAfk || !log.logout_at) && (
                            <button
                              onClick={() => setDisconnectingLog(log)}
                              className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-700 border border-rose-200 text-xs font-bold rounded-xl transition-all inline-flex items-center gap-1.5 cursor-pointer shrink-0 shadow-2xs"
                              title="Desconectar sessão ativa do usuário"
                            >
                              <LogOut className="w-3.5 h-3.5" />
                              <span>Desconectar</span>
                            </button>
                          )}
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
        </>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: LOGS DE AÇÕES */}
      {/* ========================================================================= */}
      {activeTab === "acoes" && (
        <>
          {/* Action Analytics KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total de Ações</span>
                <div className="p-2 bg-brand-primary/10 text-brand-primary rounded-xl">
                  <Zap className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-black text-slate-800">{totalActionsCount}</p>
              <p className="text-[11px] text-slate-400 font-semibold">Ações registradas no período</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Modificações</span>
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
                  <Pencil className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-black text-emerald-700">{dataChangesCount}</p>
              <p className="text-[11px] text-slate-400 font-semibold">Criações, Edições e Exclusões</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Arquivos & Docs</span>
                <div className="p-2 bg-cyan-50 text-cyan-600 rounded-xl border border-cyan-100">
                  <UploadCloud className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-black text-cyan-700">{fileOpsCount}</p>
              <p className="text-[11px] text-slate-400 font-semibold">Uploads e Downloads realizados</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Navegações & Login</span>
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
                  <Compass className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-black text-indigo-700">{navigationOpsCount}</p>
              <p className="text-[11px] text-slate-400 font-semibold">Troca de telas e navegações</p>
            </div>
          </div>

          {/* Action Logs Filter Bar */}
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-4">
            <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
              {/* Search input */}
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar ação por usuário, e-mail, módulo, detalhe, obra ou IP..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                />
              </div>

              {/* Module & Level Filters + Refetch */}
              <div className="w-full sm:w-auto flex flex-wrap items-center gap-2">
                <div className="relative w-full sm:w-48">
                  <select
                    value={actionModuloFilter}
                    onChange={(e) => setActionModuloFilter(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold py-2.5 px-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary/20 cursor-pointer"
                  >
                    <option value="TODOS">Todos os Módulos ({allFlatActions.length})</option>
                    {availableModules.map((mod) => (
                      <option key={mod} value={mod}>
                        {mod}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="relative w-full sm:w-40">
                  <select
                    value={nivelFilter}
                    onChange={(e) => setNivelFilter(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold py-2.5 px-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-primary/20 cursor-pointer"
                  >
                    <option value="TODOS">Todos Níveis</option>
                    <option value="ADMIN">ADMIN</option>
                    <option value="ENGENHEIRO">ENGENHEIRO</option>
                    <option value="ORCAMENTISTA">ORCAMENTISTA</option>
                    <option value="CONSULTOR">CONSULTOR</option>
                    <option value="LEITOR">LEITOR</option>
                  </select>
                </div>

                <button
                  onClick={() => refetch()}
                  disabled={isFetching}
                  className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                  title="Atualizar logs de ações"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
                  <span>Atualizar</span>
                </button>
              </div>
            </div>

            {/* Action Type Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 scrollbar-thin">
              {[
                { label: "Todos", value: "TODOS", count: allFlatActions.length },
                { label: "✏️ Edições", value: "EDICAO", count: allFlatActions.filter(a => a.tipo === "EDICAO").length },
                { label: "➕ Criações", value: "CRIACAO", count: allFlatActions.filter(a => a.tipo === "CRIACAO").length },
                { label: "🗑️ Exclusões", value: "EXCLUSAO", count: allFlatActions.filter(a => a.tipo === "EXCLUSAO").length },
                { label: "☁️ Uploads", value: "UPLOAD", count: allFlatActions.filter(a => a.tipo === "UPLOAD").length },
                { label: "📥 Downloads", value: "DOWNLOAD", count: allFlatActions.filter(a => a.tipo === "DOWNLOAD").length },
                { label: "🧭 Navegação", value: "NAVEGACAO", count: allFlatActions.filter(a => a.tipo === "NAVEGACAO").length },
                { label: "🔒 Auth", value: "AUTH", count: allFlatActions.filter(a => a.tipo === "AUTH").length },
                { label: "⚠️ Erros", value: "ERRO", count: allFlatActions.filter(a => a.tipo === "ERRO").length },
                { label: "🔍 Filtros", value: "FILTRO", count: allFlatActions.filter(a => a.tipo === "FILTRO").length },
              ].map((pill) => (
                <button
                  key={pill.value}
                  onClick={() => setActionTipoFilter(pill.value)}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 shrink-0 ${
                    actionTipoFilter === pill.value
                      ? "bg-brand-primary text-white shadow-xs"
                      : "bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-100"
                  }`}
                >
                  <span>{pill.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                    actionTipoFilter === pill.value ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
                  }`}>
                    {pill.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Shared Date Filter */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-brand-primary" />
                <span className="text-xs font-black uppercase tracking-wider text-slate-700">Filtro por Período:</span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleSetToday}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all border cursor-pointer ${
                    isTodaySelected
                      ? "bg-brand-primary text-white border-brand-primary shadow-xs"
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  Hoje
                </button>

                <div className="relative calendar-popover-container">
                  <button
                    onClick={() => setIsCalendarOpen(!isCalendarOpen)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all border flex items-center gap-2 cursor-pointer ${
                      isCalendarOpen || (startDateFilter && endDateFilter && !isTodaySelected)
                        ? "bg-brand-primary text-white border-brand-primary shadow-xs"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>
                      {startDateFilter && endDateFilter
                        ? `${formatDateBR(startDateFilter)} - ${formatDateBR(endDateFilter)}`
                        : startDateFilter
                        ? `A partir de ${formatDateBR(startDateFilter)}`
                        : "Selecionar Período"}
                    </span>
                  </button>
                </div>

                {(startDateFilter || endDateFilter) && (
                  <button
                    onClick={handleClearDates}
                    className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Limpar</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Action Logs Main Table */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-16 space-y-3">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
                <p className="text-xs font-semibold text-slate-400">Carregando histórico de ações...</p>
              </div>
            ) : filteredFlatActions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
                <div className="p-4 bg-slate-50 rounded-full text-slate-300">
                  <Zap className="w-8 h-8" />
                </div>
                <p className="text-sm font-bold text-slate-600">Nenhum log de ação encontrado</p>
                <p className="text-xs text-slate-400">Tente ajustar os termos de busca, período ou tipo de ação.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-400">
                      <th className="py-3.5 px-4">Horário / Data</th>
                      <th className="py-3.5 px-4">Usuário / Nível</th>
                      <th className="py-3.5 px-4">Módulo</th>
                      <th className="py-3.5 px-4">Tipo de Ação</th>
                      <th className="py-3.5 px-4">Ação & Detalhes</th>
                      <th className="py-3.5 px-4">Endereço IP</th>
                      <th className="py-3.5 px-4 text-center">Detalhes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredFlatActions.map((item) => {
                      const details = getActionTypeDetails(item.tipo);
                      const IconComp = details.icon;

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/80 transition-all">
                          {/* Horário */}
                          <td className="py-3.5 px-4 whitespace-nowrap font-mono text-slate-700 font-bold text-[11px]">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span>{formatTimeWithDate(item.timestamp)}</span>
                            </div>
                          </td>

                          {/* Usuário */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-xl bg-slate-700 flex items-center justify-center font-black text-xs uppercase text-white shrink-0">
                                {item.usuario_nome.charAt(0)}
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-slate-800 truncate">{item.usuario_nome}</p>
                                <span className="inline-block text-[9px] font-black uppercase px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded">
                                  {item.usuario_nivel}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Módulo & Submódulo */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="space-y-0.5">
                              <span className="font-extrabold uppercase text-brand-primary px-2 py-0.5 bg-brand-primary/10 rounded text-[10px]">
                                {item.modulo}
                              </span>
                              {item.submodulo && (
                                <p className="text-[10px] text-slate-400 font-medium truncate max-w-[120px]">
                                  {item.submodulo}
                                </p>
                              )}
                            </div>
                          </td>

                          {/* Tipo de Ação */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[10px] font-black uppercase ${details.colorClass}`}>
                              <IconComp className="w-3 h-3" />
                              {item.tipo || "AÇÃO"}
                            </span>
                          </td>

                          {/* Ação e Detalhes */}
                          <td className="py-3.5 px-4 max-w-xs sm:max-w-md">
                            <p className="font-bold text-slate-800 truncate">{item.acao}</p>
                            {item.detalhe && (
                              <p className="text-[11px] text-slate-500 truncate mt-0.5">{item.detalhe}</p>
                            )}
                            {item.obra && (
                              <span className="inline-block mt-1 text-[9px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                                Obra: {item.obra}
                              </span>
                            )}
                            {item.arquivo && (
                              <span className="inline-block mt-1 text-[9px] font-bold text-cyan-800 bg-cyan-50 px-1.5 py-0.2 rounded border border-cyan-200">
                                Arquivo: {item.arquivo}
                              </span>
                            )}
                          </td>

                          {/* IP */}
                          <td className="py-3.5 px-4 whitespace-nowrap font-mono text-[11px] text-slate-600 font-bold">
                            <div className="flex items-center gap-1">
                              <Globe className="w-3 h-3 text-slate-400" />
                              <span>{item.ip_address}</span>
                            </div>
                          </td>

                          {/* Botão Ver Detalhes */}
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            <button
                              onClick={() => setSelectedSingleActionDetail(item)}
                              className="px-3 py-1.5 bg-brand-primary/10 hover:bg-brand-primary hover:text-white text-brand-primary text-xs font-bold rounded-xl transition-all inline-flex items-center gap-1.5 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Ver</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Action Trail Log Modal */}
      <AnimatePresence>
        {selectedLogForDetail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              {/* Header */}
              <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-brand-primary/20 rounded-xl text-brand-primary">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-tight">
                      Registros de Ações do Usuário
                    </h3>
                    <p className="text-xs text-slate-300 font-medium mt-0.5">
                      {selectedLogForDetail.usuario_nome} ({selectedLogForDetail.usuario_email})
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedLogForDetail(null)}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Meta information summary */}
              <div className="bg-slate-50 p-4 border-b border-slate-100 grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs font-semibold">
                <div>
                  <span className="text-[10px] font-black uppercase text-slate-400 block">Horário Login</span>
                  <span className="text-slate-700">{formatDate(selectedLogForDetail.login_at)}</span>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-slate-400 block">Horário Logout</span>
                  <span className="text-slate-700">{formatDate(selectedLogForDetail.logout_at)}</span>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-slate-400 block">Duração Total</span>
                  <span className="text-slate-800 font-bold">{formatDuration(selectedLogForDetail.duracao_segundos)}</span>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-slate-400 block">Status / Motivo</span>
                  <span className={`text-[11px] font-bold ${selectedLogForDetail.status === "ONLINE" ? "text-emerald-600" : "text-slate-700"}`}>
                    {selectedLogForDetail.status === "ONLINE" 
                      ? "🟢 Em andamento" 
                      : selectedLogForDetail.motivo_encerramento === "TIMEOUT"
                      ? "⏳ Timeout (>30s)"
                      : selectedLogForDetail.motivo_encerramento === "DESCONECTADO_PELO_ADMIN"
                      ? "🔒 Encerrado pelo Admin"
                      : "🚪 Logout pelo usuário"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-slate-400 block">Endereço IP</span>
                  <span className="text-slate-700 font-mono text-[11px]">{selectedLogForDetail.ip_address}</span>
                </div>
              </div>

              {/* Timeline list of recorded user actions */}
              <div className="p-5 overflow-y-auto space-y-4 flex-1">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">
                  Trilha Completa de Atividades ({selectedLogForDetail.acoes?.length || 0})
                </h4>

                {!selectedLogForDetail.acoes || selectedLogForDetail.acoes.length === 0 ? (
                  <p className="text-xs text-slate-400 py-6 text-center">Nenhuma ação detalhada registrada nesta sessão.</p>
                ) : (
                  <div className="relative border-l-2 border-slate-100 pl-4 space-y-4 ml-3">
                    {selectedLogForDetail.acoes.map((item, idx) => {
                      const details = getActionTypeDetails(item.tipo);
                      const IconComp = details.icon;
                      return (
                        <div key={item.id || idx} className="relative group">
                          {/* Chronological Bullet with distinct color */}
                          <div className={`absolute -left-[22px] top-1.5 w-3 h-3 rounded-full ${details.bulletColor} border-2 border-white shadow-xs z-10`}></div>
                          
                          <div className="bg-white hover:bg-slate-50/50 p-4 rounded-xl border border-slate-100 shadow-xs transition-all space-y-2">
                            {/* Header row: time + module + type pill */}
                            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono font-black text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">
                                  {formatTimeWithDate(item.timestamp)}
                                </span>
                                <span className="font-extrabold uppercase text-brand-primary px-1.5 py-0.5 bg-brand-primary/10 rounded">
                                  {item.modulo}
                                </span>
                                {item.submodulo && (
                                  <span className="text-slate-400 font-medium">
                                    &rsaquo; {item.submodulo}
                                  </span>
                                )}
                              </div>
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-black uppercase ${details.colorClass}`}>
                                <IconComp className="w-3 h-3" />
                                {item.tipo || "AÇÃO"}
                              </span>
                            </div>

                            {/* Action title & core detail */}
                            <div>
                              <p className="text-xs font-bold text-slate-800">
                                {item.acao === "Sessão Expirada" ? "Logout" : item.acao}
                              </p>
                              {item.detalhe && (
                                <p className="text-xs text-slate-500 leading-relaxed mt-0.5">
                                  {item.detalhe.includes("inatividade") || item.detalhe.includes("Inatividade") || item.detalhe.includes("3 min")
                                    ? "Usuário encerrou a sessão (Logout)"
                                    : item.detalhe}
                                </p>
                              )}
                            </div>

                            {/* Navigation / Route metadata */}
                            {(item.tela || item.rota) && (
                              <div className="flex items-center gap-3 text-[10px] text-slate-400 font-medium bg-slate-50/50 p-1.5 rounded-lg border border-slate-50">
                                {item.tela && (
                                  <span>
                                    <strong>Tela:</strong> {item.tela}
                                  </span>
                                )}
                                {item.rota && (
                                  <span className="font-mono">
                                    <strong>Rota:</strong> {item.rota}
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Data edit diff */}
                            {(item.antes !== undefined || item.depois !== undefined) && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                                <div>
                                  <span className="text-[9px] font-black uppercase text-slate-400 block mb-0.5">Antes</span>
                                  <div className="p-1.5 bg-rose-50/30 text-rose-900 border border-rose-100 rounded font-medium break-words">
                                    {item.antes || "—"}
                                  </div>
                                </div>
                                <div>
                                  <span className="text-[9px] font-black uppercase text-slate-400 block mb-0.5">Depois</span>
                                  <div className="p-1.5 bg-emerald-50/30 text-emerald-900 border border-emerald-100 rounded font-medium break-words">
                                    {item.depois || "—"}
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* File Upload/Download details */}
                            {item.arquivo && (
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] bg-slate-50 p-2 rounded-lg border border-slate-100">
                                <span className="text-slate-600">
                                  <strong>Arquivo:</strong> <span className="font-mono font-bold text-slate-700">{item.arquivo}</span>
                                </span>
                                {item.tamanho && (
                                  <span className="text-slate-400 font-medium">
                                    <strong>Tamanho:</strong> {item.tamanho}
                                  </span>
                                )}
                                {item.obra && (
                                  <span className="text-slate-500 font-medium">
                                    <strong>Obra:</strong> {item.obra}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => setSelectedLogForDetail(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold uppercase rounded-xl transition-all cursor-pointer"
                >
                  Fechar Visualização
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Force Logout Confirmation Modal (Admin only) */}
      <AnimatePresence>
        {disconnectingLog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-md bg-white rounded-2xl border border-slate-100 shadow-2xl overflow-hidden"
            >
              {/* Header */}
              <div className="p-5 bg-rose-50 border-b border-rose-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-rose-500 text-white rounded-xl shadow-xs">
                    <LogOut className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-rose-950 uppercase tracking-tight">
                      Encerrar Sessão Ativa
                    </h3>
                    <p className="text-[11px] text-rose-700 font-semibold">
                      Ação restrita a Administradores
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setDisconnectingLog(null);
                    setDisconnectError(null);
                    setDisconnectSuccess(null);
                  }}
                  className="p-1.5 text-rose-400 hover:text-rose-700 rounded-lg hover:bg-rose-100 transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-4 text-xs">
                {disconnectError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 font-bold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{disconnectError}</span>
                  </div>
                )}

                {disconnectSuccess && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 font-bold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{disconnectSuccess}</span>
                  </div>
                )}

                <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-medium">Usuário:</span>
                    <span className="font-bold text-slate-800">{disconnectingLog.usuario_nome}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-medium">E-mail:</span>
                    <span className="font-semibold text-slate-700">{disconnectingLog.usuario_email}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-medium">Nível:</span>
                    <span className="font-black text-slate-700 uppercase bg-slate-200 px-2 py-0.5 rounded text-[10px]">
                      {disconnectingLog.usuario_nivel}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-medium">Endereço IP:</span>
                    <span className="font-mono font-bold text-slate-700">{disconnectingLog.ip_address}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-medium">Início da Sessão:</span>
                    <span className="font-semibold text-slate-700">{formatDate(disconnectingLog.login_at)}</span>
                  </div>
                </div>

                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 font-medium leading-relaxed flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-amber-950">Confirmar encerramento da sessão?</p>
                    <p className="text-[11px] text-amber-800 mt-0.5">
                      Ao prosseguir, a conexão deste usuário será imediatamente revogada e ele será desconectado da aplicação.
                    </p>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  onClick={() => {
                    setDisconnectingLog(null);
                    setDisconnectError(null);
                    setDisconnectSuccess(null);
                  }}
                  disabled={isDisconnecting}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl transition-all cursor-pointer text-xs"
                >
                  Cancelar
                </button>

                <button
                  onClick={handleForceDisconnect}
                  disabled={isDisconnecting}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl transition-all cursor-pointer text-xs inline-flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                >
                  {isDisconnecting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Desconectando...</span>
                    </>
                  ) : (
                    <>
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Desconectar Sessão</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Single Action Detail Modal */}
      <AnimatePresence>
        {selectedSingleActionDetail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              {/* Header */}
              <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-brand-primary/20 rounded-xl text-brand-primary">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-tight">
                      Detalhes da Ação Registrada
                    </h3>
                    <p className="text-xs text-slate-300 font-medium mt-0.5">
                      {selectedSingleActionDetail.usuario_nome} ({selectedSingleActionDetail.usuario_email})
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedSingleActionDetail(null)}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-5 overflow-y-auto space-y-4 text-xs flex-1">
                {/* User & Session info card */}
                <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[10px] font-black uppercase text-slate-400 block">Usuário</span>
                    <span className="font-bold text-slate-800">{selectedSingleActionDetail.usuario_nome}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase text-slate-400 block">Nível</span>
                    <span className="font-extrabold text-slate-700 uppercase">{selectedSingleActionDetail.usuario_nivel}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase text-slate-400 block">Horário da Ação</span>
                    <span className="font-mono font-bold text-slate-700">{formatTimeWithDate(selectedSingleActionDetail.timestamp)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase text-slate-400 block">Endereço IP</span>
                    <span className="font-mono text-slate-700 font-bold">{selectedSingleActionDetail.ip_address}</span>
                  </div>
                </div>

                {/* Module & Type */}
                <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-50 border border-slate-100 rounded-xl">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase text-slate-400">Módulo:</span>
                    <span className="font-black uppercase text-brand-primary px-2 py-0.5 bg-brand-primary/10 rounded">
                      {selectedSingleActionDetail.modulo}
                    </span>
                    {selectedSingleActionDetail.submodulo && (
                      <span className="text-slate-500 font-bold">&rsaquo; {selectedSingleActionDetail.submodulo}</span>
                    )}
                  </div>

                  {(() => {
                    const dt = getActionTypeDetails(selectedSingleActionDetail.tipo);
                    const IconComp = dt.icon;
                    return (
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[10px] font-black uppercase ${dt.colorClass}`}>
                        <IconComp className="w-3.5 h-3.5" />
                        {selectedSingleActionDetail.tipo || "AÇÃO"}
                      </span>
                    );
                  })()}
                </div>

                {/* Main Action Text */}
                <div className="space-y-1 bg-white p-4 border border-slate-100 rounded-xl shadow-2xs">
                  <span className="text-[10px] font-black uppercase text-slate-400 block">Ação Executada</span>
                  <p className="font-bold text-slate-900 text-sm">{selectedSingleActionDetail.acao}</p>
                  {selectedSingleActionDetail.detalhe && (
                    <p className="text-slate-600 leading-relaxed mt-1 text-xs">{selectedSingleActionDetail.detalhe}</p>
                  )}
                </div>

                {/* Tela & Rota metadata */}
                {(selectedSingleActionDetail.tela || selectedSingleActionDetail.rota) && (
                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between gap-2 text-[11px]">
                    {selectedSingleActionDetail.tela && (
                      <div>
                        <span className="text-[10px] font-black uppercase text-slate-400 block">Tela</span>
                        <span className="font-semibold text-slate-700">{selectedSingleActionDetail.tela}</span>
                      </div>
                    )}
                    {selectedSingleActionDetail.rota && (
                      <div>
                        <span className="text-[10px] font-black uppercase text-slate-400 block">Rota</span>
                        <span className="font-mono font-bold text-slate-700">{selectedSingleActionDetail.rota}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* File / Obra details */}
                {(selectedSingleActionDetail.arquivo || selectedSingleActionDetail.obra) && (
                  <div className="p-3 bg-cyan-50/40 border border-cyan-100 rounded-xl space-y-1">
                    {selectedSingleActionDetail.arquivo && (
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-cyan-800 font-bold">Arquivo: {selectedSingleActionDetail.arquivo}</span>
                        {selectedSingleActionDetail.tamanho && (
                          <span className="text-cyan-600">{selectedSingleActionDetail.tamanho}</span>
                        )}
                      </div>
                    )}
                    {selectedSingleActionDetail.obra && (
                      <p className="text-[11px] text-amber-900 font-bold">Obra associada: {selectedSingleActionDetail.obra}</p>
                    )}
                  </div>
                )}

                {/* Before / After Diff */}
                {(selectedSingleActionDetail.antes !== undefined || selectedSingleActionDetail.depois !== undefined) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div>
                      <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">Estado Anterior (Antes)</span>
                      <div className="p-2.5 bg-rose-50 text-rose-900 border border-rose-200 rounded-lg font-medium break-words font-mono text-[11px]">
                        {selectedSingleActionDetail.antes || "—"}
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">Novo Estado (Depois)</span>
                      <div className="p-2.5 bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-lg font-medium break-words font-mono text-[11px]">
                        {selectedSingleActionDetail.depois || "—"}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => setSelectedSingleActionDetail(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold uppercase rounded-xl transition-all cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
