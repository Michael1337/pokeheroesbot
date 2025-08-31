import { headers } from "../../a-shared/const.js";
import { logMsg, logErr, logLevels } from "../../a-shared/logger.js";

const tag = "EXCHANGE GAME CENTER";

function exchangeItem(item = 0) {
  return fetch(`https://pokeheroes.com/gc_prize_exchange?buy_item=${item}`, {
    headers: headers,
    referrer: "https://pokeheroes.com/gc_prize_exchange",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

export async function handleExchangeItem() {
  try {
    const maximumItemId = 100;
    // 100 because some items may be added or are special events or something. We could, instead, also get a list of available items first.
    // Careful: The items cost over 100,000 coins. So make sure to have that many before buying them. We could do a check here, but why bother?
    for (let i = 0; i < maximumItemId; i++) {
      await exchangeItem(i);
    }

    logMsg(tag, logLevels.Important, `Exchaned items. Will do again tomorrow.`);
  } catch (error) {
    logErr(tag, ``, error);
  }
}
