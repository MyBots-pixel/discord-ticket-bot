const { verifyKey } = require("discord-interactions");

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
    const signature = req.headers["x-signature-ed25519"];
    const timestamp = req.headers["x-signature-timestamp"];

    const isValid = await verifyKey(
      rawBody,
      signature,
      timestamp,
      process.env.DISCORD_PUBLIC_KEY
    );

    if (!isValid) {
      return res.status(401).send("Invalid request signature");
    }

    const interaction = JSON.parse(rawBody.toString("utf8"));

    // Discord checks that the bot endpoint is working.
    if (interaction.type === 1) {
      return res.status(200).json({ type: 1 });
    }

    return res.status(200).json({
      type: 4,
      data: {
        content: "The ticket bot is online!",
        flags: 64
      }
    });

  } catch (error) {
    console.error("Discord interaction error:", error);
    return res.status(500).send("Internal server error");
  }
};
