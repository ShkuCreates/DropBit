module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client, commands) {

    if (interaction.isModalSubmit()) {
      if (interaction.customId.startsWith('ads_modal_')) {
        const AdsCommand = require('../commands/ads');
        const adsCmd = new AdsCommand(client);
        await adsCmd.handleModalSubmit(interaction);
        return;
      }
    }

    if (!interaction.isChatInputCommand()) return;

    const command = commands.get(interaction.commandName);
    if (!command) {
      console.error(`No command matching ${interaction.commandName} was found.`);
      return;
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(`Error executing ${interaction.commandName}:`, error);
      const errorEmbed = {
        embeds: [new (require('discord.js').EmbedBuilder)()
          .setColor(0xff0000)
          .setTitle('❌ Command Error')
          .setDescription('There was an error executing this command. Please try again.')
          .setTimestamp()],
        ephemeral: true
      };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorEmbed);
      } else {
        await interaction.reply(errorEmbed);
      }
    }
  }
};
