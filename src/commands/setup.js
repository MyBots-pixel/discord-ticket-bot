const setupCommand = {
  name: "setup",
  description: "Set up the ticket system",
  options: [
    {
      type: 7,
      name: "channel",
      description: "Choose where the ticket panel will appear",
      required: true,
      channel_types: [0]
    }
  ]
};

module.exports = setupCommand;
