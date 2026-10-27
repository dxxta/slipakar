#!/bin/sh
set -eu

# Run database migrations before starting the application server
npx prisma migrate deploy --config apps/api/prisma.config.ts

# Start the application server
exec node apps/api/dist/server.js
