import { headers, rarities, WAIT_TIMES } from "../../a-shared/const.js";
import { logMsg, logLevels, logErr } from "../../a-shared/logger.js";
import getConfig from "../../a-shared/config.js";
import { delay } from "../../a-shared/utils.js";
import { doPrisonRings } from "../../e-events/prison-rings.js";
import { getRequiredRaritiesForAdoption, getRequiredTypesForAdoption } from "../../b-home/paldea-research.js";
import { getRemainingEggStorage, getEggsFromEggStorage, movePokemon, getParty } from "../../b-home/pokemon-storage.js";

const tag = "ROWAN'S LAB";

function ditto() {
  return fetch("https://pokeheroes.com/includes/ajax/lab/ditto.php", {
    headers: headers,
    referrer: "https://pokeheroes.com/lab",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

// Parse the HTML and extract egg data
function getEggsFromHTML(html) {
  const labEggs = [];
  const eggRegex =
    /setLabEgg\((?<pos>\d+),\s*(?<eggid>\d+),\s*(?<sid>\d+),\s*"(?<pkdxnr>[^"]*)",\s*"(?<time>[^"]*)",\s*"(?<type>[^"]*)",\s*"(?<rarity>[^"]*)"\);/g;

  let match;
  while ((match = eggRegex.exec(html)) !== null) {
    const { groups } = match;
    labEggs.push({
      pos: Number(groups.pos),
      eggId: Number(groups.eggid),
      spriteId: Number(groups.sid),
      pokedexNumber: groups.pkdxnr ? Number(groups.pkdxnr) : null,
      timestamp: groups.time,
      type: groups.type || "Unknown",
      rarity: groups.rarity || "Unknown",
    });
  }
  return labEggs;
}

function getYoungestEgg(eggs) {
  return eggs.reduce((youngest, current) => {
    const getAgeInSeconds = (timestamp) => {
      const [value = 0, unit = ""] = timestamp.split(" ");
      const multiplier = unit.toLowerCase().startsWith("minute") ? 60 : 1;
      return parseInt(value, 10) * multiplier;
    };

    if (!youngest) return current;

    const youngestAge = getAgeInSeconds(youngest.timestamp);
    const currentAge = getAgeInSeconds(current.timestamp);

    return currentAge < youngestAge ? current : youngest;
  }, null);
}

async function chooseEggToAdopt(eggs, onlySuperRare) {
  if (onlySuperRare) {
    // Find only super rare eggs (because we have no more space left in party and almost no space elft in egg storage).
    const SUPER_RARE_THRESHOLD = rarities.Special;
    const superRareEggs = eggs.filter((egg) => (rarities[egg.rarity] ?? -Infinity) >= SUPER_RARE_THRESHOLD);
    if (superRareEggs.length === 0) return null;
    return getYoungestEgg(superRareEggs);
  }

  const RARITIES_TO_ADOPT = (await getConfig("ADOPT_RARITIES")) || [];
  let TYPES_TO_ADOPT = (await getConfig("ADOPT_TYPES")) || [];
  const RARITIES_TO_ADOPT_QUEST = await getRequiredRaritiesForAdoption();
  const TYPES_TO_ADOPT_QUEST = await getRequiredTypesForAdoption();

  const MIN_RARITY_TO_ADOPT = rarities[await getConfig("ADOPT_MIN_RARITY")];
  TYPES_TO_ADOPT.push(...TYPES_TO_ADOPT_QUEST);
  RARITIES_TO_ADOPT.push(...RARITIES_TO_ADOPT_QUEST);

  const hasRarity = RARITIES_TO_ADOPT.length > 0;
  TYPES_TO_ADOPT = TYPES_TO_ADOPT.map((type) => type.toLowerCase());
  const hasTypes = TYPES_TO_ADOPT.length > 0;

  const filteredEggs = eggs.filter((egg) => {
    const eggRarityValue = rarities[egg.rarity] ?? 0;
    const rarityMatch = eggRarityValue >= MIN_RARITY_TO_ADOPT || RARITIES_TO_ADOPT.includes(egg.rarity); // Only keep minimum rarity or preferred rarity.
    const typeMatch = TYPES_TO_ADOPT.includes(egg.type); // Keep all preferred types regardless of rarity.
    return rarityMatch || typeMatch;
  });

  if (filteredEggs.length === 0) return null;

  // Step 1: Find eggs with highest or preferred rarity/type.
  const HIGH_RARITY_THRESHOLD = rarities.Alola;

  // 1. Eggs with rarity >= HIGH_RARITY_THRESHOLD. Very rare eggs are always preferred.
  const veryRareEggs = filteredEggs.filter((egg) => (rarities[egg.rarity] ?? -Infinity) >= HIGH_RARITY_THRESHOLD);

  // 2. Eggs matching both type and rarity
  const bothMatch = filteredEggs.filter(
    (egg) => hasTypes && hasRarity && TYPES_TO_ADOPT.includes(egg.type) && RARITIES_TO_ADOPT.includes(egg.rarity),
  );

  // 3. Eggs matching type (if multiple, prefer highest rarity)
  const typeMatch = filteredEggs.filter((egg) => hasTypes && TYPES_TO_ADOPT.includes(egg.type));
  const typeMaxRarity = Math.max(...typeMatch.map((egg) => rarities[egg.rarity] ?? -Infinity));
  const rareTypeEggs = typeMatch.filter((egg) => (rarities[egg.rarity] ?? -Infinity) === typeMaxRarity);

  // 4. Eggs matching rarity
  const rarityMatch = filteredEggs.filter((egg) => hasRarity && RARITIES_TO_ADOPT.includes(egg.rarity));

  // 5. Eggs with highest rarity (fallback in case no preferred eggs are present)
  const maxRarityValue = Math.max(...filteredEggs.map((egg) => rarities[egg.rarity] ?? -Infinity));
  const maxRarityEggs = filteredEggs.filter((egg) => (rarities[egg.rarity] ?? -Infinity) === maxRarityValue);

  // Pick the first non-empty set, in order of preference
  const preferredEggs = veryRareEggs.length
    ? veryRareEggs
    : bothMatch.length
      ? bothMatch
      : rareTypeEggs.length
        ? rareTypeEggs
        : rarityMatch.length
          ? rarityMatch
          : maxRarityEggs;

  // Step 2: Find the youngest egg because the others don't seem as desired I guess. We have to choose somehow.
  const youngestEgg = getYoungestEgg(preferredEggs);

  return youngestEgg;
}

function viewLabEggs() {
  return fetch("https://pokeheroes.com/includes/ajax/lab/load_tablev2.php", {
    headers: headers,
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

function adopt(adopt = 0, pos = 0) {
  return fetch(`https://pokeheroes.com/lab?adopt=${adopt}&pos=${pos}`, {
    headers: headers,
    referrer: "https://pokeheroes.com/lab",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

async function findEggToAdoptFromLab(onlySuperRare) {
  // It takes 10 seconds for the type to show with best equipment.
  // It takes 40 seconds for the rarity to show with best equipment.
  // Sometimes, an egg is not adopted for more than 5 minutes.
  // So ideally, we wait for at least 10 seconds and at most 40 seconds between checks.
  // BUT: The rarest eggs might be snatched away in 3 seconds. So we should check every 5 seconds as a compromise.
  const maxAttempts = 12;
  const totalTimeMs = WAIT_TIMES.FIFTY_SECONDS; // Function runs every minute, so it should be done within a a bit less than that.
  const delayPerAttempt = totalTimeMs / maxAttempts;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const html = await (await viewLabEggs()).text();
    const labEggs = getEggsFromHTML(html);
    const egg = await chooseEggToAdopt(labEggs, onlySuperRare);

    if (egg) {
      return egg;
    }

    logMsg(tag, logLevels.Debug, `No egg to adopt. Attempt ${attempt} of ${maxAttempts}.`);
    if (attempt < maxAttempts) {
      await delay(delayPerAttempt);
    }
  }

  logMsg(tag, logLevels.Debug, `No egg to adopt after ${maxAttempts} attempts.`);
  return null;
}

export async function createSpaceInParty(party) {
  if (!party) party = await getParty();
  if ((await getRemainingEggStorage()) === 0) {
    logMsg(tag, logLevels.Important, `Egg storage is full. Cannot create space in party.`);
    return false;
  }
  const eggToStore = party
    .filter((pokemon) => pokemon.isEgg)
    .reduce((max, egg) => (egg.expOrEhpMissing > (max?.expOrEhpMissing ?? -Infinity) ? egg : max), null);
  await movePokemon(-1, eggToStore.pkmnid);
  return true;
}

async function adoptEggFromLab(partyIsFull, remainingEggStorage, party) {
  while (true) {
    const minStorageSpace = 2;
    const onlySuperRare = partyIsFull && remainingEggStorage <= minStorageSpace; // Only adopt super rare eggs if party is full and egg storage is almost full.
    const eggFromLab = await findEggToAdoptFromLab(onlySuperRare);
    // MAybe don't just search for super rare. Maybe adopt normally and hope the egg storage is big enough to eventually get emptied again.
    if (!eggFromLab) {
      logMsg(tag, logLevels.Debug, `No egg to adopt found in lab.`);
      return false;
    }

    if (partyIsFull && remainingEggStorage > 0) {
      logMsg(tag, logLevels.Debug, `Found an egg, but party is full. Creating space in party.`);
      await createSpaceInParty(party); // Move egg that takes longest to hatch from party to egg storage.
    }

    const response = await adopt(eggFromLab.eggId, eggFromLab.pos);
    const html = await response.text();

    if (html.includes("The chosen egg was placed in your party!")) {
      logMsg(
        tag,
        rarities[eggFromLab.rarity] > rarities.Rare ? logLevels.Valuable : logLevels.Debug,
        `An egg was adopted. Rarity: [${eggFromLab.rarity}], Type: [${eggFromLab.type}], ID: [${eggFromLab.eggId}].`,
      );
      return true;
    }

    if (html.includes("Your party is full!")) {
      logMsg(tag, logLevels.Debug, `Party was already full. No Pokémon adopted.`);
      return false; // Should not happen due to earlier check.
    }

    if (html.includes("Another user was faster than you.")) {
      logMsg(
        tag,
        logLevels.Debug,
        `Couldn't adopt egg, because someone else "was faster". [${eggFromLab.eggId}][${eggFromLab.pos}] Retrying...`,
      );
      await delay(WAIT_TIMES.ONE_SECOND);
      continue; // Retry loop if someone else snatched the good egg.
    }

    logErr(tag, `Unknown response when trying to adopt an egg from lab.`, html);
    return false;
  }
}

async function adoptEggFromOtherSources(party) {
  const hoopaNumber = 720;
  const maxHoopaInParty = await getConfig("PARTY_MAX_HOOPA");
  const hoopaCount = party.filter((p) => p.image === hoopaNumber).length;

  if (hoopaCount >= maxHoopaInParty) {
    logMsg(tag, logLevels.Debug, `[${hoopaCount}] >= [${maxHoopaInParty}] Hoopas in party. Skipping doPrisonRings.`);
  } else if (await doPrisonRings()) {
    return true; // Got a Hoopa egg.
  }

  const eggsInStorage = await getEggsFromEggStorage();
  if (eggsInStorage.length > 0) {
    const minEgg = eggsInStorage.reduce(
      (min, egg) => (egg.missingEHP < (min?.missingEHP ?? Infinity) ? egg : min),
      null,
    );
    await movePokemon(0, minEgg.pkmnid);
    logMsg(tag, logLevels.Debug, `Retrieved an egg from egg storage. ID: [${minEgg.pkmnid}].`);
    return true;
  }

  logMsg(tag, logLevels.Debug, `No eggs available from other sources.`);
  return false;
}

export async function adoptEgg(party = []) {
  const partySize = party.length;
  const MAX_PARTY_SIZE = await getConfig("PARTY_MAX_SIZE");
  const partyIsFull = partySize >= MAX_PARTY_SIZE;
  const remainingEggStorage = await getRemainingEggStorage();

  if (partyIsFull && remainingEggStorage === 0) {
    logMsg(
      tag,
      logLevels.Debug,
      `Party has [${partySize} >= ${MAX_PARTY_SIZE}] Pokémon and egg storage is full. Not adopting any Pokémon.`,
    );
    return;
  }

  const adoptedFromLab = await adoptEggFromLab(partyIsFull, remainingEggStorage, party);
  if (adoptedFromLab || partyIsFull) return;

  await adoptEggFromOtherSources(party);
}

export async function clickDitto() {
  await ditto(); // No return value. You either get a plushie or not and only know by checking gift log.
}
