import { NextRequest, NextResponse } from "next/server";
import { getUser, createServiceClient } from "@/lib/insforge/server";
import { decrypt } from "@/lib/encryption";
import * as XLSX from "xlsx";

function parseDropiDate(raw: string): string {
  // Format: DD-MM-YYYY → YYYY-MM-DD
  if (!raw || typeof raw !== "string") return "";
  const parts = raw.split("-");
  if (parts.length === 3 && parts[2].length === 4) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  // Already YYYY-MM-DD
  return raw;
}

function mapStatus(estado: string, envio: number) {
  const s = (estado || "").toLowerCase();
  const es_entregado = s.includes("entregado") || s.includes("cobrado");
  const es_rechazado = s.includes("rechazado");
  const es_cancelado = s.includes("cancelado");
  const es_enviado = envio === 1 || es_entregado || es_rechazado;
  return { es_enviado, es_entregado, es_rechazado, es_cancelado };
}

async function dropiLogin(email: string, pwd: string): Promise<string> {
  const cookieJar = new Map<string, string>();

  const parseCookies = (setCookieArr: string[] | undefined) => {
    (setCookieArr || []).forEach((c) => {
      const [kv] = c.split(";");
      const eq = kv.indexOf("=");
      if (eq > 0) cookieJar.set(kv.slice(0, eq).trim(), kv.slice(eq + 1).trim());
    });
  };

  const cookieStr = () =>
    [...cookieJar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");

  // GET login page for CSRF
  const loginPage = await fetch("https://dropipro.com/", {
    headers: { "User-Agent": "Mozilla/5.0 Chrome/120" },
    redirect: "manual",
  });
  parseCookies([...(loginPage.headers as Headers).getSetCookie?.() ?? []]);
  const loginHtml = await loginPage.text();
  const csrfMatch = loginHtml.match(/name=["']_token["'][^>]*value=["']([^"']+)/i);
  if (!csrfMatch) throw new Error("CSRF token not found on Dropi login page");
  const csrfToken = csrfMatch[1];

  // POST login
  const loginBody = new URLSearchParams({
    _token: csrfToken,
    user: email,
    pwd,
  });
  const loginRes = await fetch("https://dropipro.com/login/submit", {
    method: "POST",
    headers: {
      "User-Agent": "Mozilla/5.0 Chrome/120",
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookieStr(),
      Referer: "https://dropipro.com/",
      Origin: "https://dropipro.com",
    },
    body: loginBody.toString(),
    redirect: "manual",
  });
  parseCookies([...(loginRes.headers as Headers).getSetCookie?.() ?? []]);

  if (!cookieJar.has("remember_web_59ba36addc2b2f9401580f014c7f58ea4e30989d") &&
      !cookieJar.has("dropi_pro_session")) {
    throw new Error("Login failed — check Dropi credentials");
  }

  return cookieStr();
}

async function downloadDropiExcel(cookieStr: string): Promise<Buffer> {
  // GET the form page to get fresh download CSRF token
  const formRes = await fetch("https://dropipro.com/app/orders/list/resume_excel", {
    headers: { "User-Agent": "Mozilla/5.0 Chrome/120", Cookie: cookieStr },
  });

  const formHtml = await formRes.text();
  const dlCsrfMatch = formHtml.match(/id="downloadForm"[\s\S]*?<input[^>]*name="_token"[^>]*value="([^"]+)/);
  if (!dlCsrfMatch) throw new Error("Download form CSRF not found");
  const dlCsrf = dlCsrfMatch[1];

  // POST to download endpoint
  const dlBody = new URLSearchParams({
    _token: dlCsrf,
    start_date: "",
    end_date: "",
    date_filter: "0",
    store: "",
    product: "",
    type: "",
  });

  const dlRes = await fetch("https://dropipro.com/app/orders/list/resume_excel/download", {
    method: "POST",
    headers: {
      "User-Agent": "Mozilla/5.0 Chrome/120",
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookieStr,
      Referer: "https://dropipro.com/app/orders/list/resume_excel",
      Origin: "https://dropipro.com",
    },
    body: dlBody.toString(),
  });

  const contentType = dlRes.headers.get("content-type") || "";
  if (!contentType.includes("spreadsheetml") && !contentType.includes("octet-stream")) {
    throw new Error(`Expected xlsx, got: ${contentType}`);
  }

  return Buffer.from(await dlRes.arrayBuffer());
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseDropiExcel(buffer: Buffer): any[] {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as unknown[][];

  // Skip header row
  return rows.slice(1).filter((row) => row[14] || row[3]); // need order_id
}

async function syncForUser(
  insforge: ReturnType<typeof createServiceClient>,
  userId: string,
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
    const neto = Math.round((venta - costo) * 100) / 100;
    const rawFecha = String(row[18] || "").trim();
    const fecha = parseDropiDate(rawFecha);
    const shopifyId = row[21] ? Number(row[21]) : null;
    const { es_enviado, es_entregado, es_rechazado, es_cancelado } = mapStatus(estado, envio);

    return {
      user_id: userId,
      order_id: orderId,
      shopify_order_id: shopifyId,
      fecha,
      nombre,
      productos,
      venta,
      neto,
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
      .upsert(chunk, { onConflict: "user_id,order_id" });
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
    // Sync all users with Dropi credentials
    const { data: configs } = await insforge.database
      .from("users_config")
      .select("id, dropi_email_encrypted, dropi_pwd_encrypted")
      .not("dropi_email_encrypted", "is", null)
      .not("dropi_pwd_encrypted", "is", null);

    let totalSynced = 0;
    for (const config of configs || []) {
      try {
        const result = await syncForUser(
          insforge,
          config.id,
          config.dropi_email_encrypted,
          config.dropi_pwd_encrypted
        );
        totalSynced += result.total;
      } catch {
        // Continue with other users
      }
    }
    return NextResponse.json({ ok: true, total: totalSynced });
  }

  // Manual sync — requires user auth
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: config } = await insforge.database
    .from("users_config")
    .select("dropi_email_encrypted, dropi_pwd_encrypted")
    .eq("id", user.id)
    .maybeSingle();

  if (!config?.dropi_email_encrypted || !config?.dropi_pwd_encrypted) {
    return NextResponse.json({ error: "Dropi credentials not configured" }, { status: 400 });
  }

  try {
    const result = await syncForUser(
      insforge,
      user.id,
      config.dropi_email_encrypted,
      config.dropi_pwd_encrypted
    );
    return NextResponse.json({ total: result.total });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
