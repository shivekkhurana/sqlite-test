#!/bin/bash
set -e

# Benchmark Configuration
# Total Reads: 1,048,576 (2^20)
# Total Writes: 131,072 (2^17)
R=1048576
W=131072

echo "Starting Aligned Benchmark Suite"
echo "Target Reads: $R | Target Writes: $W"
echo "---------------------------------------------------"


# === CONCURRENCY SERIES (Fixed Cache: 64MB) ===
# echo "1. Concurrency Series (Fixed Cache: 64MB)"

# echo "[1/13] Running: 2 Workers (1r/1w)..."
# npx tsx src/cli.ts mixedReadWrite -r 1 -w 1 -R $R -W $W -c -64000

# echo "[2/13] Running: 4 Workers (3r/1w)..."
# npx tsx src/cli.ts mixedReadWrite -r 3 -w 1 -R $R -W $W -c -64000

# echo "[3/13] Running: 6 Workers (4r/2w)..."
# npx tsx src/cli.ts mixedReadWrite -r 4 -w 2 -R $R -W $W -c -64000

# echo "[4/13] Running: 8 Workers (6r/2w)..."
# npx tsx src/cli.ts mixedReadWrite -r 6 -w 2 -R $R -W $W -c -64000

# echo "[5/13] Running: 10 Workers (8r/2w)..."
# npx tsx src/cli.ts mixedReadWrite -r 8 -w 2 -R $R -W $W -c -64000

# echo "[6/13] Running: 12 Workers (9r/3w)..."
# npx tsx src/cli.ts mixedReadWrite -r 9 -w 3 -R $R -W $W -c -64000

# echo "[7/13] Running: 14 Workers (11r/3w)..."
# npx tsx src/cli.ts mixedReadWrite -r 11 -w 3 -R $R -W $W -c -64000

# echo "[8/13] Running: 16 Workers (12r/4w)..."
# npx tsx src/cli.ts mixedReadWrite -r 12 -w 4 -R $R -W $W -c -64000

# echo "[9/13] Running: 20 Workers (15r/5w)..."
# npx tsx src/cli.ts mixedReadWrite -r 15 -w 5 -R $R -W $W -c -64000

# echo "[10/13] Running: 24 Workers (18r/6w)..."
# npx tsx src/cli.ts mixedReadWrite -r 18 -w 6 -R $R -W $W -c -64000

# echo "[11/13] Running: 30 Workers (24r/6w)..."
# npx tsx src/cli.ts mixedReadWrite -r 24 -w 6 -R $R -W $W -c -64000

# echo "[12/13] Running: 32 Workers (24r/8w)..."
# npx tsx src/cli.ts mixedReadWrite -r 24 -w 8 -R $R -W $W -c -64000

# echo "[13/13] Running: 64 Workers (48r/16w)..."
# npx tsx src/cli.ts mixedReadWrite -r 48 -w 16 -R $R -W $W -c -64000

# echo ""


# === CACHE SERIES (Fixed Concurrency: 16 Workers) ===
echo "2. Cache Series (10 Workers: 8r/2w)"

# echo "[1/8] Running: 8MB Cache..."
# npx tsx src/cli.ts mixedReadWrite -r 8 -w 2 -R $R -W $W -c -8000

# echo "[2/8] Running: 16MB Cache..."
# npx tsx src/cli.ts mixedReadWrite -r 8 -w 2 -R $R -W $W -c -16000

# echo "[3/8] Running: 32MB Cache..."
# npx tsx src/cli.ts mixedReadWrite -r 8 -w 2 -R $R -W $W -c -32000

# echo "[4/8] Running: 48MB Cache..."
# npx tsx src/cli.ts mixedReadWrite -r 8 -w 2 -R $R -W $W -c -48000

# echo "[5/8] Running: 56MB Cache..."
# npx tsx src/cli.ts mixedReadWrite -r 8 -w 2 -R $R -W $W -c -56000

# echo "[6/8] Running: 64MB Cache..."
# npx tsx src/cli.ts mixedReadWrite -r 8 -w 2 -R $R -W $W -c -64000

# echo "[7/8] Running: 128MB Cache..."
# npx tsx src/cli.ts mixedReadWrite -r 8 -w 2 -R $R -W $W -c -128000

# echo "[8/8] Running: 256MB Cache..."
# npx tsx src/cli.ts mixedReadWrite -r 8 -w 2 -R $R -W $W -c -256000


echo "[9/8] Running: 512MB Cache..."
npx tsx src/cli.ts mixedReadWrite -r 8 -w 2 -R $R -W $W -c -512000


echo "[10/8] Running: 1024MB Cache..."
npx tsx src/cli.ts mixedReadWrite -r 8 -w 2 -R $R -W $W -c -1024000


echo "[11/8] Running: 2048MB Cache..."
npx tsx src/cli.ts mixedReadWrite -r 8 -w 2 -R $R -W $W -c -2048000


echo "[12/8] Running:  4096MB Cache..."
npx tsx src/cli.ts mixedReadWrite -r 8 -w 2 -R $R -W $W -c -4096000

echo "---------------------------------------------------"
echo "Benchmark Suite Complete!"
