import { render, toPlainText } from "@react-email/render";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { Resend } from "resend";
import { z } from "zod";
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

// React escapes text; React Email renders HTML and derives its plain-text version.
// Keep the table layout and inline styles that email clients require.
export async function renderInvitation(
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
  const address = wedding.venue + ", " + wedding.address + ", " + wedding.city;
  const destination =
    wedding.latitude !== null && wedding.longitude !== null
      ? wedding.latitude + "," + wedding.longitude
      : wedding.address + ", " + wedding.city;
  const maps =
    "https://www.google.com/maps/dir/?api=1&destination=" +
    encodeURIComponent(destination);
  const website = env.appOrigin + "/w/" + encodeURIComponent(wedding.publicId);
  const phone = parsePhoneNumberFromString(wedding.phone, "IN");
  // Older saved numbers may predate phone validation.
  const phoneLink = phone
    ? phone.getURI()
    : "tel:" + wedding.phone.replace(/[^+\d]/g, "");
  const initials =
    wedding.brideName.slice(0, 1) + " & " + wedding.groomName.slice(0, 1);
  const linkStyle = { color: "#285447", textDecoration: "underline" };

  const html = await render(
    <html lang="hi">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{subject}</title>
      </head>
      <body
        style={{
          margin: 0,
          background: "#f5f7f1",
          color: "#263c33",
          fontFamily: "Arial,sans-serif",
        }}
      >
        <table
          role="presentation"
          style={{ width: "100%", borderCollapse: "collapse" }}
        >
          <tbody>
            <tr>
              <td style={{ padding: "24px 12px" }}>
                <table
                  role="presentation"
                  style={{
                    width: "100%",
                    maxWidth: 560,
                    margin: "auto",
                    background: "#fffdf8",
                    border: "1px solid #e1e5db",
                    borderRadius: 14,
                  }}
                >
                  <tbody>
                    <tr>
                      <td style={{ padding: "36px 24px", textAlign: "center" }}>
                        <p
                          style={{
                            color: "#976f4e",
                            fontSize: 15,
                            margin: "0 0 18px",
                          }}
                        >
                          ॥ श्री गणेशाय नमः ॥
                        </p>
                        <p
                          style={{
                            color: "#976f4e",
                            font: "24px Georgia,serif",
                            margin: "0 0 18px",
                          }}
                        >
                          {initials}
                        </p>
                        <p style={{ fontSize: 14, color: "#7b6958" }}>
                          स्नेहिल आमंत्रण · शुभ विवाह
                        </p>
                        <h1
                          style={{
                            font: "36px Georgia,serif",
                            color: "#285447",
                            lineHeight: 1.2,
                            margin: "20px 0",
                          }}
                        >
                          {names}
                        </h1>
                        <p
                          style={{
                            color: "#966d57",
                            fontSize: 14,
                            lineHeight: 1.8,
                          }}
                        >
                          के शुभ विवाह के अवसर पर
                          <br />
                          आपकी उपस्थिति सादर प्रार्थनीय है।
                        </p>
                        <hr
                          style={{
                            border: 0,
                            borderTop: "1px solid #e6e5da",
                            margin: "26px 0",
                          }}
                        />
                        <h2 style={{ fontSize: 17, lineHeight: 1.5 }}>
                          आदरणीय {guest.name},
                        </h2>
                        <p
                          style={{
                            fontSize: 14,
                            lineHeight: 1.8,
                            whiteSpace: "pre-line",
                          }}
                        >
                          {message}
                        </p>
                        <table
                          role="presentation"
                          style={{
                            width: "100%",
                            background: "#eef2e9",
                            borderRadius: 10,
                            margin: "24px 0",
                          }}
                        >
                          <tbody>
                            <tr>
                              <td
                                style={{
                                  padding: 22,
                                  textAlign: "center",
                                  lineHeight: 1.8,
                                  fontSize: 14,
                                }}
                              >
                                <strong>
                                  {date} · {wedding.startTime} IST
                                </strong>
                                <br />
                                {address}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                        <p style={{ margin: "28px 0" }}>
                          <a
                            href={website}
                            style={{
                              display: "inline-block",
                              background: "#285447",
                              color: "#fffdf8",
                              padding: "15px 22px",
                              borderRadius: 7,
                              textDecoration: "none",
                              fontSize: 14,
                              fontWeight: "bold",
                            }}
                          >
                            View wedding website
                          </a>
                        </p>
                        <p style={{ fontSize: 13, lineHeight: 2 }}>
                          <a style={linkStyle} href={maps}>
                            Google Maps directions
                          </a>
                          {wedding.youtube && (
                            <>
                              {" "}
                              ·{" "}
                              <a style={linkStyle} href={wedding.youtube}>
                                YouTube livestream
                              </a>
                            </>
                          )}
                        </p>
                        <p style={{ fontSize: 13, lineHeight: 1.8 }}>
                          Need a hand? {wedding.contactRole}
                          <br />
                          <a style={linkStyle} href={phoneLink}>
                            {wedding.phone}
                          </a>
                        </p>
                        <p
                          style={{
                            fontSize: 17,
                            lineHeight: 1.8,
                            color: "#976f4e",
                            marginTop: 26,
                          }}
                        >
                          आपका इंतज़ार रहेगा।
                        </p>
                        <hr
                          style={{
                            border: 0,
                            borderTop: "1px solid #e6e5da",
                            margin: "26px 0",
                          }}
                        />
                        <p
                          style={{
                            fontSize: 11,
                            color: "#6a786b",
                            lineHeight: 1.7,
                          }}
                        >
                          Sent with love, through Make My Marriage.
                          <br />
                          Check the wedding website for the latest details.
                        </p>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>,
  );
  return {
    html,
    text: toPlainText(html, {
      preserveNewlines: true,
      wordwrap: false,
      selectors: [
        { selector: "h1", options: { uppercase: false } },
        { selector: "h2", options: { uppercase: false } },
      ],
    }),
  };
}

// The SDK handles HTTP and response types. Our application still owns send safety.
export const sendWithResend: EmailSender = async (email, key) => {
  if (!env.resendApiKey)
    return { status: "failed", error: "Email sending is not configured." };
  const resend = new Resend(env.resendApiKey);
  const { data, error } = await resend.emails.send(
    { ...email, to: [email.to] },
    { idempotencyKey: key, signal: AbortSignal.timeout(10000) },
  );
  const accepted = z.object({ id: z.string().min(1) }).safeParse(data);
  if (accepted.success)
    return { status: "submitted", providerId: accepted.data.id };

  // Timeouts/server errors do not prove rejection. Reuse the saved key on retry.
  const status = error?.statusCode;
  if (!status || status >= 500 || status === 408 || status === 409)
    return {
      status: "unconfirmed",
      error:
        "The provider result is unclear. Check Resend; a safe retry keeps the same invitation key.",
    };
  if (status === 429)
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
};
