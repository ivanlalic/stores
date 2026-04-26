import { NextRequest, NextResponse } from "next/server";
import { getUser, createServiceClient } from "@/lib/insforge/server";
import { getDropiDailyDashboard } from "@/lib/queries/dropi-dashboard";

export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month") || new Date().toISOString().slice(0, 7);

  const insforge = createServiceClient();
  const rows = await getDropiDailyDashboard(insforge, user.id, month);

  return NextResponse.json({ rows });
}
