import { headers } from "../../a-shared/const.js";
import { logMsg, logErr, logLevels } from "../../a-shared/logger.js";

const tag = "HONEYCOMBS";

function viewHoneycombs() {
  return fetch("https://pokeheroes.com/honeycomb", {
    headers: headers,
    referrer: "https://pokeheroes.com/",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

function collectHoney(pkmid = 0) {
  return fetch("https://pokeheroes.com/includes/ajax/route/claimHoney.php", {
    headers: headers,
    referrer: "https://pokeheroes.com/honeycomb",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: `comb=${pkmid}`,
    method: "POST",
    mode: "cors",
    credentials: "include",
  });
}

function clickGurrDur(id = 0) {
  return fetch(`https://pokeheroes.com/honeycomb?gur=${id}`, {
    headers: headers,
    referrer: "https://pokeheroes.com/honeycomb",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

/**
 * Gets all the Combees on the honeycomb and their honey status, i.e., if they have honey that can be collected.
 * @returns {Promise<Array<{pkmnid: number, honey: number}>>} Array of Combees and how much honey they have.
 */
async function getCombees() {
  try {
    const html = await (await viewHoneycombs()).text();

    if (html.includes('class="gurrDur"')) {
      const match = html.match(/\?gur=(?<id>\d+)/);
      if (match && match.groups) {
        const id = match.groups.id;
        logMsg(tag, logLevels.Valuable, `Found gurrDur with id [${id}]. Clicking to get new honeycomb.`);
        await clickGurrDur(id);
      }
    }

    const combees = [];
    const regex = /data-pkmnid="(?<pkmnid>\d+)" data-honey="(?<honey>\d+)"/g;
    let match;
    while ((match = regex.exec(html)) !== null) {
      const pkmnid = parseInt(match.groups.pkmnid, 10);
      const honey = parseInt(match.groups.honey, 10);

      combees.push({
        pkmnid,
        honey,
      });
    }

    return combees;
  } catch (error) {
    logErr(tag, ``, error);
    return [];
  }
}

/**
 * Handles the collection of milk and honey from animals.
 */
export async function handleCombees() {
  try {
    const maxCombees = 5;
    const combees = await getCombees();
    if (combees.length < maxCombees) return; // Until Gurdurr was there twice, wait with collecting honey.
    for (const combee of combees) {
      const honeyAmount = combee.honey;
      for (let i = 0; i < honeyAmount; i++) {
        try {
          await collectHoney(combee.pkmnid);
          logMsg(tag, logLevels.Debug, `Collected honey from [${combee.pkmnid}], attempt [${i + 1}/${honeyAmount}].`);
        } catch (error) {
          logErr(tag, `Error collecting milk from [${combee.pkmnid}], attempt [${i + 1}/${honeyAmount}]:`, error);
        }
      }
    }

    logMsg(tag, logLevels.Interesting, `Checked on Combees. Will do again in 1 hour.`);
  } catch (error) {
    logErr(tag, ``, error);
  }
}
