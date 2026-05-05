const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

class Database {
  constructor() {
    this.isConnected = false;
    this.useMongoDB = !!process.env.MONGODB_URI;
    this.jsonPath = path.join(__dirname, '../data');
    this.ensureDataDirectory();
  }

  ensureDataDirectory() {
    if (!fs.existsSync(this.jsonPath)) {
      fs.mkdirSync(this.jsonPath, { recursive: true });
    }
  }

  async connect() {
    if (this.useMongoDB) {
      try {
        await mongoose.connect(process.env.MONGODB_URI, {
          useNewUrlParser: true,
          useUnifiedTopology: true,
        });
        this.isConnected = true;
        console.log('✅ Connected to MongoDB');
        return true;
      } catch (error) {
        console.error('❌ MongoDB connection failed, falling back to JSON:', error);
        this.useMongoDB = false;
        this.isConnected = true;
        return true;
      }
    } else {
      console.log('📄 Using JSON file storage');
      this.isConnected = true;
      return true;
    }
  }

  async disconnect() {
    if (this.useMongoDB && mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      this.isConnected = false;
      console.log('✅ Disconnected from MongoDB');
    }
  }

  getJsonFilePath(collection) {
    return path.join(this.jsonPath, `${collection}.json`);
  }

  readJsonFile(collection) {
    try {
      const filePath = this.getJsonFilePath(collection);
      if (!fs.existsSync(filePath)) {
        return {};
      }
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error(`Error reading JSON file ${collection}:`, error);
      return {};
    }
  }

  writeJsonFile(collection, data) {
    try {
      const filePath = this.getJsonFilePath(collection);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      return true;
    } catch (error) {
      console.error(`Error writing JSON file ${collection}:`, error);
      return false;
    }
  }

  async find(collection, query = {}) {
    if (this.useMongoDB) {
      try {
        const Model = this.getModel(collection);
        return await Model.find(query);
      } catch (error) {
        console.error(`MongoDB find error for ${collection}:`, error);
        return [];
      }
    } else {
      const data = this.readJsonFile(collection);
      return Object.values(data).filter(item => this.matchesQuery(item, query));
    }
  }

  async findOne(collection, query) {
    if (this.useMongoDB) {
      try {
        const Model = this.getModel(collection);
        return await Model.findOne(query);
      } catch (error) {
        console.error(`MongoDB findOne error for ${collection}:`, error);
        return null;
      }
    } else {
      const data = this.readJsonFile(collection);
      const items = Object.values(data).filter(item => this.matchesQuery(item, query));
      return items.length > 0 ? items[0] : null;
    }
  }

  async findById(collection, id) {
    if (this.useMongoDB) {
      try {
        const Model = this.getModel(collection);
        return await Model.findById(id);
      } catch (error) {
        console.error(`MongoDB findById error for ${collection}:`, error);
        return null;
      }
    } else {
      const data = this.readJsonFile(collection);
      return data[id] || null;
    }
  }

  async create(collection, document) {
    if (this.useMongoDB) {
      try {
        const Model = this.getModel(collection);
        const result = await Model.create(document);
        return result;
      } catch (error) {
        console.error(`MongoDB create error for ${collection}:`, error);
        return null;
      }
    } else {
      const data = this.readJsonFile(collection);
      const id = this.generateId();
      const newDoc = { _id: id, ...document };
      data[id] = newDoc;
      this.writeJsonFile(collection, data);
      return newDoc;
    }
  }

  async updateOne(collection, query, update, options = {}) {
    if (this.useMongoDB) {
      try {
        const Model = this.getModel(collection);
        return await Model.updateOne(query, update, options);
      } catch (error) {
        console.error(`MongoDB updateOne error for ${collection}:`, error);
        return { matchedCount: 0, modifiedCount: 0 };
      }
    } else {
      const data = this.readJsonFile(collection);
      const items = Object.entries(data).filter(([_, item]) => this.matchesQuery(item, query));
      
      let modifiedCount = 0;
      for (const [id, item] of items) {
        Object.assign(item, update);
        modifiedCount++;
      }
      
      this.writeJsonFile(collection, data);
      return { matchedCount: items.length, modifiedCount };
    }
  }

  async updateById(collection, id, update) {
    if (this.useMongoDB) {
      try {
        const Model = this.getModel(collection);
        return await Model.findByIdAndUpdate(id, update, { new: true });
      } catch (error) {
        console.error(`MongoDB updateById error for ${collection}:`, error);
        return null;
      }
    } else {
      const data = this.readJsonFile(collection);
      if (data[id]) {
        Object.assign(data[id], update);
        this.writeJsonFile(collection, data);
        return data[id];
      }
      return null;
    }
  }

  async deleteOne(collection, query) {
    if (this.useMongoDB) {
      try {
        const Model = this.getModel(collection);
        return await Model.deleteOne(query);
      } catch (error) {
        console.error(`MongoDB deleteOne error for ${collection}:`, error);
        return { deletedCount: 0 };
      }
    } else {
      const data = this.readJsonFile(collection);
      const toDelete = Object.entries(data).filter(([_, item]) => this.matchesQuery(item, query));
      
      for (const [id] of toDelete) {
        delete data[id];
      }
      
      this.writeJsonFile(collection, data);
      return { deletedCount: toDelete.length };
    }
  }

  async deleteById(collection, id) {
    if (this.useMongoDB) {
      try {
        const Model = this.getModel(collection);
        return await Model.findByIdAndDelete(id);
      } catch (error) {
        console.error(`MongoDB deleteById error for ${collection}:`, error);
        return null;
      }
    } else {
      const data = this.readJsonFile(collection);
      if (data[id]) {
        delete data[id];
        this.writeJsonFile(collection, data);
        return true;
      }
      return false;
    }
  }

  getModel(collection) {
    if (!this.schemas) {
      this.schemas = {};
    }

    if (!this.schemas[collection]) {
      let schema;
      
      switch (collection) {
        case 'levels':
          schema = new mongoose.Schema({
            userId: { type: String, required: true, unique: true },
            guildId: { type: String, required: true },
            xp: { type: Number, default: 0 },
            level: { type: Number, default: 1 },
            totalMessages: { type: Number, default: 0 },
            lastMessage: { type: Date, default: Date.now }
          });
          break;
          
        case 'invites':
          schema = new mongoose.Schema({
            inviterId: { type: String, required: true },
            guildId: { type: String, required: true },
            inviteCount: { type: Number, default: 0 },
            validInvites: { type: Number, default: 0 },
            fakeInvites: { type: Number, default: 0 },
            leaves: { type: Number, default: 0 },
            invitedUsers: [{ type: String }]
          });
          break;
          
        case 'modmail':
          schema = new mongoose.Schema({
            userId: { type: String, required: true },
            guildId: { type: String, required: true },
            channelId: { type: String, required: true },
            status: { type: String, default: 'open' },
            createdAt: { type: Date, default: Date.now },
            lastActivity: { type: Date, default: Date.now },
            messages: [{
              author: String,
              content: String,
              timestamp: { type: Date, default: Date.now },
              isStaff: Boolean
            }]
          });
          break;
          
        case 'triggers':
          schema = new mongoose.Schema({
            keyword: { type: String, required: true },
            response: { type: String, required: true },
            guildId: { type: String, required: true },
            createdBy: { type: String, required: true },
            createdAt: { type: Date, default: Date.now }
          });
          break;
          
        case 'sticky':
          schema = new mongoose.Schema({
            channelId: { type: String, required: true },
            message: { type: String, required: true },
            guildId: { type: String, required: true },
            createdBy: { type: String, required: true },
            createdAt: { type: Date, default: Date.now },
            lastSent: { type: Date, default: Date.now },
            messageCount: { type: Number, default: 0 }
          });
          break;
          
        case 'warnings':
          schema = new mongoose.Schema({
            userId: { type: String, required: true },
            guildId: { type: String, required: true },
            warnings: [{
              reason: { type: String, required: true },
              executorId: { type: String, required: true },
              executorTag: { type: String, required: true },
              timestamp: { type: Date, default: Date.now },
              warnNumber: { type: Number, required: true }
            }],
            totalWarns: { type: Number, default: 0 }
          });
          break;
          
        case 'verification':
          schema = new mongoose.Schema({
            userId: { type: String, required: true, unique: true },
            guildId: { type: String, required: true },
            captcha: { type: String, required: true },
            attempts: { type: Number, default: 0 },
            createdAt: { type: Date, default: Date.now },
            expiresAt: { type: Date, required: true }
          });
          break;
          
        default:
          schema = new mongoose.Schema({}, { strict: false });
      }
      
      this.schemas[collection] = mongoose.model(collection, schema);
    }
    
    return this.schemas[collection];
  }

  matchesQuery(item, query) {
    for (const [key, value] of Object.entries(query)) {
      if (typeof value === 'object' && value !== null) {
        if (value.$regex) {
          const regex = new RegExp(value.$regex, value.$options || '');
          if (!regex.test(item[key])) return false;
        }
      } else {
        if (item[key] !== value) return false;
      }
    }
    return true;
  }

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}

module.exports = Database;
