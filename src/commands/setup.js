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
    },
    {
      type: 8,
      name: "staff_role",
      description: "Choose the role that handles support tickets",
      required: true
    }
  ]
};

module.exports = setupCommand;
