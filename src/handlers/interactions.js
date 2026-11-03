const { discordRequest } = require("../utils/discord");
const {
  createTicketChannel,
  closeTicketChannel
} = require("../utils/tickets");

async function handleInteraction(interaction) {
  // Discord verification
  if (interaction.type === 1) {
    return { type: 1 };
  }

  // Slash commands
  if (interaction.type === 2) {
    const command = interaction.data.name;

    if (command === "ping") {
      return {
        type: 4,
        data: {
          content: "Pong! 🏓 The bot is online!",
          flags: 64
        }
      };
    }

    if (command === "setup") {
      const channelId = interaction.data.options?.find(
        option => option.name === "channel"
      )?.value;

      if (!channelId) {
        return {
          type: 4,
          data: { content: "Please select a channel.", flags: 64 }
        };
      }

      await discordRequest(`/channels/${channelId}/messages`, {
        method: "POST",
        body: JSON.stringify({
          content: "🎫 **Support Tickets**\nNeed help? Press the button below to open a private ticket.",
          components: [{
            type: 1,
            components: [{
              type: 2,
              style: 1,
              label: "Create Ticket",
              custom_id: "create_ticket"
            }]
          }]
        })
      });

      return {
        type: 4,
        data: {
          content: "Your ticket panel has been created!",
          flags: 64
        }
      };
    }

    if (command === "close") {
      await closeTicketChannel(interaction.channel_id);

      return {
        type: 4,
        data: {
          content: "This ticket has been closed.",
          flags: 64
        }
      };
    }

    return {
      type: 4,
      data: { content: "Unknown command.", flags: 64 }
    };
  }

  // Button interactions
  if (interaction.type === 3) {
    if (interaction.data.custom_id === "create_ticket") {
      const guildId = interaction.guild_id;
      const userId = interaction.member.user.id;
      const username = interaction.member.user.username;

      const channels = await discordRequest(
        `/guilds/${guildId}/channels`
      );

      const existing = channels.find(channel =>
        channel.topic === `Ticket owner: ${userId}`
      );

      if (existing) {
        return {
          type: 4,
          data: {
            content: `You already have a ticket: <#${existing.id}>`,
            flags: 64
          }
        };
      }

      const ticket = await createTicketChannel(
        guildId,
        userId,
        username
      );

      await discordRequest(`/channels/${ticket.id}/messages`, {
        method: "POST",
        body: JSON.stringify({
          content: `<@${userId}> Welcome to your support ticket! A member of staff will be with you shortly.`,
          components: [{
            type: 1,
            components: [{
              type: 2,
              style: 4,
              label: "Close Ticket",
              custom_id: "close_ticket"
            }]
          }]
        })
      });

      return {
        type: 4,
        data: {
          content: `Your ticket has been created: <#${ticket.id}>`,
          flags: 64
        }
      };
    }

    if (interaction.data.custom_id === "close_ticket") {
      await closeTicketChannel(interaction.channel_id);

      return {
        type: 4,
        data: {
          content: "Ticket closed.",
          flags: 64
        }
      };
    }
  }

  return {
    type: 4,
    data: { content: "Unknown interaction.", flags: 64 }
  };
}

module.exports = { handleInteraction };
