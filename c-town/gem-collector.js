import { headers, WAIT_TIMES } from "../a-shared/const.js";
import { logErr, logLevels, logMsg } from "../a-shared/logger.js";
import { delay } from "../a-shared/utils.js";
import { createSpaceInParty } from "./rowan-lab/adoption.js";

const tag = "GEM COLLECTOR";

function checkZygardeQuest() {
  return fetch(`https://pokeheroes.com/zygarde`, {
    headers: headers,
    referrer: "https://pokeheroes.com/gem_collector",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

function mergeZygardeQuest(url) {
  return fetch(`https://pokeheroes.com/zygarde${url}`, {
    headers: headers,
    referrer: "https://pokeheroes.com/zygarde",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

export async function handleZygardeQuest() {
  let html = await (await checkZygardeQuest()).text();
  if (html.includes("718e.png") && !html.includes("NEW!")) return; // Only get new eggs until the "e" egg is not NEW anymore.

  const matchRows = [...html.matchAll(/<tr>(?<rowContent>[\s\S]*?)<\/tr>/g)];
  const lastRow = matchRows[matchRows.length - 1]?.groups?.rowContent || "";

  const matchGems = [
    ...lastRow.matchAll(
      /<font color=[^>]+>(?<available>\d+)\s*\/\s*(?<required>\d+)\s*(?<type>[A-Za-z ]+?) Gem<\/font>/g,
    ),
  ];
  const enoughGems = matchGems.every((m) => parseInt(m.groups.available, 10) >= parseInt(m.groups.required, 10));
  if (!enoughGems) {
    logMsg(tag, logLevels.Valuable, `Not enough gems to merge into Zygarde egg!`);
    return;
  }

  const matchURL = lastRow.match(/Merge" onclick="location\.href\s*=\s*'(?<href>[^']+)'/i);
  if (matchURL && matchURL.groups) {
    html = await (await mergeZygardeQuest(matchURL.groups.href)).text();
    if (html.includes('location.href = "?succ";')) {
      logMsg(tag, logLevels.Valuable, `Merged gems into Zygarde egg!`);
    } else if (html.includes("Your Party is full!")) {
      logMsg(tag, logLevels.Valuable, `Could not merge Zygarde egg because party was full. Will try again tomorrow.`);
      if (await createSpaceInParty()) await handleZygardeQuest();
    } else {
      logErr(tag, html);
    }
  }
}

function viewCauldron() {
  return fetch("https://pokeheroes.com/gem_cauldron", {
    headers: headers,
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

function claimPokegift() {
  return fetch("https://pokeheroes.com/gem_cauldron?claimPokegift", {
    headers: headers,
    referrer: "https://pokeheroes.com/gem_cauldron",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

function initBoiling(stone = 1) {
  return fetch(`https://pokeheroes.com/gem_cauldron?boil=${stone}`, {
    headers: headers,
    referrer: "https://pokeheroes.com/gem_cauldron",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

function viewBoiling(stone = 1) {
  return fetch("https://pokeheroes.com/gem_cauldron?ttc=41", {
    headers: headers,
    referrer: `https://pokeheroes.com/gem_cauldron?boil=${stone}`,
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

function getGem(url = "img/gem_boiler/boiler_v2.php?userid=123&no=0&r=123") {
  return fetch(`https://pokeheroes.com/${url}`, {
    headers: headers,
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

function useGem(gem = "Normal") {
  return fetch("https://pokeheroes.com/includes/ajax/gem_boiler/use_gem_v2.php", {
    headers: headers,
    referrer: "https://pokeheroes.com/gem_cauldron?ttc=41",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: `gem=${gem}`,
    method: "POST",
    mode: "cors",
    credentials: "include",
  });
}

const sizes = {
  2270: "Steel",
  3356: "Dark",
  3574: "Ground",
  3745: "Water",
  3887: "Steel",
  3895: "Normal",
  3918: "Fighting",
  4034: "Ghost",
  4063: "Rock",
  4185: "Grass",
  4212: "Poison",
  4288: "Fire",
  4358: "Bug",
  4464: "Psychic",
  4500: "Electric",
  4535: "Ice",
  4569: "Fairy",
  4597: "Flying",
  1: "Dragon", // TODO: Check correct size.
  1617: "Offet", // TODO: This might be some error and can be ignored.
};

function getURLsFromHTML(html) {
  const regex = /<img[^>]*?boiler[^>]*?src="(?<url>[^"]+)"[^>]*>/g;
  return [...html.matchAll(regex)].map((match) => match.groups.url);
}

// TODO: Check dragon gem image size using console.log. Then check for any specials in Mega Stone boiling.
export async function doCauldron(stone = 1) {
  const html = await (await viewCauldron()).text();
  if (html.includes("And where is my gem product?")) {
    await claimPokegift();
  }
  await (await initBoiling(stone)).text();
  const boilingHTML = await (await viewBoiling(stone)).text();

  const URLs = getURLsFromHTML(boilingHTML);

  console.log(URLs);

  for (const url of URLs) {

    await delay(WAIT_TIMES.HALF_SECOND);
    const blob = await (await getGem(url)).blob();
    const gem = sizes[blob.size] || "Unknown";
    console.log(url, blob.size, gem);
    logMsg(tag, logLevels.Debug, `Found image with size [${blob.size}]. Using [${gem}] gem.`);

    const useHTML = await (await useGem(gem)).text();

    if (!useHTML.includes("gemsuccess")) {
      logErr(tag, `Failed to use gem: ${gem}`, `${url} --- ${blob.size} --- ${useHTML}`);
      return; // Can abort here, since it can't recover.
    }
  }
  logMsg(tag, logLevels.Valuable, `Boiled a [${stone}] stone at cauldron.`);
  // Wait 10 minutes and 1 second and viewCauldron to collect.
  // Or view 2 times at beginning to collect any potential stones
  // TODO: Note that boiling gems only gives stones and puzzle pieces, but doesnt count towards getting the galar region. so we should really try and adopt many eggs first for the gems
}
