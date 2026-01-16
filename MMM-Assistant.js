Module.register('MMM-Assistant', {
  defaults: {
    llmEndpoint: 'http://localhost:11434/api/generate',
    model: 'llama3.1:8b',
    systemPrompt:
      'You are a helpful voice assistant for a MagicMirror. Answer concisely.',
    responseClearDelay: 5000,
    volume: 0.5,
  },

  /**
   * Apply the default styles.
   */
  getStyles() {
    return ['MMM-Assistant.css'];
  },

  /**
   * Pseudo-constructor for our module. Initialize stuff here.
   */
  start() {
    // set timeout for next random text
    console.log('MMM-Assistant started.');
    this.transcript = '';
    this.lastContext = undefined;
    this.response = '';

    this.sendSocketNotification('INIT_CONFIG', this.config);
  },

  /**
   * Handle notifications received by the node helper.
   * So we can communicate between the node helper and the module.
   *
   * @param {string} notification - The notification identifier.
   * @param {any} payload - The payload data`returned by the node helper.
   */
  socketNotificationReceived: function (notification, payload) {
    switch (notification) {
      case 'ASSISTANT_RESPONSE':
        console.log('MMM-Assistant received response:', payload);
        if (payload.context) {
          this.lastContext = payload.context;
        }

        this.response = payload.text;

        this.sendNotification('PLAY_SOUND', { sound: 'response', volume: 0.5 });
        this.sendNotification('SPEAK_TEXT', { text: payload.text });

        setTimeout(() => {
          this.response = '';
          this.updateDom();
        }, 5000);

        this.updateDom();
        break;
      case 'ASSISTANT_STREAM':
        console.log('MMM-Assistant received stream chunk:', payload);
        this.response += payload.text;
        this.sendNotification('SPEAK_STREAM', { text: payload.text });

        this.updateDom();
        break;
      case 'ASSISTANT_STREAM_END':
        console.log('MMM-Assistant stream ended.');
        this.sendNotification('PLAY_SOUND', { sound: 'response', volume: 0.5 });
        this.sendNotification('SPEAK_STREAM_DONE', { text: this.response });

        setTimeout(() => {
          this.response = '';
          this.updateDom();
        }, 5000);
        break;
    }
  },

  /**
   * This is the place to receive notifications from other modules or the system.
   *
   * @param {string} notification The notification ID, it is preferred that it prefixes your module name
   * @param {number} payload the payload type.
   */
  notificationReceived(notification, payload) {
    switch (notification) {
      case 'WAKE_ASSISTANT':
        this.sendSocketNotification('WAKE_ASSISTANT');
        this.sendNotification('PLAY_SOUND', { sound: 'jarvis', volume: 0.5 });
        this.sendNotification('START_TRANSCRIPT');
        break;
      case 'CANCEL_ASSISTANT':
        this.sendSocketNotification('CANCEL_ASSISTANT');
        this.sendNotification('PLAY_SOUND', {
          sound: 'cancelled',
          volume: 0.5,
        });
        this.sendNotification('STOP_TRANSCRIPT');
        break;
      case 'PROCESS_TRANSCRIPT':
        console.log('MMM-Assistant processing transcript:', payload);
        if (!payload || !payload.text) {
          console.log('MMM-Assistant: No transcript text to process.');
          return;
        } else if (payload.partial) {
          console.log('MMM-Assistant: Ignoring partial transcript.');
          this.transcript = payload.text;
          this.updateDom();
          return;
        } else {
          this.sendSocketNotification('GENERATE_ANSWER', {
            prompt: payload.text,
            context: this.lastContext,
          });

          this.transcript = payload.text;
          this.updateDom();
          setTimeout(() => {
            this.transcript = '';
            this.updateDom();
          }, 5000);
        }
        break;
    }
  },

  /**
   * Render the page we're on.
   */
  getDom() {
    const wrapper = document.createElement('div');

    const promptContainer = document.createElement('div');
    promptContainer.className = 'prompt-container';
    promptContainer.innerHTML = this.transcript;

    wrapper.appendChild(promptContainer);

    const responseContainer = document.createElement('div');
    responseContainer.className = 'response-container';
    responseContainer.innerHTML = this.response;

    wrapper.appendChild(responseContainer);

    wrapper.className = 'MMM-Assistant';
    return wrapper;
  },
});
