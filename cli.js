#!/usr/bin/env node
const { program } = require("commander");
const { readConfig, ConfigLoaderError } = require("@web/config-loader");

async function loadConfig() {
  try {
    const config = await readConfig("sahne.config");
    return config;
  } catch (error) {
    if (error instanceof ConfigLoaderError) {
      console.error(error.message);
      return;
    }
    console.error(error);
    return;
  }
}

async function loadModule() {
  const esModule = await import("./src/index.mjs");
  return esModule.default;
}

program
  .version("0.1.0")
  .option(
    "-s, --sourceOrigin <sourceOrigin>",
    "URL origin to the server that requests will be proxied to"
  )
  .option(
    "-t, --targetOrigin <targetOrigin>",
    "URL origin to the target server that requests will be intercepted and proxied from"
  )
  .action(async (commandConfigs) => {
    const run = await loadModule();
    const fileConfigs = await loadConfig();
    const configs = { ...commandConfigs, ...fileConfigs };
    run(configs);
  });

program.parse(process.argv);
