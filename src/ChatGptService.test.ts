import { UserMessagePromptTemplate } from "./ChatGptService";
import { ChatGptRoles } from "./MessageGenerators/ChatGptMessage";
import { ChatGptModels, GptModelsProvider } from "./GptModelsProvider";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { AIChatMessage, HumanChatMessage, SystemChatMessage } from "langchain/schema";
import {
    AIMessagePromptTemplate,
    ChatPromptTemplate,
    SystemMessagePromptTemplate
} from "langchain/prompts";
import { ChatGptServiceFakeFactory, ChatOpenAiFake } from "./Fakes/ChatGptServiceFakeFactory";

test('generate message', async () => {
    const chatOpenAiFake = new ChatOpenAiFake(new AIChatMessage('completion'));
    const sut = ChatGptServiceFakeFactory.create(
        new GptModelsProvider(
            {
                chatGpt: chatOpenAiFake as unknown as ChatOpenAI,
                chatGptStrict: undefined as any,
                gpt4: undefined as any,
                gpt4Strict: undefined as any,
                embeddings: undefined as any,
            }),
    );
    const prompt = ChatPromptTemplate.fromPromptMessages([
        SystemMessagePromptTemplate.fromTemplate('System Message'),
        AIMessagePromptTemplate.fromTemplate('Assistant Message'),
        UserMessagePromptTemplate.fromNameAndTemplate('Username', '{text}'),
    ]);
    const response = await sut.generate(prompt, ChatGptModels.ChatGpt, {
        text: 'User Message',
    });

    expect(response).toEqual({
        role: ChatGptRoles.Assistant,
        content: 'completion',
    });
    const humanMessage = new HumanChatMessage('User Message');
    humanMessage.name = 'Username';
    expect(chatOpenAiFake.request).toEqual([
        new SystemChatMessage('System Message'),
        new AIChatMessage('Assistant Message'),
        humanMessage,
    ]);
});
