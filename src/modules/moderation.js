const { EmbedBuilder } = require('discord.js');
const Helpers = require('../utils/helpers');

class ModerationModule {
  constructor(client, db, config) {
    this.client = client;
    this.db = db;
    this.config = config;
    this.messageCache = new Map();
    this.spamTracker = new Map();
    this.duplicateTracker = new Map();
  }

  async initialize() {
    console.log('📦 Moderation module initialized');
    this.startCleanupInterval();
  }

  async handleMessage(message) {
    if (!this.config.get('moderation.enabled')) return;
    
    if (message.author.bot) return;
    if (!message.guild) return;
    if (!message.member) return;

    if (Helpers.hasAdminRole(message.member, this.config)) return;

    let actionTaken = false;

    try {
      if (this.config.get('moderation.antiSpam.enabled')) {
        const spamResult = await this.checkSpam(message);
        if (spamResult.actionTaken) actionTaken = true;
      }

      if (!actionTaken && this.config.get('moderation.antiLink.enabled')) {
        const linkResult = await this.checkLinks(message);
        if (linkResult.actionTaken) actionTaken = true;
      }

      if (!actionTaken && this.config.get('moderation.wordFilter.enabled')) {
        const wordResult = await this.checkWordFilter(message);
        if (wordResult.actionTaken) actionTaken = true;
      }

      if (!actionTaken && this.config.get('moderation.capsFilter.enabled')) {
        const capsResult = await this.checkCapsFilter(message);
        if (capsResult.actionTaken) actionTaken = true;
      }

      if (!actionTaken && this.config.get('moderation.duplicateMessages.enabled')) {
        const duplicateResult = await this.checkDuplicateMessages(message);
        if (duplicateResult.actionTaken) actionTaken = true;
      }

    } catch (error) {
      console.error('Error in moderation system:', error);
    }
  }

  async checkSpam(message) {
    const config = this.config.get('moderation.antiSpam');
    const userId = message.author.id;
    const guildId = message.guild.id;
    const key = `${userId}_${guildId}`;

    if (!this.spamTracker.has(key)) {
      this.spamTracker.set(key, []);
    }

    const userMessages = this.spamTracker.get(key);
    const now = Date.now();
    
    userMessages.push(now);
    
    const recentMessages = userMessages.filter(timestamp => now - timestamp < config.timeWindow);
    this.spamTracker.set(key, recentMessages);

    if (recentMessages.length >= config.maxMessages) {
      await this.takeModerationAction(message, 'spam', config.action, config.duration);
      return { actionTaken: true };
    }

    return { actionTaken: false };
  }

  async checkLinks(message) {
    const config = this.config.get('moderation.antiLink');
    const urls = Helpers.extractUrls(message.content);

    if (urls.length === 0) return { actionTaken: false };

    const whitelistedDomains = config.whitelistedDomains || [];
    
    for (const url of urls) {
      try {
        const urlObj = new URL(url);
        if (!whitelistedDomains.includes(urlObj.hostname)) {
          await this.takeModerationAction(message, 'links', config.action, 0, 'Detected unauthorized link');
          return { actionTaken: true };
        }
      } catch (error) {
        await this.takeModerationAction(message, 'links', config.action, 0, 'Detected unauthorized link');
        return { actionTaken: true };
      }
    }

    return { actionTaken: false };
  }

  async checkWordFilter(message) {
    const config = this.config.get('moderation.wordFilter');
    const blacklistedWords = config.blacklistedWords || [];
    const content = message.content.toLowerCase();

    for (const word of blacklistedWords) {
      if (content.includes(word.toLowerCase())) {
        await this.takeModerationAction(message, 'word_filter', config.action, 0, `Blacklisted word: ${word}`);
        return { actionTaken: true };
      }
    }

    return { actionTaken: false };
  }

  async checkCapsFilter(message) {
    const config = this.config.get('moderation.capsFilter');
    
    if (message.content.length < config.minLength) return { actionTaken: false };

    const capsPercentage = Helpers.checkCapsPercentage(message.content);
    
    if (capsPercentage >= config.maxCapsPercentage) {
      await this.takeModerationAction(message, 'caps_filter', config.action, 0, `Too many caps: ${Math.round(capsPercentage)}%`);
      return { actionTaken: true };
    }

    return { actionTaken: false };
  }

  async checkDuplicateMessages(message) {
    const config = this.config.get('moderation.duplicateMessages');
    const userId = message.author.id;
    const guildId = message.guild.id;
    const key = `${userId}_${guildId}`;

    if (!this.duplicateTracker.has(key)) {
      this.duplicateTracker.set(key, []);
    }

    const userMessages = this.duplicateTracker.get(key);
    const now = Date.now();
    
    userMessages.push({
      content: message.content,
      timestamp: now
    });
    
    const recentMessages = userMessages.filter(msg => now - msg.timestamp < config.checkTimeWindow);
    this.duplicateTracker.set(key, recentMessages);

    const duplicateCount = recentMessages.filter(msg => msg.content === message.content).length;

    if (duplicateCount >= config.maxDuplicates) {
      await this.takeModerationAction(message, 'duplicate_messages', config.action, 0, 'Duplicate message detected');
      return { actionTaken: true };
    }

    return { actionTaken: false };
  }

  async takeModerationAction(message, type, action, duration = 0, reason = '') {
    try {
      let actionTaken = '';
      let logReason = reason || `Automatic moderation: ${type}`;

      switch (action) {
        case 'delete':
          await message.delete();
          actionTaken = 'Message deleted';
          break;

        case 'warn':
          await this.warnUser(message.member, logReason);
          await message.delete();
          actionTaken = 'User warned and message deleted';
          break;

        case 'timeout':
          await message.member.timeout(duration, logReason);
          await message.delete();
          actionTaken = `User timed out for ${Helpers.formatTime(duration)}`;
          break;

        case 'kick':
          await message.member.kick(logReason);
          actionTaken = 'User kicked';
          break;

        case 'ban':
          await message.member.ban({ reason: logReason });
          actionTaken = 'User banned';
          break;

        default:
          await message.delete();
          actionTaken = 'Message deleted';
      }

      await this.logModerationAction(message.member, type, actionTaken, logReason, duration);

      if (this.config.get('moderation.warnUser') && action !== 'delete') {
        await this.sendModerationDM(message.author, actionTaken, logReason);
      }

    } catch (error) {
      console.error('Error taking moderation action:', error);
    }
  }

  async warnUser(member, reason) {
    const logger = require('../utils/logger');
    const Logger = new logger(this.client, this.db, this.config);
    
    await Logger.log('moderationAction', {
      action: 'warn',
      target: member.user,
      executor: this.client.user,
      reason
    }, member.guild);
  }

  async sendModerationDM(user, action, reason) {
    try {
      const embed = new EmbedBuilder()
        .setColor(0xff6600)
        .setTitle('⚠️ Moderation Action')
        .setDescription(`You have been moderated in **${user.guild?.name || 'a server'}**`)
        .addFields(
          { name: 'Action', value: action, inline: true },
          { name: 'Reason', value: reason, inline: true }
        )
        .setTimestamp()
        .setFooter({ text: 'This was an automatic action. If you believe this is a mistake, please contact the server staff.' });

      await Helpers.sendDM(user, { embeds: [embed] });
    } catch (error) {
      console.error('Error sending moderation DM:', error);
    }
  }

  async logModerationAction(member, type, action, reason, duration) {
    const logger = require('../utils/logger');
    const Logger = new logger(this.client, this.db, this.config);
    
    await Logger.log('moderationAction', {
      action: type,
      target: member.user,
      executor: this.client.user,
      reason,
      duration: duration ? Helpers.formatTime(duration) : null
    }, member.guild);
  }

  async manualModeration(staff, target, action, reason, duration) {
    if (!Helpers.hasAdminRole(staff, this.config)) {
      throw new Error('You do not have permission to use moderation commands.');
    }

    try {
      let actionTaken = '';
      const logReason = `Manual moderation by ${staff.user.tag}: ${reason}`;

      switch (action.toLowerCase()) {
        case 'warn':
          await this.warnUser(target, logReason);
          actionTaken = 'User warned';
          break;

        case 'timeout':
          if (!duration) throw new Error('Duration is required for timeout action');
          await target.timeout(duration, logReason);
          actionTaken = `User timed out for ${Helpers.formatTime(duration)}`;
          break;

        case 'kick':
          await target.kick(logReason);
          actionTaken = 'User kicked';
          break;

        case 'ban':
          await target.ban({ reason: logReason });
          actionTaken = 'User banned';
          break;

        default:
          throw new Error('Invalid moderation action. Use: warn, timeout, kick, ban');
      }

      await this.logModerationAction(target, action, actionTaken, logReason, duration);

      return {
        success: true,
        action: actionTaken,
        target: target.user.tag
      };

    } catch (error) {
      console.error('Error in manual moderation:', error);
      throw error;
    }
  }

  async clearMessages(channel, amount, staff) {
    if (!Helpers.hasAdminRole(staff, this.config)) {
      throw new Error('You do not have permission to clear messages.');
    }

    if (amount < 1 || amount > 100) {
      throw new Error('Amount must be between 1 and 100.');
    }

    try {
      const messages = await channel.messages.fetch({ limit: amount });
      await channel.bulkDelete(messages);

      const logger = require('../utils/logger');
      const Logger = new logger(this.client, this.db, this.config);
      
      await Logger.log('moderationAction', {
        action: 'clear_messages',
        target: null,
        executor: staff.user,
        reason: `Cleared ${amount} messages in #${channel.name}`
      }, staff.guild);

      return {
        success: true,
        messagesCleared: messages.size
      };

    } catch (error) {
      console.error('Error clearing messages:', error);
      throw error;
    }
  }

  startCleanupInterval() {
    setInterval(() => {
      const now = Date.now();
      
      for (const [key, messages] of this.spamTracker.entries()) {
        const recentMessages = messages.filter(timestamp => now - timestamp < 60000);
        if (recentMessages.length === 0) {
          this.spamTracker.delete(key);
        } else {
          this.spamTracker.set(key, recentMessages);
        }
      }

      for (const [key, messages] of this.duplicateTracker.entries()) {
        const recentMessages = messages.filter(msg => now - msg.timestamp < 60000);
        if (recentMessages.length === 0) {
          this.duplicateTracker.delete(key);
        } else {
          this.duplicateTracker.set(key, recentMessages);
        }
      }
    }, 60000);
  }
}

module.exports = ModerationModule;
