import { NextRequest, NextResponse } from "next/server";
import { getUser, createServiceClient } from "@/lib/insforge/server";
import { decrypt } from "@/lib/encryption";

export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const storeId = searchParams.get("store_id");

  const insforge = createServiceClient();

  let query = insforge.database
    .from("stores")
    .select("id, dropea_email_encrypted, dropea_pwd_encrypted, costo_rechazo")
    .eq("user_id", user.id)
    .eq("type", "dropea");

  if (storeId) {
    query = query.eq("id", storeId);
  } else {
    query = query.order("created_at", { ascending: true }).limit(1);
  }

  const { data: storeData, error: storeError } = await query.maybeSingle();

  if (storeError || !storeData) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }

  if (!storeData.dropea_email_encrypted || !storeData.dropea_pwd_encrypted) {
    return NextResponse.json({ error: "Dropea credentials not configured" }, { status: 400 });
  }

  const email = decrypt(storeData.dropea_email_encrypted);
  const pwd = decrypt(storeData.dropea_pwd_encrypted);
  const costoRechazo: number = storeData.costo_rechazo ?? 13.76;

  // Login to get Bearer token
  const loginRes = await fetch("https://api.dropea.com/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: pwd }),
  });

  if (!loginRes.ok) {
    return NextResponse.json({ error: "Dropea login failed" }, { status: 502 });
  }

  const loginData = await loginRes.json();
  const token: string = loginData.authToken || loginData.token || loginData.data?.authToken;

  if (!token) {
    return NextResponse.json({ error: "No auth token in Dropea response" }, { status: 502 });
  }

  // Fetch wallet balance
  const walletRes = await fetch("https://api.dropea.com/api/wallet-my-amounts", {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!walletRes.ok) {
    return NextResponse.json({ error: "Failed to fetch wallet" }, { status: 502 });
  }

  const walletData = await walletRes.json();
  const amounts = walletData.amounts;
  const balance = parseFloat(amounts?.amount ?? "0");

  // Count our pending orders (sent but not delivered/rejected/cancelled)
  const pendingQuery = insforge.database
    .from("pedidos")
    .select("id", { count: "exact", head: true })
    .eq("store_id", storeData.id)
    .eq("es_enviado", true)
    .eq("es_entregado", false)
    .eq("es_rechazado", false)
    .eq("es_cancelado", false);

  const { count: pendientes } = await pendingQuery;
  const totalPendientes = pendientes ?? 0;
  const retirable = balance - totalPendientes * costoRechazo;

  return NextResponse.json({
    balance,
    total_pendientes: totalPendientes,
    costo_rechazo: costoRechazo,
    retirable,
  });
}
