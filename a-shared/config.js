import { headers } from "./const.js";
import { logErr } from "./logger.js";

const tag = "CONFIG";
const MESSAGE_ID = process.env.CONFIG_MESSAGE_ID || undefined;

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

function extractConfig(html) {
  const pattern = /<h1 class="headline1">.*?<body>\s*(?<message>.*?)(?:<\/body>)/s;

  const match = html.match(pattern);

  if (match) {
    const messageString = match.groups.message.trim();

    // Remove all \n characters and split the string into lines
    const lines = messageString.replace(/\n/g, "").split("<br>");
    const resultMap = {};

    lines.forEach((line) => {
      if (line.trim()) {
        // Ignore empty lines
        const [key, value] = line.split(":"); // Split into key and value
        let parsedValue = value.trim();

        // Check if the value is a number
        if (!isNaN(parsedValue)) {
          parsedValue = Number(parsedValue);
        }
        // Check if the value is an array (starts with "[" and ends with "]")
        else if (parsedValue.startsWith("[") && parsedValue.endsWith("]")) {
          parsedValue = JSON.parse(parsedValue); // Parse the array string into a real array
        }

        resultMap[key.trim()] = parsedValue; // Add to the map
      }
    });

    return resultMap;
  }

  return ""; // Return an empty string if not found
}

export default async function getConfig(key = "") {
  try {
    if (!MESSAGE_ID) {
      logErr(tag, "Configuration message ID not set", new Error("CONFIG_MESSAGE_ID is not set in .env!"));
      return undefined;
    }
    const html = await (await readMessage(MESSAGE_ID)).text();
    const extractedConfig = extractConfig(html);
    const configs = new Map(Object.entries(extractedConfig));
    return configs && configs.has(key) ? configs.get(key) : undefined;
  } catch (error) {
    logErr(tag, ``, error);
    return undefined;
  }
}
