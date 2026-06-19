/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback, FormEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Activity,
  Shield,
  Terminal,
  Database,
  Globe,
  RefreshCw,
  Plus,
  Trash2,
  Play,
  CheckCircle,
  AlertTriangle,
  XCircle,
  MapPin,
  Code,
  Copy,
  Check,
  Lock,
  Unlock,
  FileText,
  Sliders,
  Send,
  HelpCircle,
  Server,
  Fingerprint,
  ChevronRight
} from "lucide-react";

// Interfaces
interface RequestLog {
  id: number;
  method: string;
  url: string;
  headers: string;
  body: string;
  ip: string;
  country: string;
  city: string;
  latitude: string;
  longitude: string;
  status: number;
  timestamp: string;
}

interface GatewayRule {
  id: number;
  path: string;
  method: string;
  response_status: number;
  response_headers: string;
  response_body: string;
  is_active: number;
  created_at: string;
}

interface GatewayConfig {
  api_auth_enabled?: string;
  geo_blocking_enabled?: string;
  blocked_countries?: string;
}

interface SubdomainInfo {
  subdomain: string | null;
  url: string;
}

export default function App() {
  // Theme state is permanently elegant dark terminal theme
  const [activeTab, setActiveTab] = useState<"traffic" | "rules" | "security" | "sql">("traffic");
  
  // Data States
  const [logs, setLogs] = useState<RequestLog[]>([]);
  const [rules, setRules] = useState<GatewayRule[]>([]);
  const [config, setConfig] = useState<GatewayConfig>({});
  const [subdomainInfo, setSubdomainInfo] = useState<SubdomainInfo>({ subdomain: null, url: "" });
  
  // UI States
  const [loading, setLoading] = useState<Record<string, boolean>>({
    logs: false,
    rules: false,
    config: false,
    general: false
  });
  const [selectedLog, setSelectedLog] = useState<RequestLog | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  
  // Form States - Rules
  const [newRule, setNewRule] = useState({
    path: "/api/v1/mock-endpoint",
    method: "GET",
    response_status: 200,
    response_headers: '{\n  "content-type": "application/json"\n}',
    response_body: '{\n  "success": true,\n  "data": "Mock payload live on edge"\n}'
  });
  
  // Form States - Simulation / Tester
  const [simParams, setSimParams] = useState({
    path: "/",
    method: "GET",
    authHeader: "",
    body: '{\n  "test": "webhook"\n}',
    selectedSimulationPreset: "ping"
  });
  const [simResult, setSimResult] = useState<any>(null);
  const [simulating, setSimulating] = useState(false);
  
  // Custom SQL State
  const [sqlQuery, setSqlQuery] = useState("SELECT * FROM request_logs ORDER BY id DESC LIMIT 10;");
  const [sqlHistory, setSqlHistory] = useState<string[]>([
    "SELECT * FROM request_logs ORDER BY id DESC LIMIT 10;",
    "SELECT * FROM rules;",
    "SELECT country, COUNT(*) as volume FROM request_logs GROUP BY country ORDER BY volume DESC;"
  ]);
  const [sqlResult, setSqlResult] = useState<any>(null);
  const [sqlError, setSqlError] = useState<string | null>(null);
  const [sqlLoading, setSqlLoading] = useState(false);

  // Core API Fetch handles
  const fetchLogs = useCallback(async () => {
    setLoading(prev => ({ ...prev, logs: true }));
    try {
      const res = await fetch("/api/cloudflare/logs");
      const data = await res.json();
      if (data.success) {
        setLogs(data.logs);
      }
    } catch (e) {
      console.error("Failed to load logs:", e);
    } finally {
      setLoading(prev => ({ ...prev, logs: false }));
    }
  }, []);

  const fetchRules = useCallback(async () => {
    setLoading(prev => ({ ...prev, rules: true }));
    try {
      const res = await fetch("/api/cloudflare/rules");
      const data = await res.json();
      if (data.success) {
        setRules(data.rules);
      }
    } catch (e) {
      console.error("Failed to load rules:", e);
    } finally {
      setLoading(prev => ({ ...prev, rules: false }));
    }
  }, []);

  const fetchConfig = useCallback(async () => {
    setLoading(prev => ({ ...prev, config: true }));
    try {
      const res = await fetch("/api/cloudflare/config");
      const data = await res.json();
      if (data.success) {
        setConfig(data.config);
      }
    } catch (e) {
      console.error("Failed to load configs:", e);
    } finally {
      setLoading(prev => ({ ...prev, config: false }));
    }
  }, []);

  const fetchSubdomain = useCallback(async () => {
    try {
      const res = await fetch("/api/cloudflare/subdomain");
      const data = await res.json();
      setSubdomainInfo(data);
    } catch (e) {
      console.error("Failed to fetch gateway subdomain details", e);
    }
  }, []);

  // Initialization Hook
  useEffect(() => {
    fetchSubdomain();
    fetchConfig();
    fetchRules();
    fetchLogs();
  }, [fetchSubdomain, fetchConfig, fetchRules, fetchLogs]);

  // Handle configuration updates
  const handleUpdateConfig = async (key: string, value: string) => {
    try {
      const res = await fetch("/api/cloudflare/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value })
      });
      const data = await res.json();
      if (data.success) {
        setConfig(prev => ({ ...prev, [key]: value }));
      }
    } catch (e) {
      console.error("Failed to update config setting", e);
    }
  };

  // Manage Traffic Logs
  const handleClearLogs = async () => {
    if (!confirm("Are you sure you want to completely clear the traffic telemetry database?")) return;
    try {
      const res = await fetch("/api/cloudflare/logs/clear", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setLogs([]);
        setSelectedLog(null);
      }
    } catch (e) {
      console.error("Failed to clear logs", e);
    }
  };

  // Create rules
  const handleCreateRule = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/cloudflare/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newRule)
      });
      const data = await res.json();
      if (data.success) {
        fetchRules();
        // Reset rule form path/body structure safely
        setNewRule(prev => ({
          ...prev,
          path: "/api/v1/mock-" + Math.floor(Math.random() * 1000)
        }));
      } else {
        alert("Failed to submit rule: " + data.error);
      }
    } catch (e: any) {
      alert("Error adding rule: " + e.message);
    }
  };

  // Delete Rule
  const handleDeleteRule = async (id: number) => {
    if (!confirm("Delete this API routing mock rule?")) return;
    try {
      const res = await fetch(`/api/cloudflare/rules/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setRules(prev => prev.filter(r => r.id !== id));
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Toggle Rule Activity
  const handleToggleRule = async (id: number, currentStatus: number) => {
    try {
      const is_active = currentStatus === 1 ? 0 : 1;
      const res = await fetch(`/api/cloudflare/rules/${id}/toggle`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active })
      });
      const data = await res.json();
      if (data.success) {
        setRules(prev => prev.map(r => r.id === id ? { ...r, is_active } : r));
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Execute Simulation Trigger
  const runSimulation = async () => {
    setSimulating(true);
    setSimResult(null);
    try {
      const targetUrl = `${subdomainInfo.url || "https://ai-studio-test-worker.workers.dev"}${simParams.path}`;
      const headers: Record<string, string> = {
        "content-type": "application/json"
      };

      if (simParams.authHeader) {
        headers["Authorization"] = `Bearer ${simParams.authHeader}`;
      }

      const res = await fetch("/api/cloudflare/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUrl,
          method: simParams.method,
          headers,
          body: simParams.method !== "GET" ? simParams.body : undefined
        })
      });

      const data = await res.json();
      setSimResult(data);
      
      // Auto reload logs since simulation just hit the worker!
      setTimeout(() => fetchLogs(), 1500);
    } catch (e: any) {
      setSimResult({ success: false, error: e.message });
    } finally {
      setSimulating(false);
    }
  };

  // Set Preset Traffic
  const applyPresetSim = (preset: string) => {
    const defaultToken = "test-token"; // Default fallback key inside D1 setup

    if (preset === "ping") {
      setSimParams({
        path: "/",
        method: "GET",
        authHeader: "",
        body: "",
        selectedSimulationPreset: "ping"
      });
    } else if (preset === "mock") {
      setSimParams({
        path: "/api/v1/user",
        method: "GET",
        authHeader: "",
        body: "",
        selectedSimulationPreset: "mock"
      });
    } else if (preset === "webhook") {
      setSimParams({
        path: "/webhook-receiver",
        method: "POST",
        authHeader: "",
        body: '{\n  "event": "payment.succeeded",\n  "amount": 9900,\n  "currency": "usd",\n  "userId": "usr_94f285fa"\n}',
        selectedSimulationPreset: "webhook"
      });
    } else if (preset === "authorized_api") {
      setSimParams({
        path: "/api/v1/user",
        method: "GET",
        authHeader: defaultToken,
        body: "",
        selectedSimulationPreset: "authorized_api"
      });
    } else if (preset === "health") {
      setSimParams({
        path: "/shield-health",
        method: "GET",
        authHeader: "",
        body: "",
        selectedSimulationPreset: "health"
      });
    }
  };

  // Run database SQL Console commands
  const runCustomSQL = async (statement?: string) => {
    const queryToRun = statement || sqlQuery;
    if (!queryToRun.trim()) return;

    setSqlLoading(true);
    setSqlError(null);
    setSqlResult(null);

    try {
      const res = await fetch("/api/cloudflare/sql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sql: queryToRun })
      });
      const data = await res.json();
      if (data.success) {
        setSqlResult(data.result);
        if (!sqlHistory.includes(queryToRun)) {
          setSqlHistory(prev => [queryToRun, ...prev].slice(0, 5));
        }
      } else {
        setSqlError(data.error);
      }
    } catch (e: any) {
      setSqlError(e.message);
    } finally {
      setSqlLoading(false);
    }
  };

  // Copy utility
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  // Stats derivations
  const totalRequests = logs.length;
  const successRequests = logs.filter(l => l.status >= 200 && l.status < 300).length;
  const successRate = totalRequests > 0 ? Math.round((successRequests / totalRequests) * 100) : 100;
  const activeRulesCount = rules.filter(r => r.is_active === 1).length;
  const blockedRequests = logs.filter(l => l.status === 403 || l.status === 401).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased overflow-x-hidden border-t-2 border-emerald-500">
      
      {/* Dynamic Header console */}
      <header className="border-b border-slate-900 bg-slate-950/70 backdrop-blur-md sticky top-0 z-40 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 sm:p-2.5 bg-emerald-950/80 border border-emerald-500/30 rounded-lg text-emerald-400 animate-pulse">
              <Shield className="w-5 sm:w-6 h-5 stroke-[1.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display font-bold text-lg sm:text-xl tracking-wide uppercase text-slate-100">
                  Edge Shield Gateway
                </h1>
                <span className="px-2 py-0.5 text-[10px] uppercase font-mono tracking-widest bg-emerald-950 text-emerald-400 border border-emerald-500/20 rounded">
                  Active
                </span>
              </div>
              <p className="text-xs text-slate-500 font-mono tracking-tight mt-0.5">
                Cloudflare Workers & D1 Traffic & Security Operations Station
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Deploy detail indicator */}
            <div className="bg-slate-900/40 border border-slate-800 rounded-lg px-3 py-1.5 flex items-center gap-3 text-xs font-mono max-w-sm">
              <Server className="w-3.5 h-3.5 text-slate-500" />
              <div className="truncate">
                <span className="text-slate-500">Worker URL: </span>
                <a 
                  href={subdomainInfo.url || "#"} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="text-emerald-400 hover:underline hover:text-emerald-300"
                >
                  {subdomainInfo.url ? subdomainInfo.url.replace("https://", "") : "resolving..."}
                </a>
              </div>
            </div>

            <button
              onClick={() => {
                fetchLogs();
                fetchRules();
                fetchConfig();
              }}
              className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 active:border-emerald-500/40 rounded-lg transition-colors flex items-center gap-1.5 text-xs text-slate-300"
              title="Refresh Global Stream"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading.logs || loading.rules ? 'animate-spin text-emerald-400' : ''}`} />
              <span className="hidden sm:inline">Sync</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Panel Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        
        {/* Core Metrics & Telemetry Cards */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900/40 border border-slate-900 rounded-xl p-4 flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-3 text-emerald-500/10 pointer-events-none">
              <Activity className="w-12 h-12" />
            </div>
            <span className="text-[11px] text-slate-500 uppercase font-mono tracking-widest block">Requests Logged</span>
            <div className="mt-2 flex items-baseline gap-2">
              <div className="text-2xl sm:text-3xl font-mono font-bold text-slate-100">{totalRequests}</div>
              <span className="text-xs text-slate-500">total hits</span>
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
              Live telemetry stream
            </div>
          </div>

          <div className="bg-slate-900/40 border border-slate-900 rounded-xl p-4 flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-3 text-emerald-500/10 pointer-events-none">
              <CheckCircle className="w-12 h-12" />
            </div>
            <span className="text-[11px] text-slate-500 uppercase font-mono tracking-widest block">Success Rate</span>
            <div className="mt-2 flex items-baseline gap-2">
              <div className="text-2xl sm:text-3xl font-mono font-bold text-emerald-400">{successRate}%</div>
              <span className="text-xs text-slate-500">2xx codes</span>
            </div>
            <div className="mt-3 text-[10px] text-slate-500 font-mono">
              Healthy response percentage
            </div>
          </div>

          <div className="bg-slate-900/40 border border-slate-900 rounded-xl p-4 flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-3 text-emerald-500/10 pointer-events-none">
              <Code className="w-12 h-12" />
            </div>
            <span className="text-[11px] text-slate-500 uppercase font-mono tracking-widest block">Mock API Mappers</span>
            <div className="mt-2 flex items-baseline gap-2">
              <div className="text-2xl sm:text-3xl font-mono font-bold text-sky-400">{activeRulesCount}</div>
              <span className="text-xs text-slate-500">/ {rules.length} total</span>
            </div>
            <div className="mt-3 text-[10px] text-slate-500 font-mono">
              Intercepting rules on Edge D1
            </div>
          </div>

          <div className="bg-slate-900/40 border border-slate-900 rounded-xl p-4 flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-3 text-emerald-500/10 pointer-events-none">
              <Fingerprint className="w-12 h-12" />
            </div>
            <span className="text-[11px] text-slate-500 uppercase font-mono tracking-widest block">Security Filters</span>
            <div className="mt-2 flex items-baseline gap-2">
              <div className="text-2xl sm:text-3xl font-mono font-bold text-rose-500">{blockedRequests}</div>
              <span className="text-xs text-slate-500">denials</span>
            </div>
            <div className="mt-3 flex items-center gap-2 text-[10px] font-mono">
              <span className={`px-1 py-0.2 rounded ${config.api_auth_enabled === "true" ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/20' : 'bg-slate-900 text-slate-500'}`}>
                Auth: {config.api_auth_enabled === "true" ? "ON" : "OFF"}
              </span>
              <span className={`px-1 py-0.2 rounded ${config.geo_blocking_enabled === "true" ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/20' : 'bg-slate-900 text-slate-500'}`}>
                Geo: {config.geo_blocking_enabled === "true" ? "ON" : "OFF"}
              </span>
            </div>
          </div>
        </section>

        {/* Console Mode Tab Navigator */}
        <section className="flex border-b border-slate-900 text-xs sm:text-sm font-mono tracking-tight bg-slate-950">
          <button
            onClick={() => setActiveTab("traffic")}
            className={`px-4 py-3 flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === "traffic"
                ? "border-emerald-500 text-slate-200 bg-slate-900/30"
                : "border-transparent text-slate-500 hover:text-slate-300"
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            Telemetry Logs
          </button>
          <button
            onClick={() => setActiveTab("rules")}
            className={`px-4 py-3 flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === "rules"
                ? "border-emerald-500 text-slate-200 bg-slate-900/30"
                : "border-transparent text-slate-500 hover:text-slate-300"
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            Mock rules Engine
          </button>
          <button
            onClick={() => setActiveTab("security")}
            className={`px-4 py-3 flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === "security"
                ? "border-emerald-500 text-slate-200 bg-slate-900/30"
                : "border-transparent text-slate-500 hover:text-slate-300"
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            Security Board
          </button>
          <button
            onClick={() => setActiveTab("sql")}
            className={`px-4 py-3 flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === "sql"
                ? "border-emerald-500 text-slate-200 bg-slate-900/30"
                : "border-transparent text-slate-500 hover:text-slate-300"
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            D1 SQL Shell
          </button>
        </section>

        {/* Panel View Display */}
        <AnimatePresence mode="wait">
          
          {/* TAB 1: Live Webhooks & Traffic Inspectors */}
          {activeTab === "traffic" && (
            <motion.div
              key="traffic-panel"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-6"
            >
              
              {/* Traffic Logger list */}
              <div className="lg:col-span-7 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-900 pb-2">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-emerald-400" />
                    <h2 className="font-display font-semibold text-sm uppercase text-slate-200">
                      Real-time Log Feed
                    </h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={fetchLogs}
                      className="text-[11px] font-mono text-slate-400 hover:text-emerald-400 flex items-center gap-1 bg-slate-900 px-2 py-1 rounded border border-slate-800"
                    >
                      <RefreshCw className={`w-3 h-3 ${loading.logs ? 'animate-spin' : ''}`} />
                      Fetch logs
                    </button>
                    <button
                      onClick={handleClearLogs}
                      className="text-[11px] font-mono text-rose-400 hover:text-rose-300 flex items-center gap-1 bg-rose-950/20 px-2 py-1 rounded border border-rose-900/30"
                      disabled={logs.length === 0}
                    >
                      <Trash2 className="w-3 h-3" />
                      Truncate
                    </button>
                  </div>
                </div>

                <div className="bg-slate-900/20 border border-slate-900 rounded-xl overflow-hidden min-h-[450px] max-h-[600px] overflow-y-auto font-mono scrollbar-thin">
                  {logs.length === 0 ? (
                    <div className="h-[400px] flex flex-col items-center justify-center text-center p-6 bg-slate-950/20">
                      <HelpCircle className="w-8 h-8 text-slate-600 mb-2" />
                      <p className="text-xs text-slate-400">No edge requests received yet.</p>
                      <p className="text-[10px] text-slate-600 mt-1 max-w-sm">
                        Use the Simulator client on the right panel to execute a request ping! Your traffic will populate here live.
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-900">
                      {logs.map((log) => {
                        const isSuccess = log.status >= 200 && log.status < 300;
                        const isClientError = log.status >= 400 && log.status < 500;
                        const isServerError = log.status >= 500;
                        return (
                          <div
                            key={log.id}
                            onClick={() => setSelectedLog(log)}
                            className={`p-3.5 hover:bg-slate-900/40 transition-colors cursor-pointer flex items-center justify-between gap-3 text-xs border-l-2 ${
                              selectedLog?.id === log.id 
                                ? 'bg-slate-900/50 border-emerald-500' 
                                : 'border-transparent'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              {/* Status Badge */}
                              <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold text-center w-14 ${
                                isSuccess 
                                  ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/20' 
                                  : isClientError 
                                    ? 'bg-amber-950/80 text-amber-400 border border-amber-500/20'
                                    : 'bg-rose-950/80 text-rose-400 border border-rose-500/20'
                              }`}>
                                {log.status}
                              </span>

                              {/* Method and path */}
                              <div className="min-w-0">
                                <span className={`font-semibold mr-2 ${
                                  log.method === "GET" 
                                    ? 'text-sky-400' 
                                    : log.method === "POST" 
                                      ? 'text-emerald-400' 
                                        : 'text-purple-400'
                                }`}>
                                  {log.method}
                                </span>
                                <span className="text-slate-300 break-all">{new URL(log.url).pathname}</span>
                              </div>
                            </div>

                            {/* Geo country and timestamp */}
                            <div className="flex items-center gap-2.5 text-right flex-shrink-0 text-[10px]">
                              <div className="flex items-center gap-1 text-slate-400">
                                <Globe className="w-3 h-3 text-slate-500" />
                                <span>{log.country || 'US'}</span>
                              </div>
                              <span className="text-slate-500">
                                {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                              </span>
                              <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Traffic simulation client / selected log inspector */}
              <div className="lg:col-span-5 space-y-6">
                
                {/* Visual Radar Tracker (SVG abstract map list of telemetry locations) */}
                <div className="bg-slate-900/30 border border-slate-900 rounded-xl p-4 font-mono space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest block">Geographic Radar Pings</span>
                    <span className="text-[10px] text-slate-600">Active Node: Cloudflare London</span>
                  </div>

                  {/* Abstract radar sweep grid display */}
                  <div className="relative h-24 bg-slate-950 rounded-lg overflow-hidden border border-slate-900 flex items-center justify-center p-2">
                    <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-30"></div>
                    <div className="absolute inset-0 border border-emerald-500/5 rounded-full scale-75 animate-pulse"></div>
                    <div className="absolute inset-0 border border-emerald-500/10 rounded-full scale-50"></div>
                    
                    {/* Render coordinate plots */}
                    {logs.slice(0, 3).map((l, idx) => {
                      const randX = 30 + (idx * 25) % 80;
                      const randY = 20 + (idx * 20) % 60;
                      return (
                        <div
                          key={l.id}
                          className="absolute text-emerald-400 flex items-center gap-1.5 animate-bounce"
                          style={{ left: `${randX}%`, top: `${randY}%` }}
                        >
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                          </span>
                          <span className="text-[8px] bg-slate-950/80 px-1 rounded text-slate-400 font-mono tracking-tighter">
                            {l.country}-{l.city.substring(0,6)}
                          </span>
                        </div>
                      );
                    })}

                    {logs.length === 0 && (
                      <div className="text-[10px] text-slate-600">Waiting for live signal sweeps...</div>
                    )}
                  </div>
                </div>

                {/* Selected Log Inspector or Tester */}
                {selectedLog ? (
                  <div className="bg-slate-900/40 border border-slate-950 p-5 rounded-2xl space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-900 pb-3">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-emerald-400" />
                        <h3 className="text-sm font-display font-bold uppercase text-slate-200">
                          Request Details
                        </h3>
                      </div>
                      <button
                        onClick={() => setSelectedLog(null)}
                        className="text-xs text-slate-500 hover:text-slate-300 font-mono"
                      >
                        [Close]
                      </button>
                    </div>

                    <div className="space-y-3.5 text-xs font-mono">
                      {/* Grid parameters */}
                      <div className="grid grid-cols-2 gap-3.5 bg-slate-950/35 p-3 rounded-lg border border-slate-900">
                        <div>
                          <span className="text-slate-500 block text-[10px] uppercase">Client IP Address</span>
                          <span className="text-slate-300 font-medium">{selectedLog.ip}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[10px] uppercase">Origin Location</span>
                          <span className="text-slate-300 font-medium flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-rose-500" />
                            {selectedLog.city}, {selectedLog.country}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[10px] uppercase">Telemetry Lat/Long</span>
                          <span className="text-slate-400 text-[11px]">
                            {selectedLog.latitude || "N/A"}, {selectedLog.longitude || "N/A"}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[10px] uppercase">Captured At</span>
                          <span className="text-slate-400 text-[11px]">
                            {new Date(selectedLog.timestamp).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {/* Path URLs */}
                      <div>
                        <span className="text-slate-500 block text-[10px] uppercase mb-1">Full Request Endpoint URL</span>
                        <div className="bg-slate-950 p-2 rounded border border-slate-900 text-slate-300 break-all select-all font-mono">
                          {selectedLog.url}
                        </div>
                      </div>

                      {/* Headers */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-slate-500 text-[10px] uppercase">HTTP Headers Captured</span>
                          <button
                            onClick={() => copyToClipboard(selectedLog.headers, 'headers')}
                            className="text-slate-500 hover:text-emerald-400 flex items-center gap-1 text-[10px]"
                          >
                            {copiedText === 'headers' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            <span>Copy JSON</span>
                          </button>
                        </div>
                        <pre className="bg-slate-950/90 text-amber-500/90 p-3 rounded-lg border border-slate-900 text-[10px] overflow-x-auto max-h-36 scrollbar-thin">
                          {JSON.stringify(JSON.parse(selectedLog.headers || "{}"), null, 2)}
                        </pre>
                      </div>

                      {/* Request Body Payload */}
                      <div>
                        <span className="text-slate-500 block text-[10px] uppercase mb-1">Body / Payload Content</span>
                        {selectedLog.body ? (
                          <pre className="bg-slate-950/90 text-emerald-400/90 p-3 rounded-lg border border-slate-900 text-[10.5px] overflow-x-auto max-h-36 scrollbar-thin">
                            {selectedLog.body.startsWith("{") ? (
                              JSON.stringify(JSON.parse(selectedLog.body), null, 2)
                            ) : (
                              selectedLog.body
                            )}
                          </pre>
                        ) : (
                          <div className="p-3 text-center bg-slate-950/40 border border-slate-900 rounded text-slate-500 italic text-[11px]">
                            No request body payload transmitted (payload null)
                          </div>
                        )}
                      </div>

                      {/* Quick simulation runner */}
                      <button
                        onClick={() => {
                          const parsedUrl = new URL(selectedLog.url);
                          setSimParams({
                            path: parsedUrl.pathname,
                            method: selectedLog.method,
                            body: selectedLog.body || '{\n  \n}',
                            authHeader: "",
                            selectedSimulationPreset: "custom"
                          });
                          setActiveTab("traffic");
                          // Scroll to element or notify
                        }}
                        className="w-full bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 py-1.5 rounded-lg text-xs font-medium cursor-pointer flex items-center justify-center gap-2 transition-colors"
                      >
                        <Play className="w-3 h-3 text-emerald-500" />
                        Load Payload into Simulator Clients
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Client traffic REST simulator console */
                  <div className="bg-slate-900/40 border border-slate-950 p-5 rounded-2xl space-y-4">
                    <div className="border-b border-slate-900 pb-3">
                      <div className="flex items-center gap-2">
                        <Send className="w-4 h-4 text-sky-400" />
                        <h3 className="text-sm font-display font-bold uppercase text-slate-100">
                          Edge Traffic Simulator
                        </h3>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Simulate live global HTTP requests targeting your edge worker.
                      </p>
                    </div>

                    <div className="space-y-4 font-mono text-xs">
                      {/* Presets List */}
                      <div>
                        <span className="text-[10px] uppercase text-slate-500 block mb-1.5">Simulation Presets</span>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
                          <button
                            onClick={() => applyPresetSim("ping")}
                            className={`px-2 py-1.5 rounded text-[10px] text-center transition-all ${
                              simParams.selectedSimulationPreset === "ping"
                                ? "bg-emerald-950 text-emerald-400 border border-emerald-500/20"
                                : "bg-slate-950 text-slate-400 border border-slate-900 hover:bg-slate-900"
                            }`}
                          >
                            GET Base Ping
                          </button>
                          <button
                            onClick={() => applyPresetSim("mock")}
                            className={`px-2 py-1.5 rounded text-[10px] text-center transition-all ${
                              simParams.selectedSimulationPreset === "mock"
                                ? "bg-emerald-950 text-emerald-400 border border-emerald-500/20"
                                : "bg-slate-950 text-slate-400 border border-slate-900 hover:bg-slate-900"
                            }`}
                          >
                            GET Live /api/v1/user
                          </button>
                          <button
                            onClick={() => applyPresetSim("webhook")}
                            className={`px-2 py-1.5 rounded text-[10px] text-center transition-all ${
                              simParams.selectedSimulationPreset === "webhook"
                                ? "bg-emerald-950 text-emerald-400 border border-emerald-500/20"
                                : "bg-slate-950 text-slate-400 border border-slate-900 hover:bg-slate-900"
                            }`}
                          >
                            POST Webhook Echo
                          </button>
                          <button
                            onClick={() => applyPresetSim("authorized_api")}
                            className={`px-2 py-1.5 rounded text-[10px] text-center transition-all ${
                              simParams.selectedSimulationPreset === "authorized_api"
                                ? "bg-emerald-950 text-emerald-400 border border-emerald-500/20"
                                : "bg-slate-950 text-slate-400 border border-slate-900 hover:bg-slate-900"
                            }`}
                          >
                            GET Authed Request
                          </button>
                          <button
                            onClick={() => applyPresetSim("health")}
                            className={`px-2 py-1.5 rounded text-[10px] text-center transition-all ${
                              simParams.selectedSimulationPreset === "health"
                                ? "bg-emerald-950 text-emerald-400 border border-emerald-500/20"
                                : "bg-slate-950 text-slate-400 border border-slate-900 hover:bg-slate-900"
                            }`}
                          >
                            GET Shield Health
                          </button>
                        </div>
                      </div>

                      {/* Custom request fields */}
                      <div className="space-y-3 p-3 bg-slate-950 rounded-lg border border-slate-900">
                        <div className="flex gap-2">
                          <select
                            value={simParams.method}
                            onChange={(e) => setSimParams(prev => ({ ...prev, method: e.target.value }))}
                            className="bg-slate-900 border border-slate-800 text-slate-200 rounded px-2 py-1 text-xs font-mono w-24 focus:border-sky-500 outline-none"
                          >
                            <option value="GET">GET</option>
                            <option value="POST">POST</option>
                            <option value="PUT">PUT</option>
                            <option value="DELETE">DELETE</option>
                          </select>
                          <input
                            type="text"
                            value={simParams.path}
                            onChange={(e) => setSimParams(prev => ({ ...prev, path: e.target.value }))}
                            placeholder="/api/mock-path"
                            className="bg-slate-900 border border-slate-800 text-slate-200 rounded px-2.5 py-1 text-xs font-mono flex-1 focus:border-sky-500 outline-none"
                          />
                        </div>

                        {/* Bearer token header emulator */}
                        <div>
                          <label className="text-[10px] text-slate-500 block mb-1">Authorization Bearer Token Header</label>
                          <input
                            type="text"
                            value={simParams.authHeader}
                            onChange={(e) => setSimParams(prev => ({ ...prev, authHeader: e.target.value }))}
                            placeholder="Optional Token signature (e.g. test-token)"
                            className="w-full bg-slate-900 border border-slate-800 text-slate-200 rounded px-2.5 py-1 text-xs font-mono focus:border-sky-500 outline-none"
                          />
                        </div>

                        {/* Body parameter for POSTs */}
                        {simParams.method !== "GET" && (
                          <div>
                            <label className="text-[10px] text-slate-500 block mb-1">Request JSON Data Body</label>
                            <textarea
                              rows={4}
                              value={simParams.body}
                              onChange={(e) => setSimParams(prev => ({ ...prev, body: e.target.value }))}
                              className="w-full bg-slate-900 border border-slate-800 text-slate-200 rounded p-2 text-xs font-mono focus:border-sky-500 outline-none scrollbar-thin"
                            ></textarea>
                          </div>
                        )}

                        <button
                          onClick={runSimulation}
                          disabled={simulating}
                          className="w-full bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold py-1.5 rounded cursor-pointer flex items-center justify-center gap-1.5 transition-all text-xs"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          {simulating ? "Transmitting..." : "Execute simulated endpoint hit"}
                        </button>
                      </div>

                      {/* Simulation result output */}
                      {simResult && (
                        <div className="bg-slate-950 p-3 rounded-lg border border-slate-900 space-y-2">
                          <div className="flex items-center justify-between text-[10px] text-slate-500 border-b border-slate-900 pb-1.5">
                            <span>Response status: <span className="text-emerald-400 font-bold">{simResult.status}</span></span>
                            <span>Status text: {simResult.statusText || 'OK'}</span>
                          </div>
                          <pre className="text-[10px] text-sky-400 overflow-x-auto max-h-36 scrollbar-thin">
                            {typeof simResult.body === "object" ? (
                              JSON.stringify(simResult.body, null, 2)
                            ) : (
                              simResult.body
                            )}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* TAB 2: Dynamic Cloudflare D1-Backed Rule-Engine Mocks Dashboard */}
          {activeTab === "rules" && (
            <motion.div
              key="rules-panel"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-6"
            >
              {/* Rules List Column */}
              <div className="lg:col-span-7 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-900 pb-2">
                  <div className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-emerald-400" />
                    <h2 className="font-display font-semibold text-sm uppercase text-slate-200">
                      Interceptor rules List
                    </h2>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 font-bold">
                    Active: {rules.filter(r => r.is_active === 1).length} / {rules.length}
                  </span>
                </div>

                <div className="space-y-3.5">
                  {rules.length === 0 ? (
                    <div className="p-10 border border-dashed border-slate-900 rounded-2xl text-center bg-slate-900/5">
                      <HelpCircle className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                      <p className="text-xs text-slate-400">No mock rules are active in D1.</p>
                      <p className="text-[10px] text-slate-600 mt-1">
                        Use the rules constructor form on the right to intercept and draft bespoke responsive bodies for the edge API routing!
                      </p>
                    </div>
                  ) : (
                    rules.map((rule) => {
                      return (
                        <div
                          key={rule.id}
                          className={`bg-slate-900/20 border rounded-xl p-4 space-y-3 font-mono text-xs transition-all ${
                            rule.is_active === 1 ? 'border-slate-900' : 'border-slate-950 opacity-40'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className={`px-1.5 py-0.5 rounded text-[9px] uppercase font-bold text-slate-100 ${
                                rule.method === "ANY" 
                                  ? 'bg-purple-950/80 text-purple-400 border border-purple-500/20' 
                                  : rule.method === "POST" 
                                    ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/20' 
                                    : 'bg-sky-950/80 text-sky-400 border border-sky-500/20'
                              }`}>
                                {rule.method}
                              </span>
                              <span className="font-bold text-slate-200 select-all">{rule.path}</span>
                            </div>

                            <div className="flex items-center gap-2.5">
                              {/* Toggle active state */}
                              <button
                                onClick={() => handleToggleRule(rule.id, rule.is_active)}
                                className={`px-2 py-0.8 rounded text-[9px] font-bold cursor-pointer transition-colors ${
                                  rule.is_active === 1
                                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30'
                                    : 'bg-slate-900 text-slate-400 border border-slate-800 hover:bg-slate-800'
                                }`}
                              >
                                {rule.is_active === 1 ? "Active [Edge ON]" : "Edge INACTIVE"}
                              </button>

                              {/* Delete Rule */}
                              <button
                                onClick={() => handleDeleteRule(rule.id)}
                                className="p-1.5 bg-slate-900 hover:bg-rose-950/50 hover:text-rose-400 border border-slate-800 hover:border-rose-900/30 rounded text-slate-400 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 bg-slate-950/40 p-3 rounded-lg border border-slate-900 text-[11px]">
                            <div>
                              <span className="text-slate-500 block text-[9px] uppercase">Response Status Override</span>
                              <span className="text-amber-500 font-semibold">{rule.response_status}</span>
                            </div>
                            <div>
                              <span className="text-slate-500 block text-[9px] uppercase">Creation Time</span>
                              <span className="text-slate-400">{new Date(rule.created_at).toLocaleString()}</span>
                            </div>
                          </div>

                          {/* Body mock preview */}
                          <div>
                            <span className="text-slate-500 block text-[9px] uppercase mb-1">Response JSON Mock Response</span>
                            <pre className="bg-slate-950 text-sky-400/90 p-2.5 rounded border border-slate-900/40 overflow-x-auto text-[10px] max-h-32 scrollbar-thin">
                              {rule.response_body}
                            </pre>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Rules Constructor Form Column */}
              <div className="lg:col-span-5">
                <div className="bg-slate-900/40 border border-slate-950 p-5 rounded-2xl space-y-4">
                  <div className="border-b border-slate-900 pb-3">
                    <div className="flex items-center gap-2">
                      <Plus className="w-4 h-4 text-emerald-400" />
                      <h3 className="text-sm font-display font-bold uppercase text-slate-100">
                        Mock API Rules Constructor
                      </h3>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Dynamically intercept any HTTP endpoint and map a customized serverless mock response.
                    </p>
                  </div>

                  <form onSubmit={handleCreateRule} className="space-y-4 font-mono text-xs">
                    {/* Path mapping */}
                    <div>
                      <label className="text-[10px] uppercase text-slate-500 block mb-1">Edge Path Matcher (Must start with /)</label>
                      <input
                        type="text"
                        required
                        value={newRule.path}
                        onChange={(e) => setNewRule(prev => ({ ...prev, path: e.target.value }))}
                        className="w-full bg-slate-950 border border-slate-850 rounded px-3 py-2 focus:border-emerald-500 outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3.5">
                      {/* Method Selector */}
                      <div>
                        <label className="text-[10px] uppercase text-slate-500 block mb-1">HTTP Request Method</label>
                        <select
                          value={newRule.method}
                          onChange={(e) => setNewRule(prev => ({ ...prev, method: e.target.value }))}
                          className="w-full bg-slate-950 border border-slate-850 rounded px-2 py-2 focus:border-emerald-500 outline-none"
                        >
                          <option value="GET">GET</option>
                          <option value="POST">POST</option>
                          <option value="PUT">PUT</option>
                          <option value="DELETE">DELETE</option>
                          <option value="ANY">ANY [Wildcard]</option>
                        </select>
                      </div>

                      {/* Status override */}
                      <div>
                        <label className="text-[10px] uppercase text-slate-500 block mb-1">Status Code Response</label>
                        <input
                          type="number"
                          required
                          value={newRule.response_status}
                          onChange={(e) => setNewRule(prev => ({ ...prev, response_status: Number(e.target.value) }))}
                          className="w-full bg-slate-950 border border-slate-850 rounded px-3 py-2 focus:border-emerald-500 outline-none"
                        />
                      </div>
                    </div>

                    {/* Response headers */}
                    <div>
                      <label className="text-[10px] uppercase text-slate-500 block mb-1">Response Headers (JSON Object)</label>
                      <textarea
                        rows={3}
                        value={newRule.response_headers}
                        onChange={(e) => setNewRule(prev => ({ ...prev, response_headers: e.target.value }))}
                        className="w-full bg-slate-950 border border-slate-850 rounded p-2 focus:border-emerald-500 outline-none scrollbar-thin scrollbar-thumb-slate-800 text-[10.5px]"
                      ></textarea>
                    </div>

                    {/* Response body mock mapping */}
                    <div>
                      <label className="text-[10px] uppercase text-slate-500 block mb-1">Response Body Mock Payloads</label>
                      <textarea
                        rows={5}
                        value={newRule.response_body}
                        onChange={(e) => setNewRule(prev => ({ ...prev, response_body: e.target.value }))}
                        className="w-full bg-slate-950 border border-slate-850 rounded p-2 focus:border-emerald-500 outline-none scrollbar-thin scrollbar-thumb-slate-800 text-[10.5px]"
                      ></textarea>
                    </div>

                    <button
                      type="submit"
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold py-2 rounded cursor-pointer transition-all flex items-center justify-center gap-1 text-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Deploy Mock Rule to Edge
                    </button>
                  </form>
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 3: Security Board and Geofencing */}
          {activeTab === "security" && (
            <motion.div
              key="security-panel"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="max-w-4xl mx-auto space-y-6"
            >
              <div className="bg-slate-900/30 border border-slate-900 p-6 rounded-2xl space-y-6">
                <div className="border-b border-slate-900 pb-4">
                  <div className="flex items-center gap-2.5">
                    <Shield className="w-5 h-5 text-emerald-400" />
                    <h2 className="font-display font-semibold text-base uppercase text-slate-200">
                      Edge Gatekeeper Security board
                    </h2>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 font-mono">
                    Control instant-toggle security rules and global blocking policies on the SQLite D1 configuration registries.
                  </p>
                </div>

                {/* Grid controls */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-mono text-xs">
                  
                  {/* Auth Shield Control */}
                  <div className="bg-slate-950/50 border border-slate-900 p-5 rounded-xl space-y-4 flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                          <Lock className="w-4 h-4 text-emerald-400" />
                          Bearer Auth Shield
                        </span>
                        
                        {/* Interactive toggle status */}
                        <div className="relative">
                          <button
                            onClick={() => {
                              const toggle = config.api_auth_enabled === "true" ? "false" : "true";
                              handleUpdateConfig("api_auth_enabled", toggle);
                            }}
                            className={`w-12 h-6 rounded-full p-0.5 transition-colors cursor-pointer relative flex items-center ${
                              config.api_auth_enabled === "true" ? "bg-emerald-500" : "bg-slate-800"
                            }`}
                          >
                            <span className={`w-5 h-5 bg-slate-100 rounded-full shadow transition-transform ${
                              config.api_auth_enabled === "true" ? "translate-x-6" : "translate-x-0"
                            }`}></span>
                          </button>
                        </div>
                      </div>
                      <p className="text-slate-500 text-[11px] leading-relaxed">
                        Forces Bearer Token validation on all incoming `/api/*` requests. If active, requests with absent or incorrect tokens will return <span className="text-rose-400 font-bold">401 Unauthorized</span> immediately before mock mappers execute.
                      </p>
                    </div>

                    <div className="bg-slate-950 p-3 rounded-lg border border-slate-900 space-y-1.5 text-[11px]">
                      <div className="text-slate-500 uppercase text-[9px]">Server API Signature Token</div>
                      <div className="flex items-center justify-between gap-2 text-slate-300">
                        <span className="font-mono bg-slate-900 px-1 py-0.5 rounded text-sky-400">test-token</span>
                        <button
                          onClick={() => copyToClipboard("test-token", "sig-token")}
                          className="text-slate-500 hover:text-emerald-400 font-bold"
                        >
                          {copiedText === "sig-token" ? "Copied" : "Copy Token"}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Geofencing Controls */}
                  <div className="bg-slate-950/50 border border-slate-900 p-5 rounded-xl space-y-4 flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                          <Globe className="w-4 h-4 text-emerald-400" />
                          Geographic Firewalls
                        </span>
                        
                        <div className="relative">
                          <button
                            onClick={() => {
                              const toggle = config.geo_blocking_enabled === "true" ? "false" : "true";
                              handleUpdateConfig("geo_blocking_enabled", toggle);
                            }}
                            className={`w-12 h-6 rounded-full p-0.5 transition-colors cursor-pointer relative flex items-center ${
                              config.geo_blocking_enabled === "true" ? "bg-emerald-500" : "bg-slate-800"
                            }`}
                          >
                            <span className={`w-5 h-5 bg-slate-100 rounded-full shadow transition-transform ${
                              config.geo_blocking_enabled === "true" ? "translate-x-6" : "translate-x-0"
                            }`}></span>
                          </button>
                        </div>
                      </div>
                      <p className="text-slate-500 text-[11px] leading-relaxed">
                        Instantly filter out traffic based on country origin metadata provided by Cloudflare's edge CDN. Matches the incoming <span className="font-mono">request.cf.country</span> against the D1 blocked region arrays.
                      </p>
                    </div>

                    <div className="space-y-1 text-[11px]">
                      <span className="text-[9px] uppercase text-slate-500">Configure Region Blocklist (Toggle to block)</span>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {["US", "GB", "CN", "RU", "DE", "FR"].map((countryCode) => {
                          let blockedList: string[] = [];
                          try {
                            blockedList = JSON.parse(config.blocked_countries || "[]");
                          } catch (e) {}

                          const isBlocked = blockedList.includes(countryCode);
                          return (
                            <button
                              key={countryCode}
                              onClick={() => {
                                const list = isBlocked 
                                  ? blockedList.filter((c: string) => c !== countryCode)
                                  : [...blockedList, countryCode];
                                handleUpdateConfig("blocked_countries", JSON.stringify(list));
                              }}
                              className={`px-2 py-1 rounded text-[10px] font-bold transition-all cursor-pointer border ${
                                isBlocked 
                                  ? "bg-rose-950 text-rose-400 border-rose-900/40"
                                  : "bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-300"
                              }`}
                            >
                              {countryCode} {isBlocked ? "Blocked" : "Allow"}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                </div>

                {/* Diagnostics block */}
                <div className="bg-slate-950/30 p-4 rounded-xl border border-slate-950/70 font-mono text-xs space-y-2">
                  <span className="text-[10px] text-slate-400 uppercase tracking-widest block font-bold">Diagnostics Dashboard</span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] text-slate-500">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                      <span>Edge Rule Interceptors Active: D1 Storage Sync OK</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                      <span>Rate Limit Controls, Cloudflare WAF: Cascaded</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 4: SQL Interactive D1 Database Console Terminal */}
          {activeTab === "sql" && (
            <motion.div
              key="sql-shell"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-6"
            >
              {/* Shell console terminal */}
              <div className="lg:col-span-8 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-900 pb-2">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-emerald-400" />
                    <h2 className="font-display font-semibold text-sm uppercase text-slate-200">
                      SQLite D1 Web Shell Console
                    </h2>
                  </div>
                  <span className="text-[10px] uppercase font-mono tracking-widest bg-amber-950 border border-amber-500/20 px-2 py-0.5 text-amber-500 rounded font-bold">
                    Raw Database Direct Access Enabled
                  </span>
                </div>

                <div className="bg-slate-900/40 border border-slate-950 p-5 rounded-2xl space-y-4 font-mono">
                  
                  {/* SQL editor textarea */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <span>Type raw DDL/DML query block:</span>
                      <span>F7 to execute</span>
                    </div>
                    <div className="relative">
                      <textarea
                        rows={5}
                        value={sqlQuery}
                        onChange={(e) => setSqlQuery(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-850 p-4 rounded-xl focus:border-emerald-500 outline-none text-xs text-slate-100 font-mono scrollbar-thin scrollbar-thumb-slate-800 leading-relaxed"
                      ></textarea>
                    </div>
                  </div>

                  {/* Actions bar */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    <div className="flex flex-wrap gap-1.5">
                      {sqlHistory.map((hist, idx) => (
                        <button
                          key={idx}
                          onClick={() => setSqlQuery(hist)}
                          className="px-2 py-1 bg-slate-950 text-[10px] text-slate-400 rounded hover:text-slate-200 truncate max-w-[180px]"
                          title={hist}
                        >
                          {hist}
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={() => runCustomSQL()}
                      disabled={sqlLoading}
                      className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold px-5 py-2 rounded text-xs cursor-pointer flex items-center justify-center gap-1.5 transition-all flex-shrink-0"
                    >
                      <Terminal className="w-3.5 h-3.5" />
                      {sqlLoading ? "Executing Query..." : "Execute SQL Run"}
                    </button>
                  </div>

                  {/* Schema layout tip */}
                  <div className="bg-slate-950/50 p-3.5 rounded-xl border border-slate-900/40 text-[10px] leading-relaxed text-slate-400 space-y-1">
                    <div className="text-slate-500 font-bold uppercase tracking-widest text-[9px]">D1 SQLite Database Schemas</div>
                    <div>
                      <span className="text-emerald-400 font-bold">1. request_logs</span>: (id <span className="text-amber-500">INTEGER PK</span>, method <span className="text-amber-500">TEXT</span>, url, headers, body, ip, country, city, latitude, longitude, status, timestamp)
                    </div>
                    <div>
                      <span className="text-emerald-400 font-bold">2. rules</span>: (id <span className="text-amber-500">INTEGER PK</span>, path <span className="text-amber-500">TEXT UNIQUE</span>, method, response_status, response_headers, response_body, is_active, created_at)
                    </div>
                    <div>
                      <span className="text-emerald-400 font-bold">3. gateway_config</span>: (key <span className="text-amber-500">TEXT PK</span>, value <span className="text-amber-500">TEXT</span>)
                    </div>
                  </div>
                </div>

                {/* SQL Result output panel */}
                {(sqlResult || sqlError) && (
                  <div className="bg-slate-900/40 border border-slate-950 p-5 rounded-2xl font-mono text-xs">
                    <div className="flex items-center justify-between border-b border-slate-900 pb-2 mb-3">
                      <span className="text-xs uppercase font-bold text-slate-400">Execution Output Result Matrix</span>
                      <button
                        onClick={() => { setSqlResult(null); setSqlError(null); }}
                        className="text-[10px] text-slate-500 hover:text-slate-300"
                      >
                        [Clear output]
                      </button>
                    </div>

                    {sqlError && (
                      <div className="p-3 bg-rose-950/20 border border-rose-900/30 text-rose-400 rounded-lg flex items-start gap-2 max-h-48 overflow-y-auto">
                        <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <div>
                          <div className="font-bold">SQLite Statement Error:</div>
                          <p className="mt-1 text-[11px] leading-normal">{sqlError}</p>
                        </div>
                      </div>
                    )}

                    {sqlResult && (
                      <div className="space-y-3">
                        {/* Meta information */}
                        <div className="text-[10px] text-slate-500 flex items-center gap-3">
                          <span>Rows returned: {sqlResult.results?.length || 0}</span>
                          <span>Changed: {sqlResult.meta?.changes !== undefined ? sqlResult.meta.changes : 0} rows</span>
                          <span>Latency: {sqlResult.meta?.duration || 0}ms</span>
                        </div>

                        {/* Direct Table view */}
                        {sqlResult.results && sqlResult.results.length > 0 ? (
                          <div className="overflow-x-auto border border-slate-900 rounded-lg max-h-64 overflow-y-auto scrollbar-thin">
                            <table className="min-w-full divide-y divide-slate-900 text-[10.5px]">
                              <thead className="bg-slate-950 sticky top-0 text-slate-400 uppercase tracking-wider">
                                <tr>
                                  {Object.keys(sqlResult.results[0]).map((key) => (
                                    <th key={key} className="px-3 py-2 text-left font-semibold">
                                      {key}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-950 bg-slate-900/10">
                                {sqlResult.results.map((row: any, rIdx: number) => (
                                  <tr key={rIdx} className="hover:bg-slate-900/40 text-slate-300">
                                    {Object.values(row).map((val: any, cIdx: number) => (
                                      <td key={cIdx} className="px-3 py-1.8 max-w-xs truncate select-all">
                                        {val === null ? (
                                          <span className="text-slate-600 italic">null</span>
                                        ) : typeof val === "object" ? (
                                          JSON.stringify(val)
                                        ) : (
                                          String(val)
                                        )}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="p-4 bg-slate-950/30 text-center rounded border border-slate-900 text-slate-500 italic">
                            Statement executed successfully. Empty/zero set of rows returned.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* SQLite quick templates column */}
              <div className="lg:col-span-4 space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-900 pb-2">
                  <Database className="w-4 h-4 text-emerald-400" />
                  <h2 className="font-display font-semibold text-sm uppercase text-slate-200">
                    Console Templates
                  </h2>
                </div>

                <div className="bg-slate-900/40 border border-slate-950 p-4 rounded-xl space-y-4 font-mono text-xs">
                  <p className="text-[11px] text-slate-500 leading-normal">
                    Click any quick template to load it onto the prompt console.
                  </p>

                  <div className="space-y-2.5">
                    <div>
                      <span className="text-[9px] text-slate-500 block uppercase mb-1">DML Queries / Logs</span>
                      <button
                        onClick={() => {
                          setSqlQuery("SELECT * FROM request_logs ORDER BY id DESC LIMIT 50;");
                          setActiveTab("sql");
                        }}
                        className="w-full text-left bg-slate-955 p-2 rounded hover:bg-slate-900 text-slate-400 hover:text-slate-100 flex items-center justify-between transition-colors border border-slate-900"
                      >
                        <span>Query recent request logs</span>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                      </button>
                    </div>

                    <div>
                      <span className="text-[9px] text-slate-500 block uppercase mb-1">D1 Analytics / aggregators</span>
                      <button
                        onClick={() => {
                          setSqlQuery("SELECT country, status, COUNT(*) as volume FROM request_logs GROUP BY country, status ORDER BY volume DESC;");
                          setActiveTab("sql");
                        }}
                        className="w-full text-left bg-slate-955 p-2 rounded hover:bg-slate-900 text-slate-400 hover:text-slate-100 flex items-center justify-between transition-colors border border-slate-900"
                      >
                        <span>Aggregate hits by region</span>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                      </button>
                    </div>

                    <div>
                      <span className="text-[9px] text-slate-500 block uppercase mb-1">API Rules Management</span>
                      <button
                        onClick={() => {
                          setSqlQuery("SELECT * FROM rules;");
                          setActiveTab("sql");
                        }}
                        className="w-full text-left bg-slate-955 p-2 rounded hover:bg-slate-900 text-slate-400 hover:text-slate-100 flex items-center justify-between transition-colors border border-slate-900"
                      >
                        <span>List all Interceptor rules</span>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                      </button>
                    </div>

                    <div>
                      <span className="text-[9px] text-slate-500 block uppercase mb-1">Security registry resets</span>
                      <button
                        onClick={() => {
                          setSqlQuery("UPDATE gateway_config SET value = 'true' WHERE key = 'api_auth_enabled';");
                          setActiveTab("sql");
                        }}
                        className="w-full text-left bg-slate-955 p-2 rounded hover:bg-slate-900 text-slate-400 hover:text-slate-100 flex items-center justify-between transition-colors border border-slate-900"
                      >
                        <span>Enable API Authorizer via SQL</span>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                      </button>
                    </div>

                    <div>
                      <span className="text-[9px] text-slate-500 block uppercase mb-1">Destructive truncate</span>
                      <button
                        onClick={() => {
                          setSqlQuery("DELETE FROM request_logs WHERE timestamp < datetime('now', '-3 days');");
                          setActiveTab("sql");
                        }}
                        className="w-full text-left bg-slate-955 p-2 rounded hover:bg-slate-900 text-slate-400 hover:text-slate-100 flex items-center justify-between transition-colors border border-slate-900"
                      >
                        <span>Purge logs older than 3 days</span>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* Terminal UI footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-5 mt-12 text-center text-xs font-mono text-slate-600">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <span>Edge Shield Operations Gateway Terminal • v2.1.0</span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
            Cloudflare D1 Node Linked
          </span>
        </div>
      </footer>
    </div>
  );
}
