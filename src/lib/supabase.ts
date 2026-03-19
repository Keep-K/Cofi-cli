import { createClient } from "@supabase/supabase-js";
import { config } from "./config.js";

const SUPABASE_URL = "https://mdxfpzsgutlayylqrqxd.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1keGZwenNndXRsYXl5bHFycXhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1MzQxMDMsImV4cCI6MjA4ODExMDEwM30.dRybyDbMCDqZXv6fDUQUi0AdhVggzFOWfiOY94b3MW4";

export function getSupabaseClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: config.isLoggedIn()
        ? { Authorization: `Bearer ${config.get("accessToken")}` }
        : {},
    },
  });
}

/** access_token 만료 시 refresh_token으로 갱신 */
export async function refreshSession(): Promise<boolean> {
  const refreshToken = config.get("refreshToken");
  if (!refreshToken) return false;

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
  if (error || !data.session) return false;

  config.set("accessToken", data.session.access_token);
  config.set("refreshToken", data.session.refresh_token);
  return true;
}

/**
 * JWT 만료 시 자동으로 토큰을 갱신하고 콜백을 재실행합니다.
 * 커맨드 action에서 DB 호출 전 래핑해서 사용하세요.
 */
export async function withAuth<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "PGRST303" || code === "PGRST301") {
      // JWT 만료 → refresh 후 재시도
      const ok = await refreshSession();
      if (!ok) {
        throw new Error("세션이 만료됐습니다. cofi_cli auth login 으로 다시 로그인하세요.");
      }
      return await fn();
    }
    throw err;
  }
}
