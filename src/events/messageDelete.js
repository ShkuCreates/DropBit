const Logger = require('../utils/logger');

module.exports = {
  name: 'messageDelete',
  async execute(message, client, db, config, modules) {
    try {
      // Skip bot messages and DMs
      if (message.author.bot) return;
      if (!message.guild) return;

      // Logging
      const logger = new Logger(client, db, config);
      await logger.log('messageDelete', {
        author: message.author,
        content: message.content,
        channel: message.channel
      }, message.guild);

    } catch (error) {
      console.error('Error in messageDelete event:', error);
    }
  }
};
