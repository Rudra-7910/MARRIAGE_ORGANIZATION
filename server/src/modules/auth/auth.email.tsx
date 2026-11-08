import { render, toPlainText } from "@react-email/render";

export async function passwordResetEmail(url: string) {
  const html = await render(
    <html lang="en">
      <body
        style={{
          margin: 0,
          background: "#faf9f6",
          fontFamily: "Arial, sans-serif",
          color: "#233d33",
        }}
      >
        <table
          role="presentation"
          style={{ width: "100%", padding: "40px 20px" }}
        >
          <tbody>
            <tr>
              <td>
                <table
                  role="presentation"
                  style={{
                    maxWidth: 560,
                    margin: "auto",
                    background: "#ffffff",
                    padding: 32,
                  }}
                >
                  <tbody>
                    <tr>
                      <td>
                        <p>MAKE MY MARRIAGE</p>
                        <h1>Let’s get you back to your plans.</h1>
                        <p>
                          Use this link to choose a new password. It expires in
                          15 minutes and works once.
                        </p>
                        <p style={{ padding: "16px 0" }}>
                          <a
                            href={url}
                            style={{
                              background: "#285447",
                              color: "#ffffff",
                              padding: "14px 22px",
                              textDecoration: "none",
                              borderRadius: 8,
                            }}
                          >
                            Reset your password
                          </a>
                        </p>
                        <p>
                          After resetting, sign in with your new password. Your
                          other sessions will be signed out.
                        </p>
                        <p>
                          If you didn’t request this, ignore this email. Your
                          password has not changed.
                        </p>
                        <p style={{ fontSize: 12, wordBreak: "break-all" }}>
                          Button not opening? Copy this link into your browser:{" "}
                          {url}
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
  return { html, text: toPlainText(html) };
}
