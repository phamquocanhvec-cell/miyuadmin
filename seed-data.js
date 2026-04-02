// seed-data.js — Populate database with initial data for MIYU Nail Studio
const Database = require('better-sqlite3');

const dbPath = process.env.NODE_ENV === 'production' ? '/opt/render/project/src/miyu.db' : './miyu.db';
const db = new Database(dbPath);

console.log('Seeding database with initial data...');

// ─── NAILERS ─────────────────────────────────────────────────────────────────────
const nailers = [
  {
    firstName: 'Anna',
    lastName: 'Schmidt',
    email: 'anna@miyu.de',
    phone: '+49 211 1234567',
    specialty: 'Gel Nails & Nail Art',
    bio: 'Über 10 Jahre Erfahrung in Nail Design und spezialisiert auf kreative Nail Art.'
  },
  {
    firstName: 'Maria',
    lastName: 'Weber',
    email: 'maria@miyu.de',
    phone: '+49 211 1234568',
    specialty: 'Manicure & Pedicure',
    bio: 'Expertin für klassische Manicure und medizinische Pedicure.'
  },
  {
    firstName: 'Lisa',
    lastName: 'Müller',
    email: 'lisa@miyu.de',
    phone: '+49 211 1234569',
    specialty: 'Acrylic Nails & Extensions',
    bio: 'Spezialisiert auf Acrylic Techniken und Nail Extensions.'
  }
];

const insertNailer = db.prepare(`
  INSERT OR IGNORE INTO nailers (firstName, lastName, email, phone, specialty, bio)
  VALUES (?, ?, ?, ?, ?, ?)
`);

nailers.forEach(nailer => {
  insertNailer.run(nailer.firstName, nailer.lastName, nailer.email, nailer.phone, nailer.specialty, nailer.bio);
});

// ─── SERVICES ────────────────────────────────────────────────────────────────────
const services = [
  {
    name: 'Klassische Manicure',
    description: 'Gründliche Manicure mit Nagelhautpflege und Lackierung nach Wahl',
    duration: 45,
    price: 35,
    category: 'standard',
    isPopular: true
  },
  {
    name: 'Gel Nails',
    description: 'Langlebige Gel Nägel mit französischer oder farbiger Maniküre',
    duration: 60,
    price: 55,
    category: 'premium',
    isPopular: true
  },
  {
    name: 'Nail Art Design',
    description: 'Kreatives Nail Art Design mit Swarovski Steinen oder French Tips',
    duration: 90,
    price: 85,
    category: 'premium',
    isPopular: false
  },
  {
    name: 'Acrylic Extensions',
    description: 'Verlängerung mit Acrylic und natürlicher Form',
    duration: 120,
    price: 95,
    category: 'premium',
    isPopular: false
  },
  {
    name: 'Spa Pedicure',
    description: 'Entspannende Pedicure mit Fußbad und Nagelpflege',
    duration: 60,
    price: 45,
    category: 'standard',
    isPopular: true
  },
  {
    name: 'Express Manicure',
    description: 'Schnelle Manicure für zwischendurch',
    duration: 30,
    price: 25,
    category: 'express',
    isPopular: false
  },
  {
    name: 'Russian Manicure',
    description: 'Präzise Nagelhautentfernung nach russischer Technik',
    duration: 50,
    price: 40,
    category: 'premium',
    isPopular: true
  },
  {
    name: 'Nail Repair',
    description: 'Reparatur von gebrochenen oder beschädigten Nägeln',
    duration: 30,
    price: 15,
    category: 'service',
    isPopular: false
  }
];

const insertService = db.prepare(`
  INSERT OR IGNORE INTO services (name, description, duration, price, category, isPopular)
  VALUES (?, ?, ?, ?, ?, ?)
`);

services.forEach(service => {
  insertService.run(service.name, service.description, service.duration, service.price, service.category, service.isPopular);
});

// ─── SAMPLE CUSTOMERS ─────────────────────────────────────────────────────────────
const customers = [
  {
    firstName: 'Sarah',
    lastName: 'Müller',
    email: 'sarah.mueller@email.de',
    phone: '+49 211 9876543',
    birthday: '1990-05-15',
    tier: 'VIP',
    visitCount: 12,
    totalSpent: 650
  },
  {
    firstName: 'Julia',
    lastName: 'Schmidt',
    email: 'julia.schmidt@email.de',
    phone: '+49 211 9876544',
    birthday: '1985-08-22',
    tier: 'Loyal',
    visitCount: 6,
    totalSpent: 280
  },
  {
    firstName: 'Emma',
    lastName: 'Weber',
    email: 'emma.weber@email.de',
    phone: '+49 211 9876545',
    birthday: '1992-12-10',
    tier: 'Regular',
    visitCount: 3,
    totalSpent: 120
  },
  {
    firstName: 'Sophie',
    lastName: 'Fischer',
    email: 'sophie.fischer@email.de',
    phone: '+49 211 9876546',
    birthday: '1988-03-18',
    tier: 'New',
    visitCount: 1,
    totalSpent: 35
  }
];

const insertCustomer = db.prepare(`
  INSERT OR IGNORE INTO customers (firstName, lastName, email, phone, birthday, tier, visitCount, totalSpent, lastVisit)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, date('now', '-7 days'))
`);

customers.forEach(customer => {
  insertCustomer.run(
    customer.firstName, customer.lastName, customer.email, customer.phone, 
    customer.birthday, customer.tier, customer.visitCount, customer.totalSpent
  );
});

// ─── SAMPLE BOOKINGS ─────────────────────────────────────────────────────────────
const bookings = [
  {
    customerId: 1,
    nailerId: 1,
    serviceId: 2,
    date: '2024-12-01',
    time: '14:00',
    price: 55,
    status: 'completed'
  },
  {
    customerId: 1,
    nailerId: 2,
    serviceId: 5,
    date: '2024-12-15',
    time: '10:00',
    price: 45,
    status: 'confirmed'
  },
  {
    customerId: 2,
    nailerId: 1,
    serviceId: 1,
    date: '2024-12-08',
    time: '16:00',
    price: 35,
    status: 'completed'
  },
  {
    customerId: 3,
    nailerId: 3,
    serviceId: 4,
    date: '2024-12-20',
    time: '11:00',
    price: 95,
    status: 'confirmed'
  }
];

const insertBooking = db.prepare(`
  INSERT OR IGNORE INTO bookings (customerId, nailerId, serviceId, date, time, price, status, originalPrice, finalPrice)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

bookings.forEach(booking => {
  insertBooking.run(
    booking.customerId, booking.nailerId, booking.serviceId, 
    booking.date, booking.time, booking.price, booking.status,
    booking.price, booking.price
  );
});

// ─── TIME SLOTS ───────────────────────────────────────────────────────────────────
// Generate time slots for next 30 days
const generateTimeSlots = () => {
  const timeSlots = [];
  const startTime = 9; // 9 AM
  const endTime = 18; // 6 PM
  const slotDuration = 30; // 30 minutes
  
  for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
    const date = new Date();
    date.setDate(date.getDate() + dayOffset);
    const dateStr = date.toISOString().split('T')[0];
    
    // Skip Sundays
    if (date.getDay() === 0) continue;
    
    for (let hour = startTime; hour < endTime; hour++) {
      for (let minute = 0; minute < 60; minute += slotDuration) {
        const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        
        // Generate slots for all nailers
        for (let nailerId = 1; nailerId <= 3; nailerId++) {
          timeSlots.push({
            nailerId,
            date: dateStr,
            time: timeStr,
            isAvailable: true
          });
        }
      }
    }
  }
  
  return timeSlots;
};

const insertTimeSlot = db.prepare(`
  INSERT OR IGNORE INTO time_slots (nailerId, date, time, isAvailable)
  VALUES (?, ?, ?, ?)
`);

const timeSlots = generateTimeSlots();
timeSlots.forEach(slot => {
  insertTimeSlot.run(slot.nailerId, slot.date, slot.time, slot.isAvailable);
});

// ─── SAMPLE REVIEWS ─────────────────────────────────────────────────────────────
const reviews = [
  {
    customerId: 1,
    bookingId: 1,
    rating: 5,
    comment: 'Super Service! Anna hat mich wieder sehr zufrieden gemacht.',
    serviceRating: 5,
    atmosphereRating: 5,
    staffRating: 5,
    status: 'approved'
  },
  {
    customerId: 2,
    bookingId: 3,
    rating: 4,
    comment: 'Sehr gute Manicure, werde wiederkommen.',
    serviceRating: 4,
    atmosphereRating: 4,
    staffRating: 4,
    status: 'approved'
  }
];

const insertReview = db.prepare(`
  INSERT OR IGNORE INTO reviews (customerId, bookingId, rating, comment, serviceRating, atmosphereRating, staffRating, status)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

reviews.forEach(review => {
  insertReview.run(
    review.customerId, review.bookingId, review.rating, review.comment,
    review.serviceRating, review.atmosphereRating, review.staffRating, review.status
  );
});

// ─── SAMPLE REWARDS ─────────────────────────────────────────────────────────────
const rewards = [
  {
    customerId: 1,
    totalPoints: 650,
    availablePoints: 200
  },
  {
    customerId: 2,
    totalPoints: 280,
    availablePoints: 80
  },
  {
    customerId: 3,
    totalPoints: 120,
    availablePoints: 30
  }
];

const insertReward = db.prepare(`
  INSERT OR IGNORE INTO customer_rewards (customerId, totalPoints, redeemedPoints, availablePoints)
  VALUES (?, ?, ?, ?)
`);

rewards.forEach(reward => {
  const redeemedPoints = reward.totalPoints - reward.availablePoints;
  insertReward.run(reward.customerId, reward.totalPoints, redeemedPoints, reward.availablePoints);
});

// ─── SAMPLE GIFT CARDS ───────────────────────────────────────────────────────────
const giftCards = [
  {
    code: 'MIYU2024GIFT001',
    amount: 50,
    originalAmount: 50,
    purchaserName: 'Thomas Müller',
    purchaserEmail: 'thomas.mueller@email.de',
    recipientName: 'Sarah Müller',
    recipientEmail: 'sarah.mueller@email.de',
    message: 'Happy Birthday! Enjoy your pampering session.',
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  }
];

const insertGiftCard = db.prepare(`
  INSERT OR IGNORE INTO gift_cards (code, amount, originalAmount, purchaserName, purchaserEmail, recipientName, recipientEmail, message, expiresAt)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

giftCards.forEach(giftCard => {
  insertGiftCard.run(
    giftCard.code, giftCard.amount, giftCard.originalAmount,
    giftCard.purchaserName, giftCard.purchaserEmail,
    giftCard.recipientName, giftCard.recipientEmail,
    giftCard.message, giftCard.expiresAt
  );
});

console.log('Database seeded successfully!');
console.log(`- ${nailers.length} nailers created`);
console.log(`- ${services.length} services created`);
console.log(`- ${customers.length} customers created`);
console.log(`- ${bookings.length} bookings created`);
console.log(`- ${timeSlots.length} time slots created`);
console.log(`- ${reviews.length} reviews created`);
console.log(`- ${rewards.length} reward accounts created`);
console.log(`- ${giftCards.length} gift cards created`);

db.close();
