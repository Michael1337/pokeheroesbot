import { headers } from "../../a-shared/const.js";
import { sendMail } from "../../a-shared/email.js";
import { logMsg, logErr, logLevels } from "../../a-shared/logger.js";

const tag = "HONEY TREE";

function viewTree() {
  return fetch("https://pokeheroes.com/honeytree", {
    headers: headers,
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

function brushHoney(honey = "honey") {
  return fetch(`https://pokeheroes.com/honeytree?brush=${honey}`, {
    headers: headers,
    referrer: "https://pokeheroes.com/honeytree",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

function scareAway() {
  return fetch("https://pokeheroes.com/honeytree?scare=true", {
    headers: headers,
    referrer: "https://pokeheroes.com/honeytree",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

function throwBall(pb = "Poké Ball") {
  return fetch("https://pokeheroes.com/includes/ajax/route/treeThrowPB.php", {
    headers: headers,
    referrer: "https://pokeheroes.com/honeytree",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: `pb=${pb}`,
    method: "POST",
    mode: "cors",
    credentials: "include",
  });
}

function visitCelebi() {
  return fetch("https://pokeheroes.com/ilex_forest.php", {
    headers: headers,
    referrer: "https://pokeheroes.com/honeytree",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

function catchCelebi() {
  return fetch("https://pokeheroes.com/ilex_forest.php?catch=celebi", {
    headers: headers,
    referrer: "https://pokeheroes.com/ilex_forest.php",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

async function throwPokeBall() {
  const html = await (await throwBall("Poké Ball")).text();

  if (html.includes("pkmnNotCaughtError")) {
    return false;
  } else if (html.includes("GOTCHA")) {
    const caughtMessage = html.match(/<b>(?<caughtMessage>.*?)<\/b>/);
    logMsg(tag, logLevels.Valuable, `${caughtMessage?.groups.caughtMessage}`);
    return true;
  } else {
    logErr(tag, `HoneyTree 1`, html);
    return true;
  }
}

async function catchPokemon(html) {
  // TODO: Instead of having a hard-coded list here, check OT Pokedex whenever a Pokemon is encountered.
  // But also catch some of the rarer Pokémon to auction them.
  // Note that you don't get the eggdex when catching them here, so it's not really worth it anyways.
  const caughtPokemon = [
    "Wurmple",
    "Heracross",
    "Aipom",
    "Cherubi",
    "Burmy",
    "Hoppip",
    "Budew",
    "Pachirisu",
    "Applin",
    "Cubchoo",
    "Larvesta",
    "Teddiursa",
    // "Munchlax",
    // "Combee",
    // "Slowyore",
  ];

  const wildPokemonName = html.match(/Look! A wild (?<pokemonName>\w+) /);
  const name = wildPokemonName?.groups.pokemonName;
  const wildPokemonNumber = html.match(/honeytree_v2\/(?<pokemonNumber>\d+)\.png/);
  const number = wildPokemonNumber?.groups.pokemonNumber;
  const isShiny = number?.startsWith("1");

  if (caughtPokemon.includes(name) && !isShiny) {
    await scareAway();
    logMsg(
      tag,
      logLevels.Interesting,
      `A wild [${name} (${number}, ${isShiny ? "shiny" : "normal"})] appeared. Already caught before. Scared away...`,
    );
    return;
  }

  let caught = false;
  while (!caught) {
    logMsg(
      tag,
      logLevels.Valuable,
      `A wild [${name} (${number}, ${isShiny ? "shiny" : "normal"})] appeared. Attempting to catch...`,
    );

    caught = await throwPokeBall();
  }
  return;
}

export async function handleTree() {
  try {
    const html = await (await viewTree()).text();

    if (html.includes("tree_celebi")) {
      const celebiHTML = await (await visitCelebi()).text();
      if (celebiHTML.includes("Catch it with your hands")) {
        const catchHTML = await (await catchCelebi()).text();
        if (catchHTML.includes("You took the egg")) {
          logMsg(tag, logLevels.Valuable, "Got a Celebi egg!");
        } else {
          sendMail("catchHTML", catchHTML);
        }
      } else {
        sendMail("celebiHTML", celebiHTML);
      }
    } else if (html.includes("Look! A wild")) {
      await catchPokemon(html);
    } else if (html.includes("Oh, you got some honey! Do you want to use it?")) {
      logMsg(tag, logLevels.Interesting, `Putting honey on tree.`);
      await brushHoney("honey");
    }
  } catch (error) {
    logErr(tag, `HoneyTree 3`, error);
  }
}
