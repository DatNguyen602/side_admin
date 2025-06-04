// backup.js
const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function backupDatabase() {
  try {
    const uri = 'mongodb://127.0.0.1:27017';
    const dbName = 'mydb';
    const backupDir = './backup';

    // Tạo thư mục backup nếu chưa tồn tại
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    console.log('Bắt đầu backup dữ liệu...', new Date());

    const client = await MongoClient.connect(uri, { useUnifiedTopology: true });
    const db = client.db(dbName);
    
    // Lấy danh sách các collection trong database
    const collections = await db.listCollections().toArray();
    
    // Backup từng collection
    for (let collInfo of collections) {
      const collName = collInfo.name;
      const collection = db.collection(collName);
      console.log(`Backup collection: ${collName}`);
      
      // Lấy toàn bộ dữ liệu của collection
      const data = await collection.find({}).toArray();
      
      // Ghi dữ liệu vào file JSON
      const filePath = path.join(backupDir, `${collName}.json`);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
      
      console.log(`Collection ${collName} đã được backup vào file: ${filePath}`);
    }
    
    await client.close();
    console.log('Backup hoàn tất tại:', new Date());
  } catch (error) {
    console.error('Lỗi trong quá trình backup:', error);
  }
}

backupDatabase();
