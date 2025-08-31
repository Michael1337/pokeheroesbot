import { headers } from "../../a-shared/const.js";
import { logErr, logLevels, logMsg } from "../../a-shared/logger.js";
import { movePokemon } from "../../b-home/pokemon-storage.js";

const tag = "OAK CHALLENGE";

function startOakChallenge() {
  return fetch("https://www.pokeheroes.com/square?challengeOak", {
    headers: headers,
    referrer: "https://www.pokeheroes.com/square",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

function finishOakChallenge() {
  return fetch("https://www.pokeheroes.com/square?oakFinish", {
    headers: headers,
    referrer: "https://www.pokeheroes.com/square",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

function viewOakChallenge() {
  return fetch("https://www.pokeheroes.com/square", {
    headers: headers,
    referrer: "https://www.pokeheroes.com/square",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

function hoursUntilNextSunday8am() {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const dayOfContest = 7;
  const hourOfContest = 8;

  // If today is Sunday before 8 AM, target today at 8 AM
  const daysUntilSunday = (dayOfContest - dayOfWeek) % dayOfContest;
  const nextSunday = new Date(now);
  nextSunday.setDate(now.getDate() + daysUntilSunday);
  nextSunday.setHours(hourOfContest, 0, 0, 0);

  // If today is Sunday and time is after or exactly 8 AM, move to next Sunday
  if (dayOfWeek === 0 && now >= nextSunday) {
    nextSunday.setDate(nextSunday.getDate() + dayOfContest);
  }

  const msDiff = nextSunday - now;
  const hoursDiff = Math.ceil(msDiff / (1000 * 60 * 60));
  return hoursDiff;
}

export async function checkOakChallenge() {
  const html = await (await viewOakChallenge()).text();
  const hisLevelMatch = html.match(/Mine is currently on <b>Level (?<hisLevel>\d+)<\/b>./);
  if (!hisLevelMatch) return;
  const hisCurrentLevel = parseInt(hisLevelMatch.groups?.hisLevel, 10);
  const levelsPerHour = 1.15;
  const hisFinalLevel = hisCurrentLevel + Math.ceil(hoursUntilNextSunday8am() * levelsPerHour);
  // His Pokémon grows by a bit more than 1 level per hour. By checking every few hours, we won't over level too much but enough to win.
  const myLevelMatch = html.match(/It's on <b>Level (?<myLevel>\d+)<\/b>/);
  const myCurrentLevel = parseInt(myLevelMatch?.groups?.myLevel, 10);
  const idMatch = html.match(/href="pokemon\?id=(?<id>\d+)"/i);
  const id = parseInt(idMatch?.groups?.id, 10);

  if (myCurrentLevel > hisFinalLevel) {
    logMsg(
      tag,
      logLevels.Important,
      `Moving Pokémon [${id}] of Oak contest to special box. Winning with [${myCurrentLevel} > ${hisFinalLevel}].`,
    );
    await movePokemon("Special", id);
  } else {
    logMsg(
      tag,
      logLevels.Important,
      `Moving Pokémon [${id}] of Oak contest to PARTY. Losing with [${myCurrentLevel} < ${hisFinalLevel}].`,
    );
    await movePokemon("PARTY", id);
  }

  return id;
}

/**
 * Checks if an oak challenge is ongoing.
 * @returns Returns the pokemon ID or null if no challenge ongoing.
 */
export async function getOakChallengePokemon() {
  const html = await (await viewOakChallenge()).text();
  const idMatch = html.match(/href="pokemon\?id=(?<id>\d+)"/i);
  const id = parseInt(idMatch?.groups?.id, 10);
  return id;
}

async function winOakChallenge() {
  const html = await (await finishOakChallenge()).text();
  const match = html.match(
    /Professor Oak's Contest[\s\S]*?<div id=['"]greenfield['"][^>]*>(?<greenfield>[\s\S]*?)<\/div>[\s\S]*?Bug-Hatching Contest/i,
  );

  if (!match || !match.groups?.greenfield) {
    logErr(tag, `No greenfield after winning challenge.`, html);
    return;
  }

  let greenText = match.groups.greenfield;
  greenText = greenText.replace(/<br\s*\/?>/gi, ", ");
  greenText = greenText.replace(/<[^>]+>/g, "");
  greenText = greenText
    .replace(/\s*,\s*/g, " ")
    .replace(/,\s*$/, "")
    .trim();

  logMsg(tag, logLevels.Valuable, `Won oak challenge. [${greenText}].`);
}

async function startOakCHallenge() {
  const html = await (await startOakChallenge()).text();

  const match = html.match(/Please take good care of\s*<b>(?<pokemonName>.*?)<\/b>/i);

  if (match && match.groups) {
    const pkmn = match.groups.pokemonName;
    logMsg(tag, logLevels.Valuable, `Challenge started to train [${pkmn}].`);
  }
}

export async function handleOakChallenge() {
  // Called every Monday and Sunday....
  const html = await (await viewOakChallenge()).text();

  if (html.includes("?oakFinish")) {
    await winOakChallenge();
    return;
  }

  if (html.includes("be back next Monday.")) {
    logErr(tag, `No Oak Contest available.`, html);
    return;
  }

  await startOakCHallenge();
  await checkOakChallenge();
}
