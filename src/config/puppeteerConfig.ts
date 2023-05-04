export const puppeteerDefaultConfig: {
  launch: {
    args: string[];
  };
  viewport: { width: number; height: number };
  userAgent: string;
  page: { goto: { gotoWaitUntilIdle: { waitUntil: 'networkidle0' } } };
} = {
  launch: {
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  },
  viewport: {
    width: 1440,
    height: 2024,
  },
  userAgent:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
  page: {
    goto: { gotoWaitUntilIdle: { waitUntil: 'networkidle0' } },
  },
};
