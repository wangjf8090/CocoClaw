/**
 * QueryEngine Core
 * Streaming async generator loop with tool use detection
 */

import EventEmitter from 'eventemitter3';
import { v4 as uuidv4 } from 'uuid';
import {
  QueryEvent,
  QueryEventType,
  QueryState,
  QueryOptions,
  DEFAULT_QUERY_OPTIONS,
  LLMMessage,
  ToolCall,
  ToolResult,
} from './types.js';
import { LLMProvider, MockLLMProvider, ToolDefinition } from './llm-provider.js';

export interface QueryEngineEvents {
  event: (event: QueryEvent) => void;
  queryStart: (queryId: string) => void;
  queryComplete: (queryId: string, result: string) => void;
  toolUse: (queryId: string, toolCall: ToolCall) => void;
  toolResult: (queryId: string, result: ToolResult) => void;
  error: (queryId: string, error: Error) => void;
}

export type ToolHandler = (toolCall: ToolCall) => Promise<unknown>;

export class QueryEngine extends EventEmitter<QueryEngineEvents> {
  private provider: LLMProvider;
  private tools: Map<string, { definition: ToolDefinition; handler: ToolHandler }> = new Map();
  private queries: Map<string, QueryState> = new Map();

  constructor(provider?: LLMProvider) {
    super();
    this.provider = provider || new MockLLMProvider();
  }

  /**
   * Set the LLM provider
   */
  setProvider(provider: LLMProvider): void {
    this.provider = provider;
  }

  /**
   * Register a tool
   */
  registerTool(definition: ToolDefinition, handler: ToolHandler): void {
    this.tools.set(definition.function.name, { definition, handler });
  }

  /**
   * Unregister a tool
   */
  unregisterTool(name: string): boolean {
    return this.tools.delete(name);
  }

  /**
   * Get all registered tool definitions
   */
  getToolDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map((t) => t.definition);
  }

  /**
   * Execute a query with streaming response
   */
  async *execute(
    userMessage: string,
    options: QueryOptions = {}
  ): AsyncGenerator<QueryEvent, void, unknown> {
    const queryId = uuidv4();
    const opts: Required<QueryOptions> = { ...DEFAULT_QUERY_OPTIONS, ...options };

    // Initialize query state
    const state: QueryState = {
      id: queryId,
      status: 'running',
      messages: [
        { role: 'system', content: opts.systemPrompt },
        { role: 'user', content: userMessage },
      ],
      iterations: 0,
      maxIterations: opts.maxIterations,
      startedAt: Date.now(),
    };
    this.queries.set(queryId, state);

    // Emit start event
    const startEvent = this.createEvent('query_start', queryId, {
      message: userMessage,
      options: opts,
    });
    this.emit('event', startEvent);
    this.emit('queryStart', queryId);
    yield startEvent;

    try {
      let fullResponse = '';

      // Main reasoning loop
      while (state.iterations < state.maxIterations && state.status === 'running') {
        state.iterations++;

        // Emit reasoning event
        yield this.createEvent('reasoning', queryId, {
          iteration: state.iterations,
          messageCount: state.messages.length,
        });

        // Get tool definitions if any are registered
        const toolDefs = this.getToolDefinitions();
        const hasTools = toolDefs.length > 0;

        // Call LLM
        if (opts.stream) {
          // Streaming mode
          const stream = this.provider.stream(state.messages, hasTools ? toolDefs : undefined);
          let currentToolCalls: ToolCall[] = [];

          for await (const chunk of stream) {
            if (chunk.token) {
              fullResponse += chunk.token;
              yield this.createEvent('token', queryId, { token: chunk.token });
            }
            if (chunk.toolCalls) {
              currentToolCalls = chunk.toolCalls;
            }
            if (chunk.done) {
              break;
            }
          }

          // Process tool calls
          if (currentToolCalls.length > 0) {
            for (const toolCall of currentToolCalls) {
              yield this.createEvent('tool_use', queryId, { toolCall });
              this.emit('toolUse', queryId, toolCall);

              // Execute the tool
              const toolResult = await this.executeTool(toolCall);
              yield this.createEvent('tool_result', queryId, { toolResult });
              this.emit('toolResult', queryId, toolResult);

              // Add tool messages to state
              state.messages.push({
                role: 'assistant',
                content: '',
                toolCalls: [toolCall],
              });
              state.messages.push({
                role: 'tool',
                content: JSON.stringify(toolResult.result),
                toolCallId: toolCall.id,
              });
            }
            continue; // Continue loop with tool results
          }
        } else {
          // Non-streaming mode
          const response = await this.provider.complete(
            state.messages,
            hasTools ? toolDefs : undefined
          );
          fullResponse = response.content;

          // Process tool calls
          if (response.toolCalls && response.toolCalls.length > 0) {
            for (const toolCall of response.toolCalls) {
              yield this.createEvent('tool_use', queryId, { toolCall });
              this.emit('toolUse', queryId, toolCall);

              const toolResult = await this.executeTool(toolCall);
              yield this.createEvent('tool_result', queryId, { toolResult });
              this.emit('toolResult', queryId, toolResult);

              state.messages.push({
                role: 'assistant',
                content: '',
                toolCalls: [toolCall],
              });
              state.messages.push({
                role: 'tool',
                content: JSON.stringify(toolResult.result),
                toolCallId: toolCall.id,
              });
            }
            continue;
          }
        }

        // No more tool calls, query complete
        break;
      }

      // Add final assistant message
      state.messages.push({ role: 'assistant', content: fullResponse });
      state.status = 'completed';
      state.completedAt = Date.now();

      // Emit complete event
      const completeEvent = this.createEvent('query_complete', queryId, {
        result: fullResponse,
        iterations: state.iterations,
        duration: (state.completedAt - (state.startedAt || Date.now())) / 1000,
      });
      this.emit('event', completeEvent);
      this.emit('queryComplete', queryId, fullResponse);
      yield completeEvent;
    } catch (error) {
      state.status = 'error';
      state.error = (error as Error).message;

      const errorEvent = this.createEvent('error', queryId, {
        message: (error as Error).message,
        stack: (error as Error).stack,
      });
      this.emit('event', errorEvent);
      this.emit('error', queryId, error as Error);
      yield errorEvent;
    }
  }

  /**
   * Execute a tool call
   */
  private async executeTool(toolCall: ToolCall): Promise<ToolResult> {
    const tool = this.tools.get(toolCall.name);

    if (!tool) {
      return {
        toolCallId: toolCall.id,
        result: null,
        error: `Tool not found: ${toolCall.name}`,
      };
    }

    try {
      const result = await tool.handler(toolCall);
      return {
        toolCallId: toolCall.id,
        result,
      };
    } catch (error) {
      return {
        toolCallId: toolCall.id,
        result: null,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Create a query event
   */
  private createEvent(
    type: QueryEventType,
    queryId: string,
    data: Record<string, unknown>
  ): QueryEvent {
    return {
      type,
      id: uuidv4(),
      timestamp: Date.now(),
      queryId,
      data,
    };
  }

  /**
   * Get query state
   */
  getQueryState(queryId: string): QueryState | undefined {
    return this.queries.get(queryId);
  }

  /**
   * Cancel a running query
   */
  cancelQuery(queryId: string): boolean {
    const state = this.queries.get(queryId);
    if (state && state.status === 'running') {
      state.status = 'completed';
      return true;
    }
    return false;
  }
}
