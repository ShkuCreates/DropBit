const Logger = require('../utils/logger');

module.exports = {
  name: 'guildMemberRemove',
  async execute(member, client, db, config, modules) {
    try {
      console.log(`👋 Member left: ${member.user.tag}`);

      // Invite tracking
      const invitesModule = modules.get('invites');
      if (invitesModule) {
        await invitesModule.handleMemberLeave(member);
      }

      // Logging
      const logger = new Logger(client, db, config);
      await logger.log('memberLeave', {
        user: member.user,
        joinedAt: member.joinedAt
      }, member.guild);

    } catch (error) {
      console.error('Error in guildMemberRemove event:', error);
    }
  }
};
