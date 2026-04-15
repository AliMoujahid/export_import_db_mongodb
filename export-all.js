const fs = require('fs/promises');
const path = require('path');
const { MongoClient } = require('../Cardiologue_bc/node_modules/mongodb/mongodb');
const { EJSON } = require('bson');

const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const dbName = process.env.MONGODB_DB_NAME || 'cardiologue';
const outputDir = __dirname;

async function exportAllCollections() {
  const client = new MongoClient(mongoUri);

  try {
    await client.connect();

    const db = client.db(dbName);
    const collections = await db.listCollections({}, { nameOnly: true }).toArray();

    if (collections.length === 0) {
      console.log(`No collections found in database "${dbName}".`);
      return;
    }

    for (const { name } of collections) {
      const docs = await db.collection(name).find({}).toArray();
      const filePath = path.join(outputDir, `${dbName}.${name}.json`);
      const payload = EJSON.stringify(docs, null, 2, { relaxed: false });

      await fs.writeFile(filePath, payload + '\n', 'utf8');
      console.log(`Exported ${docs.length} document(s) from "${name}" to ${path.basename(filePath)}.`);
    }

    console.log(`Export completed for ${collections.length} collection(s) from "${dbName}".`);
  } finally {
    await client.close();
  }
}

exportAllCollections().catch((error) => {
  console.error('Export failed:', error);
  process.exitCode = 1;
});
