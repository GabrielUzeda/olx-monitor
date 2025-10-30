export interface ILogger {
  info(message: string): void;
  error(message: string | Error): void;
  debug(message: string): void;
} 