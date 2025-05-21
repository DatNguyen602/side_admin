require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

// Models
const Role = require('../models/Role');
const Agency = require('../models/Agency');
const Branch = require('../models/Branch');
const User = require('../models/User');
const Key = require('../models/Key');
const Session = require('../models/Session');  // Import thêm Session model

async function seed() {
  await mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  console.log('✔ MongoDB connected');

  console.log('\n⚠ Clearing existing data...');
  await Promise.all([
    Role.deleteMany({}),
    Agency.deleteMany({}),
    Branch.deleteMany({}),
    User.deleteMany({}),
    Key.deleteMany({}),
    Session.deleteMany({})  // Xóa luôn dữ liệu cũ của Session
  ]);
  console.log('✔ All collections cleared\n');

  // 1. Seed Roles
  const rolesData = [
    {
      name: 'admin',
      permissions: [
        'users:create', 'agencies:create', 'branches:create', 'keys:create',
        'users:read', 'agencies:read', 'branches:read', 'keys:read',
        'users:update', 'agencies:update', 'branches:update',
        'users:delete', 'agencies:delete', 'branches:delete', 'keys:delete',
        'dashboard:view'
      ]
    },
    {
      name: 'manager',
      permissions: [
        'users:read', 'agencies:read', 'branches:*', 'keys:read', 'dashboard:view'
      ]
    },
    {
      name: 'agent',
      permissions: ['keys:verify']
    }
  ];
  const roles = await Role.insertMany(rolesData);
  console.log('✔ Roles seeded');

  // 2. Seed Agencies
  const agenciesData = [
    { name: 'Agency A', description: 'Chi nhánh A' },
    { name: 'Agency B', description: 'Chi nhánh B' }
  ];
  const agencies = await Agency.insertMany(agenciesData);
  console.log('✔ Agencies seeded');

  // 3. Seed Branches
  const branchesData = [
    { name: 'Branch A1', agency: agencies[0]._id, location: 'Hà Nội' },
    { name: 'Branch A2', agency: agencies[0]._id, location: 'Đà Nẵng' },
    { name: 'Branch B1', agency: agencies[1]._id, location: 'TP. Hồ Chí Minh' }
  ];
  const branches = await Branch.insertMany(branchesData);
  console.log('✔ Branches seeded');

  // 4. Seed Admin User
  const adminUsername = 'admin';
  const adminPassword = 'admin';
  // const hashedPassword = await bcrypt.hash(adminPassword, 10);
  const adminRole = roles.find(r => r.name === 'admin');
  const admin = await User.create({
    username: adminUsername,
    password: adminPassword,
    email: 'admin@example.com',  // Bổ sung email nếu schema yêu cầu
    role: adminRole._id,
    agency: agencies[0]._id
  });
  console.log(`✔ Admin user created (username: ${adminUsername}, password: ${adminPassword})`);

  // 5. Seed Keys
  const createdKeys = [];
  for (const br of branches) {
    const token = crypto.randomBytes(16).toString('hex');
    const keyDoc = await Key.create({
      token,
      branch: br._id,
      status: 'issued',
      issuedAt: new Date()
    });
    createdKeys.push(keyDoc);
    console.log(`✔ Key issued for branch ${br.name} — Token: ${token}`);
  }

  // 6. Seed Sessions (bổ sung)
  for (const key of createdKeys) {
    await Session.create({
      key: key._id,      // Trường bắt buộc
      user: admin._id,   // Gán admin làm user của session
      startedAt: new Date()
      // Các trường khác nếu cần
    });
    console.log(`✔ Session created for key: ${key.token}`);
  }

  console.log('\n✅ Seeding completed successfully');
  process.exit(0);
}

seed().catch(err => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
