import crypto from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import tls from "node:tls";
import { URL } from "node:url";

export type ExitProxyMode = "direct" | "repository" | "custom";

export interface ProxyRecord {
  id: string;
  name: string;
  country: string;
  code: string;
  endpoint: string;
}

export interface PublicProxyRecord {
  id: string;
  name: string;
  country: string;
  code: string;
  scheme: string;
}

const records = new Map<string, ProxyRecord>();
let lastRefresh = 0;
let lastError = "";

export function validateProxyUrl(value: unknown): string {
  const raw = String(value || "").trim();
  const url = new URL(raw);
  if (!["http:", "https:", "socks5:"].includes(url.protocol))
    throw new Error("proxy must use http, https, or socks5");
  if (!url.hostname || !url.port) throw new Error("proxy hostname and port are required");
  if ((url.pathname && url.pathname !== "/") || url.search || url.hash)
    throw new Error("proxy URL cannot contain a path, query, or fragment");
  return url.toString().replace(/\/$/, "");
}

function safeId(endpoint: string, supplied?: unknown): string {
  const requested = String(supplied || "").trim();
  return requested || crypto.createHash("sha256").update(endpoint).digest("hex").slice(0, 20);
}

function parseCatalog(payload: unknown): ProxyRecord[] {
  const values = Array.isArray(payload)
    ? payload
    : typeof payload === "object" && payload && Array.isArray((payload as { proxies?: unknown }).proxies)
      ? (payload as { proxies: unknown[] }).proxies
      : [];
  const parsed: ProxyRecord[] = [];
  for (const value of values) {
    if (typeof value === "string") {
      const endpoint = validateProxyUrl(value);
      parsed.push({ id: safeId(endpoint), name: "Managed proxy", country: "", code: "", endpoint });
      continue;
    }
    if (!value || typeof value !== "object") continue;
    const row = value as Record<string, unknown>;
    const endpoint = validateProxyUrl(row.endpoint || row.url);
    parsed.push({
      id: safeId(endpoint, row.id),
      name: String(row.name || row.label || row.country || "Managed proxy").slice(0, 80),
      country: String(row.country || "").slice(0, 80),
      code: String(row.code || "").toUpperCase().slice(0, 2),
      endpoint,
    });
  }
  return parsed;
}

function publish(next: ProxyRecord[]): void {
  records.clear();
  for (const record of next) records.set(record.id, record);
  lastRefresh = Date.now();
  lastError = "";
}

export async function refreshProxyRepository(): Promise<void> {
  try {
    const inline = process.env.LUMEN_PROXY_CATALOG_JSON?.trim();
    const file = process.env.LUMEN_PROXY_CATALOG_FILE?.trim();
    const remote = process.env.LUMEN_PROXY_CATALOG_URL?.trim();
    if (inline) {
      publish(parseCatalog(JSON.parse(inline)));
      return;
    }
    if (file) {
      publish(parseCatalog(JSON.parse(fs.readFileSync(file, "utf8"))));
      return;
    }
    if (remote) {
      const url = new URL(remote);
      if (url.protocol !== "https:") throw new Error("proxy catalog URL must use HTTPS");
      const headers: Record<string, string> = { Accept: "application/json" };
      const token = process.env.LUMEN_PROXY_CATALOG_TOKEN?.trim();
      if (token) headers.Authorization = `Bearer ${token}`;
      const response = await fetch(url, { headers, signal: AbortSignal.timeout(15_000) });
      if (!response.ok) throw new Error(`proxy catalog HTTP ${response.status}`);
      publish(parseCatalog(await response.json()));
      return;
    }
    publish([]);
  } catch (error) {
    lastError = error instanceof Error ? error.message : "catalog refresh failed";
    if (records.size === 0) throw error;
  }
}

export function proxyCatalogStatus() {
  return {
    records: [...records.values()].map<PublicProxyRecord>((record) => ({
      id: record.id,
      name: record.name,
      country: record.country,
      code: record.code,
      scheme: new URL(record.endpoint).protocol.replace(":", ""),
    })),
    lastRefresh,
    lastError,
  };
}

export function getProxyRecord(id: string): ProxyRecord | null {
  return records.get(id) || null;
}

export function normalizeExitProxy(
  modeValue: unknown,
  proxyIdValue: unknown,
  customValue: unknown,
): { mode: ExitProxyMode; proxyId: string; customProxy: string } {
  const mode = String(modeValue || "direct").toLowerCase() as ExitProxyMode;
  if (!["direct", "repository", "custom"].includes(mode))
    throw new Error("invalid exit proxy mode");
  if (mode === "repository") {
    const proxyId = String(proxyIdValue || "").trim();
    if (!records.has(proxyId)) throw new Error("selected managed proxy is unavailable");
    return { mode, proxyId, customProxy: "" };
  }
  if (mode === "custom") {
    return { mode, proxyId: "", customProxy: validateProxyUrl(customValue) };
  }
  return { mode: "direct", proxyId: "", customProxy: "" };
}

export function resolveExitProxy(user: {
  exit_proxy_mode: ExitProxyMode;
  proxy_id: string;
  custom_proxy: string;
}): string | null {
  if (user.exit_proxy_mode === "custom") return validateProxyUrl(user.custom_proxy);
  if (user.exit_proxy_mode === "repository") return records.get(user.proxy_id)?.endpoint || null;
  return "";
}

function connectSocket(url: URL): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const options = { host: url.hostname, port: Number(url.port) };
    const socket =
      url.protocol === "https:"
        ? tls.connect({ ...options, servername: net.isIP(url.hostname) ? undefined : url.hostname, rejectUnauthorized: false })
        : net.connect(options);
    const timer = setTimeout(() => socket.destroy(new Error("proxy connect timeout")), 6000);
    socket.once("connect", () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.once("error", reject);
  });
}

async function readAtLeast(socket: net.Socket, count: number): Promise<Buffer> {
  return await new Promise((resolve, reject) => {
    let value = Buffer.alloc(0);
    const timer = setTimeout(() => done(new Error("proxy handshake timeout")), 6000);
    const done = (error?: Error) => {
      clearTimeout(timer);
      socket.off("data", onData);
      socket.off("error", onError);
      if (error) reject(error);
      else resolve(value);
    };
    const onError = (error: Error) => done(error);
    const onData = (chunk: Buffer) => {
      value = Buffer.concat([value, chunk]);
      if (value.length >= count || value.includes(Buffer.from("\r\n\r\n"))) done();
    };
    socket.on("data", onData);
    socket.once("error", onError);
  });
}

export async function testProxyById(id: string): Promise<{ ok: true; latencyMs: number }> {
  const record = records.get(id);
  if (!record) throw new Error("proxy not found");
  const url = new URL(record.endpoint);
  const started = performance.now();
  const socket = await connectSocket(url);
  try {
    if (url.protocol === "socks5:") {
      const hasAuth = !!(url.username || url.password);
      socket.write(hasAuth ? Buffer.from([5, 2, 0, 2]) : Buffer.from([5, 1, 0]));
      const greeting = await readAtLeast(socket, 2);
      if (greeting[0] !== 5 || greeting[1] === 0xff) throw new Error("SOCKS5 rejected authentication");
      if (greeting[1] === 2) {
        const user = Buffer.from(decodeURIComponent(url.username));
        const pass = Buffer.from(decodeURIComponent(url.password));
        socket.write(Buffer.concat([Buffer.from([1, user.length]), user, Buffer.from([pass.length]), pass]));
        const auth = await readAtLeast(socket, 2);
        if (auth[1] !== 0) throw new Error("SOCKS5 authentication failed");
      }
      const host = Buffer.from("example.com");
      socket.write(Buffer.concat([Buffer.from([5, 1, 0, 3, host.length]), host, Buffer.from([0, 80])]));
      const reply = await readAtLeast(socket, 5);
      if (reply[1] !== 0) throw new Error(`SOCKS5 connect failed (${reply[1]})`);
    } else {
      const credentials =
        url.username || url.password
          ? `Proxy-Authorization: Basic ${Buffer.from(`${decodeURIComponent(url.username)}:${decodeURIComponent(url.password)}`).toString("base64")}\r\n`
          : "";
      socket.write(`CONNECT example.com:443 HTTP/1.1\r\nHost: example.com:443\r\n${credentials}Connection: close\r\n\r\n`);
      const reply = (await readAtLeast(socket, 12)).toString("latin1");
      if (!/^HTTP\/1\.[01] 2\d\d/.test(reply)) throw new Error("HTTP proxy CONNECT failed");
    }
    return { ok: true, latencyMs: Math.round(performance.now() - started) };
  } finally {
    socket.destroy();
  }
}
