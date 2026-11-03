const API = "https://discord.com/api/v10";

async function discordRequest(endpoint, options = {}) {
  const response = await fetch(`${API}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
      "Content-Type": "application/json",
      ...options.headers
    }
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      `Discord API error ${response.status}: ${JSON.stringify(data)}`
    );
  }

  return data;
}

module.exports = {
  discordRequest
};
