import { NextRequest, NextResponse } from "next/server";
import { getUser, createServiceClient } from "@/lib/insforge/server";

export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  const storeId = url.searchParams.get("store_id");

  if (!storeId) {
    return NextResponse.json({ error: "store_id is required" }, { status: 400 });
  }

  const insforge = createServiceClient();

  // Scenario 1: Calculate the actual delivery rate from historical orders
  if (type === "real-delivery-rate") {
    const nombre = url.searchParams.get("nombre");
    if (!nombre?.trim()) {
      return NextResponse.json({ error: "nombre parameter is required" }, { status: 400 });
    }

    const { data: orders, error: ordersError } = await insforge.database
      .from("pedidos")
      .select("es_enviado, es_entregado, es_rechazado")
      .eq("store_id", storeId)
      .ilike("pedido", `%${nombre.trim()}%`);

    if (ordersError) {
      return NextResponse.json({ error: ordersError.message }, { status: 500 });
    }

    const total = orders?.length || 0;
    const enviados = orders?.filter((o: { es_enviado: boolean }) => o.es_enviado).length || 0;
    const entregados = orders?.filter((o: { es_entregado: boolean }) => o.es_entregado).length || 0;
    const rechazados = orders?.filter((o: { es_rechazado: boolean }) => o.es_rechazado).length || 0;

    const tasa_entrega = enviados > 0 ? (entregados / enviados) : null;

    return NextResponse.json({
      nombre,
      total_pedidos: total,
      enviados,
      entregados,
      rechazados,
      tasa_entrega: tasa_entrega !== null ? Math.round(tasa_entrega * 1000) / 1000 : null,
    });
  }

  // Scenario 2: List saved product simulations for this store
  const { data: simulations, error } = await insforge.database
    .from("simulaciones_productos")
    .select("*")
    .eq("store_id", storeId)
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ simulations });
}

export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const {
    store_id,
    nombre,
    precio_venta,
    costo_unitario,
    unidades_por_venta = 1,
    costo_envio_cod,
    cpa_promedio,
    tasa_entrega_manual,
    tasa_confirmacion_manual,
    costo_rechazo = 14.00,
    costo_fulfillment_proveedor = 0.00,
  } = body;

  if (!store_id) return NextResponse.json({ error: "store_id is required" }, { status: 400 });
  if (!nombre?.trim()) return NextResponse.json({ error: "nombre is required" }, { status: 400 });

  const record = {
    user_id: user.id,
    store_id,
    nombre: nombre.trim(),
    precio_venta: Number(precio_venta) || 0,
    costo_unitario: Number(costo_unitario) || 0,
    unidades_por_venta: Number(unidades_por_venta) || 1,
    costo_envio_cod: Number(costo_envio_cod) || 0,
    cpa_promedio: Number(cpa_promedio) || 0,
    tasa_entrega_manual: tasa_entrega_manual !== null && tasa_entrega_manual !== undefined ? Number(tasa_entrega_manual) : null,
    tasa_confirmacion_manual: tasa_confirmacion_manual !== null && tasa_confirmacion_manual !== undefined ? Number(tasa_confirmacion_manual) : null,
    costo_rechazo: Number(costo_rechazo) || 14.00,
    costo_fulfillment_proveedor: Number(costo_fulfillment_proveedor) || 0.00,
    updated_at: new Date().toISOString(),
  };

  const insforge = createServiceClient();
  const { data, error } = await insforge.database
    .from("simulaciones_productos")
    .upsert([record], { onConflict: "store_id,nombre" })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ simulation: data });
}

export async function DELETE(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const storeId = url.searchParams.get("store_id");

  if (!id || !storeId) {
    return NextResponse.json({ error: "id and store_id parameters are required" }, { status: 400 });
  }

  const insforge = createServiceClient();
  const { error } = await insforge.database
    .from("simulaciones_productos")
    .delete()
    .eq("id", id)
    .eq("store_id", storeId)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
