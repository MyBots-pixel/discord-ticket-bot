
const https = require("https");

const API = "https://discord.com/api/v10";

async function discordRequest(endpoint, options = {}) {
  const body = options.body;
  const headers = {
    Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
    Connection: "close",
    ...options.headers
  };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    headers["Content-Length"] = Buffer.byteLength(body);
  }

  return new Promise((resolve, reject) => {
    const request = https.request(
      `${API}${endpoint}`,
      {
        method: options.method || "GET",
        headers,
        timeout: 15000
      },
      response => {
        let responseBody = "";

        response.on("data", chunk => {
          responseBody += chunk;
        });

        response.on("end", () => {
          let data = null;

          try {
            data = responseBody ? JSON.parse(responseBody) : null;
          } catch {
            data = responseBody;
          }

          if (
            response.statusCode >= 200 &&
            response.statusCode < 300
          ) {
            resolve(data);
            return;
          }

          reject(
            new Error(
              `Discord API error ${response.statusCode}: ${JSON.stringify(data)}`
            )
          );
        });
      }
    );

    request.on("timeout", () => {
      request.destroy(new Error("Discord API request timed out."));
    });

    request.on("error", reject);

    if (body !== undefined) {
      request.write(body);
    }

    request.end();
  });
}

module.exports = {
  discordRequest
};
