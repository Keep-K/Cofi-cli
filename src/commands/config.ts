import { Command } from "commander";
import chalk from "chalk";
import { select } from "@inquirer/prompts";
import { config } from "../lib/config.js";
import { t } from "../lib/i18n.js";

export const configCommand = new Command("config").description(
  "CLI 설정 관리 / Manage CLI settings"
);

configCommand
  .command("lang")
  .description("언어 재설정 / Reset language")
  .action(async () => {
    const lang = await select({
      message: "Select language / 언어를 선택하세요",
      choices: [
        { name: "한국어", value: "ko" },
        { name: "English", value: "en" },
      ],
    });
    config.set("lang", lang as "ko" | "en");
    console.log(chalk.green(t("✓ 언어 설정 완료", "✓ Language updated")));
  });

configCommand
  .command("show")
  .description("현재 설정 표시 / Show current settings")
  .action(() => {
    const all = config.getAll();
    console.log();
    console.log(chalk.bold(t("현재 설정", "Current settings")));
    console.log(chalk.dim("─────────────────────────────────────────"));
    console.log(`  ${"lang".padEnd(14)}: ${all.lang ?? chalk.dim("(미설정)")}`);
    console.log(`  ${"email".padEnd(14)}: ${all.email ?? chalk.dim("(미로그인)")}`);
    console.log(`  ${"provider".padEnd(14)}: ${all.provider ?? chalk.dim("(미로그인)")}`);
    console.log(`  ${"userId".padEnd(14)}: ${all.userId ?? chalk.dim("(미로그인)")}`);
    console.log();
  });
