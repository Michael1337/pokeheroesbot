import { headers } from "../a-shared/const.js";
import { logLevels, logMsg } from "../a-shared/logger.js";

const tag = "SPRITES";

function checkSpritesQuest() {
  return fetch(`https://pokeheroes.com/sprites_house`, {
    headers: headers,
    referrer: "https://pokeheroes.com/",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

function joinTeaParty() {
  return fetch(`https://pokeheroes.com/sprites_house?tea`, {
    headers: headers,
    referrer: "https://pokeheroes.com/sprites_house",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

function restartQuest() {
  return fetch(`https://pokeheroes.com/sprites_house?start=q`, {
    headers: headers,
    referrer: "https://pokeheroes.com/sprites_house",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

export async function spritesQuest() {
  const html = await (await checkSpritesQuest()).text();
  if (html.includes("Thank you for finding us! Will you join our Tea Party?")) {
    logMsg(tag, logLevels.Valuable, `Joining tea party to collect last Sprite!`);
    await joinTeaParty();
    spritesQuest();
  }
  if (html.includes("Please accept this egg as a token of our gratitude.")) {
    logMsg(tag, logLevels.Valuable, `Finished quest! Reloading...`);
    spritesQuest();
  }
  if (html.includes("Come back soon when you have time for another Tea Party.")) {
    logMsg(tag, logLevels.Valuable, `Restarting quest for Shiny version!`);
    await restartQuest();
  }
}
