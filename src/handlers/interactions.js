const { discordRequest } = require("../utils/discord");
const messages = require("../utils/messages");

const {
  createTicketChannel,
  closeTicketChannel,
  claimTicketChannel,
  addTicketMember,
  removeTicketMember,
  getTicketDetails
} = require("../utils/tickets");

function response(content) {
  return {
    type: 4,
    data: {
      content,
      flags: 64
    }
  };
}

function getUserId(interaction) {
  return interaction.member?.user?.id ||
    interaction.user?.id;
}

function getOption(interaction, name) {
  return interaction.data.options?.find(
    option => option.name === name
  )?.value;
}

function hasManageChannels(interaction) {
  const permissions = BigInt(
    interaction.member?.permissions || "0"
  );

  return (permissions & 16n) !== 0n;
}

function hasStaffRole(interaction, channel) {
  const details = getTicketDetails(channel);
  const roles = interaction.member?.roles || [];

  return (
    hasManageChannels(interaction) ||
    (
      details.supportRoleId &&
      roles.includes(details.supportRoleId)
    )
  );
}

function buttonRow(buttons) {
  return [{
    type: 1,
    components: buttons
  }];
}

async function sendChannelMessage(channelId, body) {
  return discordRequest(
    `/channels/${channelId}/messages`,
    {
      method: "POST",
      body: JSON.stringify(body)
    }
  );
}

async function handleInteraction(interaction) {
  try {
    if (interaction.type === 1) {
      return { type: 1 };
    }

    const userId = getUserId(interaction);

    // Slash commands
    if (interaction.type === 2) {
      const command = interaction.data.name;
      const channelId = interaction.channel_id;

      if (command === "ping") {
        return response("Pong! 🏓 The ticket bot is online!");
      }

      if (command === "setup") {
        if (!hasManageChannels(interaction)) {
          return response(messages.staffPermission);
        }

        const selectedChannel = getOption(interaction, "channel");
        const supportRoleId = getOption(interaction, "staff_role");

        if (!selectedChannel || !supportRoleId) {
          throw new Error(
            "Please select a channel and Support Staff role."
          );
        }

        await sendChannelMessage(selectedChannel, {
          embeds: [{
            title: messages.ticketPanel.title,
            description: messages.ticketPanel.description,
            color: 3447003
          }],
          components: buttonRow([{
            type: 2,
            style: 1,
            label: messages.ticketPanel.button,
            custom_id: `create_ticket:${supportRoleId}`
          }])
        });

        return response("Your ticket panel has been created!");
      }

      const channel = await discordRequest(
        `/channels/${channelId}`
      );

      const details = getTicketDetails(channel);

      if (
        ["claim", "add", "remove", "close"].includes(command) &&
        !details.ownerId
      ) {
        return response(messages.notTicket);
      }

      if (command === "claim") {
        if (!hasStaffRole(interaction, channel)) {
          return response(messages.staffPermission);
        }

        if (details.status !== "open") {
          throw new Error("This ticket is already closed.");
        }

        if (details.claimedBy) {
          return response(
            messages.ticketAlreadyClaimed(details.claimedBy)
          );
        }

        await claimTicketChannel(channelId, userId);

        await sendChannelMessage(channelId, {
          content: messages.ticketClaimed(userId)
        });

        return response("You have claimed this ticket!");
      }

      if (command === "add") {
        if (!hasStaffRole(interaction, channel)) {
          return response(messages.staffPermission);
        }

        if (details.status !== "open") {
          throw new Error("This ticket is already closed.");
        }

        const targetUser = getOption(interaction, "user");

        if (!targetUser) {
          throw new Error("Please select a member.");
        }

        await addTicketMember(channelId, targetUser);

        await sendChannelMessage(channelId, {
          content: messages.memberAdded(userId, targetUser)
        });

        return response("Member added to the ticket.");
      }

      if (command === "remove") {
        if (!hasStaffRole(interaction, channel)) {
          return response(messages.staffPermission);
        }

        if (details.status !== "open") {
          throw new Error("This ticket is already closed.");
        }

        const targetUser = getOption(interaction, "user");

        if (!targetUser) {
          throw new Error("Please select a member.");
        }

        if (targetUser === details.ownerId) {
          throw new Error(
            "The ticket owner cannot be removed from their own ticket."
          );
        }

        const isTicketMember =
          channel.permission_overwrites?.some(
            overwrite =>
              overwrite.type === 1 &&
              overwrite.id === targetUser
          );

        if (!isTicketMember) {
          return response(messages.memberNotInTicket);
        }

        const customId =
          `remove_member:${details.ownerId}:` +
          `${userId}:${targetUser}`;

        await sendChannelMessage(channelId, {
          content: messages.removeMemberConfirmation(
            userId,
            targetUser
          ),
          components: buttonRow([
            {
              type: 2,
              style: 3,
              label: "Confirm",
              custom_id: `${customId}:confirm`
            },
            {
              type: 2,
              style: 4,
              label: "Deny",
              custom_id: `${customId}:deny`
            }
          ])
        });

        return response(
          "The removal request has been sent to the ticket owner."
        );
      }

      if (command === "close") {
        if (
          userId !== details.ownerId &&
          !hasStaffRole(interaction, channel)
        ) {
          return response(messages.staffPermission);
        }

        await closeTicketChannel(channelId);

        return response("Ticket closed successfully.");
      }
    }

    // Button interactions
    if (interaction.type === 3) {
      const customId = interaction.data.custom_id;
      const channelId = interaction.channel_id;

      if (customId.startsWith("create_ticket:")) {
        const supportRoleId = customId.split(":")[1];

        if (!supportRoleId) {
          throw new Error("The Support Staff role is missing.");
        }

        const channels = await discordRequest(
          `/guilds/${interaction.guild_id}/channels`
        );

        const existingTicket = channels.find(channel => {
          const details = getTicketDetails(channel);

          return (
            details.ownerId === userId &&
            details.status === "open"
          );
        });

        if (existingTicket) {
          return response(
            `You already have an open ticket: <#${existingTicket.id}>`
          );
        }

        const ticket = await createTicketChannel(
          interaction.guild_id,
          userId,
          interaction.member.user.username,
          supportRoleId
        );

        await sendChannelMessage(ticket.id, {
          content: messages.ticketWelcome(
            userId,
            supportRoleId
          ),
          allowed_mentions: {
            users: [userId],
            roles: [supportRoleId]
          },
          components: buttonRow([{
            type: 2,
            style: 4,
            label: "Close Ticket",
            custom_id: "close_ticket"
          }])
        });

        await sendChannelMessage(ticket.id, {
          content:
            `<@&${supportRoleId}> ` +
            messages.staffNotification(userId, ticket.id),
          allowed_mentions: {
            users: [userId],
            roles: [supportRoleId]
          }
        });

        return response(
          `Your ticket has been created: <#${ticket.id}>`
        );
      }

      if (customId.startsWith("remove_member:")) {
        const parts = customId.split(":");

        const ownerId = parts[1];
        const staffId = parts[2];
        const targetUserId = parts[3];
        const decision = parts[4];

        if (userId !== ownerId) {
          return response(
            "Only the ticket owner can make this decision."
          );
        }

        if (!["confirm", "deny"].includes(decision)) {
          throw new Error("Invalid removal decision.");
        }

        const channel = await discordRequest(
          `/channels/${channelId}`
        );

        const details = getTicketDetails(channel);

        if (details.status !== "open") {
          throw new Error("This ticket is no longer open.");
        }

        const isStillMember =
          channel.permission_overwrites?.some(
            overwrite =>
              overwrite.type === 1 &&
              overwrite.id === targetUserId
          );

        if (!isStillMember) {
          return response(messages.memberNotInTicket);
        }

        await discordRequest(
          `/channels/${channelId}/messages/${interaction.data.message.id}`,
          {
            method: "PATCH",
            body: JSON.stringify({
              components: []
            })
          }
        );

        if (decision === "deny") {
          await sendChannelMessage(channelId, {
            content: messages.removeMemberDenied(
              userId,
              targetUserId
            )
          });

          return response("Removal request denied.");
        }

        await sendChannelMessage(channelId, {
          content: messages.removeMemberConfirmed(
            userId,
            staffId,
            targetUserId
          )
        });

        await removeTicketMember(channelId, targetUserId);

        await sendChannelMessage(channelId, {
          content: messages.memberRemoved(targetUserId)
        });

        return response("Member removed from the ticket.");
      }

      if (customId === "close_ticket") {
        const channel = await discordRequest(
          `/channels/${channelId}`
        );

        const details = getTicketDetails(channel);

        if (!details.ownerId) {
          return response(messages.notTicket);
        }

        if (
          userId !== details.ownerId &&
          !hasStaffRole(interaction, channel)
        ) {
          return response(messages.staffPermission);
        }

        await closeTicketChannel(channelId);

        return response("Ticket closed successfully.");
      }
    }

    return response("Unknown interaction.");

  } catch (error) {
    console.error("Interaction error:", error);

    return response(
      `❌ ${error.message || "Something went wrong."}`
    );
  }
}

module.exports = {
  handleInteraction
};
