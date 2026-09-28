# Lumen 32

Lumen is a Railway-ready Xray control plane with a Material 3 Expressive web
interface. Railway terminates TLS and the Node edge forwards
WebSocket/HTTPUpgrade or XHTTP traffic to private loopback Xray inbounds.

## Protocols

The default clean installation creates:

- VLESS / WebSocket
- VLESS / XHTTP
- VLESS / HTTPUpgrade
- VMess / WebSocket
- Trojan / WebSocket

All Xray ports bind to `127.0.0.1`; only the application `$PORT` is public.

## Per-user exit routing

Every user can use `direct`, one exact managed proxy, or one custom
`http://`, `https://`, or `socks5://` proxy.

The Xray rule matches the authenticated user identity. A missing managed proxy
is routed to `blackhole`; it never falls back to direct egress. Credentials
remain server-side and the generated Xray configuration is mode `0600`.

Configure a managed catalog with one of:

```env
LUMEN_PROXY_CATALOG_JSON=[{"id":"de-1","name":"Frankfurt","country":"Germany","code":"DE","endpoint":"socks5://user:pass@host:1080"}]
LUMEN_PROXY_CATALOG_FILE=/data/proxies.json
LUMEN_PROXY_CATALOG_URL=https://private.example/proxies.json
LUMEN_PROXY_CATALOG_TOKEN=optional-bearer-token
```

The remote URL must use HTTPS. Browser responses expose only ID, label,
country and scheme—never endpoint credentials.

## Railway

1. Deploy with the included `Dockerfile`.
2. Generate a public domain.
3. Mount a persistent volume at `/data`.
4. Set a strong `JWT_SECRET`.
5. Open `/setup` and create the owner.

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `8080` | Public Railway application port |
| `LUMEN_DATA_DIR` | `/data` in Docker | Database, Xray binary and config |
| `JWT_SECRET` | generated and persisted | Session signing secret |
| `PUBLIC_DOMAIN` | Railway domain | Subscription hostname override |
| `XRAY_VERSION` | `v26.9.9` | Xray-core release |
| `XRAY_API_PORT` | `10085` | Private Xray stats API |
| `XRAY_INBOUND_BASE_PORT` | `20000` | First private inbound port |

## Subscription formats

- Base64: `/sub/{token}`
- Clash/Mihomo: `/sub/{token}/clash`
- sing-box: `/sub/{token}/singbox`
- Browser page: `/sub/{token}`

See `VERIFICATION.md` for data-plane and build checks.

Required upstream attribution is retained in `THIRD-PARTY-NOTICES.md`,
runtime metadata and embedded source notices.