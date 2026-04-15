const fs = require('fs/promises');
const path = require('path');
const { MongoClient } = require('../Cardiologue_bc/node_modules/mongodb/mongodb');
const { EJSON } = require('bson');

const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const dbName = process.env.MONGODB_DB_NAME || 'cardiologue';
const inputDir = __dirname;

function getCollectionName(fileName) {
  const prefix = `${dbName}.`;
  const suffix = '.json';

  if (!fileName.startsWith(prefix) || !fileName.endsWith(suffix)) {
    return null;
  }

  return fileName.slice(prefix.length, -suffix.length);
}

async function ensureCollectionExists(db, collectionName) {
  const existing = await db.listCollections({ name: collectionName }, { nameOnly: true }).toArray();

  if (existing.length === 0) {
    await db.createCollection(collectionName);
  }
}

async function importAllCollections() {
  const client = new MongoClient(mongoUri);

  try {
    const fileNames = await fs.readdir(inputDir);
    const backupFiles = fileNames.filter((fileName) => getCollectionName(fileName));

    if (backupFiles.length === 0) {
      console.log(`No backup files found for database "${dbName}" in ${inputDir}.`);
      return;
    }

    await client.connect();

    const db = client.db(dbName);

    for (const fileName of backupFiles) {
      const collectionName = getCollectionName(fileName);
      const filePath = path.join(inputDir, fileName);
      const rawContent = await fs.readFile(filePath, 'utf8');
      const docs = EJSON.parse(rawContent);

      if (!Array.isArray(docs)) {
        throw new Error(`File "${fileName}" does not contain a JSON array.`);
      }

      await ensureCollectionExists(db, collectionName);

      const collection = db.collection(collectionName);
      await collection.deleteMany({});

      if (docs.length > 0) {
        await collection.insertMany(docs, { ordered: true });
      }

      console.log(`Imported ${docs.length} document(s) into "${collectionName}" from ${fileName}.`);
    }

    console.log(`Import completed for ${backupFiles.length} collection(s) into "${dbName}".`);
  } finally {
    await client.close();
  }
}

importAllCollections().catch((error) => {
  console.error('Import failed:', error);
  process.exitCode = 1;
});
