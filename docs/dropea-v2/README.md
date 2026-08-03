# Migración Dropea API v1 → v2 — Análisis y plan

> **ESTADO: V2 CONFIRMADA VIVA (tienda piloto NutrexPortugal, PT). SONDEO DÍA 1 HECHO (§9).**
> **ES v2 activa 2026-08-03: IBericaStore migrada a v2 (§9 "España v2").**
> **Todavía NO migrar Nutrex (tienda ES, sin API key v2 ES propia).**
> Análisis inicial 2026-07-31; sondeo con datos reales 2026-08-01; ES 2026-08-03.
>
> **Para retomar este trabajo:** leer este archivo completo + `openapi.json` (snapshot de la spec v2)
> + los JSONs reales en `docs/dropea-v2/probe/`. Script de sondeo: `scripts/probe-dropea-v2.mjs`
> (lee `DROPEA_V2_API_KEY` de `.env.local`).

---

## 1. Fuentes

- Docs v2: https://public-api.dropea.com/dropshipper/docs
- Spec OpenAPI 3.0.3 (v0.1.0): https://public-api.dropea.com/dropshipper/openapi.json
  - **Snapshot local:** `docs/dropea-v2/openapi.json` (descargado 2026-07-31)

## 2. Situación actual del proyecto (v1)

El proyecto sincroniza pedidos y stock desde Dropea con estas integraciones:

| Integración | Archivo | Detalle |
|---|---|---|
| GraphQL orders+products | `src/lib/dropea/client.ts` | `POST https://api.dropea.com/graphql/dropshippers`, header `x-api-key`. Queries hardcodeadas `ORDERS_QUERY` (50/pág, fechas `DD-MM-YYYY`, `date_field: CREATED_AT\|UPDATED_AT`) y `PRODUCTS_QUERY` (`stock_available`, `image` por producto) |
| Estados v1 | `src/lib/dropea/status.ts` | Status plano UPPERCASE: `PENDING, PREPARING, PREPARED, CONFIRMED, INCIDENCE, TRANSIT, DELIVERED, CHARGED, REJECTED, CANCELLED` → flags `es_enviado/es_entregado/es_rechazado/es_cancelado` **materializados en tabla `pedidos`** |
| Sync pedidos | `src/app/api/sync/route.ts` | SSE con progreso; upsert a `pedidos` (`onConflict: store_id,dropea_id`). `mode=48h` usa `dateField=UPDATED_AT` para refrescar estados recientes. `neto = order.order_profit` |
| Sync stock | `src/app/api/stock/route.ts` | Batches de 10 páginas paralelas (límite 10s Vercel); guarda en `stock_syncs`/`stock_snapshots` keyed por `dropea_id` (product id) |
| Wallet | `src/app/api/dropea/wallet/route.ts` | REST viejo: `POST api.dropea.com/api/login` (email/pwd → Bearer) + `GET /api/wallet-my-amounts` (`amounts.amount`, `amounts.withdraw_amount`) |
| Credenciales | `stores.dropea_api_key_encrypted` (+ `dropea_email/pwd_encrypted` para wallet) | Cifradas con `ENCRYPTION_KEY`, ver `src/lib/encryption.ts` |

## 3. La nueva API v2 (REST)

- **Hosts por mercado:** `https://es.public-api.dropea.com` (ES), `pt.` (PT, default), `it.` (IT)
- **Auth:** `Authorization: Bearer <API_KEY_JWT>` — API key NUEVA creada en dashboard Dropea → Settings → API Keys, con scopes (`x-dropea-permissions` por endpoint: `dp:orders:read`, `dp:products:read`, `dp:webhooks:write`, etc.)
- **Rate limit:** 60 req/min ventana rolling; headers `X-RateLimit-Limit/Remaining/Window`; 429 con `Retry-After: 60`
- **Idempotency-Key** requerido en mutaciones (POST/PATCH)
- **Paginación:** `page` + `limit` (máx 100, default 20) → `PaginationMeta {total, page, limit, total_pages}` (ya no `has_more_pages`)
- **Fechas en filtros:** `date-time` ISO 8601 (ya no `DD-MM-YYYY`)

### Endpoints (25)

```
GET    /dropshipper/me                              dp:users:read
GET    /dropshipper/catalogs/carriers
GET    /dropshipper/catalogs/order-statuses         ← vocabulario vivo de estados
GET    /dropshipper/orders                          dp:orders:read
POST   /dropshipper/orders                          dp:orders:create (Idempotency-Key)
GET    /dropshipper/orders/{id}
PATCH  /dropshipper/orders/{id}
POST   /dropshipper/orders/{id}/cancel
POST   /dropshipper/orders/{id}/confirm
GET    /dropshipper/products                        dp:products:read
GET    /dropshipper/products/{id}
GET    /dropshipper/shops                           dp:stores:read
GET    /dropshipper/shops/{id}
GET    /dropshipper/shops/{id}/orders
GET    /dropshipper/shops/{id}/products
POST   /dropshipper/shops/{id}/products             (crear producto en shop, SHOPIFY only)
POST   /dropshipper/shops/{id}/products/link
POST   /dropshipper/shops/{id}/products/unlink
GET    /dropshipper/issues                          dp:issues:read
GET    /dropshipper/issues/{id}
POST   /dropshipper/issues/{id}/resolve
GET    /dropshipper/operations/{operation_id}       (poll async ops)
GET    /dropshipper/webhooks                        dp:webhooks:read
POST   /dropshipper/webhooks                        dp:webhooks:write
DELETE /dropshipper/webhooks/{id}
```

### Modelo Order (v2)

```
id: integer                    ← antes string
status: enum [DRAFT, PENDING, CONFIRMED, PROCESSING, SHIPPING, DELIVERED*, FINISH, ERROR]
                                 (*DELIVERED top-level es LEGACY, ver §4)
sub_status: enum(22) [CREATING, PENDING, PENDING_SUPPLIER, PICKING, PACKED, AWAITING_PICKUP,
            SHIPPED, OUT_FOR_DELIVERY, DELIVERY_ATTEMPTED, DELIVERED, PAID, CANCELLED,
            REFUSED, LOST_DAMAGED, REFUSED_LOST_DAMAGED, DELIVERY_EXCEPTION, REVIEW,
            TECHNICAL_ERROR, REJECTED, INSUFFICIENT_STOCK, CARRIER_VALIDATION_FAILED,
            WAREHOUSE_INTEGRATION_FAILED] (nullable)
store_id, store_owner_id: integer
line_items[]: { variant_id*, quantity*, unit_price*, product_id, product_name,
               variant_name, sku, ean, wholesale_price, variant_type, external_name }
total_amount*, currency*
created_at*, updated_at*, confirmed_at, processing_at, delivered_at, rejected_at
payment_method: enum [COD, PAYPAL, STRIPE, SHOPIFY_PAYMENTS, PAID, MANUAL, OTHER]
supplier_id, fulfillment_type [SUPPLIER|DROPEA], carrier, service_type
shipping_address: { full_name, first_name, last_name, address_line_1/2, city, state,
                    postal_code, country, phone_number, email, phone_country, area_code }
external_order_id, pack_ids[], notes[], tax_data_dropshipper
order_costs: { tax_rate_provider, fulfillment_outbound, fulfillment_quantity_cost,
               fulfillment_return }   ← RAW, puede estar ausente
tracking_number, tracking_url
```

**NO EXISTEN en v2:** `order_profit` ❌, `subtotal_amount`, `customer` (→ va en `shipping_address`), `image` en Product ❌, wallet ❌.

### Modelo Product (v2)

```
id*, name*, status [PUBLIC|EXCLUSIVE], owner_id, description, created_at, updated_at
variants[]: { variant_id*, sku*, name*, price*, currency*, stock* }   ← stock POR VARIANTE
```

### Filtros GET /orders

`page, limit, sort_by [created_at|updated_at|order_number|status], sort_order,
status, store_id, date_from, date_to, date_type [created_at|confirmed_at|processing_at|delivered_at],
carrier, service_type, payment_method (REQUERIDO según spec), supplier_id, product_id,
pack_id, city, province, external_order_id`

⚠️ **No existe `date_type=updated_at`** → el "sync 48h" por UPDATED_AT desaparece; lo sustituyen los webhooks.

### Webhooks (novedad v2)

Topics: `order.created`, `order.status.changed`, `order.cancelled`, `issue.created`,
`issue.status.changed`, `issue.resolved`.
Payload: `{ topic, market, event_id, event_at, resource_id, resource: Order }` (Order completa).
Suscripción por API key. → Reemplaza al polling por UPDATED_AT (patrón ya existente en `/api/dropi/webhook`).

## 4. Semántica de estados v2 (confirmado en la spec)

| Estado | Definición oficial |
|---|---|
| `FINISH` (status) | **"Terminal state: delivered, paid, cancelled, refused or lost/damaged"** — bolsa de TODOS los pedidos resueltos |
| `DELIVERED` top-level | **LEGACY**: "new orders never reach top-level DELIVERED". Terminal canónico = `FINISH` + `sub_status: DELIVERED` |
| `DELIVERED` (sub) | "Order successfully delivered to the customer" |
| `PAID` (sub) | "Order delivered and payment settled" ≈ viejo `CHARGED` |
| `PROCESSING` (status) | "Supplier is picking and packing the order" (subs: `PICKING`, `PACKED`) |

**Modelo mental:** el pedido viaja por `status` (PENDING → CONFIRMED → PROCESSING → SHIPPING → FINISH);
el *resultado* está en el `sub_status` dentro de FINISH (DELIVERED / PAID / CANCELLED / REFUSED / LOST_DAMAGED).
Vocabulario completo con descripciones: `GET /dropshipper/catalogs/order-statuses` (requiere API key → sondeo Día 1).

Hipótesis de mapeo (A VALIDAR con datos reales):
- `es_enviado`: status ∈ {CONFIRMED, PROCESSING, SHIPPING, FINISH} (quizá también ERROR/DELIVERED legacy para históricos)
- `es_entregado`: FINISH + sub ∈ {DELIVERED, PAID}
- `es_rechazado`: FINISH + sub ∈ {REFUSED, REFUSED_LOST_DAMAGED, LOST_DAMAGED?}
- `es_cancelado`: sub = CANCELLED (¿en cualquier status?)

## 5. Problemas a resolver (orden de prioridad)

1. **`neto` sin `order_profit`** → reconstruir fórmula con `line_items[].wholesale_price` + `order_costs`
   y **validar contra pedidos ya sincronizados** (tenemos `neto` v1 en DB para cruzar).
2. **Estados**: reescribir `src/lib/dropea/status.ts` (status+sub_status) y **re-sincronizar histórico**
   (los flags están materializados en `pedidos`).
3. **Sin filtro UPDATED_AT** → adoptar webhooks (`order.status.changed` trae la Order completa).
4. **Stock por variante + sin imagen** → `stock_snapshots` pasaría a `variant_id`; las páginas de stock
   pierden la imagen salvo fuente alternativa.
5. **Wallet sin endpoint en la public API v2** → RESUELTO: la **API interna del dashboard**
   (`{market}.api.dropea.com`, login + GraphQL `DashboardWalletSummary`) expone `available_balance`
   (ver §9 "Wallet v2"). Resta implementarlo en la app.
6. **`payment_method` requerido en GET /orders** → el usuario confirma: **99.9% es COD** → sincronizar
   con `payment_method=COD` (revisar puntualmente otros métodos).
7. **API keys nuevas** → cada usuario deberá crear su key en dashboard Dropea (scopes de lectura +
   webhooks) y pegarla en Settings; considerar guardar mercado (ES/PT/IT) por tienda.
8. **Rate limit 60 req/min** → el batch paralelo de 10 páginas de stock debe respetar 429/`Retry-After`.

## 6. Mapa de archivos a tocar (cuando toque)

| Archivo | Cambio |
|---|---|
| `src/lib/dropea/client.ts` | Reescritura completa: REST, Bearer, host ES, paginación total_pages, backoff 429 |
| `src/lib/dropea/status.ts` | Reescritura: status + sub_status |
| `src/app/api/sync/route.ts` | payment_method=COD, fechas ISO, recalcular neto, dropea_id int, quitar modo UPDATED_AT |
| **nuevo** `src/app/api/dropea/webhook/route.ts` | Receptor webhooks (espejo de `/api/dropi/webhook`) + registro de suscripción |
| `src/app/api/stock/route.ts` | Variantes, sin imagen |
| `src/app/api/dropea/wallet/route.ts` | En el aire (scraping dashboard o eliminar tarjeta) |
| `src/app/settings/page.tsx` | Nueva API key por tienda (+ mercado) |
| DB | Considerar columnas `sub_status`, `carrier`, `tracking_url`, `payment_method` en `pedidos`; `variant_id` en `stock_snapshots`; re-sync histórico |

## 7. Plan de sondeo Día 1 (cuando v2 esté viva)

1. Usuario crea API key en dashboard Dropea (scopes: `dp:users:read`, `dp:orders:read`,
   `dp:products:read`, `dp:webhooks:read/write`, catálogos).
2. Consultas de solo lectura, capturando JSONs reales:
   - `GET https://es.public-api.dropea.com/dropshipper/me`
   - `GET /dropshipper/catalogs/order-statuses` → vocabulario oficial completo
   - `GET /dropshipper/orders?payment_method=COD&limit=100&sort_by=created_at&sort_order=desc`
     → órdenes completas reales (ver `order_costs`, `wholesale_price`, timestamps con zona horaria)
   - `GET /dropshipper/products?page=1&limit=100` → variantes/stock
   - `GET /dropshipper/shops` → mapeo store_id
3. **Cruzar pedidos v1 vs v2** (mismo `external_order_id`/`id`): comparar `neto` v1 contra
   `total_amount`, `Σ wholesale_price×qty`, `order_costs` → derivar fórmula del neto.
4. Probar si v1 GraphQL sigue viva (transición) y si `/api/wallet-my-amounts` responde.
5. Registrar webhook de prueba (`POST /dropshipper/webhooks`) y observar payloads reales.
6. Con los datos medidos → diseño final y entonces sí implementar.

## 8. Decisiones tomadas (2026-07-31)

- ✅ Esperar al lanzamiento de v2; **no implementar nada a ciegas**.
- ✅ 99.9% de pedidos son COD → filtrar `payment_method=COD`.
- ✅ Wallet: no hay endpoint en public v2, pero SÍ en la API interna del dashboard
  (login + GraphQL `DashboardWalletSummary`) → implementar con eso; scraper solo como plan B.
- ⏳ Pendiente de Dropea/datos reales: fórmula del `neto`, semántica exacta FINISH/PAID/REFUSED,
  vigencia de v1, endpoint de wallet.

## 9. Resultados del sondeo Día 1 (2026-08-01, NutrexPortugal)

Tienda piloto creada en la app: `stores.id = 43657cd3-c9ff-4757-ad4b-43d9112494ff`
(NutrexPortugal, type=dropea, **sin api key guardada** — ver pendientes).
En Dropea: `shop id 1642` "Nutrex Portugal" (SHOPIFY, ACTIVE), owner `user id 800`, market **PT**.
API key v2 en `.env.local` (`DROPEA_V2_API_KEY`, expira 2027-07-31, scopes completos)
+ `DROPEA_V2_WEBHOOK_SECRET` (HMAC firma webhooks, para el futuro receptor).

### Confirmado con datos reales

- **Los 6 endpoints GET responden 200** (`me`, `order-statuses`, `orders`, `products`, `shops`, `carriers`).
  Rate limit headers reales: `X-RateLimit-Remaining/Limit: 60`.
- **Vocabulario de estados** (`GET catalogs/order-statuses`, guardado en `probe/*_order-statuses.json`):
  - `DELIVERED` top-level: "intermediate marker", sin sub_statuses → efectivamente legacy/transitorio.
  - `FINISH` subs: `DELIVERED, PAID, CANCELLED, REFUSED, LOST_DAMAGED, REFUSED_LOST_DAMAGED`.
  - `ERROR` subs: `DELIVERY_EXCEPTION, REVIEW, TECHNICAL_ERROR, REJECTED, INSUFFICIENT_STOCK,
    CARRIER_VALIDATION_FAILED, WAREHOUSE_INTEGRATION_FAILED`. **OJO: `REJECTED` vive en ERROR**
    (carrier rechazó el paquete, pendiente de recanalizar) ≠ `REFUSED` (cliente rechazó) en FINISH.
  - Distribución real (12 pedidos, todos COD, shop 1642): PENDING/PENDING ×4, SHIPPING/SHIPPED ×5,
    FINISH/DELIVERED ×1, FINISH/CANCELLED ×2.
- **Paginación real** trae más campos que la spec: `{page, limit, total, total_pages, has_next_page, has_previous_page}`.
- **Modelo Order**: tal cual §3, incl. `tracking_number/url`, `tax_data_dropshipper`, timestamps ISO con `Z`.
  `shipping_address` añade `validation_result_summary`, `coordinates_validated` (no estaban en la spec).
- **Datos financieros reales** (clave para el `neto`, §5.1):
  - `total_amount` = lo que paga el cliente (COD). **NO es** `Σ unit_price×qty` (unit_price parece
    precio de catálogo/oferta: 2 uds → total 29.9 con retail_sum 59.8; 3 uds → 39.8 con retail 89.7).
    El "Ajuste" del dashboard = `total_amount − Σ unit_price×qty` (derivable, no hace falta para el neto).
  - `wholesale_price` = 2.5/ud en todos; `order_costs` presente en los 12 pedidos:
    `fulfillment_outbound` = 1.5 fijo, `fulfillment_quantity_cost` = 0.15×(qty−1) (ya viene TOTAL, no por unidad),
    `fulfillment_return` = 0 (incluso en CANCELLED), `tax_rate_provider` = 0.
    "Fulfillment" del dashboard = `outbound + quantity_cost` (1.80 para 3 uds) ✓.
  - ⚠️ **La API NO expone** (ni listado ni detalle ni spec): **coste de envío** (dashboard: 3.50€),
    **coste contra reembolso** (1.00€) ni **comisión Dropea** (0.00€ en este pedido EXCLUSIVE;
    desconocido si aplica en productos PUBLIC).
  - **Fórmula del neto validada contra dashboard** (pedido `#NSPT-1091`/16475, beneficio real 26.00€):
    `neto = total_amount − Σ(wholesale×qty) − fulfillment_outbound − fulfillment_quantity_cost − ENVIO − COD_FEE`
    con ENVIO=3.50 y COD_FEE=1.00 **(CTT PM / PT / COD — valores SOLO de Portugal)**.
    39.8 − 7.5 − 1.5 − 0.3 − 3.5 − 1.0 = 26.0 ✓
  - ✅ ENVIO/COD_FEE **constantes confirmadas en PT** (2ª muestra: `#NSPT-1095`, 2 uds:
    gastos 11.15€ = 5.0 + 1.65 + 3.5 + 1.0, beneficio **18.75€ = predicción exacta**).

### 🆕 Catálogo / Stock v2 (2026-08-01)

- `src/lib/dropea/v2/client.ts` `fetchAllProductsV2` + `DropeaProductV2/DropeaVariantV2`:
  `GET /dropshipper/products` paginado (mismo rate-limit que orders).
- `src/lib/dropea/v2/products.ts`: `mapProductV2` (una fila por variante, fallback
  variant_id=product_id si no hay variantes) + `upsertProducts` (onConflict
  `store_id,dropea_variant_id`).
- `src/app/api/dropea/products/route.ts`: POST sincroniza (market requerido),
  GET lee de la tabla `productos`.
- UI: en `/dashboard/productos`, botón **"Sincronizar catálogo" independiente**
  del sync de pedidos + `CatalogTable` (producto, variante, sku, precio, stock
  con colores, estado).
- **Imágenes: descartadas (2026-08-01).** La API pública v2 no expone ningún
  campo de media ni endpoint (confirmado en `Product`/`ProductVariant` y en el
  listado de rutas del OpenAPI). El URL `https://pt.api.dropea.com/api/media/
  file/product/{id}/{fileId}` del dashboard es público sin auth, pero sus claves
  son internas: `{id}` es un ObjectId de Mongo (timestamp 2026-06-10, no
  derivable del `id` numérico, p.ej. producto 88 → `6a2996d363016bb2fe72ee2c`)
  y `{fileId}` un UUID aleatorio por archivo; además `pt.api.dropea.com/api/*`
  con la x-api-key del dropshipper responde `MISSING_TOKEN`. Sin relación
  explotable → `stock_snapshots.image` queda a null (celda placeholder), página
  más liviana.
- El catálogo NO se actualiza por webhook (no hay topic de stock) → botón manual.

### 🆕 Webhooks v2 — receptor implementado (2026-08-01)

- `src/app/api/dropea/webhook/route.ts`: verifica `X-Dropea-Signature`
  (hmac-sha256 del raw body con `DROPEA_V2_WEBHOOK_SECRET`), acepta topics
  `order.created` / `order.status.changed` / `order.cancelled`, localiza la
  tienda por `market`, mapea con `mapOrderV2` y hace upsert a `pedidos`.
  Acks los topics `issue.*` (pendiente de negocio). Respuesta <5s.
- `src/lib/dropea/v2/upsert.ts`: `upsertOrders` compartido entre sync y webhook.
- **Registro**: `POST {market}.public-api.dropea.com/dropshipper/webhooks`
  (Bearer v2) con `{topic, url}` por API Key. El secreto de firma se muestra
  UNA vez al crear la API Key → requiere la env var `DROPEA_V2_WEBHOOK_SECRET`
  **en Vercel** (no solo en `.env.local`).
- El sobre v2 no trae `previous_state` → para transiciones se cachea el último
  `status` por `resource_id` (ya lo tenemos en `pedidos.status`).

### 🆕 Sync de pedidos v2 — implementado para tiendas con `market` (2026-08-01)

- `src/lib/dropea/v2/client.ts`: cliente REST v2 (Bearer, host `{market}.public-api.dropea.com`,
  `payment_method=COD`, `date_type=created_at`, paginación `has_next_page`, 429 → `Retry-After`,
  throttle ~1 req/s por rate limit 60/min).
- `src/lib/dropea/v2/status.ts`: flags v2 + `computeNetoV2` (fórmula validada, redondeo 2 decimales)
  + `mapOrderV2` (neto con `getMarketCosts`). **`dropea_id` se guarda como string** (columna text).
- `src/app/api/sync/route.ts`: branch por `store.market` → v2 (NutrexPortugal) o v1 fallback (ES).
  El "48h" en v2 usa `getDateRangeDaysV2(15)` por `created_at` (no existe `UPDATED_AT`).
- **Validado contra la API real** (12 pedidos): neto 16475=26.00 ✓, 1095=18.75 ✓, flags
  PENDING→venta 0, FINISH/CANCELLED→cancelado+venta 0, SHIPPING→enviado, FINISH/DELIVERED→entregado.
- Pendiente si la cuenta llega a tener >1 shop: filtrar `store_id` de Dropea en GET /orders
  (hoy la cuenta solo tiene el shop 1642).
- El stock (stock_snapshots por variante) NO está implementado aún; solo pedidos.

### ⚠️ Costes NO expuestos por la API — tabla POR MERCADO (¡crítico!)

El envío y el fee COD **varían por mercado** (y probablemente por carrier/servicio).
No asumir los valores de PT en tiendas ES/IT. Tabla a rellenar y mantener:

| Mercado | Carrier/servicio | ENVIO | COD_FEE | Fuente | Estado |
|---|---|---|---|---|---|
| PT | CTT / PM | 3.50 € | 1.00 € | Dashboard `#NSPT-1091` + `#NSPT-1095` (2026-08-01) | ✅ validado (2/2) |
| ES | GLS / 1\|2 | 5.88 € | 1.20 € | Dashboard `#IB20938` (2026-08-03, desglose pegado por el usuario) | ✅ validado (1/1) |
| IT | ? | ? | ? | Pendiente (sin tienda IT por ahora) | ⏳ |

**Situación ES (2026-08-03):** v2 **YA está activa en ES**. IBericaStore migrada a v2
(`market=ES`, `dropea_shop_id=733`, API key v2 ES + webhook secret cifrados en la tienda).
Sondeo ES: 6/6 endpoints 200, cuenta con 5 shops (Smud, Vittaora Portugal, TodoModa y dos
IBericaStore). El sync **NO filtra por shop**: trae todos los pedidos de la cuenta Dropea
(necesario porque el usuario crea shops nuevos bajo la misma cuenta). `order_costs` ES difiere
de PT: `fulfillment_outbound=1`, `fulfillment_quantity_cost=0`, `fulfillment_return=1` (plano).
Validación neto ES con `#IB20938`: 29.90 − 6.60 − 1.00 − 5.88 − 1.20 = **15.22** ✓.
**Webhook ES bloqueado (Dropea side):** POST `/dropshipper/webhooks` con la key ES devuelve
409 `IN_PROGRESS` incluso con URLs de prueba (httpbin), mientras la key PT registra OK → operación
async atascada en el backend de Dropea para esa key. Vigilar/reintentar; el sync v2 funciona igual.

**Implicación de diseño:** como la API no da estos valores, deben ser **configurables por tienda**
(siguiendo el patrón existente de `fee_gestion_eur`/`costo_rechazo`: columnas en `stores`,
editables en Settings, con default según mercado). Añadir a §6 cuando se implemente:
columnas `coste_envio`/`coste_cod` (o similar) + selector de mercado (ES/PT/IT) en la tienda.
Además `fulfillment_outbound`/`fulfillment_quantity_cost` SÍ vienen por pedido en `order_costs`
(PT: 1.5 + 0.15/ud extra; **ES: 1.00 fijo + 0.00/ud** — verificar otros mercados/carriers al migrar).
  - ⏳ `order_costs` aparece también en CANCELLED (parece presupuestado, no cargado) → decidir
    en implementación si el neto de cancelados se calcula igual o se ignora (¿qué hacía v1?).
- **Products**: 19 productos (PUBLIC del catálogo + EXCLUSIVE propios — el vendido es `[131]` EXCLUSIVE).
  Stock por variante confirmado. **Sin `image`** (ni ningún campo de media): las claves son solo
  `id, name, status, owner_id, created_at, updated_at, variants[]`.
- **Carriers PT**: CTT con servicio `PM` "24 horas" activo y default.

### Pendiente tras el sondeo

1. ~~Validar fórmula del neto~~ → **HECHO en PT** (26.00€ y 18.75€, 2/2 ✓). Vigilar comisión
   Dropea en productos PUBLIC (0 en EXCLUSIVE) y rellenar tabla ES/IT cuando activen v2.
2. ~~¿v1 GraphQL y wallet vieja siguen vivas?~~ → **RESUELTO (2026-08-01): TODA v1 está caída.**
   Probado con credenciales reales de IBericaStore (`scripts/probe-v1-alive.mjs`):
   - GraphQL: HTTP 403 `MAINTENANCE_V2_MIGRATION` — "La API GraphQL está temporalmente deshabilitada".
   - REST vieja (`/api/login`, wallet): HTTP 403 mismo código — "El acceso está temporalmente deshabilitado".
   - Consecuencia: **syncs de IBericaStore/Nutrex rotos hasta que v2 active en ES** (o v1 vuelva,
     cosa que el mensaje "temporalmente" deja abierta). El usuario lo confirma: no hay apuro, esperamos.
   - `ENCRYPTION_KEY` ya está en `.env.local` local (permite descifrar credenciales v1/v2 guardadas).
   - Descubrimiento extra: `https://public-api.dropea.com` (sin prefijo) **enruta por API key**
     (la key PT devuelve su `/me` ahí) y los hosts de mercado ya están desplegados todos:
     `es.public-api.dropea.com` responde (401 "API key revoked" con key PT → keys por mercado).

### 🆕 Wallet v2 — SÍ hay API (interna del dashboard) (2026-08-01)

La REST vieja de wallet está muerta, pero el dashboard v2 usa una **API interna** por mercado
(`{market}.api.dropea.com`) que expone el saldo. **No hace falta scraping de HTML.** Confirmado
con login real de NutrexPortugal (cuenta `user_number 800`, `markets: ["ES","PT"]`):

1. `POST https://pt.api.dropea.com/api/auth/login` `{"email","password"}` →
   `{success, data: {access_token (JWT 48h), refresh_token (20d), expires_in: 1728000, token_type: "Bearer"}}`
   (Keycloak detrás: `iss kc.dropea.com/realms/dropea`).
2. `POST https://pt.api.dropea.com/graphql?op=DashboardWalletSummary` header `Authorization: Bearer <token>`,
   body `{"operationName":"DashboardWalletSummary","variables":{},"query":"query DashboardWalletSummary { dashboardWalletSummary { available_balance currency variation_percentage } }"}`
   → `{data: {dashboardWalletSummary: {available_balance: 26, currency: "EUR", variation_percentage: 0}}}` ✅
3. Alternativa aún más simple: `graphql?op=Me` → `me { available_balance, balance }` (mismos valores).

Otras ops útiles del mismo GraphQL interno (mismo host): `MarketCurrencyConfig` (símbolo/posición),
`SidebarCounters`, `DashboardOrderSummary`, `DashboardOrderStatusDistribution`, etc.

**Implementación wallet (2026-08-01, HECHA para tiendas con `market`):**
- Columna nueva `stores.market` (TEXT, nullable) creada por `rawsql`; NutrexPortugal = `PT`.
- `src/lib/dropea/wallet.ts`: `fetchDropeaWalletV2(email, pwd, market)` → login en
  `{market}.api.dropea.com/api/auth/login` + GraphQL `DashboardWalletSummary`. Login por petición.
- `src/app/api/dropea/wallet/route.ts`: si la tienda tiene `market` usa v2; si no, cae al flujo v1 legacy
  (hoy roto por mantenimiento de Dropea, hasta que ES migre y ponga market).
- Usa las credenciales del dashboard en `stores.dropea_email_encrypted/dropea_pwd_encrypted`.
⚠️ API no documentada → puede cambiar; aislada en `wallet.ts` para poder reemplazarla.
**OJO:** la cuenta tiene mercados `ES` y `PT` → con el mismo login se podría probar `es.api.dropea.com`
cuando v2 llegue a España.
3. ~~Guardar la API key v2 en NutrexPortugal~~ → **HECHO** (usuario la pegó en Settings de la app,
   cifrada server-side, 2026-08-01).
4. **Webhook de prueba** (§7.5): no registrado aún — necesita endpoint receptor público
   (crear `src/app/api/dropea/webhook/route.ts` primero; patrón espejo de `/api/dropi/webhook`).
5. Conseguir un pedido **REFUSED/PAID** real para completar la semántica de estados y el
   `fulfillment_return` (ahora todo 0). Saldrá solo con el tiempo en NutrexPortugal.

### 🆕 España (ES) v2 — migración IBericaStore (2026-08-03)

**Dropea activó v2 en ES.** El usuario creó API key + webhook secret nuevos para la cuenta ES
(ivanlalic@gmail.com) y pegó el desglose del dashboard del pedido `#IB20938` para validar costes.

- **Costes ES (GLS, servicio `1|2`):** ENVIO = **6.20 €**, COD_FEE = **1.20 €**. El envío real del
  dashboard varía por zona (5.88 Madrid vs 6.20 Sevilla) y la API v2 no lo expone → se usa el
  importe mayor (6.20) para no subestimar costes. `order_costs` ES: `fulfillment_outbound=1`,
  `fulfillment_quantity_cost=0`, `fulfillment_return=1` (plano, distinto de PT). Añadido a
  `MARKET_COSTS` en `src/lib/dropea/v2/status.ts`.
- **Cuenta ES = 5 shops** (`/me`): Smud (15271), Vittaora Portugal (6792), TodoModa (3866),
  IBericaStore (733) e IBericaStore (480). El sync **NO filtra por shop** — trae todos los pedidos
  de la cuenta (el usuario crea shops nuevos bajo la misma cuenta y quiere verlos todos).
- **Tienda actualizada en DB:** IBericaStore (`86a08ca2-…`) → `market='ES'`, `dropea_shop_id=733`,
  `dropea_api_key_encrypted` y `dropea_webhook_secret_encrypted` con las credenciales v2 ES.
  En `.env.local`: `DROPEA_V2_API_KEY_ES` + `DROPEA_V2_WEBHOOK_SECRET_ES` (mismas de la tienda).
- **Código:** `MARKET_COSTS.ES`; PUT `/api/stores/[storeId]` acepta `market` + `dropea_webhook_secret`;
  Settings UI añade selector de mercado (ES/PT/IT) + campo webhook secret por tienda.
  El webhook receiver ya usaba el secret por tienda (`dropea_webhook_secret_encrypted`) con
  fallback a la env var.
- **Sondeo ES (probe 2026-08-03):** 6/6 endpoints 200 con la key ES; 100 pedidos analizados;
  neto calculado coherente en todos.
- ⚠️ **Webhook ES bloqueado (Dropea side):** `POST /dropshipper/webhooks` con la key ES devuelve
  409 `ConflictFailure IN_PROGRESS` hasta con URLs de prueba (httpbin), mientras la key PT registra
  bien (201). Parece una operación async atascada en el backend de Dropea para esa key →
  reintentar más tarde / consultar soporte. El sync v2 funciona sin webhooks.
- ✅ **Webhook ES validado end-to-end (2026-08-03):** enviado `#IB20938` firmado (HMAC con
  `DROPEA_V2_WEBHOOK_SECRET_ES`) a `https://stores-steel.vercel.app/api/dropea/webhook` →
  `200 {"ok":true,"added":1}`. Pedido guardado en `pedidos` de IBericaStore con `store_id`
  resuelto por `dropea_shop_id=733` (fallback por `market=ES`). Quedó `PENDING` → venta/neto 0
  (correcto por `shouldZeroRevenueV2`); pasará a neto real al cambiar a `CHARGED`. El receiver
  funciona en producción con la key PT de Dropea entregando los 3 topics (incluye ES).
- ✅ **Neto ES validado con pedido real entregado/cobrado:** `#IB20822` (id 1326931, `FINISH|DELIVERED`)
  → venta 24.90 − wholesale 4.00 − fulfillment 1.00 − envío 5.88 − COD 1.20 = **neto 12.82** ✓
  (confirmado por el usuario contra el dashboard). También se muestran netos coherentes para
  `#IB20562` (17.62), `#IB20554` (20.42), `#IB20544` (17.22), etc. Los pedidos pagados ES usan
  `status=FINISH` + `sub_status=PAID` (no `CHARGED`).
- **Nutrex (ES, `cd4e2aa3-…`)** sigue en v1 sin API key v2 → pendiente de migrar cuando el usuario
  cree key ES para esa tienda (o si comparte cuenta, reutilizar `DROPEA_V2_API_KEY_ES`).

