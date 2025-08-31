import { headers } from "../a-shared/const.js";
import { logMsg, logVal, logErr, logLevels } from "../a-shared/logger.js";

const tag = "CHEAT";

function getImageURL(imageId) {
  return fetch(`https://pokeheroes.com/img/pkmnimage?id=${imageId}`, {
    headers: headers,
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
    redirect: "manual",
  });
}

/**
 * Checks the cheat by fetching the image and parsing the URL.
 * @param {number} [imageId=0] - The ID of the image to check.
 * @returns {Promise<number>} - A promise that resolves to the parsed image ID or 0 in case of an error.
 */
async function checkCheatFetch(imageId = 0) {
  try {
    const response = await getImageURL(imageId);
    const redirectURL = response.headers?.get("location");
    const idLength = 4;
    const responseHtml = redirectURL
      .replace("//staticpokeheroes.com/img/pokemon/img.php?c=", "")
      .substring(0, idLength);
    const pkmnId = parseInt(responseHtml, 10);

    return pkmnId;
  } catch (error) {
    logErr(tag, ``, error);
    return 0;
  }
}

/**
 * Fetches the cheat.
 * @param {string} [clType="newest"] - The click list type.
 * @returns {Promise<Response>} - A promise that resolves to the response from the fetch request.
 */
async function getCheatFetch(clType = "newest") {
  const url = `https://pokeheroes.com/pokemon_lite?cl_type=${clType}`;

  return fetch(url, {
    headers: headers,
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

/**
 * Solves the cheat by sending the Pokémon ID.
 * @param {number} [pkmnId=0] - The ID of the Pokémon to select.
 * @returns {Promise<Response>} - A promise that resolves to the response from the fetch request.
 */
async function solveCheatFetch(pkmnId = 0) {
  const url = `https://pokeheroes.com/includes/ajax/cheat_valid/pkmn_select.php`;

  return fetch(url, {
    headers: headers,
    referrer: "https://pokeheroes.com/pokemon_lite?cl_type=newest",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: `id=${pkmnId}`,
    method: "POST",
    mode: "cors",
    credentials: "include",
  });
}

/**
 * Handles the cheat validation process.
 */
export async function handleCheat(html = null, requestUrl = null) {
  try {
    if (html.includes("displayCheatValidator")) {
      logMsg("CHEAT", logLevels.Interesting, `Cheat validator detected at ${requestUrl}. Attempting to solve...`);
      const html = await (await getCheatFetch()).text();

      const match = html.match(/bw_field\/(?<needle>\d+)\.png/);
      let needle = 0;
      if (match) {
        needle = match.groups.needle;
        logMsg(tag, logLevels.Debug, `Searching for [${needle}].`);
      } else {
        logMsg(tag, logLevels.Debug, `No match found...`);
      }

      const matchAll = [...html.matchAll(/chooseValidation\((?<haystack>\d+)\)/g)];
      const haystack = matchAll.map((match) => match.groups.haystack);

      logVal(tag, logLevels.Debug, `Candidates to try:`, haystack);
      let solved = false;
      const pkmnIds = [];

      // Use Promise.all to await all promises
      await Promise.all(
        haystack.map(async (imgId) => {
          try {
            const pkmnId = await checkCheatFetch(imgId);
            pkmnIds.push(pkmnId);
            if (pkmnId == needle) {
              solved = true;
              await solveCheatFetch(pkmnId);
              logMsg(
                tag,
                logLevels.Interesting,
                `Solved cheat validator with haystack [${haystack}], needle [${needle}], Pokemon [${pkmnIds} > ${pkmnId}]`,
              );
            }
          } catch (error) {
            logErr(tag, ``, error);
          }
        }),
      );
      if (!solved) {
        logMsg(
          tag,
          logLevels.Necessary,
          `Couldn't solve cheat validator with haystack [${haystack}], needle [${needle}], Pokemon [${pkmnIds}]!`,
        );
      }
    }
  } catch (error) {
    logErr(tag, ``, error);
  }
}
