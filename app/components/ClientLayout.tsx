"use client";

import { ThemeProvider } from "../context/ThemeContext";
import { ThemeToggle } from "./ThemeToggle";
import { UnicornBackground } from "./UnicornBackground";

export function ClientLayout(props: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <div className="lt_root">
        <UnicornBackground />
        <ThemeToggle />
        {props.children}
      </div>
    </ThemeProvider>
  );
}
