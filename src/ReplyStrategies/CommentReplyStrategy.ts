import assert from "assert";
import TelegramBot from "node-telegram-bot-api";
import {inject, singleton} from "tsyringe";
import {AllowlistedReplyStrategy} from "../AllowlistedReplyStrategy";
import {CommandService} from "../CommandService";
import {Config} from "../Config";
import {Command} from "../Command";

/**
 * Comments a message (/comment command) when somebody replies with (just) the bot’s name.
 */
@singleton()
export class CommentReplyStrategy extends AllowlistedReplyStrategy {
    private readonly onlyUsernameRegex: RegExp;

    constructor(
        private readonly commandService: CommandService,
        @inject('Config') config: Config,
    ) {
        super(config);
        this.onlyUsernameRegex = new RegExp(`^@\w*${this.config.username}\w*$`, 'is');
    }

    willHandleAllowlisted(message: TelegramBot.Message): boolean {
        return message.text !== undefined && this.onlyUsernameRegex.test(message.text);
    }

    handle(message: TelegramBot.Message): void {
        assert(message.text !== undefined);

        this.commandService.execute(Command.Comment, message);
    }
}