#!/bin/sh
set -eu

# Resolve the project root even when invoked from another directory.
cd "$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"

printf '%s\n' 'Rebuilding, migrating and starting containers...'
docker compose up -d --build

printf '%s\n' 'Frontend: http://localhost:3001'
printf '%s\n' 'Swagger: http://localhost:3000/api/docs'
printf '%s\n' 'Following app logs (Ctrl+C stops viewing logs; containers keep running)...'
docker compose logs -f api frontend
