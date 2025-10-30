import { INotifier } from '../../core/interfaces/INotifier';
import { config } from '../../config';
import axios from 'axios';

export class Notifier implements INotifier {
  async sendNotification(msg: string, id?: string): Promise<void> {
    const apiUrl = `https://api.telegram.org/bot${config.telegramToken}/sendMessage?chat_id=${config.telegramChatID}&text=`;
    const encodedMsg = encodeURIComponent(msg);
    await axios.get(apiUrl + encodedMsg, { timeout: 5000 });
  }
} 