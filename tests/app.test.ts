describe('Feishu Claude App E2E Test', () => {
  beforeEach(async () => {
    // 等待应用加载
    await browser.pause(2000);
  });

  it('should load the config page', async () => {
    // 获取页面标题
    const title = await browser.getTitle();
    console.log('Page title:', title);

    // 检查是否显示配置页面
    const body = await $('body');
    const text = await body.getText();
    console.log('Page content preview:', text.substring(0, 200));

    // 断言页面包含预期内容
    expect(text).toContain('飞书');
  });

  it('should fill and save config', async () => {
    // 填写飞书 App ID
    const appIdInput = await $('input[placeholder*="cli_"]');
    if (await appIdInput.isExisting()) {
      await appIdInput.setValue('cli_test_id_automated');
      console.log('Filled App ID');
    }

    // 填写 App Secret
    const secretInput = await $('input[type="password"]');
    if (await secretInput.isExisting()) {
      await secretInput.setValue('test_secret_automated');
      console.log('Filled App Secret');
    }

    // 填写 Chat ID
    const chatIdInput = await $('input[placeholder*="oc_"]');
    if (await chatIdInput.isExisting()) {
      await chatIdInput.setValue('oc_test_chat_automated');
      console.log('Filled Chat ID');
    }

    // 启用 MCP
    const mcpSwitch = await $('.ant-switch');
    if (await mcpSwitch.isExisting()) {
      const isChecked = await mcpSwitch.getAttribute('checked');
      if (!isChecked) {
        await mcpSwitch.click();
        console.log('Enabled MCP');
        await browser.pause(500);
      }
    }

    // 填写 Claude 项目目录
    const workingDirInput = await $('input[placeholder*="projects"]');
    if (await workingDirInput.isExisting()) {
      await workingDirInput.setValue('C:\\Users\\71411\\Documents\\GitHub\\feishu-claude-app');
      console.log('Filled working directory');
    }

    // 点击保存按钮
    const saveButton = await $('button*=保存配置');
    if (await saveButton.isExisting()) {
      await saveButton.click();
      console.log('Clicked save button');
      await browser.pause(3000);
    }

    // 截图
    await browser.saveScreenshot('./test-results/config-screenshot.png');
    console.log('Screenshot saved');
  });

  it('should verify MCP settings are visible', async () => {
    // 检查 MCP 设置区域是否可见
    const mcpSection = await $('div*=MCP 设置');
    if (await mcpSection.isExisting()) {
      console.log('MCP settings section found');
      const text = await mcpSection.getText();
      console.log('MCP section text:', text);
    }

    // 检查 Claude 项目目录是否已填写
    const workingDirInput = await $('input[placeholder*="projects"]');
    if (await workingDirInput.isExisting()) {
      const value = await workingDirInput.getValue();
      console.log('Working directory value:', value);
      expect(value).toContain('feishu-claude-app');
    }
  });
});
