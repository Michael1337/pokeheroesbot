import { headers } from "../a-shared/const.js";
import { logMsg, logErr, logLevels } from "../a-shared/logger.js";
import { sendGotify } from "../a-shared/gotify.js";

const tag = "PRIVATE MESSAGES";
const MAX_PM_AGE = 5;
const GOTIFY_PRIORITY = 10;

function viewMessages() {
  return fetch("https://pokeheroes.com/pm_inbox", {
    headers: headers,
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

function readMessage(messageId) {
  return fetch(`https://pokeheroes.com/pm_read?id=${messageId}`, {
    headers: headers,
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

function checkRecentPM(html) {
  const regex = /(?<time>\d+)\s+(?<unit>Second|Seconds|Minute|Minutes)\s+ago/gi;
  const matches = html.matchAll(regex);

  for (const match of matches) {
    const {
      groups: { time, unit },
    } = match;
    const numericTime = parseInt(time, 10);

    if (
      unit.toLowerCase().startsWith("second") ||
      (unit.toLowerCase().startsWith("minute") && numericTime <= MAX_PM_AGE)
    ) {
      return true;
    }
  }

  return false;
}

function getNewestMessageId(html) {
  const regex = /pm_read\?id=(?<id>\d+)/;
  const match = html.match(regex);
  return match?.groups?.id || null;
}

function extractMessageInfo(html) {
  const pattern =
    /<h1 class="headline1">\s*(?<topic>.*?)\s*<\/h1>.*?<div id="post_field".*?<a href='userprofile\?name=(?<username>[^']+)'>.*?Sent:\s*(?<datetime>[^<]+).*?<body>\s*(?<message>.*?)(?:<\/body>)/s;

  const match = html.match(pattern);

  if (match) {
    const { groups } = match;
    return {
      topic: groups.topic.trim(),
      username: groups.username,
      datetime: groups.datetime.trim(),
      message: groups.message.trim(),
    };
  }

  return null;
}

/**
 * Checks private messages.
 */
export async function checkMessages() {
  try {
    let html = await (await viewMessages()).text();
    logMsg(tag, logLevels.Debug, `Checking if new private messages are present...`);

    const anyRecentPM = checkRecentPM(html);

    if (anyRecentPM) {
      const messageId = getNewestMessageId(html);
      if (messageId == process.env.CONFIG_MESSAGE_ID) return;

      html = await (await readMessage(messageId)).text();
      const messageInfo = extractMessageInfo(html);

      sendGotify(
        `${messageInfo.datetime} | ${messageInfo.username} | ${messageInfo.topic}`,
        `${messageInfo.message}`,
        GOTIFY_PRIORITY,
      );
      logMsg(
        tag,
        logLevels.Debug,
        `Received a new message at [${messageInfo.datetime}] from [${messageInfo.username}] with tpic [${messageInfo.topic}]. Message: [${messageInfo.message}]`,
      );
      return;
    }
  } catch (error) {
    logErr(tag, ``, error);
  }
}
