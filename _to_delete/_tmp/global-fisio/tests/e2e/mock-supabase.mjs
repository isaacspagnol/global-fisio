/**
 * Mock mínimo do Supabase (GoTrue + PostgREST) para os testes E2E.
 * Implementa apenas o que o app usa: login por senha, getUser,
 * select/insert/update/delete com filtros básicos e embeds.
 *
 * Uso: node tests/e2e/mock-supabase.mjs  (porta 54321)
 */
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";

const PORT = 54321;
const EMAIL = "fisio@teste.com";
const PASSWORD = "senha123";
const TOKEN = "mock-access-token";

const USER = {
  id: "00000000-0000-4000-8000-000000000001",
  aud: "authenticated",
  role: "authenticated",
  email: EMAIL,
  email_confirmed_at: new Date().toISOString(),
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {},
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// ---------------------------------------------------------------- DB
const db = {
  patients: [
    {
      id: "11111111-1111-4111-8111-111111111111",
      full_name: "Paciente Exemplo",
      birth_date: "1980-05-10",
      phone: "45 99999-0000",
      email: null,
      cpf: "123.456.789-00",
      health_insurance: "Unimed",
      insurance_number: "0001",
      diagnosis: "Pós-operatório LCA joelho direito",
      referring_doctor: "Dr. Carlos",
      notes: null,
      status: "ativo",
      created_at: "2026-08-01T12:00:00Z",
    },
  ],
  exercises: [
    {
      id: "22222222-2222-4222-8222-222222222221",
      name: "Agachamento livre",
      category: "fortalecimento",
      description: "Agachamento com peso corporal",
      measurement_type: "series_reps",
      default_sets: 3,
      default_reps: 15,
      default_duration_seconds: null,
      active: true,
      created_at: "2026-08-01T12:00:00Z",
    },
    {
      id: "22222222-2222-4222-8222-222222222222",
      name: "Alongamento de panturrilha",
      category: "alongamento",
      description: null,
      measurement_type: "series_tempo",
      default_sets: 3,
      default_reps: 1,
      default_duration_seconds: 30,
      active: true,
      created_at: "2026-08-01T12:00:00Z",
    },
    {
      id: "22222222-2222-4222-8222-222222222223",
      name: "Bicicleta ergométrica",
      category: "condicionamento",
      description: null,
      measurement_type: "cardio",
      default_sets: 1,
      default_reps: 1,
      default_duration_seconds: 600,
      active: true,
      created_at: "2026-08-01T12:00:00Z",
    },
  ],
  appointments: [],
  sessions: [],
  session_exercises: [],
  documents: [],
  therapist_profile: [],
};

const EMBEDS = {
  appointments: { patients: { table: "patients", type: "one", fk: "patient_id" } },
  sessions: {
    session_exercises: { table: "session_exercises", type: "many", fk: "session_id" },
  },
  session_exercises: {
    exercises: { table: "exercises", type: "one", fk: "exercise_id" },
  },
  documents: {},
  patients: {},
  exercises: {},
  therapist_profile: {},
};

// ------------------------------------------------------- select parser
function splitTop(str) {
  const parts = [];
  let depth = 0, cur = "";
  for (const ch of str) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      parts.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

function parseSelect(sel) {
  // retorna [{name, inner}] — inner null p/ colunas simples
  return splitTop(sel).map((p) => {
    const m = p.match(/^([\w-]+)\((.*)\)$/s);
    if (m) return { name: m[1], inner: m[2] };
    return { name: p, inner: null };
  });
}

function projectRow(table, row, sel) {
  if (!sel || sel === "*") sel = "*";
  const parts = parseSelect(sel);
  const hasStar = parts.some((p) => p.name === "*");
  const out = hasStar ? { ...row } : {};
  for (const p of parts) {
    if (p.name === "*") continue;
    if (p.inner !== null) {
      const emb = EMBEDS[table]?.[p.name];
      if (!emb) { out[p.name] = null; continue; }
      if (emb.type === "one") {
        const target = db[emb.table].find((r) => r.id === row[emb.fk]);
        out[p.name] = target ? projectRow(emb.table, target, p.inner) : null;
      } else {
        out[p.name] = db[emb.table]
          .filter((r) => r[emb.fk] === row.id)
          .map((r) => projectRow(emb.table, r, p.inner));
      }
    } else if (!hasStar) {
      out[p.name] = row[p.name];
    }
  }
  return out;
}

// ------------------------------------------------------------ filters
function coerce(v) {
  if (v === "true") return true;
  if (v === "false") return false;
  return v;
}

function applyFilters(rows, params) {
  let out = rows;
  for (const [key, raw] of params.entries()) {
    if (["select", "order", "limit", "offset", "on_conflict", "columns"].includes(key)) continue;
    const m = raw.match(/^(eq|neq|gte|lte|gt|lt|ilike|like|is)\.(.*)$/s);
    if (!m) continue;
    const [, op, valRaw] = m;
    const val = coerce(valRaw);
    out = out.filter((r) => {
      const cell = r[key];
      switch (op) {
        case "eq": return String(cell) === String(val);
        case "neq": return String(cell) !== String(val);
        case "gte": return String(cell) >= String(val);
        case "lte": return String(cell) <= String(val);
        case "gt": return String(cell) > String(val);
        case "lt": return String(cell) < String(val);
        case "is": return valRaw === "null" ? cell === null : Boolean(cell) === val;
        case "ilike":
        case "like": {
          const pattern = String(val).replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/%/g, ".*");
          return new RegExp(`^${pattern}$`, "i").test(String(cell ?? ""));
        }
        default: return true;
      }
    });
  }
  return out;
}

function applyOrder(rows, params) {
  const orders = params.getAll("order").flatMap((o) => o.split(","));
  if (orders.length === 0) return rows;
  const specs = orders.map((o) => {
    const [col, dir] = o.split(".");
    return { col, desc: dir === "desc" };
  });
  return [...rows].sort((a, b) => {
    for (const s of specs) {
      const av = a[s.col], bv = b[s.col];
      if (av === bv) continue;
      const cmp = String(av) < String(bv) ? -1 : 1;
      return s.desc ? -cmp : cmp;
    }
    return 0;
  });
}

// ------------------------------------------------------------- server
function json(res, status, body, headers = {}) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "*",
    "access-control-allow-methods": "*",
    "access-control-expose-headers": "content-range",
    ...headers,
  });
  res.end(data);
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString();
  try { return raw ? JSON.parse(raw) : null; } catch { return null; }
}

const sessionResponse = () => ({
  access_token: TOKEN,
  token_type: "bearer",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: "mock-refresh-token",
  user: USER,
});

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "*",
      "access-control-allow-methods": "*",
    });
    return res.end();
  }

  // ---------------- Auth (GoTrue)
  if (url.pathname === "/auth/v1/token") {
    const grant = url.searchParams.get("grant_type");
    const body = await readBody(req);
    if (grant === "password") {
      if (body?.email === EMAIL && body?.password === PASSWORD) {
        return json(res, 200, sessionResponse());
      }
      return json(res, 400, {
        error: "invalid_grant",
        error_description: "Invalid login credentials",
        error_code: "invalid_credentials",
        code: 400, msg: "Invalid login credentials",
      });
    }
    if (grant === "refresh_token") return json(res, 200, sessionResponse());
    return json(res, 400, { error: "unsupported_grant_type" });
  }
  if (url.pathname === "/auth/v1/user" && req.method === "GET") {
    const auth = req.headers.authorization ?? "";
    if (auth === `Bearer ${TOKEN}`) return json(res, 200, USER);
    return json(res, 401, { code: 401, msg: "invalid JWT" });
  }
  if (url.pathname === "/auth/v1/logout") {
    res.writeHead(204, { "access-control-allow-origin": "*" });
    return res.end();
  }

  // ---------------- REST (PostgREST)
  const rest = url.pathname.match(/^\/rest\/v1\/(\w+)$/);
  if (rest) {
    const table = rest[1];
    if (!(table in db)) return json(res, 404, { message: `table ${table} not found` });
    const sel = url.searchParams.get("select") ?? "*";
    const wantsObject = (req.headers.accept ?? "").includes("pgrst.object");
    const prefer = req.headers.prefer ?? "";

    if (req.method === "HEAD" || req.method === "GET") {
      let rows = applyFilters(db[table], url.searchParams);
      rows = applyOrder(rows, url.searchParams);
      const limit = url.searchParams.get("limit");
      if (limit) rows = rows.slice(0, Number(limit));
      const projected = rows.map((r) => projectRow(table, r, sel));
      const headers = {};
      if (prefer.includes("count=")) {
        headers["content-range"] = `0-${Math.max(projected.length - 1, 0)}/${projected.length}`;
      }
      if (req.method === "HEAD") {
        res.writeHead(200, {
          "content-type": "application/json",
          "access-control-allow-origin": "*",
          "access-control-expose-headers": "content-range",
          ...headers,
        });
        return res.end();
      }
      if (wantsObject) {
        if (projected.length === 0) {
          return json(res, 406, { code: "PGRST116", message: "0 rows" });
        }
        return json(res, 200, projected[0], headers);
      }
      return json(res, 200, projected, headers);
    }

    if (req.method === "POST") {
      const body = await readBody(req);
      const rows = (Array.isArray(body) ? body : [body]).map((r) => ({
        id: randomUUID(),
        created_at: new Date().toISOString(),
        ...defaultsFor(table),
        ...r,
      }));
      db[table].push(...rows);
      const projected = rows.map((r) => projectRow(table, r, sel));
      if (prefer.includes("return=representation")) {
        return json(res, 201, wantsObject ? projected[0] : projected);
      }
      res.writeHead(201, { "access-control-allow-origin": "*" });
      return res.end();
    }

    if (req.method === "PATCH") {
      const body = await readBody(req);
      const targets = applyFilters(db[table], url.searchParams);
      for (const t of targets) Object.assign(t, body);
      if (prefer.includes("return=representation")) {
        return json(res, 200, targets.map((r) => projectRow(table, r, sel)));
      }
      res.writeHead(204, { "access-control-allow-origin": "*" });
      return res.end();
    }

    if (req.method === "DELETE") {
      const targets = new Set(applyFilters(db[table], url.searchParams).map((r) => r.id));
      db[table] = db[table].filter((r) => !targets.has(r.id));
      res.writeHead(204, { "access-control-allow-origin": "*" });
      return res.end();
    }
  }

  json(res, 404, { message: `mock: rota não implementada ${req.method} ${url.pathname}` });
});

function defaultsFor(table) {
  switch (table) {
    case "patients": return { status: "ativo", notes: null };
    case "appointments": return { status: "agendado", duration_min: 60, notes: null };
    case "sessions": return { general_notes: null, appointment_id: null };
    case "session_exercises": return { load_kg: null, duration_seconds: null, speed_kmh: null, distance_m: null, incline_pct: null, notes: null };
    case "exercises": return { active: true, description: null, measurement_type: "series_reps", default_duration_seconds: null };
    default: return {};
  }
}

server.listen(PORT, () => {
  console.log(`Mock Supabase ouvindo em http://127.0.0.1:${PORT}`);
});
