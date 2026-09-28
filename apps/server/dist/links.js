/**
 * SideRail - Xray-core VPN management panel
 * Copyright (c) 2025 icubaby. All rights reserved.
 * Official repository: https://github.com/icubaby/SideRail
 *
 * Licensed under the SideRail Proprietary License (see LICENSE).
 * Unauthorized selling, white-labeling, or removal of attribution,
 * branding, or the embedded authorship identifiers is prohibited.
 * Watermark: sr-icubaby-2025-9f4c1a7e
 */
import { getSetting } from "./db.js";
function label(inbound) {
    return `Lumen - ${inbound.tag}`;
}
function commonQuery(ctx) {
    const { inbound, user, host } = ctx;
    const q = {
        security: "tls",
        sni: host,
        host,
        fp: user.fingerprint || "chrome",
    };
    q.type = inbound.transport === "xhttp" ? "xhttp" : inbound.transport;
    q.path = inbound.path;
    if (inbound.transport === "ws" || inbound.transport === "httpupgrade") {
        q.alpn = "http/1.1";
        q.headerType = "none";
    }
    else {
        q.alpn = user.alpn || "h2,http/1.1";
    }
    return q;
}
function qs(params) {
    return Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== "")
        .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
        .join("&");
}
function vlessLink(ctx) {
    const { user, address } = ctx;
    const query = qs({ ...commonQuery(ctx), encryption: "none" });
    return `vless://${user.uuid}@${address}:443?${query}#${encodeURIComponent(label(ctx.inbound))}`;
}
function trojanLink(ctx) {
    const { user, address } = ctx;
    const query = qs(commonQuery(ctx));
    return `trojan://${encodeURIComponent(user.password)}@${address}:443?${query}#${encodeURIComponent(label(ctx.inbound))}`;
}
function vmessLink(ctx) {
    const { user, inbound, host, address } = ctx;
    const isXhttp = inbound.transport === "xhttp";
    const obj = {
        v: "2",
        ps: label(inbound),
        add: address,
        port: "443",
        id: user.uuid,
        aid: "0",
        scy: "auto",
        net: isXhttp ? "xhttp" : inbound.transport,
        type: "none",
        host,
        path: inbound.path,
        tls: "tls",
        sni: host,
        alpn: isXhttp ? "h2,http/1.1" : "http/1.1",
        fp: user.fingerprint || "chrome",
    };
    return "vmess://" + Buffer.from(JSON.stringify(obj)).toString("base64");
}
export function buildLink(ctx) {
    switch (ctx.inbound.protocol) {
        case "vless":
            return vlessLink(ctx);
        case "trojan":
            return trojanLink(ctx);
        case "vmess":
            return vmessLink(ctx);
    }
}
function resolveAddress(host) {
    const clean = (getSetting("clean_address") || "").trim();
    return clean || host;
}
export function buildUserLinks(host, user, inbounds) {
    const address = resolveAddress(host);
    return inbounds
        .filter((ib) => ib.enabled && user.inbound_ids.includes(ib.id))
        .map((inbound) => ({
        tag: inbound.tag,
        protocol: inbound.protocol,
        transport: inbound.transport,
        link: buildLink({ host, address, user, inbound }),
    }));
}
