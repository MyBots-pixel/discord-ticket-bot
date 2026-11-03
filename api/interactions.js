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

    const interaction = JSON.parse(
      rawBody.toString("utf8")
    );

    // Discord PING verification must receive an immediate PONG.
    if (interaction.type === 1) {
      return res.status(200).json({ type: 1 });
    }

    // Acknowledge the interaction immediately.
    // This gives the handler more time to complete its work.
    res.status(200).json({
      type: 5,
      data: {
        flags: 64
      }
    });

    try {
      const result = await handleInteraction(interaction);

      // Update the deferred response with the handler's result.
      const responseData = result?.data || {
        content: "The action has been completed."
      };

      const editResponse = await fetch(
        `https://discord.com/api/v10/webhooks/${interaction.application_id}/${interaction.token}/messages/@original`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(responseData)
        }
      );

      if (!editResponse.ok) {
        const error = await editResponse.text();
        console.error(
          "Could not update interaction response:",
          error
        );
      }
    } catch (error) {
      console.error("Interaction processing error:", error);

      await fetch(
        `https://discord.com/api/v10/webhooks/${interaction.application_id}/${interaction.token}/messages/@original`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            content: "❌ Something went wrong while processing that action.",
            components: []
          })
        }
      );
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
