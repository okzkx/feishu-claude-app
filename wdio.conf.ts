import type { Options } from '@wdio/types';

export const config: Options.Testrunner = {
  runner: 'local',
  specs: ['./tests/**/*.ts'],
  exclude: [],
  maxInstances: 1,

  // tauri-driver 正确的 capabilities 格式
  capabilities: [{
    maxInstances: 1,
    browserName: 'wry',  // Tauri 的 WebView 库名称
    'tauri:options': {
      application: 'F:\\okzkx\\feishu-claude-app\\src-tauri\\target\\debug\\feishu-claude-app.exe'
    }
  }],

  logLevel: 'info',
  bail: 0,
  baseUrl: 'http://localhost',
  waitforTimeout: 10000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,

  hostname: 'localhost',
  port: 4444,
  path: '/',

  framework: 'mocha',
  reporters: ['spec'],

  mochaOpts: {
    ui: 'bdd',
    timeout: 60000
  }
};
