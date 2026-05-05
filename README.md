# DropBit Discord Bot

A production-ready, modular Discord utility bot built with Node.js and discord.js v14. This bot provides comprehensive server management features including verification, leveling, moderation, and more.

## 🚀 Features

### Core Systems
- **Welcome System** - Automated welcome messages and DMs
- **Verification System** - CAPTCHA-based verification with role assignment
- **Leveling System** - XP-based leveling with automatic role rewards
- **Moderation System** - Anti-spam, word filter, caps filter, duplicate detection
- **Auto Triggers** - Keyword-based automated responses (admin controlled)
- **FAQ System** - Predefined responses to common questions
- **Sticky Messages** - Auto-reposting important messages (admin controlled)

### Advanced Features
- **Invite Tracking** - Track who invited whom with fake invite detection
- **Modmail System** - Private DM-to-staff communication
- **Anti-Raid Protection** - Automatic protection against mass joins
- **Smart Onboarding** - Interactive role assignment for new members
- **Comprehensive Logging** - Detailed logs of all server activities

## 📋 Requirements

- Node.js 18.0.0 or higher
- Discord bot token and application
- MongoDB (optional - falls back to JSON files)

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd DropBit
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and fill in your values:
   ```env
   BOT_TOKEN=your_bot_token_here
   CLIENT_ID=your_client_id_here
   GUILD_ID=your_guild_id_here
   MONGODB_URI=mongodb://localhost:27017/dropbit (optional)
   NODE_ENV=production
   ```

4. **Configure the bot**
   - Edit `src/utils/config.json` with your server settings
   - Set up channel IDs, role IDs, and feature toggles
   - Customize messages and thresholds

5. **Start the bot**
   ```bash
   npm start
   ```
   For development with auto-restart:
   ```bash
   npm run dev
   ```

## ⚙️ Configuration

### Environment Variables (.env)
- `BOT_TOKEN` - Your Discord bot token (required)
- `CLIENT_ID` - Your Discord application ID (required)
- `GUILD_ID` - Your server ID (required)
- `MONGODB_URI` - MongoDB connection string (optional)
- `NODE_ENV` - Environment (development/production)

### Configuration File (src/utils/config.json)
The main configuration file contains all bot settings:

- **Bot Settings** - Status, activity, admin roles
- **Channel IDs** - Welcome, logs, modmail, verification, etc.
- **Role IDs** - Verified, unverified, level rewards, onboarding roles
- **Feature Toggles** - Enable/disable specific modules
- **Thresholds & Limits** - Spam detection, XP rates, etc.

## 📁 Project Structure

```
src/
├── events/          # Discord event handlers
│   ├── guildMemberAdd.js
│   ├── guildMemberRemove.js
│   ├── messageCreate.js
│   ├── messageDelete.js
│   ├── messageUpdate.js
│   ├── guildBanAdd.js
│   ├── interactionCreate.js
│   └── directMessage.js
├── modules/         # Bot feature modules
│   ├── welcome.js
│   ├── verification.js
│   ├── leveling.js
│   ├── moderation.js
│   ├── triggers.js
│   ├── faq.js
│   ├── sticky.js
│   ├── invites.js
│   ├── modmail.js
│   ├── antiraid.js
│   └── onboarding.js
├── utils/           # Utility functions
│   ├── config.json
│   ├── configLoader.js
│   ├── database.js
│   ├── logger.js
│   └── helpers.js
└── index.js         # Main bot entry point
```

## 🎮 Admin Commands

### Trigger Management
- `/trigger add <keyword> <response>` - Add new trigger
- `/trigger remove <keyword>` - Remove trigger
- `/trigger list` - List all triggers

### Sticky Messages
- `/sticky set <message>` - Set sticky message in channel
- `/sticky remove` - Remove sticky message from channel
- `/sticky show` - Show current sticky message

## 🔧 Permissions

The bot requires the following permissions:
- **Administrator** (recommended for full functionality)
- **Manage Channels** - For modmail and sticky messages
- **Manage Roles** - For verification and level rewards
- **Manage Messages** - For moderation and sticky messages
- **View Audit Log** - For logging
- **Send Messages** - Basic functionality
- **Embed Links** - Rich message formatting
- **Attach Files** - For logging transcripts

## 📊 Database

The bot supports two database options:

### MongoDB (Recommended)
- Better performance and scalability
- Supports concurrent operations
- Requires MongoDB server

### JSON Fallback
- No external dependencies
- File-based storage
- Suitable for small servers

## 🛡️ Security Features

- **CAPTCHA Verification** - Prevents bot accounts
- **Anti-Raid Protection** - Detects mass joins
- **Spam Detection** - Multiple spam filters
- **Word Filtering** - Custom blacklist
- **Rate Limiting** - Built-in cooldowns
- **Permission Checks** - Admin-only commands

## 📝 Logging

The bot logs various events to a configured log channel:
- Member joins/leaves
- Role changes
- Message deletions/edits
- Moderation actions
- Verification attempts
- Ban/kick events

## 🔄 Maintenance

### Automatic Cleanup
- Expired verification attempts
- Inactive modmail threads
- Old spam tracking data
- Stale cooldown entries

### Manual Commands
- Reset user XP/levels
- Clear invite data
- Reset raid protection
- Reload configuration

## 🚀 Deployment

### Using PM2
```bash
npm install -g pm2
pm2 start src/index.js --name dropbit-bot
pm2 save
pm2 startup
```

### Using Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
CMD ["npm", "start"]
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For issues and support:
1. Check the configuration
2. Review the logs
3. Ensure proper permissions
4. Verify environment variables

## 📈 Performance

The bot is optimized for:
- **Memory Usage** - Efficient data structures
- **CPU Performance** - Async operations
- **Network Efficiency** - Batch operations
- **Scalability** - Modular architecture

## 🔍 Monitoring

Monitor bot health with:
- Console logs
- Discord log channel
- Database metrics
- Memory usage tracking

---

**Built with ❤️ using discord.js v14**
