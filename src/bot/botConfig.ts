import {Telegraf} from 'telegraf';

import {Config} from '../config';

import {BotStrategies} from './botStrategies';

export class BotConfig {
    private readonly telegramBot = new Telegraf(Config.botToken);
    constructor() {
        this.InitializeStrategies();
        this.telegramBot.launch();
    }

    public InitializeStrategies() {
        new BotStrategies(
            this.telegramBot
        ).Initialize();
    }
}
