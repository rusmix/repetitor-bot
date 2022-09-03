import { TgMessage } from "./types/index";

import { Context, Markup, Telegraf } from "telegraf";

import { Config } from "../config";
import { Groups } from "../instances/group/model";
import { Users } from "../instances/user/model";
import { State } from "../instances/user/constants";

export class BotStrategies {
  constructor(private readonly bot: Telegraf<Context>) {}

  Initialize() {
    this.bot.start((ctx: Context) => this.start(ctx));

    this.bot.hears(/\/set_this_group_as_support/, (ctx: Context) =>
      this.setThisGroupAsSupport(ctx)
    );

    this.bot.hears(/\/clients/, (ctx: Context) => this.getClients(ctx));

    this.bot.hears(/\/send/, (ctx: Context) => this.send(ctx));

    this.bot.hears(/\/broadcast/, (ctx: Context) => this.broadcast(ctx));

    this.bot.on("message", (ctx: Context) => this.handleMessage(ctx));

    // this.clearBD();

    console.log("BotStrategies initialization ended.");
  }

  private async clearBD() {
    await Users.remove();
    await Groups.remove();
  }

  private validatePhone(phone){
    let regex = /^(\+7|7|8)?[\s\-]?\(?[489][0-9]{2}\)?[\s\-]?[0-9]{3}[\s\-]?[0-9]{2}[\s\-]?[0-9]{2}$/;
    return regex.test(phone);
   }

  private async send(ctx) {
    const message = ctx.message as TgMessage;
    const chatId = message.chat.id;
    let text = undefined;
    try {
      if (!(await this.checkFromGroup(chatId))) return;

      let destinationChatId = undefined;
      if ("text" in message) destinationChatId = message.text.split(" ")[1];
      if ("caption" in message)
        destinationChatId = message.caption.split(" ")[1];

      const msg = await this.bot.telegram.copyMessage(
        destinationChatId,
        chatId,
        message.message_id
      );

      console.log(msg);
      if ("text" in message) {
        text = message.text.replace(`/send ${destinationChatId}`, "\n");
        await this.bot.telegram.editMessageText(
          destinationChatId,
          msg.message_id,
          undefined,
          text
        );
      } else {
        text = message.caption.replace(`/send ${destinationChatId}`, "\n");
        await this.bot.telegram.editMessageCaption(
          destinationChatId,
          msg.message_id,
          undefined,
          text
        );
      }
    } catch (e) {
      this.errorHandler(e, chatId);
    }
  }

  private async getClients(ctx: Context) {
    const message = ctx.message as TgMessage;
    const chatId = message.chat.id;
    if (!(await this.checkFromGroup(chatId))) return;
    try {
      const res = await Users.find();
      let clients = [];
      for (let i = 0; i < res.length; i++) {
        clients.push({
          username: res[i].username,
          name: res[i].name,
          telegramId: res[i].telegramId,
          phone: res[i].phone,
        });
      }
      let text = "Вот список пользователей:\n\n";
      for (let i = 0; i < res.length; i++) {
        if (clients[i].username === undefined)
          text =
            text +
            (i + 1) +
            ") Ссылка отсутствует.\nТелеграм ID: " +
            clients[i].telegramId +
            "\n" +
            "Имя: " +
            clients[i].name +
            "\n" +
            "Номер: " +
            clients[i].phone +
            "\n\n";
        else
          text =
            text +
            (i + 1) +
            ") Ссылка: t.me/" +
            clients[i].username +
            "\nТелеграм ID: " +
            clients[i].telegramId +
            "\n" +
            "Имя: " +
            clients[i].name +
            "\n" +
            "Номер: " +
            clients[i].phone +
            "\n\n";
      }
      // console.log(text);
      // console.log(clients);
      await this.bot.telegram.sendMessage(chatId, text);
    } catch (e) {
      console.log(e);
    }
  }

  private async checkFromGroup(chatId) {
    const res = await Groups.findOne({ telegramId: chatId });
    // console.log(res);
    if (!res) return false;
    return true;
  }

  private async stateHandler(ctx: Context) {
    const message = ctx.message as TgMessage;
    if (await this.checkFromGroup(message.chat.id)) return;
    // console.log(message);
    const userId = message.from.id;
    try {
      const user = await Users.findOne({ telegramId: userId });
      console.log(user);
      if (!user) this.start(ctx);
      switch (user.state) {
        case State.start:
          ctx.reply(
            "Добро пожаловать! Для того, чтобы мы поняли, кто Вы, пройдите небольшую регистрацию🙂\n\nНапишите имя и фамилию:"
          );
          const res = await Users.updateOne(
            { _id: user._id },
            { $set: { state: State.sendName } }
          );
          console.log("стейт стал сendNamе  ", res);
          break;
        case State.sendName:
          const res1 = await Users.updateOne(
            { _id: user._id },
            { $set: { name: message.text, state: State.sendPhone } }
          );
          console.log("стейт стал сendphone  ", res1);
          ctx.reply("А теперь напишите свой номер телефона:");
          break;
        case State.sendPhone:
            if (!this.validatePhone(message.text)){
                ctx.reply("Введите корректный номер телефона🤨");
                return;
              }
          await Users.updateOne(
            { _id: user._id },
            { $set: { phone: message.text, state: State.default } }
          );
          ctx.reply(
            "Регистрация успешно пройдена! Для того, чтобы связаться с нами, пишите в этот чат. Ответим как можно скорее!"
          );
          break;
        case State.default:
          this.handleMessageFromUser(ctx);
          break;
      }
    } catch (e) {
      ctx.reply("Где-то что-то пошло не так, попробуйте позже😔");
    }
  }

  private async start(ctx: Context) {
    try {
      // console.log(ctx.message);
      const message = ctx.message as TgMessage;

      if (message.chat.id < 0) return;

      const group = await Groups.findGroupWithMinimumUsers();

      console.log(group);
      if (!group)
        ctx.reply(
          "Не удаётся найти группу для поддержки, попробуйте написать /start позже"
        );
      else {
        if (await Users.findOne({ telegramId: message.chat.id })) return;
        await Users.createIfNotExists(
          {
            telegramId: message.from.id as unknown as string,
            username: message.from?.username,
            group: undefined,
            firstName: message.from?.first_name,
            lastName: message.from?.last_name,
            name: undefined,
            phone: undefined,
            state: State.start,
          },
          group._id
        );
        this.stateHandler(ctx);
      }

      return;
    } catch (e) {
      console.log(e);
      ctx.reply("Unknown error accured: ", e.message);
    }
  }

  private async getUserIdFromReply(ctx: Context): Promise<string> {
    const message = ctx.message as TgMessage;

    try {
      if ("forward_sender_name" in message.reply_to_message) {
        const firstName =
          message.reply_to_message.forward_sender_name.split(" ")[0];

        const lastName =
          message.reply_to_message.forward_sender_name.split(" ")[1];
        let user = await Users.findOne({
          firstName,
          lastName,
        });

        if (!user) {
          user = await Users.findOne({
            firstName: `${firstName} ${lastName}`,
          });
        }

        if (!user) {
          user = await Users.findOne({
            lastName: `${firstName} ${lastName}`,
          });
        }

        return user.telegramId;
      } else return String(message.reply_to_message.forward_from?.id);
    } catch (e) {
      console.log(e);
    }
  }

  private async setThisGroupAsSupport(ctx: Context) {
    const message = ctx.message as TgMessage;

    try {
      if (message?.text.split(" ")[1] !== Config.botSecret)
        return ctx.reply("Неверный пароль");

      const newGroup = await Groups.createIfNotExists(
        String(ctx.message.chat.id)
      );

      if (!newGroup)
        return ctx.reply("Эта группа уже является группой поддержки");

      return ctx.reply("Эта группа успешно установлена как группа поддержки");
    } catch (e) {
      console.log(e);
      ctx.reply("Unknown error accured. ");
    }
  }

  private async handleMessage(ctx: Context) {
    try {
      //console.log(ctx.message);
      const chatId = ctx.message.chat.id;
      const isGroup = await this.checkFromGroup(chatId);

      if (isGroup) return this.handleMessageFromSupport(ctx);

      return this.stateHandler(ctx);
    } catch (e) {
      console.log(e);
      ctx.reply("Unknown error accured: ", e.message);
    }
  }

  private async errorHandler(e, chatId) {
    try {
      console.log(e);
      if (e.response.error_code == 403) {
        await this.bot.telegram.sendMessage(
          chatId,
          "Сообщение не доставлено, пользователь заблокировал бота, записи в базе данных исправлены"
        );
        await Users.deleteOne({ telegramId: e.on.payload.chat_id });
      } else
        await this.bot.telegram.sendMessage(
          chatId,
          "Сообщение не доставлено, что-то пошло не так."
        );
    } catch (e) {
      console.log(e);
    }
  }

  private async handleMessageFromSupport(ctx: Context) {
    const message = ctx.message as TgMessage;
    console.log("from support1 ____", message);
    if (message?.text.split("")[0] === "/") return;
    if (!message?.reply_to_message) return;
    if (message.reply_to_message.from.id !== this.bot.botInfo.id) return;

    console.log("from support ____", message);

    try {
      const userId = await this.getUserIdFromReply(ctx);

      await this.bot.telegram.copyMessage(
        userId,
        message.chat.id,
        message.message_id
      );
    } catch (e) {
      this.errorHandler(e, message.chat.id);
    }
  }

  private async handleMessageFromUser(ctx: Context) {
    try {
      const message = ctx.message as TgMessage;
      console.log("enter");
      if ("text" in message && message.text.split("")[0] === "/") return;
      if ("caption" in message && message.caption.split("")[0] === "/")
return;
      const userId = String((ctx.message as TgMessage).from.id);
        const date = new Date().getDay();
        if (date === 6 || date === 7 ) ctx.reply("Ваше сообщение доставлено, но Марк на выходных до понедельника и сможет ответить чуть-чуть позже 🙂")
      console.log(userId);
      console.log(await Users.find());

      const userGroupId = await Users.getTelegramGroupId(userId);

      console.log(userGroupId);
      if (userGroupId == undefined)
        return ctx.reply("Возникла какая-то проблема");
      const text = await this.getInfo(userId);
      await this.bot.telegram.sendMessage(userGroupId, text);
      return ctx.forwardMessage(userGroupId);
    } catch (e) {
      console.log(e);
    }
  }

  private async getInfo(userTelegramId: string): Promise<string> {
    const user = await Users.findOne({ telegramId: userTelegramId });
    let text = `Cообщение от: ${user.name}\n${user.phone} 👇🏻`;
    return text;
  }

  private async broadcast(ctx: Context) {
    const message = ctx.message as TgMessage;
    const chatId = message.chat.id;
    if (!(await this.checkFromGroup(chatId))) return;
    console.log(message.text);
    try {
      // await Users.remove();
      const res = await Users.findAllTelegramIds();
      if (res.length === 0) {
        await this.bot.telegram.sendMessage(chatId, "Никто Вас не слышит.");
        return;
      }
      console.log(res);
      let text = undefined;

      //   if ("text" in message) {
      //     text = message.text.replace("/broadcast", "\n");
      //   } else text = message.caption.replace("/broadcast", "\n");

      // text =
      //   message.text.replace("/broadcast", "") ||
      //   message.caption.replace("/broadcast", "");
      for (var i = 0; i < res.length; i++) {
        const msg = await this.bot.telegram.copyMessage(
          res[i],
          chatId,
          message.message_id
        );
        console.log(msg);
        if ("text" in message) {
          text = message.text.replace("/broadcast", "\n");
          await this.bot.telegram.editMessageText(
            res[i],
            msg.message_id,
            undefined,
            text
          );
        } else {
          text = message.caption.replace("/broadcast", "\n");
          await this.bot.telegram.editMessageCaption(
            res[i],
            msg.message_id,
            undefined,
            text
          );
        }
      }
      // await this.bot.telegram.copyMessage(userId, config.adminId, msgId);
    } catch (e) {
      this.errorHandler(e, chatId);
      console.log(e);
    }
  }
}
