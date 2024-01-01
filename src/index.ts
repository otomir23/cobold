import { env } from "@/env"
import { Bot } from "grammy"
import { canInteract, handleMediaDownload, handleMediaRequest } from "@/handler"
import { randomUUID } from "node:crypto"

const errorEmoticons = ["( • ᴖ • ｡)", "(ᴗ_ ᴗ。)", "(,,>﹏<,,)"]
const formatError = (message: string) => {
    const emoticon = errorEmoticons[Math.floor(Math.random() * errorEmoticons.length)]
    return `error: ${message} ${emoticon}`
}

const bot = new Bot(env.BOT_TOKEN)

bot.catch((err) => {
    console.error("Unhandled Error:", err)
})

bot.command("start", ctx =>
    ctx.reply("hii! just send me a link and i'll download it. (ᵔᵕᵔ)◜"),
)

bot.on("message", async (ctx) => {
    if (ctx.message.chat.type !== "private") return

    const result = await handleMediaRequest(ctx.message.text ?? "", ctx.message.from.id)

    if (!result.success)
        return await ctx.reply(formatError(result.error))

    await ctx.replyWithPhoto(result.result.image, {
        reply_markup: result.result.replyMarkup,
        caption: result.result.caption,
    })
})

bot.on("inline_query", async (ctx) => {
    const result = await handleMediaRequest(ctx.inlineQuery.query, ctx.inlineQuery.from.id)

    if (!result.success)
        return await ctx.answerInlineQuery([{
            id: randomUUID(),
            type: "article",
            title: "error",
            description: result.error,
            input_message_content: {
                message_text: formatError(result.error),
            },
        }])

    await ctx.answerInlineQuery([{
        id: result.result.id,
        type: "photo",
        photo_url: env.SELECT_TYPE_PHOTO_URL,
        thumbnail_url: env.SELECT_TYPE_PHOTO_URL,
        title: "download from provided url",
        reply_markup: result.result.replyMarkup,
        caption: result.result.caption,
    }], {
        cache_time: 0,
    })
})

bot.on("callback_query", async (ctx) => {
    // TODO Remove when inlines are fixed
    if (ctx.inlineMessageId) return await ctx.answerCallbackQuery({
        text: formatError("inline queries are broken, download via bot dms for now"),
    })

    const [outputType, requestId] = (ctx.callbackQuery.data ?? "").split(":")
    if (!outputType || !requestId || !canInteract(requestId, ctx.callbackQuery.from.id))
        return await ctx.answerCallbackQuery({
            text: "looks like this button is not yours (¬_¬\")",
        })

    await ctx.editMessageReplyMarkup(undefined)
    await ctx.editMessageCaption({
        caption: "loading... (˶ᵔ ᵕ ᵔ˶)",
    })

    const result = await handleMediaDownload(outputType, requestId)

    if (!result.success)
        return await ctx.editMessageCaption({
            caption: formatError(result.error),
        })

    await ctx.editMessageMedia(result.result)
})

bot.start().then()