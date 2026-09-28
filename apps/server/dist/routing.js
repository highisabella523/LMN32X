import { db } from "./db.js";
function decode(row) {
    let ids = [];
    try {
        ids = JSON.parse(row.inbound_ids);
    }
    catch {
        ids = [];
    }
    return {
        id: row.id,
        domain: row.domain,
        inbound_ids: ids,
        kind: row.kind === "ip" ? "ip" : "domain",
        label: row.label || row.domain,
        created_at: row.created_at,
    };
}
export function listRoutingRules() {
    const rows = db
        .prepare("SELECT * FROM routing_rules ORDER BY id DESC")
        .all();
    return rows.map(decode);
}
export function addRoutingRule(domain, inboundIds, kind = "domain", label = "") {
    const info = db
        .prepare("INSERT INTO routing_rules (domain, inbound_ids, kind, label, created_at) VALUES (?, ?, ?, ?, ?)")
        .run(domain.trim(), JSON.stringify(inboundIds), kind, label || domain.trim(), Date.now());
    const row = db
        .prepare("SELECT * FROM routing_rules WHERE id = ?")
        .get(Number(info.lastInsertRowid));
    return decode(row);
}
export function updateRoutingRule(id, inboundIds) {
    db.prepare("UPDATE routing_rules SET inbound_ids = ? WHERE id = ?").run(JSON.stringify(inboundIds), id);
}
export function deleteRoutingRule(id) {
    db.prepare("DELETE FROM routing_rules WHERE id = ?").run(id);
}
export function seedDefaultRouting() {
    const count = db.prepare("SELECT COUNT(*) AS c FROM routing_rules").get().c;
    if (count > 0)
        return;
    addRoutingRule("geosite:category-ads-all", [], "domain", "Ads (all)");
}
