import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "../lib/theme";
import { Button } from "./Button";

const labels = {
  light: "Light theme",
  dark: "Dark theme",
  system: "System theme"
};

export function ThemeToggle() {
  const { theme, cycleTheme } = useTheme();
  const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;

  return (
    <Button
      aria-label={`Theme preference: ${labels[theme]}`}
      className="min-h-10 px-3"
      onClick={cycleTheme}
      variant="secondary"
    >
      <Icon aria-hidden="true" className="h-4 w-4" />
      <span className="hidden sm:inline">{labels[theme]}</span>
    </Button>
  );
}
