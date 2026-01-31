"use client";

import { useTheme } from "../context/ThemeContext";

export function ThemeToggle() {
  const { theme, cycleTheme } = useTheme();

  const label = theme === "dark" ? "Dark" : theme === "light" ? "Light" : "Party!";
  const icon = theme === "dark" ? "🌙" : theme === "light" ? "☀️" : "🦄";

  const party = theme === "unicorn";

  return (
    <button
      type="button"
      className={party ? "lt_btn lt_btn_party" : "lt_btn"}
      onClick={cycleTheme}
      aria-label="Toggle theme"
      title="Toggle theme"
    >
      <span className="lt_icon">{icon}</span>
      <span className="lt_label">{label}</span>
    </button>
  );
}
