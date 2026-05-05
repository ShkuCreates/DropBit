const Logger = require('../utils/logger');

module.exports = {
  name: 'messageUpdate',
  async execute(oldMessage, newMessage, client, db, config, modules) {
    try {
      // Skip bot messages and DMs
      if (newMessage.author.bot) return;
      if (!newMessage.guild) return;

      // Skip if content is the same (embed updates, etc.)
      if (oldMessage.content === newMessage.content) return;

      // Logging
      const logger = new Logger(client, db, config);
      await logger.log('messageEdit', {
        author: newMessage.author,
        oldContent: oldMessage.content,
        newContent: newMessage.content,
        channel: newMessage.channel
      }, newMessage.guild);

    } catch (error) {
      console.error('Error in messageUpdate event:', error);
    }
  }
};
