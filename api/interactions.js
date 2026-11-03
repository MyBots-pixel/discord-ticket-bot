
const https = require("https");
const { verifyKey } = require("discord-interactions");
const { handleInteraction } = require("../src/handlers/interactions");

function discordWebhookRequest(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);

    const request = https.request(
      {
        hostname: "discord.com",
        path,
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(data),
          "Connection": "close"
        },
        timeout: 15000
      },
      response => {
        let responseBody = "";

        response.on("data", chunk => {
          responseBody += chunk;
        });

        response.on("end", () => {
          if (response.statusCode >= 200 && response.statusCode < 300) {
            resolve(responseBody);
          } else {
            reject(
              new Error(
                `Discord webhook error ${response.statusCode}: ${responseBody}`
              )
            );
          }
        });
      }
    );

    request.on("timeout", () => {
      request.destroy(new Error("Discord webhook request timed out."));
    });

    request.on("error", reject);
    request.end(data);
  });
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  try {
    const chunks = [];

    for await (const chunk of req) {
      chunks.push(chunk);
    }

    const rawBody = Buffer.concat(chunks);

    const valid = await verifyKey(
      rawBody,
      req.headers["x-signature-ed25519"],
      req.headers["x-signature-timestamp"],
      process.env.DISCORD_PUBLIC_KEY
    );

    if (!valid) {
      return res.status(401).send("Invalid signature");
    }

    const interaction = JSON.parse(rawBody.toString("utf8"));

    if (interaction.type === 1) {
      return res.status(200).json({ type: 1 });
    }

    res.status(200).json({
      type: 5,
      data: { flags: 64 }
    });

    const webhookPath =
      `/api/v10/webhooks/${interaction.application_id}/` +
      `${interaction.token}/messages/@original`;

    try {
      const result = await handleInteraction(interaction);

      await discordWebhookRequest(
        webhookPath,
        result?.data || {
          content: "The action has been completed."
        }
      );
    } catch (error) {
      console.error("Interaction processing error:", error);

      try {
        await discordWebhookRequest(webhookPath, {
          content: "❌ Something went wrong while processing that action.",
          components: []
        });
      } catch (updateError) {
        console.error("Could not update Discord interaction:", updateError);
      }
    }
  } catch (error) {
    console.error("Request error:", error);

    if (!res.headersSent) {
      return res.status(500).send("Internal server error");
    }
  }
};

module.exports.config = {
  api: {
    bodyParser: false
  }
};
