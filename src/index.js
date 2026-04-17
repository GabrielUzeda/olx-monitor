const config = require("./config");
const { initializeCycleTLS, exitCycleTLS } = require("./components/CycleTls");
const $logger = require("./components/Logger");
const { scraper } = require("./components/Scraper");
const { createTables } = require("./database/database.js");

/**
 * Executes the scraping process for all configured URLs
 */
const runScraper = async () => {
  $logger.info(`Starting scraping cycle for ${config.urls.length} URLs...`);
  
  for (const url of config.urls) {
    try {
      await scraper(url);
    } catch (error) {
      $logger.error(`Error scraping ${url}: ${error.message}`);
    }
  }
  
  $logger.info("Scraping cycle finished.");
};

/**
 * Main application entry point
 */
const main = async () => {
  try {
    $logger.info("OLX Monitor started");
    
    // Initialize resources
    await createTables();
    await initializeCycleTLS();
    
    // Immediate execution
    await runScraper();

    // Native Interval (minutes)
    const intervalMinutes = parseInt(config.interval) || 5;
    
    setInterval(runScraper, intervalMinutes * 60 * 1000);
    
    $logger.info(`Scheduler initialized. Running every ${intervalMinutes} minutes.`);
  } catch (criticalError) {
    $logger.error(`Critical startup error: ${criticalError.message}`);
    process.exit(1);
  }
};

// Graceful shutdown handling
const shutdown = async (signal) => {
  $logger.info(`${signal} received. Shutting down gracefully...`);
  try {
    await exitCycleTLS();
    $logger.info("CycleTLS closed.");
    process.exit(0);
  } catch (error) {
    $logger.error(`Error during shutdown: ${error.message}`);
    process.exit(1);
  }
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

main();
