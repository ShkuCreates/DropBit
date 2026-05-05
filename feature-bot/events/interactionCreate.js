module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client, commands) {
    if (!interaction.isChatInputCommand()) return;

    const commandName = interaction.commandName;
    const command = commands.get(commandName);

    if (!command) {
      console.error(`No command matching ${commandName} was found.`);
      return;
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(`Error executing ${commandName}:`, error);
      
      const errorMessage = {
        embeds: [{
          color: 0xff0000,
          title: '❌ Command Error',
          description: 'There was an error executing this command.',
          timestamp: new Date().toISOString()
        }],
        ephemeral: true
      };

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMessage);
      } else {
        await interaction.reply(errorMessage);
      }
    }
  }
};
