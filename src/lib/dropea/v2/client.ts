const ITEMS_PER_PAGE = 100;
const RATE_LIMIT_REQ_PER_MIN = 60;
const REQUEST_INTERVAL_MS = Math.ceil((60 * 1000) / RATE_LIMIT_REQ_PER_MIN) + 200;

export interface DropeaLineItemV2 {
  variant_id: number;
  quantity: number;
  unit_price: number;
  product_id: number;
  product_name: string;
  variant_name: string | null;
  sku: string | null;
  ean: string | null;
  wholesale_price: number | null;
}

export interface DropeaOrderV2 {
  id: number;
  store_id: number;
  store_owner_id: number;
  supplier_id: number;
  status: string;
  sub_status: string | null;
  payment_method: string;
  fulfillment_type: string;
  carrier: string | null;
  service_type: string | null;
  external_order_id: string | null;
  line_items: DropeaLineItemV2[];
  total_amount: number;
  currency: string;
  created_at: string;
  updated_at: string;
  confirmed_at: string | null;
  processing_at: string | null;
  delivered_at: string | null;
  rejected_at: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  order_costs?: {
    tax_rate_provider: number;
    fulfillment_outbound: number;
    fulfillment_quantity_cost: number;
    fulfillment_return: number;
  } | null;
  shipping_address?: {
    full_name: string | null;
    first_name: string | null;
    last_name: string | null;
    phone_number: string | null;
    email: string | null;
  } | null;
}

interface OrdersPageResponse {
  data?: {
    items?: DropeaOrderV2[];
    pagination?: {
      page: number;
      limit: number;
      total: number;
      total_pages: number;
      has_next_page: boolean;
    };
  };
}

export interface DropeaVariantV2 {
  variant_id: number;
  sku: string | null;
  name: string | null;
  price: number;
  currency: string;
  stock: number;
}

export interface DropeaProductV2 {
  id: number;
  name: string;
  status: string;
  owner_id: number;
  variants: DropeaVariantV2[];
  created_at: string;
  updated_at: string;
}

interface ProductsPageResponse {
  data?: {
    items?: DropeaProductV2[];
    pagination?: {
      page: number;
      limit: number;
      total: number;
      total_pages: number;
      has_next_page: boolean;
    };
  };
}

export function getDateRangeV2(monthsBack: number = 2) {
  const today = new Date();
  const end = new Date();
  end.setDate(today.getDate() + 1);
  const start = new Date(today.getFullYear(), today.getMonth() - (monthsBack - 1), 1);
  return {
    startDate: start.toISOString().split("T")[0],
    endDate: end.toISOString().split("T")[0],
  };
}

export function getDateRangeDaysV2(daysBack: number) {
  const end = new Date();
  end.setDate(end.getDate() + 1);
  const start = new Date();
  start.setDate(start.getDate() - daysBack);
  return {
    startDate: start.toISOString().split("T")[0],
    endDate: end.toISOString().split("T")[0],
  };
}

async function fetchOrdersPage(
  apiKey: string,
  market: string,
  page: number,
  startDate: string,
  endDate: string
): Promise<OrdersPageResponse> {
  const base = `https://${market.toLowerCase()}.public-api.dropea.com`;
  const params = new URLSearchParams({
    payment_method: "COD",
    limit: String(ITEMS_PER_PAGE),
    page: String(page),
    sort_by: "created_at",
    sort_order: "desc",
    date_type: "created_at",
    date_from: startDate,
    date_to: endDate,
  });

  const res = await fetch(`${base}/dropshipper/orders?${params}`, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
  });

  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get("retry-after") || "60", 10);
    await new Promise((r) => setTimeout(r, retryAfter * 1000));
    return fetchOrdersPage(apiKey, market, page, startDate, endDate);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Dropea v2 API error ${res.status}: ${text.slice(0, 300)}`);
  }

  return res.json();
}

export async function fetchAllOrdersV2(
  apiKey: string,
  market: string,
  startDate: string,
  endDate: string,
  onProgress?: (msg: string) => void
): Promise<DropeaOrderV2[]> {
  const all: DropeaOrderV2[] = [];
  let page = 1;
  let total = 0;

  while (true) {
    onProgress?.(`Obteniendo pagina ${page}...`);
    const json = await fetchOrdersPage(apiKey, market, page, startDate, endDate);
    const items = json?.data?.items || [];
    const pagination = json?.data?.pagination;
    total = pagination?.total ?? 0;

    all.push(...items);
    onProgress?.(`Pagina ${page}: ${all.length}/${total} pedidos`);

    const hasNext = pagination?.has_next_page ?? items.length >= ITEMS_PER_PAGE;
    if (!hasNext) break;

    await new Promise((r) => setTimeout(r, REQUEST_INTERVAL_MS));
    page++;
  }

  return all;
}

export async function testConnectionV2(apiKey: string, market: string) {
  const { startDate, endDate } = getDateRangeV2(2);
  const json = await fetchOrdersPage(apiKey, market, 1, startDate, endDate);
  return {
    success: true,
    total: json?.data?.pagination?.total ?? 0,
  };
}

async function fetchProductsPage(
  apiKey: string,
  market: string,
  page: number
): Promise<ProductsPageResponse> {
  const base = `https://${market.toLowerCase()}.public-api.dropea.com`;
  const params = new URLSearchParams({
    limit: String(ITEMS_PER_PAGE),
    page: String(page),
  });

  const res = await fetch(`${base}/dropshipper/products?${params}`, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
  });

  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get("retry-after") || "60", 10);
    await new Promise((r) => setTimeout(r, retryAfter * 1000));
    return fetchProductsPage(apiKey, market, page);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Dropea v2 products error ${res.status}: ${text.slice(0, 300)}`);
  }

  return res.json();
}

export async function fetchAllProductsV2(
  apiKey: string,
  market: string,
  onProgress?: (msg: string) => void
): Promise<DropeaProductV2[]> {
  const all: DropeaProductV2[] = [];
  let page = 1;
  let total = 0;

  while (true) {
    onProgress?.(`Obteniendo pagina ${page}...`);
    const json = await fetchProductsPage(apiKey, market, page);
    const items = json?.data?.items || [];
    const pagination = json?.data?.pagination;
    total = pagination?.total ?? 0;

    all.push(...items);
    onProgress?.(`Pagina ${page}: ${all.length}/${total} productos`);

    const hasNext = pagination?.has_next_page ?? items.length >= ITEMS_PER_PAGE;
    if (!hasNext) break;

    await new Promise((r) => setTimeout(r, REQUEST_INTERVAL_MS));
    page++;
  }

  return all;
}
