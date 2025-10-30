const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'data/ads.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Could not connect to database:', err);
    process.exit(1);
  } else {
    console.log('✅ Connected to SQLite database:', dbPath);
  }
});

function columnExists(columns, name) {
  return columns.some((c) => c.name === name);
}

db.serialize(() => {
  db.all('PRAGMA table_info(ads)', (err, columns) => {
    if (err) {
      console.error('❌ Error reading table schema:', err);
      db.close();
      process.exit(1);
    }

    const hasIsActive = columnExists(columns, 'isActive');
    const hasMissingCount = columnExists(columns, 'missingCount');

    const steps = [];

    if (!hasIsActive) {
      steps.push({
        sql: 'ALTER TABLE ads ADD COLUMN isActive INTEGER DEFAULT 1',
        msg: 'Added column isActive (DEFAULT 1)'
      });
    }

    if (!hasMissingCount) {
      steps.push({
        sql: 'ALTER TABLE ads ADD COLUMN missingCount INTEGER DEFAULT 0',
        msg: 'Added column missingCount (DEFAULT 0)'
      });
    }

    const runNext = () => {
      const step = steps.shift();
      if (!step) {
        // Backfill to ensure non-null values
        const backfill = [];
        if (!hasIsActive) backfill.push({ sql: 'UPDATE ads SET isActive = 1 WHERE isActive IS NULL' });
        if (!hasMissingCount) backfill.push({ sql: 'UPDATE ads SET missingCount = 0 WHERE missingCount IS NULL' });

        const runBackfill = () => {
          const s = backfill.shift();
          if (!s) {
            // Verify
            db.all('PRAGMA table_info(ads)', (e2, cols2) => {
              if (e2) {
                console.error('❌ Error verifying schema:', e2);
              } else {
                console.log('\n📋 Current table structure:');
                cols2.forEach((col) => console.log(`  - ${col.name} (${col.type})`));
              }
              db.close();
              console.log('\n✅ Migration completed.');
            });
            return;
          }
          db.run(s.sql, (e) => {
            if (e) console.error('⚠️ Backfill error:', e.message);
            runBackfill();
          });
        };

        runBackfill();
        return;
      }

      db.run(step.sql, (e) => {
        if (e) {
          // If column already exists (race), just warn and continue
          console.warn('⚠️ Step warning:', e.message);
        } else {
          console.log('🔧', step.msg);
        }
        runNext();
      });
    };

    if (steps.length === 0) {
      console.log('ℹ️ Columns already present. No migration needed.');
      db.close();
      return;
    }

    runNext();
  });
});


