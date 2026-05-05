module.exports = {
  name: 'messageCreate',
  async execute(message, client, db, config, modules) {
    // Only handle DMs in this event handler
    if (message.channel.type !== 1) return; // 1 = DM channel
    if (message.author.bot) return;

    try {
      console.log(`📧 DM received from ${message.author.tag}: ${message.content.substring(0, 50)}...`);

      // Modmail system
      const modmailModule = modules.get('modmail');
      if (modmailModule) {
        await modmailModule.handleDM(message);
      }

    } catch (error) {
      console.error('Error in DM message handler:', error);
    }
  }
};
