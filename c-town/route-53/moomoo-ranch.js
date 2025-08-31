import { headers } from "../../a-shared/const.js";
import { logMsg, logErr, logLevels } from "../../a-shared/logger.js";

const tag = "MOOMOO RANCH";
const MINIMUM_NUMBER_OF_BERRIES = 200;

function feedMiltanks() {
  return fetch("https://pokeheroes.com/moomoo", {
    headers: headers,
    referrer: "https://pokeheroes.com/moomoo",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: "newBerryDel=1&berryDelOran0=250",
    method: "POST",
    mode: "cors",
    credentials: "include",
  });
}

function viewMoomooRanch() {
  return fetch("https://pokeheroes.com/moomoo", {
    headers: headers,
    referrer: "https://pokeheroes.com/",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

function collectMilk(pkmid = 0) {
  return fetch("https://pokeheroes.com/includes/ajax/route/claimMilk.php", {
    headers: headers,
    referrer: "https://pokeheroes.com/moomoo",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: `pkmnid=${pkmid}`,
    method: "POST",
    mode: "cors",
    credentials: "include",
  });
}

/**
 * Check how many berries are remaining to determine if Miltanks have to be fed.
 */
async function checkBerries() {
  try {
    const html = await (await viewMoomooRanch()).text();
    const regex = /<span class="lastDeliveryLeft">(?<remainingBerries>\d+)<\/span>/;
    const match = html.match(regex);
    const remainingBerries = match ? parseInt(match.groups.remainingBerries, 10) : 0;

    if (remainingBerries < MINIMUM_NUMBER_OF_BERRIES) {
      logMsg(tag, logLevels.Interesting, `Remaining berries for Miltanks are [${remainingBerries}] of 250. Feeding.`);
      feedMiltanks();
    }
  } catch (error) {
    logErr(tag, ``, error);
  }
}

/**
 * Gets all the Miltanks on the ranch and their milk status, i.e., if they have milk that can be collected.
 * @returns {Array<{pkmnid: number, milk: number}>} Array of Miltanks and how much milk they have.
 */
async function getMiltanks() {
  try {
    const html = await (await viewMoomooRanch()).text();
    const miltanks = [];
    const regex = /data-pkmnid="(?<pkmnid>\d+)" data-level="\d+" data-milk="(?<milk>\d+)"/g;
    let match;
    while ((match = regex.exec(html)) !== null) {
      const pkmnid = parseInt(match.groups.pkmnid, 10);
      const milk = parseInt(match.groups.milk, 10);

      miltanks.push({
        pkmnid,
        milk,
      });
    }

    return miltanks;
  } catch (error) {
    logErr(tag, ``, error);
    return [];
  }
}

/**
 * Handles the collection of milk and honey from animals.
 */
export async function handleMiltanks() {
  try {
    await checkBerries(); // Instead of checking berries, we could just feed them either way...

    const miltanks = await getMiltanks();
    for (const miltank of miltanks) {
      const milkAmount = miltank.milk;
      for (let i = 0; i < milkAmount; i++) {
        try {
          await collectMilk(miltank.pkmnid);
          logMsg(tag, logLevels.Debug, `Collected milk from [${miltank.pkmnid}], attempt [${i + 1}/${milkAmount}].`);
        } catch (error) {
          logErr(tag, `Error collecting milk from [${miltank.pkmnid}], attempt [${i + 1}/${milkAmount}]:`, error);
        }
      }
    }

    logMsg(tag, logLevels.Interesting, `Checked on Miltanks. Will do again in 1 hour.`);
  } catch (error) {
    logErr(tag, ``, error);
  }
}
