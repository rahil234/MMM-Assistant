Module.register('MMM-Assistant', {
  defaults: {
    llmEndpoint: 'http://localhost:11434/api/generate',
    model: 'llama3.1:8b',
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

    // spotifyModules.enumerate((mod) => {
    //   console.log('Spotify module instance:', mod);
    // });

    // setTimeout(() => {
    //   this.sendNotification('CURRENT_PLAYBACK');
    //
    //   this.sendSocketNotification('GENERATE_ANSWER', {
    //     prompt: 'set the volume to 30 percent',
    //   });
    // }, 2000);
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
        this.sendNotification('HOTWORD_ACTIVATE');
        this.sendNotification('SPEAK_STREAM_DONE', { text: this.response });

        setTimeout(() => {
          this.response = '';
          this.updateDom();
        }, 5000);
        break;
      case 'PLAY_SPOTIFY_MEDIA': {
        console.log('MMM-Assistant received PLAY_SPOTIFY_MEDIA:', payload);

        const media = payload.media || {};

        let type = 'track';
        let query = '';

        if (media.artist) {
          type = 'artist,playlist';
          query = media.artist;
        } else if (media.track) {
          type = 'track';
          query = media.track;
        } else if (media.album) {
          type = 'album';
          query = media.album;
        }

        query = query.toLowerCase().trim().replace(/\s+/g, '+');

        console.log('[MMM-Assistant] Playing media type', type);

        this.sendNotification('SPOTIFY_SEARCH', {
          type,
          query,
          random: false,
        });
        break;
      }

      case 'CONTROL_SPOTIFY_MEDIA': {
        const action = payload?.action;

        if (!action) {
          console.warn('[MMM-Assistant] No media control action provided');
          return;
        }

        console.log('[MMM-Assistant] Spotify control action:', action, payload);

        switch (action) {
          case 'play':
            // Toggle is safest because Spotify state may vary
            this.sendNotification('SPOTIFY_TOGGLE');
            break;

          case 'pause':
            this.sendNotification('SPOTIFY_PAUSE');
            break;

          case 'next':
            this.sendNotification('SPOTIFY_NEXT');
            break;

          case 'previous':
            this.sendNotification('SPOTIFY_PREVIOUS');
            break;

          case 'volume_up':
            this.sendNotification('SPOTIFY_VOLUME_UP', { step: 0.1 });
            break;

          case 'volume_down':
            this.sendNotification('SPOTIFY_VOLUME_DOWN', { step: 0.1 });
            break;

          case 'set_volume': {
            let volumePercent = payload?.volume_percent;
            if (typeof volumePercent === 'number') {
              volumePercent = Math.min(100, Math.max(0, volumePercent));
              this.sendNotification('SPOTIFY_VOLUME', volumePercent);
              console.log(
                '[MMM-Assistant] Setting Spotify volume to',
                volumePercent
              );
            } else {
              console.warn(
                '[MMM-Assistant] Invalid volume_percent for set_volume action:',
                volumePercent
              );
            }
            break;
          }
          default:
            console.warn('[MMM-Assistant] Unknown Spotify action:', action);
        }

        break;
      }

      case 'GET_SPOTIFY_CURRENTLY_PLAYING': {
        console.log(
          'MMM-Assistant received GET_SPOTIFY_CURRENTLY_PLAYING:',
          payload
        );

        const currentlyPlaying = this.spotifyModule
          ? this.spotifyModule.currentPlayback
          : {
              isPlaying: false,
              item: null,
            };

        this.sendSocketNotification('SPOTIFY_CURRENTLY_PLAYING_RESULT', {
          data: currentlyPlaying,
        });

        console.log(
          '[MMM-Assistant] Sent currently playing media:',
          currentlyPlaying
        );

        break;
      }

      // case 'GET_SPOTIFY_CURRENTLY_PLAYING': {
      //   this.sendSocketNotification('SPOTIFY_CURRENTLY_PLAYING_RESULT', {
      //     requestId: payload.requestId,
      //     data: this.spotifyModule
      //       ? this.spotifyModule.currentPlayback
      //       : {
      //           isPlaying: false,
      //           item: null,
      //         },
      //   });
      //   break;
      // }

      default:
        console.log(
          `MMM-Assistant: Unknown socket notification: ${notification}`
        );
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
      case 'DOM_OBJECTS_CREATED': {
        this.sendSocketNotification('INIT_CONFIG', this.config);
        this.spotifyModule = MM.getModules().withClass('MMM-Spotify')[0];
        break;
      }
      case 'WAKE_ASSISTANT':
        this.sendSocketNotification('WAKE_ASSISTANT');
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

          console.log(
            'MMM-Assistant: Final transcript received:',
            payload.text
          );
          this.transcript = payload.text;
          this.updateDom();
          setTimeout(() => {
            this.transcript = '';
            this.updateDom();
          }, 5000);
        }
        break;
      default:
        this.sendSocketNotification(notification, payload);
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
