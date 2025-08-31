import { load } from "cheerio";
import { headers } from "../../a-shared/const.js";
import { logMsg, logErr, logLevels } from "../../a-shared/logger.js";
import getConfig from "../../a-shared/config.js";

const tag = "COOKING";

function viewBoard() {
  return fetch("https://pokeheroes.com/bulletinboard", {
    headers: headers,
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

function orderDetail(order = 0) {
  return fetch("https://pokeheroes.com/includes/ajax/bulletin/orderDetail.php", {
    headers: headers,
    referrer: "https://pokeheroes.com/bulletinboard",
    body: `order=${order}`,
    method: "POST",
    mode: "cors",
    credentials: "include",
  });
}

function removeTask(task = 0) {
  return fetch(`https://pokeheroes.com/bulletinboard?remTask=${task}`, {
    headers: headers,
    referrer: "https://pokeheroes.com/bulletinboard",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

function _validateBerries() {
  return fetch("https://pokeheroes.com/includes/ajax/berrygarden/berrySelectionValidator.php", {
    headers: headers,
    referrer: "https://pokeheroes.com/bulletinboard",
    body: "berryArr=%26berries%5B'Lansat'%5D%5B10%5D%3D69%26berries%5B'Lansat'%5D%5B11%5D%3D0%26berries%5B'Lansat'%5D%5B12%5D%3D0%26berries%5B'Lansat'%5D%5B13%5D%3D0%26berries%5B'Lansat'%5D%5B14%5D%3D0&formid=bulletinDeliverSelection0",
    method: "POST",
    mode: "cors",
    credentials: "include",
  });
}

function deliverOrder(id, deadline, additionalQuery) {
  return fetch("https://pokeheroes.com/bulletinboard", {
    headers: headers,
    referrer: "https://pokeheroes.com/bulletinboard",
    body: `deliverOrder=${id}&deliverDeadline=${deadline}&${additionalQuery}`,
    method: "POST",
    mode: "cors",
    credentials: "include",
  });
}

function loadPot() {
  return fetch("https://pokeheroes.com/toolshed", {
    headers: headers,
    referrerPolicy: "strict-origin-when-cross-origin",
    body: null,
    method: "GET",
    mode: "cors",
    credentials: "include",
  });
}

function loadRecipe(recipeId = 1) {
  return fetch("https://pokeheroes.com/includes/ajax/cooking/loadRecipe.php", {
    headers: headers,
    referrer: "https://pokeheroes.com/toolshed",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: `recipe=${recipeId}&maxAmount=1`,
    method: "POST",
    mode: "cors",
    credentials: "include",
  });
}

function cook(ingredients = "") {
  return fetch("https://pokeheroes.com/toolshed", {
    headers: headers,
    referrer: "https://pokeheroes.com/toolshed",
    referrerPolicy: "strict-origin-when-cross-origin",
    body: `${ingredients}`,
    method: "POST",
    mode: "cors",
    credentials: "include",
  });
}

function claimOutcome(name) {
  return fetch("https://pokeheroes.com/includes/ajax/cooking/claimOutcome.php", {
    headers: headers,
    referrer: "https://pokeheroes.com/toolshed",
    body: `dish=${name}`,
    method: "POST",
    mode: "cors",
    credentials: "include",
  });
}

function createCookingString(html) {
  const $ = load(html);

  const form = $("form").first();

  const cookRecipe = form.find('input[name="cookRecipe"]').val() || "1";
  const levelSelection = form.find('input[name="levelSelection"]:checked')?.val();
  const cookAmount = form.find('input[name="cookAmount"]')?.val();

  const berryValues = [];

  form.find('div[class^="recipeBerry"]').each((_, berryDiv) => {
    const $berryDiv = $(berryDiv);

    // Get class name(s) and extract the berry name by removing the "recipeBerry" prefix
    // Assuming there's only one class that starts with 'recipeBerry'
    const classes = $berryDiv.attr("class").split(/\s+/);
    const berryClass = classes.find((c) => c.startsWith("recipeBerry"));
    const berryName = berryClass ? berryClass.replace("recipeBerry", "") : "";

    // Select inputs whose name attribute starts with 'recipe' + berryName
    $berryDiv.find(`input[name^="recipe${berryName}"]`).each((_, input) => {
      const $input = $(input);
      berryValues.push(`${$input.attr("name")}=${$input.val()}`);
    });
  });

  return `cookRecipe=${cookRecipe}&${berryValues.join("&")}&levelSelection=${levelSelection}&cookAmount=${cookAmount}`;
}

function getLastCookingTime(html) {
  const regex = /<span class="active_countdown"[^>]*>in (?<timeText>[^<]+)<\/span>/g;

  let lastMatch;
  let match;

  while ((match = regex.exec(html)) !== null) {
    lastMatch = match.groups.timeText;
  }

  return lastMatch;
}

function parseBulletinTasks(html) {
  const tasks = [];
  const taskRegex = /<div class="bulletinExtendedView(?<id>\d+)"[\s\S]*?<\/div>\s*<\/div>/g;
  let match;
  while ((match = taskRegex.exec(html))) {
    const taskId = match.groups.id;
    const taskPaper = match[0];

    // --- Required items ---
    const reqMatch = taskPaper.match(/<b>Required Items:<\/b><div[^>]*>(?<requiredItems>[\s\S]*?)<\/div>/i);
    let requireditems = [];
    if (reqMatch) {
      const lines = reqMatch.groups.requiredItems.split(/<br\s*\/?>/);
      requireditems = lines
        .map((line) => {
          if (!line.includes("img")) return null;

          const item = {};
          const imgMatch = line.match(/img\/items\/(?:.+?)\.(?:png|gif)/i);
          if (!imgMatch) return null;

          item.completed = /<font\s+color=green/.test(line);
          const amountMatch = line.match(/(?:[>\d;])\s*(?<amount>\d+)x\s*(?<itemName>.+?)\s*$/);
          item.itemName = amountMatch.groups.itemName;
          item.amount = amountMatch ? parseInt(amountMatch.groups.amount, 10) : null;

          return item;
        })
        .filter(Boolean);
    }

    // --- Rewards ---
    let rewards = [];
    const rewMatch = taskPaper.match(/<b>Rewards:<\/b><div[^>]*>(?<rewards>[\s\S]*?)<\/div>/i);
    if (rewMatch) {
      const rewardsHtml = rewMatch.groups.rewards;
      const rewardRegex = /img\/items\/(?<name>[\w-]+)\.png[^>]*>\s*(?<amount>[\d,]+)?\s*/g;

      rewards = [];
      let m;
      while ((m = rewardRegex.exec(rewardsHtml)) !== null) {
        const name = m.groups.name;
        const amountStr = m.groups.amount;
        const amount = parseInt(amountStr?.replace(/,/g, ""), 10) || 1;
        rewards.push({ name, amount });
      }
    }

    tasks.push({
      id: parseInt(taskId, 10),
      requireditems,
      rewards,
    });
  }

  return tasks;
}

function parseBulletinTaskDetails(html) {
  const deadlineMatch = html.match(/name=["']deliverDeadline["']\s+value=["']?(?<deadline>\d+)["']?/i);
  let timeLeftMS = null;
  let deadlineUnix = null;

  if (deadlineMatch && deadlineMatch.groups?.deadline) {
    deadlineUnix = parseInt(deadlineMatch.groups.deadline, 10);
    const nowUnix = Math.floor(Date.now() / 1000);
    const secondsLeft = deadlineUnix - nowUnix;
    timeLeftMS = secondsLeft > 0 ? secondsLeft * 1000 : 0;
  }

  const requireditems = [];
  const itemStockRegex =
    /<span[^>]*>\s*<img[^>]+\/items\/(?:.+?)\.(?:png|gif)[^>]*>\s*(?<amount>\d+)x (?<name>[^<]+?) <.*?>\(Your stock:\s*(?<stock>\d+)\)<\/font>/g;

  let match;
  while ((match = itemStockRegex.exec(html)) !== null) {
    const name = match.groups.name;
    const amount = parseInt(match.groups.amount, 10);
    const stock = parseInt(match.groups.stock, 10);
    const missing = Math.max(amount - stock, 0);
    const completed = missing === 0;

    requireditems.push({ name, amount, stock, missing, completed });
  }

  // Berry string in case berries need to be delivered
  const berryInputRegex =
    /<input[^>]+name=["']?(?<name>order\w+Berry\d+)["']?[^>]*value=["']?(?<value>\d+)["']?[^>]*>/g;
  const berryOrders = {};
  while ((match = berryInputRegex.exec(html)) !== null) {
    const inputName = match.groups.name;
    const inputValue = match.groups.value;
    berryOrders[inputName] = inputValue;
  }
  const berryQueryString = Object.entries(berryOrders)
    .map(([name, value]) => `${encodeURIComponent(name)}=${encodeURIComponent(value)}`)
    .join("&");

  const isDisabled = /<input[^>]*type=["']submit["'][^>]*value=["']Deliver["'][^>]*disabled[^>]*>/i.test(html);

  return {
    requireditems,
    berryQueryString,
    deliverEnabled: !isDisabled,
    deadline: deadlineUnix,
    timeLeft: timeLeftMS,
  };
}

async function enrichTasksWithDetails(tasks) {
  for (const task of tasks) {
    const detailHtml = await (await orderDetail(task.id)).text();
    const details = parseBulletinTaskDetails(detailHtml);

    task.requireditems = details.requireditems;
    task.deadline = details.deadline;
    task.timeLeft = details.timeLeft;
    task.completed = details.deliverEnabled;
    task.berryQueryString = details.berryQueryString;
  }
}

async function removeOrders(allOrders, orderToKeep) {
  // Remove all tasks that require seeds, since we want to plant the seeds.
  // Also, if orders is not "All", keep all orders that include the name of the reward (Usually "Powder").
  const badOrders = allOrders.filter(
    (order) =>
      order.requireditems.some((item) => item.name.toLowerCase().includes("seed") && item.stock <= item.amount + 1) ||
      (order === "All"
        ? false
        : !order.rewards.some((reward) => reward.name.toLowerCase().includes(orderToKeep.toLowerCase()))),
  );

  if (badOrders.length > 0) {
    await Promise.all(badOrders.map((task) => removeTask(task.id)));
    logMsg(
      tag,
      logLevels.Debug,
      `Removed ${badOrders.length} task(s) from the bulletin board searching for [${orderToKeep}].`,
    );

    // Remove the badOrders from the orders array in-place
    const removedIds = new Set(badOrders.map((task) => task.id));
    for (let i = allOrders.length - 1; i >= 0; i--) {
      if (removedIds.has(allOrders[i].id)) {
        allOrders.splice(i, 1);
      }
    }
  }
}

async function completeOrders(tasks) {
  // Only complete the task with the soonest deadline because otherwise some tasks that could be completed may lose their resources by completing other tasks.
  if (tasks.length == 0) return;
  const soonestTask = tasks.reduce((min, curr) => (curr.deadline < min.deadline ? curr : min));
  if (soonestTask.completed) {
    await deliverOrder(soonestTask.id, soonestTask.deadline, soonestTask.berryQueryString);
    logMsg(tag, logLevels.Valuable, `Completed task ${soonestTask.id} from the bulletin board.`);

    // Remove the task from the tasks array in-place
    const idx = tasks.findIndex((task) => task.id === soonestTask.id);
    if (idx !== -1) tasks.splice(idx, 1);
  }
}

function getMissingItems(task) {
  return task.requireditems
    .filter((item) => !item.completed)
    .map((item) => ({ name: item.name, missing: item.missing }));
}

function parseRecipes(html) {
  // Regex to capture each recipe row's key parts:
  // Assumes each recipe is in a single <tr> row with several <td> as described
  const recipeRegex =
    /<td><b>(?<name>[^<]+)<\/b><\/td>\s*<td><i>(?<time>[^<]+)<\/i><\/td>\s*<td>(?<temperature>[^<]+)<\/td>\s*<td>(?<ingredients>(?:<span[^>]+>.*?<\/span>\s*)+)<\/td>\s*<td><a\s+(?<onclick>onclick="[^"]+")>[^<]+<\/a><\/td>/gi;

  // Ingredient regex inside the ingredients html capture
  // Extracts title attribute for name, then parses stock and required from e.g. "Razz Berry: 3510/5 required."
  const ingredientRegex = /<span[^>]*title='(?<name>[^:]+):\s*(?<stock>\d+)\/(?<required>\d+)\s*required\.?'[^>]*>/gi;

  const recipes = [];
  let match;

  while ((match = recipeRegex.exec(html)) !== null) {
    const { name, time, temperature, ingredients, onclick } = match.groups;

    // Parse ingredients details
    const ingredientList = [];
    let ingMatch;
    while ((ingMatch = ingredientRegex.exec(ingredients)) !== null) {
      const ingName = ingMatch.groups.name.trim();
      const stock = parseInt(ingMatch.groups.stock, 10);
      const required = parseInt(ingMatch.groups.required, 10);
      const enough = stock >= required;

      ingredientList.push({
        name: ingName,
        stock,
        required,
        enough,
      });
    }

    // Extract the id from the onclick, e.g. openCookingSelection(1, 'Razz Shake', 7);
    const idMatch = onclick.match(/openCookingSelection\((?<id>\d+),/);
    const recipeId = idMatch ? parseInt(idMatch?.groups?.id, 10) : null;

    recipes.push({
      id: recipeId,
      name: name.trim(),
      time: time.trim(),
      temperature: temperature.trim(),
      ingredients: ingredientList,
      onclick,
      cookingString: null,
    });
  }

  return recipes;
}

async function enrichRecipe(recipe) {
  if (recipe.id == null) return recipe;

  try {
    const recipeHTML = await (await loadRecipe(recipe.id)).text();
    recipe.cookingString = createCookingString(recipeHTML);
  } catch (err) {
    logErr(tag, `Failed to load recipe id ${recipe.id}`, err);
  }
  return recipe;
}

async function enrichRecipes(recipes) {
  for (const recipe of recipes) {
    await enrichRecipe(recipe);
  }
  return recipes;
}

async function enrichRecipesWithCookingString(input) {
  if (Array.isArray(input)) {
    return enrichRecipes(input);
  } else if (input && typeof input === "object") {
    return enrichRecipe(input);
  }
  throw new TypeError("Input must be a recipe object or an array of recipe objects");
}

function findBestRecipeForItem(recipesHTML, itemToCook) {
  const recipes = parseRecipes(recipesHTML);

  // Step 1: Get all recipes that create the desired item
  const matchingRecipes = recipes.filter((recipe) => recipe.name.includes(itemToCook.name));

  // Step 2: Calculate the max number of times each recipe can be made
  function getMaxMakeCount(recipe) {
    // For each ingredient, calculate how many times it can be used
    // The limiting ingredient (lowest stock/required) determines the count
    return Math.min(...recipe.ingredients.map((ing) => Math.floor(ing.stock / ing.required)));
  }

  // TODO: Also check if possible to cook at all, i.e. if all ingredients are available.

  // Step 3: Find the recipe with the highest max make count
  const bestRecipe = matchingRecipes.reduce((best, current) => {
    const currentCount = getMaxMakeCount(current);
    if (!best || currentCount > getMaxMakeCount(best)) {
      return current;
    }
    return best;
  }, null);

  return bestRecipe;
}

async function cookMissingItems(tasks) {
  if (tasks.length == 0) return;
  // TODO: Check item market and if is "cheap", then buy
  const soonestTask = tasks.reduce((min, curr) => (curr.deadline < min.deadline ? curr : min));
  const missingItems = getMissingItems(soonestTask);

  const itemWithLeastMissing = missingItems.reduce((minItem, current) => {
    return current.missing < minItem.missing ? current : minItem;
  }, missingItems[0]);

  const recipeHTML = await (await loadPot()).text();

  // Claim items
  [...recipeHTML.matchAll(/onclick="claimCookingDish\('(?<name>[^']+)',\s*(?<amount>\d+)\);"/g)]
    .map(({ groups: { name, amount } }) => ({
      name: encodeURIComponent(name),
      amount: Number(amount),
    }))
    .forEach((obj) => claimOutcome(obj.name));

  if (
    !recipeHTML.includes("Click on the pot to start cooking!") ||
    recipeHTML.includes("Cooking Queue") ||
    recipeHTML.includes("Last one finished")
  ) {
    const lastCookingFinished = getLastCookingTime(recipeHTML);
    logMsg(
      tag,
      logLevels.Debug,
      `Already cooking some meals. Have to wait at least [${lastCookingFinished}] before last item is finished.`,
    );
    return;
  }

  const missingItemRecipe = findBestRecipeForItem(recipeHTML, itemWithLeastMissing);

  await enrichRecipesWithCookingString(missingItemRecipe);

  const recipe = missingItemRecipe.cookingString;

  const cookHTML = await (await cook(recipe)).text();
  const match = cookHTML.match(/<div id='redfield'>(?<content>.*?)<\/div>/);
  if (match && match.groups.content && !match.groups.content.includes("You can't cook more than")) {
    // If dish could not be cooked and it is not because of limit, report the problem.
    logErr(tag, `Error when cooking, line 391`, `Error: [${match[1]}]`);
  } else {
    logMsg(tag, logLevels.Interesting, `Cooking recipe [${missingItemRecipe.name}] for [${missingItemRecipe.time}].`);
  }
}

export async function findBerryForOrder() {
  const html = await (await viewBoard()).text();
  const tasks = parseBulletinTasks(html);
  await enrichTasksWithDetails(tasks);

  const berryTaskWithItem = tasks
    .map((task) => task.requireditems.find((item) => item.name.toLowerCase().endsWith("berry") && item.missing > 0))
    .find((result) => result);

  return berryTaskWithItem?.name.trim().split(" ")[0] || null;
}

export async function handleBulletinBoard() {
  try {
    const order = await getConfig("BULLETIN_ORDERS");
    if (order == null || order == "None") return;
    const ordersHTML = await (await viewBoard()).text();
    const orders = parseBulletinTasks(ordersHTML);
    await enrichTasksWithDetails(orders);
    await removeOrders(orders, order);
    if (orders.length == 0) return;
    await completeOrders(orders);
    await cookMissingItems(orders);
  } catch (error) {
    logErr(tag, `Error while loading bulletin board:`, error);
    return;
  }
}
