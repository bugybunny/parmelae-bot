import { ReplyStrategy } from '../ReplyStrategy';
import TelegramBot from 'node-telegram-bot-api';
import { injectable } from 'inversify';
import assert from 'assert';
import { Sticker } from '../Sticker';
import { TelegramService } from '../TelegramService';

/** Possible messages. %u will be replaced with the user’s first name. */
const MESSAGES = [
  'Ich grüsse Sie, %u',
  'Herzlich willkommen, %u!',
  'Ah, %u, ich freue mich, dass Sie hier sind.',
  'Neue Wähler! %u, willkommen.',
  'Es freut mich, dass Sie hier sind, %u.',
  'Sie würden mich doch auch wählen, %u, oder? Willkommen!',
  new Sticker(
    'CAACAgQAAxkBAAEDe-9hHCedKTkqD5q28fNC_QPskmoeggACCQADGzHQB7YWKGObHwqcIAQ',
  ),
  new Sticker(
    'CAACAgQAAxkBAAEDe_FhHChKNUTKx7ClLPi8LnVqgBoWiwACFwADGzHQB5n_p7uFvNX5IAQ',
  ),
  new Sticker(
    'CAACAgQAAxkBAAEDe_NhHChfR2GXOEgazyGQMcBgh3-N2QACIgADGzHQB1MGbzrur3htIAQ',
  ),
  new Sticker(
    'CAACAgQAAxkBAAEDe_lhHCh9Kdw_A0QQb2bFMZ1iXirfswACQAADGzHQBzQQuA1tKXrKIAQ',
  ),
  new Sticker(
    'CAACAgQAAxkBAAEDfAFhHCiX1bMBfca_9nNZD2buqsH2egACSgADGzHQB5xKfgjgIlcIIAQ',
  ),
  new Sticker(
    'CAACAgQAAxkBAAEDfAdhHCivPudpZv2nvYcOywciVkGdNwACPwADmu78Apk-SGoCcKTzIAQ',
  ),
];

/** Welcomes new chat members. */
@injectable()
export class NewMembersReplyStrategy implements ReplyStrategy {
  constructor(private readonly telegram: TelegramService) {}

  willHandle(message: TelegramBot.Message): boolean {
    if (message.new_chat_members === undefined) {
      return false;
    }

    return message.new_chat_members.length >= 1;
  }

  async handle(message: TelegramBot.Message): Promise<void> {
    assert(message.new_chat_members);

    const promises = message.new_chat_members.map((user) => {
      let randomMessage = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
      if (this.isString(randomMessage)) {
        randomMessage = randomMessage.replace(/%u/, user.first_name);
      }
      return this.telegram.reply(randomMessage, message);
    });
    await Promise.all(promises);
  }

  private isString(variable: string | Sticker): variable is string {
    return typeof variable === 'string';
  }
}
