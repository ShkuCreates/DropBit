const Logger = require('../utils/logger');

module.exports = {
  name: 'guildBanAdd',
  async execute(ban, client, db, config, modules) {
    try {
      console.log(`🔨 User banned: ${ban.user.tag}`);

      // Logging
      const logger = new Logger(client, db, config);
      await logger.log('ban', {
        user: ban.user,
        reason: ban.reason
      }, ban.guild);

    } catch (error) {
      console.error('Error in guildBanAdd event:', error);
    }
  }
};
