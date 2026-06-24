import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test } from "vitest";
import App from "../src/App";

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
});

test("shows the functional cookie banner until it is accepted", async () => {
  render(<App />);

  expect(screen.getByText(/functional cookies/i)).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: /accept/i }));

  expect(screen.queryByText(/functional cookies/i)).not.toBeInTheDocument();
  expect(localStorage.getItem("wlg_cookie_ack")).toBe("true");
});

test("cycles theme preferences and persists the selected mode", async () => {
  render(<App />);

  const toggle = screen.getByRole("button", { name: /theme/i });

  // Default theme is now "dark" (CTF family); cycle order: dark -> system -> light -> dark.
  await userEvent.click(toggle);
  expect(localStorage.getItem("wlg_theme")).toBe("system");

  await userEvent.click(toggle);
  expect(localStorage.getItem("wlg_theme")).toBe("light");
  expect(document.documentElement).toHaveAttribute("data-theme", "light");

  await userEvent.click(toggle);
  expect(localStorage.getItem("wlg_theme")).toBe("dark");
  expect(document.documentElement).toHaveAttribute("data-theme", "dark");
});
