# Third-party notices

## Upstream control-plane implementation

The Xray lifecycle, HTTP edge tunnel, user/inbound model, subscription engine,
traffic accounting and portions of this source are derived from SideRail by
`icubaby`:

https://github.com/icubaby/SideRail

The supplied upstream source identifies itself as proprietary and explicitly
prohibits removing attribution and embedded authorship identifiers. Those
source notices, runtime attribution headers, health metadata and watermarks
are intentionally retained. Lumen branding applies to the product interface
and does not claim authorship of the upstream implementation.

Before redistribution or commercial use, obtain and review the complete
upstream license from its official repository.

## Xray-core

The application downloads and launches Xray-core as a separate process:

https://github.com/XTLS/Xray-core

Redistributors are responsible for Xray-core's applicable license, notice,
source and corresponding-source obligations.

## Lumen additions

The Material 3 interface adaptation and exact per-user HTTP/HTTPS/SOCKS5
outbound routing integration are Lumen additions.