import mongoose from 'mongoose';

import {BotConfig} from './bot/botConfig';

import {Config} from './config';

const main = async () => {
    await mongoose.connect(Config.mongoUrl);
    new BotConfig();
};

main();
