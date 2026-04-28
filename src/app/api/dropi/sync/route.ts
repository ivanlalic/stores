import { NextRequest, NextResponse } from "next/server";
import { getUser, createServiceClient } from "@/lib/insforge/server";
import { decrypt } from "@/lib/encryption";
import * as XLSX from "xlsx";
import * as https from "https";
import * as http from "http";

function parseDropiDate(raw: string): string {
  if (!raw || typeof raw !== "string") return "";
  const parts = raw.split("-");
  if (parts.length === 3 && parts[2].length === 4) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return raw;
}

const COSTO_DEVOLUCION = 6.20; // envío cobrado por Dropi en rehusado/devuelto

function mapStatus(estado: string, envio: number) {
  const s = (estado || "").toLowerCase().trim();
  const es_devuelto = s.includes("rehusado") || s.includes("devuelto");
  const es_entregado = s.includes("entregado") || s.includes("cobrado");
  const es_rechazado = es_devuelto;
  // "Rechazado" with ENVIO=0 = cancelled before dispatch
  const es_cancelado = !es_devuelto && (s.includes("rechazado") || s.includes("cancelado"));
  const es_enviado = envio === 1 || es_entregado || es_devuelto;
  // Whitelist: confirmed sale states. Everything else = no-venta.
  // "Confirmado - Pendiente de preparación" starts with "confirmado" → IS a sale.
  // "Pendiente de confirmación", "Pedido nuevo", "No confirmable", "Duplicado" → NOT a sale.
  const es_venta = es_devuelto || es_entregado || es_enviado ||
    s.startsWith("confirmado") ||
    s.startsWith("preparado") ||
    s === "enviado" ||
    s.startsWith("en ruta");
  const es_no_venta = !es_cancelado && !es_venta;
  return { es_enviado, es_entregado, es_rechazado, es_cancelado, es_no_venta };
}

interface HttpResult {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: Buffer;
}

function httpRequest(
  options: https.RequestOptions,
  postData?: string
): Promise<HttpResult> {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () =>
        resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks) })
      );
    });
    req.on("error", reject);
    if (postData) req.write(postData);
    req.end();
  });
}

function parseCookieHeaders(
  jar: Map<string, string>,
  setCookieArr: string | string[] | undefined
) {
  const arr = Array.isArray(setCookieArr)
    ? setCookieArr
    : setCookieArr
    ? [setCookieArr]
    : [];
  arr.forEach((c) => {
    const [kv] = c.split(";");
    const eq = kv.indexOf("=");
    if (eq > 0) jar.set(kv.slice(0, eq).trim(), kv.slice(eq + 1).trim());
  });
}

async function dropiLogin(email: string, pwd: string): Promise<string> {
  const jar = new Map<string, string>();
  const cookieStr = () =>
    [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");

  const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120";

  // Step 1: GET login page → CSRF + session cookies
  const s1 = await httpRequest({
    hostname: "dropipro.com", path: "/", method: "GET",
    headers: { "User-Agent": UA },
  });
  parseCookieHeaders(jar, s1.headers["set-cookie"]);

  const loginHtml = s1.body.toString();
  const csrfMatch = loginHtml.match(/name=["']_token["'][^>]*value=["']([^"']+)/i);
  if (!csrfMatch) throw new Error("CSRF token not found on Dropi login page");
  const csrfToken = csrfMatch[1];

  // Step 2: POST login
  const postBody = new URLSearchParams({ _token: csrfToken, user: email, pwd, remember: "1" }).toString();
  const s2 = await httpRequest(
    {
      hostname: "dropipro.com", path: "/login/submit", method: "POST",
      headers: {
        "User-Agent": UA,
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": String(Buffer.byteLength(postBody)),
        Cookie: cookieStr(),
        Referer: "https://dropipro.com/",
        Origin: "https://dropipro.com",
      },
    },
    postBody
  );
  parseCookieHeaders(jar, s2.headers["set-cookie"]);

  if (s2.status !== 302 || s2.headers.location?.includes("login")) {
    throw new Error("Login failed — check Dropi credentials");
  }

  return cookieStr();
}

async function downloadDropiExcel(cookies: string): Promise<Buffer> {
  const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120";
  const jar = new Map<string, string>();
  cookies.split("; ").forEach((kv) => {
    const eq = kv.indexOf("=");
    if (eq > 0) jar.set(kv.slice(0, eq), kv.slice(eq + 1));
  });
  const cookieStr = () => [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");

  // GET the orders/resume_excel page → download form CSRF
  const formRes = await httpRequest({
    hostname: "dropipro.com",
    path: "/app/orders/list/resume_excel",
    method: "GET",
    headers: { "User-Agent": UA, Cookie: cookieStr() },
  });
  parseCookieHeaders(jar, formRes.headers["set-cookie"]);

  const formHtml = formRes.body.toString();
  const dlCsrfMatch = formHtml.match(
    /id="downloadForm"[\s\S]*?<input[^>]*name="_token"[^>]*value="([^"]+)/
  );
  if (!dlCsrfMatch) {
    const snippet = formHtml.slice(0, 400).replace(/\s+/g, " ");
    throw new Error(`Download form CSRF not found. Status=${formRes.status} HTML=${snippet}`);
  }
  const dlCsrf = dlCsrfMatch[1];

  // POST to download endpoint
  const dlBody = new URLSearchParams({
    _token: dlCsrf, start_date: "", end_date: "",
    date_filter: "0", store: "", product: "", type: "",
  }).toString();

  const dlRes = await httpRequest(
    {
      hostname: "dropipro.com",
      path: "/app/orders/list/resume_excel/download",
      method: "POST",
      headers: {
        "User-Agent": UA,
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": String(Buffer.byteLength(dlBody)),
        Cookie: cookieStr(),
        Referer: "https://dropipro.com/app/orders/list/resume_excel",
        Origin: "https://dropipro.com",
      },
    },
    dlBody
  );

  const ct = dlRes.headers["content-type"] || "";
  if (!ct.includes("spreadsheetml") && !ct.includes("octet-stream")) {
    throw new Error(`Expected xlsx, got: ${ct}`);
  }

  return dlRes.body;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseDropiExcel(buffer: Buffer): any[] {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as unknown[][];

  // Skip header row
  return rows.slice(1).filter((row) => row[14] || row[3]); // need order_id
}

async function syncForStore(
  insforge: ReturnType<typeof createServiceClient>,
  userId: string,
  storeId: string,
  emailEncrypted: string,
  pwdEncrypted: string
): Promise<{ total: number }> {
  const email = decrypt(emailEncrypted);
  const pwd = decrypt(pwdEncrypted);

  const cookies = await dropiLogin(email, pwd);
  const buffer = await downloadDropiExcel(cookies);
  const rawRows = parseDropiExcel(buffer);

  const orders = rawRows.map((row) => {
    const orderId = String(row[14] || row[3] || "").trim();
    const tracking = String(row[0] || "").trim();
    const estado = String(row[1] || "").trim();
    const envio = Number(row[2]) || 0;
    const productos = String(row[4] || "").trim();
    const venta = parseFloat(String(row[6])) || 0;
    const nombre = String(row[8] || "").trim();
    const costo = parseFloat(String(row[17])) || 0;
    const rawFecha = String(row[18] || "").trim();
    const fecha = parseDropiDate(rawFecha);
    const shopifyId = row[21] ? Number(row[21]) : null;
    const { es_enviado, es_entregado, es_rechazado, es_cancelado, es_no_venta } = mapStatus(estado, envio);

    // Rehusado/devuelto: sale happened but returned → venta = price, neto = -shipping cost
    // Nuevo/Pendiente: unconfirmed → venta = 0, neto = 0
    const netoFinal = es_cancelado ? 0 : es_rechazado ? -COSTO_DEVOLUCION : Math.round((venta - costo) * 100) / 100;

    return {
      user_id: userId,
      store_id: storeId,
      order_id: orderId,
      shopify_order_id: shopifyId,
      fecha,
      nombre,
      productos,
      venta: (es_cancelado || es_no_venta) ? 0 : venta,
      neto: netoFinal,
      status: estado,
      es_enviado,
      es_entregado,
      es_rechazado,
      es_cancelado,
      tracking_code: tracking || null,
      updated_at: new Date().toISOString(),
    };
  }).filter((o) => o.order_id && o.fecha);

  const CHUNK = 200;
  for (let i = 0; i < orders.length; i += CHUNK) {
    const chunk = orders.slice(i, i + CHUNK);
    const { error } = await insforge.database
      .from("dropi_pedidos")
      .upsert(chunk, { onConflict: "store_id,order_id" });
    if (error) throw new Error(error.message);
  }

  return { total: orders.length };
}

export async function POST(request: NextRequest) {
  const insforge = createServiceClient();

  // Vercel cron job sends Authorization: Bearer <CRON_SECRET>
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const isCron = cronSecret && authHeader === `Bearer ${cronSecret}`;

  if (isCron) {
    // Sync all dropi stores across all users
    const { data: stores } = await insforge.database
      .from("stores")
      .select("id, user_id, dropi_email_encrypted, dropi_pwd_encrypted")
      .eq("type", "dropi")
      .not("dropi_email_encrypted", "is", null)
      .not("dropi_pwd_encrypted", "is", null);

    let totalSynced = 0;
    for (const store of stores || []) {
      try {
        const result = await syncForStore(
          insforge,
          store.user_id,
          store.id,
          store.dropi_email_encrypted,
          store.dropi_pwd_encrypted
        );
        totalSynced += result.total;
      } catch {
        // Continue with other stores
      }
    }
    return NextResponse.json({ ok: true, total: totalSynced });
  }

  // Manual sync — requires user auth
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const storeParam = request.nextUrl.searchParams.get("store_id");

  let store;
  if (storeParam) {
    const { data } = await insforge.database
      .from("stores")
      .select("id, user_id, dropi_email_encrypted, dropi_pwd_encrypted")
      .eq("id", storeParam)
      .eq("user_id", user.id)
      .maybeSingle();
    store = data;
  } else {
    const { data } = await insforge.database
      .from("stores")
      .select("id, user_id, dropi_email_encrypted, dropi_pwd_encrypted")
      .eq("user_id", user.id)
      .eq("type", "dropi")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    store = data;
  }

  if (!store?.dropi_email_encrypted || !store?.dropi_pwd_encrypted) {
    return NextResponse.json({ error: "Dropi credentials not configured" }, { status: 400 });
  }

  try {
    const result = await syncForStore(
      insforge,
      store.user_id,
      store.id,
      store.dropi_email_encrypted,
      store.dropi_pwd_encrypted
    );
    return NextResponse.json({ total: result.total });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
