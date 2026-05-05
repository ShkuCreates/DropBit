const Logger = require('../utils/logger');

module.exports = {
  name: 'messageCreate',
  async execute(message, client, db, config, modules) {
    try {
      // Skip bot messages and DMs for most modules
      if (message.author.bot) return;

      // Leveling system
      const levelingModule = modules.get('leveling');
      if (levelingModule && message.guild) {
        await levelingModule.handleMessage(message);
      }

      // Moderation system
      const moderationModule = modules.get('moderation');
      if (moderationModule && message.guild) {
        await moderationModule.handleMessage(message);
      }

      // FAQ system
      const faqModule = modules.get('faq');
      if (faqModule && message.guild) {
        await faqModule.handleMessage(message);
      }

      // Triggers system
      const triggersModule = modules.get('triggers');
      if (triggersModule && message.guild) {
        await triggersModule.handleMessage(message);
      }

      // Sticky messages
      const stickyModule = modules.get('sticky');
      if (stickyModule && message.guild) {
        await stickyModule.handleMessage(message);
      }

      // Modmail (staff messages in modmail channels)
      const modmailModule = modules.get('modmail');
      if (modmailModule && message.guild) {
        await modmailModule.handleStaffMessage(message);
      }

    } catch (error) {
      console.error('Error in messageCreate event:', error);
    }
  }
};
