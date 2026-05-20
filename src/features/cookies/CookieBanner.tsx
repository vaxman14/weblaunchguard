import { useState } from "react";
import { Button } from "../../components/Button";
import { Card } from "../../components/Card";

const COOKIE_KEY = "wlg_cookie_ack";

function readCookieAck() {
  try {
    return window.localStorage.getItem(COOKIE_KEY) === "true";
  } catch {
    return false;
  }
}

function writeCookieAck() {
  try {
    window.localStorage.setItem(COOKIE_KEY, "true");
  } catch {
    return;
  }
}

export function CookieBanner() {
  const [accepted, setAccepted] = useState(readCookieAck);

  if (accepted) {
    return null;
  }

  const accept = () => {
    writeCookieAck();
    setAccepted(true);
  };

  return (
    <Card
      className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-4xl flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between"
      role="region"
      aria-label="Functional cookie notice"
    >
      <p className="max-w-2xl text-sm leading-6 text-muted">
        Web Launch Guard uses functional cookies and local preferences to remember your theme, cookie
        acknowledgement, and signed-in session. We do not add marketing cookies by default.{" "}
        <a className="underline hover:text-accent" href="#cookies">Cookie Policy</a>.
      </p>
      <Button className="shrink-0" onClick={accept}>
        Accept
      </Button>
    </Card>
  );
}
