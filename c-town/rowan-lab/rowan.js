import { headers } from "../../a-shared/const.js";
import { sendMail } from "../../a-shared/email.js";
import { logMsg, logLevels } from "../../a-shared/logger.js";

const tag = "ROWAN";

function checkRowanQuest() {
  return fetch(`https://pokeheroes.com/lab`, {
    headers: headers,
    referrer: "https://pokeheroes.com/",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

function continueTask() {
  return fetch(`https://pokeheroes.com/lab?taskCont`, {
    headers: headers,
    referrer: "https://pokeheroes.com/lab",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

function _claimPkdxcompGift(region = "Johto") {
  return fetch(`https://pokeheroes.com/lab?pkdxcomp=${region}`, {
    headers: headers,
    referrer: "https://pokeheroes.com/lab",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

export async function rowanQuest() {
  const html = await (await checkRowanQuest()).text();
  const headlines = [...html.matchAll(/<h[1-6][^>]*class="headline1"[^>]*>(?<headline>[\s\S]*?)<\/h[1-6]>/g)];
  const numberOfHeadlines = headlines?.length;
  const usualNumberOfHeadlines = 4;
  const specialHeadline = 2;
  const thirdHeadline = headlines[specialHeadline]?.groups?.headline.trim();
  if (numberOfHeadlines > usualNumberOfHeadlines && !thirdHeadline?.includes("The Mischief Pokémon")) {
    logMsg(
      tag,
      logLevels.Important,
      `Number of headlines is [${numberOfHeadlines}] with new headline [${thirdHeadline}].`,
    );
    sendMail(
      "Rowan Quest",
      `You have [${numberOfHeadlines}] headlines in the lab, which indicates an active quest. Headline is [${thirdHeadline}].`,
    );
  }
}

export async function checkLostItemQuest() {
  // TODO: Was only relevant for like two weeks, so should not be called for every rumble mission...
  const html = await (await checkRowanQuest()).text();
  const regex = /<h3 class="headline1">\s*The lost item\s*<\/h3>\s*<p class="normaltext">(?<para>[\s\S]*?)<\/p>/i;
  const match = html.match(regex);

  let rumbleArea = null;

  if (match?.groups?.para) {
    const para = match.groups.para;

    // First stagge
    let areaMatch = para.match(/in the <b>(?<area>[^<]+)<\/b>/i);

    // Second stage
    if (!areaMatch?.groups?.area) {
      areaMatch = para.match(/to the <b>(?<area>[^<]+)<\/b>/i);
    }

    if (areaMatch?.groups?.area) {
      rumbleArea = areaMatch.groups.area.trim();
    }

    return rumbleArea;
  } else if (html.includes('href="?taskCont"')) {
    const html = await (await continueTask()).text();
    console.log(html);
  }

  return null;
}
