import getConfig from "../a-shared/config.js";
import { headers } from "../a-shared/const.js";
import { logMsg, logLevels } from "../a-shared/logger.js";
import { createSpaceInParty } from "../c-town/rowan-lab/adoption.js";
import { addBoxDataDetails, getEggsFromEggStorage, getParty } from "./pokemon-storage.js";

const tag = "PALDEA";

function checkPaldeaResearch() {
  return fetch(`https://pokeheroes.com/paldearesearch`, {
    headers: headers,
    referrer: "https://pokeheroes.com/",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

function startPaldeaResearch(event = "past") {
  return fetch(`https://pokeheroes.com/paldearesearch?explore_event=${event}`, {
    headers: headers,
    referrer: "https://pokeheroes.com/paldearesearch",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

function claimPoints(task = 0) {
  return fetch(`https://pokeheroes.com/paldearesearch?claim=${task}`, {
    headers: headers,
    referrer: "https://pokeheroes.com/paldearesearch",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

function claimPokemon(pkmn = 0) {
  return fetch(`https://pokeheroes.com/paldearesearch?claimPkmn=${pkmn}`, {
    headers: headers,
    referrer: "https://pokeheroes.com/paldearesearch",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

function skipTask(task = 0) {
  return fetch(`https://pokeheroes.com/paldearesearch?skip=${task}`, {
    headers: headers,
    referrer: "https://pokeheroes.com/paldearesearch",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

function parseResearchTasks(html) {
  // Regex for each task table
  const taskRegex = /<table id="blue_table"[\s\S]+?<\/table>/g;

  const tasks = [];
  let match;

  while ((match = taskRegex.exec(html)) !== null) {
    const tableHtml = match[0];

    // Check for waiting placeholder
    if (/wait/i.test(tableHtml)) {
      tasks.push({ waiting: true });
      continue;
    }

    const tdMatch = tableHtml.match(/<td[^>]*>(?<cell>[\s\S]+?)<\/td>/i);
    if (!tdMatch || !tdMatch.groups) {
      // Could not find a table cell
      return;
    }
    const cellHtml = tdMatch.groups.cell;

    // This regex makes the skip link part optional
    const detailMatch = cellHtml.match(
      // Id and skip are optional; desc and points are always present
      // TODO: If skip is not present (because something was skipped recently), the ID might be in "Claim Points". At the moment, no task can be comleted when one is being skipped.
      // TODO: Add a second id, the claimID. If present, task can be completed.
      /(?:<div[^>]*>\s*<a href="\?skip=(?<id>\d+)"[^>]*>X<\/a>.*?<\/div>)?\s*(?<desc>.+?)<br><br>[\s\S]+?<b>(?<points>\d+) Research Points<\/b>/i,
    );

    if (!detailMatch || !detailMatch.groups) {
      continue;
    }

    const { id, desc, points } = detailMatch.groups;

    // Check for claim/completion link (only if id is present)
    let canComplete = false;
    if (id) {
      canComplete = new RegExp(`<a href="\\?claim=${id}">Claim Points<\\/a>`, "i").test(tableHtml);
    }

    // Extract progress (x/y)
    const progressMatch = desc.match(/(?<current>\d+)\s*\/\s*(?<total>\d+)/);
    const progress = progressMatch
      ? {
          current: Number(progressMatch.groups.current),
          total: Number(progressMatch.groups.total),
        }
      : null;

    // Task type and details
    let type = null;
    let details = {};

    // Hatch any eggs
    const hatchAnyEggsMatch = desc.match(/Hatch\s+\d+\s*\/\s*\d+\s+Eggs/i);
    if (hatchAnyEggsMatch) {
      type = "hatch_any";
      details = { rarity: "Easy" };
    }

    // Hatch Rarity eggs
    if (!type) {
      const hatchRarityMatch = desc.match(/Hatch\s+\d+\s*\/\s*\d+\s+(?<rarity>\w+)\s*\(Rarity\)\s*Eggs/i);
      if (hatchRarityMatch) {
        type = "hatch_rarity";
        details = { rarity: hatchRarityMatch.groups?.rarity };
      }
    }

    // Hatch X / Y TYPE-type Eggs
    const hatchTypeMatch = desc.match(/Hatch\s+\d+\s*\/\s*\d+\s+(?<eggType>\w+)-type Eggs/i);
    if (hatchTypeMatch && hatchTypeMatch.groups) {
      type = "hatch_type";
      details = { eggType: hatchTypeMatch.groups.eggType };
    }

    // Hatch X / Y RARITY (Rarity) Eggs
    const hatchRarityMatch = desc.match(/Hatch\s+\d+\s*\/\s*\d+\s+(?<rarity>\w+)\s+\(Rarity\) Eggs/i);
    if (hatchRarityMatch && hatchRarityMatch.groups) {
      type = "hatch_rarity";
      details = { rarity: hatchRarityMatch.groups.rarity };
    }

    // Hatch specific Pokémon eggs
    if (!type) {
      const hatchPokemonMatch = desc.match(/Hatch\s+\d+\s*\/\s*\d+\s+(?<pokemon>[A-Za-z.\-'\s]+)\s+Eggs/i);
      if (hatchPokemonMatch) {
        type = "hatch_pokemon";
        details = { pokemon: hatchPokemonMatch.groups.pokemon.trim() };
      }
    }

    // Evolve X / Y originally ... via METHOD.
    const evolveAnyMatch = desc.match(/Evolve\s+\d+\s*\/\s*\d+ originally[^"]+(?:via|using) (?<method>[\w-]+)/i);
    if (evolveAnyMatch && evolveAnyMatch.groups) {
      type = "evolve_rarity";
      details = {
        rarity: "Easy",
        method: evolveAnyMatch.groups.method,
      };
    }

    // Evolve X / Y Pokémon of the RARITY-Rarity ... via METHOD.
    const evolveRarityMatch = desc.match(
      /Evolve\s+\d+\s*\/\s*\d+\s+Pokémon of the (?<rarity>\w+)-Rarity[^"]+via (?<method>[\w-]+)/i,
    );
    if (evolveRarityMatch && evolveRarityMatch.groups) {
      type = "evolve_rarity";
      details = {
        rarity: evolveRarityMatch.groups.rarity,
        method: evolveRarityMatch.groups.method,
      };
    }

    // If no type matched, use a generic placeholder
    if (!type) {
      type = "unknown";
      details = { description: desc.trim() };
    }

    tasks.push({
      id: id || null,
      canComplete,
      type,
      ...details,
      points: Number(points),
      progress,
      waiting: false,
    });
  }

  return tasks;
}

export async function handlePaldeaResearch() {
  const html = await (await checkPaldeaResearch()).text();

  if (html.includes("Here is your reward. Take good care of it!")) {
    const match = html.match(/<a href="\?claimPkmn=(?<id>\d+)">Claim Reward<\/a>/i);

    if (match && match.groups) {
      const claimPkmnId = match.groups.id;
      const html2 = await (await claimPokemon(claimPkmnId)).text();
      if (html2.includes("Please come back when you have an empty spot in your party!")) {
        logMsg(tag, logLevels.Valuable, `Completed research but had no space in party.`);
        if (await createSpaceInParty()) await handlePaldeaResearch();
        return;
      } else {
        logMsg(tag, logLevels.Valuable, `Completed research and claimed a reward with id [${claimPkmnId}].`);
        await handlePaldeaResearch();
      }
    }
  }

  const research = await getConfig("DO_PALDEA_RESEARCH");
  if (!research || research === "None") return;

  if (html.includes("has a new research task for you")) {
    await startPaldeaResearch(research);
    await handlePaldeaResearch();
  }

  const tasks = parseResearchTasks(html);
  for (const task of tasks) {
    if (task.canComplete) {
      await claimPoints(task.id);
      logMsg(
        tag,
        logLevels.Interesting,
        `Completed task [${task.id}] with type [${task.type}] for [${task.points}] points.`,
      );
      await handlePaldeaResearch(); // Immedeately check new tasks in case a new task has to be skipped.
    }

    if (task.type === "hatch_pokemon" || task.type === "evolve_rarity") {
      await skipTask(task.id);
      logMsg(tag, logLevels.Interesting, `Skipped task [${task.id}] with type [${task.type}].`);
    }
  }

  return;
}

export async function getRequiredRaritiesForAdoption() {
  const html = await (await checkPaldeaResearch()).text();
  const tasks = parseResearchTasks(html);
  const requiredRarities = [];

  for (const task of tasks) {
    // Only consider hatch_rarity tasks that are not complete
    if ((task.type === "hatch_rarity" || task.type === "hatch_any") && !task.canComplete) {
      // Get party and egg storage Pokémon, including their rarity.
      const party = await addBoxDataDetails(await getParty());
      const eggsFromEggStorage = await addBoxDataDetails(await getEggsFromEggStorage());

      // Count how many eggs have the task.rarity
      const countInParty = party.filter((p) => p.rarity === task.rarity).length;
      const countInStorage = eggsFromEggStorage.filter((e) => e.rarity === task.rarity).length;
      const eggsWithRarity = countInParty + countInStorage;

      const missing = task.progress.total - task.progress.current;
      if (missing > eggsWithRarity) requiredRarities.push(task.rarity);
      // Else: Already have enough eggs of that rarity in party and egg storage. Not adopting any more.
    }
  }

  return requiredRarities;
}

export async function getRequiredTypesForAdoption() {
  const html = await (await checkPaldeaResearch()).text();
  const tasks = parseResearchTasks(html);
  const requiredTypes = [];

  for (const task of tasks) {
    // Only consider hatch_type tasks that are not complete
    if (task.type === "hatch_type" && !task.canComplete) {
      requiredTypes.push(task.eggType);
    }
  }

  return requiredTypes;
}
