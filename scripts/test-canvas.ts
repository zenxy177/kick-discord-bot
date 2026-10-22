import fs from 'fs';
import path from 'path';
import { renderLiveCard } from '../src/services/canvas/cardRenderer.js';
import { renderSummaryCard } from '../src/services/canvas/summaryCardRenderer.js';
import { logger } from '../src/utils/logger.js';

async function main() {
  logger.info('TEST_CANVAS', 'Canvas kartları üretiliyor...');

  const outputDir = path.resolve(process.cwd(), 'sample-outputs');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 1. Generate Live Card
  const liveStarted = new Date(Date.now() - 45 * 60 * 1000); // 45 mins ago
  const liveBuffer = await renderLiveCard({
    streamerName: 'Elraenn',
    streamTitle: '🔥 KICK CANLI YAYIN | Gece Sohbeti & CS2 Topluluk Maçları!',
    category: 'Counter-Strike 2',
    viewers: 12450,
    startedAt: liveStarted,
  });

  const livePath = path.join(outputDir, 'test-live-card.png');
  fs.writeFileSync(livePath, liveBuffer);
  logger.success('TEST_CANVAS', `Canlı Yayın Kartı kaydedildi: ${livePath}`);

  // 2. Generate Summary Card
  const summaryEnded = new Date();
  const summaryStarted = new Date(Date.now() - 3 * 3600 * 1000 - 45 * 60 * 1000); // 3h 45m ago
  const summaryBuffer = await renderSummaryCard({
    streamerName: 'Elraenn',
    streamTitle: '🔥 KICK CANLI YAYIN | Gece Sohbeti & CS2 Topluluk Maçları!',
    category: 'Counter-Strike 2',
    startedAt: summaryStarted,
    endedAt: summaryEnded,
    peakViewers: 18720,
    averageViewers: 13400,
  });

  const summaryPath = path.join(outputDir, 'test-summary-card.png');
  fs.writeFileSync(summaryPath, summaryBuffer);
  logger.success('TEST_CANVAS', `Yayın Sonu Özet Kartı kaydedildi: ${summaryPath}`);

  logger.success('TEST_CANVAS', 'Tüm kartlar başarıyla oluşturuldu!');
}

main().catch((err) => {
  logger.error('TEST_CANVAS', 'Test sırasında hata oluştu:', err);
  process.exit(1);
});
