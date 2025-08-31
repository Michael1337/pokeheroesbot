import { headers, WAIT_TIMES } from "../a-shared/const.js";
import { logErr, logLevels, logMsg, logVal } from "../a-shared/logger.js";
import { delay } from "../a-shared/utils.js";
import { getAllPokemonFromBoxName, takeItem } from "./pokemon-storage.js";
import { AVAILABLE_EXPLORATION_DURATIONS, sendPokemonToRumble, SPECIAL_AREAS } from "../c-town/rumble-areas.js";
import { getTimeToHaircutFinish, startHaircut, viewFurfrou } from "../c-town/emera-mall/salon.js";
import { getCurrentWeather } from "./weather.js";

const tag = "EVOLUTION";
// https://wiki.pokeheroes.com/wiki/Evolving_Pokemon
const requiredMegaLevel = 50;

function useItem(item = "", pkmn = 0) {
  return fetch(`https://www.pokeheroes.com/evolve.php?item=${encodeURIComponent(item)}`, {
    headers: headers,
    referrer: `https://www.pokeheroes.com/evolve.php?item=${encodeURIComponent(item)}`,
    body: `evolve_pkmn=${pkmn}`,
    method: "POST",
    mode: "cors",
    credentials: "include",
  });
}

function giveItem(item = "", pkmn = 0) {
  return fetch(`https://www.pokeheroes.com/bag`, {
    headers: headers,
    referrer: `https://www.pokeheroes.com/bag`,
    body: `itemname=${encodeURIComponent(item)}&pkmn_select=${pkmn}`,
    method: "POST",
    mode: "cors",
    credentials: "include",
  });
}

function feedItem(item = "", pkmn = 0) {
  return fetch(`https://pokeheroes.com/use_vitamin.php?item=${encodeURIComponent(item)}`, {
    headers: headers,
    referrer: `https://pokeheroes.com/use_vitamin.php?item=${encodeURIComponent(item)}`,
    body: `vitamin_pkmn=${pkmn}`,
    method: "POST",
    mode: "cors",
    credentials: "include",
  });
}

function startAcupuncture(pkmn = 0) {
  return fetch("https://www.pokeheroes.com/salon", {
    headers: headers,
    referrer: "https://www.pokeheroes.com/salon",
    body: `massage=1&pkmn_select=${pkmn}`,
    method: "POST",
    mode: "cors",
    credentials: "include",
  });
}

function checkAcupuncture() {
  return fetch("https://www.pokeheroes.com/salon", {
    headers: headers,
    referrer: "https://www.pokeheroes.com/salon",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

function finishAcupuncture() {
  return fetch("https://www.pokeheroes.com/salon?evo", {
    headers: headers,
    referrer: "https://www.pokeheroes.com/salon",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

function cleanHtmlText(html) {
  return html
    ?.replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeImg(img) {
  // TODO: At some point, we should also differ by gender and get every evo twice.
  // Strip everything from '&' onward (gender)
  let cleaned = img;
  if (cleaned?.includes("&")) cleaned = cleaned.split("&")[0];
  return cleaned;
}

function logOrPrint(match, group, html) {
  if (match && match.groups) {
    logMsg(tag, logLevels.Valuable, `${cleanHtmlText(match.groups[group])}`);
  } else {
    console.log(html);
  }
}

// TODO: The whole logging eally only should have two possible regex: greenfield and redfield.

// Extract evolution success message from HTML
function extractEvoSuccess(html) {
  const match = html.match(/Congrats!<\/b><\/span><br><span[^>]*>(?<evoLine>Your .*? evolved into .*?!)<\/span>/i);
  return match && match.groups ? match.groups.evoLine : null;
}

// Extract form change success message from HTML
function extractChangeSuccess(html) {
  const match = html.match(/(?<changeLine>Your\s*<b>\s*.+?\s*<\/b>\s*changed its form to\s*<b>\s*.+?\s*<\/b>\s*!)/i);
  return match && match.groups ? match.groups.changeLine : null;
}

// Extract error message from redfield div in HTML
function extractRedfieldError(html) {
  const match = html.match(/>(?<errorMsg>You (?:do not|don't) have any .*? left[!.])<\/div>/i);
  return match && match.groups ? match.groups.errorMsg : null;
}

// General HTML message extractor: tries success, then error, then returns null
function extractEvoOrErrorMessage(html) {
  return cleanHtmlText(extractEvoSuccess(html)) || cleanHtmlText(extractRedfieldError(html)) || null;
}

// General HTML message extractor: tries success, then error, then returns null
function extractChangeOrErrorMessage(html) {
  return cleanHtmlText(extractChangeSuccess(html)) || cleanHtmlText(extractRedfieldError(html)) || null;
}

export async function evolvePokemon() {
  // Do special evolutions only for OT pokemon as to not waste any resources.
  const OTPokemonInBox = (await getAllPokemonFromBoxName("Pokedex")).filter(
    (pokemon) => pokemon.originalTrainer === process.env.APP_USERNAME,
  );
  const ownedPokemons = new Set(OTPokemonInBox.map((pkmn) => normalizeImg(pkmn.img)));
  const currentWeather = await getCurrentWeather();

  const preEvos = [];
  // eslint-disable-next-line no-use-before-define
  for (const evo of possibleEvolutions) {
    if (!evo.preNum || !evo.postNum) continue;
    if (evo.conditionType === "castform" && evo.conditionDetail !== currentWeather) continue;

    // Check both normal (0) and shiny (1) forms
    for (const prefix of ["0", "1"]) {
      const preNum = prefix + evo.preNum;
      const postNum = prefix + evo.postNum;

      // Find all Pokémon matching preNum (normal or shiny)
      const possibleEvolvers = OTPokemonInBox.filter((pkmn) => normalizeImg(pkmn.img) === preNum);

      if (possibleEvolvers.length === 0) continue;

      for (const possibleEvolver of possibleEvolvers) {
        // Do not evolve if evolved form is owned already.
        // Unless the possibleEvolver may eventually be able to become mega, so keep mega-ables, but only as long as the mega-form is not also already owned.
        // In other words: Skip when evo form is owned AND evolver is neither megaable NOR do we still need the mega evo.
        if (ownedPokemons.has(postNum) && (!possibleEvolver.mega || evo.conditionType === "mega")) continue;

        // Can not evolve same pokemon twice (for example Eevee)
        if (preEvos.some((entry) => entry.pokemon.id === possibleEvolver.id)) continue;

        preEvos.push({
          pokemon: possibleEvolver,
          evolution: evo,
        });
      }
    }
  }

  for (const { pokemon, evolution } of preEvos) {
    const { speciesName, id } = pokemon;
    const { conditionType, conditionDetail, post } = evolution;

    if (["special"].includes(conditionType)) {
      logMsg(tag, logLevels.Debug, `Skipping evolution [${conditionType}] for [${speciesName}].`);
      continue;
    }

    if (conditionType === "happiness") {
      logMsg(
        tag,
        logLevels.Valuable,
        `Doing acupuncture for [${speciesName}] (ID: [${id}]) to evolve into [${post}]...`,
      );
      await finishAcupuncture(); // Always try that first in case something was left there.
      await startAcupuncture(id);
      const html = await (await checkAcupuncture()).text();
      const match = html.match(/(?<acupuncture>Your .*? is currently enjoying our <b>Acupuncture<\/b>-offer\.)<br>/i);
      logOrPrint(match, "acupuncture", html);

      continue;
    }

    if (conditionType === "item-give") {
      logMsg(
        tag,
        logLevels.Valuable,
        `Giving item [${conditionDetail}] to [${speciesName}] (ID: [${id}]) to evolve into [${post}]...`,
      );
      const html = await (await giveItem(conditionDetail, id)).text();
      const match = html.match(/<div id=['"]greenfield['"]>(?<greenfield>[\s\S]*?)<\/div>/i);
      logOrPrint(match, "greenfield", html);
      continue;
    }

    if (conditionType === "form-item-give") {
      logMsg(
        tag,
        logLevels.Valuable,
        `Giving item [${conditionDetail}] to [${speciesName}] (ID: [${id}]) to change into [${post}]...`,
      );
      const html = await (await giveItem(conditionDetail, id)).text();
      const message = extractChangeOrErrorMessage(html);

      if (message) {
        logMsg(tag, logLevels.Valuable, message);
      } else {
        console.log(html);
      }
      continue;
    }

    if (conditionType === "mega") {
      if (pokemon.mega && pokemon.level >= requiredMegaLevel) {
        // TODO: Have to check for X and Y, depending on mega symbol on pokemon page.
        logMsg(
          tag,
          logLevels.Valuable,
          `Giving item [${conditionDetail}] to [${speciesName}] (ID: [${id}]) to evolve into [${post}]...`,
        );
        const html = await (await giveItem(conditionDetail, id)).text();
        const message = extractEvoOrErrorMessage(html);

        if (message) {
          logMsg(tag, logLevels.Valuable, message);
        } else {
          const match = html.match(/<div id=['"]greenfield['"]>(?<greenfield>[\s\S]*?)<\/div>/i);
          logOrPrint(match, "greenfield", html);
        }
      }
      continue;
    }

    if (conditionType === "item-use") {
      let item = conditionDetail;
      let gender;
      if (conditionDetail.includes(";;")) {
        [item, gender] = conditionDetail.split(";;");
        if (pokemon.gender !== gender) continue;
      }
      logMsg(
        tag,
        logLevels.Valuable,
        `Using item [${item}] on [${speciesName}] (ID: [${id}]) to evolve into [${post}]...`,
      );
      const html = await (await useItem(item, id)).text();
      const message = extractEvoOrErrorMessage(html);

      if (message) {
        logMsg(tag, logLevels.Valuable, message);
      } else {
        logErr(tag, `Error in evo, item-use`, html);
      }
      continue;
    }

    if (conditionType === "feed-item") {
      const item = conditionDetail;
      logMsg(
        tag,
        logLevels.Valuable,
        `Feeding item [${item}] to [${speciesName}] (ID: [${id}]) to evolve into [${post}]...`,
      );
      await takeItem(id); // Can only evolve when not having everstone.
      const html = await (await feedItem(item, id)).text();
      const message = extractEvoOrErrorMessage(html);

      if (message) {
        logMsg(tag, logLevels.Valuable, message);
      } else {
        const match = html.match(/<div id=['"]greenfield['"]>(?<greenfield>[\s\S]*?)<\/div>/i);
        logOrPrint(match, "greenfield", html);
      }
      continue;
    }

    if (conditionType === "item-give-use") {
      const [itemToGive, itemToUse] = conditionDetail.split(",").map((s) => s.trim());
      logMsg(
        tag,
        logLevels.Valuable,
        `Giving item [${conditionDetail}] to [${speciesName}] (ID: [${id}]) to evolve into [${post}]...`,
      );
      let html = await (await giveItem(itemToGive, id)).text();
      const match = html.match(/<div id=['"]greenfield['"]>(?<greenfield>[\s\S]*?)<\/div>/i);
      logOrPrint(match, "greenfield", html);

      logMsg(
        tag,
        logLevels.Valuable,
        `Using item [${conditionDetail}] on [${speciesName}] (ID: [${id}]) to evolve into [${post}]...`,
      );
      html = await (await useItem(itemToUse, id)).text();
      const message = extractEvoOrErrorMessage(html);

      if (message) {
        logMsg(tag, logLevels.Valuable, message);
      } else {
        console.log(html);
      }
      continue;
    }

    if (conditionType === "castform") {
      const item = "Weather Balloon";
      logMsg(
        tag,
        logLevels.Valuable,
        `Using item [${item}] on [${speciesName}] (ID: [${id}]) to evolve into [${post}]...`,
      );
      const html = await (await useItem(item, id)).text();
      const message = extractEvoOrErrorMessage(html);

      if (message) {
        logMsg(tag, logLevels.Valuable, message);
      } else {
        console.log(html);
      }
      continue;
    }

    if (conditionType === "furfrou") {
      // Will do 3 basic first, and make those permanent. Hopefully with those 6, the next three are unlocked.
      // TODO: try to make haircuts permanent like every day, some hours before doing evo fucntion.
      const _htmlFurfrou = await (await viewFurfrou()).text();
      // Console.log(htmlFurfrou);

      logMsg(
        tag,
        logLevels.Valuable,
        `Cutting hair [${conditionDetail}] on [${speciesName}] (ID: [${id}]) to evolve into [${post}]...`,
      );
      await startHaircut(conditionDetail, id);

      await delay(WAIT_TIMES.TWO_SECONDS);
      const html = await (await viewFurfrou()).text();
      const msToFinish = getTimeToHaircutFinish(html);
      logMsg(tag, logLevels.Valuable, `A Furfrou is getting a haircut for another [${msToFinish / 1000}] seconds...`);
      continue;
    }

    // TODO: Alcremie, using spinning wheel

    if (conditionType === "rumble") {
      // TODO: Pokemon can't be sent to rumble if 6 are rumbling. So we gotta like wait for the rumblers to return or something.
      logMsg(
        tag,
        logLevels.Valuable,
        `Sending [${speciesName}] (ID: [${id}]) to [${conditionDetail}] to evolve into [${post}]...`,
      );
      const area = SPECIAL_AREAS[conditionDetail] || 1;
      const duration = area === 1 ? AVAILABLE_EXPLORATION_DURATIONS.TWELVE_HOURS : null;
      const html = await (await sendPokemonToRumble(id, area, duration)).text();
      const response = JSON.parse(html);

      if (response == null) {
        console.log(html);
      } else if (response.error !== null) {
        logMsg(tag, logLevels.Valuable, response.error);
      }
      continue;
    }

    if (conditionType === "trade" || conditionType === "item-trade") {
      logMsg(
        tag,
        logLevels.Valuable,
        `[${speciesName}] (ID: [${id}]) in box [${pokemon.boxId}: ${pokemon.boxName}] can evolve into [${post}] via trade${conditionType === "item-trade" ? " using [" + conditionDetail + "]" : ""}...`,
      );
      // Const html = await (await movePokemon("Special", id)).text();
      // If (html.includes("ERROR")) {
      //   Const match = html.match(/text\("(?<error>.*?)"\)/);
      //   If (match && match.groups) {
      //     LogMsg(tag, logLevels.Valuable, `${match.groups.error}`);
      //   }
      // }
      await takeItem(id);
      if (conditionType === "item-trade") await giveItem(conditionDetail, id);
      continue;
    }

    logVal(tag, logLevels.Important, `Unknown or unsupported evolution type for [${speciesName}]:`, evolution);
  }
}

const possibleEvolutions = [
  // --- Special ---
  {
    pre: "Slowyore",
    post: "Yoreking",
    preNum: "79s",
    postNum: "199s",
    conditionType: "special",
    conditionDetail: "King's Rock, Honey",
  },

  // --- Feed Item ---
  {
    pre: "Fiestabray",
    post: "Mudbash",
    preNum: "749p",
    postNum: "750p",
    conditionType: "feed-item",
    conditionDetail: "Rare Candy",
  },

  // --- Item Evolution ---
  {
    pre: "Sinistea",
    post: "Polteageist",
    preNum: "854",
    postNum: "855",
    conditionType: "item-use",
    conditionDetail: "Cracked Pot",
  },
  {
    pre: "Sinitharos",
    post: "Polstamnos",
    preNum: "854g",
    postNum: "855g",
    conditionType: "item-use",
    conditionDetail: "Cracked Pot",
  },
  {
    pre: "Kirlia",
    post: "Gallade",
    preNum: "281",
    postNum: "475",
    conditionType: "item-use",
    conditionDetail: "Dawn Stone;;m",
  },
  {
    pre: "Snorunt",
    post: "Froslass",
    preNum: "361",
    postNum: "478",
    conditionType: "item-use",
    conditionDetail: "Dawn Stone;;f",
  },
  {
    pre: "Driflamp",
    post: "Lightblim",
    preNum: "425l",
    postNum: "426l",
    conditionType: "item-use",
    conditionDetail: "Dawn Stone",
  },
  {
    pre: "Witch Vulpix",
    post: "Magic Ninetales",
    preNum: "37w",
    postNum: "38w",
    conditionType: "item-use",
    conditionDetail: "Dusk Stone",
  },
  {
    pre: "Murkrow",
    post: "Honchkrow",
    preNum: "198",
    postNum: "430",
    conditionType: "item-use",
    conditionDetail: "Dusk Stone",
  },
  {
    pre: "Misdreavus",
    post: "Mismagius",
    preNum: "200",
    postNum: "429",
    conditionType: "item-use",
    conditionDetail: "Dusk Stone",
  },
  {
    pre: "Lampent",
    post: "Chandelure",
    preNum: "608",
    postNum: "609",
    conditionType: "item-use",
    conditionDetail: "Dusk Stone",
  },
  {
    pre: "Doublade",
    post: "Aegislash",
    preNum: "680",
    postNum: "681",
    conditionType: "item-use",
    conditionDetail: "Dusk Stone",
  },
  {
    pre: "Rockruff",
    post: "Lycanroc (Dusk)",
    preNum: "744",
    postNum: "745m",
    conditionType: "item-use",
    conditionDetail: "Dusk Stone",
  },
  {
    pre: "Rockruff",
    post: "Lycanroc (Midday)",
    preNum: "744",
    postNum: "745d",
    conditionType: "item-use",
    conditionDetail: "Dusk Stone",
  },
  {
    pre: "Rockruff",
    post: "Lycanroc (Midnight)",
    preNum: "744",
    postNum: "745n",
    conditionType: "item-use",
    conditionDetail: "Dusk Stone",
  },
  {
    pre: "Vulpix",
    post: "Ninetales",
    preNum: "37",
    postNum: "38",
    conditionType: "item-use",
    conditionDetail: "Fire Stone",
  },
  {
    pre: "Growlithe",
    post: "Arcanine",
    preNum: "58",
    postNum: "59",
    conditionType: "item-use",
    conditionDetail: "Fire Stone",
  },
  {
    pre: "Cuddlithe",
    post: "Arcaddly",
    preNum: "",
    postNum: "",
    conditionType: "item-use",
    conditionDetail: "Fire Stone",
  },
  {
    pre: "Pansear",
    post: "Simisear",
    preNum: "513",
    postNum: "514",
    conditionType: "item-use",
    conditionDetail: "Fire Stone",
  },
  {
    pre: "Slowpoke (Galarian)",
    post: "Slowbro (Galarian)",
    preNum: "79g",
    postNum: "80g",
    conditionType: "item-use",
    conditionDetail: "Galarica Cuff",
  },
  {
    pre: "Slowpoke (Galarian)",
    post: "Slowking (Galarian)",
    preNum: "79g",
    postNum: "199g",
    conditionType: "item-use",
    conditionDetail: "Galarica Wreath",
  },
  {
    pre: "Sandshrew (Alolan)",
    post: "Sandslash (Alolan)",
    preNum: "27a",
    postNum: "28a",
    conditionType: "item-use",
    conditionDetail: "Ice Stone",
  },
  {
    pre: "Vulpix (Alolan)",
    post: "Ninetales (Alolan)",
    preNum: "37a",
    postNum: "38a",
    conditionType: "item-use",
    conditionDetail: "Ice Stone",
  },
  {
    pre: "Darumaka (Galarian)",
    post: "Darmanitan (Galarian)",
    preNum: "554g",
    postNum: "555g",
    conditionType: "item-use",
    conditionDetail: "Ice Stone",
  },
  {
    pre: "Woopice",
    post: "Quagschnee",
    preNum: "194s",
    postNum: "195s",
    conditionType: "item-use",
    conditionDetail: "Ice Stone",
  },
  {
    pre: "Gloom",
    post: "Vileplume",
    preNum: "44",
    postNum: "45",
    conditionType: "item-use",
    conditionDetail: "Leaf Stone",
  },
  {
    pre: "Weepinbell",
    post: "Victreebel",
    preNum: "70",
    postNum: "71",
    conditionType: "item-use",
    conditionDetail: "Leaf Stone",
  },
  {
    pre: "Exeggcute",
    post: "Exeggutor",
    preNum: "102",
    postNum: "103",
    conditionType: "item-use",
    conditionDetail: "Leaf Stone",
  },
  {
    pre: "Disguised Exeggcute",
    post: "Disguised Exeggutor",
    preNum: "102h",
    postNum: "103h",
    conditionType: "item-use",
    conditionDetail: "Leaf Stone",
  },
  {
    pre: "Nuzleaf",
    post: "Shiftry",
    preNum: "274",
    postNum: "275",
    conditionType: "item-use",
    conditionDetail: "Leaf Stone",
  },
  {
    pre: "Pansage",
    post: "Simisage",
    preNum: "511",
    postNum: "512",
    conditionType: "item-use",
    conditionDetail: "Leaf Stone",
  },
  {
    pre: "Sproutlett",
    post: "Sproutrio",
    preNum: "",
    postNum: "",
    conditionType: "item-use",
    conditionDetail: "Leaf Stone",
  },
  {
    pre: "Farfetch'd (Galarian)",
    post: "Sirfetch'd",
    preNum: "83g",
    postNum: "865",
    conditionType: "item-use",
    conditionDetail: "Leek",
  },
  {
    pre: "Nidorina",
    post: "Nidoqueen",
    preNum: "30",
    postNum: "31",
    conditionType: "item-use",
    conditionDetail: "Moon Stone",
  },
  {
    pre: "Nidorino",
    post: "Nidoking",
    preNum: "33",
    postNum: "34",
    conditionType: "item-use",
    conditionDetail: "Moon Stone",
  },
  {
    pre: "Clefairy",
    post: "Clefable",
    preNum: "35",
    postNum: "36",
    conditionType: "item-use",
    conditionDetail: "Moon Stone",
  },
  {
    pre: "Clawfairy",
    post: "Nessy",
    preNum: "35d",
    postNum: "36d",
    conditionType: "item-use",
    conditionDetail: "Moon Stone",
  },
  {
    pre: "Jigglypuff",
    post: "Wigglytuff",
    preNum: "39",
    postNum: "40",
    conditionType: "item-use",
    conditionDetail: "Moon Stone",
  },
  {
    pre: "Skitty",
    post: "Delcatty",
    preNum: "300",
    postNum: "301",
    conditionType: "item-use",
    conditionDetail: "Moon Stone",
  },
  {
    pre: "Munna",
    post: "Musharna",
    preNum: "517",
    postNum: "518",
    conditionType: "item-use",
    conditionDetail: "Moon Stone",
  },
  {
    pre: "Nightmare Munna",
    post: "Nightmare Musharna",
    preNum: "517h",
    postNum: "518h",
    conditionType: "item-use",
    conditionDetail: "Moon Stone",
  },
  {
    pre: "Nosepharos",
    post: "Probolight",
    preNum: "299l",
    postNum: "300l",
    conditionType: "item-use",
    conditionDetail: "Shiny Stone",
  },
  {
    pre: "Togetic",
    post: "Togekiss",
    preNum: "176",
    postNum: "468",
    conditionType: "item-use",
    conditionDetail: "Shiny Stone",
  },
  {
    pre: "Roselia",
    post: "Roserade",
    preNum: "315",
    postNum: "407",
    conditionType: "item-use",
    conditionDetail: "Shiny Stone",
  },
  {
    pre: "Minccino",
    post: "Cinccino",
    preNum: "572",
    postNum: "573",
    conditionType: "item-use",
    conditionDetail: "Shiny Stone",
  },
  {
    pre: "Floette (Blue)",
    post: "Florges (Blue)",
    preNum: "670b",
    postNum: "671b",
    conditionType: "item-use",
    conditionDetail: "Shiny Stone",
  },
  {
    pre: "Floette (Orange)",
    post: "Florges (Orange)",
    preNum: "670o",
    postNum: "671o",
    conditionType: "item-use",
    conditionDetail: "Shiny Stone",
  },
  {
    pre: "Floette (Red)",
    post: "Florges (Red)",
    preNum: "670r",
    postNum: "671r",
    conditionType: "item-use",
    conditionDetail: "Shiny Stone",
  },
  {
    pre: "Floette (White)",
    post: "Florges (White)",
    preNum: "670w",
    postNum: "671w",
    conditionType: "item-use",
    conditionDetail: "Shiny Stone",
  },
  {
    pre: "Floette (Yellow)",
    post: "Florges (Yellow)",
    preNum: "670y",
    postNum: "671y",
    conditionType: "item-use",
    conditionDetail: "Shiny Stone",
  },
  {
    pre: "Floette",
    post: "Florges",
    preNum: "670",
    postNum: "671",
    conditionType: "item-use",
    conditionDetail: "Shiny Stone",
  },
  {
    pre: "Floette (Sakura)",
    post: "Florges (Sakura)",
    preNum: "670s",
    postNum: "671s",
    conditionType: "item-use",
    conditionDetail: "Shiny Stone",
  },
  {
    pre: "Floette (Eternal Flower)",
    post: "Florges (Eternal Flower)",
    preNum: "670az",
    postNum: "671az",
    conditionType: "item-use",
    conditionDetail: "Shiny Stone",
  },
  {
    pre: "Blossomly",
    post: "Applewoodo",
    preNum: "438a",
    postNum: "185a",
    conditionType: "item-use",
    conditionDetail: "Spray Duck",
  },
  {
    pre: "Gloom",
    post: "Bellossom",
    preNum: "44",
    postNum: "182",
    conditionType: "item-use",
    conditionDetail: "Sun Stone",
  },
  {
    pre: "Sunkern",
    post: "Sunflora",
    preNum: "191",
    postNum: "192",
    conditionType: "item-use",
    conditionDetail: "Sun Stone",
  },
  {
    pre: "Cottonee",
    post: "Whimsicott",
    preNum: "546",
    postNum: "547",
    conditionType: "item-use",
    conditionDetail: "Sun Stone",
  },
  {
    pre: "Petilil",
    post: "Lilligant",
    preNum: "548",
    postNum: "549",
    conditionType: "item-use",
    conditionDetail: "Sun Stone",
  },
  {
    pre: "Helioptile",
    post: "Heliolisk",
    preNum: "694",
    postNum: "695",
    conditionType: "item-use",
    conditionDetail: "Sun Stone",
  },
  {
    pre: "Pikachu",
    post: "Raichu",
    preNum: "25",
    postNum: "26",
    conditionType: "item-use",
    conditionDetail: "Thunder Stone",
  },
  {
    pre: "Satochu",
    post: "Raitoshi",
    preNum: "25s",
    postNum: "26s",
    conditionType: "item-use",
    conditionDetail: "Thunder Stone",
  },
  {
    pre: "Eelektrik",
    post: "Eelektross",
    preNum: "603",
    postNum: "604",
    conditionType: "item-use",
    conditionDetail: "Thunder Stone",
  },
  {
    pre: "Poliwhirl",
    post: "Poliwrath",
    preNum: "61",
    postNum: "62",
    conditionType: "item-use",
    conditionDetail: "Water Stone",
  },
  {
    pre: "Shellder",
    post: "Cloyster",
    preNum: "90",
    postNum: "91",
    conditionType: "item-use",
    conditionDetail: "Water Stone",
  },
  {
    pre: "Staryu",
    post: "Starmie",
    preNum: "120",
    postNum: "121",
    conditionType: "item-use",
    conditionDetail: "Water Stone",
  },
  {
    pre: "Lombre",
    post: "Ludicolo",
    preNum: "271",
    postNum: "272",
    conditionType: "item-use",
    conditionDetail: "Water Stone",
  },
  {
    pre: "Panpour",
    post: "Simipour",
    preNum: "515",
    postNum: "516",
    conditionType: "item-use",
    conditionDetail: "Water Stone",
  },
  {
    pre: "Bisharp",
    post: "Kingambit",
    preNum: "625",
    postNum: "983",
    conditionType: "item-use",
    conditionDetail: "Leader Crest",
  },
  {
    pre: "Obsidianix",
    post: "Obsidialix",
    preNum: "95o",
    postNum: "208o",
    conditionType: "item-use",
    conditionDetail: "Lava Cookie",
  },
  {
    pre: "Puddoo",
    post: "Puddra",
    preNum: "705p",
    postNum: "706p",
    conditionType: "item-use",
    conditionDetail: "Whipped Dream",
  },
  {
    pre: "Eevee",
    post: "Flareon",
    preNum: "133",
    postNum: "136",
    conditionType: "item-use",
    conditionDetail: "Fire Stone",
  },
  {
    pre: "Eevee",
    post: "Vaporeon",
    preNum: "133",
    postNum: "134",
    conditionType: "item-use",
    conditionDetail: "Water Stone",
  },
  {
    pre: "Eevee",
    post: "Jolteon",
    preNum: "133",
    postNum: "135",
    conditionType: "item-use",
    conditionDetail: "Thunder Stone",
  },
  {
    pre: "Happiny",
    post: "Chansey",
    preNum: "440",
    postNum: "113",
    conditionType: "item-give",
    conditionDetail: "Oval Stone",
  },
  {
    pre: "Narichu",
    post: "Naruchu",
    preNum: "172n",
    postNum: "25n",
    conditionType: "item-give",
    conditionDetail: "Rare Candy",
  },
  {
    pre: "Naruchu",
    post: "Raizumaki",
    preNum: "25n",
    postNum: "26n",
    conditionType: "item-give",
    conditionDetail: "Calcium",
  },
  {
    pre: "Gligar",
    post: "Gliscor",
    preNum: "207",
    postNum: "472",
    conditionType: "item-give",
    conditionDetail: "Razor Fang",
  },
  {
    pre: "Sneasel",
    post: "Weavile",
    preNum: "215",
    postNum: "461",
    conditionType: "item-give",
    conditionDetail: "Razor Claw",
  },
  {
    pre: "Snom",
    post: "Frosmoth",
    preNum: "872",
    postNum: "873",
    conditionType: "item-give",
    conditionDetail: "Soothe Bell",
  },
  {
    pre: "Eevee",
    post: "Espeon",
    preNum: "133",
    postNum: "196",
    conditionType: "item-give-use",
    conditionDetail: "Soothe Bell, Sun Stone",
  },
  {
    pre: "Eevee",
    post: "Umbreon",
    preNum: "133",
    postNum: "197",
    conditionType: "item-give-use",
    conditionDetail: "Soothe Bell, Moon Stone",
  },

  // --- Happiness Evolution ---
  {
    pre: "Golbat",
    post: "Crobat",
    preNum: "42",
    postNum: "169",
    conditionType: "happiness",
    conditionDetail: "High Happiness",
  },
  {
    pre: "Chansey",
    post: "Blissey",
    preNum: "113",
    postNum: "242",
    conditionType: "happiness",
    conditionDetail: "High Happiness",
  },
  {
    pre: "Pichu",
    post: "Pikachu",
    preNum: "172",
    postNum: "25",
    conditionType: "happiness",
    conditionDetail: "High Happiness",
  },
  {
    pre: "Satichu",
    post: "Satochu",
    preNum: "172s",
    postNum: "25s",
    conditionType: "happiness",
    conditionDetail: "High Happiness",
  },
  {
    pre: "Cleffa",
    post: "Clefairy",
    preNum: "173",
    postNum: "35",
    conditionType: "happiness",
    conditionDetail: "High Happiness",
  },
  {
    pre: "Clawfa",
    post: "Clawfairy",
    preNum: "173d",
    postNum: "35d",
    conditionType: "happiness",
    conditionDetail: "High Happiness",
  },
  {
    pre: "Igglybuff",
    post: "Jigglypuff",
    preNum: "174",
    postNum: "39",
    conditionType: "happiness",
    conditionDetail: "High Happiness",
  },
  {
    pre: "Togepi",
    post: "Togetic",
    preNum: "175",
    postNum: "176",
    conditionType: "happiness",
    conditionDetail: "High Happiness",
  },
  {
    pre: "Azurill",
    post: "Marill",
    preNum: "298",
    postNum: "183",
    conditionType: "happiness",
    conditionDetail: "High Happiness",
  },
  {
    pre: "Azubell",
    post: "Maribell",
    preNum: "298e",
    postNum: "183e",
    conditionType: "happiness",
    conditionDetail: "High Happiness",
  },
  {
    pre: "Budew",
    post: "Roselia",
    preNum: "406",
    postNum: "315",
    conditionType: "happiness",
    conditionDetail: "High Happiness",
  },
  {
    pre: "Buneary",
    post: "Lopunny",
    preNum: "427",
    postNum: "428",
    conditionType: "happiness",
    conditionDetail: "High Happiness",
  },
  {
    pre: "Easter Buneary",
    post: "Easter Lopunny",
    preNum: "427e",
    postNum: "428e",
    conditionType: "happiness",
    conditionDetail: "High Happiness",
  },
  {
    pre: "Chingling",
    post: "Chimecho",
    preNum: "433",
    postNum: "358",
    conditionType: "happiness",
    conditionDetail: "High Happiness",
  },
  {
    pre: "Munchlax",
    post: "Snorlax",
    preNum: "446",
    postNum: "143",
    conditionType: "happiness",
    conditionDetail: "High Happiness",
  },
  {
    pre: "Sugar Shock",
    post: "Candy Belly",
    preNum: "446h",
    postNum: "143h",
    conditionType: "happiness",
    conditionDetail: "High Happiness",
  },
  {
    pre: "Riolu",
    post: "Lucario",
    preNum: "447",
    postNum: "448",
    conditionType: "happiness",
    conditionDetail: "High Happiness",
  },
  {
    pre: "Rokkyu",
    post: "Lucario-sensei",
    preNum: "447s",
    postNum: "448s",
    conditionType: "happiness",
    conditionDetail: "High Happiness",
  },
  {
    pre: "Woobat",
    post: "Swoobat",
    preNum: "527",
    postNum: "528",
    conditionType: "happiness",
    conditionDetail: "High Happiness",
  },
  {
    pre: "Swadloon",
    post: "Leavanny",
    preNum: "541",
    postNum: "542",
    conditionType: "happiness",
    conditionDetail: "High Happiness",
  },
  {
    pre: "Meowth (Alolan)",
    post: "Persian (Alolan)",
    preNum: "52a",
    postNum: "53a",
    conditionType: "happiness",
    conditionDetail: "High Happiness",
  },
  {
    pre: "Type: Null",
    post: "Silvally",
    preNum: "772",
    postNum: "773",
    conditionType: "happiness",
    conditionDetail: "High Happiness",
  },

  // --- Trade Evolution ---
  { pre: "Kadabra", post: "Alakazam", preNum: "64", postNum: "65", conditionType: "trade", conditionDetail: "Trade" },
  {
    pre: "Autumn Kadabra",
    post: "Autumn Alakazam",
    preNum: "64a",
    postNum: "65a",
    conditionType: "trade",
    conditionDetail: "Trade",
  },
  { pre: "Machoke", post: "Machamp", preNum: "67", postNum: "68", conditionType: "trade", conditionDetail: "Trade" },
  { pre: "Graveler", post: "Golem", preNum: "75", postNum: "76", conditionType: "trade", conditionDetail: "Trade" },
  {
    pre: "Graveler (Alolan)",
    post: "Golem (Alolan)",
    preNum: "75a",
    postNum: "76a",
    conditionType: "trade",
    conditionDetail: "Trade",
  },
  { pre: "Haunter", post: "Gengar", preNum: "93", postNum: "94", conditionType: "trade", conditionDetail: "Trade" },
  { pre: "Boldore", post: "Gigalith", preNum: "525", postNum: "526", conditionType: "trade", conditionDetail: "Trade" },
  {
    pre: "Gurrdurr",
    post: "Conkeldurr",
    preNum: "533",
    postNum: "534",
    conditionType: "trade",
    conditionDetail: "Trade",
  },
  {
    pre: "Phantump",
    post: "Trevenant",
    preNum: "708",
    postNum: "709",
    conditionType: "trade",
    conditionDetail: "Trade",
  },
  {
    pre: "Pumpkaboo",
    post: "Gourgeist",
    preNum: "710",
    postNum: "711",
    conditionType: "trade",
    conditionDetail: "Trade",
  },

  // --- Item Trade Evolution ---
  {
    pre: "Poliwhirl",
    post: "Politoed",
    preNum: "61",
    postNum: "186",
    conditionType: "item-trade",
    conditionDetail: "King's Rock",
  },
  {
    pre: "Slowpoke",
    post: "Slowking",
    preNum: "79",
    postNum: "199",
    conditionType: "item-trade",
    conditionDetail: "King's Rock",
  },
  {
    pre: "Onix",
    post: "Steelix",
    preNum: "95",
    postNum: "208",
    conditionType: "item-trade",
    conditionDetail: "Metal Coat",
  },
  {
    pre: "Scyther",
    post: "Scizor",
    preNum: "123",
    postNum: "212",
    conditionType: "item-trade",
    conditionDetail: "Metal Coat",
  },
  {
    pre: "Rhydon",
    post: "Rhyperior",
    preNum: "112",
    postNum: "464",
    conditionType: "item-trade",
    conditionDetail: "Protector",
  },
  {
    pre: "Seadra",
    post: "Kingdra",
    preNum: "117",
    postNum: "230",
    conditionType: "item-trade",
    conditionDetail: "Dragon Scale",
  },
  {
    pre: "Electabuzz",
    post: "Electivire",
    preNum: "125",
    postNum: "466",
    conditionType: "item-trade",
    conditionDetail: "Electirizer",
  },
  {
    pre: "Magmar",
    post: "Magmortar",
    preNum: "126",
    postNum: "467",
    conditionType: "item-trade",
    conditionDetail: "Magmarizer",
  },
  {
    pre: "Porygon",
    post: "Porygon2",
    preNum: "137",
    postNum: "233",
    conditionType: "item-trade",
    conditionDetail: "Up-Grade",
  },
  {
    pre: "Porygon2",
    post: "Porygon-Z",
    preNum: "233",
    postNum: "474",
    conditionType: "item-trade",
    conditionDetail: "Dubious Disc",
  },
  {
    pre: "Feebas",
    post: "Milotic",
    preNum: "349",
    postNum: "350",
    conditionType: "item-trade",
    conditionDetail: "Prism Scale",
  },
  {
    pre: "Dusclops",
    post: "Dusknoir",
    preNum: "356",
    postNum: "477",
    conditionType: "item-trade",
    conditionDetail: "Reaper Cloth",
  },
  {
    pre: "Clamperl",
    post: "Gorebyss",
    preNum: "366",
    postNum: "368",
    conditionType: "item-trade",
    conditionDetail: "DeepSeaScale",
  },
  {
    pre: "Clamperl",
    post: "Huntail",
    preNum: "366",
    postNum: "367",
    conditionType: "item-trade",
    conditionDetail: "DeepSeaTooth",
  },
  {
    pre: "Spritzee",
    post: "Aromatisse",
    preNum: "682",
    postNum: "683",
    conditionType: "item-trade",
    conditionDetail: "Sachet",
  },
  {
    pre: "Swirlix",
    post: "Slurpuff",
    preNum: "684",
    postNum: "685",
    conditionType: "item-trade",
    conditionDetail: "Whipped Dream",
  },
  {
    pre: "Slugua",
    post: "Aquargo",
    preNum: "218o",
    postNum: "219o",
    conditionType: "item-trade",
    conditionDetail: "Shoal Shell",
  },

  // --- Eeveelution ---

  {
    pre: "Eevee",
    post: "Leafeon",
    preNum: "133",
    postNum: "470",
    conditionType: "rumble",
    conditionDetail: "Mossy Forest",
  },
  {
    pre: "Eevee",
    post: "Glaceon",
    preNum: "133",
    postNum: "471",
    conditionType: "rumble",
    conditionDetail: "Snowy Mountains",
  },
  {
    pre: "Eevee",
    post: "Sylveon",
    preNum: "133",
    postNum: "700",
    conditionType: "rumble",
    conditionDetail: "Playground",
  },
  {
    pre: "Magneton",
    post: "Magnezone",
    preNum: "82",
    postNum: "462",
    conditionType: "rumble",
    conditionDetail: "Lightstone Cave",
  },
  {
    pre: "Charjabug",
    post: "Vikavolt",
    preNum: "737",
    postNum: "738",
    conditionType: "rumble",
    conditionDetail: "Lightstone Cave",
  },
  {
    pre: "Crabrawler",
    post: "Crabominable",
    preNum: "739",
    postNum: "740",
    conditionType: "rumble",
    conditionDetail: "Snowy Mountains",
  },
  {
    pre: "Pawmo",
    post: "Pawmot",
    preNum: "922",
    postNum: "923",
    conditionType: "rumble",
    conditionDetail: "ANY",
  },
  {
    pre: "Bramblin",
    post: "Brambleghast",
    preNum: "946",
    postNum: "947",
    conditionType: "rumble",
    conditionDetail: "ANY",
  },
  {
    pre: "Nosepass",
    post: "Probopass",
    preNum: "299",
    postNum: "476",
    conditionType: "rumble",
    conditionDetail: "Lightstone Cave",
  },
  {
    pre: "Nosepharos",
    post: "Probolight",
    preNum: "299l",
    postNum: "300l",
    conditionType: "rumble",
    conditionDetail: "Lightstone Cave",
  },
  {
    pre: "Stantler",
    post: "Wyrdeer",
    preNum: "234",
    postNum: "899",
    conditionType: "rumble",
    conditionDetail: "Snowy Mountains;;Azure Flute",
  },

  // --- Mega ---
  {
    pre: "Venusaur",
    post: "Mega Venusaur",
    preNum: "3",
    postNum: "3m",
    conditionType: "mega",
    conditionDetail: "Mega Stone",
  },
  {
    pre: "Charizard",
    post: "Mega Charizard X",
    preNum: "6",
    postNum: "6mx",
    conditionType: "mega",
    conditionDetail: "Mega Stone;;X",
  },
  {
    pre: "Charizard",
    post: "Mega Charizard Y",
    preNum: "6",
    postNum: "6my",
    conditionType: "mega",
    conditionDetail: "Mega Stone;;Y",
  },
  {
    pre: "Blastoise",
    post: "Mega Blastoise",
    preNum: "9",
    postNum: "9m",
    conditionType: "mega",
    conditionDetail: "Mega Stone",
  },
  {
    pre: "Beedrill",
    post: "Mega Beedrill",
    preNum: "15",
    postNum: "15m",
    conditionType: "mega",
    conditionDetail: "Mega Stone",
  },
  {
    pre: "Pidgeot",
    post: "Mega Pidgeot",
    preNum: "18",
    postNum: "18m",
    conditionType: "mega",
    conditionDetail: "Mega Stone",
  },
  {
    pre: "Alakazam",
    post: "Mega Alakazam",
    preNum: "65",
    postNum: "65m",
    conditionType: "mega",
    conditionDetail: "Mega Stone",
  },
  {
    pre: "Slowbro",
    post: "Mega Slowbro",
    preNum: "80",
    postNum: "80m",
    conditionType: "mega",
    conditionDetail: "Mega Stone",
  },
  {
    pre: "Gengar",
    post: "Mega Gengar",
    preNum: "94",
    postNum: "94m",
    conditionType: "mega",
    conditionDetail: "Mega Stone",
  },
  {
    pre: "Kangaskhan",
    post: "Mega Kangaskhan",
    preNum: "115",
    postNum: "115m",
    conditionType: "mega",
    conditionDetail: "Mega Stone",
  },
  {
    pre: "Pinsir",
    post: "Mega Pinsir",
    preNum: "127",
    postNum: "127m",
    conditionType: "mega",
    conditionDetail: "Mega Stone",
  },
  {
    pre: "Gyarados",
    post: "Mega Gyarados",
    preNum: "130",
    postNum: "130m",
    conditionType: "mega",
    conditionDetail: "Mega Stone",
  },
  {
    pre: "Aerodactyl",
    post: "Mega Aerodactyl",
    preNum: "142",
    postNum: "142m",
    conditionType: "mega",
    conditionDetail: "Mega Stone",
  },
  {
    pre: "Mewtwo",
    post: "Mega Mewtwo X",
    preNum: "150",
    postNum: "150mx",
    conditionType: "mega",
    conditionDetail: "Mega Stone X",
  },
  {
    pre: "Mewtwo",
    post: "Mega Mewtwo Y",
    preNum: "150",
    postNum: "150my",
    conditionType: "mega",
    conditionDetail: "Mega Stone Y",
  },
  {
    pre: "Ampharos",
    post: "Mega Ampharos",
    preNum: "181",
    postNum: "181m",
    conditionType: "mega",
    conditionDetail: "Mega Stone",
  },
  {
    pre: "Steelix",
    post: "Mega Steelix",
    preNum: "208",
    postNum: "208m",
    conditionType: "mega",
    conditionDetail: "Mega Stone",
  },
  {
    pre: "Scizor",
    post: "Mega Scizor",
    preNum: "212",
    postNum: "212m",
    conditionType: "mega",
    conditionDetail: "Mega Stone",
  },
  {
    pre: "Heracross",
    post: "Mega Heracross",
    preNum: "214",
    postNum: "214m",
    conditionType: "mega",
    conditionDetail: "Mega Stone",
  },
  {
    pre: "Houndoom",
    post: "Mega Houndoom",
    preNum: "229",
    postNum: "229m",
    conditionType: "mega",
    conditionDetail: "Mega Stone",
  },
  {
    pre: "Tyranitar",
    post: "Mega Tyranitar",
    preNum: "248",
    postNum: "248m",
    conditionType: "mega",
    conditionDetail: "Mega Stone",
  },
  {
    pre: "Sceptile",
    post: "Mega Sceptile",
    preNum: "254",
    postNum: "254m",
    conditionType: "mega",
    conditionDetail: "Mega Stone",
  },
  {
    pre: "Blaziken",
    post: "Mega Blaziken",
    preNum: "257",
    postNum: "257m",
    conditionType: "mega",
    conditionDetail: "Mega Stone",
  },
  {
    pre: "Swampert",
    post: "Mega Swampert",
    preNum: "260",
    postNum: "260m",
    conditionType: "mega",
    conditionDetail: "Mega Stone",
  },
  {
    pre: "Gardevoir",
    post: "Mega Gardevoir",
    preNum: "282",
    postNum: "282m",
    conditionType: "mega",
    conditionDetail: "Mega Stone",
  },
  {
    pre: "Sableye",
    post: "Mega Sableye",
    preNum: "302",
    postNum: "302m",
    conditionType: "mega",
    conditionDetail: "Mega Stone",
  },
  {
    pre: "Mawile",
    post: "Mega Mawile",
    preNum: "303",
    postNum: "303m",
    conditionType: "mega",
    conditionDetail: "Mega Stone",
  },
  {
    pre: "Aggron",
    post: "Mega Aggron",
    preNum: "306",
    postNum: "306m",
    conditionType: "mega",
    conditionDetail: "Mega Stone",
  },
  {
    pre: "Medicham",
    post: "Mega Medicham",
    preNum: "308",
    postNum: "308m",
    conditionType: "mega",
    conditionDetail: "Mega Stone",
  },
  {
    pre: "Manectric",
    post: "Mega Manectric",
    preNum: "310",
    postNum: "310m",
    conditionType: "mega",
    conditionDetail: "Mega Stone",
  },
  {
    pre: "Sharpedo",
    post: "Mega Sharpedo",
    preNum: "319",
    postNum: "319m",
    conditionType: "mega",
    conditionDetail: "Mega Stone",
  },
  {
    pre: "Camerupt",
    post: "Mega Camerupt",
    preNum: "323",
    postNum: "323m",
    conditionType: "mega",
    conditionDetail: "Mega Stone",
  },
  {
    pre: "Altaria",
    post: "Mega Altaria",
    preNum: "334",
    postNum: "334m",
    conditionType: "mega",
    conditionDetail: "Mega Stone",
  },
  {
    pre: "Banette",
    post: "Mega Banette",
    preNum: "354",
    postNum: "354m",
    conditionType: "mega",
    conditionDetail: "Mega Stone",
  },
  {
    pre: "Absol",
    post: "Mega Absol",
    preNum: "359",
    postNum: "359m",
    conditionType: "mega",
    conditionDetail: "Mega Stone",
  },
  {
    pre: "Glalie",
    post: "Mega Glalie",
    preNum: "362",
    postNum: "362m",
    conditionType: "mega",
    conditionDetail: "Mega Stone",
  },
  {
    pre: "Salamence",
    post: "Mega Salamence",
    preNum: "373",
    postNum: "373m",
    conditionType: "mega",
    conditionDetail: "Mega Stone",
  },
  {
    pre: "Metagross",
    post: "Mega Metagross",
    preNum: "376",
    postNum: "376m",
    conditionType: "mega",
    conditionDetail: "Mega Stone",
  },
  {
    pre: "Lopunny",
    post: "Mega Lopunny",
    preNum: "428",
    postNum: "428m",
    conditionType: "mega",
    conditionDetail: "Mega Stone",
  },
  {
    pre: "Garchomp",
    post: "Mega Garchomp",
    preNum: "445",
    postNum: "445m",
    conditionType: "mega",
    conditionDetail: "Mega Stone",
  },
  {
    pre: "Lucario",
    post: "Mega Lucario",
    preNum: "448",
    postNum: "448m",
    conditionType: "mega",
    conditionDetail: "Mega Stone",
  },
  {
    pre: "Abomasnow",
    post: "Mega Abomasnow",
    preNum: "460",
    postNum: "460m",
    conditionType: "mega",
    conditionDetail: "Mega Stone",
  },
  {
    pre: "Gallade",
    post: "Mega Gallade",
    preNum: "475",
    postNum: "475m",
    conditionType: "mega",
    conditionDetail: "Mega Stone",
  },
  {
    pre: "Audino",
    post: "Mega Audino",
    preNum: "531",
    postNum: "531m",
    conditionType: "mega",
    conditionDetail: "Mega Stone",
  },
  {
    pre: "Diancie",
    post: "Mega Diancie",
    preNum: "719",
    postNum: "719m",
    conditionType: "mega",
    conditionDetail: "Mega Stone",
  },
  {
    pre: "Arcanine",
    post: "Mega Arcanine",
    preNum: "59",
    postNum: "59m",
    conditionType: "mega",
    conditionDetail: "Mega Stone",
  },
  {
    pre: "Rapidash",
    post: "Mega Rapidash",
    preNum: "78",
    postNum: "78m",
    conditionType: "mega",
    conditionDetail: "Mega Stone",
  },
  {
    pre: "Rapidash (Galarian)",
    post: "Mega Rapidash (Galarian)",
    preNum: "78g",
    postNum: "78mg",
    conditionType: "mega",
    conditionDetail: "Mega Stone",
  },
  {
    pre: "Mr. Mime",
    post: "Mega Mr. Mime",
    preNum: "122",
    postNum: "122m",
    conditionType: "mega",
    conditionDetail: "Mega Stone",
  },
  {
    pre: "Meganium",
    post: "Mega Meganium",
    preNum: "154",
    postNum: "154m",
    conditionType: "mega",
    conditionDetail: "Mega Stone",
  },
  {
    pre: "Typhlosion",
    post: "Mega Typhlosion",
    preNum: "157",
    postNum: "157m",
    conditionType: "mega",
    conditionDetail: "Mega Stone",
  },
  {
    pre: "Crobat",
    post: "Mega Crobat",
    preNum: "169",
    postNum: "169m",
    conditionType: "mega",
    conditionDetail: "Mega Stone",
  },
  {
    pre: "Dunsparce",
    post: "Mega Dunsparce",
    preNum: "206",
    postNum: "206m",
    conditionType: "mega",
    conditionDetail: "Mega Stone",
  },
  {
    pre: "Skarmory",
    post: "Mega Skarmory",
    preNum: "227",
    postNum: "227m",
    conditionType: "mega",
    conditionDetail: "Mega Stone",
  },
  {
    pre: "Flygon",
    post: "Mega Flygon",
    preNum: "330",
    postNum: "330m",
    conditionType: "mega",
    conditionDetail: "Mega Stone",
  },
  {
    pre: "Claydol",
    post: "Mega Claydol",
    preNum: "344",
    postNum: "344m",
    conditionType: "mega",
    conditionDetail: "Mega Stone",
  },
  {
    pre: "Milotic",
    post: "Mega Milotic",
    preNum: "350",
    postNum: "350m",
    conditionType: "mega",
    conditionDetail: "Mega Stone",
  },
  {
    pre: "Luxray",
    post: "Mega Luxray",
    preNum: "405",
    postNum: "405m",
    conditionType: "mega",
    conditionDetail: "Mega Stone",
  },
  {
    pre: "Electivire",
    post: "Mega Electivire",
    preNum: "466",
    postNum: "466m",
    conditionType: "mega",
    conditionDetail: "Mega Stone",
  },
  {
    pre: "Froslass",
    post: "Mega Froslass",
    preNum: "478",
    postNum: "478m",
    conditionType: "mega",
    conditionDetail: "Mega Stone",
  },
  {
    pre: "Zoroark",
    post: "Mega Zoroark",
    preNum: "571",
    postNum: "571m",
    conditionType: "mega",
    conditionDetail: "Mega Stone",
  },
  {
    pre: "Gothitelle",
    post: "Mega Gothitelle",
    preNum: "576",
    postNum: "576m",
    conditionType: "mega",
    conditionDetail: "Mega Stone",
  },
  {
    pre: "Braviary",
    post: "Mega Braviary",
    preNum: "628",
    postNum: "628m",
    conditionType: "mega",
    conditionDetail: "Mega Stone",
  },
  {
    pre: "Frosmoth",
    post: "Mega Frosmoth",
    preNum: "873",
    postNum: "873m",
    conditionType: "mega",
    conditionDetail: "Mega Stone",
  },
  {
    pre: "Frosmoth",
    post: "Mega Frosmoth",
    preNum: "873",
    postNum: "873m",
    conditionType: "mega",
    conditionDetail: "Mega Stone",
  },
  {
    pre: "Autumn Alakazam",
    post: "Mega Autumn Alakazam",
    preNum: "65a",
    postNum: "65am",
    conditionType: "mega",
    conditionDetail: "Mega Stone",
  },
  {
    pre: "Cursed Rapidash",
    post: "Mega Cursed Rapidash",
    preNum: "78h",
    postNum: "78mh",
    conditionType: "mega",
    conditionDetail: "Mega Stone",
  },
  {
    pre: "Yorebro",
    post: "Mega Yorebro",
    preNum: "80s",
    postNum: "80ms",
    conditionType: "mega",
    conditionDetail: "Mega Stone",
  },
  {
    pre: "Autumn Ampharos",
    post: "Mega Autumn Ampharos",
    preNum: "181au",
    postNum: "181am",
    conditionType: "mega",
    conditionDetail: "Mega Stone",
  },
  {
    pre: "Spring Ampharos",
    post: "Mega Spring Ampharos",
    preNum: "181s",
    postNum: "181sm",
    conditionType: "mega",
    conditionDetail: "Mega Stone",
  },
  {
    pre: "Summer Ampharos",
    post: "Mega Summer Ampharos",
    preNum: "181su",
    postNum: "181pm",
    conditionType: "mega",
    conditionDetail: "Mega Stone",
  },
  {
    pre: "Winter Ampharos",
    post: "Mega Winter Ampharos",
    preNum: "181w",
    postNum: "181mw",
    conditionType: "mega",
    conditionDetail: "Mega Stone",
  },
  {
    pre: "Obsidialix",
    post: "Mega Obsidialix",
    preNum: "208o",
    postNum: "208mo",
    conditionType: "mega",
    conditionDetail: "Mega Stone",
  },
  {
    pre: "Skarigami",
    post: "Mega Skarigami",
    preNum: "227o",
    postNum: "227mo",
    conditionType: "mega",
    conditionDetail: "Mega Stone",
  },
  {
    pre: "Mecha Tyranitar",
    post: "Mega Mecha Tyranitar",
    preNum: "248e",
    postNum: "248em",
    conditionType: "mega",
    conditionDetail: "Mega Stone",
  },
  {
    pre: "Robin Blaze",
    post: "Mega Robin Blaze",
    preNum: "257r",
    postNum: "257mr",
    conditionType: "mega",
    conditionDetail: "Mega Stone",
  },
  {
    pre: "Festival Gardevoir",
    post: "Mega Festival Gardevoir",
    preNum: "282k",
    postNum: "282km",
    conditionType: "mega",
    conditionDetail: "Mega Stone",
  },
  {
    pre: "Crystal Aggron",
    post: "Mega Crystal Aggron",
    preNum: "306c",
    postNum: "306cm",
    conditionType: "mega",
    conditionDetail: "Mega Stone",
  },
  {
    pre: "Winter Camerupt",
    post: "Mega Winter Camerupt",
    preNum: "323w",
    postNum: "323wm",
    conditionType: "mega",
    conditionDetail: "Mega Stone",
  },
  {
    pre: "Candaria",
    post: "Mega Candaria",
    preNum: "334c",
    postNum: "334mc",
    conditionType: "mega",
    conditionDetail: "Mega Stone",
  },
  {
    pre: "Banettenstein",
    post: "Mega Banettenstein",
    preNum: "354z",
    postNum: "354mz",
    conditionType: "mega",
    conditionDetail: "Mega Stone",
  },
  {
    pre: "Sala da Menci",
    post: "Mega Sala da Menci",
    preNum: "373a",
    postNum: "373ma",
    conditionType: "mega",
    conditionDetail: "Mega Stone",
  },
  {
    pre: "Lord Salamence",
    post: "Mega Lord Salamence",
    preNum: "373s",
    postNum: "373ms",
    conditionType: "mega",
    conditionDetail: "Mega Stone",
  },
  {
    pre: "Easter Lopunny",
    post: "Mega Easter Lopunny",
    preNum: "428e",
    postNum: "428me",
    conditionType: "mega",
    conditionDetail: "Mega Stone",
  },
  {
    pre: "Lucario-sensei",
    post: "Mega Lucario-sensei",
    preNum: "448s",
    postNum: "448sm",
    conditionType: "mega",
    conditionDetail: "Mega Stone",
  },
  {
    pre: "Diancie (Emera)",
    post: "Mega Diancie (Emera)",
    preNum: "719e",
    postNum: "719me",
    conditionType: "mega",
    conditionDetail: "Mega Stone",
  },

  // --- Castform ---
  {
    pre: "Castform",
    post: "Heat Castform",
    preNum: "351",
    postNum: "351a",
    conditionType: "castform",
    conditionDetail: "Very Sunny",
  },
  {
    pre: "Castform",
    post: "Rainy Castform",
    preNum: "351",
    postNum: "351b",
    conditionType: "castform",
    conditionDetail: "Rainy",
  },
  {
    pre: "Castform",
    post: "Snowy Castform",
    preNum: "351",
    postNum: "351c",
    conditionType: "castform",
    conditionDetail: "Hail",
  },
  {
    pre: "Castform",
    post: "Foggy Castform",
    preNum: "351",
    postNum: "351d",
    conditionType: "castform",
    conditionDetail: "Foggy",
  },
  {
    pre: "Castform",
    post: "Aurora Castform",
    preNum: "351",
    postNum: "351e",
    conditionType: "castform",
    conditionDetail: "Mystic Aurora",
  },
  {
    pre: "Castform",
    post: "Cold Castform",
    preNum: "351",
    postNum: "351f",
    conditionType: "castform",
    conditionDetail: "Cold",
  },
  {
    pre: "Castform",
    post: "Dark Castform",
    preNum: "351",
    postNum: "351g",
    conditionType: "castform",
    conditionDetail: "Very foggy",
  },
  {
    pre: "Castform",
    post: "Thunder Castform",
    preNum: "351",
    postNum: "351h",
    conditionType: "castform",
    conditionDetail: "Thunderstorm",
  },
  {
    pre: "Castform",
    post: "Meteorite Castform",
    preNum: "351",
    postNum: "351i",
    conditionType: "castform",
    conditionDetail: "Meteorites",
  },
  {
    pre: "Castform",
    post: "Windy Castform",
    preNum: "351",
    postNum: "351j",
    conditionType: "castform",
    conditionDetail: "Windy",
  },
  {
    pre: "Castform",
    post: "Earthquake Castform",
    preNum: "351",
    postNum: "351k",
    conditionType: "castform",
    conditionDetail: "Strong earthquakes",
  },
  {
    pre: "Castform",
    post: "Muggy Castform",
    preNum: "351",
    postNum: "351l",
    conditionType: "castform",
    conditionDetail: "Muggy",
  },
  {
    pre: "Castform",
    post: "Eruption Castform",
    preNum: "351",
    postNum: "351m",
    conditionType: "castform",
    conditionDetail: "Small earthquakes",
  },
  {
    pre: "Castform",
    post: "Gusty Castform",
    preNum: "351",
    postNum: "351n",
    conditionType: "castform",
    conditionDetail: "Gusty",
  },
  {
    pre: "Castform",
    post: "Smog Castform",
    preNum: "351",
    postNum: "351o",
    conditionType: "castform",
    conditionDetail: "Smog",
  },
  {
    pre: "Castform",
    post: "Sunny Castform",
    preNum: "351",
    postNum: "351p",
    conditionType: "castform",
    conditionDetail: "Sunny",
  },
  {
    pre: "Castform",
    post: "Rainbow Castform",
    preNum: "351",
    postNum: "351q",
    conditionType: "castform",
    conditionDetail: "Rainbow",
  },

  // --- Furfrou ---
  {
    pre: "Furfrou",
    post: "Furfrou (Star)",
    preNum: "676",
    postNum: "676a",
    conditionType: "furfrou",
    conditionDetail: "a",
  },
  {
    pre: "Furfrou",
    post: "Furfrou (Heart)",
    preNum: "676",
    postNum: "676b",
    conditionType: "furfrou",
    conditionDetail: "b",
  },
  {
    pre: "Furfrou",
    post: "Furfrou (Diamond)",
    preNum: "676",
    postNum: "676c",
    conditionType: "furfrou",
    conditionDetail: "c",
  },
  {
    pre: "Furfrou",
    post: "Furfrou (Dandy)",
    preNum: "676",
    postNum: "676d",
    conditionType: "furfrou",
    conditionDetail: "d",
  },
  {
    pre: "Furfrou",
    post: "Furfrou (Matron)",
    preNum: "676",
    postNum: "676e",
    conditionType: "furfrou",
    conditionDetail: "e",
  },
  {
    pre: "Furfrou",
    post: "Furfrou (Debutante)",
    preNum: "676",
    postNum: "676f",
    conditionType: "furfrou",
    conditionDetail: "f",
  },
  {
    pre: "Furfrou",
    post: "Furfrou (Pharaoh)",
    preNum: "676",
    postNum: "676g",
    conditionType: "furfrou",
    conditionDetail: "g",
  },
  {
    pre: "Furfrou",
    post: "Furfrou (La Reine)",
    preNum: "676",
    postNum: "676h",
    conditionType: "furfrou",
    conditionDetail: "h",
  },
  {
    pre: "Furfrou",
    post: "Furfrou (Kabuki)",
    preNum: "676",
    postNum: "676i",
    conditionType: "furfrou",
    conditionDetail: "i",
  },
  // TODO: Only when event is active
  // {
  //   Pre: "Furfrou",
  //   Post: "Furfrou (Santa)",
  //   PreNum: "676",
  //   PostNum: "676sa",
  //   ConditionType: "furfrou",
  //   ConditionDetail: "sa",
  // },

  // --- Form Change ---
  {
    pre: "Pikachu",
    post: "Pikachu Belle",
    preNum: "25",
    postNum: "25cb",
    conditionType: "form-item-give",
    conditionDetail: "Cosplay Box (Beauty)",
  },
  {
    pre: "Pikachu",
    post: "Pikachu Detective",
    preNum: "25",
    postNum: "25cd",
    conditionType: "form-item-give",
    conditionDetail: "Cosplay Box (Detective)",
  },
  {
    pre: "Pikachu",
    post: "Pikachu Libre",
    preNum: "25",
    postNum: "25cl",
    conditionType: "form-item-give",
    conditionDetail: "Cosplay Box (Tough)",
  },
  {
    pre: "Pikachu",
    post: "Pikachu Pop Star",
    preNum: "25",
    postNum: "25cp",
    conditionType: "form-item-give",
    conditionDetail: "Cosplay Box (Cute)",
  },
  {
    pre: "Pikachu",
    post: "Pikachu Rock",
    preNum: "25",
    postNum: "25cr",
    conditionType: "form-item-give",
    conditionDetail: "Cosplay Box (Cool)",
  },
  {
    pre: "Pikachu",
    post: "Pikachu Scientist",
    preNum: "25",
    postNum: "25pd",
    conditionType: "form-item-give",
    conditionDetail: "Cosplay Box (Smart)",
  },
  {
    pre: "Teddiursa",
    post: "Teddiursa (Misdreavus)",
    preNum: "216",
    postNum: "216m",
    conditionType: "form-item-give",
    conditionDetail: "Misdreavus Cosplay",
  },
  {
    pre: "Latias",
    post: "Mega Latias",
    preNum: "380",
    postNum: "380m",
    conditionType: "form-item-give",
    conditionDetail: "Enigma Pearl",
  },
  {
    pre: "Latios",
    post: "Mega Latios",
    preNum: "381",
    postNum: "381m",
    conditionType: "form-item-give",
    conditionDetail: "Enigma Pearl",
  },
  {
    pre: "Kyogre",
    post: "Primal Kyogre",
    preNum: "382",
    postNum: "382m",
    conditionType: "form-item-give",
    conditionDetail: "Blue Orb",
  },
  {
    pre: "Groudon",
    post: "Primal Groudon",
    preNum: "383",
    postNum: "383m",
    conditionType: "form-item-give",
    conditionDetail: "Red Orb",
  },
  {
    pre: "Rayquaza",
    post: "Mega Rayquaza",
    preNum: "384",
    postNum: "384m",
    conditionType: "form-item-give",
    conditionDetail: "Green Orb",
  },
  {
    pre: "Deoxys",
    post: "Deoxys (Attack)",
    preNum: "386",
    postNum: "386a",
    conditionType: "form-item-give",
    conditionDetail: "Red Meteorite",
  },
  {
    pre: "Deoxys",
    post: "Deoxys (Defense)",
    preNum: "386",
    postNum: "386b",
    conditionType: "form-item-give",
    conditionDetail: "Blue Meteorite",
  },
  {
    pre: "Deoxys",
    post: "Deoxys (Speed)",
    preNum: "386",
    postNum: "386c",
    conditionType: "form-item-give",
    conditionDetail: "Yellow Meteorite",
  },
  {
    pre: "Tom Nook",
    post: "Tom Nook (Seller)",
    preNum: "399n",
    postNum: "399s",
    conditionType: "form-item-give",
    conditionDetail: "Seller Clothes",
  },
  {
    pre: "Cherrim",
    post: "Cherrim (Sunny)",
    preNum: "421",
    postNum: "421a",
    conditionType: "form-item-give",
    conditionDetail: "Energy Root",
  },
  {
    pre: "Rotom",
    post: "Heat Rotom",
    preNum: "479",
    postNum: "479a",
    conditionType: "form-item-give",
    conditionDetail: "Microwave",
  },
  {
    pre: "Rotom",
    post: "Wash Rotom",
    preNum: "479",
    postNum: "479b",
    conditionType: "form-item-give",
    conditionDetail: "Washing Machine",
  },
  {
    pre: "Rotom",
    post: "Frost Rotom",
    preNum: "479",
    postNum: "479c",
    conditionType: "form-item-give",
    conditionDetail: "Refrigerator",
  },
  {
    pre: "Rotom",
    post: "Fan Rotom",
    preNum: "479",
    postNum: "479d",
    conditionType: "form-item-give",
    conditionDetail: "Electric Fan",
  },
  {
    pre: "Rotom",
    post: "Mow Rotom",
    preNum: "479",
    postNum: "479e",
    conditionType: "form-item-give",
    conditionDetail: "Lawnmower",
  },
  {
    pre: "Rotom",
    post: "Mixer Rotom",
    preNum: "479",
    postNum: "479f",
    conditionType: "form-item-give",
    conditionDetail: "Mixer",
  },
  {
    pre: "Rotom",
    post: "Drill Rotom",
    preNum: "479",
    postNum: "479g",
    conditionType: "form-item-give",
    conditionDetail: "Drill",
  },
  {
    pre: "Rotom",
    post: "Monitor Rotom",
    preNum: "479",
    postNum: "479h",
    conditionType: "form-item-give",
    conditionDetail: "Monitor",
  },
  {
    pre: "Rotom",
    post: "Dex Rotom",
    preNum: "479",
    postNum: "479i",
    conditionType: "form-item-give",
    conditionDetail: "Old PokéDex",
  },
  {
    pre: "Giratina",
    post: "Giratina (Origin)",
    preNum: "487",
    postNum: "487a",
    conditionType: "form-item-give",
    conditionDetail: "Griseous Crystal",
  },
  {
    pre: "Giratina",
    post: "Mega Giratina",
    preNum: "487",
    postNum: "487m",
    conditionType: "form-item-give",
    conditionDetail: "Griseous Pearl",
  },
  {
    pre: "Shaymin",
    post: "Shaymin (Sky)",
    preNum: "492",
    postNum: "492a",
    conditionType: "form-item-give",
    conditionDetail: "Gracidea",
  },
  {
    pre: "Arceus",
    post: "Arceus (Bug)",
    preNum: "493",
    postNum: "493a",
    conditionType: "form-item-give",
    conditionDetail: "Insect Plate",
  },
  {
    pre: "Arceus",
    post: "Arceus (Dark)",
    preNum: "493",
    postNum: "493b",
    conditionType: "form-item-give",
    conditionDetail: "Dread Plate",
  },
  {
    pre: "Arceus",
    post: "Arceus (Dragon)",
    preNum: "493",
    postNum: "493c",
    conditionType: "form-item-give",
    conditionDetail: "Draco Plate",
  },
  {
    pre: "Arceus",
    post: "Arceus (Electric)",
    preNum: "493",
    postNum: "493d",
    conditionType: "form-item-give",
    conditionDetail: "Zap Plate",
  },
  {
    pre: "Arceus",
    post: "Arceus (Fighting)",
    preNum: "493",
    postNum: "493e",
    conditionType: "form-item-give",
    conditionDetail: "Fist Plate",
  },
  {
    pre: "Arceus",
    post: "Arceus (Fire)",
    preNum: "493",
    postNum: "493f",
    conditionType: "form-item-give",
    conditionDetail: "Flame Plate",
  },
  {
    pre: "Arceus",
    post: "Arceus (Flying)",
    preNum: "493",
    postNum: "493g",
    conditionType: "form-item-give",
    conditionDetail: "Sky Plate",
  },
  {
    pre: "Arceus",
    post: "Arceus (Ghost)",
    preNum: "493",
    postNum: "493h",
    conditionType: "form-item-give",
    conditionDetail: "Spooky Plate",
  },
  {
    pre: "Arceus",
    post: "Arceus (Grass)",
    preNum: "493",
    postNum: "493i",
    conditionType: "form-item-give",
    conditionDetail: "Meadow Plate",
  },
  {
    pre: "Arceus",
    post: "Arceus (Ground)",
    preNum: "493",
    postNum: "493j",
    conditionType: "form-item-give",
    conditionDetail: "Earth Plate",
  },
  {
    pre: "Arceus",
    post: "Arceus (Ice)",
    preNum: "493",
    postNum: "493k",
    conditionType: "form-item-give",
    conditionDetail: "Icicle Plate",
  },
  {
    pre: "Arceus",
    post: "Arceus (Poison)",
    preNum: "493",
    postNum: "493l",
    conditionType: "form-item-give",
    conditionDetail: "Toxic Plate",
  },
  {
    pre: "Arceus",
    post: "Arceus (Psychic)",
    preNum: "493",
    postNum: "493m",
    conditionType: "form-item-give",
    conditionDetail: "Mind Plate",
  },
  {
    pre: "Arceus",
    post: "Arceus (Rock)",
    preNum: "493",
    postNum: "493n",
    conditionType: "form-item-give",
    conditionDetail: "Stone Plate",
  },
  {
    pre: "Arceus",
    post: "Arceus (Steel)",
    preNum: "493",
    postNum: "493o",
    conditionType: "form-item-give",
    conditionDetail: "Iron Plate",
  },
  {
    pre: "Arceus",
    post: "Arceus (Water)",
    preNum: "493",
    postNum: "493p",
    conditionType: "form-item-give",
    conditionDetail: "Splash Plate",
  },
  {
    pre: "Arceus",
    post: "Arceus (Fairy)",
    preNum: "493",
    postNum: "493q",
    conditionType: "form-item-give",
    conditionDetail: "Pixie Plate",
  },
  {
    pre: "Simisage",
    post: "Simisage (Waiter)",
    preNum: "512",
    postNum: "512w",
    conditionType: "form-item-give",
    conditionDetail: "Waiter Dress (Green)",
  },
  {
    pre: "Simisear",
    post: "Simisear (Waiter)",
    preNum: "514",
    postNum: "514w",
    conditionType: "form-item-give",
    conditionDetail: "Waiter Dress (Red)",
  },
  {
    pre: "Simipour",
    post: "Simipour (Waiter)",
    preNum: "516",
    postNum: "516w",
    conditionType: "form-item-give",
    conditionDetail: "Waiter Dress (Blue)",
  },
  {
    pre: "Darmanitan",
    post: "Darmanitan (Zen)",
    preNum: "555",
    postNum: "555z",
    conditionType: "form-item-give",
    conditionDetail: "Focus Sash",
  },
  {
    pre: "Darmanitan (Galarian)",
    post: "Darmanitan (Galarian Zen)",
    preNum: "555g",
    postNum: "555gz",
    conditionType: "form-item-give",
    conditionDetail: "Focus Sash",
  },
  {
    pre: "Tornadus",
    post: "Tornadus (Therian Forme)",
    preNum: "641",
    postNum: "641a",
    conditionType: "form-item-give",
    conditionDetail: "Reveal Glass",
  },
  {
    pre: "Thundurus",
    post: "Thundurus (Therian Forme)",
    preNum: "642",
    postNum: "642a",
    conditionType: "form-item-give",
    conditionDetail: "Reveal Glass",
  },
  {
    pre: "Landorus",
    post: "Landorus (Therian Forme)",
    preNum: "645",
    postNum: "645a",
    conditionType: "form-item-give",
    conditionDetail: "Reveal Glass",
  },
  {
    pre: "Enamorus",
    post: "Enamorus (Therian Forme)",
    preNum: "905",
    postNum: "905a",
    conditionType: "form-item-give",
    conditionDetail: "Reveal Glass",
  },
  {
    pre: "Kyurem",
    post: "Black Kyurem",
    preNum: "646",
    postNum: "646b",
    conditionType: "form-item-give",
    conditionDetail: "DNA Splicer (Black)",
  },
  {
    pre: "Kyurem",
    post: "White Kyurem",
    preNum: "646",
    postNum: "646w",
    conditionType: "form-item-give",
    conditionDetail: "DNA Splicer (White)",
  },
  {
    pre: "Keldeo",
    post: "Keldeo (Resolute)",
    preNum: "647",
    postNum: "647r",
    conditionType: "form-item-give",
    conditionDetail: "Secret Sword",
  },
  {
    pre: "Meloetta",
    post: "Meloetta (Pirouette)",
    preNum: "648",
    postNum: "648p",
    conditionType: "form-item-give",
    conditionDetail: "Shell Bell",
  },
  {
    pre: "Genesect",
    post: "Genesect (Burn)",
    preNum: "649",
    postNum: "649a",
    conditionType: "form-item-give",
    conditionDetail: "Burn Drive",
  },
  {
    pre: "Genesect",
    post: "Genesect (Douse)",
    preNum: "649",
    postNum: "649a",
    conditionType: "form-item-give",
    conditionDetail: "Douse Drive",
  },
  {
    pre: "Genesect",
    post: "Genesect (Shock)",
    preNum: "649",
    postNum: "649a",
    conditionType: "form-item-give",
    conditionDetail: "Shock Drive",
  },
  {
    pre: "Genesect",
    post: "Genesect (Chill)",
    preNum: "649",
    postNum: "649a",
    conditionType: "form-item-give",
    conditionDetail: "Chill Drive",
  },
  {
    pre: "Hoopa",
    post: "Hoopa (Unbound)",
    preNum: "720",
    postNum: "720u",
    conditionType: "form-item-give",
    conditionDetail: "Prison Bottle",
  },
  {
    pre: "Silvally",
    post: "Silvally (Bug)",
    preNum: "773",
    postNum: "773a",
    conditionType: "form-item-give",
    conditionDetail: "Bug Memory",
  },
  {
    pre: "Silvally",
    post: "Silvally (Dark)",
    preNum: "773",
    postNum: "773b",
    conditionType: "form-item-give",
    conditionDetail: "Dark Memory",
  },
  {
    pre: "Silvally",
    post: "Silvally (Dragon)",
    preNum: "773",
    postNum: "773c",
    conditionType: "form-item-give",
    conditionDetail: "Dragon Memory",
  },
  {
    pre: "Silvally",
    post: "Silvally (Electric)",
    preNum: "773",
    postNum: "773d",
    conditionType: "form-item-give",
    conditionDetail: "Electric Memory",
  },
  {
    pre: "Silvally",
    post: "Silvally (Fighting)",
    preNum: "773",
    postNum: "773e",
    conditionType: "form-item-give",
    conditionDetail: "Fighting Memory",
  },
  {
    pre: "Silvally",
    post: "Silvally (Fire)",
    preNum: "773",
    postNum: "773f",
    conditionType: "form-item-give",
    conditionDetail: "Fire Memory",
  },
  {
    pre: "Silvally",
    post: "Silvally (Flying)",
    preNum: "773",
    postNum: "773g",
    conditionType: "form-item-give",
    conditionDetail: "Flying Memory",
  },
  {
    pre: "Silvally",
    post: "Silvally (Ghost)",
    preNum: "773",
    postNum: "773h",
    conditionType: "form-item-give",
    conditionDetail: "Ghost Memory",
  },
  {
    pre: "Silvally",
    post: "Silvally (Grass)",
    preNum: "773",
    postNum: "773i",
    conditionType: "form-item-give",
    conditionDetail: "Grass Memory",
  },
  {
    pre: "Silvally",
    post: "Silvally (Ground)",
    preNum: "773",
    postNum: "773j",
    conditionType: "form-item-give",
    conditionDetail: "Ground Memory",
  },
  {
    pre: "Silvally",
    post: "Silvally (Ice)",
    preNum: "773",
    postNum: "773k",
    conditionType: "form-item-give",
    conditionDetail: "Ice Memory",
  },
  {
    pre: "Silvally",
    post: "Silvally (Poison)",
    preNum: "773",
    postNum: "773l",
    conditionType: "form-item-give",
    conditionDetail: "Poison Memory",
  },
  {
    pre: "Silvally",
    post: "Silvally (Psychic)",
    preNum: "773",
    postNum: "773m",
    conditionType: "form-item-give",
    conditionDetail: "Psychic Memory",
  },
  {
    pre: "Silvally",
    post: "Silvally (Rock)",
    preNum: "773",
    postNum: "773n",
    conditionType: "form-item-give",
    conditionDetail: "Rock Memory",
  },
  {
    pre: "Silvally",
    post: "Silvally (Steel)",
    preNum: "773",
    postNum: "773o",
    conditionType: "form-item-give",
    conditionDetail: "Steel Memory",
  },
  {
    pre: "Silvally",
    post: "Silvally (Water)",
    preNum: "773",
    postNum: "773p",
    conditionType: "form-item-give",
    conditionDetail: "Water Memory",
  },
  {
    pre: "Silvally",
    post: "Silvally (Fairy)",
    preNum: "773",
    postNum: "773q",
    conditionType: "form-item-give",
    conditionDetail: "Fairy Memory",
  },
  {
    pre: "Marshadow",
    post: "Zenith Marshadow",
    preNum: "802",
    postNum: "802z",
    conditionType: "form-item-give",
    conditionDetail: "Marshadium Z",
  },
  {
    pre: "Morpeko",
    post: "Morpeko (Hangry)",
    preNum: "877",
    postNum: "877h",
    conditionType: "form-item-give",
    conditionDetail: "Leftovers",
  },
  {
    pre: "Zacian",
    post: "Zacian (Crowned Sword)",
    preNum: "888",
    postNum: "888c",
    conditionType: "form-item-give",
    conditionDetail: "Rusted Sword",
  },
  {
    pre: "Zamazenta",
    post: "Zamazenta (Crowned Shield)",
    preNum: "889",
    postNum: "889c",
    conditionType: "form-item-give",
    conditionDetail: "Rusted Shield",
  },
  {
    pre: "Psyduck",
    post: "Psyduck (Selfie)",
    preNum: "54",
    postNum: "54s",
    conditionType: "form-item-give",
    conditionDetail: "Selfie Stick",
  },
];
