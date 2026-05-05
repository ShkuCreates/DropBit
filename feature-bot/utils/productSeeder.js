class ProductSeeder {
  constructor(db) {
    this.db = db;
  }

  async seedSampleProducts() {
    const sampleProducts = [
      {
        title: "AI-Powered Content Generator",
        url: "https://example.com/ai-content-generator",
        description: "Revolutionary AI tool that creates high-quality content in seconds. Perfect for marketers, bloggers, and social media managers who need to scale their content production without sacrificing quality.",
        hook: "Stop spending hours writing content when AI can do it in 30 seconds!",
        angle: "Time-saving automation with human-quality output"
      },
      {
        title: "Smart Analytics Dashboard",
        url: "https://example.com/smart-analytics",
        description: "All-in-one analytics platform that transforms raw data into actionable insights. Features real-time reporting, predictive analytics, and automated insights that help businesses make data-driven decisions faster.",
        hook: "Your competitors are making decisions based on gut feelings while you're using AI-powered insights!",
        angle: "Competitive advantage through data intelligence"
      },
      {
        title: "E-commerce Automation Suite",
        url: "https://example.com/ecommerce-automation",
        description: "Complete automation solution for e-commerce businesses. Handles inventory management, order processing, customer service, and marketing automation - all while you sleep.",
        hook: "What if your e-commerce store could run itself 24/7 on autopilot?",
        angle: "Passive income through business automation"
      },
      {
        title: "Social Media Growth Tool",
        url: "https://example.com/social-growth",
        description: "AI-driven social media management platform that grows your followers organically. Uses machine learning to identify trending content, optimal posting times, and engagement patterns.",
        hook: "The secret to viral social media growth isn't luck - it's algorithms!",
        angle: "Algorithmic advantage in social media marketing"
      },
      {
        title: "Customer Relationship Manager",
        url: "https://example.com/crm-pro",
        description: "Next-generation CRM that combines traditional customer management with AI-powered insights. Predicts customer behavior, automates follow-ups, and identifies upsell opportunities automatically.",
        hook: "Your competitors are losing customers while you're predicting their next move!",
        angle: "Predictive customer relationship management"
      }
    ];

    try {
      for (const product of sampleProducts) {
        // Check if product already exists
        const existing = await this.db.findOne('products', { url: product.url });
        
        if (!existing) {
          await this.db.create('products', {
            ...product,
            postedAt: null,
            isDailyWinner: false,
            createdAt: new Date()
          });
          
          console.log(`✅ Seeded product: ${product.title}`);
        } else {
          console.log(`⏭️ Product already exists: ${product.title}`);
        }
      }

      console.log(`✅ Product seeding complete. ${sampleProducts.length} products processed.`);

    } catch (error) {
      console.error('❌ Error seeding products:', error);
    }
  }

  async clearAllProducts() {
    try {
      await this.db.deleteOne('products', {});
      console.log('🗑️ Cleared all products');
    } catch (error) {
      console.error('❌ Error clearing products:', error);
    }
  }
}

module.exports = ProductSeeder;
