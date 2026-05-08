import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import App from "../src/App";

test("renders the public homepage with the three pricing tiers", () => {
  render(<App />);

  expect(screen.getByRole("heading", { name: "Web Launch Guard" })).toBeInTheDocument();
  expect(screen.getAllByText(/CTFDigital/).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/Basic/).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/Pro/).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/Enterprise/).length).toBeGreaterThan(0);
  expect(screen.getByRole("button", { name: /annual/i })).toBeInTheDocument();
});
