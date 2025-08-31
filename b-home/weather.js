import { headers } from "../a-shared/const.js";
import { sendMail } from "../a-shared/email.js";
import { logMsg, logLevels } from "../a-shared/logger.js";

const tag = "WEATHER";

function checkWeather() {
  return fetch(`https://pokeheroes.com/weather`, {
    headers: headers,
    referrer: "https://pokeheroes.com/",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

function checkDaycare() {
  return fetch(`https://pokeheroes.com/daycare`, {
    headers: headers,
    referrer: "https://pokeheroes.com/weather",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

export async function getCurrentWeather() {
  const html = await (await checkWeather()).text();
  const currentWeatherMatch = html.match(/<b>Current Weather:<\/b>\s*(?<currentWeather>[^<]+)</);
  const currentWeather = currentWeatherMatch?.groups?.currentWeather?.trim() ?? null;

  return currentWeather;
}

export async function checkWeatherDaycare() {
  let html = await (await checkWeather()).text();
  const currentWeatherMatch = html.match(/<b>Current Weather:<\/b>\s*(?<currentWeather>[^<]+)</);
  const currentWeather = currentWeatherMatch?.groups?.currentWeather?.trim() ?? null;

  if (currentWeather.includes("Sunny")) {
    logMsg(tag, logLevels.Important, `Current weather is [${currentWeather}].`);
    html = await (await checkDaycare()).text();
    const count = (html.match(/headline1/g) || []).length;
    const usualNumberOfHeadlines = 5;
    if (count > usualNumberOfHeadlines) {
      sendMail("Weather Update", `Current weather is [${currentWeather}] and one more headline in Daycare!`);
    }
  }

  // Extract forecasts (weather and time for each column)
  // Const forecastRegex =
  // /<tr><td[^>]*><b>(?<forecast1>[^<]+)<\/b><\/td><td[^>]*><b>(?<forecast2>[^<]+)<\/b><\/td><td[^>]*><b>(?<forecast3>[^<]+)<\/b><\/td><\/tr>\s*<tr><td[^>]*><i>(?<time1>[^<]+)<\/i><\/td><td[^>]*><i>(?<time2>[^<]+)<\/i><\/td><td[^>]*><i>(?<time3>[^<]+)<\/i><\/td><\/tr>/;
  // Const forecastMatch = html.match(forecastRegex);

  // Const forecasts = forecastMatch
  //   ? [
  //       { weather: forecastMatch.groups.forecast1, time: forecastMatch.groups.time1 },
  //       { weather: forecastMatch.groups.forecast2, time: forecastMatch.groups.time2 },
  //       { weather: forecastMatch.groups.forecast3, time: forecastMatch.groups.time3 },
  //     ]
  //   : [];
}
