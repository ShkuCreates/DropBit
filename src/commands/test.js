const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

class TestCommand {
  constructor(client, db, config) {
    this.client = client;
    this.db = db;
    this.config = config;
  }

  async execute(interaction, modules) {
    const adminUserIds = ['1219141082588250142'];
    if (!adminUserIds.includes(interaction.user.id) && 
        !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Access Denied')
          .setDescription('Only admins can use this command.')
          .setTimestamp()],
        ephemeral: true
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });
    const channel = interaction.channel;

    // Test Welcome Message
    const welcomeEmbed = new EmbedBuilder()
      .setColor(0x000000)
      .setTitle('👋 Welcome to Server!')
      .setDescription(`Welcome ${interaction.user}! We're glad to have you here.`)
      .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: '◻️ USER', value: interaction.user.tag, inline: false },
        { name: '◻️ TEST', value: 'This is a welcome message test', inline: false }
      )
      .setTimestamp()
      .setFooter({ text: 'Dropbit Core • Welcome Test' });

    await channel.send({ embeds: [welcomeEmbed] });

    // Test Invite Tracking Message
    const inviteEmbed = new EmbedBuilder()
      .setColor(0x000000)
      .setTitle('📨 Invite Tracking Test')
      .setDescription(`${interaction.user} joined using an invite`)
      .addFields(
        { name: '◻️ INVITED BY', value: interaction.user.tag, inline: false },
        { name: '◻️ TOTAL INVITES', value: '5', inline: false },
        { name: '◻️ STATUS', value: 'Invite tracking is working ✅', inline: false }
      )
      .setTimestamp()
      .setFooter({ text: 'Dropbit Core • Invite Tracking Test' });

    await channel.send({ embeds: [inviteEmbed] });

    // Test Level Up Message
    const levelEmbed = new EmbedBuilder()
      .setColor(0x000000)
      .setTitle('🎉 Level Up!')
      .addFields(
        { name: '◻️ USER LEVELED UP TO', value: 'Level 5', inline: false },
        { name: 'XP Progress', value: '[████████░░] 800/1000', inline: true },
        { name: 'Total XP', value: '2,500', inline: true }
      )
      .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
      .setTimestamp()
      .setFooter({ text: 'Dropbit Core • Level Up Test' });

    await channel.send({ embeds: [levelEmbed] });

    await interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('✅ Test Messages Sent')
        .setDescription('Welcome, Invite Tracking, and Level Up test messages have been sent.')
        .setTimestamp()]
    });
  }

  getSlashCommand() {
    return new SlashCommandBuilder()
      .setName('test')
      .setDescription('Send test messages for welcome, invite tracking, and level up (Admin only)')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .toJSON();
  }
}

module.exports = TestCommand;
