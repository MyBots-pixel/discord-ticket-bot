const ticketCommands = [
  {
    name: "close",
    description: "Close the current ticket"
  },
  {
    name: "claim",
    description: "Claim the current ticket"
  },
  {
    name: "add",
    description: "Add a member to the current ticket",
    options: [
      {
        type: 6,
        name: "user",
        description: "The member to add",
        required: true
      }
    ]
  },
  {
    name: "remove",
    description: "Remove a member from the current ticket",
    options: [
      {
        type: 6,
        name: "user",
        description: "The member to remove",
        required: true
      }
    ]
  }
];

module.exports = ticketCommands;
