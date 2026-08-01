import { decrypt } from "@/lib/encryption";

export interface WalletV2 {
  balance: number;
  available_balance: number;
  currency: string;
  variation_percentage: number;
}

const WALLET_QUERY = `query DashboardWalletSummary {
  dashboardWalletSummary {
    available_balance
    currency
    variation_percentage
  }
}`;

export async function fetchDropeaWalletV2(
  email: string,
  password: string,
  market: string
): Promise<WalletV2> {
  const base = `https://${market.toLowerCase()}.api.dropea.com`;

  const loginRes = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!loginRes.ok) {
    const text = await loginRes.text();
    throw new Error(`Dropea v2 login failed (${loginRes.status}): ${text.slice(0, 200)}`);
  }

  const loginJson = await loginRes.json();
  const token: string | undefined = loginJson?.data?.access_token;
  if (!token) {
    throw new Error("No access_token in Dropea v2 login response");
  }

  const walletRes = await fetch(`${base}/graphql?op=DashboardWalletSummary`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      operationName: "DashboardWalletSummary",
      variables: {},
      query: WALLET_QUERY,
    }),
  });

  if (!walletRes.ok) {
    const text = await walletRes.text();
    throw new Error(`Dropea v2 wallet failed (${walletRes.status}): ${text.slice(0, 200)}`);
  }

  const walletJson = await walletRes.json();
  const summary = walletJson?.data?.dashboardWalletSummary;
  if (!summary) {
    throw new Error("No dashboardWalletSummary in Dropea v2 wallet response");
  }

  const available = Number(summary.available_balance) || 0;
  return {
    balance: available,
    available_balance: available,
    currency: summary.currency ?? "EUR",
    variation_percentage: Number(summary.variation_percentage) || 0,
  };
}

export function decryptDropeaCredentials(
  emailEncrypted: string | null,
  pwdEncrypted: string | null
): { email: string; pwd: string } | null {
  if (!emailEncrypted || !pwdEncrypted) return null;
  return {
    email: decrypt(emailEncrypted),
    pwd: decrypt(pwdEncrypted),
  };
}
