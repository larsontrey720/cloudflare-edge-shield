import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

// Cloudflare Credentials
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const ACCOUNT_ID = process.env.ACCOUNT_ID;
const DB_ID = process.env.DB_ID;
const WORKER_NAME = process.env.WORKER_NAME || "edge-shield-gateway";

if (!CLOUDFLARE_API_TOKEN || !ACCOUNT_ID || !DB_ID) {
  console.warn("CRITICAL: Cloudflare credentials (TOKEN, ACCOUNT_ID, DB_ID) are missing from .env.");
}

// Middleware
app.use(express.json());

// Helper function to query Cloudflare D1
async function queryD1(sql: string, params: any[] = []) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DB_ID}/query`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sql, params }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Cloudflare D1 Query Failed: ${text}`);
  }

  const data = await res.json() as any;
  if (!data.success) {
    throw new Error(`Cloudflare D1 Query Error: ${JSON.stringify(data.errors)}`);
  }

  return data.result[0];
}

// 1. Get Cloudflare Subdomain & Worker URL
app.get("/api/cloudflare/subdomain", async (req, res) => {
  try {
    const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/workers/subdomain`;
    const cfRes = await fetch(url, {
      headers: {
        Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
      },
    });

    if (!cfRes.ok) {
      return res.json({ subdomain: null, url: `https://${WORKER_NAME}.workers.dev` });
    }

    const data = await cfRes.json() as any;
    if (data.success && data.result) {
      const subdomain = data.result.subdomain;
      return res.json({
        subdomain,
        url: `https://${WORKER_NAME}.${subdomain}.workers.dev`,
      });
    }

    return res.json({ subdomain: null, url: `https://${WORKER_NAME}.workers.dev` });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. Query Request Logs from D1
app.get("/api/cloudflare/logs", async (req, res) => {
  try {
    const result = await queryD1("SELECT * FROM request_logs ORDER BY id DESC LIMIT 500");
    res.json({ success: true, logs: result.results || [] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. Clear Request Logs
app.post("/api/cloudflare/logs/clear", async (req, res) => {
  try {
    await queryD1("DELETE FROM request_logs");
    res.json({ success: true, message: "Request logs database truncated." });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4. Get Rules
app.get("/api/cloudflare/rules", async (req, res) => {
  try {
    const result = await queryD1("SELECT * FROM rules ORDER BY id DESC");
    res.json({ success: true, rules: result.results || [] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 5. Add Rule
app.post("/api/cloudflare/rules", async (req, res) => {
  try {
    const { path: rulePath, method, response_status, response_headers, response_body } = req.body;
    
    if (!rulePath || !method) {
      return res.status(400).json({ success: false, error: "Path and Method are mandatory rule parameters." });
    }

    await queryD1(
      `INSERT INTO rules (path, method, response_status, response_headers, response_body, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, 1, ?)`,
      [rulePath, method, Number(response_status) || 200, response_headers || "{}", response_body || "{}", new Date().toISOString()]
    );

    res.json({ success: true, message: "Rule successfully registered on Edge Gateway." });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 6. Delete Rule
app.delete("/api/cloudflare/rules/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await queryD1("DELETE FROM rules WHERE id = ?", [Number(id)]);
    res.json({ success: true, message: "Rule deleted successfully." });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 7. Toggle Rule Status (Active/Inactive)
app.put("/api/cloudflare/rules/:id/toggle", async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;
    await queryD1("UPDATE rules SET is_active = ? WHERE id = ?", [is_active ? 1 : 0, Number(id)]);
    res.json({ success: true, message: "Rule state updated." });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 8. Get Configuration
app.get("/api/cloudflare/config", async (req, res) => {
  try {
    const result = await queryD1("SELECT key, value FROM gateway_config");
    const config: Record<string, string> = {};
    if (result.results) {
      for (const row of result.results) {
        config[row.key as string] = row.value as string;
      }
    }
    res.json({ success: true, config });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 9. Update Configuration
app.post("/api/cloudflare/config", async (req, res) => {
  try {
    const { key, value } = req.body;
    if (!key) {
      return res.status(400).json({ success: false, error: "Key is required" });
    }
    await queryD1("INSERT OR REPLACE INTO gateway_config (key, value) VALUES (?, ?)", [key, String(value)]);
    res.json({ success: true, message: `Configuration updated: ${key}` });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 10. Run Custom SQL Statement
app.post("/api/cloudflare/sql", async (req, res) => {
  try {
    const { sql } = req.body;
    if (!sql) {
      return res.status(400).json({ success: false, error: "SQL query statement is required." });
    }

    // Safety check - do not allow dropping databases or crucial sqlite tables
    const sqlUpper = sql.toUpperCase();
    if (sqlUpper.includes("DROP DATABASE")) {
      return res.status(400).json({ success: false, error: "Destructive operations like DROP DATABASE are blocked." });
    }

    const result = await queryD1(sql);
    res.json({ success: true, result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// 11. Custom request simulation client trigger
app.post("/api/cloudflare/simulate", async (req, res) => {
  try {
    const { targetUrl, method, headers, body } = req.body;
    const fetchOptions: RequestInit = {
      method: method || "GET",
      headers: headers || {},
    };

    if (method && method !== "GET" && method !== "HEAD" && body) {
      fetchOptions.body = typeof body === "string" ? body : JSON.stringify(body);
    }

    const simRes = await fetch(targetUrl, fetchOptions);
    const text = await simRes.text();

    let responseJson: any = null;
    try {
      responseJson = JSON.parse(text);
    } catch (e) {}

    res.json({
      success: true,
      status: simRes.status,
      statusText: simRes.statusText,
      headers: Object.fromEntries(simRes.headers.entries()),
      body: responseJson || text,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Start server block
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
