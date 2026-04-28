const LOGIN_PAGE = "https://www.dropipro.com/";
const LOGIN_SUBMIT = "https://www.dropipro.com/login/submit";
const PRODUCTS_URL = "https://www.dropipro.com/app/products";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

export interface DropiproProduct {
  id: string;
  name: string;
  image: string | null;
  stock: number;
}

function parseCookies(headers: Headers): string {
  const raw = typeof headers.getSetCookie === "function"
    ? headers.getSetCookie()
    : (headers.get("set-cookie") ?? "").split(/,(?=[^ ])/).filter(Boolean);
  return raw.map((c) => c.split(";")[0].trim()).filter(Boolean).join("; ");
}

export async function loginDropipro(email: string, password: string): Promise<string> {
  // Step 1: get CSRF token + initial cookies
  const initRes = await fetch(LOGIN_PAGE, {
    headers: { "User-Agent": UA },
  });
  const initHtml = await initRes.text();
  const initCookies = parseCookies(initRes.headers);

  const tokenMatch = initHtml.match(/name="_token"\s+value="([^"]+)"/);
  if (!tokenMatch) throw new Error("CSRF token not found on Dropipro login page");
  const csrfToken = tokenMatch[1];

  // Step 2: POST credentials
  const body = new URLSearchParams({ _token: csrfToken, user: email, pwd: password });
  const loginRes = await fetch(LOGIN_SUBMIT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Cookie": initCookies,
      "Referer": LOGIN_PAGE,
      "User-Agent": UA,
    },
    body: body.toString(),
    redirect: "manual",
  });

  const sessionCookies = parseCookies(loginRes.headers);
  const allCookies = [initCookies, sessionCookies].filter(Boolean).join("; ");
  if (!allCookies) throw new Error("Login failed: no session cookies");

  return allCookies;
}

export function parseProductsPage(html: string): DropiproProduct[] {
  const products: DropiproProduct[] = [];
  const regex = /data-id="(\d+)"[\s\S]*?<img\s+src="([^"]*)"[^>]*>[\s\S]*?class="inventory-product-title">([^<]+)<[\s\S]*?Stock disponible:\s*(\d+)/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    let image = match[2].trim();
    if (!image) image = "";
    else if (image.startsWith("/")) image = "https://www.dropipro.com" + image;
    else if (!image.startsWith("http")) image = "https://www.dropipro.com/" + image;
    products.push({
      id: match[1],
      image: image || null,
      name: match[3].trim(),
      stock: parseInt(match[4], 10),
    });
  }
  return products;
}

export async function scrapeProductPage(
  cookies: string,
  page: number
): Promise<{ products: DropiproProduct[]; hasMore: boolean }> {
  const url = page === 1 ? PRODUCTS_URL : `${PRODUCTS_URL}?page=${page}`;
  const res = await fetch(url, {
    headers: { "Cookie": cookies, "User-Agent": UA },
  });
  if (!res.ok) throw new Error(`Dropipro HTTP ${res.status}`);
  const html = await res.text();
  if (html.includes("Iniciar sesión") && !html.includes("data-id=")) {
    throw new Error("Session expired");
  }
  const products = parseProductsPage(html);
  const hasMore = products.length > 0 && html.includes(`page=${page + 1}`);
  return { products, hasMore };
}
