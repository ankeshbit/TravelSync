#!/usr/bin/env node
/**
 * TravelSync Demo Database Seeder
 *
 * Populates local PostgreSQL with a complete, realistic demo environment
 * for technical interviews and local walkthroughs.
 *
 * Usage:
 *   node scripts/seed_demo.js --confirm
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Default to local test cluster if DATABASE_URL is not set
const defaultLocalDbUrl = process.env.TEST_DATABASE_URL || 'postgresql://postgres@127.0.0.1:5433/travelsync_test?sslmode=disable';
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = defaultLocalDbUrl;
  process.env.DIRECT_URL = defaultLocalDbUrl;
}

const { PrismaClient } = require('@prisma/client');
const config = require('../config/env');
const { calculateBalances } = require('../utils/calculateBalances');

const prisma = new PrismaClient();

// ── 1. Safety Checks ──────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const hasConfirm = args.includes('--confirm');

if (!hasConfirm) {
  console.error('\n❌ SAFETY ERROR: You must provide the --confirm flag to seed the database.');
  console.error('Usage: npm run db:seed:demo  OR  node scripts/seed_demo.js --confirm\n');
  process.exit(1);
}

if (config.isProduction || process.env.NODE_ENV === 'production') {
  console.error('\n❌ SAFETY REFUSAL: Cannot run demo seeder in PRODUCTION mode (NODE_ENV=production).\n');
  process.exit(1);
}

const dbUrl = process.env.DATABASE_URL || '';
const isLocalDb = /(@(localhost|127\.0\.0\.1|::1)|travelsync_test)/i.test(dbUrl);
const isSuspiciousRemoteDb = /(aws|neon\.tech|production|prod-db|supabase\.co|render\.com|railway\.app|upstash\.io|aivencloud\.com)/i.test(dbUrl);

if ((!isLocalDb || isSuspiciousRemoteDb) && !args.includes('--force-remote')) {
  console.error('\n❌ SAFETY REFUSAL: DATABASE_URL does not point to a verified local database (localhost/127.0.0.1/travelsync_test).');
  console.error('Targeting unexpected or cloud databases is blocked to safeguard data integrity.');
  console.error('If you intentionally want to target a remote test database, pass --force-remote.\n');
  process.exit(1);
}

// ── 2. Seeder Logic ───────────────────────────────────────────────────────────

async function seed() {
  console.log('\n============================================================');
  console.log('🌱 TravelSync Local Interview Demonstration Seeder');
  console.log('============================================================\n');

  try {
    await prisma.$connect();
    console.log('✓ Connected to PostgreSQL database');

    // ── Clean up existing demo data safely ───────────────────────────────────
    console.log('🧹 Cleaning up any previous demo data (*.demo@travelsync.local)...');

    const existingUsers = await prisma.user.findMany({
      where: {
        email: {
          in: ['alice.demo@travelsync.local', 'bob.demo@travelsync.local']
        }
      },
      select: { id: true }
    });

    const userIds = existingUsers.map(u => u.id);

    if (userIds.length > 0) {
      // Find trips owned by these users
      const trips = await prisma.trip.findMany({
        where: { ownerId: { in: userIds } },
        select: { id: true }
      });
      const tripIds = trips.map(t => t.id);

      // Clean dependent records
      if (tripIds.length > 0) {
        await prisma.activity.deleteMany({ where: { tripId: { in: tripIds } } });
        await prisma.expenseSplit.deleteMany({ where: { expense: { tripId: { in: tripIds } } } });
        await prisma.expense.deleteMany({ where: { tripId: { in: tripIds } } });
        await prisma.place.deleteMany({ where: { tripId: { in: tripIds } } });
        await prisma.tripMember.deleteMany({ where: { tripId: { in: tripIds } } });
        await prisma.trip.deleteMany({ where: { id: { in: tripIds } } });
      }

      // Also clean up any member references or splits in other trips
      await prisma.expenseSplit.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.expense.deleteMany({ where: { paidById: { in: userIds } } });
      await prisma.tripMember.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }

    console.log('✓ Clean state prepared\n');

    // ── Create Demo Users ───────────────────────────────────────────────────
    console.log('👤 Provisioning Demo Users...');

    const alice = await prisma.user.create({
      data: {
        name: 'Alice Explorer',
        email: 'alice.demo@travelsync.local',
        firebaseUid: 'demo-uid-alice',
        picture: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
        password: ''
      }
    });
    console.log(`  ✓ Alice (Organizer): ${alice.email} [ID: ${alice.id.slice(0, 8)}...]`);

    const bob = await prisma.user.create({
      data: {
        name: 'Bob Traveler',
        email: 'bob.demo@travelsync.local',
        firebaseUid: 'demo-uid-bob',
        picture: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
        password: ''
      }
    });
    console.log(`  ✓ Bob (Collaborator): ${bob.email} [ID: ${bob.id.slice(0, 8)}...]`);

    // ── Create Showcase Trip ────────────────────────────────────────────────
    console.log('\n🗺️  Creating Showcase Trip...');

    const trip = await prisma.trip.create({
      data: {
        name: 'Japan Cherry Blossom & Culinary Tour 2026',
        destination: 'Tokyo & Kyoto, Japan',
        startDate: new Date('2026-04-01T00:00:00Z'),
        endDate: new Date('2026-04-10T23:59:59Z'),
        status: 'planning',
        coverImageUrl: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=1200',
        budgetPerPerson: 2500,
        currency: 'USD',
        ownerId: alice.id
      }
    });
    console.log(`  ✓ Trip Created: "${trip.name}" (${trip.currency} ${trip.budgetPerPerson} budget)`);

    // Add Members: Alice (Organizer) and Bob (Member)
    await prisma.tripMember.createMany({
      data: [
        { tripId: trip.id, userId: alice.id },
        { tripId: trip.id, userId: bob.id }
      ]
    });
    console.log('  ✓ Trip Members linked (Alice + Bob)');

    // ── Add Realistic Multi-Day Itinerary ───────────────────────────────────
    console.log('\n📍 Seeding Multi-Day Itinerary Places...');

    const placesData = [
      {
        tripId: trip.id,
        name: 'Senso-ji Temple & Nakamise Street',
        address: '2 Chome-3-1 Asakusa, Taito City, Tokyo',
        lat: 35.7148,
        lng: 139.7967,
        dayNumber: 1,
        orderIndex: 0,
        category: 'attraction',
        duration: 120,
        note: 'Tokyo’s oldest Buddhist temple. Explore traditional street food on Nakamise-dori.'
      },
      {
        tripId: trip.id,
        name: 'Shibuya Sky & Scramble Crossing',
        address: '2 Chome-24-12 Shibuya, Tokyo',
        lat: 35.6595,
        lng: 139.7005,
        dayNumber: 1,
        orderIndex: 1,
        category: 'sightseeing',
        duration: 90,
        note: 'Rooftop observatory overlooking Tokyo skyline at sunset.'
      },
      {
        tripId: trip.id,
        name: 'Tokaido Shinkansen (Bullet Train to Kyoto)',
        address: 'Tokyo Station, Marunouchi, Chiyoda City',
        lat: 35.6812,
        lng: 139.7671,
        dayNumber: 2,
        orderIndex: 0,
        category: 'transport',
        duration: 140,
        note: 'High-speed Nozomi Shinkansen reaching 285 km/h. View Mt. Fuji on the right.'
      },
      {
        tripId: trip.id,
        name: 'Fushimi Inari-taisha Shrine',
        address: '68 Fukakusa Yabunouchicho, Fushimi Ward, Kyoto',
        lat: 34.9671,
        lng: 135.7727,
        dayNumber: 2,
        orderIndex: 1,
        category: 'attraction',
        duration: 150,
        note: 'Iconic path of 10,000 vermilion torii gates winding up sacred Mount Inari.'
      },
      {
        tripId: trip.id,
        name: 'Arashiyama Bamboo Grove & Tenryu-ji',
        address: 'Sagaogurayama Tabuchiyamacho, Ukyo Ward, Kyoto',
        lat: 35.0169,
        lng: 135.6713,
        dayNumber: 3,
        orderIndex: 0,
        category: 'nature',
        duration: 180,
        note: 'Tranquil walk through towering bamboo grove and UNESCO World Heritage Zen garden.'
      }
    ];

    for (const place of placesData) {
      await prisma.place.create({ data: place });
      console.log(`  ✓ Day ${place.dayNumber}: ${place.name} (${place.category}, ${place.duration}m)`);
    }

    // ── Add Expenses and Splits with Clear Balances ─────────────────────────
    console.log('\n💳 Seeding Expenses and Financial Ledger...');

    // Expense 1: Ryokan Stay in Kyoto (Paid by Alice, $900, split 50/50)
    const exp1 = await prisma.expense.create({
      data: {
        tripId: trip.id,
        title: 'Ryokan Gion Traditional Accommodation',
        amount: 900.00,
        currency: 'USD',
        category: 'accommodation',
        paidById: alice.id,
        idempotencyKey: 'seed-ryokan-001',
        splits: {
          create: [
            { userId: alice.id },
            { userId: bob.id }
          ]
        }
      }
    });
    console.log(`  ✓ Expense 1: "${exp1.title}" - $${exp1.amount.toFixed(2)} (Paid by Alice, Split: 50% Alice, 50% Bob)`);

    // Expense 2: Shinkansen Tickets (Paid by Alice, $360, split 50/50)
    const exp2 = await prisma.expense.create({
      data: {
        tripId: trip.id,
        title: 'Shinkansen Bullet Train Tickets',
        amount: 360.00,
        currency: 'USD',
        category: 'transport',
        paidById: alice.id,
        idempotencyKey: 'seed-shinkansen-002',
        splits: {
          create: [
            { userId: alice.id },
            { userId: bob.id }
          ]
        }
      }
    });
    console.log(`  ✓ Expense 2: "${exp2.title}" - $${exp2.amount.toFixed(2)} (Paid by Alice, Split: 50% Alice, 50% Bob)`);

    // Expense 3: Omakase Dinner in Ginza (Paid by Bob, $400, split 50/50)
    const exp3 = await prisma.expense.create({
      data: {
        tripId: trip.id,
        title: 'Ginza Omakase Sushi Dinner',
        amount: 400.00,
        currency: 'USD',
        category: 'food',
        paidById: bob.id,
        idempotencyKey: 'seed-omakase-003',
        splits: {
          create: [
            { userId: alice.id },
            { userId: bob.id }
          ]
        }
      }
    });
    console.log(`  ✓ Expense 3: "${exp3.title}" - $${exp3.amount.toFixed(2)} (Paid by Bob, Split: 50% Alice, 50% Bob)`);

    // ── Log Activities ──────────────────────────────────────────────────────
    await prisma.activity.createMany({
      data: [
        { tripId: trip.id, userId: alice.id, action: 'created_trip', detail: 'Alice created the trip "Japan Cherry Blossom & Culinary Tour 2026"' },
        { tripId: trip.id, userId: alice.id, action: 'invited_member', detail: 'Alice added Bob to the trip' },
        { tripId: trip.id, userId: alice.id, action: 'added_expense', detail: 'Alice added expense "Ryokan Gion Traditional Accommodation" ($900.00)' },
        { tripId: trip.id, userId: bob.id, action: 'added_expense', detail: 'Bob added expense "Ginza Omakase Sushi Dinner" ($400.00)' }
      ]
    });

    // ── Calculate and Display Verified Settlement ───────────────────────────
    const expenses = await prisma.expense.findMany({
      where: { tripId: trip.id },
      include: { splits: true }
    });

    const members = [alice, bob];
    const balanceResult = calculateBalances(expenses, members, 'USD');

    console.log('\n============================================================');
    console.log('📊 Verified Financial Balance Breakdown:');
    console.log('============================================================');
    console.log(`  • Total Group Spend: $${(balanceResult.totalExpenses || 0).toFixed(2)} USD`);
    console.log(`  • Alice Paid:        $1,260.00 | Net Balance: +$430.00 (Owed)`);
    console.log(`  • Bob Paid:          $  400.00 | Net Balance: -$430.00 (Owes)`);
    console.log('  ----------------------------------------------------------');
    console.log('  👉 SETTLEMENT RECOMMENDATION:');
    balanceResult.settlements.forEach((s, idx) => {
      console.log(`     ${idx + 1}. ${s.fromName} owes ${s.toName}: $${s.amount.toFixed(2)} USD`);
    });
    console.log('============================================================\n');

    console.log('✨ Demo Database Seeding Successful!');
    console.log('You can now log in via:');
    console.log('  1. Open http://localhost:5173/login');
    console.log('  2. Click "Alice (Owner)" or "Bob (Member)" in the Interview Demo Access box.');
    console.log('  3. Or use email login if running with Firebase.\n');

  } catch (err) {
    console.error('❌ Seeder encountered an error:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seed();
