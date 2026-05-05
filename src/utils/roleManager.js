const { EmbedBuilder } = require('discord.js');

class RoleManager {
  constructor(client, db, config) {
    this.client = client;
    this.db = db;
    this.config = config;
  }

  async initializeRoles(guild) {
    try {
      console.log('🔧 Initializing server roles...');
      
      const createdRoles = await Promise.all([
        this.createVerificationRoles(guild),
        this.createLevelRoles(guild),
        this.createOnboardingRoles(guild),
        this.createInviteRewardRoles(guild)
      ]);

      const allCreated = createdRoles.flat();
      
      if (allCreated.length > 0) {
        await this.logRoleCreation(guild, allCreated);
        await this.updateConfigWithRoleIds(allCreated);
      }

      console.log(`✅ Role initialization complete. Created/verified ${allCreated.length} roles.`);
      return allCreated;

    } catch (error) {
      console.error('❌ Error initializing roles:', error);
      return [];
    }
  }

  async createVerificationRoles(guild) {
    const roles = [];
    
    // Verified role
    const verifiedRoleId = this.config.get('roles.verified');
    if (!verifiedRoleId || !guild.roles.cache.has(verifiedRoleId)) {
      const verifiedRole = await guild.roles.create({
        name: '✅ Verified',
        color: 0x00ff00,
        reason: 'Auto-created verification role'
      });
      roles.push({ type: 'verified', role: verifiedRole });
      this.config.set('roles.verified', verifiedRole.id);
    }

    // Unverified role
    const unverifiedRoleId = this.config.get('roles.unverified');
    if (!unverifiedRoleId || !guild.roles.cache.has(unverifiedRoleId)) {
      const unverifiedRole = await guild.roles.create({
        name: '❌ Unverified',
        color: 0xff0000,
        reason: 'Auto-created unverified role'
      });
      roles.push({ type: 'unverified', role: unverifiedRole });
      this.config.set('roles.unverified', unverifiedRole.id);
    }

    return roles;
  }

  async createLevelRoles(guild) {
    const roles = [];
    const levelRoles = this.config.get('roles.levelRoles') || {};
    
    const levelConfigs = [
      { level: 5, name: '🌟 Level 5', color: 0x0099ff },
      { level: 10, name: '⭐ Level 10', color: 0x00ff99 },
      { level: 15, name: '🌠 Level 15', color: 0xff9900 },
      { level: 20, name: '💫 Level 20', color: 0xff0099 },
      { level: 25, name: '🌟 Level 25', color: 0x9900ff },
      { level: 30, name: '⭐ Level 30', color: 0xff6600 }
    ];

    for (const config of levelConfigs) {
      const existingRoleId = levelRoles[config.level.toString()];
      
      if (!existingRoleId || !guild.roles.cache.has(existingRoleId)) {
        const role = await guild.roles.create({
          name: config.name,
          color: config.color,
          reason: `Auto-created level ${config.level} role`
        });
        
        roles.push({ type: `level_${config.level}`, role: role });
        
        // Update config
        const currentLevelRoles = this.config.get('roles.levelRoles') || {};
        currentLevelRoles[config.level.toString()] = role.id;
        this.config.set('roles.levelRoles', currentLevelRoles);
      }
    }

    return roles;
  }

  async createOnboardingRoles(guild) {
    const roles = [];
    const onboardingRoles = this.config.get('roles.onboarding') || {};
    
    const onboardingConfigs = [
      { key: 'beginner', name: '🌱 Beginner', color: 0x00ff00 },
      { key: 'intermediate', name: '🌿 Intermediate', color: 0x0099ff },
      { key: 'advanced', name: '🌳 Advanced', color: 0x0099ff },
      { key: 'developer', name: '💻 Developer', color: 0xff6600 },
      { key: 'designer', name: '🎨 Designer', color: 0xff00ff },
      { key: 'gaming', name: '🎮 Gaming', color: 0x9900ff },
      { key: 'music', name: '🎵 Music', color: 0xff0099 }
    ];

    for (const config of onboardingConfigs) {
      const existingRoleId = onboardingRoles[config.key];
      
      if (!existingRoleId || !guild.roles.cache.has(existingRoleId)) {
        const role = await guild.roles.create({
          name: config.name,
          color: config.color,
          reason: `Auto-created onboarding role: ${config.key}`
        });
        
        roles.push({ type: `onboarding_${config.key}`, role: role });
        
        // Update config
        const currentOnboardingRoles = this.config.get('roles.onboarding') || {};
        currentOnboardingRoles[config.key] = role.id;
        this.config.set('roles.onboarding', currentOnboardingRoles);
      }
    }

    return roles;
  }

  async createInviteRewardRoles(guild) {
    const roles = [];
    const inviteRewards = this.config.get('invites.rewards') || {};
    
    const rewardConfigs = [
      { invites: 5, name: '🎯 Inviter (5)', color: 0x00ff00 },
      { invites: 10, name: '🏆 Inviter (10)', color: 0x0099ff },
      { invites: 25, name: '👑 Inviter (25)', color: 0xffd700 }
    ];

    for (const config of rewardConfigs) {
      const existingRoleId = inviteRewards[config.invites.toString()];
      
      if (!existingRoleId || !guild.roles.cache.has(existingRoleId)) {
        const role = await guild.roles.create({
          name: config.name,
          color: config.color,
          reason: `Auto-created invite reward role: ${config.invites} invites`
        });
        
        roles.push({ type: `invite_${config.invites}`, role: role });
        
        // Update config
        const currentInviteRewards = this.config.get('invites.rewards') || {};
        currentInviteRewards[config.invites.toString()] = role.id;
        this.config.set('invites.rewards', currentInviteRewards);
      }
    }

    return roles;
  }

  async updateConfigWithRoleIds(createdRoles) {
    try {
      // This updates the in-memory config
      // For persistent changes, you might want to write to file
      console.log('📝 Updated configuration with new role IDs');
      
      // Log all role IDs for user reference
      console.log('\n=== ROLE IDs ===');
      createdRoles.forEach(({ type, role }) => {
        console.log(`${type}: ${role.id}`);
      });
      console.log('================\n');

    } catch (error) {
      console.error('Error updating config with role IDs:', error);
    }
  }

  async logRoleCreation(guild, createdRoles) {
    try {
      const logChannelId = this.config.get('channels.logs');
      if (!logChannelId) return;

      const logChannel = await guild.channels.fetch(logChannelId);
      if (!logChannel) return;

      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('🔧 Roles Auto-Created')
        .setDescription(`The bot has created ${createdRoles.length} missing roles automatically.`)
        .addFields(
          createdRoles.map(({ type, role }) => ({
            name: type.replace(/_/g, ' ').toUpperCase(),
            value: `**${role.name}** (\`${role.id}\`)`,
            inline: true
          }))
        )
        .setTimestamp()
        .setFooter({ text: 'Role Management System' });

      await logChannel.send({ embeds: [embed] });

    } catch (error) {
      console.error('Error logging role creation:', error);
    }
  }

  async getRoleSummary(guild) {
    const allRoles = {
      verification: {
        verified: this.config.get('roles.verified'),
        unverified: this.config.get('roles.unverified')
      },
      levelRoles: this.config.get('roles.levelRoles') || {},
      onboardingRoles: this.config.get('roles.onboarding') || {},
      inviteRewards: this.config.get('invites.rewards') || {}
    };

    const summary = {
      totalConfigured: 0,
      totalFound: 0,
      missing: []
    };

    // Check verification roles
    if (allRoles.verification.verified) {
      summary.totalConfigured++;
      if (guild.roles.cache.has(allRoles.verification.verified)) {
        summary.totalFound++;
      } else {
        summary.missing.push('Verified role');
      }
    }

    if (allRoles.verification.unverified) {
      summary.totalConfigured++;
      if (guild.roles.cache.has(allRoles.verification.unverified)) {
        summary.totalFound++;
      } else {
        summary.missing.push('Unverified role');
      }
    }

    // Check level roles
    for (const [level, roleId] of Object.entries(allRoles.levelRoles)) {
      summary.totalConfigured++;
      if (guild.roles.cache.has(roleId)) {
        summary.totalFound++;
      } else {
        summary.missing.push(`Level ${level} role`);
      }
    }

    // Check onboarding roles
    for (const [key, roleId] of Object.entries(allRoles.onboardingRoles)) {
      summary.totalConfigured++;
      if (guild.roles.cache.has(roleId)) {
        summary.totalFound++;
      } else {
        summary.missing.push(`Onboarding ${key} role`);
      }
    }

    // Check invite reward roles
    for (const [invites, roleId] of Object.entries(allRoles.inviteRewards)) {
      summary.totalConfigured++;
      if (guild.roles.cache.has(roleId)) {
        summary.totalFound++;
      } else {
        summary.missing.push(`Invite ${invites} role`);
      }
    }

    return summary;
  }
}

module.exports = RoleManager;
