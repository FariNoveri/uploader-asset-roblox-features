const CONSENT_VERSION = "2026-10-06-v3";
const MAX_REQUEST_BYTES = 16 * 1024;
const INSTALL_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
    },
  });
}

function pageResponse(response) {
  const headers = new Headers(response.headers);
  headers.set("cache-control", "no-store");
  headers.set("x-content-type-options", "nosniff");
  headers.set("referrer-policy", "no-referrer");
  headers.set(
    "content-security-policy",
    "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'",
  );
  headers.set("x-frame-options", "DENY");
  return new Response(response.body, { status: response.status, headers });
}

async function readJson(request) {
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > MAX_REQUEST_BYTES) {
    return null;
  }
  const data = await request.arrayBuffer();
  if (data.byteLength > MAX_REQUEST_BYTES) {
    return null;
  }
  try {
    return JSON.parse(new TextDecoder().decode(data));
  } catch {
    return null;
  }
}

async function sha256(value) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function secureTextEqual(left, right) {
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

async function isAdmin(request, env) {
  const expected = env.ADMIN_TOKEN;
  const authorization = request.headers.get("authorization") || "";
  const supplied = authorization.startsWith("Bearer ")
    ? authorization.slice(7)
    : "";
  if (!expected || !supplied || supplied.length > 512) {
    return false;
  }
  const [expectedHash, suppliedHash] = await Promise.all([
    sha256(expected),
    sha256(supplied),
  ]);
  return secureTextEqual(suppliedHash, expectedHash);
}

function validLicenseKey(value) {
  return (
    typeof value === "string" &&
    value.length >= 20 &&
    value.length <= 128 &&
    /^[A-Za-z0-9-]+$/.test(value)
  );
}

function validProfile(data) {
  return (
    data &&
    data.consent === true &&
    data.consentVersion === CONSENT_VERSION &&
    typeof data.installId === "string" &&
    INSTALL_ID_PATTERN.test(data.installId) &&
    typeof data.creatorId === "string" &&
    (data.creatorId === "" || /^\d{1,30}$/.test(data.creatorId)) &&
    typeof data.isGroup === "boolean"
  );
}

function createLicenseKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const value = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("").toUpperCase();
  return "FARI-" + value.match(/.{1,8}/g).join("-");
}

async function validateLicense(request, env) {
  const data = await readJson(request);
  if (!validProfile(data) || !validLicenseKey(data.licenseKey)) {
    return json({ valid: false, error: "Permintaan lisensi atau persetujuan tidak valid." }, 400);
  }

  const keyHash = await sha256(data.licenseKey);
  const license = await env.DB.prepare(
    `SELECT id, active, max_devices, expires_at, creator_id, creator_is_group, profile_locked
     FROM licenses WHERE key_hash = ?`,
  )
    .bind(keyHash)
    .first();
  if (!license || license.active !== 1) {
    return json({ valid: false, error: "Lisensi tidak ditemukan atau sudah dinonaktifkan." }, 403);
  }
  const now = new Date();
  if (Date.parse(license.expires_at) <= now.getTime()) {
    return json({ valid: false, error: "Masa berlaku lisensi sudah habis." }, 403);
  }
  if (
    license.profile_locked === 1 &&
    data.creatorId &&
    (data.creatorId !== license.creator_id ||
      Number(data.isGroup) !== license.creator_is_group)
  ) {
    return json({
      valid: false,
      error: "Lisensi ini sudah terikat ke akun/grup Roblox lain.",
    }, 403);
  }

  const ipAddress = (request.headers.get("cf-connecting-ip") || "").slice(0, 64);
  const timestamp = now.toISOString();
  const activation = await env.DB.prepare(
    `INSERT INTO activations
       (key_hash, install_id, ip_address, creator_id, creator_verified, first_seen, last_seen)
     SELECT ?, ?, ?, ?, 0, ?, ?
     WHERE EXISTS (
       SELECT 1 FROM licenses WHERE key_hash = ? AND active = 1 AND expires_at > ?
     )
       AND (
         EXISTS (
           SELECT 1 FROM activations WHERE key_hash = ? AND install_id = ?
         )
         OR (
           SELECT COUNT(*) FROM activations WHERE key_hash = ?
         ) < ?
       )
     ON CONFLICT(key_hash, install_id) DO UPDATE SET
       ip_address = excluded.ip_address,
       creator_id = excluded.creator_id,
       last_seen = excluded.last_seen`,
  )
    .bind(
      keyHash,
      data.installId,
      ipAddress,
      data.creatorId,
      timestamp,
      timestamp,
      keyHash,
      timestamp,
      keyHash,
      data.installId,
      keyHash,
      license.max_devices,
    )
    .run();
  if (!activation.meta.changes) {
    return json({
      valid: false,
      error: "Batas perangkat lisensi tercapai. Hubungi administrator.",
    }, 403);
  }

  return json({
    valid: true,
    expiresAt: license.expires_at,
    creatorIdVerified: false,
    accountBinding: license.profile_locked === 1
      ? {
          locked: true,
          creatorId: license.creator_id,
          isGroup: license.creator_is_group === 1,
        }
      : { locked: false },
  });
}

async function updateProfile(request, env) {
  const data = await readJson(request);
  if (
    !validProfile(data) ||
    !data.creatorId ||
    !validLicenseKey(data?.licenseKey)
  ) {
    return json({ ok: false, error: "Permintaan profil atau persetujuan tidak valid." }, 400);
  }
  const keyHash = await sha256(data.licenseKey);
  const now = new Date().toISOString();
  const result = await env.DB.prepare(
    `UPDATE licenses
     SET creator_id = CASE WHEN profile_locked = 0 THEN ? ELSE creator_id END,
         creator_is_group = CASE WHEN profile_locked = 0 THEN ? ELSE creator_is_group END,
         profile_locked = 1
     WHERE key_hash = ? AND active = 1 AND expires_at > ?
       AND (profile_locked = 0 OR (creator_id = ? AND creator_is_group = ?))
       AND EXISTS (
         SELECT 1 FROM activations
         WHERE activations.key_hash = licenses.key_hash AND install_id = ?
       )`,
  )
    .bind(
      data.creatorId,
      Number(data.isGroup),
      keyHash,
      now,
      data.creatorId,
      Number(data.isGroup),
      data.installId,
    )
    .run();
  if (!result.meta.changes) {
    const license = await env.DB.prepare(
      "SELECT active, expires_at, creator_id, creator_is_group, profile_locked FROM licenses WHERE key_hash = ?",
    ).bind(keyHash).first();
    if (!license || license.active !== 1 || Date.parse(license.expires_at) <= Date.now()) {
      return json({ ok: false, error: "Lisensi tidak aktif." }, 403);
    }
    if (
      license.profile_locked === 1 &&
      (license.creator_id !== data.creatorId ||
        license.creator_is_group !== Number(data.isGroup))
    ) {
      return json({
        ok: false,
        error: "Data akun terkunci ke Creator ID dan tipe akun pertama. Lisensi ini tidak bisa dipindah ke akun lain.",
      }, 409);
    }
    return json({ ok: false, error: "Aktivasi perangkat tidak ditemukan." }, 403);
  }
  await env.DB.prepare(
    `UPDATE activations
     SET creator_id = ?, ip_address = ?, last_seen = ?
     WHERE key_hash = ? AND install_id = ?`,
  )
    .bind(
      data.creatorId,
      (request.headers.get("cf-connecting-ip") || "").slice(0, 64),
      new Date().toISOString(),
      keyHash,
      data.installId,
    )
    .run();
  return json({
    ok: true,
    creatorIdVerified: false,
    accountBinding: {
      locked: true,
      creatorId: data.creatorId,
      isGroup: data.isGroup,
    },
  });
}

async function createAdminLicense(request, env) {
  const data = await readJson(request);
  if (
    !data ||
    typeof data.label !== "string" ||
    !data.label.trim() ||
    data.label.trim().length > 80 ||
    !Number.isInteger(data.daysValid) ||
    data.daysValid < 1 ||
    data.daysValid > 3650 ||
    !Number.isInteger(data.maxDevices) ||
    data.maxDevices < 1 ||
    data.maxDevices > 20
  ) {
    return json({ error: "Nama, masa berlaku (1–3650 hari), atau batas perangkat tidak valid." }, 400);
  }
  const licenseKey = createLicenseKey();
  const keyHash = await sha256(licenseKey);
  const id = crypto.randomUUID();
  const createdAt = new Date();
  const expiresAt = new Date(
    createdAt.getTime() + data.daysValid * 24 * 60 * 60 * 1000,
  ).toISOString();
  await env.DB.prepare(
    `INSERT INTO licenses (id, key_hash, label, active, max_devices, expires_at, created_at)
     VALUES (?, ?, ?, 1, ?, ?, ?)`,
  )
    .bind(id, keyHash, data.label.trim(), data.maxDevices, expiresAt, createdAt.toISOString())
    .run();
  return json({ id, licenseKey, expiresAt }, 201);
}

async function adminApi(request, env, url) {
  if (!(await isAdmin(request, env))) {
    return json({ error: "Akses admin ditolak." }, 401);
  }
  if (request.method === "GET" && url.pathname === "/api/admin/licenses") {
    const result = await env.DB.prepare(
      `SELECT l.id, l.label, l.active, l.max_devices, l.expires_at, l.created_at,
              (SELECT COUNT(*) FROM activations x WHERE x.key_hash = l.key_hash) AS device_count,
              l.creator_id, l.creator_is_group, l.profile_locked,
              a.install_id, a.ip_address, a.creator_verified,
              a.first_seen, a.last_seen
       FROM licenses l
       LEFT JOIN activations a ON a.key_hash = l.key_hash
       ORDER BY l.created_at DESC, a.last_seen DESC`,
    ).all();
    return json({ licenses: result.results });
  }
  if (request.method === "GET" && url.pathname === "/api/admin/accounts") {
    const result = await env.DB.prepare(
      `SELECT l.id AS license_id, l.label, l.active, l.expires_at, l.profile_locked,
              l.creator_id, l.creator_is_group, a.install_id, a.ip_address,
              a.first_seen, a.last_seen
       FROM licenses l
       LEFT JOIN activations a ON a.key_hash = l.key_hash
       WHERE l.profile_locked = 1
       ORDER BY a.last_seen DESC, l.created_at DESC`,
    ).all();
    return json({ accounts: result.results });
  }
  if (request.method === "POST" && url.pathname === "/api/admin/licenses") {
    return createAdminLicense(request, env);
  }
  const action = url.pathname.match(
    /^\/api\/admin\/licenses\/([0-9a-f-]{36})\/(revoke|activate|delete)$/,
  );
  if (request.method === "POST" && action) {
    if (action[2] === "delete") {
      const license = await env.DB.prepare(
        "SELECT key_hash FROM licenses WHERE id = ?",
      ).bind(action[1]).first();
      if (!license) return json({ error: "Lisensi tidak ditemukan." }, 404);
      await env.DB.batch([
        env.DB.prepare("DELETE FROM activations WHERE key_hash = ?").bind(license.key_hash),
        env.DB.prepare("DELETE FROM licenses WHERE id = ?").bind(action[1]),
      ]);
      return json({ ok: true });
    }
    const result = await env.DB.prepare(
      "UPDATE licenses SET active = ? WHERE id = ?",
    )
      .bind(action[2] === "activate" ? 1 : 0, action[1])
      .run();
    return result.meta.changes
      ? json({ ok: true })
      : json({ error: "Lisensi tidak ditemukan." }, 404);
  }
  const deviceAction = url.pathname.match(
    /^\/api\/admin\/licenses\/([0-9a-f-]{36})\/devices\/([0-9a-f-]{36})\/reset$/,
  );
  if (request.method === "POST" && deviceAction) {
    const license = await env.DB.prepare(
      "SELECT key_hash FROM licenses WHERE id = ?",
    ).bind(deviceAction[1]).first();
    if (!license) return json({ error: "Lisensi tidak ditemukan." }, 404);
    const result = await env.DB.prepare(
      "DELETE FROM activations WHERE key_hash = ? AND install_id = ?",
    ).bind(license.key_hash, deviceAction[2]).run();
    return result.meta.changes
      ? json({ ok: true })
      : json({ error: "Aktivasi perangkat tidak ditemukan." }, 404);
  }
  return json({ error: "Endpoint admin tidak ditemukan." }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname === "/admin" || url.pathname === "/admin/") {
        const response = await env.ASSETS.fetch(
          new Request(new URL("/admin.html", request.url)),
        );
        return pageResponse(response);
      }
      if (url.pathname === "/admin/accounts" || url.pathname === "/admin/accounts/") {
        const response = await env.ASSETS.fetch(
          new Request(new URL("/accounts.html", request.url)),
        );
        return pageResponse(response);
      }
      if (url.pathname === "/api/license/validate" && request.method === "POST") {
        return await validateLicense(request, env);
      }
      if (url.pathname === "/api/license/profile" && request.method === "POST") {
        return await updateProfile(request, env);
      }
      if (url.pathname.startsWith("/api/admin/")) {
        return await adminApi(request, env, url);
      }
      return json({ error: "Endpoint tidak ditemukan." }, 404);
    } catch (error) {
      console.error("License service request failed:", error);
      return json({ error: "Server lisensi mengalami kesalahan." }, 500);
    }
  },
};
