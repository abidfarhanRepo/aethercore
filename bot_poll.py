#!/usr/bin/env python3
"""
Simple Telegram bot using python-telegram-bot (polling).
Features:
 - /status command
 - Forwards incoming messages to local webchat (prints to stdout; adapt to integration)
 - Can send notifications from workspace via notify_to_telegram(chat_id, text)
 - Basic interactive handlers

Install: pip install python-telegram-bot==20.7
Run: python3 bot_poll.py
"""
import json
import logging
from telegram import Update, Bot
from telegram.ext import ApplicationBuilder, CommandHandler, MessageHandler, ContextTypes, filters

# Load config
with open('telegram_config.json','r') as f:
    cfg = json.load(f)
TOKEN = cfg['bot_token']
BOT_USERNAME = cfg.get('bot_username')

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger('armbot-telegram')

# Replace this with the chat id you want to forward to (or collect dynamically)
FORWARD_TARGET = None  # e.g. a chat id or list of ids

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(f'ARMbot online. Hello, {update.effective_user.first_name}!')

async def status(update: Update, context: ContextTypes.DEFAULT_TYPE):
    # Example status; adapt to include real workspace status
    text = 'ARMbot is online. Polling mode active.'
    await update.message.reply_text(text)

async def echo_and_forward(update: Update, context: ContextTypes.DEFAULT_TYPE):
    # Echo
    if update.message.text:
        await update.message.reply_text('Got your message — forwarding to workspace.')
        # Forward to local integration: here we just log it. Replace with HTTP call or IPC.
        logger.info('Forwarded message from %s: %s', update.effective_user.username or update.effective_user.id, update.message.text)

async def notify_to_telegram(chat_id, text):
    bot = Bot(TOKEN)
    bot.send_message(chat_id=chat_id, text=text)

def main():
    app = ApplicationBuilder().token(TOKEN).build()
    app.add_handler(CommandHandler('start', start))
    app.add_handler(CommandHandler('status', status))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, echo_and_forward))

    logger.info('Starting ARMbot Telegram polling...')
    app.run_polling()

if __name__ == '__main__':
    main()
