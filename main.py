import os
import time
import threading
import random
import re
import telebot
from telebot.types import ChatPermissions

# === CONFIGURAÇÕES PRINCIPAIS ===
TOKEN = os.getenv("BOT_TOKEN", "8622698013:AAEZ4whMRkRfvrJiszqT5_2Lt1a3xsflziI")
DONO_ID = int(os.getenv("DONO_ID", 8039536240))

bot = telebot.TeleBot(TOKEN)

GRUPOS = [
    -1003712577684,
    -1003851172557,
    -1003229869381,
    -1002838915310,
    -1003798767840
]

ADMINS_CACHE = {}
CACHE_TIMEOUT = 300  

PALAVRAS_PROIBIDAS = [
    "urubu do pix", "renda extra", "plataforma nova", "ganhar dinheiro", 
    "vagas de emprego", "trabalhe em casa", "filho da puta", "compro conta",
    "tigrinho", "cassino", "bet", "fortune tiger"
]

TABELA_MENSAGEM = """💎🚀 BEM-VINDO(A) AOS NOSSOS GRUPOS! 🚀💎

💥 A nave passou! Escolha o seu destino, entra pra resenha e divirta-se! 👇🏼

📲🔥 GRUPOS DE TELEGRAM 🔥📲

👉🏼 👑 RESENHA (PRINCIPAL) 👑 - Interação 24h
🔗 https://t.me/brukpcl

👉🏼 Sala Secreta 😏 - Conteúdo exclusivo
🔗 https://t.me/+lvouNoI1eIwxYzM0

👉🏼 Sala Proibida 🔥 - Área restrita
🔗 https://t.me/+4VgLrRtBVTZkZDdh

👉🏼 +18 / Sala Livre - Sem filtro
🔗 https://t.me/anarekunhobot

🔐 ACESSOS (TELEGRAM)
👉🏼 Acesso ao Resenha — R$5
🔗 https://t.me/+4_slZqNFLkc2MzEx

👉🏼 Nível Médio — R$5
🔗 https://t.me/+Rx5GUK1jjcNhYzJh

💰 DIVULGAÇÃO (TELEGRAM)
💰 Divulgação 1 — R$5
🔗 https://t.me/+33yfx5WaWWk0Y2Rh

💰 Divulgação 2 — R$5
🔗 https://t.me/+ddZv2UJ8ATAwZmJh

💰 Divulgação 3 — R$5
🔗 https://t.me/+1F-UgBSHZSxkZGZh

🟢 GRUPOS DE WHATSAPP 🟢
👉🏼 Resenha | Bunker | Figurinhas | Jogos | Streaming | Shopee | Divulgações

Aqui estão todos os grupos de WhatsApp 👇🏼
🔗 https://linktr.ee/brukpcl"""

FRASES_BAN = [
    "O anjo não pode dormir na presença do demônio. Foi de ralo!  🔨",
    "Mais um que foi de arrasta pra cima por não seguir as regras. 🚀",
    "A passagem aqui é só de ida pro limbo. Banido com sucesso! 🚷",
    "Sua estadia chegou ao fim. Tchau, brigado! 👋",
    "Menos um pra fazer bagunça. Eliminação concluída! 🗑️"
]

ultima_tabela = {}

# === FUNÇÕES AUXILIARES ===

def eh_admin(chat_id, user_id):
    if user_id == DONO_ID: return True
    agora = time.time()
    cache_key = f"{chat_id}_{user_id}"
    if cache_key in ADMINS_CACHE:
        cached_val, expira = ADMINS_CACHE[cache_key]
        if agora < expira: return cached_val
    try:
        status = bot.get_chat_member(chat_id, user_id).status
        is_adm = status in ['administrator', 'creator']
        ADMINS_CACHE[cache_key] = (is_adm, agora + CACHE_TIMEOUT)
        return is_adm
    except Exception: return False

def gerar_mencao(usuario):
    return f"@{usuario.username}" if usuario.username else f"[{usuario.first_name}](tg://user?id={usuario.id})"

def apagar_mensagem_depois(chat_id, message_id, delay):
    def _delay():
        time.sleep(delay)
        try: bot.delete_message(chat_id, message_id)
        except Exception: pass
    threading.Thread(target=_delay, daemon=True).start()

# === FUNÇÕES PERIÓDICAS ===

def enviar_tabela_periodicamente():
    while True:
        time.sleep(20 * 60)
        for grupo_id in GRUPOS:
            if grupo_id in ultima_tabela:
                try: bot.delete_message(grupo_id, ultima_tabela[grupo_id])
                except Exception: pass
            try:
                msg = bot.send_message(grupo_id, TABELA_MENSAGEM, disable_web_page_preview=True)
                ultima_tabela[grupo_id] = msg.message_id
            except Exception: pass

# === MODERAÇÃO AUTOMÁTICA (SISTEMA DE EVENTOS) ===

# 1. Aceitar Pedidos Automaticamente
@bot.chat_join_request_handler()
def aceitar_pedidos(message: telebot.types.ChatJoinRequest):
    try: bot.approve_chat_join_request(message.chat.id, message.from_user.id)
    except Exception: pass

# 2. Apagar mensagens de serviço (Entrou, Saiu, Fixou) e dar Boas-Vindas
@bot.message_handler(content_types=['new_chat_members', 'left_chat_member', 'pinned_message', 'new_chat_title', 'new_chat_photo'])
def gerenciar_eventos_grupo(message):
    try: bot.delete_message(message.chat.id, message.message_id) 
    except Exception: pass

    if message.content_type == 'new_chat_members':
        for membro in message.new_chat_members:
            if membro.is_bot and membro.id != bot.get_me().id:
                # Anti-Bot (Bane outros bots na hora)
                try: bot.ban_chat_member(message.chat.id, membro.id)
                except Exception: pass
            elif not membro.is_bot:
                mencao = gerar_mencao(membro)
                texto = f"Olá {mencao}, bem-vindo(a) à nave! 🚀💎\nFique atento(a) às regras para não ir de ralo."
                try:
                    msg = bot.send_message(message.chat.id, texto, parse_mode="Markdown")
                    apagar_mensagem_depois(message.chat.id, msg.message_id, 60)
                except Exception: pass

# === COMANDOS DE ADMINISTRAÇÃO AVANÇADA ===

@bot.message_handler(func=lambda message: message.text and message.text.lower().startswith(('/', 'ban', 'kick', 'mute', 'unban', 'del', 'pin', 'unpin')))
def comandos_admin(message):
    chat_id = message.chat.id
    user_id = message.from_user.id
    texto = message.text.lower()
    partes = texto.split()
    # Remove a barra para ler o comando limpo
    comando = partes[0].replace('/', '')

    # --- COMANDOS PÚBLICOS ---
    if comando == 'id':
        bot.reply_to(message, f"👤 Seu ID: `{user_id}`\n💬 ID do Grupo: `{chat_id}`", parse_mode="Markdown")
        return
    
    if comando == 'regras':
        bot.reply_to(message, "📜 *Regras do Grupo:*\n1. Proibido links externos.\n2. Proibido conteúdo +18 (fora das salas livres).\n3. Sem spam ou flood.\n4. Respeite os membros.", parse_mode="Markdown")
        return

    if comando == 'report' and message.reply_to_message:
        alvo = message.reply_to_message.from_user
        bot.send_message(DONO_ID, f"🚨 *Reporte Recebido*\nGrupo: {message.chat.title}\nReportado: {gerar_mencao(alvo)} (`{alvo.id}`)\nDenunciante: {gerar_mencao(message.from_user)}", parse_mode="Markdown")
        bot.reply_to(message, "✅ Os administradores foram notificados.")
        return

    # --- COMANDOS RESTRITOS A ADMINS ---
    if not eh_admin(chat_id, user_id): return

    # Ação em resposta a outro usuário
    if message.reply_to_message:
        alvo = message.reply_to_message.from_user
        msg_alvo = message.reply_to_message.message_id
        
        try:
            if comando == 'ban':
                bot.delete_message(chat_id, msg_alvo)
                bot.delete_message(chat_id, message.message_id)
                bot.ban_chat_member(chat_id, alvo.id)
                bot.send_message(chat_id, random.choice(FRASES_BAN))
            
            elif comando == 'kick':
                bot.delete_message(chat_id, message.message_id)
                bot.unban_chat_member(chat_id, alvo.id) # Unban funciona como kick no Telegram
                bot.send_message(chat_id, f"👢 {gerar_mencao(alvo)} foi expulso (mas pode voltar).")
                
            elif comando == 'mute':
                bot.delete_message(chat_id, message.message_id)
                bot.restrict_chat_member(chat_id, alvo.id, permissions=ChatPermissions(can_send_messages=False))
                msg = bot.send_message(chat_id, f"🤫 {gerar_mencao(alvo)} mutado com sucesso.")
                apagar_mensagem_depois(chat_id, msg.message_id, 30)

            elif comando == 'del':
                bot.delete_message(chat_id, msg_alvo)
                bot.delete_message(chat_id, message.message_id)

            elif comando == 'pin':
                bot.pin_chat_message(chat_id, msg_alvo, disable_notification=True)
                bot.delete_message(chat_id, message.message_id)

            elif comando == 'unpin':
                bot.unpin_chat_message(chat_id, msg_alvo)
                bot.delete_message(chat_id, message.message_id)

        except Exception as e: bot.reply_to(message, f"⚠️ Erro de permissão: {e}")

    # Ações Gerais do Grupo
    try:
        if comando == 'unban' and len(partes) > 1:
            bot.unban_chat_member(chat_id, int(partes[1]), only_if_banned=True)
            bot.reply_to(message, f"✅ Usuário `{partes[1]}` desbanido/desmutado.", parse_mode="Markdown")

        elif comando == 'lock':
            bot.set_chat_permissions(chat_id, ChatPermissions(can_send_messages=False))
            bot.send_message(chat_id, "🔒 *Grupo Trancado!* Apenas administradores podem falar agora.", parse_mode="Markdown")

        elif comando == 'unlock':
            bot.set_chat_permissions(chat_id, ChatPermissions(can_send_messages=True, can_send_media_messages=True, can_send_polls=True, can_send_other_messages=True))
            bot.send_message(chat_id, "🔓 *Grupo Destrancado!* Todos podem falar.", parse_mode="Markdown")

        elif comando == 'aviso' and user_id == DONO_ID:
            aviso_texto = message.text.split(maxsplit=1)[1]
            for g in GRUPOS:
                try: bot.send_message(g, f"📢 *AVISO DA NAVE MÃE:*\n\n{aviso_texto}", parse_mode="Markdown")
                except Exception: pass
            bot.reply_to(message, "✅ Aviso enviado para todos os grupos!")
    except Exception: pass


# === FILTRO SUPREMO: ANTI-LINK, ANTI-SPAM E ANTI-ENCAMINHAMENTO ===
@bot.message_handler(content_types=['text', 'photo', 'video', 'document'], func=lambda message: True)
def filtro_conteudo(message):
    chat_id = message.chat.id
    user_id = message.from_user.id
    
    if chat_id not in GRUPOS or eh_admin(chat_id, user_id): return

    texto = str(message.text or message.caption).lower()
    violou, motivo = False, ""

    # 1. Anti-Encaminhamento de Canais Externos
    if message.forward_from_chat and message.forward_from_chat.type == 'channel':
        violou, motivo = True, "Encaminhamento de Canal Externo"

    # 2. Anti-Link Supremo (Pega HTTP, WWW, .COM, .NET, WA.ME, T.ME, etc.)
    elif re.search(r"(https?://|www\.|wa\.me|t\.me/|bit\.ly|youtu\.be|\b[a-zA-Z0-9-]+\.(com|net|org|me|info|biz|club|xyz|site)\b)", texto):
        violou, motivo = True, "Envio de Link Proibido"

    # 3. Anti-Caracteres Árabes/RTL (Pega spam gringo)
    elif re.search(r"[\u0600-\u06FF\u0750-\u077F]", texto):
        violou, motivo = True, "Spam Internacional (Caracteres Bloqueados)"

    # 4. Anti-Palavrão e Golpe
    elif any(p in texto for p in PALAVRAS_PROIBIDAS):
        violou, motivo = True, "Uso de Palavra/Termo Proibido"

    if violou:
        try:
            bot.delete_message(chat_id, message.message_id)
            bot.ban_chat_member(chat_id, user_id)
            bot.send_message(chat_id, random.choice(FRASES_BAN))

            aviso = f"🚨 *Sistema de Defesa*\nUsuário: {gerar_mencao(message.from_user)} (`{user_id}`)\nMotivo: *{motivo}*\nGrupo: *{message.chat.title}*"
            bot.send_message(DONO_ID, aviso, parse_mode="Markdown")
        except Exception: pass


# === INICIALIZAÇÃO DO BOT & SERVIDOR RENDER ===
if __name__ == "__main__":
    import http.server
    import socketserver
    
    print("🤖 Super Bot Iniciado com 20+ Funções! Monitoramento Ativo.")
    
    threading.Thread(target=enviar_tabela_periodicamente, daemon=True).start()
    
    def run_fake_server():
        PORT = int(os.getenv("PORT", 8080))
        Handler = http.server.SimpleHTTPRequestHandler
        Handler.log_message = lambda *args: None 
        with socketserver.TCPServer(("", PORT), Handler) as httpd:
            httpd.serve_forever()
            
    threading.Thread(target=run_fake_server, daemon=True).start()
    bot.infinity_polling(skip_pending=True)
