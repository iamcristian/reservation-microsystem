#!/bin/sh
set -e

echo "[entrypoint] Synchronizing SQLite schema..."
prisma db push --skip-generate

echo "[entrypoint] Starting Next.js standalone server..."
exec node server.js
