import { NextRequest } from "next/server";
import { handleWebhook } from "../webhook-shared";

export async function POST(request: NextRequest) {
  return handleWebhook(request);
}
