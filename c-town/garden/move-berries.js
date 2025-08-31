import getConfig from "../../a-shared/config.js";
import { headers } from "../../a-shared/const.js";
import { logErr, logLevels, logMsg } from "../../a-shared/logger.js";

const tag = "BERRY BAG";

async function getBerries() {
  return fetch("https://pokeheroes.com/includes/ajax/berrygarden/openBerryMover.php", {
    headers: headers,
    referrer: "https://pokeheroes.com/berrygarden",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

async function moveBerries(berry = "Oran", amount = 1, level = 1) {
  return fetch("https://pokeheroes.com/includes/ajax/berrygarden/moveBerriesToItem.php", {
    headers: headers,
    referrer: "https://pokeheroes.com/berrygarden",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: `berries=${berry}%2C&amount=${amount}%2C&level=${level}%2C`,
    method: "POST",
    mode: "cors",
    credentials: "include",
  });
}

async function getBerryToMove(html) {
  const prefferedBerry = (await getConfig("PREFERRED_BERRY")) || "Oran";
  const match = html.match(
    new RegExp(`addBerryToBag\\('(?<name>${prefferedBerry})',\\s*(?<level>\\d+),\\s*(?<amount>\\d+),`, "i"),
  );
  return match
    ? {
        name: match.groups.name,
        level: Number(match.groups.level),
        amount: Number(match.groups.amount),
      }
    : null;
}

export async function handleMoveBerries() {
  try {
    const html = await (await getBerries()).text();
    const berry = await getBerryToMove(html);
    if (!berry) {
      logMsg(tag, logLevels.Important, `No berries to move.`);
      return;
    }
    const berriesToKeep = 100;
    const amountToMove = Math.max(berry.amount - berriesToKeep, 0);
    logMsg(
      tag,
      logLevels.Important,
      `Moving [${amountToMove}] [${berry.name}] berries of level [${berry.level}] to the bag.`,
    );
    await (await moveBerries(berry.name, amountToMove, berry.level)).text();
  } catch (error) {
    logErr(tag, ``, error);
  }
}
