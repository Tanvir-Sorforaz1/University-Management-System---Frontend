"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("ums-theme");
    const shouldUseDarkMode = savedTheme ? savedTheme === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("dark", shouldUseDarkMode);
    setDarkMode(shouldUseDarkMode);
  }, []);

  function toggleDarkMode() {
    const nextDarkMode = !darkMode;
    document.documentElement.classList.toggle("dark", nextDarkMode);
    window.localStorage.setItem("ums-theme", nextDarkMode ? "dark" : "light");
    setDarkMode(nextDarkMode);
  }

  return (
    <button className="icon-button" type="button" onClick={toggleDarkMode} aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"} title={darkMode ? "Switch to light mode" : "Switch to dark mode"}>
      {darkMode ? <Sun size={19} /> : <Moon size={19} />}
    </button>
  );
}