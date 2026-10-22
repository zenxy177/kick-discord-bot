type LogLevel = 'info' | 'warn' | 'error' | 'success' | 'debug';

function getTimestamp(): string {
  const now = new Date();
  return now.toLocaleTimeString('tr-TR', { hour12: false });
}

export const logger = {
  info: (tag: string, message: string, ...args: unknown[]) => {
    console.log(`\x1b[90m[${getTimestamp()}]\x1b[0m \x1b[36m[${tag}]\x1b[0m ${message}`, ...args);
  },
  success: (tag: string, message: string, ...args: unknown[]) => {
    console.log(`\x1b[90m[${getTimestamp()}]\x1b[0m \x1b[32m[${tag}]\x1b[0m \x1b[32m✔\x1b[0m ${message}`, ...args);
  },
  warn: (tag: string, message: string, ...args: unknown[]) => {
    console.warn(`\x1b[90m[${getTimestamp()}]\x1b[0m \x1b[33m[${tag}]\x1b[0m \x1b[33m⚠\x1b[0m ${message}`, ...args);
  },
  error: (tag: string, message: string, ...args: unknown[]) => {
    console.error(`\x1b[90m[${getTimestamp()}]\x1b[0m \x1b[31m[${tag}]\x1b[0m \x1b[31m✖\x1b[0m ${message}`, ...args);
  },
  debug: (tag: string, message: string, ...args: unknown[]) => {
    if (process.env.DEBUG === 'true') {
      console.log(`\x1b[90m[${getTimestamp()}]\x1b[0m \x1b[35m[${tag}:DEBUG]\x1b[0m ${message}`, ...args);
    }
  },
};
