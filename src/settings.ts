import * as fs from "fs";
import * as _ from "lodash";

export const settingsFilename = "settings.json";

export function saveSettings<T>(settings: T): void {
  fs.writeFileSync(settingsFilename, JSON.stringify(settings), {
    encoding: "UTF8",
  });
}

export function storedSettings<T>(defaults: T): T {
  let loadedSettings: T;
  try {
    const fileData = fs.readFileSync(settingsFilename, { encoding: "UTF8" });
    loadedSettings = JSON.parse(fileData);
  } catch {
    loadedSettings = {} as T;
  }
  return _.defaultsDeep(loadedSettings, defaults);
}
