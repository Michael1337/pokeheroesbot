import { headers, WAIT_TIMES } from "../../a-shared/const.js";
import { logMsg, logErr, logLevels } from "../../a-shared/logger.js";
import { delay } from "../../a-shared/utils.js";

const tag = "TREASURE";

function startTreasure() {
  return fetch("https://pokeheroes.com/treasures?start", {
    headers: headers,
    referrer: "https://pokeheroes.com/treasures",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

function openTreasure(choice = 0) {
  return fetch(`https://pokeheroes.com/treasures?choose=${choice}`, {
    headers: headers,
    referrer: "https://pokeheroes.com/treasures",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

function getRemainingSeconds(html) {
  let remainingSeconds = 0;

  const matchMinutes = html.match(/Try again in (?<minutes>\d+) Minute/);
  if (matchMinutes) {
    remainingSeconds += parseInt(matchMinutes.groups.minutes, 10) * 60;
  }

  const matchSeconds = html.match(/(?<seconds>\d+) Second/);
  if (matchSeconds) {
    remainingSeconds += parseInt(matchSeconds.groups.seconds, 10);
  }
  return remainingSeconds;
}

/**
 * Handles the treasure hunting process.
 * @param {number} [choice=0] - The index of the treasure chest to open (0-8). 0 is always the first unopened chest.
 */
export async function handleTreasure(choice = 0) {
  while (true) {
    try {
      const html = await (await startTreasure()).text();
      const remainingSeconds = getRemainingSeconds(html);

      if (remainingSeconds > 0) {
        logMsg(tag, logLevels.Interesting, `Gotta wait [${remainingSeconds}] seconds before viewing chests again...`);
        await delay(remainingSeconds * 1000);
        continue;
      }

      logMsg(tag, logLevels.Debug, "Viewing nine chests in front of me, opening one...");
      const openTreasureHtml = await (await openTreasure(choice)).text();
      const matchFound = openTreasureHtml.match(/You found (?<treasure>.*) <img .* in this treasure box/);

      if (
        matchFound &&
        !matchFound.groups.treasure.includes("Game Chips") &&
        !matchFound.groups.treasure.includes(" Gems") &&
        !matchFound.groups.treasure.includes(" Balls")
      ) {
        logMsg(tag, logLevels.Valuable, `Opened chest [${choice}] and found [${matchFound.groups.treasure}].`);
      }

      await delay(WAIT_TIMES.THREE_SECONDS);
    } catch (error) {
      logErr(tag, `Error in handleTreasure:`, error);
      await delay(WAIT_TIMES.TWO_MINUTES);
    }
  }
}
