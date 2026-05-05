const { EmbedBuilder } = require('discord.js');
const moment = require('moment');

class Logger {
  constructor(client, db, config) {
    this.client = client;
    this.db = db;
    this.config = config;
  }

  async log(event, data, guild) {
    if (!this.config.get('logging.enabled')) return;
    
    const enabledEvents = this.config.get('logging.events') || [];
    if (!enabledEvents.includes(event)) return;

    const logChannelId = this.config.get('channels.logs');
    if (!logChannelId) return;

    try {
      const logChannel = await this.client.channels.fetch(logChannelId);
      if (!logChannel) return;

      const embed = this.createLogEmbed(event, data, guild);
      await logChannel.send({ embeds: [embed] });
    } catch (error) {
      console.error('Failed to send log message:', error);
    }
  }

  createLogEmbed(event, data, guild) {
    const embed = new EmbedBuilder()
      .setColor(0x000000) // Black embed for all logs
      .setTitle(this.getLogTitle(event))
      .setTimestamp()
      .setFooter({ text: `DropBit Logger • ${moment().format('YYYY-MM-DD HH:mm:ss')}` });

    switch (event) {
      case 'memberJoin':
        embed.addFields(
          { name: '◻️ USER', value: data.user.tag, inline: false },
          { name: '◻️ USER ID', value: data.user.id, inline: false },
          { name: '◻️ ACCOUNT CREATED', value: moment(data.user.createdAt).format('YYYY-MM-DD'), inline: false },
          { name: '◻️ TOTAL MEMBERS', value: `${guild.memberCount}`, inline: false }
        );
        if (data.inviter) {
          embed.addFields({ name: '◻️ INVITED BY', value: data.inviter.tag, inline: false });
        }
        break;

      case 'memberLeave':
        embed.addFields(
          { name: '◻️ USER', value: data.user.tag, inline: false },
          { name: '◻️ USER ID', value: data.user.id, inline: false },
          { name: '◻️ JOINED AT', value: data.joinedAt ? moment(data.joinedAt).format('YYYY-MM-DD') : 'Unknown', inline: false }
        );
        break;

      case 'roleAdd':
        embed.addFields(
          { name: '◻️ USER', value: data.member.user.tag, inline: false },
          { name: '◻️ ROLE', value: data.role.name, inline: false },
          { name: '◻️ EXECUTOR', value: data.executor ? data.executor.tag : 'Unknown', inline: false }
        );
        break;

      case 'roleRemove':
        embed.addFields(
          { name: '◻️ USER', value: data.member.user.tag, inline: false },
          { name: '◻️ ROLE', value: data.role.name, inline: false },
          { name: '◻️ EXECUTOR', value: data.executor ? data.executor.tag : 'Unknown', inline: false }
        );
        break;

      case 'messageDelete':
        embed.addFields(
          { name: '◻️ AUTHOR', value: data.author.tag, inline: false },
          { name: '◻️ CHANNEL', value: `#${data.channel.name}`, inline: false }
        );
        if (data.content) {
          embed.addFields({ 
            name: '◻️ CONTENT', 
            value: data.content.length > 1024 ? data.content.substring(0, 1021) + '...' : data.content,
            inline: false 
          });
        }
        break;

      case 'messageEdit':
        embed.addFields(
          { name: '◻️ AUTHOR', value: data.author.tag, inline: false },
          { name: '◻️ CHANNEL', value: `#${data.channel.name}`, inline: false }
        );
        if (data.oldContent && data.newContent) {
          embed.addFields(
            { 
              name: '◻️ OLD CONTENT', 
              value: data.oldContent.length > 1024 ? data.oldContent.substring(0, 1021) + '...' : data.oldContent,
              inline: false 
            },
            { 
              name: '◻️ NEW CONTENT', 
              value: data.newContent.length > 1024 ? data.newContent.substring(0, 1021) + '...' : data.newContent,
              inline: false 
            }
          );
        }
        break;

      case 'ban':
        embed.addFields(
          { name: '◻️ USER', value: data.user.tag, inline: false },
          { name: '◻️ EXECUTOR', value: data.executor.tag, inline: false },
          { name: '◻️ REASON', value: data.reason || 'No reason provided', inline: false }
        );
        break;

      case 'kick':
        embed.addFields(
          { name: '◻️ USER', value: data.user.tag, inline: false },
          { name: '◻️ EXECUTOR', value: data.executor.tag, inline: false },
          { name: '◻️ REASON', value: data.reason || 'No reason provided', inline: false }
        );
        break;

      case 'verificationSuccess':
        embed.addFields(
          { name: '◻️ USER', value: data.user.tag, inline: false },
          { name: '◻️ TIME TAKEN', value: `${data.timeTaken}ms`, inline: false }
        );
        break;

      case 'verificationFail':
        embed.addFields(
          { name: '◻️ USER', value: data.user.tag, inline: false },
          { name: '◻️ ATTEMPTS', value: data.attempts.toString(), inline: false },
          { name: '◻️ REASON', value: data.reason, inline: false }
        );
        break;

      case 'moderationAction':
        embed.addFields(
          { name: '◻️ ACTION', value: data.action, inline: false },
          { name: '◻️ TARGET', value: data.target.tag, inline: false },
          { name: '◻️ EXECUTOR', value: data.executor.tag, inline: false },
          { name: '◻️ REASON', value: data.reason || 'No reason provided', inline: false }
        );
        if (data.duration) {
          embed.addFields({ name: '◻️ DURATION', value: data.duration, inline: false });
        }
        break;

      default:
        embed.addFields({ name: '◻️ DATA', value: JSON.stringify(data, null, 2), inline: false });
    }

    return embed;
  }

  getLogColor(event) {
    const colors = {
      memberJoin: 0x00ff00,
      memberLeave: 0xff0000,
      roleAdd: 0x0099ff,
      roleRemove: 0xff9900,
      messageDelete: 0xff0000,
      messageEdit: 0xffaa00,
      ban: 0xff0000,
      kick: 0xff9900,
      verificationSuccess: 0x00ff00,
      verificationFail: 0xff0000,
      moderationAction: 0xff6600
    };
    return colors[event] || 0x999999;
  }

  getLogTitle(event) {
    const titles = {
      memberJoin: '👋 Member Joined',
      memberLeave: '👋 Member Left',
      roleAdd: '🎭 Role Added',
      roleRemove: '🎭 Role Removed',
      messageDelete: '🗑️ Message Deleted',
      messageEdit: '✏️ Message Edited',
      ban: '🔨 User Banned',
      kick: '👢 User Kicked',
      verificationSuccess: '✅ Verification Success',
      verificationFail: '❌ Verification Failed',
      moderationAction: '⚖️ Moderation Action'
    };
    return titles[event] || '📋 Log Entry';
  }

  async error(error, context = {}) {
    console.error('Bot Error:', error, context);
    
    const logChannelId = this.config.get('channels.logs');
    if (!logChannelId) return;

    try {
      const logChannel = await this.client.channels.fetch(logChannelId);
      if (!logChannel) return;

      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Bot Error')
        .setDescription(`\`\`\`${error.message || error}\`\`\``)
        .addFields(
          { name: 'Context', value: JSON.stringify(context, null, 2) || 'None' }
        )
        .setTimestamp()
        .setFooter({ text: `DropBit Logger • ${moment().format('YYYY-MM-DD HH:mm:ss')}` });

      await logChannel.send({ embeds: [embed] });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }
  }
}

module.exports = Logger;
