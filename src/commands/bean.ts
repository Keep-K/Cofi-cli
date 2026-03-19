import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { input, select, confirm } from "@inquirer/prompts";
import { BeanService } from "@cofi/core/services/bean.service";
import { parseNaturalDate } from "@cofi/shared/date";
import { getSupabaseClient, withAuth } from "../lib/supabase.js";
import { config } from "../lib/config.js";
import { getLang, t } from "../lib/i18n.js";

export const beanCommand = new Command("bean").description("원두 관리");

beanCommand
  .command("list")
  .description("내 원두 목록 조회")
  .action(async () => {
    requireLogin();
    const spinner = ora("불러오는 중...").start();
    try {
      const beans = await withAuth(() => new BeanService(getSupabaseClient()).list(config.get("userId")!));
      spinner.stop();

      if (!beans || beans.length === 0) {
        console.log(chalk.dim("등록된 원두가 없습니다."));
        return;
      }
      for (const b of beans) {
        console.log(`${chalk.bold(b.name)}  ${chalk.dim(b.purchase_date ?? "")}`);
      }
    } catch (err: unknown) {
      spinner.stop();
      const msg = err instanceof Error ? err.message : JSON.stringify(err);
      console.error(chalk.red("오류:"), msg);
      process.exit(1);
    }
  });

beanCommand
  .command("add")
  .description("원두 추가 (인터랙티브)")
  .action(async () => {
    requireLogin();

    // 시작 안내 출력
    console.log();
    console.log(chalk.bold("원두 추가"));
    console.log(chalk.dim("─────────────────────────────────────────"));
    console.log(chalk.dim("예시) 콜롬비아 (카우카 삐엔다모) 엘 파라이소 카스틸로 더블 언에로빅"));
    console.log();
    console.log(`  ${"나라명".padEnd(6)}: 콜롬비아`);
    console.log(`  ${"지역".padEnd(6)}: 카우카 삐엔다모`);
    console.log(`  ${"농장".padEnd(6)}: 엘 파라이소`);
    console.log(`  ${"농장주".padEnd(6)}: 디에고 사무엘 베르무데스`);
    console.log(`  ${"품종".padEnd(6)}: 카스틸로`);
    console.log(`  ${"가공방식".padEnd(4)}: 더블 언에로빅`);
    console.log(`  ${"로스팅".padEnd(5)}: 약 중배전`);
    console.log(`  ${"등급".padEnd(6)}: 모름`);
    console.log(`  ${"구매날짜".padEnd(4)}: 오늘`);
    console.log(`  ${"중량".padEnd(6)}: 1000g`);
    console.log(`  ${"노트".padEnd(6)}: 복숭아, 리치, 요거트`);
    console.log(`  ${"비고".padEnd(6)}: 4일에서 6주 이내 소비 추천`);
    console.log(chalk.dim("─────────────────────────────────────────"));
    console.log();

    // 1. 원두명 (필수)
    const name = await input({ message: "원두명 (필수)" });
    if (!name.trim()) {
      console.error(chalk.red("원두명은 필수입니다."));
      process.exit(1);
    }

    // 2. 나라 (선택)
    const rawCountry = await input({ message: "나라 (Enter 건너뜀)" });
    const country = rawCountry.trim() || undefined;

    // 3. 지역 (선택)
    const rawRegion = await input({ message: "지역 (Enter 건너뜀)" });
    const region = rawRegion.trim() || undefined;

    // 4. 농장 (선택)
    const rawFarm = await input({ message: "농장 (Enter 건너뜀)" });
    const farm = rawFarm.trim() || undefined;

    // 5. 농장주 (선택)
    const rawFarmOwner = await input({ message: "농장주 (Enter 건너뜀)" });
    const farmOwner = rawFarmOwner.trim() || undefined;

    // 6. 품종 (선택)
    const rawVariety = await input({ message: "품종 (Enter 건너뜀)" });
    const varietyInput = rawVariety.trim() || undefined;

    // 7. 가공방식 (선택)
    const rawProcessing = await input({
      message: "가공방식 (Enter 건너뜀)",
      default: "",
    });
    const processingMethod = rawProcessing.trim() || undefined;

    // 8. 로스팅 포인트
    const roastPoint = await select({
      message: "로스팅 포인트",
      choices: [
        { name: "Light", value: "Light" },
        { name: "Medium-Light", value: "Medium-Light" },
        { name: "Medium", value: "Medium" },
        { name: "Medium-Dark", value: "Medium-Dark" },
        { name: "Dark", value: "Dark" },
        { name: "모름 / 건너뜀", value: "" },
      ],
    });

    // 9. 등급 (선택)
    const rawGrade = await input({
      message: "등급 (Enter 건너뜀) — 예: SHB, AA, 스페셜티, 모름",
    });
    const grade = rawGrade.trim() || undefined;

    // 10. 구매 날짜
    const rawDate = await input({
      message: "구매 날짜 — '오늘' 또는 YYYY-MM-DD",
      default: "오늘",
    });
    const purchaseDate = parseNaturalDate(rawDate) ?? rawDate;

    // 11. 중량 (선택)
    const rawWeight = await input({ message: "중량 g (Enter 건너뜀)" });
    const weightG = rawWeight.trim() ? Number(rawWeight.trim()) : undefined;

    // 12. 노트 (선택)
    const rawNotes = await input({
      message: "노트 (Enter 건너뜀) — 쉼표로 구분 (예: 복숭아, 리치, 요거트)",
    });
    const flavorNotes = rawNotes.trim()
      ? rawNotes.split(",").map((s) => s.trim()).filter(Boolean)
      : undefined;

    // 13. 비고 (선택)
    const rawMemo = await input({ message: "비고 (Enter 건너뜀)" });
    const notes = rawMemo.trim() || undefined;

    // 14. 금액 (선택)
    const lang = getLang();
    const currencyLabel = lang === "en" ? "Price USD (Enter to skip)" : "금액 원화 KRW (Enter 건너뜀)";
    const rawPrice = await input({ message: currencyLabel });
    const priceInput = rawPrice.trim() ? Number(rawPrice.trim()) : undefined;

    const supabase = getSupabaseClient();

    let priceKrw: number | undefined;
    let priceUsd: number | undefined;

    if (priceInput !== undefined && !isNaN(priceInput)) {
      if (lang === "en") {
        priceUsd = priceInput;
        const { data: rate } = await supabase
          .from("exchange_rates")
          .select("rate")
          .eq("from_currency", "USD")
          .eq("to_currency", "KRW")
          .single();
        if (rate) priceKrw = Math.round(priceInput * Number(rate.rate));
      } else {
        priceKrw = priceInput;
        const { data: rate } = await supabase
          .from("exchange_rates")
          .select("rate")
          .eq("from_currency", "KRW")
          .eq("to_currency", "USD")
          .single();
        if (rate) priceUsd = Number((priceInput * Number(rate.rate)).toFixed(4));
      }
    }

    // origin 매칭 로직
    let originId: string | undefined;
    let originMatchLabel = "";
    if (country) {
      const { data: origins } = await supabase
        .from("origins")
        .select("id, country, region, farm")
        .ilike("country", `%${country}%`);

      if (origins && origins.length === 1) {
        const first = origins[0]!;
        originId = first.id;
        const oc = first.country ?? "";
        const or_ = first.region ?? "";
        originMatchLabel = or_ ? `${oc} / ${or_}` : oc;
        console.log(chalk.dim(`  산지 자동 매칭: ${originMatchLabel}`));
      } else if (origins && origins.length > 1) {
        const choices = origins.map((o) => ({
          name: [o.country, o.region, o.farm].filter(Boolean).join(" / "),
          value: o.id,
        }));
        choices.push({ name: "매칭 없음 (텍스트로만 저장)", value: "" });
        const chosen = await select({ message: "산지를 선택하세요", choices });
        if (chosen) {
          originId = chosen;
          const matched = origins.find((o) => o.id === chosen);
          if (matched) {
            originMatchLabel = [matched.country ?? "", matched.region ?? ""].filter(Boolean).join(" / ");
          }
        }
      } else {
        console.log(chalk.dim("  산지 DB 매칭 없음 — 텍스트로만 저장됩니다."));
      }
    }

    // variety 매칭 로직
    let varietyId: string | undefined;
    let rawVarietyInput: string | undefined;
    let varietyMatchLabel = "";
    if (varietyInput) {
      const { data: varieties } = await supabase
        .from("varieties")
        .select("id, name, aliases")
        .or(`name.ilike.%${varietyInput}%,aliases.cs.{"${varietyInput}"}`);

      if (varieties && varieties.length >= 1) {
        if (varieties.length === 1) {
          const first = varieties[0]!;
          varietyId = first.id;
          varietyMatchLabel = first.name ?? "";
          console.log(chalk.dim(`  품종 자동 매칭: ${varietyMatchLabel}`));
        } else {
          const choices = varieties.map((v) => ({ name: v.name, value: v.id }));
          choices.push({ name: "매칭 없음 (원문 보관)", value: "" });
          const chosen = await select({ message: "품종을 선택하세요", choices });
          if (chosen) {
            varietyId = chosen;
            const matched = varieties.find((v) => v.id === chosen);
            if (matched) varietyMatchLabel = matched.name ?? "";
          } else {
            rawVarietyInput = varietyInput;
          }
        }
      } else {
        rawVarietyInput = varietyInput;
        console.log(chalk.dim("  품종 DB 매칭 없음 — 원문을 보관합니다."));
      }
    }

    const spinner = ora("저장 중...").start();
    try {
    const createInput = {
      name,
      purchaseDate,
      ...(roastPoint ? { roastPoint } : {}),
      ...(originId ? { originId } : {}),
      ...(varietyId ? { varietyId } : {}),
      ...(rawVarietyInput ? { rawVarietyInput } : {}),
      ...(farmOwner ? { farmOwner } : {}),
      ...(processingMethod ? { processingMethod } : {}),
      ...(grade ? { grade } : {}),
      ...(weightG && !isNaN(weightG) ? { weightG } : {}),
      ...(flavorNotes ? { flavorNotes } : {}),
      ...(notes ? { notes } : {}),
      ...(priceKrw !== undefined ? { priceKrw } : {}),
      ...(priceUsd !== undefined ? { priceUsd } : {}),
    };
    const bean = await withAuth(() => new BeanService(getSupabaseClient()).create(config.get("userId")!, createInput));
    spinner.stop();

    console.log();
    console.log(chalk.green("✓ 저장 완료"));
    console.log();
    console.log(`  ${"원두명".padEnd(6)}: ${chalk.bold(bean.name)}`);
    if (country || region) {
      console.log(`  ${"나라/지역".padEnd(4)}: ${[country, region].filter(Boolean).join(" / ")}${originId ? chalk.green("  (DB 매칭: ✓)") : ""}`);
    }
    if (farm) {
      console.log(`  ${"농장".padEnd(6)}: ${farm}${originId ? chalk.green("  (DB 매칭: ✓)") : ""}`);
    }
    if (varietyMatchLabel || rawVarietyInput) {
      const label = varietyMatchLabel || rawVarietyInput || "";
      console.log(`  ${"품종".padEnd(6)}: ${label}${varietyId ? chalk.green("  (DB 매칭: ✓)") : chalk.dim("  (미매칭)")}`);
    }
    if (processingMethod) {
      console.log(`  ${"가공방식".padEnd(4)}: ${processingMethod}`);
    }
    console.log(`  ${"구매날짜".padEnd(4)}: ${bean.purchase_date}`);
    if (bean.weight_g) {
      console.log(`  ${"중량".padEnd(6)}: ${bean.weight_g}g`);
    }
    if (priceKrw || priceUsd) {
      const display = lang === "en"
        ? `$${priceUsd}${priceKrw ? `  (₩${priceKrw.toLocaleString()})` : ""}`
        : `₩${priceKrw?.toLocaleString()}${priceUsd ? `  ($${priceUsd})` : ""}`;
      console.log(`  ${t("금액", "Price").padEnd(6)}: ${display}`);
    }
    } catch (err: unknown) {
      spinner.stop();
      const msg = err instanceof Error ? err.message : JSON.stringify(err);
      console.error(chalk.red("저장 오류:"), msg);
      process.exit(1);
    }
  });

beanCommand
  .command("show <id>")
  .description("원두 상세 조회")
  .action(async (id: string) => {
    requireLogin();
    try {
      const bean = await withAuth(() => new BeanService(getSupabaseClient()).get(id, config.get("userId")!));
      console.log(JSON.stringify(bean, null, 2));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : JSON.stringify(err);
      console.error(chalk.red("오류:"), msg);
      process.exit(1);
    }
  });

beanCommand
  .command("delete <id>")
  .description("원두 삭제")
  .action(async (id: string) => {
    requireLogin();
    try {
      const ok = await confirm({ message: "정말 삭제하시겠습니까?", default: false });
      if (!ok) return;
      await withAuth(() => new BeanService(getSupabaseClient()).remove(id, config.get("userId")!));
      console.log(chalk.green("✓ 삭제 완료"));
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
