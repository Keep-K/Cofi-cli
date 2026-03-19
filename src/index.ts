#!/usr/bin/env node
import { program } from "commander";
import { select } from "@inquirer/prompts";
import { authCommand } from "./commands/auth.js";
import { beanCommand } from "./commands/bean.js";
import { brewCommand } from "./commands/brew.js";
import { configCommand } from "./commands/config.js";
import { config } from "./lib/config.js";

// 최초 실행 시 언어 선택
if (!config.get("lang")) {
  const lang = await select({
    message: "Select language / 언어를 선택하세요",
    choices: [
      { name: "한국어", value: "ko" },
      { name: "English", value: "en" },
    ],
  });
  config.set("lang", lang as "ko" | "en");
}

program
  .name("cofi_cli")
  .description("Coffee recipe & brew log CLI")
  .version("0.1.0");

program.addCommand(authCommand);
program.addCommand(beanCommand);
program.addCommand(brewCommand);
program.addCommand(configCommand);

program.parse();
