import * as fs from "fs";
import * as _ from "lodash";

export interface AppSettings {
  mean: number;
  std: number;
}

export const settingsFilename = "settings.json";

export function saveSettings(): void {
  console.log(`Saving settings! ${JSON.stringify(appSettings)}`);
  fs.writeFileSync(settingsFilename, JSON.stringify(appSettings), {
    encoding: "UTF8",
  });
}

let loadedSettings: AppSettings;
try {
  const fileData = fs.readFileSync(settingsFilename, { encoding: "UTF8" });
  loadedSettings = JSON.parse(fileData);
} catch {
  loadedSettings = {} as AppSettings;
}

const defaults = { mean: 0.0, std: 0.2 };
export const appSettings = _.defaults(loadedSettings, defaults);
