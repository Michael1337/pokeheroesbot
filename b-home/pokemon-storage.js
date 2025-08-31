import { headers, rarities, WAIT_TIMES } from "../a-shared/const.js";
import { logMsg, logErr, logLevels, logVal } from "../a-shared/logger.js";
import { adoptEgg } from "../c-town/rowan-lab/adoption.js";
import getConfig from "../a-shared/config.js";
import pLimit from "p-limit"; // To limit concurrent requests
import { doWonderTrade, undoWonderTrade } from "../c-town/wonder-trade.js";
import { doAuctionSetup } from "../c-town/auction.js";
import { delay } from "../a-shared/utils.js";
import { getOakChallengePokemon } from "../c-town/emera-square/oak-contest.js";

const tag = "POKEMON STORAGE";
const unusableBoxes = 2; // Party + Egg Storage
const requestLimit = 5;
const limit = pLimit(requestLimit); // Limit concurrency to 5 requests at a time

function loadBoxes(box = 0) {
  return fetch("https://pokeheroes.com/includes/ajax/storage_box/load_box_select.php", {
    headers: headers,
    referrer: "https://pokeheroes.com/storage_box",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: `sel_box=${box}`,
    method: "POST",
    mode: "cors",
    credentials: "include",
  });
}

function loadPokemonsFromBox(box = 0) {
  return fetch("https://pokeheroes.com/includes/ajax/storage_box/load_pkmn_list.php", {
    headers: headers,
    referrer: "https://pokeheroes.com/storage_box",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: `box=${box}`,
    method: "POST",
    mode: "cors",
    credentials: "include",
  });
}

function getPokemonInfo(pkmnid = 0) {
  return fetch("https://pokeheroes.com/includes/ajax/storage_box/pkmn_info.php", {
    headers: headers,
    referrer: "https://pokeheroes.com/storage_box",
    body: `pkmnid=${pkmnid}`,
    method: "POST",
    mode: "cors",
    credentials: "include",
  });
}

function loadParty() {
  return fetch("https://pokeheroes.com/party", {
    headers: headers,
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

function giveItem(itemname = "Everstone", pkmnid = 0) {
  return fetch("https://pokeheroes.com/bag", {
    headers: headers,
    referrer: "https://pokeheroes.com/bag",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: `itemname=${itemname}&pkmn_select=${pkmnid}`,
    method: "POST",
    mode: "cors",
    credentials: "include",
  });
}

export function takeItem(pkmnid = 0) {
  return fetch("https://pokeheroes.com/take_item", {
    headers: headers,
    referrer: "https://pokeheroes.com/pokemon?id=10101010",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: `take_item=${pkmnid}`,
    method: "POST",
    mode: "cors",
    credentials: "include",
  });
}

function loadPokemon(id = 0) {
  return fetch(`https://pokeheroes.com/pokemon?id=${id}`, {
    headers: headers,
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

function releasePokemon(pkmn = 0) {
  return fetch("https://pokeheroes.com/release", {
    headers: headers,
    referrer: `https://pokeheroes.com/pokemon?id=${pkmn}`,
    body: `release_pkmn=${pkmn}`,
    method: "POST",
    mode: "cors",
    credentials: "include",
  });
}

/**
 * Extracts box data from HTML and creates an array of objects.
 * @param {string} html - The HTML containing the box buttons.
 * @param {string|null} name - If provided, only boxes with this name are returned.
 * @returns {Array<object>} An array of objects representing the boxes.
 */
function getBoxes(html, name = null) {
  const regex =
    /onclick="selectBox\((?<id>-?\d+),.*?, '(?<name>.*?)'\);".*?>(?<label>.*?) \((?<current>\d+)\/(?<max>\d+)\)<\/button>/g;
  const matches = [...html.matchAll(regex)];

  let boxes = matches.map((match) => {
    const id = parseInt(match.groups.id, 10);
    const boxName = match.groups.name || match.groups.label.trim(); // Use name if available, otherwise use label
    const current = parseInt(match.groups.current, 10);
    const max = parseInt(match.groups.max, 10);
    const remaining = max - current;

    return {
      id,
      name: boxName,
      current,
      max,
      remaining,
    };
  });

  if (name !== null) {
    boxes = boxes.filter((box) => box.name === name);
  }

  return boxes;
}

export async function movePokemon(boxNameOrId = 1, pkmnid = 0) {
  let box = boxNameOrId;
  if (typeof boxNameOrId === "string") {
    const html = await (await loadBoxes()).text();
    const boxData = getBoxes(html);
    box = boxData.find((box) => box.name === boxNameOrId)?.id;
  }

  // Convert single ID to array and filter any invalid values
  const pkmnids = Array.isArray(pkmnid) ? pkmnid : [pkmnid];

  // Create URL-encoded body with array syntax
  const bodyParams = new URLSearchParams();
  bodyParams.append("box", box);
  pkmnids.forEach((id) => bodyParams.append("pkmn[]", id));

  return fetch("https://pokeheroes.com/includes/ajax/storage_box/move_pkmn.php", {
    headers: headers,
    referrer: "https://pokeheroes.com/storage_box",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: bodyParams.toString(),
    method: "POST",
    mode: "cors",
    credentials: "include",
  });
}

function _getSpecialPokemon(pokemonData) {
  return pokemonData.filter((pokemon) => {
    return pokemon.shiny || pokemon.shadow || pokemon.mega || pokemon.speciesName.includes("(Retro)");
  });
}

function getDuplicatePokemon(pokemonData) {
  const duplicatePokemon = [];
  const uniquePokemonMap = {};

  pokemonData.forEach((pokemon) => {
    const uniquenessKey = pokemon.uniquenessKey;
    const existingPokemon = uniquePokemonMap[uniquenessKey];

    if (existingPokemon) {
      // Keep Pokemon if I'm the OriginalTrainer
      if (pokemon.trainer === pokemon.originalTrainer && existingPokemon.trainer !== existingPokemon.originalTrainer) {
        uniquePokemonMap[uniquenessKey] = pokemon;
        duplicatePokemon.push(existingPokemon);
        return;
      } else if (
        existingPokemon.trainer === existingPokemon.originalTrainer &&
        pokemon.trainer !== pokemon.originalTrainer
      ) {
        duplicatePokemon.push(pokemon);
        return;
      }

      // Keep Pokemon with best IV
      if (pokemon.ivPerfectCount > existingPokemon.ivPerfectCount) {
        uniquePokemonMap[uniquenessKey] = pokemon;
        duplicatePokemon.push(existingPokemon);
        return;
      } else if (pokemon.ivPerfectCount < existingPokemon.ivPerfectCount) {
        duplicatePokemon.push(pokemon);
        return;
      }

      // Keep pokemon with higher level
      if (pokemon.level > existingPokemon.level) {
        uniquePokemonMap[uniquenessKey] = pokemon;
        duplicatePokemon.push(existingPokemon);
        return;
      } else if (pokemon.level < existingPokemon.level) {
        duplicatePokemon.push(pokemon);
        return;
      }

      // Keep pokemon with higher exp
      if (pokemon.exp > existingPokemon.exp) {
        uniquePokemonMap[uniquenessKey] = pokemon;
        duplicatePokemon.push(existingPokemon);
      } else {
        duplicatePokemon.push(pokemon);
      }
    } else {
      // Add to map if it's the first Pokémon with this img and mega combination
      uniquePokemonMap[uniquenessKey] = pokemon;
    }
  });

  return [duplicatePokemon, Object.values(uniquePokemonMap)];
}

function parseAgeToMs(ageStr) {
  const str = ageStr.toLowerCase();
  let ms = 0;
  /* eslint-disable no-magic-numbers */
  const units = [
    { regex: /(?<num>\d+)\s*year/g, ms: 365 * 24 * 60 * 60 * 1000 },
    { regex: /(?<num>\d+)\s*month/g, ms: 30 * 24 * 60 * 60 * 1000 },
    { regex: /(?<num>\d+)\s*week/g, ms: 7 * 24 * 60 * 60 * 1000 },
    { regex: /(?<num>\d+)\s*day/g, ms: 24 * 60 * 60 * 1000 },
    { regex: /(?<num>\d+)\s*hour/g, ms: 60 * 60 * 1000 },
    { regex: /(?<num>\d+)\s*minute/g, ms: 60 * 1000 },
    { regex: /(?<num>\d+)\s*second/g, ms: 1000 },
  ];
  /* eslint-enable no-magic-numbers */

  for (const { regex, ms: unitMs } of units) {
    let m;
    while ((m = regex.exec(str)) !== null) {
      ms += parseInt(m.groups.num, 10) * unitMs;
    }
  }
  return ms;
}

/**
 * Extracts Pokemon data from HTML content of a Pokemon box.
 * @param {string} html - The HTML content of the Pokemon box.
 * @param {Object} box - The box data, including id and name.
 * @return {Promise<Array<Object>>} A promise that resolves to an array of Pokemon objects with their details.
 */
async function extractPokemonDataFromBox(html, box) {
  const regexes = {
    pokemon: /<tr class="pkmn_wrapper(?<id>\d+)">.*?<\/tr>\s*<tr class="pkmn_wrapper\1">.*?<\/tr>/gs,
    name: /<a onclick="showPkmnInfo\(\d+\).*?>(?<name>.*?)<\/a>/,
    level: /Level: (?<level>\d+)/,
    gender: /gender_icons\/(?<gender>[m|f|g])\.png/,
    item: /img\/items\/.*?title="(?<item>[^"]+)">/,
    shiny: /misc\/shiny_star\.png/,
    shadow: /misc\/shadow_star\.png/,
    mega: /img\/mega\/(?:[a-zA-Z0-9]+\/)?\d+\.png/,
  };

  const pokemonMatches = [...html.matchAll(regexes.pokemon)];
  logMsg(tag, logLevels.Interesting, `Found ${pokemonMatches.length} Pokémon in box ${box.id}.`);

  const results = await Promise.allSettled(
    pokemonMatches.map((match) =>
      limit(async () => {
        try {
          const pokemonHTML = match[0];
          const extractData = (regex) => pokemonHTML.match(regex)?.groups ?? {};
          const { id } = match.groups;
          const { name } = extractData(regexes.name);
          const { level } = extractData(regexes.level);
          const { gender } = extractData(regexes.gender);
          const { item } = extractData(regexes.item);

          const loadedInfoResponse = await loadPokemon(id);
          const loadedInfoHTML = await loadedInfoResponse.text();

          const shiny = regexes.shiny.test(pokemonHTML);
          const shadow = regexes.shadow.test(pokemonHTML);
          const mega = regexes.mega.test(pokemonHTML);

          // Extract additional data from loaded info
          const matchImg = loadedInfoHTML.match(/pokemon\/img\.php\?c=(?<imageCode>[^"]+)/);
          const loadedInfoPokemonImage = matchImg && matchImg.groups ? matchImg.groups.imageCode : null;

          // Count occurrences of "ivperfect"
          const ivPerfectCount = (loadedInfoHTML.match(/class="ivperfect"/g) || []).length;

          // Extract stats
          const statKeyMap = {
            "Health Points": "hp",
            Attack: "attack",
            Defense: "defense",
            "Sp. Attack": "spAttack",
            "Sp. Defense": "spDefense",
            Speed: "speed",
          };

          const statsRegex =
            /<td class="poketable1"[^>]*>\s*(?<statName>[^<]+?)\s*<\/td>\s*<td class="poketable2"[^>]*>\s*(?<statValue>\d+)/g;
          const stats = {};
          let statMatch;
          while ((statMatch = statsRegex.exec(loadedInfoHTML)) !== null) {
            const { statName, statValue } = statMatch.groups;
            const key = statKeyMap[statName.trim()];
            if (key) {
              stats[key] = parseInt(statValue, 10);
            }
          }

          // Add total of all stats
          const statsTotal = Object.values(stats).reduce((sum, val) => sum + (typeof val === "number" ? val : 0), 0);

          // Extract EXP
          const expMatch = loadedInfoHTML.match(/EXP:<\/b>\s*(?<expString>[\d,]+)\s/);
          const expString = expMatch && expMatch.groups ? expMatch.groups.expString : "0,0";
          const exp = parseInt(expString.replace(/,/g, ""), 10);

          // Extract pokedexNo
          const pokedexNoMatch = loadedInfoHTML.match(
            /<td class="poketable1" style="opacity: 0.8">\s*Pokédex No.\s*<\/td>\s*<td class="poketable2" style="opacity: 0.8">\s*#(?<pokedexNo>[^<]+)<\/td>/,
          );
          const pokedexNo = pokedexNoMatch && pokedexNoMatch.groups ? pokedexNoMatch.groups.pokedexNo.trim() : null;

          // Extract rarity
          const rarityMatch = loadedInfoHTML.match(
            /<td class="poketable1">\s*Rarity\s*<\/td>\s*<td class="poketable2">\s*(?<rarity>[^<]+)<\/td>/,
          );
          const rarity = rarityMatch && rarityMatch.groups ? rarityMatch.groups.rarity.trim() : null;

          // Extract types from HTML
          const typesMatch = loadedInfoHTML.match(
            /<td class="poketable1"[^>]*>\s*Type\s*<\/td>\s*<td class="poketable2"[^>]*>(?<typesHtml>[\s\S]*?)<\/td>/i,
          );
          const types = [];
          if (typesMatch && typesMatch.groups && typesMatch.groups.typesHtml) {
            // Find all type names in the <img ... type_icons/TYPE.gif"> tags
            const typeRegex = /type_icons\/(?<type>[a-z]+)\.gif/gi;
            let typeMatch;
            while ((typeMatch = typeRegex.exec(typesMatch.groups.typesHtml)) !== null) {
              types.push(typeMatch.groups.type);
            }
          }

          // Extract trainer's name
          const trainerMatch = loadedInfoHTML.match(
            /<td class="poketable1">\s*Trainer\s*<\/td>\s*<td class="poketable2">\s*<a href="[^"]+">(?<trainerName>[^<]+)<\/a>/,
          );
          const trainer = trainerMatch && trainerMatch.groups ? trainerMatch.groups.trainerName : null;

          // Extract original trainer's name
          const originalTrainerMatch = loadedInfoHTML.match(
            /<td class="poketable1" style="opacity: 0.8">\s*Origin\. Trainer\s*<\/td>\s*<td class="poketable2" style="opacity: 0.8">\s*<a href="[^"]+">(?<originalTrainerName>[^<]+)<\/a>/,
          );
          const originalTrainer =
            originalTrainerMatch && originalTrainerMatch.groups
              ? originalTrainerMatch.groups.originalTrainerName
              : null;

          // Extract breeder's name
          const breederMatch = loadedInfoHTML.match(
            /<td class="poketable1">\s*Breeder\s*<\/td>\s*<td class="poketable2">\s*<a href="[^"]+">(?<breederName>[^<]+)<\/a>/,
          );
          const breeder = breederMatch && breederMatch.groups ? breederMatch.groups.breederName : null;

          // Extract age and obtained-from info
          let ageMs = null;
          let obtainedFrom = null;

          // Match the "Obtained" row and the next non-empty poketable2 cell (named groups)
          const obtainedRegex =
            /<td class="poketable1"[^>]*>\s*Obtained\s*<\/td>\s*<td class="poketable2"[^>]*>\s*(?<ageStr>[^<]+?)\s*<\/td>\s*<td>\s*<\/td>\s*<td class="poketable2"[^>]*>\s*(?<obtainedFrom>[^<]+?)\s*<\/td>/i;
          const obtainedMatch = loadedInfoHTML.match(obtainedRegex);

          if (obtainedMatch && obtainedMatch.groups) {
            const ageStr = obtainedMatch.groups.ageStr.trim();
            ageMs = parseAgeToMs(ageStr);

            // The next cell is the "obtained from" string (e.g., "Adopted from the Lab", "Bug-Hatching Contest")
            obtainedFrom = obtainedMatch.groups.obtainedFrom.trim();
          } else {
            // Fallback: Try to get just the age and then the next non-link cell (named group)
            const ageMatch = loadedInfoHTML.match(
              /<td class="poketable1"[^>]*>\s*Obtained\s*<\/td>\s*<td class="poketable2"[^>]*>\s*(?<ageStr>[^<]+?)\s*<\/td>/i,
            );
            if (ageMatch && ageMatch.groups) {
              const ageStr = ageMatch.groups.ageStr.trim();
              ageMs = parseAgeToMs(ageStr);

              // Try to get the next poketable2 cell that is not a link or family tree (named group)
              const afterAgeRegex = /<td class="poketable2"[^>]*>\s*(?<cellVal>[^<]+?)\s*<\/td>/gi;
              let m,
                found = false;
              while ((m = afterAgeRegex.exec(loadedInfoHTML)) !== null) {
                if (found) {
                  const val = m.groups.cellVal.trim();
                  if (val && !val.includes("Family Tree") && !val.includes("<a")) {
                    obtainedFrom = val;
                    break;
                  }
                }
                if (m.groups.cellVal.trim() === ageStr) found = true;
              }
            }
          }

          const uniquenessKey = `${loadedInfoPokemonImage}_${mega}`; // Combine img and mega to create a unique key for comparison
          // Other than mega, there might be more specials that are not visible from the img, but I don't know of any other.

          return {
            boxId: box.id,
            boxName: box.name,
            id: parseInt(id, 10),
            speciesName: name ?? null,
            pokedexNo: pokedexNo ? parseInt(pokedexNo, 10) : null,
            img: loadedInfoPokemonImage,
            gender: gender ?? null,
            shiny: shiny,
            shadow: shadow,
            mega: mega,
            item: item ? item.replace("-", " ") : null,
            trainer: trainer,
            originalTrainer: originalTrainer,
            breeder: breeder,
            obtainedFrom: obtainedFrom,
            rarity: rarity,
            types: types,
            level: level ? parseInt(level, 10) : null,
            exp: exp,
            ivPerfectCount: ivPerfectCount,
            stats: stats,
            statsTotal: statsTotal,
            ageMs: ageMs,
            uniquenessKey: uniquenessKey,
          };
        } catch (error) {
          logErr(tag, `Failed to process Pokémon in box ${box.id}:`, error);
        }
      }),
    ),
  );

  // Filter successful results
  return results.filter((result) => result.status === "fulfilled").map((result) => result.value);
}

/**
 * Extracts Pokémon or egg data from HTML content of the party field.
 * @param {string} html - The HTML content of the party field.
 * @return {Array<Object>} An array of Pokémon or egg objects with their details.
 */
function getPartyData(html) {
  const regexes = {
    pkmnid: /data-pkmnid='(?<pkmnid>\d+)'/,
    image: /img\.php\?c=(?<image>\d+[^&"']?)[&'"]?/,
    number: /<b>(?:#(?<number>\d+)|EGG)<\/b>/,
    species: /<i>\((?<species>.*?)\)<\/i>\s*<img/,
    name: /<b>(?<name>[^<]+)<\/b>\s*<img/,
    expOrEhpCurrent: /<b>(?:EXP:|EHP:)<\/b>\s*(?<expOrEhpCurrent>[\d,]+)/,
    expOrEhpMax: /<b>(?:EXP:|EHP:)<\/b>\s*[\d,]+\/(?<expOrEhpMax>[\d,]+)/,
  };

  return html
    .split("<div id='party_field'")
    .slice(1)
    .map((entry) => {
      const extractData = (regex) => entry.match(regex)?.groups ?? {};
      const { pkmnid } = extractData(regexes.pkmnid);
      const { image } = extractData(regexes.image);
      const { number } = extractData(regexes.number);
      const { species } = extractData(regexes.species);
      const { name } = extractData(regexes.name);
      const { expOrEhpCurrent } = extractData(regexes.expOrEhpCurrent);
      const { expOrEhpMax } = extractData(regexes.expOrEhpMax);

      const isEgg = number === undefined;

      const current = expOrEhpCurrent ? parseInt(expOrEhpCurrent.replace(",", ""), 10) : null;
      const max = expOrEhpMax ? parseInt(expOrEhpMax.replace(",", ""), 10) : null;
      const missing = max !== null && current !== null ? max - current : null;

      return {
        pkmnid: pkmnid ? parseInt(pkmnid, 10) : null,
        image: image ? image : null,
        number: isEgg ? null : number ? parseInt(number, 10) : null,
        species: isEgg ? "egg" : species ? species.trim() : name ? name.trim() : null,
        expOrEhpCurrent: current,
        expOrEhpMax: max,
        expOrEhpMissing: missing,
        isEgg,
      };
    })
    .filter((entry) => entry.pkmnid !== null);
}

export async function getParty() {
  const html = await (await loadParty()).text();
  const partyData = getPartyData(html);
  return partyData;
}

function getRarityFromHTML(html) {
  const regex = /<b>Rarity:<\/b>\s*(?<rarity>\w+)<br>/;
  const match = regex.exec(html);
  if (match && match.groups) {
    return match.groups.rarity;
  }
}

export async function addBoxDataDetails(boxPokemon) {
  return await Promise.all(
    boxPokemon.map(async (pokemon) => {
      const html = await (await getPokemonInfo(pokemon.pkmnid)).text();
      const rarity = getRarityFromHTML(html);

      return {
        ...pokemon,
        rarity,
      };
    }),
  );
}

export async function getLatestAdoption() {
  try {
    const partyData = await getParty();
    const eggs = partyData.filter((pokemon) => pokemon.isEgg);

    // Find the egg with the lowest EHP
    const latestEgg = eggs.reduce((minEgg, egg) => {
      if (!minEgg || egg.expOrEhpCurrent < minEgg.expOrEhpCurrent) return egg;
      return minEgg;
    }, null);

    if (latestEgg) {
      return latestEgg.pkmnid;
    } else {
      return null;
    }
  } catch (error) {
    logErr(tag, `Error when getting latest adoption`, error);
    return null;
  }
}

export async function storePartyPokemonAndAdoptEgg() {
  try {
    let html = await (await loadBoxes()).text();
    const boxData = getBoxes(html);
    const firstBoxWithSpace = boxData.find((box) => box.id >= 1 && box.remaining > 0);

    const partyData = await getParty();
    const PARTY_POKEMONS_TO_KEEP = await getConfig("PARTY_POKEMONS_TO_KEEP");
    const oakPokemon = await getOakChallengePokemon();

    // Only process Pokémon not meant to be kept
    // Might need to be array of IDs? No use case at the moment...
    let pokemonsToProcess = partyData.slice(PARTY_POKEMONS_TO_KEEP);

    for (const pokemon of [...pokemonsToProcess]) {
      // Iterate over a shallow copy
      if (!pokemon.isEgg && pokemon.pkmnid !== oakPokemon) {
        // Would like to log every rare Pokémon, but impossible from party screen.
        // So only logging shiny/shadow (not starting with 0) and special variations (not ending with a digit).
        if (!/^0.*\d$/.test(pokemon.image)) {
          logMsg(
            tag,
            logLevels.Interesting,
            `Moving Pokémon [${pokemon.pkmnid} (${pokemon.species}, ${pokemon.image})] to box [${firstBoxWithSpace.id} (${firstBoxWithSpace.current}/${firstBoxWithSpace.max})].`,
          );
        }
        html = await (await movePokemon(firstBoxWithSpace.id, pokemon.pkmnid)).text();
        if (html.includes("ERROR")) {
          const match = html.match(/text\("(?<error>.*?)"\)/);
          if (match) {
            logMsg(tag, logLevels.Valuable, `${match.groups.error}`);
            // Reload and retry after a delay if storage is full
            await delay(WAIT_TIMES.ONE_SECOND);
            await storePartyPokemonAndAdoptEgg();
            return;
          }
        } else {
          // Remove moved Pokémon from the array
          pokemonsToProcess = pokemonsToProcess.filter((p) => p.pkmnid !== pokemon.pkmnid);
        }

        await giveItem("Everstone", pokemon.pkmnid);
      }
    }

    // Pass the updated array (remaining party Pokémon) to adoptEgg
    await adoptEgg(pokemonsToProcess);
  } catch (error) {
    logErr(tag, `Error when handling Pokemon Storage`, error);
  }
}

export async function getRemainingEggStorage() {
  const html = await (await loadBoxes()).text();
  const boxData = getBoxes(html);
  const eggBox = boxData.find((box) => box.id === -1);
  if (!eggBox) {
    logErr(tag, "Could not find Egg Storage box data.", html);
    return 0; // Assume full to be safe
  }
  return eggBox.remaining;
}

export async function getEggsFromEggStorage() {
  const boxPokemonHTML = await (await loadPokemonsFromBox(-1)).text();
  const regex = /showPkmnInfo\((?<pkmnid>\d+)\);\s*[^>]*>\s*.*?EHP:\s*(?<ehp>[\d,/]+)\s*</gs;
  const eggs = Array.from(boxPokemonHTML.matchAll(regex)).map((m) => {
    const { pkmnid, ehp } = m.groups;
    const [current, max] = ehp.replace(/,/g, "").split("/");
    const missingEHP = Number(max) - Number(current);
    return { pkmnid, missingEHP };
  });
  return eggs;
}

export async function getAllPokemonDataBasicFromBox(boxName = null) {
  const html = await (await loadBoxes()).text();
  const boxData = getBoxes(html, boxName);

  const allPokemonData = [];

  for (const box of boxData) {
    logMsg(tag, logLevels.Debug, `Now getting Pokemon from box [${box.id}: ${box.name}].`);
    const boxPokemonHTML = await (await loadPokemonsFromBox(box.id)).text();

    const regex = /showPkmnInfo\((?<id>\d+)\);[^>]*>(?<name>[^<]+)</g;

    let match;
    while ((match = regex.exec(boxPokemonHTML)) !== null) {
      const { id, name } = match.groups;
      allPokemonData.push({ id, name });
    }
  }

  return allPokemonData;
}

async function getAllPokemonFromBoxes(boxData) {
  let allPokemon = [];

  for (const box of boxData) {
    if (box.id < 1) continue; // Skip Party and Egg Storage
    logMsg(tag, logLevels.Debug, `Now getting Pokemon from box [${box.id}: ${box.name}].`);
    const boxPokemonHTML = await (await loadPokemonsFromBox(box.id)).text();
    const boxPokemonJson = await extractPokemonDataFromBox(boxPokemonHTML, box);
    allPokemon = [].concat(allPokemon, boxPokemonJson);
  }
  return allPokemon;
}

async function releaseExtraPokemon(groupedPokemons) {
  const raritiesToRelease = ["Easy", "Medium", "Hard"];
  const minDuplicatesToKeepGenderless = 3;
  const minDuplicatesToKeep = 2;

  for (const uniquenessKey in groupedPokemons) {
    const group = groupedPokemons[uniquenessKey];
    if (!raritiesToRelease.includes(group[0].rarity)) continue; // Keep rarer Pokemons for trading.

    const minToKeep = group[0].gender === "g" ? minDuplicatesToKeepGenderless : minDuplicatesToKeep;

    if (group.length > minToKeep) {
      // Sort by level ascending (release lowest-level first)
      group.sort((a, b) => a.level - b.level);
      const toRelease = group.length - minToKeep;
      for (let i = 0; i < toRelease; i++) {
        // Instead of releasing one by one, we could mass release, but if something goes wrong there, maybe nothing is released.
        // Also, if this is done regularly, only a few Pokemons have to be released each time.
        const html = await (await releasePokemon(group[i].id)).text();
        if (html.includes("greenfield") && html.includes("Your Pokémon has been released to the wild.")) {
          logMsg(
            tag,
            logLevels.Interesting,
            `Released [${group[i].speciesName} (${group[i].gender}, ${group[i].rarity})] [${group[i].id}]`,
          );
        } else if (html.includes("This Pokemon has been set up for the next Wondertrade.")) {
          logMsg(
            tag,
            logLevels.Valuable,
            `Could NOT release [${group[i].speciesName} (${group[i].gender}, ${group[i].rarity})] [${group[i].id}] because it is set up for WT.`,
          );
        } else {
          logErr(tag, `Could NOT release [${group[i].speciesName} (${group[i].gender})] [${group[i].id}]`, html);
        }
      }
      // Remove the released Pokemon from group for fruther processing.
      groupedPokemons[uniquenessKey] = group.slice(toRelease);
    }
  }
}

async function setTrades(counts, selectedPokemon) {
  // Always keep some Pokemon since they also have to evolve, and sometimes even multiple times.
  const minDuplicatesToKeepGenderless = 2;
  const minDuplicatesToKeep = 1;
  const wtAmount = 5; // TODO: Not necessarily, maybe fewer. Get from /gts_wondertrade
  const auctionAmount = 8; // Only with Premium, but always try 8 anyways.

  // Build eligible pokemons list that we have enough duplicates of.
  const tradables = Object.entries(counts)
    .filter(([key, count]) => {
      const pokemon = selectedPokemon[key];
      if (pokemon.shiny) return false; // TODO: Implement tradeable shinies separately, currently only doing Shiny Wonder Trade with them searching for Ho-oh.
      return pokemon.gender === "g" ? count > minDuplicatesToKeepGenderless : count > minDuplicatesToKeep;
    })
    .map(([key]) => selectedPokemon[key]);

  logMsg(
    tag,
    logLevels.Valuable,
    `Choosing [${wtAmount}] for Wonder Trade and [${auctionAmount}] for Auction from [${tradables.length}] tradable duplicates...`,
  );

  // Select WT: most common, tiebreaker lowest rarity, with unique pokedexNo
  const seenPkdx = new Set();
  const wonderTradePokemons = [];

  for (const pokemon of tradables.slice().sort((a, b) => {
    if (counts[b.id] !== counts[a.id]) {
      return counts[b.id] - counts[a.id]; // Most duplicates first
    }
    const rA = rarities[a.rarity] || Infinity,
      rB = rarities[b.rarity] || Infinity;
    return rA - rB; // More common (lowest rarity) first
  })) {
    if (!seenPkdx.has(pokemon.pokedexNo)) {
      wonderTradePokemons.push(pokemon);
      seenPkdx.add(pokemon.pokedexNo);
      if (wonderTradePokemons.length === wtAmount) break;
    }
  }

  // Exclude WT from auction candidates
  const wtIds = new Set(wonderTradePokemons.map((p) => p.id));

  // Select Auction: rarest, tiebreaker most duplicates
  const auctionPokemons = tradables
    .filter((p) => !wtIds.has(p.id))
    .sort((a, b) => {
      const rA = rarities[a.rarity] || Infinity,
        rB = rarities[b.rarity] || Infinity;
      if (rB !== rA) return rB - rA; // Rarest first
      return counts[b.id] - counts[a.id]; // Most duplicates first
    })
    .slice(0, auctionAmount);

  wonderTradePokemons.forEach((p) =>
    logMsg(
      tag,
      logLevels.Interesting,
      `Wonder Trade: ${p.speciesName} (${p.gender}, ${p.rarity}): ${counts[p.uniquenessKey]}`,
    ),
  );
  auctionPokemons.forEach((p) =>
    logMsg(
      tag,
      logLevels.Interesting,
      `Auction: ${p.speciesName} (${p.gender}, ${p.rarity}): ${counts[p.uniquenessKey]}`,
    ),
  );

  await undoWonderTrade(); // Cancel all current Wonder Trades before starting new ones
  await doWonderTrade(wonderTradePokemons);
  await doAuctionSetup(auctionPokemons);
}

/**
 * Do this whole Wonder Trade and Auction thing here so we don't have to calculate the best pokemon separately again.
 */
async function removeExcessPokemons(duplicatePokemons) {
  // Group pokemons by uniquenessKey
  const grouped = {};
  for (const pkmn of duplicatePokemons) {
    if (!grouped[pkmn.uniquenessKey]) grouped[pkmn.uniquenessKey] = [];
    grouped[pkmn.uniquenessKey].push(pkmn);
  }

  await releaseExtraPokemon(grouped);

  // Flatten grouped back into array for further processing
  const remainingPokemons = Object.values(grouped).flat();

  // Find the number of pokemons as per their uniqueness, and choose the lowest level one of each for further trading
  const counts = {};
  const selectedPokemon = {};

  remainingPokemons.forEach((pokemon) => {
    const key = pokemon.uniquenessKey;
    counts[key] = (counts[key] || 0) + 1;
    if (!selectedPokemon[key] || pokemon.level < selectedPokemon[key].level) {
      selectedPokemon[key] = pokemon;
    }
  });

  await setTrades(counts, selectedPokemon);
}

async function moveSortedPokemon(devidedPokemons, allBoxes, targetBoxName) {
  // First sort all the pokemon according to their pokedex number.
  // Later, make this more sophisticated and move special pokemons (emera, mega, shadow) to the back
  // Later, store them separately by shadow/shiny/mega/event or whatever maybe, or by gender...
  // A pokedex entry can have like 10 forms...

  // Imgages are sturctured like this: [rarity][species][region][variation][gender] like 16mx.png for [shiny][charizard][mega][X][male]
  // First digit is 0 normal, 1 shiny, 2 shadow
  // Remaining digits are species
  // First letter is region OR special
  // Remaining letters are variation
  // ?g=f is gender
  // Region g = giga OR Galarian! so sort into same box
  // Also some pokemon vary, like arceus, magikarp or that one bug, so they have to be sorted separetly and individually
  // And emera variations can be any letter, so just taking a/g and assuming its a region does not work. we also need to consider the species
  // Also, Mega Autumn Alakazam is 065am, so the variation comes before the region, or mega/giga ist not a region... and "a" is the emera region
  // All in all, first just sort everything without letters. when considering letters, first take those with a and g and check name/rarity, and for m and g check if "special power", the rest just throw them all into "special/event/variations"
  // BUT what about shellos and sutff like that?
  // Regions
  // 1: Kanto = 151*3 = 453
  // 2: Johto = 127*3 = 381
  // 3: Hoenn = 155*2 = 310
  // 4: Sinnoh = 138*2 = 276
  // 5: Unova = 175*2 = 350
  // 6: Kalos = 117*2 = 234
  // 7: Alola (a) = 144*2 = 288
  // 8: Galar (g) = 129*2 = 258
  // 9: Hisui (h) = 27*2 = 54
  // 10: Paldea = 67*2 = 134
  // 11: Emera (any letter) = 363*2 = 726 (too many if both genders)
  // 12: M&G (m/g) = 126*2 = 252
  // 13: Retro (ret) = 46*2 = 92
  // Need about 13 boxes for optimally cleanly sorted sotrage

  const sortedPokemons = devidedPokemons.slice().sort((a, b) => a.pokedexNo - b.pokedexNo);
  const pkmnids = sortedPokemons.map((pokemon) => pokemon.id);

  logMsg(tag, logLevels.Interesting, `Moving [${pkmnids.length}] Pokémon to [${targetBoxName}] boxes...`);

  const tempBox = allBoxes.find((box) => box.name === "Temp");
  const tempBoxId = tempBox?.id;
  const maxBoxFillRatio = 0.9;
  const boxSize = tempBox?.max * maxBoxFillRatio;
  const targetBoxIds = allBoxes.filter((box) => box.name === targetBoxName).map((box) => box.id);

  const chunkRatio = 0.5; // Move only half of the pokemon at a time to prevent capacity issues.
  const chunkSize = boxSize * chunkRatio;
  for (let i = 0; i < pkmnids.length; i += chunkSize) {
    const chunk = pkmnids.slice(i, i + chunkSize);

    const boxIndex = Math.floor(i / boxSize) % targetBoxIds.length;
    const targetBoxId = targetBoxIds[boxIndex];

    await movePokemon(tempBoxId, chunk);
    await movePokemon(targetBoxId, chunk);
  }
}

async function takeItemsFromDuplicatePokemon(duplicatePokemon) {
  const duplicateIdsWithItems = duplicatePokemon
    .filter((pokemon) => pokemon.item !== null)
    .map((pokemon) => pokemon.id);

  logMsg(
    tag,
    logLevels.Interesting,
    `And taking items from [${duplicateIdsWithItems.length}/${duplicatePokemon.length}] duplicate Pokemon...`,
  );

  const takeTasks = duplicateIdsWithItems.map((pkmnId) =>
    limit(async () => {
      try {
        await takeItem(pkmnId);
      } catch (error) {
        console.error(`Error taking item from Pokémon ID ${pkmnId}:`, error);
      }
    }),
  );

  await Promise.all(takeTasks);
}

async function giveEverstonesToUniquePokemon(uniquePokemon) {
  const uniqueIdsWithoutItems = uniquePokemon
    .filter((pokemon) => pokemon.item === null && !pokemon.mega)
    .map((pokemon) => pokemon.id);

  logMsg(
    tag,
    logLevels.Interesting,
    `And giving everstones to [${uniqueIdsWithoutItems.length}/${uniquePokemon.length}] unique Pokemon...`,
  );

  const giveTasks = uniqueIdsWithoutItems.map((pkmnId) =>
    limit(async () => {
      try {
        await giveItem("Everstone", pkmnId);
      } catch (error) {
        logErr(tag, `Error when giving Everstone to Pokémon ID ${pkmnId}:`, error);
      }
    }),
  );

  await Promise.all(giveTasks);
}

async function moveBugContestPokemon(allPokemon, duplicatePokemon, boxData) {
  const eightDaysMs = 691200000;
  const bugHatchingPokemon = allPokemon.filter(
    (pokemon) => pokemon.obtainedFrom === "Bug-Hatching Contest" && pokemon.ageMs < eightDaysMs,
  );

  // Remove bug hatching Pokémon from duplicates
  const bugHatchingIds = new Set(bugHatchingPokemon.map((p) => p.id));
  const filteredDuplicatePokemon = duplicatePokemon.filter((p) => !bugHatchingIds.has(p.id));

  await moveSortedPokemon(bugHatchingPokemon, boxData, "Bugs");
  await takeItemsFromDuplicatePokemon(bugHatchingPokemon);
  return filteredDuplicatePokemon;
}

async function sortPokemonIntoBoxes(boxData, allPokemon) {
  const [duplicatePokemon, uniquePokemon] = getDuplicatePokemon(allPokemon);

  const filteredDuplicatePokemon = await moveBugContestPokemon(allPokemon, duplicatePokemon, boxData);

  await moveSortedPokemon(filteredDuplicatePokemon, boxData, "Duplicates");
  await takeItemsFromDuplicatePokemon(filteredDuplicatePokemon);

  await moveSortedPokemon(uniquePokemon, boxData, "Pokedex");
  await giveEverstonesToUniquePokemon(uniquePokemon);

  await removeExcessPokemons(filteredDuplicatePokemon);
}

export async function getAllPokemonFromAllBoxes() {
  const html = await (await loadBoxes()).text();
  const boxData = getBoxes(html);
  logVal(tag, logLevels.Interesting, `Current box overview:`, boxData);
  return await getAllPokemonFromBoxes(boxData);
}

function allRequiredBoxesPresent(boxData) {
  // Check required boxes presence
  const requiredBoxes = ["New", "Special", "Temp", "Bugs", "Pokedex", "Duplicates"];

  const missingBoxes = requiredBoxes.filter((requiredName) => !boxData.some((box) => box.boxName === requiredName));

  if (missingBoxes.length > 0) {
    logErr(tag, `Missing at least one required box!`, `Missing required boxes: ${missingBoxes.join(", ")}`);
  }

  return missingBoxes.length === 0;
}
export async function sortPokemonStorage() {
  logMsg(tag, logLevels.Debug, `Starting storage sorting job...`);
  try {
    const html = await (await loadBoxes()).text();
    const boxData = getBoxes(html);

    if (!allRequiredBoxesPresent) return;

    logVal(tag, logLevels.Interesting, `Current box overview:`, boxData);
    const allPokemon = (await getAllPokemonFromBoxes(boxData)).filter((pokemon) => pokemon.boxName !== "Special");
    logMsg(
      tag,
      logLevels.Interesting,
      `Beginning to sort [${allPokemon.length}] Pokemon into [${boxData.length - unusableBoxes}] boxes.`,
    );

    const ivPerfectCountToLog = 3;
    const newRarePokemon = allPokemon.filter(
      (pokemon) =>
        pokemon.boxName === "New" &&
        (rarities[pokemon.rarity] > rarities.Rare ||
          pokemon.shiny ||
          pokemon.shadow ||
          pokemon.mega ||
          pokemon.ivPerfectCount > ivPerfectCountToLog),
    );

    newRarePokemon.forEach((pokemon) => {
      logMsg(
        tag,
        logLevels.Valuable,
        `New rare Pokémon: [${pokemon.id}], [${pokemon.speciesName}], [${pokemon.img}], [${pokemon.rarity}]`,
      );
    });

    await sortPokemonIntoBoxes(boxData, allPokemon);
    logMsg(tag, logLevels.Debug, `Done sorting Pokemon.`);
  } catch (error) {
    logErr(tag, `Error when handling Pokemon Storage`, error);
  }
}

export async function getAllPokemonFromBoxName(boxName = "Test") {
  const html = await (await loadBoxes()).text();
  const boxData = getBoxes(html, boxName);
  return await getAllPokemonFromBoxes(boxData);
}

export async function getDuplicateShinies() {
  const duplicates = await getAllPokemonFromBoxName("Duplicates");
  return duplicates.filter((pokemon) => pokemon.shiny);
}

export async function getAllShinies() {
  const allPokemon = (await getAllPokemonFromAllBoxes()).filter((pokemon) => pokemon.boxName !== "Special");
  return allPokemon.filter((pokemon) => pokemon.shiny);
}

export async function getStrongestPokemonPerType() {
  try {
    const html = await (await loadBoxes()).text();
    const boxData = getBoxes(html, "Pokedex");
    // LogVal(tag, logLevels.Valuable, `Current box overview:`, boxData);
    const allPokemon = (await getAllPokemonFromBoxes(boxData)).filter((pokemon) => pokemon.boxName !== "Special");

    // Map to store the strongest Pokémon for each type
    const strongestPerType = {};

    // Loop through all Pokémon
    allPokemon.forEach((pokemon) => {
      if (!pokemon.types) return;
      pokemon.types.forEach((type) => {
        if (!strongestPerType[type] || pokemon.statsTotal > strongestPerType[type].statsTotal) {
          strongestPerType[type] = pokemon;
        }
      });
    });

    return strongestPerType;
  } catch (error) {
    logErr(tag, `Error when handling Pokemon Storage`, error);
  }
}
