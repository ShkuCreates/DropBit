# Dropbit Engine - Feature Bot

The second bot in the Dropbit system that handles product tracking, ad generation, and competitor monitoring.

## 🚀 Features

### 1. Winning Product Daily
- **Auto-post** daily winning products at 12 AM IST
- **Aesthetic embeds** with product details and hooks
- **Database storage** for product management
- **Automatic rotation** of products

### 2. Ads Script + Hook Generator
- **Command**: `/ads <product_url>`
- **Generates**: 5 hooks, 2 ad scripts, angles
- **Template-based** system with smart content
- **Instant results** for any product URL

### 3. Competitor Tracking
- **Command**: `/track <url>` - Start tracking
- **Command**: `/untrack <url>` - Stop tracking
- **Auto-check** every 30 minutes
- **DM notifications** when changes detected

## 📁 Structure

```
feature-bot/
├── index.js              # Main entry point
├── commands/             # Slash commands
│   ├── ads.js           # Ad generator command
│   ├── track.js         # Competitor tracking
│   └── untrack.js       # Stop tracking
├── events/              # Discord events
│   └── interactionCreate.js
├── modules/             # Background jobs
│   ├── productScheduler.js  # Daily product posts
│   └── competitorTracker.js # Competitor monitoring
└── utils/               # Utilities
    ├── database.js      # Database layer
    ├── commandRegistry.js # Command registration
    └── productSeeder.js # Sample data
```

## ⚙️ Environment Variables

Add to your `.env` file:

```env
# Feature Bot Configuration
FEATURE_BOT_TOKEN=your_feature_bot_token_here
FEATURE_BOT_CHANNEL_ID=your_feature_bot_channel_id_here
```

## 🗄️ Database Collections

### Products
```javascript
{
  title: String,
  url: String,
  description: String,
  hook: String,
  angle: String,
  postedAt: Date,
  isDailyWinner: Boolean,
  createdAt: Date
}
```

### Competitors
```javascript
{
  userId: String,
  url: String,
  title: String,
  lastChecked: Date,
  lastContent: String,
  isActive: Boolean,
  createdAt: Date
}
```

## 🎯 Commands

### `/ads <product_url>`
Generate ad scripts and hooks for any product URL.

**Output:**
- 5 engaging hooks
- 2 complete ad scripts
- Marketing angles
- Professional formatting

### `/track <url>`
Start monitoring a competitor URL for changes.

**Features:**
- 30-minute check intervals
- DM notifications on changes
- Content comparison
- Automatic status updates

### `/untrack <url>`
Stop tracking a competitor URL.

**Features:**
- Immediate stop
- Tracking history preserved
- Clean removal

## ⏰ Background Jobs

### Product Scheduler
- **Runs**: Daily at 12 AM IST (18:30 UTC)
- **Posts**: Random winning product
- **Format**: Aesthetic black embeds
- **Rotation**: Prevents repeats

### Competitor Tracker
- **Runs**: Every 30 minutes
- **Checks**: All active trackers
- **Notifies**: DM on content changes
- **Updates**: Database with latest content

## 🎨 Embed Style

All feature bot messages use:
- **Black embeds** (0x000000)
- **◻️ symbols** for field names
- **Professional formatting**
- **Dropbit banner** where appropriate
- **Timestamps and footers**

## 🚀 Getting Started

1. **Install dependencies**:
   ```bash
   npm install node-cron
   ```

2. **Set up environment**:
   ```bash
   # Add to .env
   FEATURE_BOT_TOKEN=your_bot_token
   FEATURE_BOT_CHANNEL_ID=your_channel_id
   ```

3. **Run the system**:
   ```bash
   node main.js
   ```

4. **Seed sample products** (optional):
   ```javascript
   const ProductSeeder = require('./feature-bot/utils/productSeeder');
   const seeder = new ProductSeeder(db);
   await seeder.seedSampleProducts();
   ```

## 📊 Usage Examples

### Generate Ad Content
```
/ads https://example.com/product
```

### Track Competitor
```
/track https://competitor-website.com
```

### Stop Tracking
```
/untrack https://competitor-website.com
```

## 🔧 Configuration

### Product Posting Time
Default: 12 AM IST (18:30 UTC)
Can be modified in `productScheduler.js`

### Check Frequency
Default: Every 30 minutes
Can be modified in `competitorTracker.js`

### Channel Settings
Set `FEATURE_BOT_CHANNEL_ID` in environment variables

## 🛡️ Safety Features

- **No interference** with utility bot
- **Separate logging** system
- **Error handling** for all operations
- **Graceful shutdown** support
- **Permission checks** where needed

## 📈 Performance

- **Efficient database** operations
- **Background job** scheduling
- **Memory-friendly** tracking
- **Scalable architecture**
- **Fast response** times

---

**Dropbit Engine - Your Competitive Advantage** 🚀
