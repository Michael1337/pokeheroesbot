import axios from "axios";
import { sendMail } from "./email.js";

const EMAIL_PRIORITY = 10;

export function sendGotify(title = "PokéHeroes", message = "message", priority = 1) {
  const url = `${process.env.GOTIFY_URL}/message?token=${process.env.GOTIFY_TOKEN}`;
  if (!process.env.GOTIFY_URL || !process.env.GOTIFY_TOKEN) {
    console.log("GOTIFY_URL or GOTIFY_TOKEN not set");
    return;
  }
  const bodyFormData = {
    title: title,
    message: message,
    priority: priority,
  };

  axios({
    method: "post",
    headers: {
      "Content-Type": "application/json",
    },
    url: url,
    data: bodyFormData,
  }).catch((err) => console.log(err.response ? err.response.data : err));

  if (priority >= EMAIL_PRIORITY) {
    sendMail(title, message);
  }
}
