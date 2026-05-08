import { Search } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "../../components/Button";

type ScanFormProps = {
  disabled?: boolean;
  onSubmit: (url: string) => void;
};

export function ScanForm({ disabled = false, onSubmit }: ScanFormProps) {
  const [url, setUrl] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(url.trim());
  }

  return (
    <form className="grid gap-3 sm:grid-cols-[1fr_auto]" onSubmit={handleSubmit}>
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
      <Button className="self-end whitespace-nowrap" disabled={disabled} type="submit">
        <Search aria-hidden="true" size={18} />
        {disabled ? "Scanning" : "Scan site"}
      </Button>
    </form>
  );
}
