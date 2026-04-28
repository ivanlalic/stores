const API_ENDPOINT = "https://api.dropea.com/graphql/dropshippers";
const ITEMS_PER_PAGE = 50;

const ORDERS_QUERY = `
  query GetOrders($page: Int!, $perPage: Int!, $dateField: FilterDateEnum!, $startDate: String!, $endDate: String!) {
    orders(
      page: $page,
      limit: $perPage,
      date_field: $dateField,
      start_date: $startDate,
      end_date: $endDate,
      sort: CREATED_AT,
      direction: DESC
    ) {
      data {
        id
        created_at
        updated_at
        status
        external_order_id
        customer {
          full_name
          first_name
          last_name
          phone
          email
        }
        items {
          product {
            name
            sku
          }
          quantity
        }
        total_amount
        subtotal_amount
        order_profit
        payment_method
        tracking_code
      }
      current_page
      has_more_pages
      total
      per_page
    }
  }
`;

export interface DropeaOrder {
  id: string;
  created_at: string;
  updated_at: string;
  status: string;
  external_order_id: string | null;
  customer: {
    full_name: string | null;
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
    email: string | null;
  } | null;
  items: Array<{
    product: { name: string | null; sku: string | null } | null;
    quantity: number;
  }>;
  total_amount: number;
  subtotal_amount: number;
  order_profit: number;
  payment_method: string | null;
  tracking_code: string | null;
}

interface OrdersResponse {
  data: {
    orders: {
      data: DropeaOrder[];
      current_page: number;
      has_more_pages: boolean;
      total: number;
      per_page: number;
    };
  };
}

function formatDateForAPI(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

export function getDateRange(monthsBack: number = 2) {
  const today = new Date();

  // End date: tomorrow (to catch timezone edge cases)
  const endDateObj = new Date();
  endDateObj.setDate(today.getDate() + 1);

  // Start date: first day of month N-1 months ago
  const startDateObj = new Date(
    today.getFullYear(),
    today.getMonth() - (monthsBack - 1),
    1
  );

  return {
    startDate: formatDateForAPI(startDateObj),
    endDate: formatDateForAPI(endDateObj),
  };
}

export function getDateRange48h() {
  const now = new Date();

  // Start: 48 hours ago
  const startDateObj = new Date(now.getTime() - 48 * 60 * 60 * 1000);

  // End: today + 2 days (to cover timezone differences with Spain)
  const endDateObj = new Date();
  endDateObj.setDate(now.getDate() + 2);

  return {
    startDate: formatDateForAPI(startDateObj),
    endDate: formatDateForAPI(endDateObj),
  };
}

export function getDateRangeUpdatedAt(daysBack: number) {
  const today = new Date();
  const endDateObj = new Date();
  endDateObj.setDate(today.getDate() + 1);
  const startDateObj = new Date();
  startDateObj.setDate(today.getDate() - daysBack);
  return {
    startDate: formatDateForAPI(startDateObj),
    endDate: formatDateForAPI(endDateObj),
  };
}

async function fetchPage(
  apiKey: string,
  page: number,
  startDate: string,
  endDate: string,
  dateField: "CREATED_AT" | "UPDATED_AT" = "CREATED_AT"
): Promise<OrdersResponse> {
  const res = await fetch(API_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      query: ORDERS_QUERY,
      variables: {
        page,
        perPage: ITEMS_PER_PAGE,
        dateField,
        startDate,
        endDate,
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Dropea API error ${res.status}: ${text}`);
  }

  const json = await res.json();
  if (json.errors) {
    throw new Error(`GraphQL error: ${JSON.stringify(json.errors)}`);
  }

  return json;
}

export async function fetchAllOrders(
  apiKey: string,
  startDate: string,
  endDate: string,
  onProgress?: (msg: string) => void,
  dateField: "CREATED_AT" | "UPDATED_AT" = "CREATED_AT"
): Promise<DropeaOrder[]> {
  const allOrders: DropeaOrder[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    onProgress?.(`Obteniendo pagina ${page}...`);

    const response = await fetchPage(apiKey, page, startDate, endDate, dateField);
    const ordersData = response.data.orders;

    allOrders.push(...ordersData.data);
    hasMore = ordersData.has_more_pages;

    onProgress?.(
      `Pagina ${page}: ${allOrders.length}/${ordersData.total} pedidos`
    );

    if (hasMore) {
      await new Promise((r) => setTimeout(r, 300));
      page++;
    }
  }

  return allOrders;
}

// ─── Products (stock/catalog) ────────────────────────────────────────────────

const PRODUCTS_QUERY = `
  query GetProducts($page: Int!) {
    products(page: $page) {
      data { id name sku stock stock_available image }
      current_page
      has_more_pages
      total
      per_page
    }
  }
`;

export interface DropeaProduct {
  id: string;
  name: string;
  sku: string;
  stock: number | null;
  stock_available: number;
  image: string;
}

interface ProductsResponse {
  data: {
    products: {
      data: DropeaProduct[];
      current_page: number;
      has_more_pages: boolean;
      total: number;
      per_page: number;
    };
  };
}

export async function fetchProductPage(
  apiKey: string,
  page: number
): Promise<{ products: DropeaProduct[]; hasMore: boolean; total: number }> {
  const res = await fetch(API_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey },
    body: JSON.stringify({ query: PRODUCTS_QUERY, variables: { page } }),
  });
  if (!res.ok) throw new Error(`Dropea API error ${res.status}`);
  const json: ProductsResponse = await res.json();
  if (json.data?.products == null) throw new Error("Respuesta inesperada de la API de productos");
  const chunk = json.data.products;
  return { products: chunk.data, hasMore: chunk.has_more_pages, total: chunk.total };
}

export async function fetchProductPagesBatch(
  apiKey: string,
  startPage: number,
  batchSize = 10
): Promise<{ products: DropeaProduct[]; hasMore: boolean; total: number; errors: number }> {
  const pageNums = Array.from({ length: batchSize }, (_, i) => startPage + i);
  const results = await Promise.allSettled(
    pageNums.map((p) => fetchProductPage(apiKey, p))
  );
  const products: DropeaProduct[] = [];
  let hasMore = true;
  let total = 0;
  let errors = 0;
  let lastSuccessfulPage = 0;

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === "rejected") {
      errors++;
      // Retry individual page once after 500ms
      try {
        const retry = await fetchProductPage(apiKey, pageNums[i]);
        products.push(...retry.products);
        total = retry.total;
        if (!retry.hasMore) { hasMore = false; break; }
        lastSuccessfulPage = pageNums[i];
        continue;
      } catch {
        errors++;
        // If a middle page fails after retry, we can't safely continue because
        // we don't know if subsequent pages have data. Stop here.
        hasMore = false;
        break;
      }
    }

    if (r.value.products.length === 0) {
      hasMore = false;
      break;
    }

    products.push(...r.value.products);
    total = r.value.total;
    lastSuccessfulPage = pageNums[i];

    if (!r.value.hasMore) {
      hasMore = false;
      break;
    }
  }

  return { products, hasMore, total, errors };
}

export async function fetchAllProducts(
  apiKey: string,
  onProgress?: (msg: string) => void
): Promise<DropeaProduct[]> {
  const all: DropeaProduct[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const res = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify({ query: PRODUCTS_QUERY, variables: { page } }),
    });

    if (!res.ok) throw new Error(`Dropea API error ${res.status}`);
    const json: ProductsResponse = await res.json();
    if (json.data?.products == null) throw new Error("Respuesta inesperada de la API de productos");

    const chunk = json.data.products;
    all.push(...chunk.data);
    hasMore = chunk.has_more_pages;
    onProgress?.(`Productos: ${all.length} / ${chunk.total}`);

    if (hasMore) {
      await new Promise((r) => setTimeout(r, 150));
      page++;
    }
  }

  return all;
}

// ─── Connection test ──────────────────────────────────────────────────────────

export async function testConnection(
  apiKey: string
): Promise<{ success: boolean; total: number; error?: string }> {
  try {
    const { startDate, endDate } = getDateRange(2);
    const response = await fetchPage(apiKey, 1, startDate, endDate);
    return {
      success: true,
      total: response.data.orders.total,
    };
  } catch (error) {
    return {
      success: false,
      total: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
