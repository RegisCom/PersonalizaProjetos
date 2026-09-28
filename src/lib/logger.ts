import { useAuthStore } from "../store";

let lastUserActivityIso = new Date().toISOString();

export function registerUserActivity() {
  lastUserActivityIso = new Date().toISOString();
}

export function getLastUserActivityIso() {
  return lastUserActivityIso;
}

export type ActionType = 
  | 'NAVEGACAO' 
  | 'FILTRO' 
  | 'CRIACAO' 
  | 'EDICAO' 
  | 'EXCLUSAO' 
  | 'UPLOAD' 
  | 'DOWNLOAD' 
  | 'AUTH' 
  | 'ERRO';

export interface LogActionMeta {
  submodulo?: string;
  tela?: string;
  rota?: string;
  tipo?: ActionType;
  antes?: string;
  depois?: string;
  arquivo?: string;
  tamanho?: string;
  obra?: string;
}

export async function logUserAction(
  modulo: string,
  acao: string,
  detalhe: string,
  meta?: LogActionMeta
) {
  try {
    const token = useAuthStore.getState().token;
    if (!token) return;

    // Register user activity on any logged action
    registerUserActivity();

    await fetch("/api/logs-acesso/acao", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ 
        modulo, 
        acao, 
        detalhe,
        submodulo: meta?.submodulo,
        tela: meta?.tela,
        rota: meta?.rota || (typeof window !== "undefined" ? window.location.pathname : undefined),
        tipo: meta?.tipo || "NAVEGACAO",
        antes: meta?.antes,
        depois: meta?.depois,
        arquivo: meta?.arquivo,
        tamanho: meta?.tamanho,
        obra: meta?.obra
      })
    });
  } catch {
    // silent catch
  }
}

export function logNavigation(modulo: string, tela: string, detalhe: string, submodulo?: string, rota?: string) {
  logUserAction(modulo, `Acessou a tela ${tela}`, detalhe, {
    submodulo,
    tela,
    rota: rota || (typeof window !== "undefined" ? window.location.pathname : "/"),
    tipo: "NAVEGACAO"
  });
}

export function logFilter(modulo: string, filtroNome: string, detalhe: string, submodulo?: string) {
  logUserAction(modulo, `Aplicou Filtro: ${filtroNome}`, detalhe, {
    submodulo,
    tipo: "FILTRO"
  });
}

export function logCreation(modulo: string, itemNome: string, detalhe: string, meta?: Partial<LogActionMeta>) {
  logUserAction(modulo, `Criou ${itemNome}`, detalhe, {
    ...meta,
    tipo: "CRIACAO"
  });
}

export function logEdit(modulo: string, itemNome: string, antes: string, depois: string, detalhe: string, meta?: Partial<LogActionMeta>) {
  logUserAction(modulo, `Alterou ${itemNome}`, detalhe, {
    ...meta,
    antes,
    depois,
    tipo: "EDICAO"
  });
}

export function logDeletion(modulo: string, itemNome: string, detalhe: string, meta?: Partial<LogActionMeta>) {
  logUserAction(modulo, `Excluiu ${itemNome}`, detalhe, {
    ...meta,
    tipo: "EXCLUSAO"
  });
}

export function logUpload(modulo: string, nomeArquivo: string, tamanho: string, obra?: string) {
  logUserAction(modulo, `Upload de Arquivo`, `Enviou o arquivo ${nomeArquivo} (${tamanho})`, {
    tipo: "UPLOAD",
    arquivo: nomeArquivo,
    tamanho,
    obra
  });
}

export function logDownload(modulo: string, nomeArquivo: string, tipoFormato?: string) {
  logUserAction(modulo, `Exportou / Download`, `Exportou ${nomeArquivo}${tipoFormato ? ` (${tipoFormato})` : ''}`, {
    tipo: "DOWNLOAD",
    arquivo: nomeArquivo
  });
}

export function logAuth(acao: string, detalhe: string) {
  logUserAction("Autenticação", acao, detalhe, {
    tipo: "AUTH"
  });
}

export function logError(modulo: string, operacao: string, mensagemErro: string) {
  logUserAction(modulo, `Erro: ${operacao}`, mensagemErro, {
    tipo: "ERRO"
  });
}

export async function sendHeartbeat(forceActivityIso?: string) {
  try {
    const token = useAuthStore.getState().token;
    if (!token) return;

    if (forceActivityIso) {
      lastUserActivityIso = forceActivityIso;
    }

    const res = await fetch("/api/logs-acesso/heartbeat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        last_activity: lastUserActivityIso
      })
    });

    if (res.status === 401) {
      useAuthStore.getState().logout("DESCONECTADO_PELO_ADMIN");
    }
  } catch {
    // silent catch
  }
}


