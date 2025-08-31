import { headers } from "../../a-shared/const.js";
import { logMsg, logErr, logLevels } from "../../a-shared/logger.js";

const tag = "LOTTERY";
const DEFAULT_LOTTERY_BATCH = 500; // Only 10,000 tickets, i.e. 20 iterations of 500 tickets can be bought, so once an hour is good enough

function buyLottery(amount = DEFAULT_LOTTERY_BATCH) {
  return fetch("https://pokeheroes.com/gc_lottery", {
    headers: headers,
    referrer: "https://pokeheroes.com/gc_lottery",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: `random_lot=${amount}`,
    method: "POST",
    mode: "cors",
    credentials: "include",
  });
}

export async function handleLottery(amount = DEFAULT_LOTTERY_BATCH) {
  try {
    const html = await (await buyLottery(amount)).text();
    const match = html.match(/<div id='redfield'>(?<message>.*?)<\/div>/);

    if (!match?.groups?.message) {
      // No error message found, assume tickets were bought successfully
      logMsg(tag, logLevels.Interesting, `Bought [${amount}] lottery tickets. Will buy more in 60 minutes.`);
    } else if (!match.groups.message.includes("You reached the maximum of available tickets!")) {
      // Tickets could not be bought for an unexpected reason, report the problem
      logMsg(tag, logLevels.Valuable, `Error: [${match.groups.message}]`);
    }
  } catch (error) {
    logErr(tag, ``, error);
  }
}
