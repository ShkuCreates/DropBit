const { EmbedBuilder } = require('discord.js');
const Helpers = require('../utils/helpers');

class AntiRaidModule {
  constructor(client, db, config) {
    this.client = client;
    this.db = db;
    this.config = config;
    this.joinTracker = [];
    this.raidActive = false;
    this.raidCooldown = false;
  }

  async initialize() {
    console.log('📦 Anti-raid module initialized');
    this.startCleanupInterval();
  }

  async handleMemberJoin(member) {
    if (!this.config.get('antiRaid.enabled')) return;

    const now = Date.now();
    this.joinTracker.push(now);

    const timeWindow = this.config.get('antiRaid.timeWindow');
    const threshold = this.config.get('antiRaid.joinThreshold');

    const recentJoins = this.joinTracker.filter(timestamp => now - timestamp < timeWindow);

    if (recentJoins.length >= threshold && !this.raidActive && !this.raidCooldown) {
      await this.triggerRaidProtection(member.guild, recentJoins.length);
    }
  }

  async triggerRaidProtection(guild, joinCount) {
    if (this.raidActive) return;

    this.raidActive = true;
    console.log(`🚨 Raid protection triggered! ${joinCount} joins detected.`);

    try {
      const actions = this.config.get('antiRaid.actions');
      
      if (actions.enableSlowMode) {
        await this.enableSlowMode(guild);
      }

      if (actions.lockChannels) {
        await this.lockChannels(guild);
      }

      if (actions.alertAdmins) {
        await this.alertAdmins(guild, joinCount);
      }

      const logger = require('../utils/logger');
      const Logger = new logger(this.client, this.db, this.config);
      await Logger.log('moderationAction', {
        action: 'raid_protection',
        target: null,
        executor: this.client.user,
        reason: `Mass join detected: ${joinCount} members in ${this.config.get('antiRaid.timeWindow')}ms`
      }, guild);

      if (actions.autoReset) {
        setTimeout(() => {
          this.resetRaidProtection(guild);
        }, this.config.get('antiRaid.actions.resetCooldown'));
      }

    } catch (error) {
      console.error('Error triggering raid protection:', error);
    }
  }

  async enableSlowMode(guild) {
    try {
      const duration = this.config.get('antiRaid.actions.slowModeDuration');
      const channels = guild.channels.cache.filter(channel => 
        channel.type === 0 && // GUILD_TEXT
        channel.permissionsFor(guild.me).has('ManageChannels')
      );

      let enabledCount = 0;
      for (const channel of channels.values()) {
        try {
          await channel.setRateLimitPerUser(duration, 'Raid protection');
          enabledCount++;
        } catch (error) {
          console.error(`Error setting slow mode for channel ${channel.name}:`, error);
        }
      }

      console.log(`✅ Enabled slow mode (${duration}s) in ${enabledCount} channels`);

    } catch (error) {
      console.error('Error enabling slow mode:', error);
    }
  }

  async disableSlowMode(guild) {
    try {
      const channels = guild.channels.cache.filter(channel => 
        channel.type === 0 && // GUILD_TEXT
        channel.permissionsFor(guild.me).has('ManageChannels')
      );

      let disabledCount = 0;
      for (const channel of channels.values()) {
        try {
          if (channel.rateLimitPerUser > 0) {
            await channel.setRateLimitPerUser(0, 'Raid protection reset');
            disabledCount++;
          }
        } catch (error) {
          console.error(`Error disabling slow mode for channel ${channel.name}:`, error);
        }
      }

      console.log(`✅ Disabled slow mode in ${disabledCount} channels`);

    } catch (error) {
      console.error('Error disabling slow mode:', error);
    }
  }

  async lockChannels(guild) {
    try {
      const channels = guild.channels.cache.filter(channel => 
        channel.type === 0 && // GUILD_TEXT
        channel.permissionsFor(guild.me).has('ManageChannels')
      );

      let lockedCount = 0;
      for (const channel of channels.values()) {
        try {
          await channel.permissionOverwrites.edit(guild.id, {
            SendMessages: false
          }, { reason: 'Raid protection - channel locked' });
          lockedCount++;
        } catch (error) {
          console.error(`Error locking channel ${channel.name}:`, error);
        }
      }

      console.log(`🔒 Locked ${lockedCount} channels`);

    } catch (error) {
      console.error('Error locking channels:', error);
    }
  }

  async unlockChannels(guild) {
    try {
      const channels = guild.channels.cache.filter(channel => 
        channel.type === 0 && // GUILD_TEXT
        channel.permissionsFor(guild.me).has('ManageChannels')
      );

      let unlockedCount = 0;
      for (const channel of channels.values()) {
        try {
          const existingPerms = channel.permissionOverwrites.cache.get(guild.id);
          if (existingPerms && existingPerms.deny.has('SendMessages')) {
            await channel.permissionOverwrites.delete(guild.id, 'Raid protection reset');
            unlockedCount++;
          }
        } catch (error) {
          console.error(`Error unlocking channel ${channel.name}:`, error);
        }
      }

      console.log(`🔓 Unlocked ${unlockedCount} channels`);

    } catch (error) {
      console.error('Error unlocking channels:', error);
    }
  }

  async alertAdmins(guild, joinCount) {
    try {
      const alertsChannelId = this.config.get('channels.alerts');
      if (!alertsChannelId) return;

      const alertsChannel = await guild.channels.fetch(alertsChannelId);
      if (!alertsChannel) return;

      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('🚨 RAID DETECTED')
        .setDescription(`A potential raid has been detected and protection measures have been activated.`)
        .addFields(
          {
            name: 'Join Count',
            value: `${joinCount} members`,
            inline: true
          },
          {
            name: 'Time Window',
            value: `${this.config.get('antiRaid.timeWindow')}ms`,
            inline: true
          },
          {
            name: 'Actions Taken',
            value: this.getActionsTakenText(),
            inline: false
          }
        )
        .setTimestamp()
        .setFooter({
          text: 'Anti-raid system activated'
        });

      await alertsChannel.send({ 
        content: '@everyone', 
        embeds: [embed] 
      });

    } catch (error) {
      console.error('Error alerting admins:', error);
    }
  }

  getActionsTakenText() {
    const actions = this.config.get('antiRaid.actions');
    const actionTexts = [];

    if (actions.enableSlowMode) {
      actionTexts.push(`✅ Slow mode enabled (${actions.slowModeDuration}s)`);
    }

    if (actions.lockChannels) {
      actionTexts.push('🔒 Channels locked');
    }

    if (actions.alertAdmins) {
      actionTexts.push('📢 Admins alerted');
    }

    if (actions.autoReset) {
      const resetTime = Helpers.formatTime(actions.resetCooldown);
      actionTexts.push(`🔄 Auto-reset in ${resetTime}`);
    }

    return actionTexts.join('\n') || 'No actions configured';
  }

  async resetRaidProtection(guild) {
    if (!this.raidActive) return;

    try {
      const actions = this.config.get('antiRaid.actions');
      
      if (actions.enableSlowMode) {
        await this.disableSlowMode(guild);
      }

      if (actions.lockChannels) {
        await this.unlockChannels(guild);
      }

      this.raidActive = false;
      this.raidCooldown = true;
      this.joinTracker = [];

      console.log('✅ Raid protection reset');

      const alertsChannelId = this.config.get('channels.alerts');
      if (alertsChannelId) {
        const alertsChannel = await guild.channels.fetch(alertsChannelId);
        if (alertsChannel) {
          const embed = new EmbedBuilder()
            .setColor(0x00ff00)
            .setTitle('✅ Raid Protection Reset')
            .setDescription('Anti-raid protection has been automatically reset.')
            .setTimestamp();

          await alertsChannel.send({ embeds: [embed] });
        }
      }

      setTimeout(() => {
        this.raidCooldown = false;
      }, 300000); // 5 minute cooldown before re-triggering

    } catch (error) {
      console.error('Error resetting raid protection:', error);
    }
  }

  async manualReset(member) {
    if (!Helpers.hasAdminRole(member, this.config)) {
      throw new Error('You need admin permissions to reset raid protection.');
    }

    try {
      await this.resetRaidProtection(member.guild);

      return {
        success: true,
        message: 'Raid protection has been manually reset.'
      };

    } catch (error) {
      console.error('Error in manual raid reset:', error);
      throw error;
    }
  }

  getRaidStatus() {
    return {
      active: this.raidActive,
      cooldown: this.raidCooldown,
      recentJoins: this.joinTracker.length,
      joinTracker: this.joinTracker.slice(-10) // Last 10 joins
    };
  }

  startCleanupInterval() {
    setInterval(() => {
      const now = Date.now();
      const cutoff = now - this.config.get('antiRaid.timeWindow');
      
      this.joinTracker = this.joinTracker.filter(timestamp => timestamp > cutoff);
    }, 30000); // Clean up every 30 seconds
  }
}

module.exports = AntiRaidModule;
