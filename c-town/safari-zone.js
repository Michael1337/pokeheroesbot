import { headers } from "../a-shared/const.js";
import { logMsg, logErr, logLevels } from "../a-shared/logger.js";
import { delay } from "../a-shared/utils.js";

const tag = "SAFARI";

/**
 * Starts a new Safari Zone session.
 * @returns {Promise<Response>} - A promise that resolves to the response of the fetch request.
 */
async function startSafari() {
  return fetch("https://pokeheroes.com/safari_zone?play", {
    headers: headers,
    referrer: "https://pokeheroes.com/safari_zone",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

/**
 * Throws a Safari Ball at a Pokémon.
 * @param {number} [pkmn=0] - The ID of the Pokémon to throw the ball at.
 * @returns {Promise<Response>} - A promise that resolves to the response of the fetch request.
 */
async function throwBall(pkmn = 0) {
  return fetch("https://pokeheroes.com/includes/ajax/safari/throwBall.php", {
    headers: headers,
    referrer: "https://pokeheroes.com/safari_zone?",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: `id=${pkmn}`,
    method: "POST",
    mode: "cors",
    credentials: "include",
  });
}

/**
 * Throws a Poffin at a Pokémon to make it easier to catch.
 * @param {number} [pkmn=0] - The ID of the Pokémon to throw the Poffin at.
 * @returns {Promise<Response>} - A promise that resolves to the response of the fetch request.
 */
async function throwPoffin(pkmn = 0) {
  return fetch("https://pokeheroes.com/includes/ajax/safari/throwPoffin.php", {
    headers: headers,
    referrer: "https://pokeheroes.com/safari_zone?",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: `id=${pkmn}`,
    method: "POST",
    mode: "cors",
    credentials: "include",
  });
}

/**
 * Extracts information about available Pokémon in the Safari Zone from the HTML source.
 * @param {string} html - The HTML source code of the Safari Zone page.
 * @returns {Array<object>} - An array of objects, where each object represents a Pokémon and contains its index, pkmnid, area, and speed.
 */
function getAllSafariPokemon(html) {
  // Regex to extract the safariPkmnArr from the javascript in HTML
  const regex = /safariPkmnArr\[(?<index>\d+)\]=Array\('(?<pkmnid>[^']+)', '(?<area>[^']+)', (?<speed>\d+)\);/g;
  const matches = [...html.matchAll(regex)];

  // Initialize your existing safariPkmnArr
  const safariPkmnArr = [];

  // Populate the safariPkmnArr with the extracted data
  // Data looks like this: safariPkmnArr[21] = Array('0123', 'g', 13);
  // Where the array index seems to be random but is important for requests, the id (0123) is the pkmnid, 'g' is ground ('s' is sky), and 13 is the speed out of 3, 6, 13.
  matches.forEach((match) => {
    const { index, pkmnid, area, speed } = match.groups;
    safariPkmnArr.push({
      index: parseInt(index, 10),
      pkmnid: pkmnid,
      area: area,
      speed: parseInt(speed, 10),
    });
  });

  return safariPkmnArr;
}

function selectPokemon(allSafariPokemon) {
  const legendary = ["641", "642", "645"];
  const special = ["479"]; // Rotom
  const vivillon = "666";

  // Helper: pick highest speed from array
  const pickFastest = (arr) => arr.reduce((a, b) => (a.speed > b.speed ? a : b), arr[0]);

  // Normalizer: extract base form (without first digit indicating shinyness)
  const getBaseId = (p) => p.pkmnid.slice(1);
  const isShiny = (p) => p.pkmnid.startsWith("1");

  // 1. Shiny + Legendary
  const shinyLegendaries = allSafariPokemon.filter((p) => isShiny(p) && legendary.includes(getBaseId(p)));
  if (shinyLegendaries.length) return pickFastest(shinyLegendaries);

  // 2. Shiny + Special
  const shinySpecials = allSafariPokemon.filter((p) => isShiny(p) && special.includes(getBaseId(p)));
  if (shinySpecials.length) return pickFastest(shinySpecials);

  // 3. Any shiny
  const shinies = allSafariPokemon.filter(isShiny);
  if (shinies.length) return pickFastest(shinies);

  // 4. Legendary
  const legendaries = allSafariPokemon.filter((p) => legendary.includes(getBaseId(p)));
  if (legendaries.length) return pickFastest(legendaries);

  // 5. Special
  const specials = allSafariPokemon.filter((p) => special.includes(getBaseId(p)));
  if (specials.length) return pickFastest(specials);

  // TODO: Make this yesVivillon and ignore the other bugs that are better of cought in bug hatching contest anyways.
  // 6. Non Vivillon
  const noVivi = allSafariPokemon.filter((p) => !getBaseId(p).startsWith(vivillon));
  if (noVivi.length) return pickFastest(noVivi);

  // 7. Fallback: highest speed overall
  return pickFastest(allSafariPokemon);
}

/**
 * Throws some puffins, and a ball at a given pokemon.
 * @async
 * @param {number} [id=0] - The ID of the Pokémon to throw items at.
 * @returns {(boolean | null)} `true` if caught, `false` if not, null if over
 */
async function throwItems(id = 0) {
  // Throw some puffins
  const MAX_PUFFINS = 3;
  const DELAY_BETWEEN_THROWS = 200;
  for (let i = 0; i <= MAX_PUFFINS; i++) {
    await throwPoffin(id);
    await delay(DELAY_BETWEEN_THROWS);
  }

  // Then throw ball
  const response = await throwBall(id);
  const html = await response.text();
  await delay(DELAY_BETWEEN_THROWS);

  if (html.includes("true")) {
    // <script>caughtSafariPokemon(33, true);</script>
    logMsg(tag, logLevels.Interesting, `Caught it!`);
    return true;
  } else if (html.includes("false")) {
    // <script>caughtSafariPokemon(33, false);</script>
    return false;
  } else {
    // If not includes true or false, then no balls are left and the game is over.
    logMsg(tag, logLevels.Valuable, `Game over!`);
    return null;
  }
}

/**
 * Handles the logic for playing the Safari Zone game, including starting the game, identifying Pokémon, and throwing items.
 * @async
 * @returns {void}
 */
export async function handleSafariZone() {
  try {
    let response = await startSafari();
    let html = await response.text();
    if (html.includes("Your caught Pokémon stack has reached its maximum!")) {
      logMsg(tag, logLevels.Necessary, `Can't start safari. Adopt or release some caught pokemon first!`);
      return;
    }

    // Redo request to get actual values after initializing the safari.
    response = await startSafari();
    html = await response.text();
    const allSafariPokemon = getAllSafariPokemon(html);
    logMsg(tag, logLevels.Valuable, `Found a total of [${allSafariPokemon.length}] Pokémon in the Safari Zone.`);

    let gameover = false;
    while (!gameover) {
      const selectedPokemon = selectPokemon(allSafariPokemon);
      if (!selectedPokemon) {
        logMsg(tag, logLevels.Valuable, `No more catchable Pokémon found...`);
        break;
      }

      logMsg(tag, logLevels.Valuable, `Targeting ${selectedPokemon.pkmnid} (Speed: ${selectedPokemon.speed})`);

      let caught = false;
      while (!caught && !gameover) {
        caught = await throwItems(selectedPokemon.index);
        gameover = caught === null;

        // Remove caught Pokémon from available list
        const index = allSafariPokemon.findIndex(
          (p) => p.index === selectedPokemon.index && p.pkmnid === selectedPokemon.pkmnid,
        );
        if (index > -1) allSafariPokemon.splice(index, 1);
      }
    }
  } catch (error) {
    logErr(tag, ``, error);
    handleSafariZone();
  }
}
