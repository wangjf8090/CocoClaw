/**
 * LLM Provider Abstraction
 * Supports OpenAI-compatible API formats
 */

import { LLMMessage, LLMResponse, ToolCall } from './types.js';

export interface LLMProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface StreamChunk {
  token?: string;
  toolCalls?: ToolCall[];
  done: boolean;
}

export abstract class LLMProvider {
  protected config: LLMProviderConfig;

  constructor(config: LLMProviderConfig) {
    this.config = config;
  }

  /**
   * Non-streaming completion
   */
  abstract complete(messages: LLMMessage[], tools?: ToolDefinition[]): Promise<LLMResponse>;

  /**
   * Streaming completion - async generator
   */
  abstract stream(
    messages: LLMMessage[],
    tools?: ToolDefinition[]
  ): AsyncGenerator<StreamChunk, void, unknown>;
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters: {
      type: 'object';
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
}

/**
 * Mock LLM Provider for development/testing
 */
export class MockLLMProvider extends LLMProvider {
  constructor(config: Partial<LLMProviderConfig> = {}) {
    super({
      model: config.model || 'mock-model',
      ...config,
    });
  }

  async complete(messages: LLMMessage[], tools?: ToolDefinition[]): Promise<LLMResponse> {
    const lastMessage = messages[messages.length - 1];
    const content = `Mock response to: "${lastMessage?.content?.slice(0, 50) || ''}..."`;

    // Simulate tool call detection
    let toolCalls: ToolCall[] | undefined;
    if (tools && lastMessage?.content?.includes('search')) {
      toolCalls = [
        {
          id: 'tool_001',
          name: 'search',
          arguments: { query: lastMessage.content },
        },
      ];
    }

    return {
      content,
      toolCalls,
      usage: {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      },
    };
  }

  async *stream(
    messages: LLMMessage[],
    tools?: ToolDefinition[]
  ): AsyncGenerator<StreamChunk, void, unknown> {
    const lastMessage = messages[messages.length - 1];
    const response = `This is a streaming response to: "${lastMessage?.content?.slice(0, 30) || ''}..."`;

    // Simulate token streaming
    for (const char of response.split('')) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      yield {
        token: char,
        done: false,
      };
    }

    // Simulate tool call at the end if needed
    if (tools && lastMessage?.content?.includes('search')) {
      yield {
        toolCalls: [
          {
            id: 'tool_001',
            name: 'search',
            arguments: { query: lastMessage.content },
          },
        ],
        done: false,
      };
    }

    yield { done: true };
  }
}

/**
 * OpenAI-compatible Provider
 */
export class OpenAICompatibleProvider extends LLMProvider {
  constructor(config: LLMProviderConfig) {
    super({
      baseUrl: config.baseUrl || 'https://api.openai.com/v1',
      model: config.model || 'gpt-3.5-turbo',
      ...config,
    });
  }

  async complete(messages: LLMMessage[], tools?: ToolDefinition[]): Promise<LLMResponse> {
    if (!this.config.apiKey) {
      throw new Error('API key is required for OpenAI provider');
    }

    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
          tool_calls: msg.toolCalls?.map((tc) => ({
            id: tc.id,
            type: 'function',
            function: { name: tc.name, arguments: tc.arguments },
          })),
          tool_call_id: msg.toolCallId,
        })),
        tools: tools?.map((t) => ({
          type: t.type,
          function: t.function,
        })),
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens,
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM API error: ${response.status} ${await response.text()}`);
    }

    const data = await response.json();
    const choice = data.choices[0];

    return {
      content: choice.message.content || '',
      toolCalls: choice.message.tool_calls?.map((tc: any) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments),
      })),
      usage: data.usage && {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      },
    };
  }

  async *stream(
    messages: LLMMessage[],
    tools?: ToolDefinition[]
  ): AsyncGenerator<StreamChunk, void, unknown> {
    if (!this.config.apiKey) {
      throw new Error('API key is required for OpenAI provider');
    }

    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
        tools: tools?.map((t) => ({
          type: t.type,
          function: t.function,
        })),
        stream: true,
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens,
      }),
    });

    if (!response.ok || !response.body) {
      throw new Error(`LLM API error: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter((line) => line.trim() !== '');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            yield { done: true };
            return;
          }

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta;
            if (delta?.content) {
              yield {
                token: delta.content,
                done: false,
              };
            }
            if (delta?.tool_calls) {
              yield {
                toolCalls: delta.tool_calls.map((tc: any) => ({
                  id: tc.id,
                  name: tc.function?.name,
                  arguments: tc.function?.arguments ? JSON.parse(tc.function.arguments) : {},
                })),
                done: false,
              };
            }
          } catch {
            // Ignore parse errors
          }
        }
      }
    }
  }
}
