// init-db.js — Initialize database for Render deployment
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting database initialization...');

// Database path for Render
const dbPath = process.env.NODE_ENV === 'production' ? '/opt/render/project/src/miyu.db' : './miyu.db';
console.log('📁 Database path:', dbPath);
console.log('🌍 Environment:', process.env.NODE_ENV || 'development');

// Create database directory if it doesn't exist
const dbDir = path.dirname(dbPath);
console.log('📂 Database directory:', dbDir);

if (!fs.existsSync(dbDir)) {
  console.log('📁 Creating database directory...');
  fs.mkdirSync(dbDir, { recursive: true });
  console.log('✅ Database directory created');
} else {
  console.log('✅ Database directory exists');
}

// Initialize database
console.log('🗄️ Initializing database connection...');
const db = new Database(dbPath);
console.log('✅ Database connected successfully');

// Test if customers table exists
try {
  const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='customers'").get();
  console.log('🔍 Customers table exists:', !!tableExists);
} catch (error) {
  console.log('❌ Error checking table existence:', error.message);
}

// Create basic tables first
console.log('🏗️ Creating basic tables...');
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      firstName TEXT NOT NULL,
      lastName TEXT NOT NULL,
      email TEXT UNIQUE,
      phone TEXT,
      birthday TEXT,
      tier TEXT DEFAULT 'New',
      visitCount INTEGER DEFAULT 0,
      totalSpent REAL DEFAULT 0.0,
      lastVisit TEXT,
      nextAppointment TEXT,
      notes TEXT,
      preferredServices TEXT,
      emailConsent BOOLEAN DEFAULT 1,
      smsConsent BOOLEAN DEFAULT 1,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS nailers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      firstName TEXT NOT NULL,
      lastName TEXT,
      email TEXT UNIQUE,
      phone TEXT,
      specialty TEXT,
      bio TEXT,
      isActive BOOLEAN DEFAULT 1,
      averageRating REAL DEFAULT 0.0,
      averageStaffRating REAL DEFAULT 0.0,
      totalReviews INTEGER DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      duration INTEGER NOT NULL,
      price REAL NOT NULL,
      category TEXT DEFAULT 'standard',
      isActive BOOLEAN DEFAULT 1,
      isPopular BOOLEAN DEFAULT 0,
      averageRating REAL DEFAULT 0.0,
      averageServiceRating REAL DEFAULT 0.0,
      totalReviews INTEGER DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customerId INTEGER,
      nailerId INTEGER,
      serviceId INTEGER,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      price REAL,
      originalPrice REAL,
      discountAmount REAL DEFAULT 0.0,
      discountReason TEXT,
      finalPrice REAL,
      status TEXT DEFAULT 'confirmed',
      notes TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customerId) REFERENCES customers(id),
      FOREIGN KEY (nailerId) REFERENCES nailers(id),
      FOREIGN KEY (serviceId) REFERENCES services(id)
    );
    
    CREATE TABLE IF NOT EXISTS time_slots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nailerId INTEGER,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      isAvailable BOOLEAN DEFAULT 1,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (nailerId) REFERENCES nailers(id),
      UNIQUE(nailerId, date, time)
    );
  `);
  console.log('✅ Basic tables created successfully');
  
  // Verify tables exist
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log('📋 Available tables:', tables.map(t => t.name));
  
} catch (error) {
  console.error('❌ Error creating basic tables:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
}

// Run migrations
const migrations = [
  '001_crm_schema.sql',
  '002_treatwell_features.sql'
];

migrations.forEach(migrationFile => {
  const migrationPath = path.join(__dirname, 'migrations', migrationFile);
  if (fs.existsSync(migrationPath)) {
    console.log(`Running migration: ${migrationFile}`);
    const migration = fs.readFileSync(migrationPath, 'utf8');
    db.exec(migration);
  } else {
    console.log(`Migration file not found: ${migrationFile}`);
  }
});

console.log('All database migrations completed');

// Seed initial data
console.log('🌱 Seeding initial data...');
try {
  require('./seed-data.js');
  console.log('✅ Database seeded successfully');
} catch (error) {
  console.error('❌ Error seeding data:', error.message);
  console.error('Stack:', error.stack);
  // Don't exit, seeding is optional
}

// Final verification
console.log('🔍 Final database verification...');
try {
  const customerCount = db.prepare('SELECT COUNT(*) as count FROM customers').get();
  const nailerCount = db.prepare('SELECT COUNT(*) as count FROM nailers').get();
  const serviceCount = db.prepare('SELECT COUNT(*) as count FROM services').get();
  
  console.log('📊 Database summary:');
  console.log(`   - Customers: ${customerCount.count}`);
  console.log(`   - Nailers: ${nailerCount.count}`);
  console.log(`   - Services: ${serviceCount.count}`);
  
  if (customerCount.count === 0) {
    console.warn('⚠️ Warning: No customers found - this might indicate a problem');
  }
  
} catch (error) {
  console.error('❌ Error in final verification:', error.message);
}

console.log('🎉 Database initialization completed successfully!');
db.close();
