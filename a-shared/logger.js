import fs from "fs/promises";
import path from "path";
import { sendMail } from "./email.js";

/* eslint no-console: 0 */

export const logLevels = {
  All: 0,
  Debug: 10,
  Interesting: 30,
  Valuable: 50,
  Important: 70,
  Necessary: 100,
};
const logLevel = logLevels.Valuable; // Lower number = more logs
const logFilePath = path.join(process.cwd(), "app.log");
const MAX_LOG_LINES = 100000;

export const getNow = () => {
  const dateTime = new Date();

  const formattedDate = dateTime
    .toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    })
    .replace(/\//g, ".");

  const time = dateTime.toLocaleTimeString("en-GB", { hour12: false });
  return `${formattedDate} ${time}`;
};

/**
 * Asynchronously trims the log file, keeping only the latest MAX_LOG_LINES.
 */
export async function trimLogFile() {
  try {
    const fileContent = await fs.readFile(logFilePath, "utf8");
    const lines = fileContent.split("\n");
    const lineCount = lines.length;

    if (lineCount > MAX_LOG_LINES) {
      const linesToKeep = lines.slice(lineCount - MAX_LOG_LINES);
      const trimmedContent = linesToKeep.join("\n");
      await fs.writeFile(logFilePath, trimmedContent, "utf8");
      console.log("Log file trimmed.");
    }
  } catch (error) {
    console.error("Error trimming log file:", error);
  }
}

/**
 * Asynchronously appends a message to the log file.
 * @param {string} message - The message to append.
 */
async function appendToLogFile(message) {
  try {
    await fs.appendFile(logFilePath, message + "\n", "utf8");
  } catch (error) {
    console.error("Error writing to log file:", error);
  }
}

export function logMsg(tag, minLogLevel = 0, msg) {
  const logMessage = `[${getNow()}][${tag}] ` + msg;
  appendToLogFile(logMessage);
  if (minLogLevel >= logLevel) {
    console.log(logMessage);
  }
}

export function logVal(tag, minLogLevel = 0, msg, ...value) {
  // eslint-disable-next-line no-magic-numbers
  const stringifiedVal = JSON.stringify(value, null, 2);
  const logMessage = `[${getNow()}][${tag}] ` + msg + "\n" + stringifiedVal;
  appendToLogFile(logMessage);
  if (minLogLevel >= logLevel) {
    console.log(logMessage);
  }
}

export function logErr(tag, msg, err = {}) {
  if (
    err.code === "ETIMEDOUT" ||
    err.code === "ECONNRESET" ||
    err.code === "ENOTFOUND" ||
    (err instanceof TypeError && err.message === "fetch failed") ||
    String(err).includes("<title>pokeheroes.com | 502: Bad gateway</title>") ||
    String(err).includes("<title>pokeheroes.com | 504: Gateway time-out</title>")
  ) {
    return;
  }
  const message = `[${getNow()}][${tag}][ERROR] ` + msg + "\n" + (err.stack || err.message || String(err));
  console.log(message);
  console.error(err);
  appendToLogFile(message);
  // SendGotify(message, err.stack, 5);
  sendMail("ERROR", message);
}
