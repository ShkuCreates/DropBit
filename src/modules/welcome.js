const { EmbedBuilder } = require('discord.js');
const Helpers = require('../utils/helpers');

class WelcomeModule {
  constructor(client, db, config) {
    this.client = client;
    this.db = db;
    this.config = config;
  }

  async initialize() {
    console.log('📦 Welcome module initialized');
  }

  async handleMemberJoin(member, inviter = null) {
    if (!this.config.get('welcome.enabled')) return;

    try {
      await this.sendWelcomeMessage(member, inviter);
      await this.sendWelcomeDM(member);
      
      await this.logWelcome(member, inviter);
    } catch (error) {
      console.error('Error in welcome system:', error);
    }
  }

  async sendWelcomeMessage(member, inviter) {
    try {
      const welcomeChannelId = this.config.get('channels.welcome');
      const channel = await this.client.channels.fetch(welcomeChannelId);
      if (!channel) return;

      const memberPosition = member.guild.memberCount;
      const positionSuffix = this.getPositionSuffix(memberPosition);

      const embed = new EmbedBuilder()
        .setColor(0x000000) // Black embed
        .setTitle('👋 Welcome to the Server!')
        .setDescription(`Welcome ${member.user}! We're glad to have you here.`)
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .addFields(
          {
            name: '◻️ USER',
            value: member.user.tag,
            inline: false
          },
          {
            name: '◻️ CREATED AT',
            value: member.user.createdAt.toDateString(),
            inline: false
          },
          {
            name: '◻️ MEMBERS POSITION',
            value: `${memberPosition}${positionSuffix} Member`,
            inline: false
          }
        )
        .setImage('https://media.discordapp.net/attachments/1500527370111680522/1500528696375640114/Dropbit_Banner.png?ex=69f8c3bf&is=69f7723f&hm=ba19b88309ebf73030b2e9f58acd0c3bd8f4f3e1668bab4c9be51f39b66c48bc&=&format=webp&quality=lossless&width=1143&height=457')
        .setTimestamp();

      if (inviter) {
        embed.addFields({
          name: '◻️ INVITED BY',
          value: inviter.tag,
          inline: false
        });
      }

      await channel.send({ embeds: [embed] });
    } catch (error) {
      console.error('Error sending welcome message:', error);
    }
  }

  async sendWelcomeDM(member) {
    if (!this.config.get('welcome.sendDM')) return;

    const dmMessage = this.config.get('welcome.dmMessage');
    if (!dmMessage) return;

    try {
      const formattedMessage = dmMessage
        .replace('{user}', member.toString())
        .replace('{serverName}', member.guild.name);

      await Helpers.sendDM(member.user, formattedMessage);
    } catch (error) {
      console.error('Error sending welcome DM:', error);
    }
  }

  getPositionSuffix(position) {
    const j = position % 10;
    const k = position % 100;
    if (j == 1 && k != 11) return 'st';
    if (j == 2 && k != 12) return 'nd';
    if (j == 3 && k != 13) return 'rd';
    return 'th';
  }

  async logWelcome(member, inviter) {
    const logger = require('../utils/logger');
    const Logger = new logger(this.client, this.db, this.config);
    
    await Logger.log('memberJoin', {
      user: member.user,
      member,
      inviter,
      joinedAt: member.joinedAt
    }, member.guild);
  }
}

module.exports = WelcomeModule;
