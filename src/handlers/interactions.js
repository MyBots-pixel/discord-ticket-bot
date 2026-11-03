const { discordRequest } = require("../utils/discord");
const messages = require("../utils/messages");

const {
  createTicketChannel,
  closeTicketChannel,
  claimTicketChannel,
  addTicketMember,
  removeTicketMember
} = require("../utils/tickets");

function response(content, ephemeral = true, components = []) {
  return {
    type: 4,
    data: {
      content,
      flags: ephemeral ? 64 : 0,
      components
    }
  };
}

function getUserId(interaction) {
  return interaction.member?.user?.id || interaction.user?.id;
}

function isStaff(interaction) {
  const permissions = BigInt(
    interaction.member?.permissions || "0"
  );

  return (permissions & 16n) !== 0n;
}

function getOption(interaction, name) {
  return interaction.data.options?.find(
    option => option.name === name
  )?.value;
}

function buttonRow(buttons) {
  return [
    {
      type: 1,
      components: buttons
    }
  ];
}

async function handleInteraction(interaction) {
  try {
    if (interaction.type === 1) {
      return { type: 1 };
    }

    if (interaction.type === 2) {
      const command = interaction.data.name;
      const userId = getUserId(interaction);
      const channelId = interaction.channel_id;

      if (command === "ping") {
        return response("Pong! 🏓 The ticket bot is online!");
      }

      if (command === "setup") {
        if (!isStaff(interaction)) {
          throw new Error(
            "You need Manage Channels permission to set up tickets."
          );
        }

        const selectedChannel = getOption(
          interaction,
          "channel"
        );

        const supportRoleId = getOption(
          interaction,
          "staff_role"
        );

        if (!selectedChannel || !supportRoleId) {
          throw new Error(
            "Please select a channel and Support Staff role."
          );
        }

        await discordRequest(
          `/channels/${selectedChannel}/messages`,
          {
            method: "POST",
            body: JSON.stringify({
              embeds: [
                {
                  title: messages.ticketPanel.title,
                  description: messages.ticketPanel.description,
                  color: 3447003
                }
              ],
              components: buttonRow([
                {
                  type: 2,
                  style: 1,
                  label: messages.ticketPanel.button,
                  custom_id: `create_ticket:${supportRoleId}`
                }
              ])
            })
          }
        );

        return response(
          "Your ticket panel has been created!"
        );
      }

      if (command === "claim") {
        if (!isStaff(interaction)) {
          throw new Error(
            "You need Manage Channels permission."
          );
        }

        const channel = await discordRequest(
          `/channels/${channelId}`
        );

        const previousClaim = channel.topic?.match(
          /Claimed by: (\d+)/
        )?.[1];

        if (previousClaim) {
          return response(
            messages.ticketAlreadyClaimed(previousClaim)
          );
        }

        await claimTicketChannel(channelId, userId);

        await discordRequest(
          `/channels/${channelId}/messages`,
          {
            method: "POST",
            body: JSON.stringify({
              content: messages.ticketClaimed(userId)
            })
          }
        );

        return response("You have claimed this ticket!");
      }

      if (command === "add") {
        if (!isStaff(interaction)) {
          throw new Error(
            "You need Manage Channels permission."
          );
        }

        const targetUser = getOption(interaction, "user");

        if (!targetUser) {
          throw new Error("Please select a member.");
        }

        await addTicketMember(channelId, targetUser);

        await discordRequest(
          `/channels/${channelId}/messages`,
          {
            method: "POST",
            body: JSON.stringify({
              content: messages.memberAdded(
                userId,
                targetUser
              )
            })
          }
        );

        return response("Member added to the ticket.");
      }

      if (command === "remove") {
        if (!isStaff(interaction)) {
          throw new Error(
            "You need Manage Channels permission."
          );
        }

        const targetUser = getOption(interaction, "user");

        if (!targetUser) {
          throw new Error("Please select a member.");
        }

        const channel = await discordRequest(
          `/channels/${channelId}`
        );

        const ownerId = channel.topic?.match(
          /Ticket owner: (\d+)/
        )?.[1];

        if (!ownerId) {
          throw new Error(
            "This channel is not a ticket."
          );
        }

        if (targetUser === ownerId) {
          throw new Error(
            "The ticket owner cannot be removed from their own ticket."
          );
        }

        const customId =
          `remove_member:${ownerId}:${userId}:${targetUser}`;

        await discordRequest(
          `/channels/${channelId}/messages`,
          {
            method: "POST",
            body: JSON.stringify({
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
            })
          }
        );

        return response(
          "The removal request has been sent to the ticket owner."
        );
      }

      if (command === "close") {
        const channel = await discordRequest(
          `/channels/${channelId}`
        );

        const ownerId = channel.topic?.match(
          /Ticket owner: (\d+)/
        )?.[1];

        if (!ownerId) {
          throw new Error(
            "This channel is not a ticket."
          );
        }

        if (!isStaff(interaction) && ownerId !== userId) {
          throw new Error(
            "Only the ticket owner or staff can close this ticket."
          );
        }

        await closeTicketChannel(channelId);

        return response("Ticket closed successfully.");
      }
    }

    if (interaction.type === 3) {
      const customId = interaction.data.custom_id;
      const userId = getUserId(interaction);
      const guildId = interaction.guild_id;
      const channelId = interaction.channel_id;

      if (customId.startsWith("create_ticket:")) {
        const supportRoleId = customId.split(":")[1];

        const channels = await discordRequest(
          `/guilds/${guildId}/channels`
        );

        const existingTicket = channels.find(channel =>
          channel.topic?.includes(
            `Ticket owner: ${userId}`
          ) &&
          channel.topic?.includes("Status: open")
        );

        if (existingTicket) {
          return response(
            `You already have an open ticket: <#${existingTicket.id}>`
          );
        }

        const ticket = await createTicketChannel(
          guildId,
          userId,
          interaction.member.user.username,
          supportRoleId
        );

        await discordRequest(
          `/channels/${ticket.id}/messages`,
          {
            method: "POST",
            body: JSON.stringify({
              content: messages.ticketWelcome(
                userId,
                supportRoleId
              ),
              allowed_mentions: {
                users: [userId],
                roles: [supportRoleId]
              },
              components: buttonRow([
                {
                  type: 2,
                  style: 4,
                  label: "Close Ticket",
                  custom_id: "close_ticket"
                }
              ])
            })
          }
        );

        await discordRequest(
          `/channels/${ticket.id}/messages`,
          {
            method: "POST",
            body: JSON.stringify({
              content: messages.staffNotification(
                userId,
                ticket.id
              )
            })
          }
        );

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
          await discordRequest(
            `/channels/${channelId}/messages`,
            {
              method: "POST",
              body: JSON.stringify({
                content: messages.removeMemberDenied(
                  userId,
                  targetUserId
                )
              })
            }
          );

          return {
            type: 6
          };
        }

        if (decision === "confirm") {
          await discordRequest(
            `/channels/${channelId}/messages`,
            {
              method: "POST",
              body: JSON.stringify({
                content: messages.removeMemberConfirmed(
                  userId,
                  staffId,
                  targetUserId
                )
              })
            }
          );

          await removeTicketMember(
            channelId,
            targetUserId
          );

          await discordRequest(
            `/channels/${channelId}/messages`,
            {
              method: "POST",
              body: JSON.stringify({
                content: messages.memberRemoved(
                  targetUserId
                )
              })
            }
          );

          return {
            type: 6
          };
        }
      }

      if (customId === "close_ticket") {
        const channel = await discordRequest(
          `/channels/${channelId}`
        );

        const ownerId = channel.topic?.match(
          /Ticket owner: (\d+)/
        )?.[1];

        if (
          ownerId !== userId &&
          !isStaff(interaction)
        ) {
          throw new Error(
            "You cannot close someone else's ticket."
          );
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
