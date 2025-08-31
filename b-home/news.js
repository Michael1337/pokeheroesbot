import { headers } from "../a-shared/const.js";
import { sendMail } from "../a-shared/email.js";
import { logMsg, logLevels } from "../a-shared/logger.js";

const tag = "NEWS";
const HOURS_INTERVAL = 7; // Check every 6 hours if something is younger than 7 hours.

function checkNews() {
  return fetch(`https://pokeheroes.com/`, {
    headers: headers,
    referrer: "https://pokeheroes.com/",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

function parseNewsDate(dateString) {
  // Example: '30/May/25 16:00'
  const months = {
    Jan: 0,
    Feb: 1,
    Mar: 2,
    Apr: 3,
    May: 4,
    Jun: 5,
    Jul: 6,
    Aug: 7,
    Sep: 8,
    Oct: 9,
    Nov: 10,
    Dec: 11,
  };

  const match = dateString.match(/(?<day>\d{2})\/(?<mon>[A-Za-z]{3})\/(?<year>\d{2}) (?<hour>\d{2}):(?<min>\d{2})/);
  if (!match || !match.groups) return null;
  const { day, mon, year, hour, min } = match.groups;

  const yearPrefix = 2000; // Year 25 should be 2025
  const fullYear = yearPrefix + parseInt(year, 10);
  return new Date(fullYear, months[mon], parseInt(day, 10), parseInt(hour, 10), parseInt(min, 10));
}

export async function newsPage() {
  const html = await (await checkNews()).text();
  const match = html.match(/<div class="head">[\s\S]*?<b>(?<date>\d{2}\/[A-Za-z]{3}\/\d{2} \d{2}:\d{2})<\/b>/);
  const newsDateString = match && match.groups ? match.groups.date : null;
  const newsDate = parseNewsDate(newsDateString);
  const now = new Date();

  if (newsDate) {
    const diffMs = now - newsDate;
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours <= HOURS_INTERVAL) {
      logMsg(tag, logLevels.Important, `There are news on Pokéheroes.com, indicating an active event.`);
      sendMail("News on Pokéheroes", `There are news on Pokéheroes.com, indicating an active event.`);
    }
  }
}
