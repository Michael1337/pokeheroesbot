export function toNumber(string) {
  return Number(string.replace(/\./g, ""));
}

export function toBoolean(string) {
  if (string === undefined) return false;
  return JSON.parse(string);
}

export function removeWhitespace(string) {
  if (string === undefined) return false;
  return string.replace(/\s+/g, "");
}

export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const responseStatusCodes = {
  OK: 200,
  BadRequest: 400,
  Unauthorized: 401,
  Forbidden: 403,
  NotFound: 404,
  InternalServerError: 500,
};
