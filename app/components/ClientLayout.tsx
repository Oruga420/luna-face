"use client";

import { ThemeProvider } from "../context/ThemeContext";
import { UnicornBackground } from "./UnicornBackground";

export function ClientLayout(props: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <div className="lt_root">
        <UnicornBackground />
        {props.children}
      </div>
    </ThemeProvider>
  );
}
