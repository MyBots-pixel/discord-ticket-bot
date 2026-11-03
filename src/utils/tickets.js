const { discordRequest } = require("./discord");
const messages = require("./messages");

const delay = milliseconds =>
  new Promise(resolve => setTimeout(resolve, milliseconds));

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
  let messagesList = [];
  let before;

  while (messagesList.length < 500) {
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

    messagesList.push(...batch);
    before = batch[batch.length - 1].id;

    if (batch.length < 100) {
      break;
    }
  }

  messagesList = messagesList.slice(0, 500).reverse();

  const transcriptLines = messagesList.map(message => {
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
    `Messages: ${messagesList.length}\n\n`;

  const chunks = [];
  let currentChunk = header;

  for (const line of transcriptLines) {
    if ((currentChunk + line + "\n").length > 1700) {
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

  // Save the transcript before sending the closing message.
  await createTranscript(channelId);

  // Mark the ticket as closed to prevent another close request.
  await discordRequest(`/channels/${channelId}`, {
    method: "PATCH",
    body: JSON.stringify({
      topic: `Ticket owner: ${ownerId} | Status: closed`
    })
  });

  // Send the approved closing message.
  await discordRequest(`/channels/${channelId}/messages`, {
    method: "POST",
    body: JSON.stringify({
      content: messages.ticketClosed
    })
  });

  // Keep the channel available for 30 seconds.
  await delay(30000);

  // Permanently delete the ticket channel.
  return discordRequest(`/channels/${channelId}`, {
    method: "DELETE"
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
