import { headers } from "../../a-shared/const.js";
import { sendMail } from "../../a-shared/email.js";
import { logMsg, logLevels } from "../../a-shared/logger.js";
import { createSpaceInParty } from "./adoption.js";

const tag = "BILL";

function initBill() {
  return fetch("https://pokeheroes.com/bill?d", {
    headers: headers,
    referrer: "https://pokeheroes.com/bill",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: "boxname1=billrockz&boxord1=1&boxname2=filler&boxord2=2&boxname3=filler&boxord3=3&boxname4=filler&boxord4=4&boxname5=filler&boxord5=5&boxname6=filler&boxord6=6&boxname7=filler&boxord7=7&boxname8=filler&boxord8=8&boxname9=filler&boxord9=9&boxname10=filler&boxord10=10&boxname11=filler&boxord11=11&boxname12=filler&boxord12=12&boxname13=filler&boxord13=13&boxname14=filler&boxord14=14&boxname15=filler&boxord15=15&boxname16=filler&boxord16=16&boxname17=filler&boxord17=17&boxname18=filler&boxord18=18&boxname19=filler&boxord19=19&boxname20=filler&boxord20=20&boxname21=filler&boxord21=21&boxname22=filler&boxord22=22&boxname23=filler&boxord23=23&boxname24=filler&boxord24=24&boxname25=filler&boxord25=25&boxname26=filler&boxord26=26&boxname27=filler&boxord27=27&boxname28=filler&boxord28=28&boxname29=filler&boxord29=29&boxname30=filler&boxord30=30&boxname31=filler&boxord31=31&boxname32=filler&boxord32=32&boxname33=filler&boxord33=33&boxname34=filler&boxord34=34&boxname35=filler&boxord35=35&boxname36=filler&boxord36=36&boxname37=filler&boxord37=37&boxname38=filler&boxord38=38&boxname39=filler&boxord39=39&boxname40=filler&boxord40=40&boxname41=filler&boxord41=41&boxname42=filler&boxord42=42&boxname43=filler&boxord43=43&boxname44=filler&boxord44=44&boxname45=filler&boxord45=45&boxname46=filler&boxord46=46&boxname47=filler&boxord47=47&boxname48=filler&boxord48=48&boxname49=filler&boxord49=49&boxname50=filler&boxord50=50&boxname51=filler&boxord51=51&save_ch=true",
    method: "POST",
    mode: "cors",
    credentials: "include",
  });
}

function startBill(url = "storageterminal") {
  return fetch(`https://pokeheroes.com/${url}`, {
    headers: headers,
    referrer: "https://pokeheroes.com/bill?d",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

function solveBill(url = "", code = "") {
  return fetch(`https://pokeheroes.com/bill?questCode=${code}`, {
    headers: headers,
    referrer: `https://pokeheroes.com/${url}`,
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

export async function handleMissingNo() {
  let html = await (await initBill()).text();
  // TODO Check how to determine if feature not available
  let match = html.match(/script>location\.href\s*=\s*"(?<url>[^"]+)"/);
  const url = match?.groups?.url;
  html = await (await startBill(url)).text();
  match = html.match(/questCode=(?<code>[^"]+)"/);
  const code = match?.groups?.code;
  logMsg(tag, logLevels.Important, `Solving quest using conf [${url}] and code [${code}]`);
  html = await (await solveBill(url, code)).text();
  if (html.includes("It's been less than a week since you crashed my system!")) {
    logMsg(tag, logLevels.Important, "You have to wait a week to do this again.");
  } else if (html.includes("By the way, has this weird egg always been in your party...?")) {
    logMsg(tag, logLevels.Important, "Got new MissingNo egg.");
  } else if (html.includes("especially when your party is full")) {
    logMsg(tag, logLevels.Important, "Couldn't get egg because of full party.");
    if (await createSpaceInParty()) await handleMissingNo();
  } else {
    sendMail(`bill.js, line ~59`, html);
  }
}
