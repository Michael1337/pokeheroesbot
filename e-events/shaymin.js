import { headers, WAIT_TIMES } from "../a-shared/const.js";
import { logMsg, logErr, logLevels } from "../a-shared/logger.js";
import { delay } from "../a-shared/utils.js";
import { load } from "cheerio";

const tag = "SHAYMIN";

function checkForShaymin() {
  return fetch("https://www.pokeheroes.com/roaming?pokemon=shaymin&end=1", {
    headers: headers,
    referrer: "https://pokeheroes.com/news",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

function _clickShaymin(url) {
  return fetch(`https://www.pokeheroes.com/${url}`, {
    headers: headers,
    referrer: "https://pokeheroes.com/",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

function claimGift(url, giftId) {
  return fetch(`https://www.pokeheroes.com/${url}&gift=${giftId}`, {
    headers: headers,
    referrer: `https://pokeheroes.com/${url}`,
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

export async function shayminEventActive() {
  const html = await (await checkForShaymin()).text();
  if (html.includes("<meta http-equiv='refresh' content='0; URL=index'>")) {
    return false;
  } else if (html.includes("This Event ends on")) {
    return html;
  } else {
    logErr(tag, "Unexpected HTML structure when checking for Shaymin event.");
    return false;
  }
}

function findShayminLink(html) {
  const $ = load(html);

  const userbar = $("#userbar");
  const shayminLink = userbar.find('a[href*="shaymin"]');

  if (shayminLink.length > 0) {
    const href = shayminLink.attr("href");
    return href;
  } else {
    return null;
  }
}

async function _collectReward(url) {
  const plushieId = 3;
  logMsg(tag, logLevels.Valuable, `Collecting Shaymin Event gift number [${plushieId}].`);
  await claimGift(url, plushieId);
}

export async function handleShayminEvent() {
  while (true) {
    try {
      const eventActive = await shayminEventActive();
      if (!eventActive) {
        logMsg(tag, logLevels.Debug, `Shaymin Event not active. Waiting a day to check again...`);
        await delay(WAIT_TIMES.TWENTY_FOUR_HOURS);
        continue;
      }

      if (eventActive) {
        logMsg(tag, logLevels.Debug, `Shaymin Event active. Checking for icon...`);
        const url = findShayminLink(eventActive);
        if (url) {
          // Don't collect just yet since shaymin can stack.
          // Await collectReward(url);
        }
        await delay(WAIT_TIMES.FIVE_MINUTES);
        continue;
      }
    } catch (error) {
      logErr(tag, ``, error);
      await delay(WAIT_TIMES.TWO_HOURS);
    }
  }
}
