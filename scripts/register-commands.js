const setupCommand = require("../src/commands/setup");
const ticketCommands = require("../src/commands/ticket");

const commands = [
  {
    name: "ping",
    description: "Check if the bot is online"
  },
  setupCommand,
  ...ticketCommands
];

async function registerCommands() {
  const applicationId = process.env.DISCORD_APPLICATION_ID;
  const guildId = process.env.DISCORD_GUILD_ID;
  const token = process.env.DISCORD_BOT_TOKEN;

  if (!applicationId || !guildId || !token) {
    throw new Error("Missing Discord environment variables.");
  }

  const response = await fetch(
    `https://discord.com/api/v10/applications/${applicationId}/guilds/${guildId}/commands`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bot ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(commands)
    }
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(JSON.stringify(result));
  }

  console.log("All commands registered successfully!");
}

registerCommands().catch(console.error);
