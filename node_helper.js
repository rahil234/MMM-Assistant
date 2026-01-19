'use strict';

const NodeHelper = require('node_helper');
const { Ollama } = require('ollama');
const { StateGraph, Annotation } = require('@langchain/langgraph');
const Log = require('../../js/logger');
const awaitSocketOnce = require('./awaitSocketOnce');

module.exports = NodeHelper.create({
  systemPrompt:
    'You are Jarvis, a concise voice assistant used in a smart mirror called MagicMirror. ' +
    'When generating responses for text-to-speech, use plain spoken English. ' +
    'Do not use markdown, bullet points or formatting. ' +
    'Write complete sentences suitable for being read aloud. ' +
    'Answer concisely.',

  graphs: new Map(),

  async start() {
    console.log('[MMM-Assistant] Node helper started.');

    this.ollama = new Ollama({
      host: 'https://ollama.com',
      headers: {
        Authorization:
          'Bearer b0143b8717174089b9b984b1f9ba3bef.nxdj8ogKPsoLmA4lhjSW5oUl',
      },
    });
  },

  socketNotificationReceived(notification, payload) {
    switch (notification) {
      case 'INIT_CONFIG':
        this.config = payload;
        break;

      case 'GENERATE_ANSWER':
        this.handleChat(payload);
        break;
    }
  },

  setSocketIO(io) {
    this.io = io;

    Log.log(`Connecting socket for: ${this.name}`);

    io.of(this.name).on('connection', (socket) => {
      // register catch all.

      this.socket = socket;

      socket.onAny((notification, payload) => {
        this.socketNotificationReceived(notification, payload);
      });
    });
  },

  async getCurrentlyPlayingMedia() {
    return awaitSocketOnce(
      this,
      'GET_SPOTIFY_CURRENTLY_PLAYING',
      'SPOTIFY_CURRENTLY_PLAYING_RESULT'
    );
  },

  getGraph(sessionId) {
    if (this.graphs.has(sessionId)) {
      return this.graphs.get(sessionId);
    }

    const GraphState = Annotation.Root({
      messages: Annotation({
        reducer: (prev, next) => prev.concat(next),
        default: () => [{ role: 'system', content: this.systemPrompt }],
      }),
    });

    /* ───────────── LLM Node ───────────── */
    const llmNode = async (state) => {
      const response = await this.ollama.chat({
        model: this.config.model,
        messages: state.messages,
        tools: this.tools,
        stream: false,
      });

      return {
        messages: [...state.messages, response.message],
      };
    };

    /* ───────────── Tool Node ───────────── */
    const toolNode = async (state) => {
      const last = state.messages[state.messages.length - 1];
      if (!last?.tool_calls) return state;

      let messages = [...state.messages];

      for (const call of last.tool_calls) {
        const result = await this.executeTool(call);
        messages.push({
          role: 'tool',
          tool_name: call.function.name,
          callback_id: call.id,
          content: JSON.stringify(result),
        });
      }

      return { messages };
    };

    const graph = new StateGraph(GraphState)
      .addNode('llm', llmNode)
      .addNode('tool', toolNode)
      .addEdge('__start__', 'llm')
      .addConditionalEdges('llm', (state) => {
        const last = state.messages[state.messages.length - 1];
        return last?.tool_calls ? 'tool' : '__end__';
      })
      .addEdge('tool', 'llm')
      .compile();

    this.graphs.set(sessionId, graph);
    return graph;
  },

  async handleChat({ sessionId = 'default', prompt }) {
    const graph = this.getGraph(sessionId);

    const result = await graph.invoke(
      { messages: [{ role: 'user', content: prompt }] },
      { configurable: { thread_id: sessionId } }
    );

    const last = result.messages[result.messages.length - 1];

    if (last?.content) {
      this.sendSocketNotification('ASSISTANT_STREAM', {
        text: last.content,
      });
    }

    this.sendSocketNotification('ASSISTANT_STREAM_END');
  },

  async executeTool(call) {
    switch (call.function.name) {
      case 'getTime': {
        const now = new Date();
        return {
          time: now.toLocaleTimeString(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        };
      }

      case 'availableDevices':
        return {
          devices: [
            { name: 'Living Room Light', type: 'light', status: 'off' },
            { name: 'Thermostat', type: 'thermostat', status: '72°F' },
            { name: 'Smart Plug', type: 'plug', status: 'on' },
            { name: 'Door Lock', type: 'lock', status: 'locked' },
          ],
        };

      case 'controlDevice': {
        console.log(`[MMM-Assistant] Device control:`, call.function.arguments);
        return { status: 'Device controlled successfully' };
      }

      case 'currentlyPlayingMedia': {
        return await this.getCurrentlyPlayingMedia();
      }

      case 'playSongsOnSpotify': {
        console.log(`[MMM-Assistant] Media request:`, call.function.arguments);

        this.sendSocketNotification('PLAY_SPOTIFY_MEDIA', {
          media: call.function.arguments.media,
        });

        return { status: 'Media playback started successfully' };
      }

      case 'controlSpotifyMedia': {
        console.log(`[MMM-Assistant] Media control:`, call.function.arguments);

        this.sendSocketNotification('CONTROL_SPOTIFY_MEDIA', {
          action: call.function.arguments.action,
          volume_percent: call.function.arguments.volume_percent,
        });

        return { status: 'Media control executed successfully' };
      }

      default:
        return { error: 'Unknown tool call' };
    }
  },

  tools: [
    {
      type: 'function',
      function: {
        name: 'getTime',
        description: 'Get the current system time',
        parameters: { type: 'object', properties: {} },
      },
    },
    {
      type: 'function',
      function: {
        name: 'availableDevices',
        description: 'Get a list of available smart home devices',
        parameters: { type: 'object', properties: {} },
      },
    },
    {
      type: 'function',
      function: {
        name: 'controlDevice',
        description: 'Control a smart home device',
        parameters: {
          type: 'object',
          properties: {
            device: { type: 'string' },
            action: { type: 'string' },
          },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'playSongsOnSpotify',
        description:
          'Play media on Spotify.' +
          ' The media parameter can be a song name, artist, album, or playlist.',
        parameters: {
          type: 'object',
          properties: {
            media: {
              type: 'object',
              properties: {
                type: {
                  type: 'string',
                  enum: ['song', 'artist', 'album', 'playlist'],
                },
                name: { type: 'string' },
              },
            },
          },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'currentlyPlayingMedia',
        description:
          'Get the currently playing media on Spotify. ' +
          'Returns the media type, name, volume, playback device and artist/creator.',
        parameters: { type: 'object', properties: {} },
      },
    },
    {
      type: 'function',
      function: {
        name: 'controlSpotifyMedia',
        description:
          'Control media playback and volume on Spotify. ' +
          'Actions can be play, pause, next, previous, or set_volume. ' +
          'If action is set_volume, provide volume_percent between 0 and 100.' +
          'To mute or unmute, set volume_percent to 0 or above 0 respectively.',
        parameters: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['play', 'pause', 'next', 'previous', 'set_volume'],
            },
            volume_percent: { type: 'number', minimum: 0, maximum: 100 },
          },
        },
      },
    },
  ],
});
