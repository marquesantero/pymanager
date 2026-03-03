export interface VenvInfo {
  name: string;
  path: string;
  version: string;
  status: string;
  issue?: string;
  last_modified: number;
  manager_type: "pip" | "uv";
}

export interface VenvDetails {
  packages: string[];
  size_mb: number;
}

export interface OutdatedPackage {
  name: string;
  version: string;
  latest_version: string;
}

export interface Script {
  id: number;
  name: string;
  command: string;
}

export interface ManagerStatus {
  uv: boolean;
  poetry: boolean;
  pdm: boolean;
}

export interface ToastMessage {
  id: number;
  text: string;
  tone: "info" | "success" | "error";
}

export interface Template {
  id: string;
  name: string;
  pkgs: string[];
}

export type ThemeMode = "light" | "dark" | "system";
export type StatusFilter = "All" | "Healthy" | "Broken";
export type StudioTabId = "packages" | "automation" | "config" | "diagnostics";
