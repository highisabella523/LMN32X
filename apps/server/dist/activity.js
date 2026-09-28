import { db } from "./db.js";
export function logActivity(actor, action, detail = "") {
    db.prepare("INSERT INTO activity (ts, actor, action, detail) VALUES (?, ?, ?, ?)").run(Date.now(), actor, action, detail);
}
export function listActivity(limit = 200) {
    return db.prepare("SELECT * FROM activity ORDER BY ts DESC LIMIT ?").all(limit);
}
export function clearActivity() {
    db.exec("DELETE FROM activity");
}
