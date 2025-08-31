import { headers } from "../a-shared/const.js";
import { logMsg, logErr, logLevels } from "../a-shared/logger.js";

const tag = "HOME INTERACTION";

function throwCoin() {
  return fetch("https://pokeheroes.com/fountain?coin", {
    headers: headers,
    referrer: "https://pokeheroes.com/fountain",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

/**
 * Throws coin into fountain.
 */
export async function handleFountain() {
  try {
    await throwCoin();
    logMsg(tag, logLevels.Debug, `Threw coin into fountain...`);
  } catch (error) {
    logErr(tag, ``, error);
  }
}
