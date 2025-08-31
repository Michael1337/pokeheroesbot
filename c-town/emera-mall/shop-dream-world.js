import { headers, WAIT_TIMES } from "../../a-shared/const.js";
import { logMsg, logErr, logLevels } from "../../a-shared/logger.js";
import { load } from "cheerio";
import { delay } from "../../a-shared/utils.js";

const tag = "DREAM WORLD SHOP";
const GEM_EXCHANGE_TASK = 3;
const LAST_TASK = 30;
const DEFAULT_PLUSHIE_VALUE = 50;
const PLUSHIE_SUM_VALUE = 750;
const PLUSHIES_TO_BUY = PLUSHIE_SUM_VALUE / DEFAULT_PLUSHIE_VALUE;
const LOWEST_VALUE = 5;

/**
 * Claims Dream World points for a given task.
 * @param {number} task - The task ID to claim (default: 0)
 * @returns {Promise<Response>} - A Promise that resolves to the fetch response.
 */
async function claimDWPoints(task = 0) {
  const url = `https://pokeheroes.com/dw_shop?claim=${task}`;
  logMsg(tag, logLevels.Debug, `Attempting to claim task ${task}`);
  return fetch(url, {
    headers: headers,
    referrer: "https://pokeheroes.com/dw_shop",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

async function sendPlushie(username = null, plushie = "01") {
  return fetch(`https://pokeheroes.com/dw_shop?username=${username}`, {
    headers: headers,
    referrer: `https://pokeheroes.com/dw_shop?username=${username}`,
    referrerPolicy: "strict-origin-when-cross-origin",
    body: `recSpec=0&recipient=${username}&randomSelect=random&plushie=${plushie}&msg=`,
    method: "POST",
    mode: "cors",
    credentials: "include",
  });
}

async function sendPlushieRandom(user = "random", plushie = "01") {
  // Random/new/friend (?)
  return fetch("https://pokeheroes.com/dw_shop", {
    headers: headers,
    referrer: "https://pokeheroes.com/dw_shop",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: `recipient=&recSpec=1&randomSelect=${user}&plushie=${plushie}&msg=`,
    method: "POST",
    mode: "cors",
    credentials: "include",
  });
}

async function getGiftLog(username) {
  return fetch(`https://www.pokeheroes.com/dw_gift_log?username=${username}`, {
    headers: headers,
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

async function getMissingPlushies(username) {
  return fetch("https://www.pokeheroes.com/includes/ajax/dw_shop/missing.php", {
    headers: headers,
    referrer: `https://www.pokeheroes.com/dw_shop?username=${username}`,
    body: `username=${username}`,
    method: "POST",
    mode: "cors",
    credentials: "include",
  });
}

async function getFavoritePlushies(username) {
  return fetch("https://www.pokeheroes.com/includes/ajax/dw_shop/favorites.php", {
    headers: headers,
    referrer: `https://www.pokeheroes.com/dw_shop?username=${username}`,
    body: `username=${username}`,
    method: "POST",
    mode: "cors",
    credentials: "include",
  });
}

/**
 * Handles the Dream World Shop tasks by claiming points.
 */
export async function handleDWShop() {
  try {
    const claimPromises = [];
    for (let i = 0; i <= LAST_TASK; i++) {
      if (i !== GEM_EXCHANGE_TASK) {
        claimPromises.push(claimDWPoints(i));
      }
    }

    // Run all claims concurrently
    await Promise.all(claimPromises);

    logMsg(tag, logLevels.Interesting, `Claimed points, waiting an hour to claim again.`);
  } catch (error) {
    logErr(tag, ``, error);
  }
}

function getRandomPlushie(value = DEFAULT_PLUSHIE_VALUE) {
  // Flatten all plushie arrays from all regions into one array
  /* eslint-disable-next-line no-use-before-define */
  const allPlushies = Object.values(plushies).flat();

  const valueIndex = 2;
  const soldOutIndex = 3;
  const plushiesWithValue = allPlushies.filter((p) => p[valueIndex] === value && p[soldOutIndex] === -1);

  if (plushiesWithValue.length === 0) {
    return null;
  }

  const randomIndex = Math.floor(Math.random() * plushiesWithValue.length);
  const [id, , val, , name] = plushiesWithValue[randomIndex];
  return {
    id: id,
    value: val,
    name: name,
  };
}

export async function doSendPlushieRandomNew() {
  for (let i = 0; i < PLUSHIES_TO_BUY; i++) {
    const randomPlushie = getRandomPlushie(DEFAULT_PLUSHIE_VALUE);
    const html = await (await sendPlushieRandom("new", randomPlushie.id)).text();
    const match = html.match(/The Plushie has been sent to (?<username>.+?) successfully!/);
    if (match && match.groups) {
      logMsg(
        tag,
        logLevels.Valuable,
        `Successfully sent a plushie [${randomPlushie.name}] to [${match.groups.username}].`,
      );
    } else {
      console.log(html);
    }
  }
}

export async function doSendPlushieRandomNewVal(value = LOWEST_VALUE) {
  const randomPlushie = getRandomPlushie(value);
  const html = await (await sendPlushieRandom("new", randomPlushie.id)).text();
  const match = html.match(/The Plushie has been sent to (?<username>.+?) successfully!/);
  if (match && match.groups) {
    logMsg(
      tag,
      logLevels.Valuable,
      `Successfully sent a plushie [${randomPlushie.name}] to [${match.groups.username}].`,
    );
  } else {
    console.log(html);
  }
}

function parseTimeToMinutes(timeStr) {
  const minutesPerHour = 60;
  const hoursPerDay = 24;
  timeStr = timeStr.trim().toLowerCase();
  if (timeStr.includes("second")) return 1;
  const num = parseInt(timeStr, 10);
  if (timeStr.includes("minute")) return num;
  if (timeStr.includes("hour")) return num * minutesPerHour;
  if (timeStr.includes("day")) return num * hoursPerDay * minutesPerHour;
  const largeDefaultValue = 10000;
  return largeDefaultValue;
}

function getGiftLogFromHTML(html) {
  const $ = load(html);
  const colsPerRow = 4;

  const rows = [];

  $("#blue_table tr").each((i, tr) => {
    // Skip the header row
    if (i === 0) return;

    const tds = $(tr).find("td");
    if (tds.length < colsPerRow) return; // Skip incomplete/malformed rows

    const plushieImg = $(tds[0]).find("img").attr("src") || "";
    // Plushie id is usually the PNG file name, e.g. 0492.png
    const plushieIdMatch = plushieImg.match(/\/(?<id>\w+)\.png/);
    const plushieId = (plushieIdMatch ?? plushieIdMatch.groups) ? plushieIdMatch.groups.id : null;

    const username = $(tds[1]).find("a").first().text().trim();

    // Extract the plain message from possible nested HTML
    const messageCol = 2;
    const messageHtml = $(tds[messageCol]).html();
    let message = "";
    if (messageHtml) {
      // Get text within <body>...</body> only if present, else fallback to plain text
      const $msg = load(messageHtml);
      message = $msg("body").text().trim();
    }

    const timeCol = 3;
    const timeText = $(tds[timeCol]).text().trim();
    const minutes = parseTimeToMinutes(timeText);

    rows.push({
      plushieId: plushieId,
      username: username,
      message: message,
      minutesAgo: minutes,
    });
  });

  return rows;
}

function getRewardInfoFromHTML(html) {
  const $ = load(html);

  // Get plushie id from the img between h2 and greenfield
  const h2 = $("h2.headline1");
  const plushieImg = h2.nextAll("center").find("img").attr("src") || "";
  const plushieIdMatch = plushieImg.match(/\/(?<id>\w+)\.png/);
  const plushieId = (plushieIdMatch ?? plushieIdMatch.groups) ? plushieIdMatch.groups.id : null;

  const greenfield = $("#greenfield");
  const greenfieldMessage = greenfield?.html() || null;
  const greenfieldImportant = greenfieldMessage?.split("<br>")[0]?.replace(/\n/g, "")?.trim();

  const redfield = $("#redfield");
  const redfieldMessage = redfield?.html()?.replace(/\n/g, " ")?.trim() || null;

  // Count the number of gem images inside greenfield
  const gems = greenfield.find("img").length;

  return {
    plushieId,
    greenfieldMessage: greenfieldImportant,
    redfieldMessage: redfieldMessage,
    gemCount: gems,
  };
}

async function trySendPlushie(username, plushies, label) {
  if (!Array.isArray(plushies) || plushies.length === 0) return false;

  const valueIndex = 2;
  const maxValue = 100;
  const outOfStockIndex = 3;
  const plushie = plushies.find((arr) => arr[valueIndex] <= maxValue && arr[outOfStockIndex] === -1);
  if (!plushie) return false;

  const html = await (await sendPlushie(username, plushie[0])).text();
  const reward = getRewardInfoFromHTML(html);

  if (reward.redfieldMessage) {
    logErr(tag, `Could not send plushie [${plushie[0]}] to [${username}].`, reward.redfieldMessage);
    return false;
  }

  logMsg(
    tag,
    logLevels.Valuable,
    `Sent ${label}. [${reward.greenfieldMessage}] Received [${reward.gemCount}] for a [${reward.plushieId}].`,
  );
  return true;
}

async function returnGift(username) {
  const missingPlushies = (await (await getMissingPlushies(username)).json()).Pkdxnr;
  if (await trySendPlushie(username, missingPlushies, "missing")) return;

  const favoritePlushies = (await (await getFavoritePlushies(username)).json()).Pkdxnr;
  if (await trySendPlushie(username, favoritePlushies, "favorite")) return;

  // Otherwise, gifting user already has all plushies and no affordable favorite.
  // Could send a random popular plushie.
}

export async function handleReturnMissingPlushies() {
  const checkIntervalMinutes = 59;
  const html = await (await getGiftLog(process.env.APP_USERNAME)).text();
  const giftLog = getGiftLogFromHTML(html).filter(
    (item) => item.username !== process.env.APP_USERNAME && item.minutesAgo <= checkIntervalMinutes,
  );

  if (giftLog.length === 0) return;

  for (const gift of giftLog) {
    await returnGift(gift.username);
    await delay(WAIT_TIMES.ONE_SECOND); // In case a user sent like 20 plushies in one hour and would get 20 plushies in one second.
  }
}

/* eslint-disable no-magic-numbers */
const plushies = {
  Kanto: [
    ["01", 1, 50, -1, "bulbasaur"],
    ["02", 1, 60, -1, "ivysaur"],
    ["03", 1, 70, -1, "venusaur"],
    ["13", 1, 900, -1, "shiny venusaur"],
    ["04", 1, 50, -1, "charmander"],
    ["05", 1, 60, -1, "charmeleon"],
    ["06my", 1, 100, -1, "mega charizard y"],
    ["06mx", 1, 100, -1, "mega charizard x"],
    ["06", 1, 70, -1, "charizard"],
    ["16", 1, 900, -1, "shiny charizard"],
    ["07", 1, 50, -1, "squirtle"],
    ["08", 1, 60, -1, "wartortle"],
    ["09", 1, 70, -1, "blastoise"],
    ["19", 1, 900, -1, "shiny blastoise"],
    ["010", 1, 10, -1, "caterpie"],
    ["012", 1, 40, -1, "butterfree"],
    ["013", 1, 15, -1, "weedle"],
    ["015", 1, 40, -1, "beedrill"],
    ["016", 1, 10, -1, "pidgey"],
    ["017", 1, 25, -1, "pidgeotto"],
    ["018", 1, 40, -1, "pidgeot"],
    ["118", 1, 500, -1, "shiny pidgeot"],
    ["019", 1, 15, -1, "rattata"],
    ["020", 1, 30, -1, "raticate"],
    ["021", 1, 15, -1, "spearow"],
    ["022", 1, 30, -1, "fearow"],
    ["023", 1, 20, -1, "ekans"],
    ["024", 1, 30, -1, "arbok"],
    ["025a", 1, 100, 0, "breloochu"],
    ["025c", 1, 100, 0, "pumpkachu"],
    ["025b", 1, 100, 0, "tyranichu"],
    ["026", 1, 60, -1, "raichu"],
    ["026a", 1, 70, -1, "raichu (alolan)"],
    ["027", 1, 40, -1, "sandshrew"],
    ["028", 1, 40, -1, "sandslash"],
    ["029", 1, 20, -1, "nidoran (f)"],
    ["030", 1, 30, -1, "nidorina"],
    ["031", 1, 40, -1, "nidoqueen"],
    ["032", 1, 20, -1, "nidoran (m)"],
    ["033", 1, 30, -1, "nidorino"],
    ["034", 1, 40, -1, "nidoking"],
    ["035", 1, 20, -1, "clefairy"],
    ["036", 1, 40, -1, "clefable"],
    ["037a", 1, 40, -1, "vulpix (alolan)"],
    ["037", 1, 20, -1, "vulpix"],
    ["037w", 1, 75, 0, "witch vulpix"],
    ["038", 1, 40, -1, "ninetales"],
    ["039", 1, 20, -1, "jigglypuff"],
    ["040", 1, 40, -1, "wigglytuff"],
    ["041", 1, 10, -1, "zubat"],
    ["042", 1, 20, -1, "golbat"],
    ["043", 1, 15, -1, "oddish"],
    ["044", 1, 40, -1, "gloom"],
    ["045", 1, 60, -1, "vileplume"],
    ["046", 1, 20, -1, "paras"],
    ["047", 1, 35, -1, "parasect"],
    ["048", 1, 30, -1, "venonat"],
    ["049", 1, 40, -1, "venomoth"],
    ["050", 1, 20, -1, "diglett"],
    ["051", 1, 40, -1, "dugtrio"],
    ["052", 1, 30, -1, "meowth"],
    ["053", 1, 40, -1, "persian"],
    ["054", 1, 10, -1, "psyduck"],
    ["154", 1, 600, -1, "shiny psyduck"],
    ["055", 1, 30, -1, "golduck"],
    ["056", 1, 20, -1, "mankey"],
    ["057", 1, 30, -1, "primeape"],
    ["058h", 1, 40, -1, "growlithe (hisuian)"],
    ["058", 1, 40, -1, "growlithe"],
    ["059", 1, 70, -1, "arcanine"],
    ["159", 1, 800, -1, "shiny arcanine"],
    ["060", 1, 15, -1, "poliwag"],
    ["061", 1, 20, -1, "poliwhirl"],
    ["062", 1, 40, -1, "poliwrath"],
    ["063", 1, 15, -1, "abra"],
    ["064", 1, 20, -1, "kadabra"],
    ["065", 1, 70, -1, "alakazam"],
    ["066", 1, 10, -1, "machop"],
    ["067", 1, 30, -1, "machoke"],
    ["069", 1, 30, -1, "bellsprout"],
    ["070", 1, 30, -1, "weepinbell"],
    ["071", 1, 40, -1, "victreebel"],
    ["072", 1, 15, -1, "tentacool"],
    ["074", 1, 10, -1, "geodude"],
    ["075", 1, 30, -1, "graveler"],
    ["077", 1, 20, -1, "ponyta"],
    ["077g", 1, 20, -1, "ponyta (galarian)"],
    ["177g", 1, 600, -1, "shiny ponyta (galarian)"],
    ["078", 1, 30, -1, "rapidash"],
    ["078g", 1, 30, -1, "rapidash (galarian)"],
    ["079s", 1, 70, -1, "slowyore"],
    ["079", 1, 20, -1, "slowpoke"],
    ["080", 1, 30, -1, "slowbro"],
    ["081", 1, 20, -1, "magnemite"],
    ["083", 1, 30, -1, "farfetch&#039;d"],
    ["084", 1, 20, -1, "doduo"],
    ["085", 1, 35, -1, "dodrio"],
    ["086", 1, 30, -1, "seel"],
    ["087", 1, 40, -1, "dewgong"],
    ["088", 1, 40, -1, "grimer"],
    ["089", 1, 30, -1, "muk"],
    ["090", 1, 25, -1, "shellder"],
    ["091", 1, 30, -1, "cloyster"],
    ["092", 1, 20, -1, "gastly"],
    ["093", 1, 35, -1, "haunter"],
    ["094m", 1, 100, -1, "mega gengar"],
    ["094", 1, 40, -1, "gengar"],
    ["095", 1, 20, -1, "onix"],
    ["096", 1, 25, -1, "drowzee"],
    ["097", 1, 35, -1, "hypno"],
    ["098", 1, 15, -1, "krabby"],
    ["099", 1, 30, -1, "kingler"],
    ["0100", 1, 40, -1, "voltorb"],
    ["0101", 1, 40, -1, "electrode"],
    ["0101h", 1, 75, 0, "disguised exeggcute"],
    ["0102", 1, 20, -1, "exeggcute"],
    ["0103", 1, 40, -1, "exeggutor"],
    ["0104", 1, 35, -1, "cubone"],
    ["0105", 1, 30, -1, "marowak"],
    ["0105a", 1, 70, -1, "marowak (alolan)"],
    ["0106", 1, 70, -1, "hitmonlee"],
    ["0107", 1, 70, -1, "hitmonchan"],
    ["0108", 1, 20, -1, "lickitung"],
    ["0109", 1, 20, -1, "koffing"],
    ["0111", 1, 20, -1, "rhyhorn"],
    ["0112", 1, 40, -1, "rhydon"],
    ["0113", 1, 40, -1, "chansey"],
    ["0114", 1, 20, -1, "tangela"],
    ["0115", 1, 40, -1, "kangaskhan"],
    ["0116", 1, 25, -1, "horsea"],
    ["0117", 1, 40, -1, "seadra"],
    ["0118", 1, 20, -1, "goldeen"],
    ["0119", 1, 35, -1, "seaking"],
    ["0123", 1, 30, -1, "scyther"],
    ["0125", 1, 40, -1, "electabuzz"],
    ["0126", 1, 30, -1, "magmar"],
    ["0127", 1, 30, -1, "pinsir"],
    ["0128", 1, 40, -1, "tauros"],
    ["0129", 1, 5, -1, "magikarp"],
    ["1129", 1, 500, -1, "shiny magikarp"],
    ["0130", 1, 10, -1, "gyarados"],
    ["1130", 1, 500, -1, "shiny gyarados"],
    ["0131", 1, 100, -1, "lapras"],
    ["0132", 1, 150, -1, "ditto"],
    ["0133", 1, 30, -1, "eevee"],
    ["0133r", 1, 60, -1, "touya"],
    ["1133", 1, 600, -1, "shiny eevee"],
    ["0134", 1, 40, -1, "vaporeon"],
    ["1134", 1, 800, -1, "shiny vaporeon"],
    ["0135", 1, 40, -1, "jolteon"],
    ["1135", 1, 800, -1, "shiny jolteon"],
    ["0136", 1, 40, -1, "flareon"],
    ["1136", 1, 800, -1, "shiny flareon"],
    ["0138", 1, 40, -1, "omanyte"],
    ["0139", 1, 60, -1, "omastar"],
    ["0143", 1, 30, -1, "snorlax"],
    ["0147", 1, 30, -1, "dratini"],
    ["0148", 1, 70, -1, "dragonair"],
    ["1148", 1, 800, -1, "shiny dragonair"],
    ["0149", 1, 100, -1, "dragonite"],
  ],
  Johto: [
    ["0152", 1, 50, -1, "chikorita"],
    ["0153", 1, 60, -1, "bayleef"],
    ["0154", 1, 100, -1, "meganium"],
    ["0155", 1, 50, -1, "cyndaquil"],
    ["0156", 1, 60, -1, "quilava"],
    ["0157", 1, 70, -1, "typhlosion"],
    ["0158", 1, 50, -1, "totodile"],
    ["0159", 1, 60, -1, "croconaw"],
    ["0160", 1, 70, -1, "feraligatr"],
    ["0161", 1, 20, -1, "sentret"],
    ["0162", 1, 40, -1, "furret"],
    ["0163", 1, 15, -1, "hoothoot"],
    ["0164", 1, 20, -1, "noctowl"],
    ["1164", 1, 800, -1, "shiny noctowl"],
    ["0165", 1, 15, -1, "ledyba"],
    ["0166", 1, 40, -1, "ledian"],
    ["0167", 1, 20, -1, "spinarak"],
    ["0168", 1, 40, -1, "ariados"],
    ["0169", 1, 40, -1, "crobat"],
    ["0170", 1, 20, -1, "chinchou"],
    ["0171", 1, 40, -1, "lanturn"],
    ["0172", 1, 15, -1, "pichu"],
    ["0173", 1, 15, -1, "cleffa"],
    ["1173", 1, 500, -1, "shiny cleffa"],
    ["0174", 1, 15, -1, "igglybuff"],
    ["0175", 1, 30, -1, "togepi"],
    ["0176", 1, 40, -1, "togetic"],
    ["0177", 1, 30, -1, "natu"],
    ["0178", 1, 40, -1, "xatu"],
    ["0179s", 1, 75, 0, "spring mareep"],
    ["0179sx", 1, 200, 0, "anniversary mareep"],
    ["0179", 1, 30, -1, "mareep"],
    ["0180su", 1, 100, 0, "summer flaaffy"],
    ["0180", 1, 40, -1, "flaaffy"],
    ["0181", 1, 70, -1, "ampharos"],
    ["0181e", 1, 60, -1, "amelia"],
    ["0181m", 1, 100, -1, "mega ampharos"],
    ["0182", 1, 60, -1, "bellossom"],
    ["0183", 1, 30, -1, "marill"],
    ["0184", 1, 40, -1, "azumarill"],
    ["0185", 1, 30, -1, "sudowoodo"],
    ["0186", 1, 40, -1, "politoed"],
    ["0187", 1, 25, -1, "hoppip"],
    ["0188", 1, 20, -1, "skiploom"],
    ["0189", 1, 35, -1, "jumpluff"],
    ["0190", 1, 20, -1, "aipom"],
    ["0191", 1, 15, -1, "sunkern"],
    ["0192", 1, 60, -1, "sunflora"],
    ["0193", 1, 30, -1, "yanma"],
    ["0194", 1, 20, -1, "wooper"],
    ["0194s", 1, 75, 0, "woopice"],
    ["0195", 1, 40, -1, "quagsire"],
    ["0196", 1, 60, -1, "espeon"],
    ["1196", 1, 800, -1, "shiny espeon"],
    ["0197", 1, 60, -1, "umbreon"],
    ["1197", 1, 800, -1, "shiny umbreon"],
    ["0198", 1, 30, -1, "murkrow"],
    ["0199", 1, 30, -1, "slowking"],
    ["0200", 1, 30, -1, "misdreavus"],
    ["0202", 1, 30, -1, "wobbuffet"],
    ["0203", 1, 40, -1, "girafarig"],
    ["0206", 1, 15, -1, "dunsparce"],
    ["0207", 1, 20, -1, "gligar"],
    ["0209", 1, 30, -1, "snubbull"],
    ["0211", 1, 20, -1, "qwilfish"],
    ["0212", 1, 70, -1, "scizor"],
    ["0213p", 1, 75, 0, "pumple"],
    ["0213", 1, 30, -1, "shuckle"],
    ["0214", 1, 25, -1, "heracross"],
    ["0215", 1, 25, -1, "sneasel"],
    ["0216", 1, 30, -1, "teddiursa"],
    ["0217", 1, 40, -1, "ursaring"],
    ["0218", 1, 20, -1, "slugma"],
    ["0219", 1, 40, -1, "magcargo"],
    ["0220", 1, 20, -1, "swinub"],
    ["0221", 1, 40, -1, "piloswine"],
    ["0222", 1, 30, -1, "corsola"],
    ["0223", 1, 20, -1, "remoraid"],
    ["0224", 1, 40, -1, "octillery"],
    ["0225s", 1, 75, 0, "santa bird"],
    ["0225", 1, 40, -1, "delibird"],
    ["0226", 1, 30, -1, "mantine"],
    ["0227", 1, 40, -1, "skarmory"],
    ["0228", 1, 30, -1, "houndour"],
    ["0229m", 1, 100, -1, "mega houndoom"],
    ["0229", 1, 40, -1, "houndoom"],
    ["0230", 1, 70, -1, "kingdra"],
    ["0231", 1, 30, -1, "phanpy"],
    ["0232", 1, 30, -1, "donphan"],
    ["0233", 1, 40, -1, "porygon2"],
    ["0234", 1, 35, -1, "stantler"],
    ["0235", 1, 30, -1, "smeargle"],
    ["0236", 1, 20, -1, "tyrogue"],
    ["0237", 1, 35, -1, "hitmontop"],
    ["0238", 1, 30, -1, "smoochum"],
    ["0239", 1, 30, -1, "elekid"],
    ["0240", 1, 30, -1, "magby"],
    ["0241", 1, 30, -1, "miltank"],
    ["0242", 1, 70, -1, "blissey"],
    ["0243", 1, 150, 0, "raikou"],
    ["0244", 1, 150, 0, "entei"],
    ["0245", 1, 150, 0, "suicune"],
    ["0246", 1, 70, -1, "larvitar"],
    ["0247", 1, 80, -1, "pupitar"],
    ["0248", 1, 100, -1, "tyranitar"],
    ["0251", 1, 250, 0, "celebi"],
  ],
  Hoenn: [
    ["0252", 1, 50, -1, "treecko"],
    ["0253", 1, 60, -1, "grovyle"],
    ["0255", 1, 50, -1, "torchic"],
    ["0256", 1, 60, -1, "combusken"],
    ["0258", 1, 50, -1, "mudkip"],
    ["0259", 1, 60, -1, "marshtomp"],
    ["1259", 1, 800, -1, "shiny marshtomp"],
    ["0261", 1, 15, -1, "poochyena"],
    ["0262", 1, 40, -1, "mightyena"],
    ["0263", 1, 10, -1, "zigzagoon"],
    ["0264", 1, 30, -1, "linoone"],
    ["0265", 1, 10, -1, "wurmple"],
    ["0266", 1, 25, -1, "silcoon"],
    ["0267", 1, 35, -1, "beautifly"],
    ["1267", 1, 700, -1, "shiny beautifly"],
    ["0268", 1, 25, -1, "cascoon"],
    ["0270", 1, 20, -1, "lotad"],
    ["0271", 1, 35, -1, "lombre"],
    ["0272", 1, 40, -1, "ludicolo"],
    ["0273", 1, 20, -1, "seedot"],
    ["0274", 1, 30, -1, "nuzleaf"],
    ["0276", 1, 10, -1, "taillow"],
    ["0277", 1, 30, -1, "swellow"],
    ["0278", 1, 20, -1, "wingull"],
    ["0279", 1, 30, -1, "pelipper"],
    ["0280", 1, 15, -1, "ralts"],
    ["0281", 1, 35, -1, "kirlia"],
    ["0282", 1, 70, -1, "gardevoir"],
    ["0283", 1, 25, -1, "surskit"],
    ["0284", 1, 35, -1, "masquerain"],
    ["0285", 1, 20, -1, "shroomish"],
    ["0285m", 1, 75, 0, "super shroom"],
    ["0286", 1, 40, -1, "breloom"],
    ["0287", 1, 20, -1, "slakoth"],
    ["0293", 1, 20, -1, "whismur"],
    ["0296", 1, 30, -1, "makuhita"],
    ["0298", 1, 15, -1, "azurill"],
    ["0299", 1, 30, -1, "nosepass"],
    ["0300", 1, 30, -1, "skitty"],
    ["0301", 1, 40, -1, "delcatty"],
    ["1301", 1, 600, -1, "shiny delcatty"],
    ["0302", 1, 20, -1, "sableye"],
    ["0303", 1, 25, -1, "mawile"],
    ["0303m", 1, 100, -1, "mega mawile"],
    ["0304", 1, 25, -1, "aron"],
    ["0305", 1, 35, -1, "lairon"],
    ["0309", 1, 20, -1, "electrike"],
    ["1309", 1, 600, -1, "shiny electrike"],
    ["0310", 1, 30, -1, "manectric"],
    ["0311", 1, 70, -1, "plusle"],
    ["0312", 1, 70, -1, "minun"],
    ["0315", 1, 30, -1, "roselia"],
    ["0316", 1, 25, -1, "gulpin"],
    ["0317", 1, 40, -1, "swalot"],
    ["0318", 1, 20, -1, "carvanha"],
    ["0319", 1, 25, -1, "sharpedo"],
    ["0320", 1, 30, -1, "wailmer"],
    ["0321", 1, 40, -1, "wailord"],
    ["0322", 1, 25, -1, "numel"],
    ["0322w", 1, 75, 0, "winter numel"],
    ["0323", 1, 40, -1, "camerupt"],
    ["0324", 1, 30, -1, "torkoal"],
    ["0325", 1, 25, -1, "spoink"],
    ["0326", 1, 35, -1, "grumpig"],
    ["0327", 1, 20, -1, "spinda"],
    ["0328", 1, 20, -1, "trapinch"],
    ["0329", 1, 30, -1, "vibrava"],
    ["0330", 1, 70, -1, "flygon"],
    ["0331", 1, 30, -1, "cacnea"],
    ["0333c", 1, 75, 0, "cottonblu"],
    ["0333", 1, 20, -1, "swablu"],
    ["0334m", 1, 100, -1, "mega altaria"],
    ["0334", 1, 70, -1, "altaria"],
    ["0336", 1, 40, -1, "seviper"],
    ["0337", 1, 35, -1, "lunatone"],
    ["0339", 1, 20, -1, "barboach"],
    ["0340", 1, 25, -1, "whiscash"],
    ["0341", 1, 20, -1, "corpish"],
    ["0343", 1, 20, -1, "baltoy"],
    ["0345", 1, 30, -1, "lileep"],
    ["0347", 1, 40, -1, "anorith"],
    ["0349", 1, 30, -1, "feebas"],
    ["0350", 1, 60, -1, "milotic"],
    ["0351", 1, 30, -1, "castform"],
    ["0352", 1, 40, -1, "kecleon"],
    ["0353", 1, 20, -1, "shuppet"],
    ["0354", 1, 25, -1, "banette"],
    ["0355", 1, 20, -1, "duskull"],
    ["0357", 1, 70, -1, "tropius"],
    ["0358", 1, 40, -1, "chimecho"],
    ["0359m", 1, 100, -1, "mega absol"],
    ["0359ma", 1, 60, -1, "nayami"],
    ["0359", 1, 40, -1, "absol"],
    ["0360", 1, 15, -1, "wynaut"],
    ["0361", 1, 30, -1, "snorunt"],
    ["0362", 1, 40, -1, "glalie"],
    ["0363", 1, 40, -1, "spheal"],
    ["0364", 1, 60, -1, "sealeo"],
    ["0365", 1, 70, -1, "walrein"],
    ["0367", 1, 40, -1, "huntail"],
    ["0368", 1, 40, -1, "gorebyss"],
    ["0370cf", 1, 60, -1, "chocoluv"],
    ["0370", 1, 25, -1, "luvdisc"],
    ["0370cm", 1, 60, -1, "chocoluv"],
    ["0371", 1, 30, -1, "bagon"],
    ["0372", 1, 40, -1, "shelgon"],
    ["0373", 1, 100, -1, "salamence"],
    ["0376", 1, 70, -1, "metagross"],
    ["0382", 1, 250, 0, "kyogre"],
    ["0383", 1, 250, 0, "groudon"],
    ["0385", 1, 250, 0, "jirachi"],
  ],
  Sinnoh: [
    ["0387", 1, 50, -1, "turtwig"],
    ["0388", 1, 60, -1, "grotle"],
    ["0389", 1, 70, -1, "torterra"],
    ["0390", 1, 50, -1, "chimchar"],
    ["0391", 1, 60, -1, "monferno"],
    ["0392", 1, 70, -1, "infernape"],
    ["0393", 1, 50, -1, "piplup"],
    ["0394", 1, 60, -1, "prinplup"],
    ["0395", 1, 70, -1, "empoleon"],
    ["0396", 1, 10, -1, "starly"],
    ["0397", 1, 25, -1, "staravia"],
    ["0398", 1, 35, -1, "staraptor"],
    ["0399n", 1, 75, 0, "tom nook"],
    ["0399s", 1, 100, 0, "tom nook (seller)"],
    ["0399", 1, 15, -1, "bidoof"],
    ["0400", 1, 40, -1, "bibarel"],
    ["0403", 1, 10, -1, "shinx"],
    ["0404", 1, 25, -1, "luxio"],
    ["0405", 1, 40, -1, "luxray"],
    ["0406", 1, 20, -1, "budew"],
    ["0407", 1, 40, -1, "roserade"],
    ["0408", 1, 40, -1, "cranidos"],
    ["0410", 1, 40, -1, "shieldon"],
    ["1410", 1, 600, -1, "shiny shieldon"],
    ["0412c", 1, 25, -1, "burmy (trash)"],
    ["0412a", 1, 25, -1, "burmy (plant)"],
    ["0412b", 1, 25, -1, "burmy (sandy)"],
    ["0415", 1, 30, -1, "combee"],
    ["0417s", 1, 75, 0, "pachirisnow"],
    ["0417", 1, 30, -1, "pachirisu"],
    ["0418", 1, 30, -1, "buizel"],
    ["1418", 1, 600, -1, "shiny buizel"],
    ["0419", 1, 40, -1, "floatzel"],
    ["0420", 1, 30, -1, "cherubi"],
    ["0421", 1, 40, -1, "cherrim"],
    ["0421s", 1, 40, -1, "cherrim"],
    ["0422", 1, 20, -1, "shellos (east)"],
    ["0424", 1, 40, -1, "ambipom"],
    ["0425vf", 1, 75, -1, "valenfloon (female)"],
    ["0425", 1, 20, -1, "drifloon"],
    ["0425vm", 1, 75, -1, "valenfloon (male)"],
    ["0426", 1, 40, -1, "drifblim"],
    ["0427e", 1, 75, 0, "easter buneary"],
    ["0427", 1, 30, -1, "buneary"],
    ["0428", 1, 40, -1, "lopunny"],
    ["0429", 1, 40, -1, "mismagius"],
    ["0430", 1, 40, -1, "honchkrow"],
    ["0431", 1, 20, -1, "glameow"],
    ["0432", 1, 30, -1, "purugly"],
    ["0433", 1, 20, -1, "chingling"],
    ["0434", 1, 20, -1, "stunky"],
    ["0435", 1, 30, -1, "skuntank"],
    ["0436", 1, 25, -1, "bronzor"],
    ["0438", 1, 30, -1, "bonsly"],
    ["0438a", 1, 75, 0, "blossomly"],
    ["0439s", 1, 70, -1, "sad jr."],
    ["0439", 1, 20, -1, "mime jr. "],
    ["0439j", 1, 70, -1, "jolly jr."],
    ["0440", 1, 30, -1, "happiny"],
    ["0441", 1, 40, -1, "chatot"],
    ["0442", 1, 30, -1, "spiritomb"],
    ["0442v", 1, 75, 0, "heartomb"],
    ["1442", 1, 600, -1, "shiny spiritomb"],
    ["0443", 1, 30, -1, "gible"],
    ["1443", 1, 700, -1, "shiny gible"],
    ["0446", 1, 40, -1, "munchlax"],
    ["0447", 1, 35, -1, "riolu"],
    ["0447s", 1, 75, 0, "rokkyu"],
    ["0448", 1, 70, -1, "lucario"],
    ["0448m", 1, 100, -1, "mega lucario"],
    ["1448m", 1, 1000, -1, "shiny mega lucario"],
    ["0449", 1, 25, -1, "hippopotas"],
    ["0450", 1, 40, -1, "hippowdon"],
    ["0451", 1, 15, -1, "skorupi"],
    ["0453", 1, 20, -1, "croagunk"],
    ["0455", 1, 25, -1, "carnivine"],
    ["0456", 1, 60, -1, "finneon"],
    ["0456b", 1, 75, 0, "gloweon"],
    ["0457", 1, 35, -1, "lumineon"],
    ["0458", 1, 20, -1, "mantyke"],
    ["0459", 1, 20, -1, "snover"],
    ["0460", 1, 40, -1, "abomasnow"],
    ["0461", 1, 40, -1, "weavile"],
    ["0464", 1, 70, -1, "rhyperior"],
    ["0468", 1, 30, -1, "togekiss"],
    ["0470", 1, 40, -1, "leafeon"],
    ["1470", 1, 800, -1, "shiny leafeon"],
    ["0471", 1, 40, -1, "glaceon"],
    ["1471", 1, 800, -1, "shiny glaceon"],
    ["0473", 1, 40, -1, "mamoswine"],
    ["0474", 1, 60, -1, "porygon-z"],
    ["0475", 1, 70, -1, "gallade"],
    ["0478", 1, 40, -1, "froslass"],
    ["0479e", 1, 100, -1, "mow rotom"],
    ["0479d", 1, 100, -1, "fan rotom"],
    ["0479c", 1, 100, -1, "frost rotom"],
    ["0479", 1, 70, -1, "rotom"],
    ["0479b", 1, 100, -1, "wash rotom"],
    ["0479a", 1, 100, -1, "heat rotom"],
    ["0488", 1, 250, 0, "cresselia"],
    ["0489", 1, 70, -1, "phione"],
    ["0491", 1, 250, 0, "darkrai"],
  ],
  Unova: [
    ["0495", 1, 50, -1, "snivy"],
    ["0496", 1, 60, -1, "servine"],
    ["0497", 1, 70, -1, "serperior"],
    ["0498", 1, 50, -1, "tepig"],
    ["0499", 1, 60, -1, "pignite"],
    ["0500", 1, 70, -1, "emboar"],
    ["0501", 1, 50, -1, "oshawott"],
    ["0502", 1, 60, -1, "dewott"],
    ["0503", 1, 70, -1, "samurott"],
    ["0506", 1, 20, -1, "lillipup"],
    ["0507", 1, 30, -1, "herdier"],
    ["0508", 1, 40, -1, "stoutland"],
    ["0509", 1, 25, -1, "purrloin"],
    ["0510", 1, 35, -1, "liepard"],
    ["0511", 1, 40, -1, "pansage"],
    ["0513", 1, 40, -1, "pansear"],
    ["0515", 1, 40, -1, "panpour"],
    ["0517h", 1, 75, 0, "nightmare munna"],
    ["0517", 1, 20, -1, "munna"],
    ["0518", 1, 35, -1, "musharna"],
    ["0519", 1, 15, -1, "pidove"],
    ["0520", 1, 25, -1, "tranquill"],
    ["0521a", 1, 40, -1, "unfezant (f)"],
    ["0521b", 1, 40, -1, "unfezant (m)"],
    ["0522", 1, 20, -1, "blitzle"],
    ["0523", 1, 30, -1, "zebstrika"],
    ["0524", 1, 20, -1, "roggenrola"],
    ["0525", 1, 30, -1, "boldore"],
    ["0527", 1, 40, -1, "woobat"],
    ["0529", 1, 20, -1, "drilbur"],
    ["0530", 1, 40, -1, "excadrill"],
    ["0531", 1, 70, -1, "audino"],
    ["0531m", 1, 100, -1, "mega audino"],
    ["0532", 1, 30, -1, "timburr"],
    ["0533", 1, 40, -1, "gurdurr"],
    ["0535", 1, 20, -1, "tympole"],
    ["0536", 1, 35, -1, "palpitoad"],
    ["0538", 1, 40, -1, "throh"],
    ["0539", 1, 40, -1, "sawk"],
    ["0540", 1, 10, -1, "sewaddle"],
    ["0541", 1, 30, -1, "swadloon"],
    ["0543", 1, 25, -1, "venipede"],
    ["0546", 1, 30, -1, "cottonee"],
    ["0546m", 1, 75, 0, "flower boy"],
    ["0547", 1, 100, -1, "whimsicott"],
    ["0548m", 1, 75, 0, "flower girl"],
    ["0548", 1, 15, -1, "petilil"],
    ["0549", 1, 30, -1, "lilligant"],
    ["0550a", 1, 30, -1, "basculin (red)"],
    ["0550b", 1, 30, -1, "basculin (blue)"],
    ["0551", 1, 20, -1, "sandile"],
    ["0554", 1, 30, -1, "darumaka"],
    ["0557", 1, 15, -1, "dwebble"],
    ["0559", 1, 20, -1, "scraggy"],
    ["0560", 1, 30, -1, "scrafty"],
    ["0562", 1, 25, -1, "yamask"],
    ["0564", 1, 40, -1, "tirtouga"],
    ["0565", 1, 70, -1, "carracosta"],
    ["0566", 1, 40, -1, "archen"],
    ["0567", 1, 70, -1, "archeops"],
    ["0568", 1, 20, -1, "trubbish"],
    ["0570", 1, 35, -1, "zorua"],
    ["0571", 1, 40, -1, "zoroark"],
    ["0572", 1, 30, -1, "minccino"],
    ["0573", 1, 40, -1, "cinccino"],
    ["0574", 1, 20, -1, "gothita"],
    ["0576", 1, 40, -1, "gothitelle"],
    ["0577", 1, 20, -1, "solosis"],
    ["0578", 1, 20, -1, "duosion"],
    ["0579", 1, 20, -1, "reuniclus"],
    ["0580", 1, 30, -1, "ducklett"],
    ["0580r", 1, 60, -1, "birthday ducklett"],
    ["1580", 1, 800, -1, "shiny ducklett"],
    ["0582", 1, 20, -1, "vanillite"],
    ["0583", 1, 30, -1, "vanillish"],
    ["0585d", 1, 20, -1, "deerling (winter)"],
    ["0585c", 1, 20, -1, "deerling (autumn)"],
    ["0585b", 1, 20, -1, "deerling (summer)"],
    ["0585a", 1, 20, -1, "deerling (spring)"],
    ["0586b", 1, 40, -1, "sawsbuck (summer)"],
    ["0586d", 1, 40, -1, "sawsbuck (winter)"],
    ["0586c", 1, 40, -1, "sawsbuck (autumn)"],
    ["0586a", 1, 40, -1, "sawsbuck (spring)"],
    ["0587", 1, 20, -1, "emolga"],
    ["0590", 1, 20, -1, "foongus"],
    ["0592f", 1, 25, -1, "frillish (female)"],
    ["0593m", 1, 35, -1, "jellicent (male)"],
    ["0595", 1, 20, -1, "joltik"],
    ["0596", 1, 40, -1, "galvantula"],
    ["0602", 1, 15, -1, "tynamo"],
    ["0603", 1, 25, -1, "eelektrik"],
    ["0605", 1, 20, -1, "elgyem"],
    ["0607", 1, 20, -1, "litwick"],
    ["0608", 1, 40, -1, "lampent"],
    ["0609", 1, 60, -1, "chandelure"],
    ["0610", 1, 20, -1, "axew"],
    ["0613", 1, 30, -1, "cubchoo"],
    ["0614", 1, 70, -1, "beartic"],
    ["0616", 1, 20, -1, "shelmet"],
    ["0618", 1, 20, -1, "stunfisk"],
    ["0619", 1, 30, -1, "mienfoo"],
    ["0620", 1, 40, -1, "mienshao"],
    ["0621", 1, 40, -1, "druddigon"],
    ["0625", 1, 40, -1, "bisharp"],
    ["0626", 1, 40, -1, "bouffalant"],
    ["0627", 1, 20, -1, "rufflet"],
    ["0628", 1, 35, -1, "braviary"],
    ["0629", 1, 25, -1, "vullaby"],
    ["0630", 1, 35, -1, "mandibuzz"],
    ["0631", 1, 30, -1, "heatmor"],
    ["0633", 1, 40, -1, "deino"],
    ["0634", 1, 60, -1, "zweilous"],
    ["0636", 1, 25, -1, "larvesta"],
    ["0637", 1, 40, -1, "volcarona"],
    ["0647", 1, 250, 0, "keldeo"],
  ],
  Kalos: [
    ["0650", 1, 50, -1, "chespin"],
    ["0653", 1, 50, -1, "fennekin"],
    ["0653w", 1, 60, 0, "winter fennekin"],
    ["0656", 1, 50, -1, "froakie"],
    ["0659", 1, 20, -1, "bunnelby"],
    ["1659", 1, 600, -1, "shiny bunnelby"],
    ["0661", 1, 15, -1, "fletchling"],
    ["0662", 1, 30, -1, "fletchinder"],
    ["0663", 1, 40, -1, "talonflame"],
    ["0665", 1, 25, -1, "spewpa"],
    ["0667", 1, 20, -1, "litleo"],
    ["0668m", 1, 40, -1, "pyroar (male)"],
    ["0668f", 1, 40, -1, "pyroar (female)"],
    ["0669", 1, 25, -1, "flab\u00e9b\u00e9"],
    ["0671y", 1, 70, -1, "florges (yellow)"],
    ["0671r", 1, 70, -1, "florges (red)"],
    ["0671w", 1, 70, -1, "florgres (white)"],
    ["0671o", 1, 70, -1, "florges (orange)"],
    ["0671b", 1, 70, -1, "florges (blue)"],
    ["0672", 1, 30, -1, "skiddo"],
    ["0673", 1, 40, -1, "gogoat"],
    ["0674", 1, 30, -1, "pancham"],
    ["0675", 1, 70, -1, "pangoro"],
    ["0676", 1, 40, -1, "furfrou"],
    ["0677", 1, 30, -1, "espurr"],
    ["0678f", 1, 30, -1, "meowstic (female)"],
    ["0678m", 1, 30, -1, "meowstic (male)"],
    ["0682", 1, 25, -1, "spritzee"],
    ["0683", 1, 40, -1, "aromatisse"],
    ["0684", 1, 20, -1, "swirlix"],
    ["0685", 1, 30, -1, "slurpuff"],
    ["0686", 1, 30, -1, "inkay"],
    ["0690", 1, 20, -1, "skrelp"],
    ["0692", 1, 20, -1, "clauncher"],
    ["0694", 1, 20, -1, "helioptile"],
    ["0695", 1, 35, -1, "heliolisk"],
    ["0696", 1, 30, -1, "tyrunt"],
    ["0697", 1, 70, -1, "tyrantrum"],
    ["0698", 1, 40, -1, "amaura"],
    ["0700", 1, 40, -1, "sylveon"],
    ["1700", 1, 800, -1, "shiny sylveon"],
    ["0701", 1, 40, -1, "hawlucha"],
    ["0702", 1, 20, -1, "dedenne"],
    ["0703", 1, 40, -1, "carbink"],
    ["0704", 1, 30, -1, "goomy"],
    ["0705", 1, 40, -1, "sliggoo"],
    ["0706", 1, 60, -1, "goodra"],
    ["0707", 1, 20, -1, "klefki"],
    ["0708", 1, 30, -1, "phantump"],
    ["0710", 1, 30, -1, "pumpkaboo"],
    ["0711", 1, 40, -1, "gourgeist"],
    ["0712", 1, 25, -1, "bergmite"],
    ["0714", 1, 30, -1, "noibat"],
    ["0715", 1, 40, -1, "noivern"],
    ["0716", 1, 250, 0, "xerneas"],
  ],
  Alola: [
    ["0722", 1, 50, -1, "rowlet"],
    ["0723", 1, 60, -1, "dartrix"],
    ["0724", 1, 70, -1, "decidueye"],
    ["0725", 1, 50, -1, "litten"],
    ["0726", 1, 60, -1, "torracat"],
    ["0727", 1, 70, -1, "incineroar"],
    ["0728", 1, 50, -1, "popplio"],
    ["0729", 1, 60, -1, "brionne"],
    ["0730", 1, 70, -1, "primarina"],
    ["0731", 1, 10, -1, "pikipek"],
    ["0732", 1, 30, -1, "trumbeak"],
    ["0733", 1, 40, -1, "toucannon"],
    ["1733", 1, 700, -1, "shiny toucannon"],
    ["0739", 1, 25, -1, "crabrawler"],
    ["0741a", 1, 40, -1, "oricorio (baile)"],
    ["0741b", 1, 40, -1, "oricorio (pom-pom)"],
    ["0741d", 1, 40, -1, "oricorio (sensu)"],
    ["0741c", 1, 40, -1, "oricorio (pa&#039;u)"],
    ["0742", 1, 25, -1, "cutiefly"],
    ["1742", 1, 550, -1, "shiny cutiefly"],
    ["0743", 1, 20, -1, "ribombee"],
    ["0744", 1, 20, -1, "rockruff"],
    ["1744", 1, 600, -1, "shiny rockruff"],
    ["0745d", 1, 40, -1, "lycanroc (midday)"],
    ["0745m", 1, 40, -1, "lycanroc (dusk)"],
    ["0745n", 1, 40, -1, "lycanroc (midnight)"],
    ["0746", 1, 15, -1, "wishiwashi"],
    ["0749", 1, 30, -1, "mudbray"],
    ["0750", 1, 35, -1, "mudsdale"],
    ["0751", 1, 20, -1, "dewpider"],
    ["0753", 1, 20, -1, "fomantis"],
    ["0754", 1, 40, -1, "lurantis"],
    ["0757", 1, 25, -1, "salandit"],
    ["0759", 1, 25, -1, "stufful"],
    ["0760", 1, 35, -1, "bewear"],
    ["0761", 1, 25, -1, "bounsweet"],
    ["0762", 1, 35, -1, "steenee"],
    ["0765", 1, 40, -1, "oranguru"],
    ["0766", 1, 40, -1, "passimian"],
    ["0767", 1, 20, -1, "wimpod"],
    ["0769", 1, 20, -1, "sandygast"],
    ["0771", 1, 20, -1, "pyukumuku"],
    ["0774", 1, 100, -1, "minior"],
    ["1774", 1, 1000, -1, "shiny minior"],
    ["0775", 1, 30, -1, "komala"],
    ["0776", 1, 40, -1, "turtonator"],
    ["0778", 1, 30, -1, "mimikyu"],
    ["0780", 1, 40, -1, "drampa"],
    ["0782", 1, 20, -1, "jangmo-o"],
  ],
  Galar: [
    ["0810", 1, 50, -1, "grookey"],
    ["0813", 1, 50, -1, "scorbunny"],
    ["1813", 1, 700, -1, "shiny scorbunny"],
    ["0816", 1, 50, -1, "sobble"],
    ["0819", 1, 20, -1, "skwovet"],
    ["0820", 1, 30, -1, "greedent"],
    ["0821", 1, 15, -1, "rookidee"],
    ["0822", 1, 35, -1, "corvisquire"],
    ["1822", 1, 600, -1, "shiny corvisquire"],
    ["0827", 1, 20, -1, "nickit"],
    ["1827", 1, 600, -1, "shiny nickit"],
    ["0829", 1, 20, -1, "gossifleur"],
    ["0830", 1, 40, -1, "eldegoss"],
    ["0831", 1, 25, -1, "wooloo"],
    ["1831", 1, 600, -1, "shiny wooloo"],
    ["0832", 1, 40, -1, "dubwool"],
    ["0835", 1, 20, -1, "yamper"],
    ["0840", 1, 15, -1, "applin"],
    ["0841", 1, 40, -1, "flapple"],
    ["0842", 1, 40, -1, "appletun"],
    ["0848", 1, 30, -1, "toxel"],
    ["0854", 1, 20, -1, "sinistea"],
    ["0855", 1, 40, -1, "polteageist"],
    ["0856", 1, 25, -1, "hatenna"],
    ["0857", 1, 35, -1, "hattrem"],
    ["0859", 1, 20, -1, "impidimp"],
    ["0860", 1, 30, -1, "morgrem"],
    ["0861", 1, 40, -1, "grimmsnarl"],
    ["0872", 1, 20, -1, "snom"],
    ["0875", 1, 30, -1, "eiscue"],
    ["0875n", 1, 100, -1, "eiscue (noice)"],
    ["0877", 1, 35, -1, "morpeko"],
    ["0877h", 1, 35, -1, "morpeko (hangry)"],
    ["0878", 1, 25, -1, "cuffant"],
    ["0901", 1, 40, -1, "ursaluna"],
    ["1901", 1, 800, -1, "shiny ursaluna"],
  ],
  Paldea: [
    ["0906", 1, 50, -1, "sprigatito"],
    ["0909", 1, 50, -1, "fuecoco"],
    ["0912", 1, 50, -1, "quaxly"],
    ["0926", 1, 30, -1, "fidough"],
    ["0928", 1, 20, -1, "smoliv"],
  ],
  Shiny: [
    ["13", 1, 900, -1, "shiny venusaur"],
    ["16", 1, 900, -1, "shiny charizard"],
    ["19", 1, 900, -1, "shiny blastoise"],
    ["118", 1, 500, -1, "shiny pidgeot"],
    ["154", 1, 600, -1, "shiny psyduck"],
    ["159", 1, 800, -1, "shiny arcanine"],
    ["177g", 1, 600, -1, "shiny ponyta (galarian)"],
    ["1129", 1, 500, -1, "shiny magikarp"],
    ["1130", 1, 500, -1, "shiny gyarados"],
    ["1133", 1, 600, -1, "shiny eevee"],
    ["1134", 1, 800, -1, "shiny vaporeon"],
    ["1135", 1, 800, -1, "shiny jolteon"],
    ["1136", 1, 800, -1, "shiny flareon"],
    ["1148", 1, 800, -1, "shiny dragonair"],
    ["1164", 1, 800, -1, "shiny noctowl"],
    ["1173", 1, 500, -1, "shiny cleffa"],
    ["1196", 1, 800, -1, "shiny espeon"],
    ["1197", 1, 800, -1, "shiny umbreon"],
    ["1259", 1, 800, -1, "shiny marshtomp"],
    ["1267", 1, 700, -1, "shiny beautifly"],
    ["1301", 1, 600, -1, "shiny delcatty"],
    ["1309", 1, 600, -1, "shiny electrike"],
    ["1410", 1, 600, -1, "shiny shieldon"],
    ["1418", 1, 600, -1, "shiny buizel"],
    ["1442", 1, 600, -1, "shiny spiritomb"],
    ["1443", 1, 700, -1, "shiny gible"],
    ["1448m", 1, 1000, -1, "shiny mega lucario"],
    ["1470", 1, 800, -1, "shiny leafeon"],
    ["1471", 1, 800, -1, "shiny glaceon"],
    ["1580", 1, 800, -1, "shiny ducklett"],
    ["1659", 1, 600, -1, "shiny bunnelby"],
    ["1700", 1, 800, -1, "shiny sylveon"],
    ["1733", 1, 700, -1, "shiny toucannon"],
    ["1742", 1, 550, -1, "shiny cutiefly"],
    ["1744", 1, 600, -1, "shiny rockruff"],
    ["1774", 1, 1000, -1, "shiny minior"],
    ["1813", 1, 700, -1, "shiny scorbunny"],
    ["1822", 1, 600, -1, "shiny corvisquire"],
    ["1827", 1, 600, -1, "shiny nickit"],
    ["1831", 1, 600, -1, "shiny wooloo"],
    ["1901", 1, 800, -1, "shiny ursaluna"],
  ],
  Limited: [
    ["025b", 1, 100, 0, "tyranichu"],
    ["025c", 1, 100, 0, "pumpkachu"],
    ["025a", 1, 100, 0, "breloochu"],
    ["037w", 1, 75, 0, "witch vulpix"],
    ["0101h", 1, 75, 0, "disguised exeggcute"],
    ["0179s", 1, 75, 0, "spring mareep"],
    ["0179sx", 1, 200, 0, "anniversary mareep"],
    ["0180su", 1, 100, 0, "summer flaaffy"],
    ["0194s", 1, 75, 0, "woopice"],
    ["0213p", 1, 75, 0, "pumple"],
    ["0225s", 1, 75, 0, "santa bird"],
    ["0243", 1, 150, 0, "raikou"],
    ["0244", 1, 150, 0, "entei"],
    ["0245", 1, 150, 0, "suicune"],
    ["0251", 1, 250, 0, "celebi"],
    ["0285m", 1, 75, 0, "super shroom"],
    ["0322w", 1, 75, 0, "winter numel"],
    ["0333c", 1, 75, 0, "cottonblu"],
    ["0382", 1, 250, 0, "kyogre"],
    ["0383", 1, 250, 0, "groudon"],
    ["0385", 1, 250, 0, "jirachi"],
    ["0399n", 1, 75, 0, "tom nook"],
    ["0399s", 1, 100, 0, "tom nook (seller)"],
    ["0417s", 1, 75, 0, "pachirisnow"],
    ["0427e", 1, 75, 0, "easter buneary"],
    ["0438a", 1, 75, 0, "blossomly"],
    ["0442v", 1, 75, 0, "heartomb"],
    ["0447s", 1, 75, 0, "rokkyu"],
    ["0456b", 1, 75, 0, "gloweon"],
    ["0488", 1, 250, 0, "cresselia"],
    ["0491", 1, 250, 0, "darkrai"],
    ["0517h", 1, 75, 0, "nightmare munna"],
    ["0546m", 1, 75, 0, "flower boy"],
    ["0548m", 1, 75, 0, "flower girl"],
    ["0647", 1, 250, 0, "keldeo"],
    ["0653w", 1, 60, 0, "winter fennekin"],
    ["0716", 1, 250, 0, "xerneas"],
  ],
  Popular: [
    ["0774", 1, 100, -1, "minior"],
    ["041", 1, 10, -1, "zubat"],
    ["1774", 1, 1000, -1, "shiny minior"],
    ["0129", 1, 5, -1, "magikarp"],
    ["1197", 1, 800, -1, "shiny umbreon"],
    ["094m", 1, 100, -1, "mega gengar"],
    ["1448m", 1, 1000, -1, "shiny mega lucario"],
    ["0700", 1, 40, -1, "sylveon"],
    ["06mx", 1, 100, -1, "mega charizard x"],
    ["1134", 1, 800, -1, "shiny vaporeon"],
    ["1700", 1, 800, -1, "shiny sylveon"],
    ["1136", 1, 800, -1, "shiny flareon"],
    ["1196", 1, 800, -1, "shiny espeon"],
    ["1133", 1, 600, -1, "shiny eevee"],
    ["1135", 1, 800, -1, "shiny jolteon"],
    ["1471", 1, 800, -1, "shiny glaceon"],
    ["13", 1, 900, -1, "shiny venusaur"],
    ["16", 1, 900, -1, "shiny charizard"],
    ["0154", 1, 100, -1, "meganium"],
    ["1470", 1, 800, -1, "shiny leafeon"],
    ["0359m", 1, 100, -1, "mega absol"],
    ["06my", 1, 100, -1, "mega charizard y"],
    ["0186", 1, 40, -1, "politoed"],
    ["19", 1, 900, -1, "shiny blastoise"],
  ],
  Newest: [
    ["1133", 1, 600, -1, "shiny eevee"],
    ["1134", 1, 800, -1, "shiny vaporeon"],
    ["1135", 1, 800, -1, "shiny jolteon"],
    ["1136", 1, 800, -1, "shiny flareon"],
    ["1196", 1, 800, -1, "shiny espeon"],
    ["1197", 1, 800, -1, "shiny umbreon"],
    ["1470", 1, 800, -1, "shiny leafeon"],
    ["1471", 1, 800, -1, "shiny glaceon"],
    ["1700", 1, 800, -1, "shiny sylveon"],
    ["0546m", 1, 75, 0, "flower boy"],
    ["0701", 1, 40, -1, "hawlucha"],
    ["1410", 1, 600, -1, "shiny shieldon"],
    ["1443", 1, 700, -1, "shiny gible"],
    ["1827", 1, 600, -1, "shiny nickit"],
    ["0119", 1, 35, -1, "seaking"],
    ["046", 1, 20, -1, "paras"],
    ["0596", 1, 40, -1, "galvantula"],
    ["0715", 1, 40, -1, "noivern"],
    ["0716", 1, 250, 0, "xerneas"],
    ["0745m", 1, 40, -1, "lycanroc (dusk)"],
    ["0745n", 1, 40, -1, "lycanroc (midnight)"],
    ["0926", 1, 30, -1, "fidough"],
    ["0928", 1, 20, -1, "smoliv"],
    ["0179sx", 1, 200, 0, "anniversary mareep"],
  ],
};
