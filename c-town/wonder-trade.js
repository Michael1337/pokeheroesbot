import { headers } from "../a-shared/const.js";
import { logErr, logLevels, logMsg } from "../a-shared/logger.js";
import { getAllShinies } from "../b-home/pokemon-storage.js";

const tag = "WONDER TRADE";

function loadWonderTrade() {
  return fetch("https://pokeheroes.com/gts_wondertrade", {
    headers: headers,
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

function cancelWonderTrade(pkmnid = 0) {
  return fetch(`https://pokeheroes.com/gts_wondertrade?cancel=${pkmnid}`, {
    headers: headers,
    referrer: "https://pokeheroes.com/gts_wondertrade",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

async function setupWonderTrade(pkmnid = 0) {
  return fetch("https://pokeheroes.com/gts_wondertrade?type=normal", {
    headers: headers,
    referrer: "https://pokeheroes.com/gts_wondertrade",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: `wtrade_pkmn=${pkmnid}`,
    method: "POST",
    mode: "cors",
    credentials: "include",
  });
}

async function setupWonderTradeShiny(pkmnid = 0) {
  return fetch("https://www.pokeheroes.com/gts_wondertrade?type=shiny", {
    headers: headers,
    referrer: "https://www.pokeheroes.com/gts_wondertrade?type=shiny",
    body: `wtrade_pkmn=${pkmnid}`,
    method: "POST",
    mode: "cors",
    credentials: "include",
  });
}

export async function undoWonderTrade() {
  const html = await (await loadWonderTrade()).text();

  const regex = /pokemon\?id=(?<id>\d+)/g;
  let match;

  while ((match = regex.exec(html)) !== null) {
    await cancelWonderTrade(match.groups.id);
  }
}

export async function doWonderTrade(pkmn = []) {
  for (const pokemon of pkmn) {
    logMsg(tag, logLevels.Interesting, `Wonder Trading Pokemon ID [${pokemon.id}], Name [${pokemon.speciesName}]`);
    await setupWonderTrade(pokemon.id);
  }
}

export async function handleWonderTradeShiny() {
  const candidates = (await getAllShinies()).filter(
    (pokemon) => pokemon.originalTrainer !== process.env.APP_USERNAME || pokemon.boxName === "Duplicates",
  );

  // Move "Duplicates" to front of the array
  candidates.sort((a, b) => {
    if (a.boxName === "Duplicates" && b.boxName !== "Duplicates") return -1;
    if (a.boxName !== "Duplicates" && b.boxName === "Duplicates") return 1;
    return 0;
  });

  const knownErrors = [
    "You cannot trade this Pokémon!",
    "This Pokemon has been set up for the next Wondertrade.",
    "You have already set up a Pokémon with the same species!",
  ];

  for (const candidate of candidates) {
    const html = await (await setupWonderTradeShiny(candidate.id)).text();

    const match = html.match(/<div\s+id=["']redfield["']>(?<error>.*?)<\/div>/s);
    const errorMessage = match?.groups?.error;

    if (errorMessage && knownErrors.some((err) => errorMessage.includes(err))) {
      logMsg(tag, logLevels.Valuable, `Cannot set up candidate [${candidate.id}]: ${errorMessage}`);
    } else if (html.includes("<script>location.href = '?type=shiny';</script>")) {
      logMsg(tag, logLevels.Valuable, `Set up candidate [${candidate.id}] for shiny wonder trade!`);
    } else if (html.includes("Wonder Raffle") && !html.includes("Set up a new Wondertrade")) {
      logMsg(tag, logLevels.Valuable, `Reached limit of possible shiny wonder trades.`);
      break; // No point continuing if limit reached
    } else {
      logErr(tag, `Error setting up [${candidate.id}]`, html);
    }
  }
}
