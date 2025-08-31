import { headers, WAIT_TIMES } from "../../a-shared/const.js";
import { sendMail } from "../../a-shared/email.js";
import { logMsg, logLevels } from "../../a-shared/logger.js";
import { delay } from "../../a-shared/utils.js";
import { getAllPokemonFromBoxName, getStrongestPokemonPerType, movePokemon } from "../../b-home/pokemon-storage.js";

const tag = "SALON";
const bestMassage = 8;
const cheapestMassage = 2;
const cheapestMassageDuration = 5;
// Puzzle Pieces are gained by Furfrou haircuts. When all haircuts are made twice (to get both genders) and permanent, all pieces are collected.
// TODO: Massages don't do anything since the winner of a fight is determined by level, unless a level gap is in place, but maybe we do get puzzle pieces here afterall....

function checkSalon() {
  return fetch("https://www.pokeheroes.com/salon", {
    headers: headers,
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

function finishMassage() {
  return fetch("https://www.pokeheroes.com/salon?cont", {
    headers: headers,
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

function startMassage(kind = bestMassage, pokemon = 0) {
  return fetch("https://www.pokeheroes.com/salon", {
    headers: headers,
    referrer: "https://www.pokeheroes.com/salon",
    body: `massage=${kind}&pkmn_select=${pokemon}`,
    method: "POST",
    mode: "cors",
    credentials: "include",
  });
}

export function viewFurfrou() {
  return fetch("https://www.pokeheroes.com/salon_haircut", {
    headers: headers,
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

export function startHaircut(style = "", furfrou = 0) {
  return fetch("https://www.pokeheroes.com/salon_haircut", {
    headers: headers,
    referrer: "https://www.pokeheroes.com/salon_haircut",
    body: `haircut=${style}&pkmn_select=${furfrou}`,
    method: "POST",
    mode: "cors",
    credentials: "include",
  });
}

async function waitForMassageToEnd(html) {
  const regex =
    /img\/pkmnimage\?id=(?<id>\d+).*?Your (?<pokemon>.+?) is currently enjoying.*?data-countTo=(?<countto>\d+) /s;
  const match = html.match(regex);
  if (match && match.groups) {
    const id = match.groups.id;
    const pokemon = match.groups.pokemon;
    const counttoInt = parseInt(match.groups.countto, 10);
    const nowMs = Date.now();
    const targetMs = counttoInt * 1000;
    let msToTarget = targetMs - nowMs;
    if (msToTarget < 0) msToTarget = 0;
    logMsg(tag, logLevels.Valuable, `[${pokemon} (${id})] is in salon for another [${msToTarget / 1000}] seconds...`);
    await delay(msToTarget + WAIT_TIMES.THREE_SECONDS);
  }
}

export async function getSalonPokemon(html) {
  const match = html.match(/img\/pkmnimage\?id=(?<id>\d+)/);
  return match?.groups?.id;
}

export function getTimeToHaircutFinish(html) {
  const regex = /We're currently cutting your Furfrou's hair.*?data-countTo=(?<countto>\d+) /s;
  const match = html.match(regex);
  if (match && match.groups) {
    const counttoInt = parseInt(match.groups.countto, 10);
    const nowMs = Date.now();
    const targetMs = counttoInt * 1000;
    let msToTarget = targetMs - nowMs;
    if (msToTarget < 0) msToTarget = 0;
    return msToTarget;
  } else {
    return 0;
  }
}

async function getPokemonsForMassage() {
  const username = process.env.APP_USERNAME;
  const bestPokemonsObj = await getStrongestPokemonPerType();
  const bestPokemons = Object.values(bestPokemonsObj);

  return bestPokemons.filter((pokemon) => pokemon.originalTrainer === username);
}

export async function handleMassages() {
  const pokemons = await getPokemonsForMassage();
  logMsg(
    tag,
    logLevels.Valuable,
    `Starting massages for [${pokemons.length}] Pokémon. Will take ~[${cheapestMassageDuration * pokemons.length}] minutes.`,
  );
  for (const pokemon of pokemons) {
    let html = await (await checkSalon()).text();

    // Finish any ongoing massages...
    if (html.includes("?cont")) {
      await finishMassage();
    }
    if (html.includes("data-countTo=")) {
      await waitForMassageToEnd(html);
      await finishMassage();
    }

    // Start next massage and wait for it to end...
    html = await (await startMassage(cheapestMassage, pokemon.id)).text();
    if (
      !html.includes("I'm sorry, but this Pokémon already got a massage") &&
      !html.includes("This Pokemon is currently on a Rumble Mission.") &&
      !html.includes("location.reload();")
    ) {
      sendMail("Salon message", html);
    }
    await waitForMassageToEnd(html);
    await finishMassage();
  }
}

export async function makeFurfrousPerm() {
  await viewFurfrou(); // Collect any Furfrou
  const furfrouNo = 676;
  const pokemon = await getAllPokemonFromBoxName("Special");
  const furfrous = pokemon.filter((pkmn) => pkmn.pokedexNo === furfrouNo);

  for (const furfrou of furfrous) {
    logMsg(tag, logLevels.Valuable, `Making haircut permanent for [${furfrou.speciesName} (${furfrou.id})]...`);
    await startHaircut("perm", furfrou.id);
    await movePokemon(1, furfrou.id);
  }
}
