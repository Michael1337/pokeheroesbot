import getConfig from "../../a-shared/config.js";
import { headers, WAIT_TIMES } from "../../a-shared/const.js";
import { logMsg, logErr, logLevels } from "../../a-shared/logger.js";
import { delay } from "../../a-shared/utils.js";

const tag = "WHEEL";

function spinWheel(pkmn = 0) {
  return fetch("https://pokeheroes.com/gc_wheel", {
    headers: headers,
    referrer: "https://pokeheroes.com/gc_wheel",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: `pkmn_select=${pkmn}`,
    method: "POST",
    mode: "cors",
    credentials: "include",
  });
}

function getRemainingSeconds(html) {
  let remainingSeconds = 0;
  const match = html.match(
    /Please come back in(?: (?<hours>\d+)\s*Hour(?:s)?)?(?: (?:and )?(?<minutes>\d+)\s*Minute(?:s)?)?(?: (?:and )?(?<seconds>\d+)\s*Second(?:s)?)?/i,
  );

  if (match && match.groups) {
    remainingSeconds += (parseInt(match.groups.hours, 10) || 0) * 3600;
    remainingSeconds += (parseInt(match.groups.minutes, 10) || 0) * 60;
    remainingSeconds += parseInt(match.groups.seconds, 10) || 0;
  }
  return remainingSeconds;
}

export async function handleWheel() {
  while (true) {
    try {
      const pkmn = await getConfig("GC_WHEEL_PKMN");
      const html = await (await spinWheel(pkmn)).text();

      const matchWon = html.match(/<div id="greenfield" class="win_notice"[^>]*>(?<winText>[\s\S]*?)<\/div>/);
      if (matchWon) {
        const winText = matchWon.groups.winText.replace(/\s+/g, " ").trim();
        logMsg(tag, logLevels.Valuable, `Spun the wheel using [${pkmn}] and won [${winText}].`);
        await delay(WAIT_TIMES.SIX_HOURS + WAIT_TIMES.TEN_SECONDS);
        continue;
      }

      const remainingSeconds = getRemainingSeconds(html);
      if (remainingSeconds > 0) {
        logMsg(tag, logLevels.Interesting, `Gotta wait [${remainingSeconds}] seconds before spinning wheel again...`);
        await delay(remainingSeconds * 1000);
        continue;
      }

      await delay(WAIT_TIMES.ONE_MINUTE);
    } catch (error) {
      logErr(tag, `Error in handleWheel:`, error);
      await delay(WAIT_TIMES.TEN_MINUTES);
    }
  }
}
