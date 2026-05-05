const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Helpers = require('../utils/helpers');

class ModmailModule {
  constructor(client, db, config) {
    this.client = client;
    this.db = db;
    this.config = config;
    this.activeThreads = new Map();
  }

  async initialize() {
    console.log('📦 Modmail module initialized');
    this.startCleanupInterval();
  }

  async handleDM(message) {
    if (!this.config.get('modmail.enabled')) return;
    
    if (message.author.bot) return;
    if (message.channel.type !== 1) return; // DM channel

    try {
      await this.createOrContinueThread(message);
    } catch (error) {
      console.error('Error handling modmail DM:', error);
    }
  }

  async createOrContinueThread(message) {
    const userId = message.author.id;
    const guildId = process.env.GUILD_ID;
    
    let modmailData = await this.db.findOne('modmail', {
      userId,
      guildId,
      status: 'open'
    });

    if (!modmailData) {
      modmailData = await this.createNewThread(message.author);
    }

    await this.forwardMessage(message, modmailData);
    await this.updateModmailActivity(modmailData);
  }

  async createNewThread(user) {
    try {
      const guild = this.client.guilds.cache.get(process.env.GUILD_ID);
      if (!guild) throw new Error('Guild not found');

      const categoryId = this.config.get('channels.modmail');
      if (!categoryId) throw new Error('Modmail category not configured');

      const category = await guild.channels.fetch(categoryId);
      if (!category) throw new Error('Modmail category not found');

      const channel = await guild.channels.create({
        name: `modmail-${user.username}-${user.discriminator}`,
        type: 0, // GUILD_TEXT
        parent: category.id,
        permissionOverwrites: [
          {
            id: guild.id,
            deny: ['ViewChannel']
          },
          {
            id: user.id,
            deny: ['ViewChannel']
          }
        ],
        topic: `Modmail thread for ${user.tag} (${user.id})`
      });

      const modmailData = await this.db.create('modmail', {
        userId: user.id,
        guildId: guild.id,
        channelId: channel.id,
        status: 'open',
        createdAt: new Date(),
        lastActivity: new Date(),
        messages: []
      });

      this.activeThreads.set(user.id, modmailData);

      const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle('📧 New Modmail Thread')
        .setDescription(`A new modmail thread has been created for **${user.tag}**`)
        .addFields(
          {
            name: 'User ID',
            value: user.id,
            inline: true
          },
          {
            name: 'Account Created',
            value: user.createdAt.toDateString(),
            inline: true
          }
        )
        .setThumbnail(user.displayAvatarURL({ dynamic: true }))
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`close_modmail_${user.id}`)
          .setLabel('Close Thread')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🔒')
      );

      await channel.send({ embeds: [embed], components: [row] });

      const autoResponse = this.config.get('modmail.autoResponse');
      if (autoResponse) {
        await Helpers.sendDM(user, autoResponse);
      }

      return modmailData;

    } catch (error) {
      console.error('Error creating new modmail thread:', error);
      throw error;
    }
  }

  async forwardMessage(message, modmailData) {
    try {
      const channel = await this.client.channels.fetch(modmailData.channelId);
      if (!channel) return;

      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('📨 New Message')
        .setDescription(message.content)
        .setAuthor({
          name: message.author.tag,
          iconURL: message.author.displayAvatarURL({ dynamic: true })
        })
        .setTimestamp();

      if (message.attachments.size > 0) {
        const attachments = message.attachments.map(att => `[${att.name}](${att.url})`).join('\n');
        embed.addFields({
          name: 'Attachments',
          value: attachments,
          inline: false
        });
      }

      await channel.send({ embeds: [embed] });

      await this.db.updateById('modmail', modmailData._id, {
        $push: {
          messages: {
            author: message.author.id,
            content: message.content,
            timestamp: new Date(),
            isStaff: false
          }
        }
      });

    } catch (error) {
      console.error('Error forwarding message:', error);
    }
  }

  async handleStaffMessage(message) {
    if (!this.config.get('modmail.enabled')) return;
    
    if (message.author.bot) return;
    if (!message.guild) return;

    const modmailData = Array.from(this.activeThreads.values())
      .find(thread => thread.channelId === message.channel.id);

    if (!modmailData) return;

    try {
      await this.forwardToUser(message, modmailData);
      await this.updateModmailActivity(modmailData);

      const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle('✅ Message Sent')
        .setDescription(`Your message has been sent to **${message.client.users.cache.get(modmailData.userId)?.tag || 'Unknown'}**`)
        .setTimestamp();

      await message.reply({ embeds: [embed], ephemeral: true });

    } catch (error) {
      console.error('Error handling staff message:', error);
    }
  }

  async forwardToUser(message, modmailData) {
    try {
      const user = await this.client.users.fetch(modmailData.userId);
      if (!user) return;

      const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle('📧 Staff Response')
        .setDescription(message.content)
        .setAuthor({
          name: message.author.tag,
          iconURL: message.author.displayAvatarURL({ dynamic: true })
        })
        .setTimestamp()
        .setFooter({
          text: 'Reply to this message to continue the conversation'
        });

      await Helpers.sendDM(user, { embeds: [embed] });

      await this.db.updateById('modmail', modmailData._id, {
        $push: {
          messages: {
            author: message.author.id,
            content: message.content,
            timestamp: new Date(),
            isStaff: true
          }
        }
      });

    } catch (error) {
      console.error('Error forwarding to user:', error);
    }
  }

  async handleCloseThread(interaction) {
    const customId = interaction.customId;
    if (!customId.startsWith('close_modmail_')) return;

    const userId = customId.replace('close_modmail_', '');
    
    if (!Helpers.hasAdminRole(interaction.member, this.config)) {
      await interaction.reply({
        embeds: [Helpers.createErrorEmbed('Access Denied', 'You need admin permissions to close modmail threads.')],
        ephemeral: true
      });
      return;
    }

    try {
      const modmailData = await this.db.findOne('modmail', {
        userId,
        guildId: interaction.guild.id,
        status: 'open'
      });

      if (!modmailData) {
        await interaction.reply({
          embeds: [Helpers.createErrorEmbed('Thread Not Found', 'This modmail thread could not be found.')],
          ephemeral: true
        });
        return;
      }

      await this.closeThread(modmailData, interaction.member, 'Closed by staff');

      await interaction.reply({
        embeds: [Helpers.createSuccessEmbed('Thread Closed', 'The modmail thread has been closed.')],
        ephemeral: true
      });

    } catch (error) {
      console.error('Error closing modmail thread:', error);
      await interaction.reply({
        embeds: [Helpers.createErrorEmbed('Error', 'Failed to close the thread. Please try again.')],
        ephemeral: true
      });
    }
  }

  async closeThread(modmailData, closedBy, reason) {
    try {
      await this.db.updateById('modmail', modmailData._id, {
        status: 'closed',
        closedAt: new Date(),
        closedBy: closedBy.id,
        closeReason: reason
      });

      this.activeThreads.delete(modmailData.userId);

      const channel = await this.client.channels.fetch(modmailData.channelId);
      if (channel) {
        const embed = new EmbedBuilder()
          .setColor(0xff6600)
          .setTitle('🔒 Thread Closed')
          .setDescription(`This modmail thread has been closed by **${closedBy.tag}**`)
          .addFields(
            {
              name: 'Reason',
              value: reason,
              inline: false
            },
            {
              name: 'Closed At',
              value: new Date().toLocaleString(),
              inline: true
            }
          )
          .setTimestamp();

        await channel.send({ embeds: [embed] });

        setTimeout(async () => {
          try {
            await channel.delete('Modmail thread cleanup');
          } catch (error) {
            console.error('Error deleting modmail channel:', error);
          }
        }, 5000);
      }

      const user = await this.client.users.fetch(modmailData.userId).catch(() => null);
      if (user) {
        const embed = new EmbedBuilder()
          .setColor(0xff6600)
          .setTitle('🔒 Conversation Closed')
          .setDescription('Your modmail conversation has been closed by staff.')
          .addFields(
            {
              name: 'Reason',
              value: reason,
              inline: false
            }
          )
          .setTimestamp()
          .setFooter({
            text: 'You can start a new conversation by DMing the bot again.'
          });

        await Helpers.sendDM(user, { embeds: [embed] });
      }

      await this.createTranscript(modmailData);

    } catch (error) {
      console.error('Error closing modmail thread:', error);
    }
  }

  async createTranscript(modmailData) {
    try {
      const transcriptChannelId = this.config.get('modmail.transcriptChannel');
      if (!transcriptChannelId) return;

      const transcriptChannel = await this.client.channels.fetch(transcriptChannelId);
      if (!transcriptChannel) return;

      const user = await this.client.users.fetch(modmailData.userId).catch(() => null);
      const messages = modmailData.messages || [];

      let transcript = `# Modmail Transcript\n\n`;
      transcript += `**User:** ${user?.tag || 'Unknown'} (${modmailData.userId})\n`;
      transcript += `**Created:** ${modmailData.createdAt.toLocaleString()}\n`;
      transcript += `**Closed:** ${new Date().toLocaleString()}\n`;
      transcript += `**Total Messages:** ${messages.length}\n\n`;
      transcript += `---\n\n`;

      for (const msg of messages) {
        const author = await this.client.users.fetch(msg.author).catch(() => null);
        const role = msg.isStaff ? 'Staff' : 'User';
        transcript += `**[${role}] ${author?.tag || 'Unknown'}** (${new Date(msg.timestamp).toLocaleString()}):\n`;
        transcript += `${msg.content}\n\n`;
      }

      if (transcript.length > 2000) {
        const chunks = transcript.match(/.{1,1900}/g) || [];
        for (const chunk of chunks) {
          await transcriptChannel.send(`\`\`\`\n${chunk}\n\`\`\``);
        }
      } else {
        await transcriptChannel.send(`\`\`\`\n${transcript}\n\`\`\``);
      }

    } catch (error) {
      console.error('Error creating transcript:', error);
    }
  }

  async updateModmailActivity(modmailData) {
    try {
      await this.db.updateById('modmail', modmailData._id, {
        lastActivity: new Date()
      });
    } catch (error) {
      console.error('Error updating modmail activity:', error);
    }
  }

  startCleanupInterval() {
    setInterval(async () => {
      try {
        const now = Date.now();
        const inactiveTime = this.config.get('modmail.closeAfterInactivity') || 3600000; // 1 hour default

        const inactiveThreads = await this.db.find('modmail', {
          status: 'open',
          lastActivity: { $lt: new Date(now - inactiveTime) }
        });

        for (const thread of inactiveThreads) {
          const guild = this.client.guilds.cache.get(thread.guildId);
          if (guild) {
            const staffMember = guild.members.cache.get(this.client.user.id);
            await this.closeThread(thread, staffMember, 'Automatically closed due to inactivity');
          }
        }
      } catch (error) {
        console.error('Error in modmail cleanup:', error);
      }
    }, 300000); // Check every 5 minutes
  }

  async loadActiveThreads() {
    try {
      const activeThreads = await this.db.find('modmail', {
        guildId: process.env.GUILD_ID,
        status: 'open'
      });

      this.activeThreads.clear();
      for (const thread of activeThreads) {
        this.activeThreads.set(thread.userId, thread);
      }

      console.log(`Loaded ${this.activeThreads.size} active modmail threads`);
    } catch (error) {
      console.error('Error loading active threads:', error);
    }
  }

  getActiveThreadCount() {
    return this.activeThreads.size;
  }

  getUserThread(userId) {
    return this.activeThreads.get(userId);
  }
}

module.exports = ModmailModule;
