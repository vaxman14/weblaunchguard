import { Search } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "../../components/Button";

type ScanFormProps = {
  disabled?: boolean;
  onSubmit: (url: string) => void;
};

export function ScanForm({ disabled = false, onSubmit }: ScanFormProps) {
  const [url, setUrl] = useState("");
  const [agreed, setAgreed] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!agreed) return;
    onSubmit(url.trim());
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <div>
          <label className="text-sm font-semibold text-ink" htmlFor="scan-url">
            Website URL
          </label>
          <input
            className="mt-2 min-h-11 w-full rounded-lg border border-line bg-page px-3 text-ink shadow-sm focus:border-accent"
            id="scan-url"
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://example.com"
            required
            type="url"
            value={url}
          />
        </div>
        <Button className="self-end whitespace-nowrap" disabled={disabled || !agreed} type="submit">
          <Search aria-hidden="true" size={18} />
          {disabled ? "Scanning" : "Scan site"}
        </Button>
      </div>
      <label className="flex items-start gap-2 text-sm text-muted" htmlFor="scan-agree">
        <input
          checked={agreed}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-line text-accent focus:ring-accent"
          id="scan-agree"
          onChange={(event) => setAgreed(event.target.checked)}
          type="checkbox"
        />
        <span>
          I agree to the{" "}
          <a className="font-semibold text-accent hover:text-accent-strong" href="#terms">
            Terms of Service
          </a>{" "}
          and understand this is a free informational tool, not a professional security audit.
        </span>
      </label>
    </form>
  );
}
