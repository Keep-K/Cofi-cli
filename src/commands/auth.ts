import { Command } from "commander";
import { createServer } from "http";
import { createClient } from "@supabase/supabase-js";
import open from "open";
import chalk from "chalk";
import ora from "ora";
import { config } from "../lib/config.js";
import { select } from "@inquirer/prompts";

const SUPABASE_URL = "https://mdxfpzsgutlayylqrqxd.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1keGZwenNndXRsYXl5bHFycXhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1MzQxMDMsImV4cCI6MjA4ODExMDEwM30.dRybyDbMCDqZXv6fDUQUi0AdhVggzFOWfiOY94b3MW4";
const CLI_PORT = 54321;
const CALLBACK_URL = `http://localhost:${CLI_PORT}/callback`;

type OAuthProvider = "google" | "apple" | "github";

export const authCommand = new Command("auth").description("인증 관련 커맨드");

authCommand
  .command("login")
  .description("OAuth 로그인 또는 PAT 토큰으로 로그인")
  .option("--token <pat>", "Personal Access Token 직접 입력")
  .action(async (opts) => {
    if (opts.token) {
      await loginWithPAT(opts.token as string);
    } else {
      await loginWithOAuth();
    }
  });

authCommand
  .command("logout")
  .description("로그아웃 (로컬 토큰 삭제)")
  .action(() => {
    config.clear();
    console.log(chalk.green("✓ 로그아웃 완료"));
  });

authCommand
  .command("status")
  .description("현재 로그인 상태 확인")
  .action(() => {
    if (!config.isLoggedIn()) {
      console.log(chalk.yellow("로그인되지 않은 상태입니다."));
      console.log("  " + chalk.dim("cofi_cli auth login") + " 으로 로그인하세요.");
      return;
    }
    const { email, provider, userId } = config.getAll();
    console.log(chalk.green("✓ 로그인 중"));
    console.log(`  이메일   : ${email ?? "(없음)"}`);
    console.log(`  제공자   : ${provider}`);
    console.log(`  user id  : ${userId}`);
  });

async function loginWithOAuth() {
  const provider = await select<OAuthProvider>({
    message: "로그인 제공자를 선택하세요",
    choices: [
      { name: "Google", value: "google" },
      { name: "Apple", value: "apple" },
      { name: "GitHub", value: "github" },
    ],
  });

  // PKCE: code_verifier가 이 클라이언트 인스턴스에 보관됨
  // exchangeCodeForSession도 반드시 같은 인스턴스로 호출해야 함
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { flowType: "pkce", persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: CALLBACK_URL, skipBrowserRedirect: true },
  });

  if (error || !data.url) {
    console.error(chalk.red("OAuth URL 생성 실패:"), error?.message);
    process.exit(1);
  }

  const spinner = ora("브라우저에서 인증을 완료해주세요...").start();
  await open(data.url);

  const tokenData = await waitForCallback(supabase);
  spinner.stop();

  if (!tokenData) {
    console.error(chalk.red("인증 실패 또는 타임아웃"));
    process.exit(1);
  }

  const { data: userData, error: userError } = await supabase.auth.getUser(tokenData.access_token);
  if (userError || !userData.user) {
    console.error(chalk.red("유저 정보 조회 실패:"), userError?.message);
    process.exit(1);
  }

  config.set("accessToken", tokenData.access_token);
  config.set("refreshToken", tokenData.refresh_token);
  config.set("userId", userData.user.id);
  config.set("email", userData.user.email ?? "");
  config.set("provider", provider);

  console.log(chalk.green(`✓ 로그인 완료 (${provider})`));
  console.log(`  ${userData.user.email}`);
  process.exit(0);
}

async function loginWithPAT(token: string) {
  const spinner = ora("토큰 검증 중...").start();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/pat-verify`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    spinner.fail("토큰이 유효하지 않습니다.");
    process.exit(1);
  }

  const { userId, email } = (await res.json()) as { userId: string; email: string };
  spinner.stop();

  config.set("accessToken", token);
  config.set("userId", userId);
  config.set("email", email);
  config.set("provider", "pat");

  console.log(chalk.green("✓ PAT 로그인 완료"));
  console.log(`  ${email}`);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function waitForCallback(supabase: any): Promise<{ access_token: string; refresh_token: string } | null> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      server.close();
      resolve(null);
    }, 120_000);

    const done = (result: { access_token: string; refresh_token: string } | null) => {
      clearTimeout(timeout);
      server.close();
      resolve(result);
    };

    const server = createServer(async (req, res) => {
      if (!req.url) return;
      const url = new URL(req.url, `http://localhost:${CLI_PORT}`);

      if (url.pathname === "/callback") {
        const code = url.searchParams.get("code");
        if (!code) {
          res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
          res.end(`<h2>오류: code 없음</h2>`);
          done(null);
          return;
        }
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (error || !data.session) {
          res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
          res.end(`<h2>인증 실패</h2><p>${error?.message ?? "세션 없음"}</p><p>터미널을 확인하세요.</p>`);
          done(null);
          return;
        }
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(`<!DOCTYPE html><html><body>
          <h2>&#10003; 로그인 완료!</h2>
          <p>이 창을 닫고 터미널로 돌아가세요.</p>
          <script>window.close();</script>
        </body></html>`);
        done({ access_token: data.session.access_token, refresh_token: data.session.refresh_token });
      }
    });

    server.listen(CLI_PORT, "127.0.0.1");
  });
}
