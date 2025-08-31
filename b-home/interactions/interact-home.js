import { headers } from "../../a-shared/const.js";
import { logMsg, logErr, logLevels } from "../../a-shared/logger.js";

const tag = "INTERACTION HOME";

function viewHomepage() {
  return fetch("https://pokeheroes.com/", {
    headers: headers,
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

function interactPokemon() {
  return fetch("https://pokeheroes.com/includes/ajax/index/pkmn_interact.php", {
    headers: headers,
    referrer: "https://pokeheroes.com/",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "POST",
    mode: "cors",
    credentials: "include",
  });
}

function interactEgg() {
  return fetch("https://pokeheroes.com/includes/ajax/index/egg_interact.php", {
    headers: headers,
    referrer: "https://pokeheroes.com/",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "POST",
    mode: "cors",
    credentials: "include",
  });
}

/**
 * Interacts with Pokémon on the homepage.
 */
export async function handleHomepageInteraction() {
  try {
    const html = await (await viewHomepage()).text();
    logMsg(tag, logLevels.Debug, `Checking if interactables are present...`);

    if (!html.includes("Next Pokémon")) {
      await interactPokemon();
      logMsg(tag, logLevels.Debug, `Interacted with a pokemon.`);
    }

    if (!html.includes("Next Egg")) {
      await interactEgg();
      logMsg(tag, logLevels.Debug, `Interacted with an egg.`);
    }
  } catch (error) {
    logErr(tag, ``, error);
  }
}
