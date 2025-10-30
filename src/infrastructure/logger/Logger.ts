import { ILogger } from '../../core/interfaces/ILogger';
import * as SimpleNodeLogger from 'simple-node-logger';
import { config } from '../../config';

export class Logger implements ILogger {
  private logger = SimpleNodeLogger.createSimpleLogger(config.logger);

  info(message: string): void {
    this.logger.info(message);
  }
  error(message: string | Error): void {
    this.logger.error(message instanceof Error ? message.stack || message.message : message);
  }
  debug(message: string): void {
    this.logger.debug(message);
  }
} 