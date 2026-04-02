-- Treatwell-inspired Features Migration for MIYU Nail Studio
-- Add rewards, reviews, smart pricing, and gift cards functionality

-- ─── REWARDS SYSTEM ──────────────────────────────────────────────────────────────────

-- Create customer rewards table
CREATE TABLE IF NOT EXISTS customer_rewards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customerId INTEGER UNIQUE,
  totalPoints INTEGER DEFAULT 0,
  redeemedPoints INTEGER DEFAULT 0,
  availablePoints INTEGER DEFAULT 0,
  lastUpdated DATETIME DEFAULT CURRENT_TIMESTAMP,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customerId) REFERENCES customers(id) ON DELETE CASCADE
);

-- Create rewards history table
CREATE TABLE IF NOT EXISTS rewards_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customerId INTEGER NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('earned', 'redeemed', 'expired', 'bonus')),
  points INTEGER NOT NULL, -- Positive for earned, negative for redeemed
  description TEXT,
  referenceId INTEGER, -- bookingId, campaignId, etc.
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customerId) REFERENCES customers(id) ON DELETE CASCADE
);

-- Create discount codes table
CREATE TABLE IF NOT EXISTS discount_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  customerId INTEGER,
  discountAmount REAL NOT NULL,
  pointsUsed INTEGER,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'used', 'expired')),
  expiresAt DATETIME,
  usedAt DATETIME,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customerId) REFERENCES customers(id) ON DELETE SET NULL
);

-- ─── REVIEWS SYSTEM ────────────────────────────────────────────────────────────────

-- Note: rating columns are already added in basic table creation in init-db.js

-- Create reviews table
CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customerId INTEGER NOT NULL,
  bookingId INTEGER UNIQUE NOT NULL, -- One review per booking
  rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
  comment TEXT,
  serviceRating INTEGER CHECK(serviceRating BETWEEN 1 AND 5),
  atmosphereRating INTEGER CHECK(atmosphereRating BETWEEN 1 AND 5),
  staffRating INTEGER CHECK(staffRating BETWEEN 1 AND 5),
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
  response TEXT, -- Salon response to review
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customerId) REFERENCES customers(id) ON DELETE CASCADE,
  FOREIGN KEY (bookingId) REFERENCES bookings(id) ON DELETE CASCADE
);

-- ─── SMART PRICING ────────────────────────────────────────────────────────────────

-- Note: pricing columns are already added in basic table creation in init-db.js

-- Create pricing rules table
CREATE TABLE IF NOT EXISTS pricing_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('off_peak', 'last_minute', 'tier', 'bulk', 'seasonal')),
  conditions TEXT NOT NULL, -- JSON conditions
  discount REAL NOT NULL, -- Discount percentage (0.15 = 15%)
  isActive BOOLEAN DEFAULT 1,
  priority INTEGER DEFAULT 0, -- Higher priority applied first
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create pricing history table
CREATE TABLE IF NOT EXISTS pricing_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bookingId INTEGER NOT NULL,
  originalPrice REAL NOT NULL,
  finalPrice REAL NOT NULL,
  totalDiscount REAL NOT NULL,
  discountsApplied TEXT, -- JSON array of applied discounts
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (bookingId) REFERENCES bookings(id) ON DELETE CASCADE
);

-- ─── GIFT CARDS ────────────────────────────────────────────────────────────────────

-- Create gift cards table
CREATE TABLE IF NOT EXISTS gift_cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  amount REAL NOT NULL,
  originalAmount REAL NOT NULL,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'used', 'expired', 'suspended')),
  purchaserName TEXT NOT NULL,
  purchaserEmail TEXT NOT NULL,
  recipientName TEXT NOT NULL,
  recipientEmail TEXT NOT NULL,
  message TEXT,
  deliveryMethod TEXT DEFAULT 'email' CHECK(deliveryMethod IN ('email', 'print', 'pickup')),
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  expiresAt DATETIME NOT NULL,
  lastUsedAt DATETIME,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create gift card usage table
CREATE TABLE IF NOT EXISTS gift_card_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  giftCardId INTEGER NOT NULL,
  bookingId INTEGER NOT NULL,
  amountUsed REAL NOT NULL,
  usedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (giftCardId) REFERENCES gift_cards(id) ON DELETE CASCADE,
  FOREIGN KEY (bookingId) REFERENCES bookings(id) ON DELETE CASCADE
);

-- ─── 24/7 BOOKING PORTAL ─────────────────────────────────────────────────────────────

-- Create online booking settings table
CREATE TABLE IF NOT EXISTS booking_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  settingKey TEXT UNIQUE NOT NULL,
  settingValue TEXT NOT NULL,
  description TEXT,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert default booking settings
INSERT OR IGNORE INTO booking_settings (settingKey, settingValue, description) VALUES
('online_booking_enabled', 'true', 'Enable online booking portal'),
('min_booking_hours', '2', 'Minimum hours in advance for online booking'),
('max_booking_months', '3', 'Maximum months in advance for online booking'),
('auto_confirm_bookings', 'false', 'Automatically confirm online bookings'),
('require_phone', 'true', 'Require phone number for online booking'),
('require_email', 'true', 'Require email for online booking'),
('allow_guest_booking', 'false', 'Allow booking without account'),
('deposit_required', 'false', 'Require deposit for online booking'),
('deposit_percentage', '20', 'Deposit percentage if required');

-- Create booking portal analytics table
CREATE TABLE IF NOT EXISTS portal_analytics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  eventType TEXT NOT NULL CHECK(eventType IN ('visit', 'search', 'view_service', 'booking_start', 'booking_complete', 'payment')),
  sessionId TEXT,
  customerId INTEGER,
  data TEXT, -- JSON event data
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customerId) REFERENCES customers(id) ON DELETE SET NULL
);

-- ─── INDEXES ─────────────────────────────────────────────────────────────────────

-- Rewards indexes
CREATE INDEX IF NOT EXISTS idx_customer_rewards_customerId ON customer_rewards(customerId);
CREATE INDEX IF NOT EXISTS idx_rewards_history_customerId ON rewards_history(customerId);
CREATE INDEX IF NOT EXISTS idx_rewards_history_type ON rewards_history(type);
CREATE INDEX IF NOT EXISTS idx_discount_codes_code ON discount_codes(code);
CREATE INDEX IF NOT EXISTS idx_discount_codes_status ON discount_codes(status);

-- Reviews indexes
CREATE INDEX IF NOT EXISTS idx_reviews_customerId ON reviews(customerId);
CREATE INDEX IF NOT EXISTS idx_reviews_bookingId ON reviews(bookingId);
CREATE INDEX IF NOT EXISTS idx_reviews_status ON reviews(status);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON reviews(rating);
CREATE INDEX IF NOT EXISTS idx_reviews_createdAt ON reviews(createdAt);

-- Pricing indexes
CREATE INDEX IF NOT EXISTS idx_pricing_rules_type ON pricing_rules(type);
CREATE INDEX IF NOT EXISTS idx_pricing_rules_active ON pricing_rules(isActive);
CREATE INDEX IF NOT EXISTS idx_pricing_history_bookingId ON pricing_history(bookingId);

-- Gift cards indexes
CREATE INDEX IF NOT EXISTS idx_gift_cards_code ON gift_cards(code);
CREATE INDEX IF NOT EXISTS idx_gift_cards_status ON gift_cards(status);
CREATE INDEX IF NOT EXISTS idx_gift_cards_recipientEmail ON gift_cards(recipientEmail);
CREATE INDEX IF NOT EXISTS idx_gift_card_usage_giftCardId ON gift_card_usage(giftCardId);

-- Portal analytics indexes
CREATE INDEX IF NOT EXISTS idx_portal_analytics_eventType ON portal_analytics(eventType);
CREATE INDEX IF NOT EXISTS idx_portal_analytics_sessionId ON portal_analytics(sessionId);
CREATE INDEX IF NOT EXISTS idx_portal_analytics_createdAt ON portal_analytics(createdAt);

-- ─── TRIGGERS ────────────────────────────────────────────────────────────────────

-- Auto-award points for completed bookings
CREATE TRIGGER IF NOT EXISTS award_booking_points
AFTER UPDATE ON bookings
WHEN NEW.status = 'completed' AND OLD.status != 'completed'
BEGIN
  -- Calculate points (10 points per €1 spent + tier bonus)
  INSERT INTO rewards_history (customerId, type, points, description, referenceId)
  VALUES (
    NEW.customerId, 
    'earned', 
    CAST(NEW.price * 10 AS INTEGER) + 
      CASE 
        WHEN (SELECT tier FROM customers WHERE id = NEW.customerId) = 'VIP' THEN 50
        WHEN (SELECT tier FROM customers WHERE id = NEW.customerId) = 'Loyal' THEN 25
        WHEN (SELECT tier FROM customers WHERE id = NEW.customerId) = 'Regular' THEN 10
        ELSE 5
      END,
    'Points earned from booking: ' || (SELECT name FROM services WHERE id = NEW.serviceId),
    NEW.id
  );
  
  -- Update customer rewards balance
  INSERT OR REPLACE INTO customer_rewards (customerId, totalPoints, availablePoints, lastUpdated)
  SELECT 
    NEW.customerId,
    COALESCE(totalPoints, 0) + CAST(NEW.price * 10 AS INTEGER) + 
      CASE 
        WHEN (SELECT tier FROM customers WHERE id = NEW.customerId) = 'VIP' THEN 50
        WHEN (SELECT tier FROM customers WHERE id = NEW.customerId) = 'Loyal' THEN 25
        WHEN (SELECT tier FROM customers WHERE id = NEW.customerId) = 'Regular' THEN 10
        ELSE 5
      END,
    COALESCE(availablePoints, 0) + CAST(NEW.price * 10 AS INTEGER) + 
      CASE 
        WHEN (SELECT tier FROM customers WHERE id = NEW.customerId) = 'VIP' THEN 50
        WHEN (SELECT tier FROM customers WHERE id = NEW.customerId) = 'Loyal' THEN 25
        WHEN (SELECT tier FROM customers WHERE id = NEW.customerId) = 'Regular' THEN 10
        ELSE 5
      END,
    CURRENT_TIMESTAMP
  FROM customer_rewards 
  WHERE customerId = NEW.customerId;
END;

-- Auto-calculate pricing for new bookings
CREATE TRIGGER IF NOT EXISTS calculate_booking_pricing
AFTER INSERT ON bookings
BEGIN
  -- Store original price
  UPDATE bookings SET originalPrice = price WHERE id = NEW.id;
  
  -- Calculate final price with smart pricing (this would be handled by the smart-pricing route)
  UPDATE bookings SET finalPrice = price WHERE id = NEW.id;
  
  -- Log pricing history
  INSERT INTO pricing_history (bookingId, originalPrice, finalPrice, totalDiscount, discountsApplied)
  VALUES (NEW.id, NEW.price, NEW.price, 0, '[]');
END;

-- Auto-update service ratings after new review
CREATE TRIGGER IF NOT EXISTS update_service_rating
AFTER INSERT ON reviews
WHEN NEW.status = 'approved'
BEGIN
  UPDATE services SET
    averageRating = (
      SELECT COALESCE(AVG(rating), 0) 
      FROM reviews r
      JOIN bookings b ON r.bookingId = b.id
      WHERE b.serviceId = (SELECT serviceId FROM bookings WHERE id = NEW.bookingId)
        AND r.status = 'approved'
    ),
    averageServiceRating = (
      SELECT COALESCE(AVG(serviceRating), 0)
      FROM reviews r
      JOIN bookings b ON r.bookingId = b.id
      WHERE b.serviceId = (SELECT serviceId FROM bookings WHERE id = NEW.bookingId)
        AND r.status = 'approved'
        AND r.serviceRating IS NOT NULL
    ),
    totalReviews = (
      SELECT COUNT(*)
      FROM reviews r
      JOIN bookings b ON r.bookingId = b.id
      WHERE b.serviceId = (SELECT serviceId FROM bookings WHERE id = NEW.bookingId)
        AND r.status = 'approved'
    )
  WHERE id = (SELECT serviceId FROM bookings WHERE id = NEW.bookingId);
END;

-- Auto-update nailer ratings after new review
CREATE TRIGGER IF NOT EXISTS update_nailer_rating
AFTER INSERT ON reviews
WHEN NEW.status = 'approved'
BEGIN
  UPDATE nailers SET
    averageRating = (
      SELECT COALESCE(AVG(rating), 0)
      FROM reviews r
      JOIN bookings b ON r.bookingId = b.id
      WHERE b.nailerId = (SELECT nailerId FROM bookings WHERE id = NEW.bookingId)
        AND r.status = 'approved'
    ),
    averageStaffRating = (
      SELECT COALESCE(AVG(staffRating), 0)
      FROM reviews r
      JOIN bookings b ON r.bookingId = b.id
      WHERE b.nailerId = (SELECT nailerId FROM bookings WHERE id = NEW.bookingId)
        AND r.status = 'approved'
        AND r.staffRating IS NOT NULL
    ),
    totalReviews = (
      SELECT COUNT(*)
      FROM reviews r
      JOIN bookings b ON r.bookingId = b.id
      WHERE b.nailerId = (SELECT nailerId FROM bookings WHERE id = NEW.bookingId)
        AND r.status = 'approved'
    )
  WHERE id = (SELECT nailerId FROM bookings WHERE id = NEW.bookingId);
END;

-- Auto-expire gift cards
CREATE TRIGGER IF NOT EXISTS expire_gift_cards
AFTER UPDATE ON gift_cards
WHEN NEW.expiresAt < date('now') AND OLD.expiresAt >= date('now') AND NEW.status = 'active'
BEGIN
  UPDATE gift_cards SET status = 'expired' WHERE id = NEW.id;
END;
