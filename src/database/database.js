const path = require('path')
const config = require('../config')
const sqlite = require("sqlite3").verbose()
const db = new sqlite.Database(
  path.join(__dirname, '../', config.dbFile)
)

const getTableColumns = (table) => {
  return new Promise((resolve, reject) => {
    db.all(`PRAGMA table_info(${table});`, function (error, rows) {
      if (error) {
        reject(error)
        return
      }
      resolve(rows.map((r) => r.name))
    })
  })
}

const addColumnIfMissing = async (table, column, definition) => {
  const cols = await getTableColumns(table)
  if (cols.includes(column)) return

  await new Promise((resolve, reject) => {
    db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`, function (error) {
      if (error) {
        reject(error)
        return
      }
      resolve(true)
    })
  })
}

const createTables = async () => {

  // Define separate SQL statements for each table creation
  const queries = [
    `
    CREATE TABLE IF NOT EXISTS "ads" (
        "id"            INTEGER NOT NULL UNIQUE,
        "searchTerm"    TEXT NOT NULL,
        "title"	        TEXT NOT NULL,
        "price"         INTEGER NOT NULL,
        "url"           TEXT NOT NULL,
        "created"       TEXT NOT NULL,
        "lastUpdate"    TEXT NOT NULL
    );`,

    `CREATE TABLE IF NOT EXISTS "logs" (
        "id"            INTEGER NOT NULL UNIQUE,
        "url"           TEXT NOT NULL,  
        "adsFound"      INTEGER NOT NULL, 
        "averagePrice"  NUMERIC NOT NULL,
        "minPrice"      NUMERIC NOT NULL,
        "maxPrice"      NUMERIC NOT NULL, 
        "created"       TEXT NOT NULL,
        PRIMARY KEY("id" AUTOINCREMENT)
    );`
  ];

  return new Promise(function(resolve, reject) {
    // Iterate through the array of queries and execute them one by one
    const executeQuery = (index) => {
      if (index === queries.length) {
        resolve(true); // All queries have been executed
        return;
      }

      db.run(queries[index], function(error) {
        if (error) {
          reject(error);
          return;
        }

        // Execute the next query in the array
        executeQuery(index + 1);
      });
    };

    // Start executing the queries from index 0
    executeQuery(0);
  }).then(async () => {
    // Schema evolution: add optional statistical columns to logs
    await addColumnIfMissing("logs", "medianPrice", "NUMERIC")
    await addColumnIfMissing("logs", "modePrice", "NUMERIC")
    await addColumnIfMissing("logs", "modalIntervalStart", "NUMERIC")
    await addColumnIfMissing("logs", "modalIntervalEnd", "NUMERIC")
    await addColumnIfMissing("logs", "modalIntervalWidth", "NUMERIC")
    await addColumnIfMissing("logs", "modalIntervalCount", "INTEGER")
    await addColumnIfMissing("logs", "modalTop3BinsJson", "TEXT")
    await addColumnIfMissing("logs", "goodPrice", "NUMERIC")
    await addColumnIfMissing("logs", "goodPriceType", "TEXT")
    await addColumnIfMissing("logs", "stdDevPrice", "NUMERIC")
    await addColumnIfMissing("logs", "cvPrice", "NUMERIC")
    await addColumnIfMissing("logs", "sampleSize", "INTEGER")
    return true
  })
}

module.exports = {
  db,
  createTables
}
