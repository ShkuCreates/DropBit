const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const moment = require('moment');

class Helpers {
  static createEmbed(options = {}) {
    return new EmbedBuilder()
      .setColor(options.color || 0x0099ff)
      .setTitle(options.title)
      .setDescription(options.description)
      .setTimestamp(options.timestamp !== false)
      .setFooter(options.footer ? { text: options.footer } : null)
      .setThumbnail(options.thumbnail ? null : null)
      .setImage(options.image || null);
  }

  static createButton(label, style = ButtonStyle.Primary, customId = null, emoji = null, disabled = false) {
    const button = new ButtonBuilder()
      .setLabel(label)
      .setStyle(style)
      .setDisabled(disabled);

    if (customId) button.setCustomId(customId);
    if (emoji) button.setEmoji(emoji);

    return button;
  }

  static createSelectMenu(customId, placeholder, options = [], minValues = 1, maxValues = 1) {
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(customId)
      .setPlaceholder(placeholder)
      .setMinValues(minValues)
      .setMaxValues(maxValues);

    options.forEach(option => {
      selectMenu.addOptions({
        label: option.label,
        value: option.value,
        description: option.description,
        emoji: option.emoji
      });
    });

    return selectMenu;
  }

  static createActionRow(...components) {
    return new ActionRowBuilder().addComponents(...components);
  }

  static formatTime(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  static parseDuration(duration) {
    const match = duration.match(/^(\d+)([smhd])$/);
    if (!match) return null;

    const [, amount, unit] = match;
    const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
    return parseInt(amount) * multipliers[unit];
  }

  static calculateXP(level) {
    return Math.floor(100 * Math.pow(1.5, level - 1));
  }

  static calculateLevel(xp) {
    let level = 1;
    let requiredXP = 0;

    while (xp >= requiredXP) {
      requiredXP = this.calculateXP(level + 1);
      if (xp >= requiredXP) level++;
    }

    return level;
  }

  static generateCaptcha(length = 6) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let captcha = '';
    for (let i = 0; i < length; i++) {
      captcha += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return captcha;
  }

  static checkPermissions(member, permissions) {
    if (!member) return false;
    
    if (typeof permissions === 'string') {
      return member.permissions.has(permissions);
    }
    
    if (Array.isArray(permissions)) {
      return permissions.every(perm => member.permissions.has(perm));
    }
    
    return false;
  }

  static hasAdminRole(member, config) {
    if (!member) return false;
    
    const adminRoles = config.get('bot.adminRoles') || [];
    return member.roles.cache.some(role => adminRoles.includes(role.name));
  }

  static cleanMentions(text) {
    return text.replace(/<@!?(\d+)>/g, '[@]').replace(/<@&(\d+)>/g, '[@role]').replace(/<#(\d+)>/g, '[#channel]');
  }

  static truncateString(str, maxLength = 100) {
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength - 3) + '...';
  }

  static isValidUrl(string) {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  }

  static extractUrls(text) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.match(urlRegex) || [];
  }

  static checkCapsPercentage(message) {
    if (message.length < 10) return 0;
    
    const caps = message.replace(/[^A-Z]/g, '').length;
    return (caps / message.length) * 100;
  }

  static async sendDM(user, content, options = {}) {
    try {
      await user.send(content, options);
      return true;
    } catch (error) {
      console.error(`Failed to send DM to ${user.tag}:`, error);
      return false;
    }
  }

  static async createTempChannel(guild, name, parent, options = {}) {
    try {
      const channel = await guild.channels.create({
        name,
        type: 0, // GUILD_TEXT
        parent,
        permissionOverwrites: [
          {
            id: guild.id,
            deny: ['ViewChannel']
          },
          {
            id: options.allowRole || guild.id,
            allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory']
          }
        ],
        ...options
      });
      
      return channel;
    } catch (error) {
      console.error('Failed to create temporary channel:', error);
      return null;
    }
  }

  static async deleteChannel(channel, reason = 'Temporary channel cleanup') {
    try {
      await channel.delete(reason);
      return true;
    } catch (error) {
      console.error('Failed to delete channel:', error);
      return false;
    }
  }

  static createProgressBar(current, max, size = 10) {
    const percentage = current / max;
    const filled = Math.round(size * percentage);
    const empty = size - filled;
    
    const filledBar = '█'.repeat(filled);
    const emptyBar = '░'.repeat(empty);
    
    return `[${filledBar}${emptyBar}] ${current}/${max}`;
  }

  static formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  static getRandomElement(array) {
    return array[Math.floor(Math.random() * array.length)];
  }

  static shuffleArray(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  }

  static async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static async retry(fn, maxAttempts = 3, delay = 1000) {
    let attempt = 0;
    
    while (attempt < maxAttempts) {
      try {
        return await fn();
      } catch (error) {
        attempt++;
        if (attempt >= maxAttempts) throw error;
        
        await this.sleep(delay * attempt);
      }
    }
  }

  static createErrorEmbed(title, description) {
    return this.createEmbed({
      title: `❌ ${title}`,
      description,
      color: 0xff0000
    });
  }

  static createSuccessEmbed(title, description) {
    return this.createEmbed({
      title: `✅ ${title}`,
      description,
      color: 0x00ff00
    });
  }

  static createInfoEmbed(title, description) {
    return this.createEmbed({
      title: `ℹ️ ${title}`,
      description,
      color: 0x0099ff
    });
  }

  static createWarningEmbed(title, description) {
    return this.createEmbed({
      title: `⚠️ ${title}`,
      description,
      color: 0xffaa00
    });
  }
}

module.exports = Helpers;
