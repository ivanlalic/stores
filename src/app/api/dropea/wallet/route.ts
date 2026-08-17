import { NextRequest, NextResponse } from "next/server";
import { getUser, createServiceClient } from "@/lib/insforge/server";
import { decrypt } from "@/lib/encryption";
import {
  fetchDropeaWalletV2,
  decryptDropeaCredentials,
} from "@/lib/dropea/wallet";

export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const storeId = searchParams.get("store_id");

  const insforge = createServiceClient();

  let query = insforge.database
    .from("stores")
    .select("id, dropea_email_encrypted, dropea_pwd_encrypted, costo_rechazo, market")
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

  const creds = decryptDropeaCredentials(
    storeData.dropea_email_encrypted,
    storeData.dropea_pwd_encrypted
  );

  if (!creds) {
    return NextResponse.json({ error: "Dropea credentials not configured" }, { status: 400 });
  }

  const costoRechazo: number = storeData.costo_rechazo ?? 13.76;

  let balance: number;
  let fondosDisponibles: number;

  if (storeData.market) {
    const wallet = await fetchDropeaWalletV2(creds.email, creds.pwd, storeData.market);
    balance = wallet.balance;
    fondosDisponibles = wallet.available_balance;
  } else {
    const loginRes = await fetch("https://api.dropea.com/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: creds.email, password: creds.pwd }),
    });

    if (!loginRes.ok) {
      return NextResponse.json({ error: "Dropea login failed" }, { status: 502 });
    }

    const loginData = await loginRes.json();
    const token: string = loginData.authToken || loginData.token || loginData.data?.authToken;

    if (!token) {
      return NextResponse.json({ error: "No auth token in Dropea response" }, { status: 502 });
    }

    const walletRes = await fetch("https://api.dropea.com/api/wallet-my-amounts", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!walletRes.ok) {
      return NextResponse.json({ error: "Failed to fetch wallet" }, { status: 502 });
    }

    const walletData = await walletRes.json();
    const amounts = walletData.amounts;
    balance = parseFloat(amounts?.amount ?? "0");
    fondosDisponibles = parseFloat(amounts?.withdraw_amount ?? "0");
  }

  // Count pending orders (sent but not resolved) from current month + previous month only.
  // Orders older than 2 months are assumed resolved (delivered or returned).
  const now = new Date();
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    .toISOString()
    .split("T")[0];

  const { count: pendientes } = await insforge.database
    .from("pedidos")
    .select("id", { count: "exact", head: true })
    .eq("store_id", storeData.id)
    .eq("es_enviado", true)
    .eq("es_entregado", false)
    .eq("es_rechazado", false)
    .eq("es_cancelado", false)
    .gte("fecha", prevMonthStart);

  const totalPendientes = pendientes ?? 0;
  // fondosDisponibles already excludes Dropea's own reserves; subtract our worst-case pending
  const retirable = fondosDisponibles - totalPendientes * costoRechazo;

  return NextResponse.json({
    balance,
    fondos_disponibles: fondosDisponibles,
    total_pendientes: totalPendientes,
    costo_rechazo: costoRechazo,
    retirable,
  });
}
