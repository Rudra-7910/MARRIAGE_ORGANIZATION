import { env } from "../../config/env.js";
import type { Wedding } from "../weddings/wedding.models.js";

export type EmailPayload = {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
};
export type SendResult =
  | { status: "submitted"; providerId: string }
  | { status: "failed" | "unconfirmed"; error: string };
export type EmailSender = (
  email: EmailPayload,
  key: string,
) => Promise<SendResult>;

function escape(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character]!,
  );
}

export function invitationDefaults(wedding: InstanceType<typeof Wedding>) {
  return {
    subject:
      `शुभ विवाह निमंत्रण: ${wedding.brideName} & ${wedding.groomName} · ${wedding.city}`.slice(
        0,
        240,
      ),
    message:
      "ईश्वर की कृपा और अपने बड़ों के आशीर्वाद से, हम अपने जीवन की नई शुरुआत करने जा रहे हैं। इस शुभ विवाह में सपरिवार पधारकर हमें अपने स्नेह और आशीर्वाद से अनुगृहीत करें। आपकी उपस्थिति ही हमारे लिए सबसे सुंदर उपहार है।",
  };
}

export function renderInvitation(
  wedding: InstanceType<typeof Wedding>,
  guest: { name: string },
  subject: string,
  message: string,
) {
  const names = wedding.brideName + " & " + wedding.groomName;
  const date = new Date(wedding.date + "T12:00:00+05:30").toLocaleDateString(
    "en-IN",
    {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Asia/Kolkata",
    },
  );
  const dateTime = date + " · " + wedding.startTime + " IST";
  const address = wedding.venue + ", " + wedding.address + ", " + wedding.city;
  const destination =
    wedding.latitude !== null && wedding.longitude !== null
      ? wedding.latitude + "," + wedding.longitude
      : wedding.address + ", " + wedding.city;
  const maps =
    "https://www.google.com/maps/dir/?api=1&destination=" +
    encodeURIComponent(destination);
  const website = env.appOrigin + "/w/" + encodeURIComponent(wedding.publicId);
  const phone = "tel:" + wedding.phone.replace(/[^+\d]/g, "");
  const initials =
    wedding.brideName.slice(0, 1) + " & " + wedding.groomName.slice(0, 1);
  const linkStyle = 'style="color:#285447;text-decoration:underline"';
  // Tables and inline CSS work in email clients. No scripts, remote fonts or tracking pixels.
  const html = `<!doctype html><html lang="hi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(subject)}</title></head>
<body style="margin:0;background:#f5f7f1;color:#263c33;font-family:Arial,sans-serif">
<table role="presentation" style="width:100%;border-collapse:collapse"><tr><td style="padding:24px 12px">
<table role="presentation" style="width:100%;max-width:560px;margin:auto;background:#fffdf8;border:1px solid #e1e5db;border-radius:14px"><tr><td style="padding:36px 24px;text-align:center">
<p style="color:#976f4e;font-size:15px;margin:0 0 18px">॥ श्री गणेशाय नमः ॥</p>
<p style="color:#976f4e;font:24px Georgia,serif;margin:0 0 18px">${escape(initials)}</p>
<p style="font-size:14px;color:#7b6958">स्नेहिल आमंत्रण · शुभ विवाह</p>
<h1 style="font:36px Georgia,serif;color:#285447;line-height:1.2;margin:20px 0">${escape(names)}</h1>
<p style="color:#966d57;font-size:14px;line-height:1.8">के शुभ विवाह के अवसर पर<br>आपकी उपस्थिति सादर प्रार्थनीय है।</p>
<hr style="border:0;border-top:1px solid #e6e5da;margin:26px 0">
<h2 style="font-size:17px;line-height:1.5">आदरणीय ${escape(guest.name)},</h2>
<p style="font-size:14px;line-height:1.8;white-space:pre-line">${escape(message)}</p>
<table role="presentation" style="width:100%;background:#eef2e9;border-radius:10px;margin:24px 0"><tr><td style="padding:22px;text-align:center;line-height:1.8;font-size:14px"><strong>${escape(dateTime)}</strong><br>${escape(address)}</td></tr></table>
<p style="margin:28px 0"><a href="${escape(website)}" style="display:inline-block;background:#285447;color:#fffdf8;padding:15px 22px;border-radius:7px;text-decoration:none;font-size:14px;font-weight:bold">View wedding website</a></p>
<p style="font-size:13px;line-height:2"><a ${linkStyle} href="${escape(maps)}">Google Maps directions</a>${wedding.youtube ? ` &nbsp;·&nbsp; <a ${linkStyle} href="${escape(wedding.youtube)}">YouTube livestream</a>` : ""}</p>
<p style="font-size:13px;line-height:1.8">Need a hand? ${escape(wedding.contactRole)}<br><a ${linkStyle} href="${escape(phone)}">${escape(wedding.phone)}</a></p>
<p style="font-size:17px;line-height:1.8;color:#976f4e;margin-top:26px">आपका इंतज़ार रहेगा।</p>
<hr style="border:0;border-top:1px solid #e6e5da;margin:26px 0"><p style="font-size:11px;color:#6a786b;line-height:1.7">Sent with love, through Make My Marriage.<br>Check the wedding website for the latest details.</p>
</td></tr></table></td></tr></table></body></html>`;
  const text = `॥ श्री गणेशाय नमः ॥\n\nशुभ विवाह · स्नेहिल आमंत्रण\n${names}\n\nआदरणीय ${guest.name},\n\n${message}\n\n${dateTime}\n${address}\n\nWedding website: ${website}\nDirections: ${maps}\n${wedding.youtube ? "YouTube livestream: " + wedding.youtube + "\n" : ""}Contact: ${wedding.contactRole} — ${wedding.phone}\n\nआपका इंतज़ार रहेगा।\nCheck the wedding website for the latest details.`;
  return { html, text };
}


export const sendWithResend: EmailSender = async (email, key) => {
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + env.resendApiKey,
        "Content-Type": "application/json",
        "Idempotency-Key": key,
      },
      body: JSON.stringify({ ...email, to: [email.to] }),
      signal: AbortSignal.timeout(10000),
      redirect: "error",
    });
    if (response.ok) {
      const data: unknown = await response.json();
      if (
        data &&
        typeof data === "object" &&
        "id" in data &&
        typeof data.id === "string" &&
        data.id
      )
        return { status: "submitted", providerId: data.id };
      return {
        status: "unconfirmed",
        error:
          "The email provider returned an unexpected result. Check Resend before trying again.",
      };
    }
    // Network/server errors and idempotency conflicts do not prove rejection.
    if (
      response.status >= 500 ||
      response.status === 408 ||
      response.status === 409
    )
      return {
        status: "unconfirmed",
        error:
          "The provider result is unclear. Check Resend; a safe retry keeps the same invitation key.",
      };
    if (response.status === 429)
      return {
        status: "failed",
        error:
          "The email provider is busy or its quota is reached. Wait a little before retrying.",
      };
    return {
      status: "failed",
      error:
        "Resend rejected this email. Check the recipient, API key, verified sender and account restrictions before retrying.",
    };
  } catch {
    return {
      status: "unconfirmed",
      error:
        "The request timed out or the connection failed. The email may have been accepted. Check Resend before retrying.",
    };
  }
};
