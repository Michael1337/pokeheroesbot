import { headers, WAIT_TIMES } from "../../a-shared/const.js";
import { sendMail } from "../../a-shared/email.js";
import { logErr, logLevels, logMsg } from "../../a-shared/logger.js";
import { delay } from "../../a-shared/utils.js";
import { bidOnSomeAuction } from "../auction.js";
import { doSomeCoinFlips } from "../gamecenter/gc-coinflip.js";
import { doSomeHoL } from "../gamecenter/gc-higherOrLower.js";
import { doSendPlushieRandomNewVal } from "../emera-mall/shop-dream-world.js";

const tag = "BEAUTY CONTEST";

function contestOverview() {
  return fetch("https://pokeheroes.com/beautycontest", {
    headers: headers,
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

function skipTask() {
  return fetch("https://pokeheroes.com/beautycontest?skipTask", {
    headers: headers,
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

function claimReward() {
  return fetch("https://pokeheroes.com/beautycontest?claimReward", {
    headers: headers,
    referrer: "https://pokeheroes.com/beautycontest",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

function loadPhoto() {
  return fetch("https://pokeheroes.com/includes/ajax/beauty/load_contest_photo.php", {
    headers: headers,
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

function ratePhoto(photo = 0, rating = 1) {
  return fetch("https://pokeheroes.com/includes/ajax/beauty/rate_photo.php", {
    headers: headers,
    referrer: "https://pokeheroes.com/beautycontest",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: `photo=${photo}&rating=${rating}`,
    method: "POST",
    mode: "cors",
    credentials: "include",
  });
}

export async function ratePhotos() {
  // Fetch user's own photo IDs from the contest overview
  const overviewHtml = await (await contestOverview()).text();
  const ownPhotoIds = [...overviewHtml.matchAll(/removePhoto\((?<id>\d+)\);/g)].map((m) => Number(m.groups.id));

  let ratedPhotos = 0;

  while (true) {
    const photoHtml = await (await loadPhoto()).text();
    const photoMatch = photoHtml.match(/<div class="photosrc">(?<photoId>\d+)<\/div>/);

    if (photoHtml.length > 0 && !photoMatch?.groups) {
      sendMail("Beauty Contest Error 1", photoHtml); // Probabaly some error.
      break;
    }

    if (!photoMatch?.groups) {
      // No more photos.
      break;
    }

    const photoId = Number(photoMatch.groups.photoId);
    const maxPoints = 10;
    const minPoints = 1;
    const ratingValue = ownPhotoIds.includes(photoId) ? maxPoints : minPoints;

    if (ratingValue === maxPoints) {
      logMsg(tag, logLevels.Valuable, `Encountered own photo [${photoId}]. Rating [${ratingValue}]...`);
    }

    // Submit the rating
    const rateHtml = await (await ratePhoto(photoId, ratingValue)).text();
    const rewardMatch = rateHtml.match(/<div id="ratereward">(?<reward>\d+)<\/div>/);
    ratedPhotos++;

    if (rewardMatch?.groups) {
      logMsg(tag, logLevels.Valuable, `Received reward [${Number(rewardMatch.groups.reward)}].`);
    } else if (rateHtml.length > 0) {
      // Recieved no rewards but some HTML.
      sendMail("Beauty Contest Error 2", rateHtml);
    }
  }

  if (ratedPhotos === 0) {
    logMsg(tag, logLevels.Valuable, "Already rated all photos.");
  } else {
    logMsg(tag, logLevels.Valuable, `Rated [${ratedPhotos}] photos in total.`);
  }
}

function getMsToNextContest() {
  const now = new Date();
  const DAY_OF_CONTEST = 14;
  const DECEMBER = 11;

  let contestYear = now.getFullYear();
  let contestMonth = now.getMonth(); // 0-based: 0=Jan, ..., 11=Dec

  if (now.getDate() >= DAY_OF_CONTEST) {
    // Move to next month
    if (contestMonth === DECEMBER) {
      // December -> January next year
      contestMonth = 0;
      contestYear += 1;
    } else {
      // 27th this month -> 14th next month
      contestMonth += 1;
    }
  }

  const nextContest = new Date(contestYear, contestMonth, DAY_OF_CONTEST, 0, 0, 0, 0);
  const msToNextContest = nextContest - now;
  return msToNextContest;
}

export async function handleBeautyContest() {
  let logging = true;
  while (true) {
    const html = await (await contestOverview()).text();

    if (html.includes("?claimReward")) {
      await claimReward();
      logging = true;
      continue;
    }

    if (html.includes("You have skipped the previous task!")) {
      const match = html.match(/in\s+(?<minutes>\d+)\s+minute\(s\)/i);
      const minutes = match?.groups?.minutes ? parseInt(match.groups.minutes, 10) : 1;
      logMsg(tag, logLevels.Valuable, `Waiting [${minutes}] minutes for new task...`);
      await delay(minutes * 60 * 1000);
      logging = true;
      continue;
    }

    if (html.includes("location.reload();")) {
      logging = true;
      continue;
    }

    if (html.includes("Lucky! There is no task for you!")) {
      logging = true;
      continue;
    }

    if (html.includes("Hatch an egg!")) {
      if (logging) logMsg(tag, logLevels.Valuable, `Task: Hatch an egg. Waiting some minutes to complete...`);
      await delay(WAIT_TIMES.THREE_MINUTES);
      logging = false;
      continue;
    }

    if (html.includes("Make some interactions! (")) {
      if (logging) logMsg(tag, logLevels.Valuable, `Task: Interactions. Waiting some minutes to complete...`);
      await delay(WAIT_TIMES.THREE_MINUTES);
      logging = false;
      continue;
    }

    if (html.includes("Play the Treasure Hunt!")) {
      if (logging) logMsg(tag, logLevels.Valuable, `Task: Treasure Hunt. Waiting some minutes to complete...`);
      await delay(WAIT_TIMES.THREE_MINUTES);
      logging = false;
      continue;
    }

    if (html.includes("Solve some Hangmen!")) {
      if (logging) logMsg(tag, logLevels.Valuable, `Task: Hangmen. Waiting some minutes to complete...`);
      await delay(WAIT_TIMES.ONE_MINUTE);
      logging = false;
      continue;
    }

    if (html.includes("Buy a Plushie at the Dream World Shop")) {
      if (logging) logMsg(tag, logLevels.Valuable, `Task: Plushie...`);
      await doSendPlushieRandomNewVal();
      logging = false;
      continue;
    }

    if (html.includes("Check out the Auction House and bid on an interesting Pokémon! Good luck.")) {
      logMsg(tag, logLevels.Valuable, `Task: Auction...`);
      await bidOnSomeAuction();
      await delay(WAIT_TIMES.THREE_MINUTES);
      continue;
    }

    if (html.includes("Flip the coin! (")) {
      logMsg(tag, logLevels.Valuable, `Task: Coin Flips...`);
      const defaultCoinFlips = 50;
      await doSomeCoinFlips(defaultCoinFlips);
      continue;
    }

    if (html.includes(" at the Higher or Lower Game!")) {
      logMsg(tag, logLevels.Valuable, `Task: Higher or Lower...`);
      const defaultHoLLevel = 10;
      await doSomeHoL(defaultHoLLevel);
      continue;
    }

    if (html.includes("Interact with ")) {
      logMsg(tag, logLevels.Valuable, `Task: Interact with USERNAME. Skipping...`);
      await skipTask();
      continue;
    }

    if (html.includes("Raise your ")) {
      logMsg(tag, logLevels.Valuable, `Task: Raise Pokémon level. Skipping...`);
      await skipTask();
      continue;
    }

    if (html.includes("Feed some berries to Pokémon!")) {
      logMsg(tag, logLevels.Valuable, `Task: Feed Berries. Skipping...`);
      await skipTask();
      continue;
    }

    if (html.includes("Please rate the photographs on a scale from 1 to 10!")) {
      logMsg(tag, logLevels.Valuable, `No more tasks. Rating photos now...`);
      await ratePhotos();

      const msToNextContest = getMsToNextContest();
      logMsg(
        tag,
        logLevels.Valuable,
        `Beauty Contest rating phase. Waiting [${Math.floor(msToNextContest / 1000 / 3600)}] hours until next contest.`,
      );
      await delay(msToNextContest);
      continue;
    }

    if (html.includes("The last Pokémon Beauty Contest has already ended!")) {
      const msToNextContest = getMsToNextContest();
      logMsg(
        tag,
        logLevels.Valuable,
        `Beauty Contest ended. Waiting [${Math.floor(msToNextContest / 1000 / 3600)}] hours until next contest.`,
      );
      await delay(msToNextContest);
      continue;
    }

    // Default fallback for unrecognized html content
    logErr(tag, "New Task in Beauty Contest", html);
    await skipTask();
    await delay(WAIT_TIMES.THIRTY_MINUTES);
  }
}
