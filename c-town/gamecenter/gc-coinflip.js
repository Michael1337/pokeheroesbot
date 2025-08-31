import { headers } from "../../a-shared/const.js";
import { logErr } from "../../a-shared/logger.js";
import getConfig from "../../a-shared/config.js";

const tag = "COIN FLIP";
const minimumBet = 1; // 100 needed for medal, but we don't want medals.

function flipCoin(coinside = "head", bet = minimumBet) {
  return fetch("https://pokeheroes.com/includes/ajax/game_center/coinflip.php", {
    headers: headers,
    referrer: "https://pokeheroes.com/gc_coinflip",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: `coinside=${coinside}&bet=${bet}`,
    method: "POST",
    mode: "cors",
    credentials: "include",
  });
}

export async function handleCoinFlips() {
  const batch = 100; // Every 10 minutes > 14,400 a day > 432,000 a month // 500,000 needed for shiny Mewton
  try {
    const COIN_FLIP_AMOUNT = (await getConfig("GC_COIN_FLIP_AMOUNT")) || minimumBet;
    for (let i = 0; i < batch; i++) {
      await flipCoin("head", COIN_FLIP_AMOUNT);
    }
  } catch (error) {
    logErr(tag, ``, error);
  }
}

export async function doSomeCoinFlips(number = 0) {
  for (let i = 0; i < number; i++) {
    await flipCoin("head", 1);
  }
}
