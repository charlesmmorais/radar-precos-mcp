// ─────────────────────────────────────────────────────────────────────────────
// Cliente HTTP base com retry e timeout
// ─────────────────────────────────────────────────────────────────────────────

import axios from "axios";
import axiosRetry from "axios-retry";

/** Timeout padrão para APIs do governo (instáveis) */
const DEFAULT_TIMEOUT_MS = 90_000;

/** Cria um cliente axios configurado com retry exponencial */
export function criarClienteHttp(baseURL: string, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const cliente = axios.create({
    baseURL,
    timeout: timeoutMs,
    headers: {
      "Accept": "application/json",
      "User-Agent": "radar-precos-mcp/1.0.0",
    },
  });

  axiosRetry(cliente, {
    retries: 3,
    retryDelay: axiosRetry.exponentialDelay,
    retryCondition: (error) => {
      // Retry em timeout, erros de rede e 5xx
      return (
        axiosRetry.isNetworkOrIdempotentRequestError(error) ||
        (error.response?.status !== undefined && error.response.status >= 500)
      );
    },
    onRetry: (retryCount, error) => {
      process.stderr.write(
        `[http] Tentativa ${retryCount} após erro: ${error.message}\n`
      );
    },
  });

  return cliente;
}

/** Pausa assíncrona */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
