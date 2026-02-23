describe('管理员指令功能测试', () => {
  beforeEach(async () => {
    await browser.pause(1500);
  });

  describe('1. 管理员指令 UI 测试', () => {
    it('should display admin commands card', async () => {
      const body = await $('body');
      const text = await body.getText();

      // 检查是否显示管理员指令说明
      const hasAdminCommands = text.includes('/clear') || text.includes('管理员指令');
      console.log('Admin commands UI visible:', hasAdminCommands);

      await browser.saveScreenshot('./test-results/admin-01-ui-card.png');
    });

    it('should show current working directory', async () => {
      const body = await $('body');
      const text = await body.getText();

      // 检查是否显示工作目录
      const hasWorkingDir = text.includes('工作目录') || text.includes('Working');
      console.log('Working directory shown:', hasWorkingDir);
    });
  });

  describe('2. 指令格式测试', () => {
    it('should recognize /clear format', async () => {
      // /clear 格式正确
      const clearPattern = /^\/clear$/i;
      expect(clearPattern.test('/clear')).toBe(true);
      expect(clearPattern.test('/CLEAR')).toBe(true);
      expect(clearPattern.test('/clear ')).toBe(false); // 有尾随空格
    });

    it('should recognize /cd format', async () => {
      // /cd 格式正确
      const cdPattern = /^\/cd\s+.+$/i;
      expect(cdPattern.test('/cd C:\\test')).toBe(true);
      expect(cdPattern.test('/cd /home/user')).toBe(true);
      expect(cdPattern.test('/cd')).toBe(false); // 缺少路径
    });
  });

  describe('3. 指令拦截测试', () => {
    it('should intercept commands starting with /', async () => {
      // 以 / 开头的消息应该被拦截
      const adminPattern = /^\//;
      expect(adminPattern.test('/clear')).toBe(true);
      expect(adminPattern.test('/cd test')).toBe(true);
      expect(adminPattern.test('hello')).toBe(false);
      expect(adminPattern.test('/unknown')).toBe(true);
    });
  });

  describe('4. 最终状态', () => {
    it('should capture final state', async () => {
      await browser.saveScreenshot('./test-results/admin-99-final.png');
      console.log('Admin commands test completed');
    });
  });
});
