import '@abraham/reflection';
import { Container } from 'inversify';
import { GptModelsProvider } from './GptModelsProvider';
import { ChatOpenAI } from 'langchain/chat_models/openai';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import { Octokit } from 'octokit';
import { Configuration, OpenAIApi } from 'openai';
import { PrismaClient } from '@prisma/client';
import { Config } from './Config';
import { Telegraf } from 'telegraf';

const container = new Container({
  defaultScope: 'Singleton',
  autoBindInjectable: true,
  skipBaseClassChecks: true,
});

container.bind(GptModelsProvider).toDynamicValue(
  () =>
    new GptModelsProvider({
      chatGpt: new ChatOpenAI({
        modelName: 'gpt-3.5-turbo',
        verbose: true,
      }),
      chatGptStrict: new ChatOpenAI({
        modelName: 'gpt-3.5-turbo',
        temperature: 0,
        verbose: true,
      }),
      gpt4: new ChatOpenAI({
        modelName: 'gpt-4',
        verbose: true,
      }),
      gpt4Strict: new ChatOpenAI({
        modelName: 'gpt-4',
        temperature: 0,
        verbose: true,
      }),
      embeddings: new OpenAIEmbeddings(),
    }),
);
container.bind(Octokit).toDynamicValue(
  (context) =>
    new Octokit({
      auth: context.container.get(Config).gitHubPersonalAccessToken,
      userAgent: 'parmelae-bot',
      timeZone: 'Europe/Zurich',
    }),
);
container.bind(OpenAIApi).toDynamicValue(
  (context) =>
    new OpenAIApi(
      new Configuration({
        apiKey: context.container.get(Config).openAiKey,
      }),
    ),
);
container.bind(PrismaClient).toDynamicValue(() => new PrismaClient());
container
  .bind(Telegraf)
  .toDynamicValue(
    (context) => new Telegraf(context.container.get(Config).telegramToken),
  );

export default container;
