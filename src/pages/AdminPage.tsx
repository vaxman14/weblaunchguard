import { useCallback, useEffect, useState } from "react";
import { Button } from "../components/Button";
import { useAuth } from "../lib/auth";

type ClientRow = {
  contact_email: string | null;
  created_at: string;
  id: string;
  name: string;
  notes: string | null;
  user_count: number;
};

type SubscriptionRow = {
  billing_interval: string | null;
  current_period_end: string | null;
  id: string;
  manual_override: boolean;
  status: string;
  tier: string | null;
};

type UserRow = {
  client_id: string | null;
  client_name: string | null;
  created_at: string;
  domains: number;
  email: string;
  full_name: string | null;
  id: string;
  is_admin: boolean;
  scans: number;
  subscription: SubscriptionRow | null;
};

type DomainRow = {
  created_at: string;
  hostname: string;
  id: string;
  verification_status: string;
};

type ScanRow = {
  created_at: string;
  domain_id: string;
  id: string;
  scan_type: string;
};

type UserDetail = {
  domains: DomainRow[];
  profile: {
    client_id: string | null;
    client_name: string | null;
    created_at: string;
    email: string;
    full_name: string | null;
    id: string;
    is_admin: boolean;
  };
  scans: ScanRow[];
  subscriptions: SubscriptionRow[];
};

type Stats = {
  paying_users: number;
  scans_today: number;
  total_clients: number;
  total_users: number;
};

const TIERS = ["basic", "pro", "enterprise"] as const;

function tierBadge(tier: string | null) {
  if (tier === "enterprise") return "bg-purple-100 text-purple-700";
  if (tier === "pro") return "bg-blue-100 text-blue-700";
  if (tier === "basic") return "bg-green-100 text-green-700";
  return "bg-line/30 text-muted";
}

function statusBadge(status: string | null) {
  if (status === "active") return "bg-green-100 text-green-700";
  if (status === "trialing") return "bg-yellow-100 text-yellow-700";
  if (status === "past_due") return "bg-red-100 text-red-700";
  return "bg-line/30 text-muted";
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

async function adminCall(token: string, body: object) {
  const res = await fetch("/.netlify/functions/admin", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(body)
  });
  return res.json();
}

type AdminPageProps = {
  onBack: () => void;
};

const USERS_LIMIT = 25;

type ActiveView = "users" | "clients";

export function AdminPage({ onBack }: AdminPageProps) {
  const { session } = useAuth();
  const [view, setView] = useState<ActiveView>("users");
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersPage, setUsersPage] = useState(1);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [search, setSearch] = useState("");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [assignTier, setAssignTier] = useState<string>("");
  const [assignClientId, setAssignClientId] = useState<string>("");
  const [assigning, setAssigning] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  // New client form
  const [newClientName, setNewClientName] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [newClientNotes, setNewClientNotes] = useState("");
  const [creatingClient, setCreatingClient] = useState(false);
  const [clientFeedback, setClientFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  const load = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    const [statsRes, usersRes, clientsRes] = await Promise.all([
      adminCall(session.access_token, { action: "stats" }),
      adminCall(session.access_token, { action: "list-users", page: usersPage, limit: USERS_LIMIT }),
      adminCall(session.access_token, { action: "list-clients" })
    ]);
    setStats(statsRes.error ? null : statsRes);
    setUsers(usersRes.users ?? []);
    setUsersTotal(usersRes.total ?? 0);
    setClients(clientsRes.clients ?? []);
    setLoading(false);
  }, [session, usersPage]);

  useEffect(() => {
    void load();
  }, [load]);

  async function openUser(user: UserRow) {
    if (!session?.access_token) return;
    setDetailLoading(true);
    setSelectedUser(null);
    setFeedback(null);
    const res = await adminCall(session.access_token, { action: "get-user", userId: user.id });
    if (!res.error) {
      setSelectedUser(res);
      const activeSub = res.subscriptions?.[0];
      setAssignTier(activeSub?.status === "active" ? (activeSub.tier ?? "") : "");
      setAssignClientId(res.profile?.client_id ?? "");
    }
    setDetailLoading(false);
  }

  async function handleAssignPlan() {
    if (!session?.access_token || !selectedUser) return;
    setAssigning(true);
    setFeedback(null);
    const tier = assignTier || null;
    const res = await adminCall(session.access_token, {
      action: "assign-plan",
      userId: selectedUser.profile.id,
      tier
    });
    if (res.error) {
      setFeedback({ ok: false, msg: res.error });
    } else {
      setFeedback({ ok: true, msg: tier ? `Plan set to ${tier}.` : "Plan revoked." });
      void load();
    }
    setAssigning(false);
  }

  async function handleAssignClient() {
    if (!session?.access_token || !selectedUser) return;
    setAssigning(true);
    setFeedback(null);
    const clientId = assignClientId || null;
    const res = await adminCall(session.access_token, {
      action: "assign-client",
      userId: selectedUser.profile.id,
      clientId
    });
    if (res.error) {
      setFeedback({ ok: false, msg: res.error });
    } else {
      const clientName = clients.find((c) => c.id === clientId)?.name ?? null;
      setSelectedUser((prev) =>
        prev ? { ...prev, profile: { ...prev.profile, client_id: clientId, client_name: clientName } } : prev
      );
      setFeedback({ ok: true, msg: clientId ? "Client assigned." : "Client removed." });
      void load();
    }
    setAssigning(false);
  }

  async function handleCreateClient(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.access_token || !newClientName.trim()) return;
    setCreatingClient(true);
    setClientFeedback(null);
    const res = await adminCall(session.access_token, {
      action: "create-client",
      name: newClientName.trim(),
      contactEmail: newClientEmail.trim() || undefined,
      notes: newClientNotes.trim() || undefined
    });
    if (res.error) {
      setClientFeedback({ ok: false, msg: res.error });
    } else {
      setNewClientName("");
      setNewClientEmail("");
      setNewClientNotes("");
      setClientFeedback({ ok: true, msg: `Client "${res.name}" created.` });
      void load();
    }
    setCreatingClient(false);
  }

  const filtered = users.filter((u) => {
    const matchesSearch =
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.full_name?.toLowerCase().includes(search.toLowerCase());
    const matchesClient =
      clientFilter === "all" ||
      (clientFilter === "none" && !u.client_id) ||
      u.client_id === clientFilter;
    return matchesSearch && matchesClient;
  });

  const inputClass =
    "w-full rounded-lg border border-line bg-page px-3 py-1.5 text-sm text-ink outline-none placeholder:text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent";

  return (
    <div className="min-h-screen bg-page text-ink">
      <div className="mx-auto max-w-7xl px-6 py-6 sm:px-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-lg font-semibold">Web Launch Guard — Admin</p>
            <p className="mt-0.5 text-sm text-muted">Manage users, clients, and plans.</p>
          </div>
          <Button variant="ghost" onClick={onBack}>← Dashboard</Button>
        </div>

        {/* Stats */}
        {stats && (
          <div className="mb-6 grid grid-cols-4 gap-4">
            {[
              { label: "Total Users", value: stats.total_users },
              { label: "Paying Users", value: stats.paying_users },
              { label: "Clients", value: stats.total_clients },
              { label: "Scans Today", value: stats.scans_today }
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-line bg-panel p-4">
                <div className="text-2xl font-bold">{s.value}</div>
                <div className="mt-1 text-sm text-muted">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Tab bar */}
        <div className="mb-4 flex gap-1 border-b border-line">
          {(["users", "clients"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
                view === v
                  ? "border-b-2 border-accent text-accent"
                  : "text-muted hover:text-ink"
              }`}
            >
              {v}
            </button>
          ))}
        </div>

        {/* USERS VIEW */}
        {view === "users" && (
          <div className="flex items-start gap-4">
            <div className="min-w-0 flex-1">
              {/* Filters */}
              <div className="mb-3 flex gap-2">
                <input
                  className="flex-1 rounded-lg border border-line bg-panel px-3 py-2 text-sm text-ink outline-none placeholder:text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                  placeholder="Search by email or name…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <select
                  value={clientFilter}
                  onChange={(e) => setClientFilter(e.target.value)}
                  className="rounded-lg border border-line bg-panel px-3 py-2 text-sm text-ink outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                >
                  <option value="all">All clients</option>
                  <option value="none">No client</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {loading ? (
                <p className="py-8 text-center text-sm text-muted">Loading…</p>
              ) : (
                <div className="overflow-hidden rounded-xl border border-line bg-panel">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-line text-left text-muted">
                        <th className="px-4 py-3 font-medium">Email</th>
                        <th className="px-4 py-3 font-medium">Client</th>
                        <th className="px-4 py-3 font-medium">Plan</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Domains</th>
                        <th className="px-4 py-3 font-medium">Scans</th>
                        <th className="px-4 py-3 font-medium">Joined</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-muted">No users found.</td>
                        </tr>
                      ) : (
                        filtered.map((user) => (
                          <tr
                            key={user.id}
                            onClick={() => void openUser(user)}
                            className={`cursor-pointer border-b border-line/50 transition-colors last:border-0 hover:bg-line/10 ${
                              selectedUser?.profile.id === user.id ? "bg-accent/5" : ""
                            }`}
                          >
                            <td className="max-w-[180px] truncate px-4 py-3 font-medium">
                              {user.email}
                              {user.is_admin && (
                                <span className="ml-1.5 rounded bg-yellow-100 px-1.5 py-0.5 text-xs text-yellow-700">admin</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {user.client_name ? (
                                <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent">{user.client_name}</span>
                              ) : (
                                <span className="text-muted">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tierBadge(user.subscription?.tier ?? null)}`}>
                                {user.subscription?.tier ?? "none"}
                                {user.subscription?.manual_override && " ✦"}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`rounded-full px-2 py-0.5 text-xs ${statusBadge(user.subscription?.status ?? null)}`}>
                                {user.subscription?.status ?? "—"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-muted">{user.domains}</td>
                            <td className="px-4 py-3 text-muted">{user.scans}</td>
                            <td className="px-4 py-3 text-muted">{fmtDate(user.created_at)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
              {usersTotal > USERS_LIMIT && (
                <div className="mt-3 flex items-center gap-3">
                  <button
                    disabled={usersPage <= 1}
                    onClick={() => setUsersPage((p) => p - 1)}
                    className="rounded-lg border border-line bg-panel px-3 py-1.5 text-sm text-ink disabled:opacity-40 hover:bg-line/10"
                  >
                    ← Prev
                  </button>
                  <span className="text-xs text-muted">
                    {(usersPage - 1) * USERS_LIMIT + 1}–{Math.min(usersPage * USERS_LIMIT, usersTotal)} of {usersTotal}
                  </span>
                  <button
                    disabled={usersPage * USERS_LIMIT >= usersTotal}
                    onClick={() => setUsersPage((p) => p + 1)}
                    className="rounded-lg border border-line bg-panel px-3 py-1.5 text-sm text-ink disabled:opacity-40 hover:bg-line/10"
                  >
                    Next →
                  </button>
                </div>
              )}
            </div>

            {/* User detail panel */}
            {(detailLoading || selectedUser) && (
              <div className="w-80 shrink-0 rounded-xl border border-line bg-panel p-5">
                {detailLoading ? (
                  <p className="py-8 text-center text-sm text-muted">Loading…</p>
                ) : selectedUser ? (
                  <div>
                    <div className="mb-4">
                      <p className="truncate font-semibold">{selectedUser.profile.email}</p>
                      {selectedUser.profile.full_name && (
                        <p className="mt-0.5 text-sm text-muted">{selectedUser.profile.full_name}</p>
                      )}
                      <p className="mt-1 text-xs text-muted">Joined {fmtDate(selectedUser.profile.created_at)}</p>
                    </div>

                    {feedback && (
                      <p className={`mb-3 text-xs ${feedback.ok ? "text-accent" : "text-red-600"}`}>{feedback.msg}</p>
                    )}

                    {/* Assign client */}
                    <div className="mb-4 border-t border-line pt-4">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Client</p>
                      <div className="flex gap-2">
                        <select
                          value={assignClientId}
                          onChange={(e) => setAssignClientId(e.target.value)}
                          className="flex-1 rounded-lg border border-line bg-page px-2 py-1.5 text-sm text-ink outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                        >
                          <option value="">None</option>
                          {clients.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                        <Button
                          className="min-h-0 px-3 py-1.5 text-xs"
                          disabled={assigning}
                          onClick={() => void handleAssignClient()}
                        >
                          {assigning ? "…" : "Save"}
                        </Button>
                      </div>
                    </div>

                    {/* Assign plan */}
                    <div className="mb-4 border-t border-line pt-4">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Plan</p>
                      <div className="flex gap-2">
                        <select
                          value={assignTier}
                          onChange={(e) => setAssignTier(e.target.value)}
                          className="flex-1 rounded-lg border border-line bg-page px-2 py-1.5 text-sm text-ink outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                        >
                          <option value="">None</option>
                          {TIERS.map((t) => (
                            <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                          ))}
                        </select>
                        <Button
                          className="min-h-0 px-3 py-1.5 text-xs"
                          disabled={assigning}
                          onClick={() => void handleAssignPlan()}
                        >
                          {assigning ? "…" : "Save"}
                        </Button>
                      </div>
                      <p className="mt-1.5 text-xs text-muted">✦ = admin-assigned, not billed.</p>
                    </div>

                    {/* Subscriptions */}
                    {selectedUser.subscriptions.length > 0 && (
                      <div className="mb-4 border-t border-line pt-4">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Subscriptions</p>
                        {selectedUser.subscriptions.map((sub) => (
                          <div key={sub.id} className="mb-2 last:mb-0">
                            <div className="flex items-center gap-1.5">
                              <span className={`rounded-full px-1.5 py-0.5 text-xs font-medium ${tierBadge(sub.tier)}`}>
                                {sub.tier ?? "—"}{sub.manual_override && " ✦"}
                              </span>
                              <span className={`rounded-full px-1.5 py-0.5 text-xs ${statusBadge(sub.status)}`}>
                                {sub.status}
                              </span>
                            </div>
                            {sub.current_period_end && (
                              <p className="mt-0.5 text-xs text-muted">Expires {fmtDate(sub.current_period_end)}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Domains */}
                    {selectedUser.domains.length > 0 && (
                      <div className="mb-4 border-t border-line pt-4">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
                          Domains ({selectedUser.domains.length})
                        </p>
                        {selectedUser.domains.map((d) => (
                          <div key={d.id} className="mb-1.5 flex items-center justify-between last:mb-0">
                            <span className="truncate text-xs font-medium">{d.hostname}</span>
                            <span className={`ml-2 shrink-0 rounded-full px-1.5 py-0.5 text-xs ${
                              d.verification_status === "verified" ? "bg-green-100 text-green-700" : "bg-line/30 text-muted"
                            }`}>
                              {d.verification_status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Recent scans */}
                    {selectedUser.scans.length > 0 && (
                      <div className="border-t border-line pt-4">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Recent Scans</p>
                        {selectedUser.scans.slice(0, 8).map((s) => (
                          <div key={s.id} className="mb-1.5 flex items-center justify-between last:mb-0">
                            <span className="text-xs text-muted">{s.scan_type}</span>
                            <span className="text-xs text-muted">{fmtDate(s.created_at)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        )}

        {/* CLIENTS VIEW */}
        {view === "clients" && (
          <div className="flex items-start gap-4">
            {/* Client list */}
            <div className="min-w-0 flex-1">
              {loading ? (
                <p className="py-8 text-center text-sm text-muted">Loading…</p>
              ) : clients.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted">No clients yet. Create one below.</p>
              ) : (
                <div className="overflow-hidden rounded-xl border border-line bg-panel">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-line text-left text-muted">
                        <th className="px-4 py-3 font-medium">Client</th>
                        <th className="px-4 py-3 font-medium">Contact</th>
                        <th className="px-4 py-3 font-medium">Users</th>
                        <th className="px-4 py-3 font-medium">Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clients.map((c) => (
                        <tr
                          key={c.id}
                          onClick={() => {
                            setView("users");
                            setClientFilter(c.id);
                          }}
                          className="cursor-pointer border-b border-line/50 transition-colors last:border-0 hover:bg-line/10"
                        >
                          <td className="px-4 py-3 font-medium">{c.name}</td>
                          <td className="px-4 py-3 text-muted">{c.contact_email ?? "—"}</td>
                          <td className="px-4 py-3 text-muted">{c.user_count}</td>
                          <td className="px-4 py-3 text-muted">{fmtDate(c.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Create client form */}
            <div className="w-80 shrink-0 rounded-xl border border-line bg-panel p-5">
              <p className="mb-4 text-sm font-semibold">New Client</p>
              <form onSubmit={(e) => void handleCreateClient(e)} className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted">Name *</label>
                  <input
                    required
                    className={inputClass}
                    placeholder="Acme Corp"
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted">Contact email</label>
                  <input
                    type="email"
                    className={inputClass}
                    placeholder="owner@acme.com"
                    value={newClientEmail}
                    onChange={(e) => setNewClientEmail(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted">Notes</label>
                  <textarea
                    rows={2}
                    className={`${inputClass} resize-none`}
                    placeholder="Any internal notes…"
                    value={newClientNotes}
                    onChange={(e) => setNewClientNotes(e.target.value)}
                  />
                </div>
                <Button type="submit" disabled={creatingClient} className="w-full">
                  {creatingClient ? "Creating…" : "Create Client"}
                </Button>
                {clientFeedback && (
                  <p className={`text-xs ${clientFeedback.ok ? "text-accent" : "text-red-600"}`}>
                    {clientFeedback.msg}
                  </p>
                )}
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
