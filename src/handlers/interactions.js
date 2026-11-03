async function handleInteraction(interaction) {
  // Discord connection check
  if (interaction.type === 1) {
    return {
      type: 1
    };
  }

  // Slash commands
  if (interaction.type === 2) {
    const command = interaction.data.name;

    if (command === "ping") {
      return {
        type: 4,
        data: {
          content: "Pong! 🏓 The ticket bot is online.",
          flags: 64
        }
      };
    }
  }

  // Button interactions
  if (interaction.type === 3) {
    return {
      type: 4,
      data: {
        content: "Button interaction received!",
        flags: 64
      }
    };
  }

  return {
    type: 4,
    data: {
      content: "Unknown interaction.",
      flags: 64
    }
  };
}

module.exports = {
  handleInteraction
};
