-- CRM Schema Migration for MIYU Nail Studio
-- Add customer tier system, email logs, and enhanced analytics

-- Update customers table with CRM fields (only if columns don't exist)
-- SQLite doesn't support IF NOT EXISTS for ALTER TABLE, so we'll check pragma
-- These will be added by the basic table creation in init-db.js

-- Create email logs table
CREATE TABLE IF NOT EXISTS email_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customerId INTEGER,
  type TEXT NOT NULL, -- 'birthday', 'promotion', 'reminder', 'welcome'
  subject TEXT,
  content TEXT,
  sentAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  status TEXT DEFAULT 'sent' CHECK(status IN ('sent', 'delivered', 'opened', 'clicked', 'bounced')),
  openedAt DATETIME,
  clickedAt DATETIME,
  FOREIGN KEY (customerId) REFERENCES customers(id) ON DELETE SET NULL
);

-- Create customer preferences table
CREATE TABLE IF NOT EXISTS customer_preferences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customerId INTEGER UNIQUE,
  preferredNailer INTEGER,
  preferredDayOfWeek TEXT, -- 'monday', 'tuesday', etc.
  preferredTime TEXT, -- 'morning', 'afternoon', 'evening'
  reminderDays INTEGER DEFAULT 2, -- Days before appointment to send reminder
  promotionConsent BOOLEAN DEFAULT 1,
  birthdayConsent BOOLEAN DEFAULT 1,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customerId) REFERENCES customers(id) ON DELETE CASCADE
);

-- Create revenue tracking table
CREATE TABLE IF NOT EXISTS revenue_tracking (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bookingId INTEGER,
  customerId INTEGER,
  amount REAL NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('projected', 'actual')),
  recordedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  paymentMethod TEXT, -- 'cash', 'card', 'transfer'
  notes TEXT,
  FOREIGN KEY (bookingId) REFERENCES bookings(id) ON DELETE CASCADE,
  FOREIGN KEY (customerId) REFERENCES customers(id) ON DELETE SET NULL
);

-- Create marketing campaigns table
CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('birthday', 'promotion', 'reminder', 'welcome', 'rebooking')),
  subject TEXT,
  content TEXT,
  targetAudience TEXT, -- JSON filter criteria
  scheduledAt DATETIME,
  sentAt DATETIME,
  status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'scheduled', 'sending', 'sent', 'paused')),
  totalRecipients INTEGER DEFAULT 0,
  deliveredCount INTEGER DEFAULT 0,
  openedCount INTEGER DEFAULT 0,
  clickedCount INTEGER DEFAULT 0,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create customer interactions log
CREATE TABLE IF NOT EXISTS customer_interactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customerId INTEGER,
  type TEXT NOT NULL CHECK(type IN ('visit', 'call', 'email', 'sms', 'cancellation', 'no_show')),
  description TEXT,
  value REAL, -- For revenue tracking
  interactionDate DATETIME DEFAULT CURRENT_TIMESTAMP,
  staffId INTEGER, -- Which staff member handled it
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customerId) REFERENCES customers(id) ON DELETE CASCADE
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_customers_tier ON customers(tier);
CREATE INDEX IF NOT EXISTS idx_customers_lastVisit ON customers(lastVisit);
CREATE INDEX IF NOT EXISTS idx_customers_birthday ON customers(birthday);
CREATE INDEX IF NOT EXISTS idx_email_logs_customerId ON email_logs(customerId);
CREATE INDEX IF NOT EXISTS idx_email_logs_type ON email_logs(type);
CREATE INDEX IF NOT EXISTS idx_email_logs_sentAt ON email_logs(sentAt);
CREATE INDEX IF NOT EXISTS idx_revenue_tracking_type ON revenue_tracking(type);
CREATE INDEX IF NOT EXISTS idx_revenue_tracking_recordedAt ON revenue_tracking(recordedAt);
CREATE INDEX IF NOT EXISTS idx_customer_interactions_customerId ON customer_interactions(customerId);
CREATE INDEX IF NOT EXISTS idx_customer_interactions_type ON customer_interactions(type);
CREATE INDEX IF NOT EXISTS idx_customer_interactions_date ON customer_interactions(interactionDate);

-- Update existing customers with default values
UPDATE customers SET 
  tier = CASE 
    WHEN visitCount >= 10 OR totalSpent >= 500 THEN 'VIP'
    WHEN visitCount >= 5 OR totalSpent >= 200 THEN 'Loyal'
    WHEN visitCount >= 1 OR totalSpent > 0 THEN 'Regular'
    ELSE 'New'
  END
WHERE tier IS NULL OR tier = '';

-- Create triggers for automatic tier updates
CREATE TRIGGER IF NOT EXISTS update_customer_tier_after_visit
AFTER UPDATE ON bookings
WHEN NEW.status = 'completed' AND OLD.status != 'completed'
BEGIN
  UPDATE customers SET
    visitCount = visitCount + 1,
    totalSpent = totalSpent + NEW.price,
    lastVisit = NEW.date,
    tier = CASE
      WHEN (visitCount + 1) >= 10 OR (totalSpent + NEW.price) >= 500 THEN 'VIP'
      WHEN (visitCount + 1) >= 5 OR (totalSpent + NEW.price) >= 200 THEN 'Loyal'
      WHEN (visitCount + 1) >= 1 OR (totalSpent + NEW.price) > 0 THEN 'Regular'
      ELSE 'New'
    END,
    updatedAt = CURRENT_TIMESTAMP
  WHERE id = NEW.customerId;
  
  -- Record actual revenue
  INSERT INTO revenue_tracking (bookingId, customerId, amount, type)
  VALUES (NEW.id, NEW.customerId, NEW.price, 'actual');
  
  -- Log customer interaction
  INSERT INTO customer_interactions (customerId, type, description, value, interactionDate)
  VALUES (NEW.id, 'visit', 'Completed appointment', NEW.price, NEW.date);
END;

CREATE TRIGGER IF NOT EXISTS add_projected_revenue
AFTER INSERT ON bookings
WHEN NEW.status = 'confirmed'
BEGIN
  -- Record projected revenue
  INSERT INTO revenue_tracking (bookingId, customerId, amount, type)
  VALUES (NEW.id, NEW.customerId, NEW.price, 'projected');
  
  -- Update next appointment
  UPDATE customers SET nextAppointment = NEW.date WHERE id = NEW.customerId;
END;

CREATE TRIGGER IF NOT EXISTS remove_projected_revenue
AFTER UPDATE ON bookings
WHEN NEW.status != 'confirmed' AND OLD.status = 'confirmed'
BEGIN
  -- Remove projected revenue if booking is cancelled
  DELETE FROM revenue_tracking 
  WHERE bookingId = NEW.id AND type = 'projected';
  
  -- Clear next appointment if this was the next one
  UPDATE customers SET nextAppointment = 
    (SELECT MIN(date) FROM bookings 
     WHERE customerId = NEW.customerId AND status = 'confirmed' AND date > date('now'))
  WHERE id = NEW.customerId;
END;
