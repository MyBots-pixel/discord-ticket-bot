const messages = {
  ticketPanel: {
    title: "Support Centre",
    description:
      "Need help? Open a ticket and our support team will assist you.",
    button: "Create Ticket"
  },

  ticketWelcome: (userId, supportRoleId) =>
    `Thanks For Creating A Ticket <@${userId}>, We Will Ping <@&${supportRoleId}>. Please Do Not Ping Them, We Have Already Pinged Them Once. We Will Get To You As Soon As Possible. Please Describe Your Issue Bellow Without Pinging And We Will Get To You As Soon As Possible. Thanks`,

  ticketClosed: `Your Ticket Has Been Closed,

We Hope Your Needs Have Been Met And Feel Free To Drop A Review In The #ticket-feedback Channel.


Enjoy The Rest Of Your Day,

If You Need More Support Please Create Another Ticket,
Roblox Community Gang,
Support Staff, 
:heart :heart :heart`,

  staffNotification: (userId, channelId) =>
    `<@${userId}> Has Opened A Ticket <#${channelId}>!`,

  ticketClaimed: staffId =>
    `<@${staffId}> Has Claimed This Ticket And Should Be With You Shortly, Please Describe Your Issue`,

  memberAdded: (staffId, userId) =>
    `<@${staffId}> Has Added <@${userId}> To The Ticket!`,

  removeMemberConfirmation: (staffId, userId) =>
    `<@${staffId}> Is Trying To Remove <@${userId}> From This Ticket, Do You Confirm Or Deny? Please Choose A Button Bellow`,

  removeMemberDenied: (userId, memberId) =>
    `<@${userId}> Denied Removing <@${memberId}> From The Ticket`,

  removeMemberConfirmed: (userId, staffId, memberId) =>
    `<@${userId}> Has Confirmed <@${staffId}> To Remove <@${memberId}>`,

  memberRemoved: memberId =>
    `<@${memberId}> Has Been Removed`,

  ticketAlreadyClaimed: staffId =>
    `This Ticket Is Already Claimed By <@${staffId}>`,

  notTicket: "This Channel Isn't A Ticket Channel. Error",

  staffPermission: "Only Approved Staff Can Use That. Ooops.",

  memberNotInTicket:
    "That Person Isn't In This Ticket Currently. Error"
};

module.exports = messages;
