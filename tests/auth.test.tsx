import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";
import type { AuthContextValue } from "../src/lib/auth";
import { ThemeProvider } from "../src/lib/theme";
import { AuthPage } from "../src/pages/AuthPage";

const authMocks = vi.hoisted(() => ({
  state: {} as AuthContextValue
}));

vi.mock("../src/lib/auth", () => ({
  useAuth: () => authMocks.state
}));

beforeEach(() => {
  authMocks.state = {
    authError: null,
    loading: false,
    session: null,
    signInWithGoogle: vi.fn().mockResolvedValue({ error: null }),
    signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    signUpWithPassword: vi.fn().mockResolvedValue({ error: null }),
    user: null
  };
});

function renderAuthPage() {
  return render(
    <ThemeProvider>
      <AuthPage />
    </ThemeProvider>
  );
}

test("renders email, password, sign-in, sign-up, and Google controls", () => {
  renderAuthPage();

  expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  expect(screen.getAllByRole("tab", { name: /sign in/i }).length).toBeGreaterThan(0);
  expect(screen.getAllByRole("tab", { name: /sign up/i }).length).toBeGreaterThan(0);
  expect(screen.getByRole("button", { name: /continue with google/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /^sign in$/i })).toBeInTheDocument();
});

test("submits email and password to the sign-in method", async () => {
  const user = userEvent.setup();
  renderAuthPage();

  await user.type(screen.getByLabelText(/email/i), "founder@example.com");
  await user.type(screen.getByLabelText(/password/i), "launchpass");
  await user.click(screen.getByRole("button", { name: /^sign in$/i }));

  expect(authMocks.state.signInWithPassword).toHaveBeenCalledWith("founder@example.com", "launchpass");
  expect(authMocks.state.signUpWithPassword).not.toHaveBeenCalled();
});

test("submits email and password to the sign-up method after mode toggle", async () => {
  const user = userEvent.setup();
  renderAuthPage();

  await user.click(screen.getByRole("tab", { name: /sign up/i }));
  await user.type(screen.getByLabelText(/email/i), "new@example.com");
  await user.type(screen.getByLabelText(/password/i), "launchpass");
  await user.click(screen.getByRole("button", { name: /^sign up$/i }));

  expect(authMocks.state.signUpWithPassword).toHaveBeenCalledWith("new@example.com", "launchpass");
  expect(authMocks.state.signInWithPassword).not.toHaveBeenCalled();
});

test("calls the Google sign-in method", async () => {
  const user = userEvent.setup();
  renderAuthPage();

  await user.click(screen.getByRole("button", { name: /continue with google/i }));

  expect(authMocks.state.signInWithGoogle).toHaveBeenCalledTimes(1);
});
