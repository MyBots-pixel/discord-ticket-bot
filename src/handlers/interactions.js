const { discordRequest } = require("../utils/discord");

const {
  createTicketChannel,
  closeTicketChannel,
  claimTicketChannel,
  addTicketMember,
  removeTicketMember
} = require("../utils/tickets");

async function handleInteraction(interaction) {
  try {
    if (interaction.type === 1) {
      return { type: 1 };
    }

    if (interaction.type === 2) {
      const command = interaction.data.name;
      const userId = interaction.member.user.id;
      const channelId = interaction.channel_id;

      if (command === "ping") {
        return {
          type: 4,
          data: {
            content: "Pong! 🏓 The ticket bot is online!",
            flags: 64
          }
        };
      }

      if (command === "setup") {
        const selectedChannel = interaction.data.options?.find(
          option => option.name === "channel"
        )?.value;

        if (!selectedChannel) {
          throw new Error("Please select a channel.");
        }

        await discordRequest(
          `/channels/${selectedChannel}/messages`,
          {
            method: "POST",
            body: JSON.stringify({
              content:
                "🎫 **Support Tickets**\n\nNeed help? Click below to open a private support ticket.",
              components: [
                {
                  type: 1,
                  components: [
                    {
                      type: 2,
                      style: 1,
                      label: "Create Ticket",
                      custom_id: "create_ticket"
                    }
                  ]
                }
              ]
            })
          }
        );

        return {
          type: 4,
          data: {
            content: "Your ticket panel has been created!",
            flags: 64
          }
        };
      }

      const permissions = BigInt(
        interaction.member.permissions || "0"
      );

      const isStaff = (permissions & 16n) !== 0n;

      if (command === "claim") {
        if (!isStaff) {
          throw new Error("You need Manage Channels permission.");
        }

        await claimTicketChannel(channelId, userId);

        return {
          type: 4,
          data: {
            content: "✅ You have claimed this ticket!",
            flags: 64
          }
        };
      }

      if (command === "add") {
        if (!isStaff) {
          throw new Error("You need Manage Channels permission.");
        }

        const targetUser = interaction.data.options?.find(
          option => option.name === "user"
        )?.value;

        if (!targetUser) {
          throw new Error("Please select a member.");
        }

        await addTicketMember(channelId, targetUser);

        return {
          type: 4,
          data: {
            content: `✅ <@${targetUser}> has been added to this ticket.`,
            flags: 64
          }
        };
      }

      if (command === "remove") {
        if (!isStaff) {
          throw new Error("You need Manage Channels permission.");
        }

        const targetUser = interaction.data.options?.find(
          option => option.name === "user"
        )?.value;

        if (!targetUser) {
          throw new Error("Please select a member.");
        }

        await removeTicketMember(channelId, targetUser);

        return {
          type: 4,
          data: {
            content: `✅ <@${targetUser}> has been removed from this ticket.`,
            flags: 64
          }
        };
      }

      if (command === "close") {
        const channel = await discordRequest(
          `/channels/${channelId}`
        );

        const isTicket = channel.topic?.includes("Ticket owner:");

        if (!isTicket) {
          throw new Error("This channel is not a ticket.");
        }

        const ownerId = channel.topic.match(
          /Ticket owner: (\d+)/
        )?.[1];

        if (!isStaff && ownerId !== userId) {
          throw new Error("Only the ticket owner or staff can close it.");
        }

        await closeTicketChannel(channelId);

        return {
          type: 4,
          data: {
            content: "🔒 This ticket has been closed.",
            flags: 64
          }
        };
      }
    }

    if (interaction.type === 3) {
      const button = interaction.data.custom_id;
      const guildId = interaction.guild_id;
      const userId = interaction.member.user.id;
      const username = interaction.member.user.username;

      if (button === "create_ticket") {
        const channels = await discordRequest(
          `/guilds/${guildId}/channels`
        );

        const existingTicket = channels.find(channel =>
          channel.topic?.includes(`Ticket owner: ${userId}`) &&
          channel.topic?.includes("Status: open")
        );

        if (existingTicket) {
          return {
            type: 4,
            data: {
              content: `You already have an open ticket: <#${existingTicket.id}>`,
              flags: 64
            }
          };
        }

        const ticket = await createTicketChannel(
          guildId,
          userId,
          username
        );

        await discordRequest(
          `/channels/${ticket.id}/messages`,
          {
            method: "POST",
            body: JSON.stringify({
              content:
                `👋 Welcome <@${userId}>!\n\nA member of staff will be with you shortly.`,
              components: [
                {
                  type: 1,
                  components: [
                    {
                      type: 2,
                      style: 4,
                      label: "Close Ticket",
                      custom_id: "close_ticket"
                    }
                  ]
                }
              ]
            })
          }
        );

        return {
          type: 4,
          data: {
            content: `✅ Your ticket has been created: <#${ticket.id}>`,
            flags: 64
          }
        };
      }

      if (button === "close_ticket") {
        const channel = await discordRequest(
          `/channels/${interaction.channel_id}`
        );

        const ownerId = channel.topic?.match(
          /Ticket owner: (\d+)/
        )?.[1];

        const permissions = BigInt(
          interaction.member.permissions || "0"
        );

        const isStaff = (permissions & 16n) !== 0n;

        if (ownerId !== userId && !isStaff) {
          throw new Error("You cannot close someone else's ticket.");
        }

        await closeTicketChannel(interaction.channel_id);

        return {
          type: 4,
          data: {
            content: "🔒 Ticket closed successfully.",
            flags: 64
          }
        };
      }
    }

    return {
      type: 4,
      data: {
        content: "Unknown interaction.",
        flags: 64
      }
    };

  } catch (error) {
    console.error("Interaction error:", error);

    return {
      type: 4,
      data: {
        content: `❌ ${error.message || "Something went wrong."}`,
        flags: 64
      }
    };
  }
}

module.exports = {
  handleInteraction
};
