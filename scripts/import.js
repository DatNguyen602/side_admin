// import.js
const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function importDatabase() {
  try {
    const uri = 'mongodb://127.0.0.1:27017';
    const dbName = 'mydb';
    const backupDir = './backup';

    const client = await MongoClient.connect(uri, { useUnifiedTopology: true });
    const db = client.db(dbName);

    // Đọc danh sách file trong thư mục backup
    const files = fs.readdirSync(backupDir);
    
    // Duyệt qua các file JSON backup
    for (let fileName of files) {
      // Chỉ xử lý các file có đuôi .json
      if (fileName.endsWith('.json')) {
        const collName = path.basename(fileName, '.json');
        const filePath = path.join(backupDir, fileName);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

        console.log(`Import ${data.length} document vào collection ${collName} từ file: ${filePath}`);

        const collection = db.collection(collName);

        // Tùy chọn: Xoá dữ liệu hiện có của collection trước khi import
        await collection.deleteMany({});
        
        // Insert lại các document từ file backup (nếu có dữ liệu)
        if (data.length > 0) {
          await collection.insertMany(data);
        }
        
        console.log(`Collection ${collName} đã được import`);
      }
    }

    await client.close();
    console.log('Import hoàn tất.');
  } catch (error) {
    console.error('Lỗi trong quá trình import:', error);
  }
}

importDatabase();
