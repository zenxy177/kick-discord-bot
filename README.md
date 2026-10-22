# 🟢 Kick Discord Entegrasyon Botu

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-20+-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/TypeScript-5.7-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Discord.js-v14-5865F2?style=for-the-badge&logo=discord&logoColor=white" alt="Discord.js" />
  <img src="https://img.shields.io/badge/Kick.com-API_v2-53FC18?style=for-the-badge&logo=kick&logoColor=black" alt="Kick" />
  <img src="https://img.shields.io/badge/SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white" alt="SQLite" />
  <img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" alt="License" />
</p>

<p align="center">
  <b>Kick canlı yayınlarını Discord sunucularına aktaran, BotRix tarzı anlık yayın önizlemesi sunan, 5 dakikada bir mesajı canlı düzenleyen, yayın sonu özet kartı çıkaran ve otomatik klip avcısı bulunan profesyonel Discord botu.</b>
</p>

---

## 🚀 Öne Çıkan Özellikler

1. **BotRix Tarzı Canlı Yayın Bildirimi:**
   - Kick yeşili kenarlıklı Discord Embed formatı.
   - Kick'in anlık canlı yayın görüntüsü (Stream Thumbnail) büyük görsel olarak yerleştirilir.
   - Kamera olmadığı veya yayın açılış anında 8-bit retro Kick afişi (`assets/kick-default-banner.png`) otomatik devreye girer.
2. **Çift Motorlu Canlı Takip (Polling Fallback + Webhook):**
   - **Otomatik Polling (`streamWatcher.ts`):** Yayıncının hiçbir OAuth2 yetkilendirmesi veya Webhook kurmasına gerek yoktur! Bot 60 saniyede bir public Kick API'yi sorgulayarak yayının başladığını algılar ve anında duyuruyu atar.
   - **Resmi Webhook:** İsteğe bağlı olarak sıfır gecikmeli etkinlik yakalama için hazır altyapı.
3. **Canlı Güncellenen Yayın Mesajı:**
   - Yayın sürerken bot mesajı silmez; **her 5 dakikada bir düzenleyerek (edit)** anlık izleyici sayısını ve süreyi günceller.
   - Yayın kapandığında mesaj otomatik olarak **Yayın Sonu Özeti** kartına (zirve izleyici, toplam süre, ortalama izleyici) dönüşür.
4. **Gerçek Sadakat & İzlenme Süresi Motoru (`loyaltyTracker.ts`):**
   - **Anti-Spam Koruması:** Kick sohbetinde puan kazanımı kullanıcı başına **60 saniyede bir** ile sınırlandırılmıştır (+5 Puan). Böylece spam yaparak haksız puan kasılması engellenir.
   - **Anti-AFK Koruması:** Discord ses kanallarında puan kazanımı için üyenin **kulaklığının açık olması (sağırlaştırılmamış / non-deaf)** ve **AFK kanalında olmaması** şarttır. Gece AFK bırakıp haksız puan kasanlar elenir.
   - **Abone Bonusu:** Kick aboneleri izlenme süresinden dakikada 1.5x çarpanla (+15 Puan) ödüllendirilir.
5. **Dinamik Canvas Görsel Motoru (`@napi-rs/canvas`):**
   - **Yayın Sonu Özeti Kartı (`summaryCardRenderer.ts`):** Zirve izleyici, süre ve ortalama izleyiciyi gösteren özet kartı.
   - **Kişisel Sadakat Kartı (`loyaltyCardRenderer.ts`):** `/sadakat` komutunda kullanıcının avatarı, sunucu sıralaması, abone rozeti, izlenme süresi ve puanını çizen özel profil kartı.
6. **Otomatik Kick Abone & VIP Rol Senkronizasyonu:**
   - `/hesap-bagla` komutu ile **Resmi Kick OAuth2 (PKCE Korumalı)** tek tıkla bağlanma VEYA tek kullanımlık `KICK-XXXX` doğrulama kodu.
   - Abone veya VIP olan kullanıcılara Discord sunucusundaki roller otomatik verilir, aboneliği bitenlerden otomatik alınır.
7. **🎬 Otomatik Kick Klip Avcısı (`clipWatcher.ts` - `#klipler` Kanalı):**
   - **Sıfır Konfigürasyon:** Webhook veya OAuth2 gerekmez; 60 saniyede bir Kick'in public v2 API'sini sorgulayarak yeni klipleri anında yakalar.
   - Klibi alanın adıyla, başlığıyla, süresiyle, izlenme sayısıyla, kapak görseliyle ve doğrudan "Klibi Kick'te İzle" butonuyla `#klipler` kanalına atar.
   - **Mükerrer Paylaşım Koruması:** Gönderilen klipler yerel veritabanında saklanır; bot yeniden başlasa dahi eski klipler tekrar paylaşılmaz.
8. **🏆 Sadakat Liderlik Tablosu (`/liderlik`):**
   - Sunucudaki en aktif Kick izleyicilerini puan ve izlenme süresine göre sıralayan Top 10 tablosu (🥇, 🥈, 🥉 madalyalarla).
9. **✍️ Özel Duyuru Metni & Bildirim Rolü:**
   - `@everyone` yerine sunucuya özel rol seçimi (`@Kick Bildirim`) ve özelleştirilebilir duyuru metni (`{rol}`, `{yayinci}`, `{baslik}`, `{kategori}`).
10. **⚙️ İnteraktif `/ayar` Paneli:**
   - Açılır menüler ve butonlarla tek ekrandan tüm bot ayarlarını yapılandırma.

---

## 🛠️ Teknoloji Yığını

| Katman | Teknoloji | Açıklama |
| :--- | :--- | :--- |
| **Çekirdek Dil** | TypeScript & Node.js (v20+) | Güçlü tip güvenliği ve modüler yapı |
| **Discord API** | Discord.js v14 | Slash komutlar, embedler, butonlar ve seçim menüleri |
| **Veritabanı & ORM** | Prisma ORM + SQLite | Sıfır konfigürasyon yerel veritabanı, PostgreSQL hazır |
| **Yayın Takip Motoru** | StreamWatcher + KickClient | 60 sn periyodik kontrol & OAuth gerektirmeyen otomatik algılama |
| **Sadakat Motoru** | LoyaltyTracker | Kick chat ve Discord ses kanalı aktivitesinden puan/süre üretimi |
| **HTTP Sunucu** | Fastify | Kick OAuth2 callback ve webhook dinleyici (Port 3000) |
| **Görsel Motoru** | @napi-rs/canvas | Yayın sonu özet kartı ve `/sadakat` görsel profil kartı |
| **Kuyruk Sistemi** | Hibrit Adaptör (In-Memory / BullMQ) | Redis varsa BullMQ, yoksa otomatik bellek içi kuyruk |

---

## ⚙️ Kurulum ve Başlatma

### 🚀 Hızlı Başlangıç (Windows - Tek Tıkla)
1. **`1-kurulum.bat`** dosyasına çift tıklayın (bağımlılıkları ve veritabanını otomatik kurar).
2. Oluşan `.env` dosyasını açıp Discord ve Kick bilgilerinizi girin.
3. **`2-botu-baslat.bat`** dosyasına çift tıklayarak botunuzu canlıya alın!

---

### 🔑 Kick Geliştirici Ayarları (`/hesap-bagla` için)
Kullanıcıların Kick hesaplarını Discord'a bağlayıp **Abone** ve **VIP** rollerini otomatik kazanabilmeleri için:

1. [Kick Geliştirici Ayarları](https://kick.com/settings/developer) sayfasına gidin.
2. **"Create Application"** butonuna basın:
   * **Application Name:** Botunuzun veya yayıncınızın adını yazın.
   * **Redirect URI:** `http://localhost:3000/api/auth/kick/callback` *(VDS kullanıyorsanız `http://SUNUCU_IP:3000/api/auth/kick/callback`)* yazın.
3. Oluşturulan **Client ID** ve **Client Secret** anahtarlarını `.env` dosyanızdaki `KICK_CLIENT_ID` ve `KICK_CLIENT_SECRET` alanlarına yapıştırın.

> [!TIP]
> **Yedek Doğrulama:** OAuth2 bağlamayan kullanıcılar, `/hesap-bagla baslat` komutunun verdiği tek kullanımlık `KICK-XXXX` doğrulama kodunu biyografilerine veya Kick sohbetine yazarak da hesaplarını %100 doğrulayabilirler.

---

### 💻 Manuel Kurulum (Linux / VDS / MacOS)

#### 1. Bağımlılıkları Yükleyin
```bash
npm install
```

#### 2. Ortam Değişkenlerini Ayarlayın
Proje kök dizinindeki `.env` dosyasını yapılandırın:

```env
# Discord Bot Token ve Client ID (Zorunlu)
DISCORD_TOKEN="YOUR_DISCORD_BOT_TOKEN"
DISCORD_CLIENT_ID="YOUR_DISCORD_CLIENT_ID"

# Kick Developer Portal Bilgileri (/hesap-bagla için)
KICK_CLIENT_ID="YOUR_KICK_CLIENT_ID"
KICK_CLIENT_SECRET="YOUR_KICK_CLIENT_SECRET"
KICK_REDIRECT_URI="http://localhost:3000/api/auth/kick/callback"

# Sunucu ve Veritabanı
PORT=3000
HOST="0.0.0.0"
DATABASE_URL="file:./dev.db"
```

#### 3. Veritabanını Hazırlayın
```bash
npx prisma db push
```

#### 4. Botu Başlatın
```bash
# Canlı geliştirme modu:
npm run dev

# veya Üretim (Production) modu:
npm run build
npm start
```

---

## 🎮 Discord Komut Referansı

### Yetkili Komutları (Administrator)
- `/ayar` - Sunucu bildirim kanalını, abone/VIP rollerini, bildirim rolünü, klipler kanalını ve özel duyuru metnini interaktif olarak ayarlar.

### Kullanıcı Komutları
- `/hesap-bagla baslat` - Resmi Kick OAuth2 tek tık butonu veya 15 dakikalık tek kullanımlık kod verir.
- `/hesap-bagla dogrula [kick_kullanici_adi]` - Biyografiye/sohbete yazılan kod ile hesabı doğrular.
- `/liderlik [tur]` - Sunucunun en aktif Kick izleyicilerini gösterir.
- `/sadakat` - Kullanıcının kendi izlenme süresini, sadakat puanını ve abone statüsünü Canvas kartı olarak gösterir.
- `/yayin-durumu` - Takip edilen Kick yayıncısının anlık canlı yayın durumunu görüntüler.
