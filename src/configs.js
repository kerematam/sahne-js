import path from "path";
import fs from "fs";

function loadConfig() {
  const configPath = path.join(process.cwd(), "sahne.config.js");
  if (fs.existsSync(configPath)) {
    return import(configPath);
  }
  return {};
}

const getConfigs = loadConfig();

export default getConfigs;
