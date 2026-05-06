module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client, db, config, modules) {
    try {
      // Handle slash commands
      if (interaction.isChatInputCommand()) {
        const command = interaction.commandName;
        
        if (interaction.commandName === 'test') {
            const TestCommand = require('../commands/test');
            const testCmd = new TestCommand(client, db, config);
            await testCmd.execute(interaction, modules);
            return;
          }

        switch (command) {
          case 'trigger':
            const triggersModule = modules.get('triggers');
            if (triggersModule) {
              await triggersModule.handleSlashCommand(interaction);
            }
            break;
            
          case 'sticky':
            const stickyModule = modules.get('sticky');
            if (stickyModule) {
              await stickyModule.handleSlashCommand(interaction);
            }
            break;

          case 'ban':
          case 'kick':
          case 'warn':
            const modCommandsModule = modules.get('modCommands');
            if (modCommandsModule) {
              await modCommandsModule.handleSlashCommand(interaction);
            }
            break;
        }
      }

      // Handle button interactions
      if (interaction.isButton()) {
        const customId = interaction.customId;

        // Verification system
        if (customId.startsWith('verify_')) {
          const verificationModule = modules.get('verification');
          if (verificationModule) {
            await verificationModule.handleVerification(interaction);
          }
        }

        // Modmail system
        if (customId.startsWith('close_modmail_')) {
          const modmailModule = modules.get('modmail');
          if (modmailModule) {
            await modmailModule.handleCloseThread(interaction);
          }
        }
      }

      // Handle modal submissions
      if (interaction.isModalSubmit()) {
        const customId = interaction.customId;

        // Verification system
        if (customId.startsWith('verify_modal_')) {
          const verificationModule = modules.get('verification');
          if (verificationModule) {
            await verificationModule.handleVerificationSubmit(interaction);
          }
        }
      }

      // Handle select menu interactions
      if (interaction.isStringSelectMenu()) {
        const customId = interaction.customId;

        // Onboarding system
        if (customId.startsWith('onboarding_select_')) {
          const onboardingModule = modules.get('onboarding');
          if (onboardingModule) {
            await onboardingModule.handleSelectMenu(interaction);
          }
        }
      }

    } catch (error) {
      console.error('Error in interactionCreate event:', error);
      
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: 'An error occurred while processing this interaction.',
          ephemeral: true
        });
      }
    }
  }
};
