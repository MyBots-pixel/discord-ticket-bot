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
    const response = await handleInteraction(interaction);

    return res.status(200).json(response);

  } catch (error) {
    console.error(error);
    return res.status(500).send("Internal server error");
  }
};
