/**
 * OpenRouter AI 服务
 * 负责调用 OpenRouter API 进行 AI 分析
 *
 * Standalone subset of the original adapter: getPlatformApiKey, MODEL_MAPPING,
 * getOpenRouterModelName and callSingleModel. Multi-model comparison, model
 * listing and connection-test helpers are not migrated (no caller in the
 * extension call chain). The key is read only from the server environment.
 */

import axios from 'axios';
import { getOpenRouterApiKey } from '../../config/secrets.js';

const DEFAULT_TIMEOUT_MS = 8000;
const MAX_ERROR_MESSAGE_LENGTH = 200;

/**
 * 获取平台的 OpenRouter API Key（仅服务端环境变量）
 */
async function getPlatformApiKey() {
  return getOpenRouterApiKey();
}

/**
 * 前端模型 ID 到 OpenRouter 模型名称的映射
 * 确保前端发送的模型名称能够正确映射到 OpenRouter API 所需的格式
 */
const MODEL_MAPPING = {
  // 主要推荐模型（按顺序）
  'deepseek': 'deepseek/deepseek-chat',
  'qwen': 'qwen/qwen-2.5-72b-instruct',
  'gpt4': 'openai/gpt-4o',
  'gpt-4': 'openai/gpt-4o',           // 前端兼容性
  'gpt-4o': 'openai/gpt-4o',          // 前端兼容性
  'gpt-4o-mini': 'openai/gpt-4o-mini', // GPT-4o Mini
  'claude': 'anthropic/claude-3-5-sonnet-20241022',
  'claude-3-5-sonnet': 'anthropic/claude-3-5-sonnet-20241022', // 前端兼容性
  'claude-sonnet-3.5': 'anthropic/claude-3-5-sonnet-20241022', // 前端兼容性
  'grok': 'x-ai/grok-beta',

  // 其他常用模型
  'gemini': 'google/gemini-2.5-pro',
  'mixtral': 'mistralai/mixtral-8x7b-instruct',
  'llama3': 'meta-llama/llama-3.1-70b-instruct'
};

/**
 * 获取 OpenRouter 模型名称
 * @param {string} modelId - 前端模型 ID 或完整的 OpenRouter 模型 ID
 * @returns {string} OpenRouter 模型名称
 */
export const getOpenRouterModelName = (modelId) => {
  // 如果已经是完整的 OpenRouter 模型 ID（包含 /），直接返回
  if (modelId && modelId.includes('/')) {
    return modelId;
  }

  // 旧版短名称映射（向后兼容）
  const modelName = MODEL_MAPPING[modelId];
  if (!modelName) {
    // 如果没有映射，使用默认模型
    void 0;
    return 'deepseek/deepseek-chat';
  }
  return modelName;
};

/**
 * Build a log/response-safe error message. axios errors carry the request
 * config (including the Authorization header) and the full request body, so
 * only the HTTP status and the provider's short error message are kept.
 */
export function toSafeErrorMessage(error) {
  const status = error?.response?.status;
  if (error?.code === 'ECONNABORTED' || error?.code === 'ETIMEDOUT') return 'Model request timed out';
  return Number.isInteger(status) ? `Model provider HTTP ${status}` : 'Model request failed';
}

/**
 * 调用单个 AI 模型进行分析
 * @param {string} modelId - 模型 ID (如 'claude', 'gpt4')
 * @param {string} prompt - 提示词
 * @param {object} options - 额外选项 { systemPrompt, temperature, maxTokens, userApiKey, usePlatformKey }
 * @returns {Promise<object>} AI 分析结果
 */
export const callSingleModel = async (modelId, prompt, options = {}) => {
  try {
    const baseUrl = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
    const platformApiKey = await getPlatformApiKey();

    // 确定使用哪个 API Key
    let apiKey = options.userApiKey;
    let apiSource = 'user';

    // 如果明确指定使用平台 Key，或者用户没有提供 Key 但平台 Key 可用
    if (options.usePlatformKey && platformApiKey) {
      apiKey = platformApiKey;
      apiSource = 'platform';
    }

    if (!apiKey) {
      const error = new Error('MISSING_OPENROUTER_API_KEY');
      error.errorCode = 'MISSING_OPENROUTER_API_KEY';
      throw error;
    }

    // 获取对应的 OpenRouter 模型名称
    const modelName = getOpenRouterModelName(modelId);

    void 0;

    // 构建消息数组
    const messages = [];

    // 如果有 system prompt，添加为 system 消息
    if (options.systemPrompt) {
      messages.push({
        role: 'system',
        content: options.systemPrompt
      });
    }

    // 添加用户消息
    messages.push({
      role: 'user',
      content: prompt
    });

    const headers = {
      'Authorization': `Bearer ${apiKey}`,
      'X-Title': process.env.APP_NAME || 'OddsSeer',
      'Content-Type': 'application/json'
    };
    // HTTP-Referer is optional attribution for OpenRouter; only sent when set.
    if (process.env.APP_URL) {
      headers['HTTP-Referer'] = process.env.APP_URL;
    }

    const timeoutMs = Number.parseInt(process.env.OPENROUTER_TIMEOUT_MS || '', 10);

    const response = await axios.post(
      `${baseUrl}/chat/completions`,
      {
        model: modelName,
        messages: messages,
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 8000,  // 默认 8000，配合提示词长度限制确保完整性
        usage: { include: true },  // 启用实时费用返回，获取 total_cost
      },
      {
        headers,
        timeout: Number.isFinite(timeoutMs) && timeoutMs > 0 ? Math.min(timeoutMs, 15000) : DEFAULT_TIMEOUT_MS,
        maxContentLength: 2 * 1024 * 1024,
        maxBodyLength: 256 * 1024,
        maxRedirects: 0,
      }
    );

    const result = response.data;
    const content = result?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') {
      const error = new Error('OpenRouter returned no message content');
      error.errorCode = 'AI_EMPTY_RESPONSE';
      throw error;
    }

    return {
      success: true,
      model: modelId,
      modelName: modelName,
      content,
      usage: result.usage,
      apiSource: apiSource,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    const errorMessage = error?.errorCode === 'AI_EMPTY_RESPONSE'
      ? error.message
      : toSafeErrorMessage(error);
    // Never log the axios error object: it contains config.headers (API key)
    // and config.data (prompt with user-provided text).
    void 0;

    // 关键错误应该抛出而不是静默返回，让调用者知道失败了
    const wrappedError = new Error(errorMessage);
    wrappedError.errorCode = error?.errorCode || 'AI_CALL_FAILED';
    wrappedError.model = modelId;
    throw wrappedError;
  }
};

export default { callSingleModel, getOpenRouterModelName };
