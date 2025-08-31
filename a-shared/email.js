import nodemailer from "nodemailer";
import { logErr, logLevels, logVal } from "./logger.js";

const tag = "EMAIL";

const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export async function sendMail(subject, text) {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: process.env.EMAIL_USER,
    subject: `[Pokéheroes.com] ${subject}`,
    text,
  };
  try {
    const info = await transporter.sendMail(mailOptions);
    logVal(tag, logLevels.Important, `Email sent with subject [${mailOptions.subject}].`, info.response);
    return info;
  } catch (error) {
    logErr(tag, "Error sending email:", error);
    throw error;
  }
}
