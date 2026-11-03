const { discordRequest } = require("./discord");

async function createTicketChannel(guildId, userId, username) {
  const channelName = `ticket-${username}`
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .slice(0, 90);

  return discordRequest(`/guilds/${guildId}/channels`, {
    method: "POST",
    body: JSON.stringify({
      name: channelName,
      type: 0,
      topic: `Ticket owner: ${userId}`,
      permission_overwrites: [
        {
          id: guildId,
          type: 0,
          deny: "1024"
        },
        {
          id: userId,
          type: 1,
          allow: "3072"
        }
      ]
    })
  });
}

async function closeTicketChannel(channelId) {
  return discordRequest(`/channels/${channelId}`, {
    method: "PATCH",
    body: JSON.stringify({
      name: "closed-ticket",
      topic: "This ticket has been closed."
    })
  });
}

module.exports = {
  createTicketChannel,
  closeTicketChannel
};
