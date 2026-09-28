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
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db, getSetting, setSetting } from "./db.js";
import { config } from "./config.js";
export const ALL_PERMISSIONS = [
    "dashboard",
    "users",
    "inbounds",
    "routing",
    "activity",
    "bot",
    "settings",
];
function toInfo(row) {
    return {
        id: row.id,
        username: row.username,
        role: row.role === "owner" ? "owner" : "admin",
        permissions: row.role === "owner" ? ALL_PERMISSIONS : safeParsePerms(row.permissions),
        dataLimit: row.data_limit,
        createdAt: row.created_at,
    };
}
function safeParsePerms(raw) {
    try {
        const arr = JSON.parse(raw);
        return arr.filter((p) => ALL_PERMISSIONS.includes(p));
    }
    catch {
        return [];
    }
}
export function isSetupDone() {
    return getSetting("setup_done") === "1";
}
export function completeSetup(username, password) {
    const hash = bcrypt.hashSync(password, 10);
    db.prepare("DELETE FROM admins").run();
    db.prepare("INSERT INTO admins (username, password_hash, role, permissions, data_limit, created_at) VALUES (?, ?, 'owner', ?, 0, ?)").run(username, hash, JSON.stringify(ALL_PERMISSIONS), Date.now());
    setSetting("setup_done", "1");
}
export function verifyCredentials(username, password) {
    const admin = db.prepare("SELECT * FROM admins WHERE username = ?").get(username);
    if (!admin)
        return null;
    return bcrypt.compareSync(password, admin.password_hash) ? admin : null;
}
export function getAdminById(id) {
    const row = db.prepare("SELECT * FROM admins WHERE id = ?").get(id);
    return row ? toInfo(row) : null;
}
export function listAdmins() {
    const rows = db.prepare("SELECT * FROM admins ORDER BY id ASC").all();
    return rows.map(toInfo);
}
export function listAdminsWithStats() {
    const rows = db.prepare("SELECT * FROM admins ORDER BY id ASC").all();
    return rows.map((row) => {
        const stat = db
            .prepare("SELECT COALESCE(SUM(up + down), 0) AS used, COUNT(*) AS count FROM users WHERE created_by = ?")
            .get(row.id);
        return { ...toInfo(row), used: stat.used, userCount: stat.count };
    });
}
export function createAdmin(username, password, permissions, dataLimit) {
    const exists = db.prepare("SELECT id FROM admins WHERE username = ?").get(username);
    if (exists)
        return { ok: false, error: "username already exists" };
    const hash = bcrypt.hashSync(password, 10);
    const perms = permissions.filter((p) => ALL_PERMISSIONS.includes(p));
    db.prepare("INSERT INTO admins (username, password_hash, role, permissions, data_limit, created_at) VALUES (?, ?, 'admin', ?, ?, ?)").run(username, hash, JSON.stringify(perms), Math.round(dataLimit * 1024 ** 3), Date.now());
    return { ok: true };
}
export function updateAdmin(id, patch) {
    const row = db.prepare("SELECT * FROM admins WHERE id = ?").get(id);
    if (!row)
        return { ok: false, error: "not found" };
    if (row.role === "owner")
        return { ok: false, error: "cannot modify owner" };
    const perms = patch.permissions !== undefined
        ? JSON.stringify(patch.permissions.filter((p) => ALL_PERMISSIONS.includes(p)))
        : row.permissions;
    const dataLimit = patch.dataLimit !== undefined ? Math.round(patch.dataLimit * 1024 ** 3) : row.data_limit;
    const hash = patch.password ? bcrypt.hashSync(patch.password, 10) : row.password_hash;
    db.prepare("UPDATE admins SET permissions = ?, data_limit = ?, password_hash = ? WHERE id = ?").run(perms, dataLimit, hash, id);
    return { ok: true };
}
export function deleteAdmin(id) {
    const row = db.prepare("SELECT role FROM admins WHERE id = ?").get(id);
    if (!row)
        return { ok: false, error: "not found" };
    if (row.role === "owner")
        return { ok: false, error: "cannot delete owner" };
    db.prepare("DELETE FROM admins WHERE id = ?").run(id);
    return { ok: true };
}
export function changeCredentials(adminId, currentPassword, newUsername, newPassword) {
    const admin = db.prepare("SELECT * FROM admins WHERE id = ?").get(adminId);
    if (!admin)
        return { ok: false, error: "no admin" };
    if (!bcrypt.compareSync(currentPassword, admin.password_hash))
        return { ok: false, error: "current password incorrect" };
    const username = newUsername?.trim() || admin.username;
    if (username !== admin.username) {
        const clash = db.prepare("SELECT id FROM admins WHERE username = ? AND id != ?").get(username, adminId);
        if (clash)
            return { ok: false, error: "username already exists" };
    }
    const hash = newPassword ? bcrypt.hashSync(newPassword, 10) : admin.password_hash;
    // Bump token_version so every existing session for this admin is invalidated.
    db.prepare("UPDATE admins SET username = ?, password_hash = ?, token_version = token_version + 1 WHERE id = ?").run(username, hash, admin.id);
    return { ok: true };
}
export function signToken(admin) {
    const row = db.prepare("SELECT token_version FROM admins WHERE id = ?").get(admin.id);
    return jwt.sign({ id: admin.id, tv: row?.token_version ?? 0 }, config.jwtSecret, {
        expiresIn: "7d",
    });
}
export function authGuard(req, res, next) {
    const token = req.cookies?.sr_token || req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
        res.status(401).json({ error: "unauthorized" });
        return;
    }
    try {
        const payload = jwt.verify(token, config.jwtSecret);
        const row = db.prepare("SELECT token_version FROM admins WHERE id = ?").get(payload.id);
        const admin = getAdminById(payload.id);
        if (!admin || !row || (payload.tv ?? 0) !== row.token_version) {
            res.status(401).json({ error: "unauthorized" });
            return;
        }
        req.admin = admin;
        next();
    }
    catch {
        res.status(401).json({ error: "unauthorized" });
    }
}
export function requirePermission(perm) {
    return (req, res, next) => {
        if (!req.admin) {
            res.status(401).json({ error: "unauthorized" });
            return;
        }
        if (req.admin.role === "owner" || req.admin.permissions.includes(perm)) {
            next();
            return;
        }
        res.status(403).json({ error: "forbidden" });
    };
}
export function requireOwner(req, res, next) {
    if (req.admin?.role === "owner") {
        next();
        return;
    }
    res.status(403).json({ error: "owner only" });
}
