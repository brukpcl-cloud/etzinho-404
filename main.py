import os
import time
import threading
import random
import re
import telebot
from telebot.types import ChatPermissions

# === CONFIGURAÇÕES PRINCIPAIS ===
# O Render puxará essas variáveis automaticamente das configurações que você definir na dashboard.
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

# Cache para não estourar o limite da API do Telegram checando admin toda hora
ADMINS_CACHE = {}
CACHE_TIMEOUT = 300  # 5 minutos

# Lista de palavras proibidas (Exemplos comuns de spam/golpes)
PALAVRAS_PROIBIDAS = [
    "urubu do pix", "renda extra", "plataforma nova", "ganhar dinheiro", 
    "vagas de emprego", "trabalhe em casa", "filho da puta", "compro conta"
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
    """Verifica se o usuário é admin usando um cache para performance."""
    if user_id == DONO_ID:
        return True
        
    agora = time.time()
    cache_key = f"{chat_id}_{user_id}"
    
    if cache_key in ADMINS_CACHE:
        cached_val, expira = ADMINS_CACHE[cache_key]
        if agora < expira:
            return cached_val

    try:
        status = bot.get_chat_member(chat_id, user_id).status
        is_adm = status in ['administrator', 'creator']
        ADMINS_CACHE[cache_key] = (is_adm, agora + CACHE_TIMEOUT)
        return is_adm
    except Exception:
        return False

def gerar_mencao(usuario):
    """Gera menção segura por markdown."""
    return f"@{usuario.username}" if usuario.username else f"[{usuario.first_name}](tg://user?id={usuario.id})"

def apagar_mensagem_depois(chat_id, message_id, delay):
    """Apaga uma mensagem após X segundos (útil para não poluir o grupo)."""
    def _delay():
        time.sleep(delay)
        try:
            bot.delete_message(chat_id, message_id)
        except Exception:
            pass
    threading.Thread(target=_delay, daemon=True).start()


# === FUNÇÕES PERIÓDICAS ===

def enviar_tabela_periodicamente():
    """Envia a tabela para TODOS os grupos e apaga a anterior de cada um."""
    while True:
        time.sleep(20 * 60)
        for grupo_id in GRUPOS:
            if grupo_id in ultima_tabela:
                try:
                    bot.delete_message(grupo_id, ultima_tabela[grupo_id])
                except Exception:
                    pass

            try:
                msg = bot.send_message(grupo_id, TABELA_MENSAGEM, disable_web_page_preview=True)
                ultima_tabela[grupo_id] = msg.message_id
            except Exception as e:
                print(f"Erro ao enviar tabela no grupo {grupo_id}: {e}")


# === MANIPULADORES DE EVENTOS ===

# 1. Aceitar Pedidos de Entrada Automaticamente
@bot.chat_join_request_handler()
def aceitar_pedidos(message: telebot.types.ChatJoinRequest):
    try:
        bot.approve_chat_join_request(message.chat.id, message.from_user.id)
    except Exception:
        pass

# 2. Mensagem de Boas-vindas (Apaga depois de 60s)
@bot.message_handler(content_types=['new_chat_members'])
def boas_vindas(message):
    for membro in message.new_chat_members:
        if membro.id != bot.get_me().id:
            mencao = gerar_mencao(membro)
            texto = f"Olá {mencao}, bem-vindo(a) ao grupo! 🎉\nFique atento às regras para não ser banido."
            try:
                msg = bot.send_message(message.chat.id, texto, parse_mode="Markdown")
                apagar_mensagem_depois(message.chat.id, msg.message_id, 60)
                bot.delete_message(message.chat.id, message.message_id)
            except Exception:
                pass

# 3. Comandos de Moderação (!ban, !mute, !unban)
@bot.message_handler(func=lambda message: message.text and message.text.startswith(('!ban', 'ban', '!mute', '!unban')))
def moderacao_manual(message):
    chat_id = message.chat.id
    user_id = message.from_user.id
    texto = message.text.lower()

    if not eh_admin(chat_id, user_id):
        return

    # Comando BAN
    if texto.startswith(('!ban', 'ban')) and message.reply_to_message:
        usuario_alvo = message.reply_to_message.from_user
        mencao = gerar_mencao(usuario_alvo)
        
        try:
            bot.delete_message(chat_id, message.reply_to_message.message_id)
            bot.delete_message(chat_id, message.message_id)
            bot.ban_chat_member(chat_id, usuario_alvo.id)
            
            bot.send_message(chat_id, random.choice(FRASES_BAN))
            aviso = f"⚠️ *Banimento Manual*\nUsuário: {mencao} (`{usuario_alvo.id}`)\nGrupo: *{message.chat.title}*"
            bot.send_message(DONO_ID, aviso, parse_mode="Markdown")
        except Exception:
            bot.reply_to(message, "⚠️ Erro ao banir. Verifique minhas permissões.")

    # Comando MUTE (!mute)
    elif texto.startswith('!mute') and message.reply_to_message:
        usuario_alvo = message.reply_to_message.from_user
        try:
            bot.delete_message(chat_id, message.message_id)
            bot.restrict_chat_member(chat_id, usuario_alvo.id, permissions=ChatPermissions(can_send_messages=False))
            msg = bot.send_message(chat_id, f"🤫 {gerar_mencao(usuario_alvo)} foi mutado por comportamento inadequado.")
            apagar_mensagem_depois(chat_id, msg.message_id, 30)
        except Exception:
            pass

    # Comando UNBAN (!unban ID)
    elif texto.startswith('!unban'):
        partes = message.text.split()
        if len(partes) > 1 and partes[1].isdigit():
            id_alvo = int(partes[1])
            try:
                bot.unban_chat_member(chat_id, id_alvo, only_if_banned=True)
                bot.reply_to(message, f"✅ Usuário `{id_alvo}` foi desbanido/desmutado.")
            except Exception:
                bot.reply_to(message, "❌ Não foi possível desbanir.")


# 4. Sistema Central: Anti-Link e Filtro de Palavras Proibidas
@bot.message_handler(content_types=['text', 'photo', 'video', 'document'], func=lambda message: True)
def filtro_conteudo(message):
    chat_id = message.chat.id
    user_id = message.from_user.id
    
    if chat_id not in GRUPOS:
        return

    if eh_admin(chat_id, user_id):
        return

    texto = message.text if message.text else message.caption
    if not texto:
        return

    violou = False
    motivo = ""

    if re.search(r"(https?://|www\.|t\.me/|bit\.ly)", texto, re.IGNORECASE):
        violou = True
        motivo = "Envio de Link Proibido"

    elif any(palavra in texto.lower() for palavra in PALAVRAS_PROIBIDAS):
        violou = True
        motivo = "Palavra/Termo Proibido no Grupo"

    if violou:
        usuario = message.from_user
        mencao = gerar_mencao(usuario)
        
        try:
            bot.delete_message(chat_id, message.message_id)
            bot.ban_chat_member(chat_id, usuario.id)
            bot.send_message(chat_id, random.choice(FRASES_BAN))

            aviso = f"🚨 *Sistema Anti-Spam*\nUsuário: {mencao} (`{usuario.id}`)\nMotivo: *{motivo}*\nGrupo: *{message.chat.title}*"
            bot.send_message(DONO_ID, aviso, parse_mode="Markdown")
        except Exception as e:
            print(f"Erro no anti-spam: {e}")


# === INICIALIZAÇÃO E SERVIDOR WEB FALSO PARA O RENDER ===
if __name__ == "__main__":
    import http.server
    import socketserver
    
    print("🤖 Bot iniciado com Sucesso! Monitoramento ativo.")
    
    # Executa o disparo periódico da tabela em segundo plano
    thread_tabela = threading.Thread(target=enviar_tabela_periodicamente, daemon=True)
    thread_tabela.start()
    
    # Servidor Web Falso para o plano Free do Render aceitar como Web Service
    def run_fake_server():
        PORT = int(os.getenv("PORT", 8080))
        Handler = http.server.SimpleHTTPRequestHandler
        # Suprime logs de requisições no terminal para não poluir
        Handler.log_message = lambda *args: None 
        with socketserver.TCPServer(("", PORT), Handler) as httpd:
            httpd.serve_forever()
            
    thread_server = threading.Thread(target=run_fake_server, daemon=True)
    thread_server.start()
    
    # Inicia o polling contínuo do Telegram
    bot.infinity_polling(skip_pending=True)
