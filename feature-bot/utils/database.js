const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

class FeatureBotDatabase {
  constructor() {
    this.useMongoDB = process.env.MONGO_URI ? true : false;
    this.models = new Map();
    this.jsonPath = path.join(__dirname, '../../src/data/feature-bot');
    
    if (!this.useMongoDB) {
      this.ensureDataDirectory();
    }
  }

  async connect() {
    if (this.useMongoDB) {
      try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('📄 Feature Bot connected to MongoDB');
        this.defineSchemas();
      } catch (error) {
        console.error('❌ MongoDB connection failed, falling back to JSON:', error);
        this.useMongoDB = false;
        this.ensureDataDirectory();
      }
    } else {
      console.log('📄 Feature Bot using JSON file storage');
    }
  }

  ensureDataDirectory() {
    if (!fs.existsSync(this.jsonPath)) {
      fs.mkdirSync(this.jsonPath, { recursive: true });
    }
  }

  defineSchemas() {
    // Competitor Tracking Schema
    const competitorSchema = new mongoose.Schema({
      userId: { type: String, required: true },
      url: { type: String, required: true },
      title: { type: String, required: true },
      lastChecked: { type: Date, default: Date.now },
      lastContent: { type: String },
      isActive: { type: Boolean, default: true },
      createdAt: { type: Date, default: Date.now }
    });
    
    // Product Drops Schema
    const productSchema = new mongoose.Schema({
      title: { type: String, required: true },
      url: { type: String, required: true },
      description: { type: String, required: true },
      hook: { type: String, required: true },
      angle: { type: String, required: true },
      postedAt: { type: Date },
      isDailyWinner: { type: Boolean, default: false },
      createdAt: { type: Date, default: Date.now }
    });

    this.models.set('competitors', mongoose.model('FeatureCompetitors', competitorSchema));
    this.models.set('products', mongoose.model('FeatureProducts', productSchema));
  }

  getModel(collection) {
    return this.models.get(collection);
  }

  // MongoDB Methods
  async create(collection, data) {
    if (this.useMongoDB) {
      try {
        const Model = this.getModel(collection);
        const document = new Model(data);
        return await document.save();
      } catch (error) {
        console.error(`MongoDB create error for ${collection}:`, error);
        return null;
      }
    } else {
      return this.createJson(collection, data);
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
      return this.findJson(collection, query);
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
      return this.findOneJson(collection, query);
    }
  }

  async updateById(collection, id, data) {
    if (this.useMongoDB) {
      try {
        const Model = this.getModel(collection);
        return await Model.findByIdAndUpdate(id, data, { new: true });
      } catch (error) {
        console.error(`MongoDB updateById error for ${collection}:`, error);
        return null;
      }
    } else {
      return this.updateJson(collection, id, data);
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
      return this.deleteJson(collection, query);
    }
  }

  async updateOne(collection, query, data) {
    if (this.useMongoDB) {
      try {
        const Model = this.getModel(collection);
        return await Model.updateOne(query, { $set: data });
      } catch (error) {
        console.error(`MongoDB updateOne error for ${collection}:`, error);
        return null;
      }
    } else {
      const item = await this.findOneJson(collection, query);
      if (item) return this.updateJson(collection, item._id, data);
      return null;
    }
  }

  // JSON Fallback Methods
  readJsonFile(collection) {
    const filePath = path.join(this.jsonPath, `${collection}.json`);
    if (!fs.existsSync(filePath)) {
      return {};
    }
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (error) {
      console.error(`Error reading JSON file ${collection}:`, error);
      return {};
    }
  }

  writeJsonFile(collection, data) {
    const filePath = path.join(this.jsonPath, `${collection}.json`);
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error(`Error writing JSON file ${collection}:`, error);
    }
  }

  generateId() {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
  }

  async createJson(collection, data) {
    const jsonData = this.readJsonFile(collection);
    const id = this.generateId();
    data._id = id;
    jsonData[id] = data;
    this.writeJsonFile(collection, jsonData);
    return data;
  }

  async findJson(collection, query) {
    const jsonData = this.readJsonFile(collection);
    const results = Object.values(jsonData).filter(item => this.matchesQuery(item, query));
    return results;
  }

  async findOneJson(collection, query) {
    const jsonData = this.readJsonFile(collection);
    const results = Object.values(jsonData).find(item => this.matchesQuery(item, query));
    return results || null;
  }

  async updateJson(collection, id, data) {
    const jsonData = this.readJsonFile(collection);
    if (jsonData[id]) {
      jsonData[id] = { ...jsonData[id], ...data };
      this.writeJsonFile(collection, jsonData);
      return jsonData[id];
    }
    return null;
  }

  async deleteJson(collection, query) {
    const jsonData = this.readJsonFile(collection);
    const toDelete = Object.entries(jsonData).filter(([_, item]) => this.matchesQuery(item, query));
    
    for (const [id] of toDelete) {
      delete jsonData[id];
    }
    
    this.writeJsonFile(collection, jsonData);
    return { deletedCount: toDelete.length };
  }

  matchesQuery(item, query) {
    for (const [key, value] of Object.entries(query)) {
      if (item[key] !== value) {
        return false;
      }
    }
    return true;
  }
}

const instance = new FeatureBotDatabase();
module.exports = instance;
