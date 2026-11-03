const { discordRequest } = require("./discord");

async function createTicketChannel(
  guildId,
  userId,
  username,
  supportRoleId
) {
  const channelName = `ticket-${username}`
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .slice(0, 90);

  const permissionOverwrites = [
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
  ];

  if (supportRoleId) {
    permissionOverwrites.push({
      id: supportRoleId,
      type: 0,
      allow: "3072"
    });
  }

  return discordRequest(`/guilds/${guildId}/channels`, {
    method: "POST",
    body: JSON.stringify({
      name: channelName,
      type: 0,
      topic: `Ticket owner: ${userId} | Status: open`,
      permission_overwrites: permissionOverwrites
    })
  });
}

async function createTranscript(channelId) {
  let messages = [];
  let before;

  while (messages.length < 500) {
    const query = new URLSearchParams({ limit: "100" });

    if (before) {
      query.set("before", before);
    }

    const batch = await discordRequest(
      `/channels/${channelId}/messages?${query}`
    );

    if (!batch.length) {
      break;
    }

    messages.push(...batch);
    before = batch[batch.length - 1].id;

    if (batch.length < 100) {
      break;
    }
  }

  messages = messages.slice(0, 500).reverse();

  const transcriptLines = messages.map(message => {
    const author = message.author?.username || "Unknown";
    const time = new Date(message.timestamp).toISOString();
    const content = message.content || "[No text content]";

    const attachments = (message.attachments || [])
      .map(file => file.url)
      .join("\n");

    return `[${time}] ${author}: ${content}${
      attachments ? `\nAttachments: ${attachments}` : ""
    }`;
  });

  const header =
    `TICKET TRANSCRIPT\nChannel: ${channelId}\n` +
    `Messages: ${messages.length}\n\n`;

  const chunks = [];
  let currentChunk = header;

  for (const line of transcriptLines) {
    if ((currentChunk + line + "\n").length > 1800) {
      chunks.push(currentChunk);
      currentChunk = "";
    }

    currentChunk += line + "\n";
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk);
  }

  for (let index = 0; index < chunks.length; index++) {
    await discordRequest(`/channels/${channelId}/messages`, {
      method: "POST",
      body: JSON.stringify({
        content:
          `📄 **Ticket transcript (part ${index + 1})**\n` +
          `\`\`\`\n${chunks[index]}\n\`\`\``
      })
    });
  }
}

async function closeTicketChannel(channelId) {
  const channel = await discordRequest(`/channels/${channelId}`);

  const ownerId = channel.topic?.match(
    /Ticket owner: (\d+)/
  )?.[1];

  if (!ownerId) {
    throw new Error("Ticket owner could not be found.");
  }

  if (!channel.topic.includes("Status: open")) {
    throw new Error("This ticket is already closed.");
  }

  await createTranscript(channelId);

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

  if (channel.topic.includes("Claimed by:")) {
    throw new Error("This ticket has already been claimed.");
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

async function deleteTicketChannel(channelId) {
  return discordRequest(`/channels/${channelId}`, {
    method: "DELETE"
  });
}

module.exports = {
  createTicketChannel,
  createTranscript,
  closeTicketChannel,
  claimTicketChannel,
  addTicketMember,
  removeTicketMember,
  deleteTicketChannel
};
