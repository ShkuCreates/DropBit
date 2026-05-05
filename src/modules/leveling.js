const { EmbedBuilder } = require('discord.js');
const Helpers = require('../utils/helpers');

class LevelingModule {
  constructor(client, db, config) {
    this.client = client;
    this.db = db;
    this.config = config;
    this.cooldowns = new Map();
  }

  async initialize() {
    console.log('📦 Leveling module initialized');
  }

  async handleMessage(message) {
    if (!this.config.get('leveling.enabled')) return;
    
    if (message.author.bot) return;
    if (!message.guild) return;

    const cooldownKey = `${message.author.id}_${message.guild.id}`;
    const cooldownTime = this.config.get('leveling.xpCooldown');
    
    if (this.cooldowns.has(cooldownKey)) {
      const lastMessage = this.cooldowns.get(cooldownKey);
      if (Date.now() - lastMessage < cooldownTime) return;
    }

    this.cooldowns.set(cooldownKey, Date.now());

    try {
      await this.addXP(message.author, message.guild);
    } catch (error) {
      console.error('Error in leveling system:', error);
    }
  }

  async addXP(user, guild) {
    const xpRange = this.config.get('leveling.xpPerMessage');
    const xpGained = Math.floor(Math.random() * (xpRange.max - xpRange.min + 1)) + xpRange.min;

    let userLevel = await this.db.findOne('levels', { userId: user.id, guildId: guild.id });

    if (!userLevel) {
      userLevel = await this.db.create('levels', {
        userId: user.id,
        guildId: guild.id,
        xp: xpGained,
        level: 1,
        totalMessages: 1,
        lastMessage: new Date()
      });
    } else {
      const oldLevel = userLevel.level;
      userLevel.xp += xpGained;
      userLevel.totalMessages += 1;
      userLevel.lastMessage = new Date();

      const newLevel = Helpers.calculateLevel(userLevel.xp);
      userLevel.level = newLevel;

      await this.db.updateById('levels', userLevel._id, {
        xp: userLevel.xp,
        level: userLevel.level,
        lastMessage: new Date()
      });

      if (newLevel > oldLevel) {
        await this.handleLevelUp(user, guild, newLevel, oldLevel, userLevel.xp);
      }
    }

    return userLevel;
  }

  async handleLevelUp(user, guild, newLevel, oldLevel, currentXP) {
    try {
      const member = await guild.members.fetch(user.id);
      
      await this.assignLevelRoles(member, newLevel);

      if (this.config.get('leveling.announceLevelUp')) {
        await this.announceLevelUp(member, newLevel, oldLevel, currentXP);
      }

      await this.sendLevelUpDM(member, newLevel, oldLevel, currentXP);

    } catch (error) {
      console.error('Error handling level up:', error);
    }
  }

  async assignLevelRoles(member, level) {
    const levelRoles = this.config.get('roles.levelRoles') || {};
    const rolesToRemove = [];
    const rolesToAdd = [];

    for (const [requiredLevel, roleId] of Object.entries(levelRoles)) {
      const reqLevel = parseInt(requiredLevel);
      
      if (level >= reqLevel) {
        if (!member.roles.cache.has(roleId)) {
          rolesToAdd.push(roleId);
        }
      } else {
        if (member.roles.cache.has(roleId)) {
          rolesToRemove.push(roleId);
        }
      }
    }

    if (rolesToAdd.length > 0) {
      await member.roles.add(rolesToAdd).catch(() => {});
    }

    if (rolesToRemove.length > 0) {
      await member.roles.remove(rolesToRemove).catch(() => {});
    }
  }

  async announceLevelUp(member, newLevel, oldLevel, currentXP) {
    const levelUpChannelId = this.config.get('channels.levelUp');
    if (!levelUpChannelId) return;

    try {
      const levelUpChannel = await this.client.channels.fetch(levelUpChannelId);
      if (!levelUpChannel) return;

      const message = this.config.get('leveling.levelUpMessage')
        .replace('{user}', member.toString())
        .replace('{level}', newLevel.toString());

      const xpForNextLevel = Helpers.calculateXP(newLevel + 1);
      const xpProgress = Helpers.createProgressBar(currentXP, xpForNextLevel);

      const embed = new EmbedBuilder()
        .setColor(0x000000) // Black embed
        .setTitle('🎉 Level Up!')
        .addFields(
          {
            name: '◻️ USER LEVELED UP TO',
            value: `Level ${newLevel}`,
            inline: false
          },
          {
            name: 'XP Progress',
            value: xpProgress,
            inline: true
          },
          {
            name: 'Total XP',
            value: Helpers.formatNumber(currentXP),
            inline: true
          }
        )
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .setTimestamp();

      await levelUpChannel.send({ embeds: [embed] });
    } catch (error) {
      console.error('Error announcing level up:', error);
    }
  }

  async sendLevelUpDM(member, newLevel, oldLevel, currentXP) {
    try {
      const xpForNextLevel = Helpers.calculateXP(newLevel + 1);
      const xpProgress = Helpers.createProgressBar(currentXP, xpForNextLevel);

      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('🎉 Congratulations!')
        .setDescription(`You've reached **Level ${newLevel}** in **${member.guild.name}**!`)
        .addFields(
          {
            name: 'Previous Level',
            value: oldLevel.toString(),
            inline: true
          },
          {
            name: 'Current Level',
            value: newLevel.toString(),
            inline: true
          },
          {
            name: 'XP Progress',
            value: xpProgress,
            inline: false
          }
        )
        .setFooter({
          text: 'Keep chatting to earn more XP!'
        });

      await Helpers.sendDM(member.user, { embeds: [embed] });
    } catch (error) {
      console.error('Error sending level up DM:', error);
    }
  }

  async getUserLevel(user, guild) {
    const userLevel = await this.db.findOne('levels', { userId: user.id, guildId: guild.id });
    
    if (!userLevel) {
      return {
        level: 1,
        xp: 0,
        totalMessages: 0,
        rank: await this.getUserRank(user, guild)
      };
    }

    const rank = await this.getUserRank(user, guild);
    const xpForCurrentLevel = Helpers.calculateXP(userLevel.level);
    const xpForNextLevel = Helpers.calculateXP(userLevel.level + 1);
    const xpProgress = userLevel.xp - xpForCurrentLevel;
    const xpNeeded = xpForNextLevel - xpForCurrentLevel;
    const progressPercentage = (xpProgress / xpNeeded) * 100;

    return {
      level: userLevel.level,
      xp: userLevel.xp,
      totalMessages: userLevel.totalMessages,
      rank,
      xpProgress,
      xpNeeded,
      progressPercentage,
      xpForNextLevel
    };
  }

  async getUserRank(user, guild) {
    const allLevels = await this.db.find('levels', { guildId: guild.id });
    const sortedLevels = allLevels.sort((a, b) => b.xp - a.xp);
    return sortedLevels.findIndex(level => level.userId === user.id) + 1;
  }

  async getLeaderboard(guild, limit = 10) {
    const allLevels = await this.db.find('levels', { guildId: guild.id });
    const sortedLevels = allLevels
      .sort((a, b) => b.xp - a.xp)
      .slice(0, limit);

    const leaderboard = [];
    for (let i = 0; i < sortedLevels.length; i++) {
      const levelData = sortedLevels[i];
      try {
        const user = await this.client.users.fetch(levelData.userId);
        leaderboard.push({
          position: i + 1,
          user,
          level: levelData.level,
          xp: levelData.xp,
          totalMessages: levelData.totalMessages
        });
      } catch (error) {
        console.error(`Error fetching user ${levelData.userId}:`, error);
      }
    }

    return leaderboard;
  }

  async createLeaderboardEmbed(guild, limit = 10) {
    const leaderboard = await this.getLeaderboard(guild, limit);

    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle(`🏆 ${guild.name} Leaderboard`)
      .setDescription(`Top ${limit} members by XP`)
      .setTimestamp();

    if (leaderboard.length === 0) {
      embed.setDescription('No data available yet. Start chatting to earn XP!');
    } else {
      let description = '';
      for (const entry of leaderboard) {
        const medal = entry.position === 1 ? '🥇' : entry.position === 2 ? '🥈' : entry.position === 3 ? '🥉' : '🎖️';
        description += `${medal} **${entry.position}.** ${entry.user.tag} - Level ${entry.level} (${Helpers.formatNumber(entry.xp)} XP)\n`;
      }
      embed.setDescription(description);
    }

    return embed;
  }

  async resetUserXP(user, guild) {
    await this.db.deleteOne('levels', { userId: user.id, guildId: guild.id });
    
    const member = await guild.members.fetch(user.id);
    const levelRoles = this.config.get('roles.levelRoles') || {};
    const rolesToRemove = Object.values(levelRoles);
    
    if (rolesToRemove.length > 0) {
      await member.roles.remove(rolesToRemove).catch(() => {});
    }
  }
}

module.exports = LevelingModule;
