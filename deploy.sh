#!/bin/sh
set -eu
cd /opt/thoughtfull
dc() { docker compose -f compose.production.yaml "$@"; }
if [ -f release-images.tar.gz ]; then
  docker load -i release-images.tar.gz
  rm release-images.tar.gz
fi
dc up -d --wait postgres redis
mkdir -p backups
chmod 700 backups
dc exec -T postgres pg_dump -U thoughtfull thoughtfull | gzip > "backups/predeploy-$(date +%Y%m%d-%H%M%S).sql.gz"
dc run --rm --no-deps api npm run db:migrate
dc up -d --no-build api frontend
for attempt in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:3000/api/v1/health && curl -fsS -o /dev/null http://127.0.0.1:3001; then
    exit 0
  fi
  sleep 2
done
exit 1
