import sys

SYNC_ID = "92653ba8-10cf-4d83-985e-23c7e7ff1539"
STORE_ID = "86a08ca2-32c2-4e9b-abe2-ef8baf1ef47b"

rows = []
for line in sys.stdin:
    parts = line.strip().split('\t')
    if len(parts) < 2:
        continue
    did = parts[0].strip()
    if not did.isdigit():
        continue
    stock_raw = parts[1].strip()
    try:
        stock = int(stock_raw)
    except ValueError:
        stock = 0
    rows.append((did, stock))

print(f"Total rows: {len(rows)}", file=sys.stderr)

BATCH = 300
for i in range(0, len(rows), BATCH):
    batch = rows[i:i+BATCH]
    vals = ",\n".join(
        f"('{SYNC_ID}','{STORE_ID}','{did}',NULL,'ID_{did}',NULL,{stock})"
        for did, stock in batch
    )
    print(f"-- BATCH {i//BATCH + 1}")
    print(f"INSERT INTO stock_snapshots (sync_id,store_id,dropea_id,sku,name,image,stock) VALUES\n{vals};")
