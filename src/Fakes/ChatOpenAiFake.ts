import { BaseChatModel } from 'langchain/chat_models/base';
import { BaseMessage, ChatResult } from 'langchain/schema';

export class ChatOpenAiFake extends BaseChatModel {
  request?: BaseMessage[];

  constructor(private readonly response?: BaseMessage) {
    super({});
  }

  _llmType(): string {
    return 'openai-fake';
  }

  _combineLLMOutput(): object {
    return {};
  }

  _generate(messages: BaseMessage[]): Promise<ChatResult> {
    this.request = messages;

    return Promise.resolve({
      generations: this.response
        ? [
            {
              text: this.response.text,
              message: this.response,
            },
          ]
        : [],
    });
  }
}
