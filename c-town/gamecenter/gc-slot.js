import { headers } from "../../a-shared/const.js";
import { logErr, logLevels, logMsg } from "../../a-shared/logger.js";

const tag = "GOLDEN SLOT";

function spinSlot(mode = "legend") {
  return fetch(`https://pokeheroes.com/golden_slot?mode=${mode}&spin=true&noanim`, {
    headers: headers,
    referrer: `https://pokeheroes.com/golden_slot?mode=${mode}&noanim`,
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

export async function handleGoldenSlot() {
  try {
    const html = await (await spinSlot()).text();
    const match = html.match(/alert\("(?<prize>[^"]+)"\);/);
    const prize = match?.groups?.prize;
    if (prize && !prize.includes("Game Chips")) logMsg(tag, logLevels.Valuable, `[${prize}] from the slot machine.`);
  } catch (error) {
    logErr(tag, ``, error);
  }
}
