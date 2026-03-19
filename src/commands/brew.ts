import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { input, select, number, confirm } from "@inquirer/prompts";
import { BrewService } from "@cofi/core/services/brew.service";
import { getSupabaseClient, withAuth } from "../lib/supabase.js";
import { config } from "../lib/config.js";

export const brewCommand = new Command("brew").description("추출 기록 관리");

brewCommand
  .command("list")
  .description("추출 기록 목록")
  .option("-p, --page <n>", "페이지 번호", "1")
  .action(async (opts) => {
    requireLogin();
    const spinner = ora("불러오는 중...").start();
    try {
      const logs = await withAuth(() => new BrewService(getSupabaseClient()).list(config.get("userId")!, Number(opts.page)));
      spinner.stop();

      if (!logs || logs.length === 0) {
        console.log(chalk.dim("추출 기록이 없습니다."));
        return;
      }
      for (const l of logs) {
        const score = l.overall_score != null ? chalk.yellow(`★ ${l.overall_score}`) : "";
        console.log(`${chalk.bold(l.recipe_name ?? "(이름 없음)")}  ${chalk.dim(l.created_at?.slice(0, 10) ?? "")}  ${score}`);
      }
    } catch (err: unknown) {
      spinner.stop();
      const msg = err instanceof Error ? err.message : JSON.stringify(err);
      console.error(chalk.red("오류:"), msg);
      process.exit(1);
    }
  });

brewCommand
  .command("new")
  .description("추출 기록 추가 (인터랙티브)")
  .action(async () => {
    requireLogin();
    const db = getSupabaseClient();
    try {
    // 원두 선택
    const { data: beans } = await db.from("beans").select("id, name").eq("user_id", config.get("userId")!);
    if (!beans || beans.length === 0) {
      console.error(chalk.red("등록된 원두가 없습니다. cofi_cli bean add 로 먼저 추가하세요."));
      process.exit(1);
    }
    const beanId = await select({
      message: "사용한 원두",
      choices: beans.map((b) => ({ name: b.name, value: b.id })),
    });

    // 브루잉 도구 선택
    const { data: methods } = await db.from("brewing_methods").select("id, name");
    const methodId = await select({
      message: "브루잉 도구",
      choices: (methods ?? []).map((m) => ({ name: m.name, value: m.id })),
    });

    const beanWeightG = await number({ message: "원두 무게 (g)" }) ?? 0;
    const waterTotalMl = await number({ message: "총 물 양 (ml)" }) ?? 0;

    const useGrinder = await confirm({ message: "그라인더 정보 입력?", default: false });
    let grinderId: string | undefined;
    let grinderClick: number | undefined;
    if (useGrinder) {
      const { data: grinders } = await db.from("grinders").select("id, brand, model");
      grinderId = await select({
        message: "그라인더",
        choices: (grinders ?? []).map((g) => ({ name: `${g.brand} ${g.model}`, value: g.id })),
      });
      grinderClick = await number({ message: "클릭 수" }) ?? undefined;
    }

    const overallScore = await number({ message: "추출 점수 (1-10, 건너뛰면 Enter)" });
    const tasteNotes = await input({ message: "맛 메모 (선택)" });

    const spinner = ora("저장 중...").start();
    await withAuth(() => new BrewService(getSupabaseClient()).create(config.get("userId")!, {
      beanId,
      methodId,
      beanWeightG,
      waterTotalMl,
      ...(grinderId !== undefined ? { grinderId } : {}),
      ...(grinderClick !== undefined ? { grinderClick } : {}),
      ...(overallScore !== undefined ? { overallScore } : {}),
      ...(tasteNotes ? { tasteNotes } : {}),
    }));
    spinner.stop();
    console.log(chalk.green("✓ 추출 기록 저장 완료"));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : JSON.stringify(err);
      console.error(chalk.red("오류:"), msg);
      process.exit(1);
    }
  });

function requireLogin() {
  if (!config.isLoggedIn()) {
    console.error(chalk.red("로그인이 필요합니다. cofi_cli auth login 을 먼저 실행하세요."));
    process.exit(1);
  }
}
