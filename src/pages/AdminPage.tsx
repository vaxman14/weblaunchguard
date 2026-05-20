import { useCallback, useEffect, useState } from "react";
import { Button } from "../components/Button";
import { useAuth } from "../lib/auth";

type SubscriptionRow = {
  billing_interval: string | null;
  current_period_end: string | null;
  id: string;
  manual_override: boolean;
  status: string;
  tier: string | null;
};

type UserRow = {
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

export function AdminPage({ onBack }: AdminPageProps) {
  const { session } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [assignTier, setAssignTier] = useState<string>("");
  const [assigning, setAssigning] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  const load = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    const [statsRes, usersRes] = await Promise.all([
      adminCall(session.access_token, { action: "stats" }),
      adminCall(session.access_token, { action: "list-users" })
    ]);
    setStats(statsRes.error ? null : statsRes);
    setUsers(usersRes.users ?? []);
    setLoading(false);
  }, [session]);

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
    }
    setDetailLoading(false);
  }

  async function handleAssign() {
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
      const updated = await adminCall(session.access_token, {
        action: "get-user",
        userId: selectedUser.profile.id
      });
      if (!updated.error) {
        setSelectedUser(updated);
        setAssignTier(updated.subscriptions?.[0]?.tier ?? "");
      }
    }
    setAssigning(false);
  }

  const filtered = users.filter(
    (u) =>
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-page text-ink">
      <div className="mx-auto max-w-7xl px-6 py-6 sm:px-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-lg font-semibold">Web Launch Guard — Admin</p>
            <p className="mt-0.5 text-sm text-muted">Manage users and plans.</p>
          </div>
          <Button variant="ghost" onClick={onBack}>
            ← Dashboard
          </Button>
        </div>

        {/* Stats */}
        {stats && (
          <div className="mb-6 grid grid-cols-3 gap-4">
            {[
              { label: "Total Users", value: stats.total_users },
              { label: "Paying Users", value: stats.paying_users },
              { label: "Scans Today", value: stats.scans_today }
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-line bg-panel p-4">
                <div className="text-2xl font-bold text-ink">{s.value}</div>
                <div className="mt-1 text-sm text-muted">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-start gap-4">
          {/* Users table */}
          <div className="min-w-0 flex-1">
            <div className="mb-3">
              <input
                className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm text-ink outline-none placeholder:text-muted focus-visible:outline focus-visible:outline-3 focus-visible:outline-accent"
                placeholder="Search by email or name…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {loading ? (
              <p className="py-8 text-center text-sm text-muted">Loading users…</p>
            ) : (
              <div className="overflow-hidden rounded-xl border border-line bg-panel">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-muted">
                      <th className="px-4 py-3 font-medium">Email</th>
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
                        <td colSpan={6} className="px-4 py-8 text-center text-muted">
                          No users found.
                        </td>
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
                          <td className="max-w-[200px] truncate px-4 py-3 font-medium">
                            {user.email}
                            {user.is_admin && (
                              <span className="ml-1.5 rounded bg-yellow-100 px-1.5 py-0.5 text-xs text-yellow-700">
                                admin
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${tierBadge(user.subscription?.tier ?? null)}`}
                            >
                              {user.subscription?.tier ?? "none"}
                              {user.subscription?.manual_override && " ✦"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs ${statusBadge(user.subscription?.status ?? null)}`}
                            >
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
          </div>

          {/* Detail panel */}
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

                  {/* Assign plan */}
                  <div className="mb-4 border-t border-line pt-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Assign Plan</p>
                    <div className="flex gap-2">
                      <select
                        value={assignTier}
                        onChange={(e) => setAssignTier(e.target.value)}
                        className="flex-1 rounded-lg border border-line bg-page px-2 py-1.5 text-sm text-ink outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                      >
                        <option value="">None</option>
                        {TIERS.map((t) => (
                          <option key={t} value={t}>
                            {t.charAt(0).toUpperCase() + t.slice(1)}
                          </option>
                        ))}
                      </select>
                      <Button
                        className="min-h-0 px-3 py-1.5 text-xs"
                        disabled={assigning}
                        onClick={() => void handleAssign()}
                      >
                        {assigning ? "…" : "Save"}
                      </Button>
                    </div>
                    {feedback && (
                      <p className={`mt-2 text-xs ${feedback.ok ? "text-accent" : "text-red-600"}`}>
                        {feedback.msg}
                      </p>
                    )}
                    <p className="mt-1.5 text-xs text-muted">✦ = admin-assigned, not billed via Stripe.</p>
                  </div>

                  {/* Subscriptions */}
                  {selectedUser.subscriptions.length > 0 && (
                    <div className="mb-4 border-t border-line pt-4">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Subscriptions</p>
                      {selectedUser.subscriptions.map((sub) => (
                        <div key={sub.id} className="mb-2 last:mb-0">
                          <div className="flex items-center gap-1.5">
                            <span className={`rounded-full px-1.5 py-0.5 text-xs font-medium ${tierBadge(sub.tier)}`}>
                              {sub.tier ?? "—"}
                              {sub.manual_override && " ✦"}
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
                          <span
                            className={`ml-2 shrink-0 rounded-full px-1.5 py-0.5 text-xs ${
                              d.verification_status === "verified"
                                ? "bg-green-100 text-green-700"
                                : "bg-line/30 text-muted"
                            }`}
                          >
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
      </div>
    </div>
  );
}
