# Pipeline v3 en modo sombra — Documentación

> **ESTADO: V3 VALIDADA (0 diferencias con v2 en solapamiento). MODO SOMBRA ACTIVO.**
> v3 corre en paralelo desde 2026-08-05: escribe en tablas propias, NO toca `pedidos`,
> webhook ni dashboards. Migración definitiva PENDIENTE de decisión del usuario.
>
> **Para retomar este trabajo:** leer este archivo + los archivos en `src/lib/dropea/v3/`
> + `src/app/api/dropea/v3/sync/route.ts`. Scripts locales (`.gitignore`): `scripts/test-v3.mjs`,
> `scripts/compare-v2-v3.mjs`.

---

## 1. Problema que resuelve

El pipeline v2 (webhook + sync → `pedidos`) guarda un snapshot del último estado visto.
Dropea puede **reenviar eventos `order.status.changed` desordenados**; sin un guard, un evento
viejo (p.ej. `DELIVERY_EXCEPTION` del 09/07) machaca una transición más reciente
(p.ej. `REJECTED` del 20/07), dejando pedidos "congelados" como pendientes.

Casos conocidos (validados): #1278338, #1311607 (ES), pedidos que en v2 quedaron `es_rechazado=false`
o con `neto` positivo cuando ya estaban rechazados.

v3 aporta además **historial y recomputabilidad** (el "álbum", no solo la foto polaroid).

## 2. Arquitectura

```
Dropea API v2 (polling manual)  ──►  /api/dropea/v3/sync (SSE)
                                        │
                                        ├──► pedidos_v3      (estado actual + payload + timestamps)
                                        ├──► order_events    (historial append-only, solo cambios reales)
                                        └──► sync_state      (checkpoint por store)
                                      config_v3 (costes versionados, leídos en vez de constantes)
```

- **Webhook v2 sigue intacto** escribiendo en `pedidos`. v3 se alimenta SOLO del sync manual.
- El botón **"Sync v3 (sombra)"** en el dashboard (`src/components/sync-v3-button.tsx`) dispara
  `/api/dropea/v3/sync`; muestra `nuevos · actualizados · ignorados`.

## 3. Tablas nuevas (InsForge / Postgres)

| Tabla | Propósito | Columnas clave |
|---|---|---|
| `pedidos_v3` | Proyección "estado actual" paralela a `pedidos` | igual que `pedidos` + `sub_status`, `dropea_updated_at`, `enviado_at`, `entregado_at`, `rechazado_at`, `cancelado_at`, `payload jsonb`; `UNIQUE(store_id, dropea_id)` |
| `order_events` | Historial de cambios reales | `store_id`, `dropea_id`, `status`, `sub_status`, `dropea_updated_at`, `payload jsonb`, `created_at`; índice `(store_id, dropea_id, dropea_updated_at)` |
| `config_v3` | Costes versionados por mercado | `market`, `envio`, `cod_fee`, `valid_from`; seed PT (3.50/1.00), ES (6.20/1.20) desde 2026-01-01 |
| `sync_state` | Checkpoint por store | `store_id` (pk), `last_synced_at`, `last_full_sync_at` |

Nota: `order_events_id_seq` requirió `GRANT USAGE, SELECT` a `anon, authenticated, project_admin`
(permitido tras un error `permission denied for sequence`).

## 4. Código (todo nuevo, sin tocar v2)

| Archivo | Qué hace |
|---|---|
| `src/lib/dropea/v3/status.ts` | `getConfigsV3()` + `resolveCostsV3(configs, market, fecha)` → coste vigente en esa fecha |
| `src/lib/dropea/v3/map.ts` | `mapOrderV3()` — mismo mapeo que v2 (flags/neto/venta) + `payload` crudo + `dropea_updated_at`. Reutiliza funciones de `v2/status.ts` |
| `src/lib/dropea/v3/upsert.ts` | `upsertOrdersV3()` — **guard `updated_at` centralizado** (ignora eventos obsoletos), timestamps de transición (solo en el momento en que ocurren), append a `order_events` solo cuando la firma cambia, diff por firma para no escribir si no cambia |
| `src/app/api/dropea/v3/sync/route.ts` | Endpoint SSE paralelo: fetch v2 (ventana `created_at` + estados en vuelo) → map v3 → upsert v3. Respuesta `{done, added, updated, skipped}` |

## 5. Cómo se usa (operación)

- **Sync manual por tienda:** dashboard → botón "Sync v3 (sombra)" (o curl autenticado).
- **Validar vs v2:** `node scripts/compare-v2-v3.mjs [storeName] [mes]` (local, lee `.env.local`).
- **Probar la integración completa:** `node scripts/test-v3.mjs` (replica el endpoint; descifra API key).

Rendimiento observado: el barrido de `ERROR` (históricos REJECTED) es el paso pesado del sync
completo y tarda varios minutos en tiendas con miles de pedidos (IBericaStore ~3.9k pedidos v3).

## 6. Hallazgos de la validación (2026-08-05)

- Solapamiento v2↔v3: **0 diferencias** en IBericaStore y NutrexPortugal; 1 en Nutrex ES
  (pedido 1336766: v2 `PROCESSING` vs v3 `SHIPPING` — v3 refleja el estado más nuevo, correcto).
- `order_events` poblado con payload en el 100% de los eventos (verificado).
- `pedidos_v3` poblado para las 3 tiendas: IBericaStore ~3.9k, Nutrex ES ~3.7k, NutrexPortugal 36.
  (v3 solo cubre la ventana `created_at` 2 meses + en vuelo; v2 tiene todo el histórico.)

## 7. Plan de migración definitiva (NO ejecutado aún)

Cuándo: cuando el usuario decida confiar en v3 (recomendado: 1-2 semanas acumulando `order_events`).

Opciones:
1. **Apuntar dashboards a `pedidos_v3`** — cambiar las queries en `src/lib/queries/dashboard.ts`
   (y `dropi-dashboard.ts` NO, eso es Dropi) de `from("pedidos")` a `from("pedidos_v3")`.
2. **Backfill `pedidos` desde `pedidos_v3`** — copiar columnas + flags; el dashboard no cambia.
3. **Retirar v2** tras migrar: botón/endpoint v2, webhook v2 y tablas v2 ya no necesarios.

Requisito previo si se quiere histórico completo en v3: añadir un modo "histórico" al sync v3
(fetch con `months` mayor o re-fetch por estado `FINISH`/`DELIVERED`) — v3 hoy solo tiene la ventana.

## 8. Decisiones tomadas

- **Sin cron**: el sync v3 (y v2) se dispara manualmente; no gastar recursos en programación.
- **`order_events` solo en cambios reales** (firma distinta), no en cada webhook.
- **v3 alimentado solo por sync manual** (el webhook no escribe en v3; aislamiento total).
- **curl/script primero, botón después**: el botón se añadió en el dashboard una vez validado.
