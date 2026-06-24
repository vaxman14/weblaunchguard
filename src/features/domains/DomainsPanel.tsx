import { CheckCircle2, Clipboard, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";
import { createDomain, deleteDomain, verifyDomain, type DomainRow, type SubscriptionRow } from "../../lib/api";

type DomainsPanelProps = {
  accessToken?: string | null;
  domains: DomainRow[];
  onDomainsChanged: () => Promise<void> | void;
  subscriptions: SubscriptionRow[];
};

export function DomainsPanel({ accessToken, domains, onDomainsChanged, subscriptions }: DomainsPanelProps) {
  const [hostname, setHostname] = useState("");
  const [creating, setCreating] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Free tool: every account has exactly one invisible comp subscription. We
  // attach domains to it automatically — no plan picker.
  const subscriptionId = subscriptions[0]?.id ?? "";

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setInfo(null);

    if (!subscriptionId) {
      setError("Your account is still being set up. Refresh in a moment and try again.");
      return;
    }

    setCreating(true);
    try {
      const result = await createDomain({ accessToken, hostname, subscriptionId });
      setInfo(`${result.domain.hostname} added. Publish the DNS TXT record below, then verify.`);
      setHostname("");
      await onDomainsChanged();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Domain could not be created.");
    } finally {
      setCreating(false);
    }
  }

  async function handleVerify(domain: DomainRow) {
    setError(null);
    setInfo(null);
    setVerifyingId(domain.id);

    try {
      const result = await verifyDomain({ accessToken, domainId: domain.id });
      setInfo(
        result.verified
          ? `${result.hostname} is verified.`
          : `${result.hostname} is still pending. The expected TXT record was not found yet.`
      );
      await onDomainsChanged();
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : "Verification check failed.");
    } finally {
      setVerifyingId(null);
    }
  }

  async function handleRemove(domain: DomainRow) {
    setError(null);
    setInfo(null);
    setRemovingId(domain.id);

    try {
      await deleteDomain({ accessToken, domainId: domain.id });
      setInfo(`${domain.hostname} removed.`);
      await onDomainsChanged();
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Domain could not be removed.");
    } finally {
      setRemovingId(null);
    }
  }

  async function copy(value: string) {
    if (!navigator.clipboard) {
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // ignore — manual selection still works.
    }
  }

  return (
    <Card aria-labelledby="domains-heading" className="p-6">
      <div className="mb-5 flex items-start gap-3">
        <span className="mt-1 rounded-lg border border-line bg-page p-2 text-accent">
          <ShieldCheck aria-hidden="true" size={20} />
        </span>
        <div>
          <h2 className="text-2xl font-semibold text-ink" id="domains-heading">
            Domains
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Add a domain, publish the DNS TXT record we generate for you, then verify ownership.
          </p>
        </div>
      </div>

      <form className="grid gap-3 sm:grid-cols-[1fr_auto]" onSubmit={handleCreate}>
        <div>
          <label className="text-sm font-semibold text-ink" htmlFor="domains-hostname">
            Hostname
          </label>
          <input
            autoComplete="url"
            className="mt-2 min-h-11 w-full rounded-lg border border-line bg-page px-3 text-ink shadow-sm focus:border-accent"
            id="domains-hostname"
            onChange={(event) => setHostname(event.target.value)}
            placeholder="example.com"
            required
            type="text"
            value={hostname}
          />
        </div>
        <Button className="self-end whitespace-nowrap" disabled={creating} type="submit">
          <Plus aria-hidden="true" size={18} />
          {creating ? "Adding" : "Add domain"}
        </Button>
      </form>

      {info ? (
        <p className="mt-4 rounded-lg border border-line bg-page px-3 py-2 text-sm text-ink" role="status">
          {info}
        </p>
      ) : null}
      {error ? (
        <p className="mt-4 rounded-lg border border-line bg-page px-3 py-2 text-sm text-ink" role="alert">
          {error}
        </p>
      ) : null}

      {domains.length > 0 ? (
        <ul className="mt-6 space-y-4" aria-label="Registered domains">
          {domains.map((domain) => {
            const txtName = `_weblaunchguard.${domain.hostname}`;
            const txtValue = domain.verification_token
              ? `weblaunchguard-verify=${domain.verification_token}`
              : "weblaunchguard-verify=pending";

            return (
              <li className="rounded-lg border border-line bg-page p-4" key={domain.id}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold text-ink">{domain.hostname}</p>
                    <p className="mt-1 text-xs text-muted">
                      Status: {domain.verification_status}
                      {domain.verified_at ? ` · Verified ${new Date(domain.verified_at).toLocaleString()}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      className="min-h-9 px-3 py-1.5"
                      disabled={verifyingId === domain.id}
                      onClick={() => handleVerify(domain)}
                      variant={domain.verification_status === "verified" ? "ghost" : "primary"}
                    >
                      <CheckCircle2 aria-hidden="true" size={16} />
                      {verifyingId === domain.id ? "Checking" : "Check DNS"}
                    </Button>
                    <Button
                      className="min-h-9 px-3 py-1.5"
                      disabled={removingId === domain.id}
                      onClick={() => handleRemove(domain)}
                      variant="ghost"
                    >
                      <Trash2 aria-hidden="true" size={16} />
                      {removingId === domain.id ? "Removing" : "Remove"}
                    </Button>
                  </div>
                </div>
                <div className="mt-3 grid gap-2 text-xs sm:grid-cols-[8rem_1fr_auto]">
                  <p className="font-semibold uppercase tracking-[0.12em] text-muted">TXT name</p>
                  <code className="break-all rounded-md bg-panel px-2 py-1 text-sm text-ink">{txtName}</code>
                  <Button className="min-h-8 px-2 py-1" onClick={() => copy(txtName)} variant="secondary">
                    <Clipboard aria-hidden="true" size={14} /> Copy
                  </Button>
                </div>
                <div className="mt-2 grid gap-2 text-xs sm:grid-cols-[8rem_1fr_auto]">
                  <p className="font-semibold uppercase tracking-[0.12em] text-muted">TXT value</p>
                  <code className="break-all rounded-md bg-panel px-2 py-1 text-sm text-ink">{txtValue}</code>
                  <Button className="min-h-8 px-2 py-1" onClick={() => copy(txtValue)} variant="secondary">
                    <Clipboard aria-hidden="true" size={14} /> Copy
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </Card>
  );
}
