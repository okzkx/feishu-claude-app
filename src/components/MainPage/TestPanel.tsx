/**
 * TestPanel 组件
 *
 * 本地测试面板：测试指令执行和图片发送
 */

import React, { useState } from 'react';
import {
  Card,
  Space,
  Input,
  Button,
  message,
  Typography,
} from 'antd';
import {
  SendOutlined,
  CheckCircleOutlined,
  StopOutlined,
} from '@ant-design/icons';
import { invoke } from '@tauri-apps/api/core';
import { feishuApi } from '../../utils/feishuApi';
import { useConfigStore } from '../../stores';
import type { TaskResult } from '../../types';

const { Paragraph, Text } = Typography;

const TestPanel: React.FC = () => {
  const { isConfigComplete, exportToAppConfig } = useConfigStore();

  const [testCommand, setTestCommand] = useState('');
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; output: string } | null>(null);
  const [testImageLoading, setTestImageLoading] = useState(false);

  // 执行测试指令
  const handleTestCommand = async () => {
    if (!testCommand.trim()) {
      message.warning('请输入测试指令');
      return;
    }

    setTestLoading(true);
    setTestResult(null);

    try {
      const result = await invoke<TaskResult>('execute_claude', {
        command: testCommand,
      });

      setTestResult({
        success: result.success,
        output: result.output,
      });

      if (result.success) {
        message.success('执行成功');
      } else {
        message.error('执行失败');
      }
    } catch (error) {
      setTestResult({
        success: false,
        output: String(error),
      });
      message.error(`执行失败: ${error}`);
    } finally {
      setTestLoading(false);
    }
  };

  // 测试发送图片
  const handleTestImage = async () => {
    // 检查配置是否有效
    if (!isConfigComplete() || !feishuApi.hasValidConfig()) {
      message.warning('请先配置飞书应用信息');
      return;
    }

    // 初始化 feishuApi（确保配置已加载）
    const config = exportToAppConfig();
    feishuApi.init(config);

    setTestImageLoading(true);
    try {
      // 使用 1x1 像素的透明 PNG 图片
      const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=';
      const binaryString = atob(pngBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // 上传图片到飞书
      const imageKey = await feishuApi.uploadImage(bytes, 'image/png');

      // 发送图片消息
      const success = await feishuApi.sendImageMessage(imageKey);

      if (success) {
        message.success('图片发送成功！');
      } else {
        message.error('图片发送失败');
      }
    } catch (error) {
      console.error('发送图片失败:', error);
      message.error(`发送图片失败: ${error}`);
    } finally {
      setTestImageLoading(false);
    }
  };

  return (
    <Card size="small" title="本地测试">
      <Space direction="vertical" style={{ width: '100%' }}>
        {/* 指令输入 */}
        <div style={{ display: 'flex', width: '100%' }}>
          <Input
            placeholder="输入测试指令"
            value={testCommand}
            onChange={(e) => setTestCommand(e.target.value)}
            onPressEnter={handleTestCommand}
            disabled={testLoading}
            style={{ flex: 1, borderRadius: '6px 0 0 6px' }}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleTestCommand}
            loading={testLoading}
            style={{ borderRadius: '0 6px 6px 0' }}
          >
            执行
          </Button>
        </div>

        {/* 测试发送图片按钮 */}
        <Button
          onClick={handleTestImage}
          loading={testImageLoading}
          style={{ width: '100%' }}
        >
          测试发送图片到飞书
        </Button>

        {/* 测试结果显示 */}
        {testResult && (
          <div
            style={{
              marginTop: 12,
              padding: 12,
              backgroundColor: testResult.success ? '#f6ffed' : '#fff2f0',
              border: `1px solid ${testResult.success ? '#b7eb8f' : '#ffccc7'}`,
              borderRadius: 6,
            }}
          >
            <Space>
              {testResult.success ? (
                <CheckCircleOutlined style={{ color: '#52c41a' }} />
              ) : (
                <StopOutlined style={{ color: '#ff4d4f' }} />
              )}
              <Text strong>{testResult.success ? '执行成功' : '执行失败'}</Text>
            </Space>
            <Paragraph
              style={{
                marginTop: 8,
                marginBottom: 0,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                maxHeight: 200,
                overflow: 'auto',
              }}
            >
              {testResult.output}
            </Paragraph>
          </div>
        )}
      </Space>
    </Card>
  );
};

export default TestPanel;
