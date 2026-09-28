import { nanoid } from "nanoid";
import { db } from "./db.js";
import { config } from "./config.js";
const SEED_INBOUNDS = [
    { tag: "VLESS-WS", protocol: "vless", transport: "ws" },
    { tag: "VLESS-XHTTP", protocol: "vless", transport: "xhttp" },
    { tag: "VMess-WS", protocol: "vmess", transport: "ws" },
    { tag: "Trojan-WS", protocol: "trojan", transport: "ws" },
    { tag: "VLESS-HTTPUpgrade", protocol: "vless", transport: "httpupgrade" },
];
export function seedInbounds() {
    const count = db.prepare("SELECT COUNT(*) AS c FROM inbounds").get().c;
    if (count > 0)
        return;
    let offset = 0;
    const insert = db.prepare(`INSERT INTO inbounds (tag, protocol, transport, port, path, host, enabled, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?)`);
    for (const s of SEED_INBOUNDS) {
        const port = config.inboundBasePort + offset;
        const path = `/Lumen/${s.transport}-${nanoid(8)}`;
        insert.run(s.tag, s.protocol, s.transport, port, path, "", Date.now());
        offset += 1;
    }
}
export function listInbounds() {
    return db.prepare("SELECT * FROM inbounds ORDER BY id ASC").all();
}
export function listEnabledInbounds() {
    return db
        .prepare("SELECT * FROM inbounds WHERE enabled = 1 ORDER BY id ASC")
        .all();
}
export function getInbound(id) {
    return db.prepare("SELECT * FROM inbounds WHERE id = ?").get(id);
}
export function setInboundEnabled(id, enabled) {
    db.prepare("UPDATE inbounds SET enabled = ? WHERE id = ?").run(enabled ? 1 : 0, id);
}
