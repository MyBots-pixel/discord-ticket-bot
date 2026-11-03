const { discordRequest } = require("./discord");
const messages = require("./messages");

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

function getTicketDetails(channel) {
  const topic = channel.topic || "";

  return {
    ownerId: topic.match(/Ticket owner: (\d+)/)?.[1],
    supportRoleId: topic.match(/Support role: (\d+)/)?.[1],
    claimedBy: topic.match(/Claimed by: (\d+)/)?.[1],
    status: topic.match(/Status: ([a-z]+)/)?.[1]
  };
}

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

  return discordRequest(`/guilds/${guildId}/channels`, {
    method: "POST",
    body: JSON.stringify({
      name: channelName,
      type: 0,
      topic:
        `Ticket owner: ${userId} | ` +
        `Support role: ${supportRoleId} | Status: open`,
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
        },
        {
          id: supportRoleId,
          type: 0,
          allow: "3072"
        }
      ]
    })
  });
}

async function createTranscript(channelId) {
  let collected = [];
  let before;

  while (collected.length < 500) {
    const query = new URLSearchParams({ limit: "100" });

    if (before) query.set("before", before);

    const batch = await discordRequest(
      `/channels/${channelId}/messages?${query}`
    );

    if (!batch.length) break;

    collected.push(...batch);
    before = batch[batch.length - 1].id;

    if (batch.length < 100) break;
  }

  collected = collected.slice(0, 500).reverse();

  const lines = collected.map(message => {
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
    `Messages: ${collected.length}\n\n`;

  const chunks = [];
  let current = header;

  for (const line of lines) {
    if ((current + line + "\n").length > 1700) {
      chunks.push(current);
      current = "";
    }

    current += line + "\n";
  }

  if (current.trim()) chunks.push(current);

  for (let i = 0; i < chunks.length; i++) {
    await discordRequest(`/channels/${channelId}/messages`, {
      method: "POST",
      body: JSON.stringify({
        content:
          `📄 **Ticket transcript (part ${i + 1})**\n` +
          `\`\`\`\n${chunks[i]}\n\`\`\``
      })
    });
  }
}

async function closeTicketChannel(channelId) {
  const channel = await discordRequest(`/channels/${channelId}`);
  const details = getTicketDetails(channel);

  if (!details.ownerId) {
    throw new Error("Ticket owner could not be found.");
  }

  if (details.status !== "open") {
    throw new Error("This ticket is already closed.");
  }

  // Mark it closed first to prevent duplicate close requests.
  await discordRequest(`/channels/${channelId}`, {
    method: "PATCH",
    body: JSON.stringify({
      topic:
        `Ticket owner: ${details.ownerId} | ` +
        `Support role: ${details.supportRoleId || ""} | Status: closed`
    })
  });

  // Save the transcript before the closing message.
  try {
    await createTranscript(channelId);
  } catch (error) {
    console.error("Transcript creation failed:", error);
  }

  // Send the approved closing message.
  await discordRequest(`/channels/${channelId}/messages`, {
    method: "POST",
    body: JSON.stringify({
      content: messages.ticketClosed
    })
  });

  // Keep the ticket open for 30 seconds after the message.
  await delay(30000);

  // Permanently delete the ticket channel.
  return discordRequest(`/channels/${channelId}`, {
    method: "DELETE"
  });
}

async function claimTicketChannel(channelId, staffId) {
  const channel = await discordRequest(`/channels/${channelId}`);
  const details = getTicketDetails(channel);

  if (details.status !== "open") {
    throw new Error("This ticket is not open.");
  }

  if (details.claimedBy) {
    throw new Error("This ticket is already claimed.");
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
  createTranscript,
  closeTicketChannel,
  claimTicketChannel,
  addTicketMember,
  removeTicketMember,
  getTicketDetails
};
