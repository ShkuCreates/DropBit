const Logger = require('../utils/logger');

module.exports = {
  name: 'guildMemberAdd',
  async execute(member, client, db, config, modules) {
    try {
      console.log(`👋 Member joined: ${member.user.tag}`);

      // Welcome system
      const welcomeModule = modules.get('welcome');
      if (welcomeModule) {
        // Handle invite tracking first to get inviter info
        let inviter = null;
        const invitesModule = modules.get('invites');
        if (invitesModule) {
          inviter = await invitesModule.handleMemberJoin(member);
        }
        
        await welcomeModule.handleMemberJoin(member, inviter);
      }

      // Anti-raid system
      const antiRaidModule = modules.get('antiraid');
      if (antiRaidModule) {
        await antiRaidModule.handleMemberJoin(member);
      }

      // Verification system
      const verificationModule = modules.get('verification');
      if (verificationModule) {
        await verificationModule.startVerification(member);
      }

      // Logging
      const logger = new Logger(client, db, config);
      await logger.log('memberJoin', {
        user: member.user,
        member,
        joinedAt: member.joinedAt
      }, member.guild);

    } catch (error) {
      console.error('Error in guildMemberAdd event:', error);
    }
  }
};
