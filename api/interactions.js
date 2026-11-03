
const { verifyKey } = require("discord-interactions");
const { handleInteraction } = require("../src/handlers/interactions");

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

    // Reply directly to /ping without another network request.
    if (
      interaction.type === 2 &&
      interaction.data?.name === "ping"
    ) {
      return res.status(200).json({
        type: 4,
        data: {
          content: "Pong!"
        }
      });
    }

    // Acknowledge all other interactions immediately.
    res.status(200).json({
      type: 5,
      data: { flags: 64 }
    });

    try {
      const result = await handleInteraction(interaction);

      const responseData = result?.data || {
        content: "The action has been completed."
      };

      const response = await fetch(
        `https://discord.com/api/v10/webhooks/${interaction.application_id}/${interaction.token}/messages/@original`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "Connection": "close"
          },
          body: JSON.stringify(responseData)
        }
      );

      if (!response.ok) {
        console.error(
          "Could not update Discord interaction:",
          response.status,
          await response.text()
        );
      }
    } catch (error) {
      console.error("Interaction processing error:", error);
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
