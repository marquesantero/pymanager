import { ThemeMode, StatusFilter, StudioTabId } from "../types";
import { Sun, Moon, Monitor, Package, Play, FileText, ShieldCheck } from "lucide-react";
import React from "react";

export const THEME_OPTIONS: { mode: ThemeMode; icon: any }[] = [
  { mode: "light", icon: Sun },
  { mode: "dark", icon: Moon },
  { mode: "system", icon: Monitor },
];

export const STATUS_FILTERS: StatusFilter[] = ["All", "Healthy", "Broken"];

export const STUDIO_TABS: { id: StudioTabId; label: string; icon: any }[] = [
  { id: "packages", label: "Packages", icon: Package },
  { id: "automation", label: "Automation", icon: Play },
  { id: "config", label: "Config (.env)", icon: FileText },
  { id: "diagnostics", label: "Diagnostics", icon: ShieldCheck },
];
