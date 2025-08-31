import { headers } from "../a-shared/const.js";
import { logMsg, logErr, logLevels } from "../a-shared/logger.js";
import getConfig from "../a-shared/config.js";
import { load } from "cheerio";

const tag = "BEACH";

async function viewBeach() {
  return fetch("https://pokeheroes.com/beach", {
    headers: headers,
    referrer: "https://pokeheroes.com/",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

async function viewLeah() {
  return fetch("https://pokeheroes.com/mermaid", {
    headers: headers,
    referrer: "https://pokeheroes.com/",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

async function exchangeItem(item = 0, amount = 0) {
  return fetch("https://pokeheroes.com/mermaid", {
    headers: headers,
    referrer: "https://pokeheroes.com/mermaid",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: `exchangeItem=${item}&amount=${amount}`,
    method: "POST",
    mode: "cors",
    credentials: "include",
  });
}

/**
 * Extracts item info from HTML.
 * @param {string} html - The HTML string to parse.
 * @returns {Array<{name: string, id: number, max: number}>}
 * [
    rods...,
    { name: 'Submarine Volcano (Map)', id: 6},
    { name: 'Regular Bait', id: 7},
    { name: 'Tasty Bait', id: 8},
    { name: 'Delicious Bait', id: 9},
    { name: 'Shiny Bait', id: 10},
    { name: 'Relic Silver', id: 11},
    { name: 'Relic Gold', id: 12},
    { name: 'Relic Vase', id: 13},
    { name: 'Relic Band', id: 14},
    { name: 'Relic Statue', id: 15},
    { name: 'Relic Crown', id: 16},
    { name: 'Fisherman Hat', id: 17},
    { name: 'Water Stone', id: 18},
    { name: 'Prism Scale', id: 19},
    { name: 'Mystery Box (Dark Blue)', id: 23},
    { name: 'Big Pearl', id: 29},
    { name: 'Splash Plate', id: 31},
    { name: 'Shoal Salt', id: 36},
    { name: 'Shoal Shell', id: 37},
    { name: 'Magnetic Bait', id: 38}
  ]
 */
function extractItems(html) {
  const $ = load(html);
  const items = [];

  $(".cell_wrapper").each((_, wrapper) => {
    const cells = $(wrapper).find(".bluecell");

    // Get item name (first .bluecell, after the <img>)
    const nameCell = cells.eq(0);
    let name = nameCell.text().split("\n")[0].trim();
    const img = nameCell.find("img").first();
    if (img.length) {
      const node = img[0].nextSibling;
      const textNode = 3;
      if (node && node.nodeType === textNode) {
        name = node.nodeValue.trim();
      }
    }

    // Get id and max from form inputs (third .bluecell)
    const formCellId = 3;
    const formCell = cells.eq(formCellId);
    const id = Number(formCell.find('input[name="exchangeItem"]').attr("value"));
    const max = Number(formCell.find('input[type="number"]').attr("max"));

    if (id) {
      items.push({ name, id, max });
    }
  });

  return items;
}

async function throwRod(rod = 0, bait = -1) {
  return fetch("https://pokeheroes.com/includes/ajax/beach/requestFish.php", {
    headers: headers,
    referrer: "https://pokeheroes.com/beach",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: `rod=${rod}&bait=${bait}`,
    method: "POST",
    mode: "cors",
    credentials: "include",
  });
}

async function catchFish() {
  return fetch("https://pokeheroes.com/includes/ajax/beach/catchFish.php", {
    headers: headers,
    referrer: "https://pokeheroes.com/beach",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

async function eatDish(menu = 0, tip = 0) {
  //0..5,0..100
  return fetch("https://pokeheroes.com/seashellos", {
    headers: headers,
    referrer: "https://pokeheroes.com/seashellos",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: `orderMenu=${menu}&waiterTip=${tip}`,
    method: "POST",
    mode: "cors",
    credentials: "include",
  });
}

async function collectItem(pos = 0) {
  return fetch("https://pokeheroes.com/includes/ajax/beach/claimFlush.php", {
    headers: headers,
    referrer: "https://pokeheroes.com/beach",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: `pos=${pos}`,
    method: "POST",
    mode: "cors",
    credentials: "include",
  });
}

/**
 * Performs a fishing action.
 * @param {number} rod - The ID of the fishing rod to use.
 * @param {number} bait - The ID of the bait to use.
 * @returns {string | null} - A string of the caught fish name, or null if nothing was caught.
 */
async function doFishing(rod, bait) {
  await throwRod(rod, bait);
  const html = await (await catchFish()).text();
  const match = html.match(/catchname">(?<catch>.*?)<\/span>/);
  return match ? match.groups.catch : null;
}

/**
 * Retrieves the remaining fishing energy.
 * @returns {number} - The remaining fishing energy.
 */
async function getRemainingEnergy() {
  const html = await (await viewBeach()).text();
  const match = html.match(/addFishingEnergy\((?<energy>\d+)\)/);
  return match ? parseInt(match.groups.energy, 10) : 0;
}

/**
 * Attempts to order a dish to restore energy.
 * @returns {number} - The ID of the successfully ordered dish, or -1 if no dish could be ordered.
 */
async function orderDish() {
  const highestDishId = 9;
  const tipAmount = 100;
  for (let i = 0; i <= highestDishId; i++) {
    const html = await (await eatDish(i, tipAmount)).text();
    if (html.includes("Thanks for your order")) {
      return i;
    }
  }
  return -1;
}

/**
 * Handles the fishing process, including catching fish, checking energy, and ordering dishes.
 * @param {number} [bait=-1] - The ID of the bait to use.
 */
export async function handleFishing(bait = -1) {
  try {
    const energy = await getRemainingEnergy();
    const minEnergy = 5;
    if (energy < minEnergy) {
      logMsg(tag, logLevels.Interesting, `Not enough energy [${energy}] anymore.`);
      const consumedDish = await orderDish();

      if (consumedDish > -1) {
        logMsg(tag, logLevels.Valuable, `Consumed dish number [${consumedDish + 1}] of 9.`);
        handleFishing();
      } else {
        logMsg(tag, logLevels.Interesting, `And no energy to refill...`);
      }
    } else {
      const rod = (await getConfig("FISHING_ROD_ID")) || 0;
      const caughtFish = await doFishing(rod, bait);

      if (caughtFish) {
        logMsg(tag, logLevels.Interesting, `Caught a [${caughtFish}].`);
      } else {
        logMsg(
          tag,
          logLevels.Valuable,
          `Not been able to a catch a fish despite having more than [${minEnergy}] energy: [${energy}].`,
        );
      }
    }
  } catch (error) {
    logErr(tag, ``, error);
  }
}

/**
 * Handles the collection of items from the beach.
 */
export async function handleCollecting() {
  const collectableSpots = 5;
  try {
    for (let i = 0; i < collectableSpots; i++) {
      await collectItem(i);
    }
    logMsg(tag, logLevels.Interesting, "Checked beach for collectibles.");
  } catch (error) {
    logErr(tag, ``, error);
  }
}

export async function handleLeah() {
  const html = await (await viewLeah()).text();
  const items = extractItems(html);
  // eslint-disable-next-line no-magic-numbers
  const relicIds = [11, 12, 13, 14, 15, 16, 17];
  const tradableRelics = items.filter((item) => relicIds.includes(item.id) && item.max >= 1);

  tradableRelics.forEach((item) => {
    logMsg(tag, logLevels.Valuable, `Exchanging [${item.max}] [${item.name}s] [${item.id}] ...`);
    exchangeItem(item.id, item.max);
  });
}
