// For Sentry setup
const rootDirectory = __dirname || process.cwd();

import 'reflect-metadata';
import {Config} from './Config';
import {Bot} from './Bot';
import TelegramBot from 'node-telegram-bot-api';
import {Configuration, OpenAIApi} from 'openai';
import {container} from 'tsyringe';
import {PrismaClient} from '@prisma/client';
import {Octokit} from 'octokit';
import * as Sentry from '@sentry/node';
import {RewriteFrames} from "@sentry/integrations";

const config = container.resolve(Config);
if (config.sentryDsn) {
    Sentry.init({
        dsn: config.sentryDsn,
        tracesSampleRate: 0.1,
        integrations: [
            new RewriteFrames({
                root: rootDirectory,
            }),
        ],
    });
}

container.register(Octokit, {
    useValue: new Octokit({
        auth: config.gitHubPersonalAccessToken ?? undefined,
        userAgent: 'parmelae-bot',
        timeZone: 'Europe/Zurich',
    })
});
container.register(OpenAIApi, {
    useValue: new OpenAIApi(new Configuration({
        apiKey: config.openAiKey
    }))
});
container.register(PrismaClient, {useValue: new PrismaClient()});
container.register(TelegramBot, {useValue: new TelegramBot(config.telegramToken, {polling: true})});

const bot = container.resolve(Bot);
bot.start();