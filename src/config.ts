import 'dotenv/config';

export class Config {
    public static mongoUrl: string = process.env.MONGO_URL as string
    public static botSecret: string = process.env.BOT_SECRET as string
    public static botToken: string = process.env.BOT_TOKEN as string
}
