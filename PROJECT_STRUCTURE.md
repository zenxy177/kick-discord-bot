# 📁 Kick Discord Bot - Proje Dizin ve Dosya Mimarisi

Bu doküman, projenin tüm klasör yapısını, dosya uzantılarını ve her bir dosyanın üstlendiği teknik sorumluluğu ayrıntılı olarak açıklamaktadır.

---

## 🌳 Dosya ve Klasör Ağacı

```
Kick Bot DC/
├── 1-kurulum.bat                     # [Setup] Otomatik Windows tek tık kurulum betiği
├── 2-botu-baslat.bat                 # [Run] Tek tıkla botu başlatan Windows konsol betiği
├── .env                              # [Config] Ortam değişkenleri ve API anahtarları
├── .env.example                      # [Config] Örnek ortam değişkenleri şablonu
├── package.json                      # [Config] Proje bağımlılıkları ve npm betikleri
├── package-lock.json                 # [Config] Kilitli bağımlılık ağacı
├── tsconfig.json                     # [Config] TypeScript derleyici yapılandırması
├── README.md                         # [Docs] Proje genel tanıtım ve kullanım kılavuzu
├── PROJECT_STRUCTURE.md              # [Docs] Bu dosya (Dizin ve mimari haritası)
│
├── assets/                           # [Static] Sabit görsel ve grafik kaynakları
│   └── kick-default-banner.png       # 8-bit yeşil retro Kick varsayılan afişi
│
├── prisma/                           # [Database] Veritabanı model ve şema katmanı
│   ├── schema.prisma                 # Prisma ORM veritabanı şeması ve ilişkileri
│   └── dev.db                        # SQLite yerel veritabanı dosyası
│
├── sample-outputs/                   # [Test] Üretilen test görselleri
│   ├── test-live-card.png            # Örnek canlı yayın kartı çıktısı
│   └── test-summary-card.png         # Örnek yayın sonu özet kartı çıktısı
│
├── scripts/                          # [Scripts] Yardımcı ve test scriptleri
│   └── test-canvas.ts                # Canvas kart üretimini bağımsız test eden betik
│
└── src/                              # [Source] Ana TypeScript kaynak kodları
    ├── index.ts                      # Botun ve sunucunun ana giriş noktası (Bootstrap)
    │
    ├── commands/                     # [Discord] Slash komutları katmanı
    │   ├── admin/                    # Yetkili / Yönetici komutları
    │   │   └── ayar.ts               # İnteraktif yönetim paneli (/ayar)
    │   └── user/                     # Kullanıcı komutları
    │       ├── hesapBagla.ts         # Kick-Discord hesap eşleme (/hesap-bagla)
    │       ├── liderlik.ts           # Sadakat puanı Top 10 sıralaması (/liderlik)
    │       ├── sadakat.ts            # Görsel Canvas sadakat kartı komutu (/sadakat)
    │       └── yayinDurumu.ts        # Anlık canlı yayın durumu sorgusu (/yayin-durumu)
    │
    ├── config/                       # [Config] Sabitler ve ortam değişkenleri
    │   ├── constants.ts              # Renk kodları, aralıklar ve sabit değerler
    │   └── env.ts                    # Zod ile tip güvenli .env doğrulaması
    │
    ├── database/                     # [Database] Veritabanı istemcisi
    │   └── client.ts                 # Prisma Client singleton ve bağlantı yöneticisi
    │
    ├── events/                       # [Discord] Discord.js Olay Yöneticileri
    │   ├── ready.ts                  # Bot bağlandığında komutları kaydeden olay
    │   └── interactionCreate.ts      # Buton, modal, menü ve komut yönlendiricisi
    │
    ├── server/                       # [HTTP] Fastify Web Sunucusu
    │   ├── fastify.ts                # Fastify HTTP sunucu örneği ve başlatıcı
    │   └── routes/                   # HTTP Uç Noktaları
    │       ├── auth.ts               # Kick OAuth2 callback rotası (/api/auth/kick/callback)
    │       └── webhooks.ts           # Kick Webhook dinleme rotası (/api/webhooks/kick)
    │
    ├── services/                     # [Core] Çekirdek İş Mantığı Servisleri
    │   ├── canvas/                   # Grafik çizim motoru (@napi-rs/canvas)
    │   │   ├── cardRenderer.ts       # Alternatif dinamik canlı yayın kartı üreticisi
    │   │   ├── summaryCardRenderer.ts# Yayın sonu özet kartı üreticisi (Süre, Zirve vb.)
    │   │   └── loyaltyCardRenderer.ts# /sadakat komutu için profil & sıralama kartı
    │   │
    │   ├── kick/                     # Kick API entegrasyonu
    │   │   ├── kickClient.ts         # Kick Public API v1 HTTP istek yöneticisi
    │   │   ├── kickOAuth.ts          # Kick OAuth 2.1 (PKCE) kimlik doğrulama servisi
    │   │   └── webhookHandler.ts     # Gelen webhook olaylarını ayrıştırıcı
    │   │
    │   ├── loyalty/                  # Sadakat ve izlenme takip sistemi
    │   │   └── loyaltyTracker.ts     # Kick chat ve Discord ses aktivitesinden puan/süre motoru
    │   │
    │   ├── queue/                    # Kuyruk ve asenkron iş yöneticisi
    │   │   ├── queueInterface.ts     # Soyut kuyruk kontratı (IQueueService)
    │   │   ├── memoryQueue.ts        # Bellek içi hafif kuyruk adaptörü
    │   │   ├── bullmqQueue.ts        # Redis tabanlı BullMQ kuyruk adaptörü
    │   │   └── index.ts              # Dinamik kuyruk seçici (Fallback mekanizmalı)
    │   │
    │   ├── roleSync/                 # Rol senkronizasyon servisi
    │   │   └── roleManager.ts        # Abone ve VIP rollerini veren/alan yönetici
    │   │
    │   └── streamTracker/            # Canlı yayın takip mekanizması
    │       ├── liveNotifier.ts       # Canlı bildirimini gönderen servis (BotRix tarzı)
    │       ├── messageUpdater.ts     # 5 dakikada bir mesajı düzenleyen döngü
    │       ├── streamWatcher.ts      # 60 sn periyodik Polling (OAuth gerektirmeyen takipçi)
    │       └── clipWatcher.ts        # 60 sn periyodik Kick Klip Avcısı (#klipler kanalı)
    │
    └── utils/                        # [Utilities] Yardımcı araçlar
        ├── logger.ts                 # Renkli konsol loglama aracı
        └── timeFormatter.ts          # Süre, tarih ve sayı biçimlendirme araçları
```

---

## 🏷️ Dosya Uzantıları Rehberi

| Uzantı | Açıklama | Kullanım Alanı |
| :--- | :--- | :--- |
| **`.ts`** | **TypeScript Kaynak Dosyası** | Projenin tüm mantığı, komutları, modelleri ve servisleri tip güvenli TypeScript ile yazılmıştır. |
| **`.json`** | **JSON Yapılandırma Dosyası** | `package.json` (bağımlılıklar) ve `tsconfig.json` (derleyici kuralları) gibi ayarlar için kullanılır. |
| **`.prisma`**| **Prisma ORM Şema Dosyası** | Veritabanı tablolarını (`GuildConfig`, `StreamSession`, `UserLink`) tanımlar. |
| **`.db`** | **SQLite Veritabanı Dosyası** | Tüm sunucu ayarlarını, aktif oturumları ve kullanıcı eşleşmelerini saklayan hafif dosya tabanlı veritabanı. |
| **`.png`** | **PNG Görsel Dosyası** | `@napi-rs/canvas` ile üretilen kartlar ve varsayılan Kick retro afişi gibi grafik varlıkları. |
| **`.env`** | **Ortam Değişkenleri Dosyası** | Bot token'ı, API anahtarları ve gizli şifrelerin saklandığı dosya. |
| **`.md`** | **Markdown Dokümantasyonu** | Dokümantasyon, kılavuzlar ve mimari açıklamaları. |

---

## 🧩 Katmanlar ve Sorumluluk Dağılımı

### 1. Çift Motorlu Yayın Takibi (`src/services/streamTracker/streamWatcher.ts`)
- **Sıfır Yetki / Otomatik Polling:** Yayıncının Kick Developer Portal'da bot oluşturmasına veya OAuth izni vermesine gerek kalmaz. Bot, 60 saniyede bir public API'yi denetler ve yayına girildiğinde anında bildirimi tetikler.
- **Canlı Düzenleme:** `messageUpdater.ts`, yayın sürerken mesajı her 5 dakikada bir düzenler ve yayın bitince özet kartına çevirir.

### 2. Sadakat ve Puan Motoru (`src/services/loyalty/loyaltyTracker.ts`)
- **Anti-Spam (60 sn Cooldown):** Kick sohbetinde mesaj sayısını artırır ancak puanı kullanıcı başına 60 saniyede en fazla 1 kez verir (+5 Puan).
- **Anti-AFK Koruması:** Discord ses kanallarında puan kazanımı için üyenin AFK kanalında olmaması ve kulaklığını kapatmamış (sağırlaştırılmamış) olması şarttır (+10 Puan / Aboneye +15 Puan).

### 3. Canvas Motoru (`src/services/canvas/`)
- Canlı yayında BotRix tarzı anlık yayın görüntüsü (Stream Thumbnail) kullanılır.
- Canvas ise **Yayın Sonu Özeti (`summaryCardRenderer.ts`)** ve **`/sadakat` Görsel Profil Kartı (`loyaltyCardRenderer.ts`)** için özelleştirilmiştir.

### 4. Otomatik Klip Avcısı (`src/services/streamTracker/clipWatcher.ts`)
- **Sıfır Yetki / Otomatik Polling:** Webhook veya Developer Portal gerektirmeden 60 saniyede bir Kick'in public API'sinden yeni klipleri yakalar.
- **Mükerrer Paylaşım Koruması:** Gönderilen klipler SQLite veritabanında saklanır; bot yeniden başlasa dahi eski klipler tekrar paylaşılmaz.
- Doğrudan Kick klip linki, kapak görseli, klip süresi ve izlenme sayısıyla `#klipler` kanalına zengin embed kartı gönderir.
