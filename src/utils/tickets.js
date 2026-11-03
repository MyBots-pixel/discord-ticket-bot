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
      topic: `Ticket owner: ${userId} | Status: open`,
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
  const channel = await discordRequest(`/channels/${channelId}`);

  const ownerId = channel.topic?.match(
    /Ticket owner: (\d+)/
  )?.[1];

  if (!ownerId) {
    throw new Error("Ticket owner could not be found.");
  }

  await discordRequest(
    `/channels/${channelId}/permissions/${ownerId}`,
    {
      method: "PUT",
      body: JSON.stringify({
        type: 1,
        allow: "1024",
        deny: "2048"
      })
    }
  );

  return discordRequest(`/channels/${channelId}`, {
    method: "PATCH",
    body: JSON.stringify({
      name: `closed-${channel.name}`.slice(0, 100),
      topic: `Ticket owner: ${ownerId} | Status: closed`
    })
  });
}

async function claimTicketChannel(channelId, staffId) {
  const channel = await discordRequest(`/channels/${channelId}`);

  if (!channel.topic?.includes("Status: open")) {
    throw new Error("This ticket is not open.");
  }

  return discordRequest(`/channels/${channelId}`, {
    method: "PATCH",
    body: JSON.stringify({
      topic: `${channel.topic} | Claimed by: ${staffId}`
    })
  });
}

async function addTicketMember(channelId, userId) {
  return discordRequest(
    `/channels/${channelId}/permissions/${userId}`,
    {
      method: "PUT",
      body: JSON.stringify({
        type: 1,
        allow: "3072",
        deny: "0"
      })
    }
  );
}

async function removeTicketMember(channelId, userId) {
  return discordRequest(
    `/channels/${channelId}/permissions/${userId}`,
    {
      method: "DELETE"
    }
  );
}

module.exports = {
  createTicketChannel,
  closeTicketChannel,
  claimTicketChannel,
  addTicketMember,
  removeTicketMember
};
