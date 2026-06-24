import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import App from "../src/App";

test("renders the public homepage as a free tool with CTF Designs funnel", () => {
  render(<App />);

  expect(screen.getAllByText(/Web Launch Guard/i).length).toBeGreaterThan(0);
  // Free framing, lead-magnet flow.
  expect(screen.getByRole("heading", { name: /costing you customers/i })).toBeInTheDocument();
  expect(screen.getAllByText(/free/i).length).toBeGreaterThan(0);
  expect(screen.queryByRole("button", { name: /annual/i })).toBeNull();
  // CTF Designs lead funnel is present.
  expect(screen.getAllByText(/CTF Designs/i).length).toBeGreaterThan(0);
});
