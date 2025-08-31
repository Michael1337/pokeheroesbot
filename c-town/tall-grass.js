import getConfig from "../a-shared/config.js";
import { headers, WAIT_TIMES } from "../a-shared/const.js";
import { logMsg, logErr, logLevels } from "../a-shared/logger.js";
import { delay } from "../a-shared/utils.js";

const tag = "TALL GRASS";
const searchPokemon = (await getConfig("TALL_GRASS")) || "null";

function viewTallGrass() {
  return fetch("https://pokeheroes.com/tall_grass", {
    headers: headers,
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

function startSearch(pokemon = "Magikarp") {
  return fetch("https://pokeheroes.com/tall_grass", {
    headers: headers,
    referrer: "https://pokeheroes.com/tall_grass",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: `pkmn=${pokemon}`,
    method: "POST",
    mode: "cors",
    credentials: "include",
  });
}

function openBush(spot) {
  return fetch("https://pokeheroes.com/includes/ajax/tall_grass/open_bush.php", {
    headers: headers,
    referrer: "https://pokeheroes.com/tall_grass",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: `spot=${spot}`,
    method: "POST",
    mode: "cors",
    credentials: "include",
  });
}

/**
 * Extracts grass patch data (id and whether it's been looked at) from HTML.
 * @param {string} html - The HTML containing the grass patch divs.
 * @returns {Array<object>} An array of grass patch objects.
 */
function getGrassPatches(html) {
  const regex =
    /<div.*?id="grass(?<id>\d+)".*?>\s*<a onclick="openBush\(\d+\)">\s*<img.*?style="(?<style>.*?)".*?>\s*<\/a>\s*<\/div>/g;
  const matches = [...html.matchAll(regex)];

  const grassPatches = matches.map((match) => ({
    id: parseInt(match.groups.id, 10), // Extract integer ID
    lookedAt: match.groups.style.includes("opacity"),
  }));

  return grassPatches;
}

/**
 * Extracts the reload time (in milliseconds) from the HTML.
 * @param {string} html - The HTML containing the setTimeout script.
 * @returns {number | null} The reload time in milliseconds, or null if not found.
 */
function getReloadTime(html) {
  const match = html.match(/setTimeout\('location\.reload\(true\)', (?<time>\d+)\);/);
  return match ? parseInt(match.groups.time, 10) || null : null;
}

function getPokemon(html) {
  /**
   * HTML:
   * <div id='greenfield'>Searching for: <img src='//staticpokeheroes.com/img/pokemon/bw_field/380.png'>
                        <img src='//staticpokeheroes.com/img/pokemon/bw_field/381.png'> Eon Pokémon.<br>
   */
  // Step 1: Extract the section after "Searching for:" and before <br>
  const match = html.match(/Searching for:(?<section>[\s\S]*?)<br/);
  if (match && match.groups) {
    const section = match.groups.section;
    // Step 2: Extract the text between the last '>' and the '.' at the end
    const wordMatch = section.match(/>(?<pokemon>[^>]*)\.\s*$/);
    if (wordMatch && wordMatch.groups) {
      return wordMatch.groups.pokemon.trim();
    }
  }
  return null;
}

/**
 * Extracts the text inside the alert from the HTML.
 * @param {string} html - The HTML containing the script with the alert.
 * @returns {string | null} The text inside the alert, or null if not found.
 */
function getAlertText(html) {
  const regex = /alert\('(?<alertText>.*?)'\)/;
  const match = html.match(regex);

  if (match && match.groups && match.groups.alertText) {
    return match.groups.alertText;
  } else {
    return null;
  }
}

export async function handleTallGrass() {
  while (true) {
    try {
      const html = await (await viewTallGrass()).text();

      if (html.includes("Select a Pokémon") && searchPokemon !== "null") {
        logMsg(tag, logLevels.Valuable, `Starting to search for [${searchPokemon}].`);
        await startSearch(searchPokemon);
        continue;
      }

      if (html.includes("Select a Pokémon") && searchPokemon === "null") {
        // A hunt could be started but is not desired at the moment.
        await delay(WAIT_TIMES.TWENTY_FOUR_HOURS);
        continue;
      }

      const reloadTime = getReloadTime(html);
      if (reloadTime) {
        const pokemon = getPokemon(html);
        logMsg(
          tag,
          logLevels.Valuable,
          `Waiting [${reloadTime / 1000}] seconds before checking next patch of grass in hunt for [${pokemon}].`,
        );
        await delay(reloadTime);
        continue;
      }

      // Possible sizes: 9, 16, 25, 49, 64, 144
      const grassPatches = getGrassPatches(html);
      const notLookedAt = grassPatches.filter((patch) => !patch.lookedAt);
      // Check patch one away from corner first on first try. Afterwards, check first unchecked.
      const patchToCheck =
        notLookedAt.length === grassPatches.length ? Math.sqrt(grassPatches.length) : notLookedAt[0].id;

      logMsg(
        tag,
        logLevels.Debug,
        `[${notLookedAt.length}] of [${grassPatches.length}] patches remain. Checking [${patchToCheck}] now.`,
      );

      // TODO: What if party is full and egg is found?
      const response2 = await openBush(patchToCheck);
      const html2 = await response2.text();
      logMsg(tag, logLevels.Debug, `Looked at grass patch: [${getAlertText(html2)}]`);
    } catch (error) {
      logErr(tag, `Error when handling Tall Grass`, error);
      await delay(WAIT_TIMES.FIVE_MINUTES);
    }
  }
}
