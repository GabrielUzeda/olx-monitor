export interface INotifier {
  sendNotification(msg: string, id?: string): Promise<void>;
} 