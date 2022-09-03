
import {
    Message,
    Update,
    User,
} from 'typegram';

export type BaseMessage = Update.New &
Update.NonChannel &
Message & {
    text?: string;
    forward_from?: User;
    voice?: unknown;
    sticker?: unknown;
    document?: unknown;
    photo?: unknown[];
    caption: string;
};

export type TgMessage = BaseMessage & {
    reply_to_message?: BaseMessage;
};
