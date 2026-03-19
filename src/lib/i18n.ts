import { config } from "./config.js";

export function getLang(): "ko" | "en" {
  return config.get("lang") ?? "ko";
}

export function t(ko: string, en: string): string {
  return getLang() === "en" ? en : ko;
}
