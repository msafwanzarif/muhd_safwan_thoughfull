# Dev deployment

The dev server is `168.144.103.156`, with the app in `/opt/thoughtfull`.
Nginx routes `thoughtfull.safwanzarif.dev` to frontend port 3001 and preserves
`/api` when proxying to backend port 3000. Both application ports bind only to
localhost. PostgreSQL and Redis have no published ports.

## Releases

Pushes to `main` and manual runs of **Deploy dev** build images on GitHub,
transfer them over SSH, back up the database, migrate, restart the app, and check
both services locally. Brief downtime is possible. Demo data is not seeded.

GitHub requires the `DEPLOY_HOST` variable and the `DEPLOY_SSH_KEY` and
`DEPLOY_KNOWN_HOSTS` secrets. The dedicated Actions key has root access to this
dev droplet; remove its authorized key to revoke access.

The server's `/opt/thoughtfull/.env` contains its generated database password.
Never commit or overwrite this file during updates. Changing that password
requires updating the existing database role too.

## Operations

From `/opt/thoughtfull` on the server:

```sh
docker compose -f compose.production.yaml ps
docker compose -f compose.production.yaml logs --tail 100 api frontend
curl -fsS http://127.0.0.1:3000/api/v1/health
```

Database backups are created before each deployment under `backups/` on the
same droplet. They do not protect against loss of the droplet. Copy important
backups off-server and monitor disk usage. No paid backup service is enabled.
Never run `docker compose down -v` against this stack unless data deletion is
intended.

To roll back code, revert the change in Git and push to `main`. Database
migrations are not reversed automatically; incompatible migrations may require
a database restore and downtime.

## HTTPS

After the domain's A record resolves to this droplet, run:

```sh
certbot --nginx -d thoughtfull.safwanzarif.dev --redirect
certbot renew --dry-run
```

Browser authentication requires HTTPS because session cookies are Secure.
