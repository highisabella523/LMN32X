# Lumen 32 verification

- Fresh setup and authenticated API: passed
- Xray lifecycle: passed with Xray `v26.9.9`
- VLESS / WebSocket: passed
- VLESS / XHTTP: passed
- VLESS / HTTPUpgrade: passed
- VMess / WebSocket: passed
- Trojan / WebSocket: passed
- Exact custom HTTP CONNECT outbound: passed
- Dead exact proxy fail-closed (no direct fallback): passed
- Managed catalog endpoint/credential redaction: passed
- Missing managed proxy fail-closed: passed
- Legacy database migration: passed
- TypeScript typecheck: passed
- Production web/server build: passed
- First-run DOM at desktop and mobile widths: passed

## Data-plane matrix

| Client protocol | Transport | Result |
| --- | --- | --- |
| VLESS | WebSocket | PASS |
| VLESS | XHTTP | PASS |
| VLESS | HTTPUpgrade | PASS |
| VMess | WebSocket | PASS |
| Trojan | WebSocket | PASS |

The matrix was exercised end-to-end with a real Xray client through the
application edge to `example.com`. The HTTP proxy test also confirmed that the
selected exact proxy received the outbound `CONNECT`, then confirmed that
traffic failed when that proxy was stopped rather than leaking through direct
egress.