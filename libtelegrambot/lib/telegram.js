'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var TelegramBotWebHook = require('./telegramWebHook');
var TelegramBotPolling = require('./telegramPolling');
var debug = require('debug')('node-telegram-bot-api');
var EventEmitter = require('eventemitter3');
var fileType = require('file-type');
var Promise = require('bluebird');
var request = require('request-promise');
var streamedRequest = require('request');
var qs = require('querystring');
var stream = require('stream');
var mime = require('mime');
var path = require('path');
var URL = require('url');
var fs = require('fs');
var pump = require('pump');
var deprecate = require('depd')('node-telegram-bot-api');

var _messageTypes = ['text', 'audio', 'document', 'photo', 'sticker', 'video', 'voice', 'contact', 'location', 'new_chat_participant', 'left_chat_participant', 'new_chat_title', 'new_chat_photo', 'delete_chat_photo', 'group_chat_created'];

// enable cancellation
Promise.config({
  cancellation: true
});

var TelegramBot = function (_EventEmitter) {
  _inherits(TelegramBot, _EventEmitter);

  _createClass(TelegramBot, null, [{
    key: 'messageTypes',
    get: function get() {
      return _messageTypes;
    }

    /**
     * Both request method to obtain messages are implemented. To use standard polling, set `polling: true`
     * on `options`. Notice that [webHook](https://core.telegram.org/bots/api#setwebhook) will need a SSL certificate.
     * Emits `message` when a message arrives.
     *
     * @class TelegramBot
     * @constructor
     * @param {String} token Bot Token
     * @param {Object} [options]
     * @param {Boolean|Object} [options.polling=false] Set true to enable polling or set options.
     *  If a WebHook has been set, it will be deleted automatically.
     * @param {String|Number} [options.polling.timeout=10] Timeout in seconds for long polling
     * @param {String|Number} [options.polling.interval=300] Interval between requests in miliseconds
     * @param {Boolean} [options.polling.autoStart=true] Start polling immediately
     * @param {Boolean|Object} [options.webHook=false] Set true to enable WebHook or set options
     * @param {Number} [options.webHook.port=8443] Port to bind to
     * @param {String} [options.webHook.key] Path to file with PEM private key for webHook server.
     *  The file is read **synchronously**!
     * @param {String} [options.webHook.cert] Path to file with PEM certificate (public) for webHook server.
     *  The file is read **synchronously**!
     * @param {String} [options.webHook.pfx] Path to file with PFX private key and certificate chain for webHook server.
     *  The file is read **synchronously**!
     * @param {Boolean} [options.webHook.autoOpen=true] Open webHook immediately
     * @param {Object} [options.webHook.https] Options to be passed to `https.createServer()`.
     *  Note that `options.webHook.key`, `options.webHook.cert` and `options.webHook.pfx`, if provided, will be
     *  used to override `key`, `cert` and `pfx` in this object, respectively.
     *  See https://nodejs.org/api/https.html#https_https_createserver_options_requestlistener for more information.
     * @param {Boolean} [options.onlyFirstMatch=false] Set to true to stop after first match. Otherwise, all regexps are executed
     * @param {Object} [options.request] Options which will be added for all requests to telegram api.
     *  See https://github.com/request/request#requestoptions-callback for more information.
     * @param {String} [options.baseApiUrl=https://api.telegram.org] API Base URl; useful for proxying and testing
     * @param {Boolean} [options.filepath=true] Allow passing file-paths as arguments when sending files,
     *  such as photos using `TelegramBot#sendPhoto()`. See [usage information][usage-sending-files-performance]
     *  for more information on this option and its consequences.
     * @see https://core.telegram.org/bots/api
     */

  }]);

  function TelegramBot(token) {
    var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

    _classCallCheck(this, TelegramBot);

    var _this = _possibleConstructorReturn(this, (TelegramBot.__proto__ || Object.getPrototypeOf(TelegramBot)).call(this));

    _this.token = token;
    _this.options = options;
    _this.options.polling = typeof options.polling === 'undefined' ? false : options.polling;
    _this.options.webHook = typeof options.webHook === 'undefined' ? false : options.webHook;
    _this.options.baseApiUrl = options.baseApiUrl || 'https://api.telegram.org';
    _this.options.filepath = typeof options.filepath === 'undefined' ? true : options.filepath;
    _this._textRegexpCallbacks = [];
    _this._onReplyToMessages = [];
    _this._polling = null;
    _this._webHook = null;

    if (options.polling) {
      var autoStart = options.polling.autoStart;
      if (typeof autoStart === 'undefined' || autoStart === true) {
        _this.startPolling();
      }
    }

    if (options.webHook) {
      var autoOpen = options.webHook.autoOpen;
      if (typeof autoOpen === 'undefined' || autoOpen === true) {
        _this.openWebHook();
      }
    }
    return _this;
  }

  /**
   * Generates url with bot token and provided path/method you want to be got/executed by bot
   * @param  {String} path
   * @return {String} url
   * @private
   * @see https://core.telegram.org/bots/api#making-requests
   */


  _createClass(TelegramBot, [{
    key: '_buildURL',
    value: function _buildURL(_path) {
      return this.options.baseApiUrl + '/bot' + this.token + '/' + _path;
    }

    /**
     * Fix 'reply_markup' parameter by making it JSON-serialized, as
     * required by the Telegram Bot API
     * @param {Object} obj Object; either 'form' or 'qs'
     * @private
     * @see https://core.telegram.org/bots/api#sendmessage
     */

  }, {
    key: '_fixReplyMarkup',
    value: function _fixReplyMarkup(obj) {
      var replyMarkup = obj.reply_markup;
      if (replyMarkup && typeof replyMarkup !== 'string') {
        obj.reply_markup = JSON.stringify(replyMarkup);
      }
    }

    /**
     * Make request against the API
     * @param  {String} _path API endpoint
     * @param  {Object} [options]
     * @private
     * @return {Promise}
     */

  }, {
    key: '_request',
    value: function _request(_path) {
      var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

      if (!this.token) {
        throw new Error('Telegram Bot Token not provided!');
      }

      if (this.options.request) {
        Object.assign(options, this.options.request);
      }

      if (options.form) {
        this._fixReplyMarkup(options.form);
      }
      if (options.qs) {
        this._fixReplyMarkup(options.qs);
      }

      options.method = 'POST';
      options.url = this._buildURL(_path);
      options.simple = false;
      options.resolveWithFullResponse = true;
      options.forever = true;
      debug('HTTP request: %j', options);
      return request(options).then(function (resp) {
        if (resp.statusCode !== 200) {
          var _error = new Error(resp.statusCode + ' ' + resp.body);
          _error.response = resp;
          throw _error;
        }

        var data = void 0;

        try {
          data = JSON.parse(resp.body);
        } catch (err) {
          var _error2 = new Error('Error parsing Telegram response: ' + resp.body);
          _error2.response = resp;
          throw _error2;
        }

        if (data.ok) {
          return data.result;
        }

        var error = new Error(data.error_code + ' ' + data.description);
        error.response = resp;
        error.response.body = data;
        throw error;
      });
    }

    /**
     * Format data to be uploaded; handles file paths, streams and buffers
     * @param  {String} type
     * @param  {String|stream.Stream|Buffer} data
     * @return {Array} formatted
     * @return {Object} formatted[0] formData
     * @return {String} formatted[1] fileId
     * @throws Error if Buffer file type is not supported.
     * @see https://npmjs.com/package/file-type
     * @private
     */

  }, {
    key: '_formatSendData',
    value: function _formatSendData(type, data) {
      var formData = void 0;
      var fileName = void 0;
      var fileId = void 0;
      if (data instanceof stream.Stream) {
        fileName = URL.parse(path.basename(data.path.toString())).pathname;
        formData = {};
        formData[type] = {
          value: data,
          options: {
            filename: qs.unescape(fileName),
            contentType: mime.lookup(fileName)
          }
        };
      } else if (Buffer.isBuffer(data)) {
        //const filetype = fileType(data);
        //if (!filetype) {
        //  throw new Error('Unsupported Buffer file type');
        //}
        formData = {};
        formData[type] = {
          value: data,
          options: {
            //filename: `data.${filetype.ext}`,
            filename: 'data',
            contentType: 'application/octet-streams'
          }
        };
      } else if (!this.options.filepath) {
        /**
         * When the constructor option 'filepath' is set to
         * 'false', we do not support passing file-paths.
         */
        fileId = data;
      } else if (fs.existsSync(data)) {
        fileName = path.basename(data);
        formData = {};
        formData[type] = {
          value: fs.createReadStream(data),
          options: {
            filename: fileName,
            contentType: mime.lookup(fileName)
          }
        };
      } else {
        fileId = data;
      }
      return [formData, fileId];
    }

    /**
     * Start polling.
     * Rejects returned promise if a WebHook is being used by this instance.
     * @param  {Object} [options]
     * @param  {Boolean} [options.restart=true] Consecutive calls to this method causes polling to be restarted
     * @return {Promise}
     */

  }, {
    key: 'startPolling',
    value: function startPolling() {
      var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

      if (this.hasOpenWebHook()) {
        return Promise.reject(new Error('Polling and WebHook are mutually exclusive'));
      }
      options.restart = typeof options.restart === 'undefined' ? true : options.restart;
      if (!this._polling) {
        this._polling = new TelegramBotPolling(this._request.bind(this), this.options.polling, this.processUpdate.bind(this));
      }
      return this._polling.start(options);
    }

    /**
     * Alias of `TelegramBot#startPolling()`. This is **deprecated**.
     * @param  {Object} [options]
     * @return {Promise}
     * @deprecated
     */

  }, {
    key: 'initPolling',
    value: function initPolling() {
      deprecate('TelegramBot#initPolling() is deprecated');
      return this.startPolling();
    }

    /**
     * Stops polling after the last polling request resolves.
     * Multiple invocations do nothing if polling is already stopped.
     * Returning the promise of the last polling request is **deprecated**.
     * @return {Promise}
     */

  }, {
    key: 'stopPolling',
    value: function stopPolling() {
      if (!this._polling) {
        return Promise.resolve();
      }
      return this._polling.stop();
    }

    /**
     * Return true if polling. Otherwise, false.
     * @return {Boolean}
     */

  }, {
    key: 'isPolling',
    value: function isPolling() {
      return this._polling ? this._polling.isPolling() : false;
    }

    /**
     * Open webhook.
     * Multiple invocations do nothing if webhook is already open.
     * Rejects returned promise if Polling is being used by this instance.
     * @return {Promise}
     */

  }, {
    key: 'openWebHook',
    value: function openWebHook() {
      if (this.isPolling()) {
        return Promise.reject(new Error('WebHook and Polling are mutually exclusive'));
      }
      if (!this._webHook) {
        this._webHook = new TelegramBotWebHook(this.token, this.options.webHook, this.processUpdate.bind(this));
      }
      return this._webHook.open();
    }

    /**
     * Close webhook after closing all current connections.
     * Multiple invocations do nothing if webhook is already closed.
     * @return {Promise} promise
     */

  }, {
    key: 'closeWebHook',
    value: function closeWebHook() {
      if (!this._webHook) {
        return Promise.resolve();
      }
      return this._webHook.close();
    }

    /**
     * Return true if using webhook and it is open i.e. accepts connections.
     * Otherwise, false.
     * @return {Boolean}
     */

  }, {
    key: 'hasOpenWebHook',
    value: function hasOpenWebHook() {
      return this._webHook ? this._webHook.isOpen() : false;
    }

    /**
     * Returns basic information about the bot in form of a `User` object.
     * @return {Promise}
     * @see https://core.telegram.org/bots/api#getme
     */

  }, {
    key: 'getMe',
    value: function getMe() {
      var _path = 'getMe';
      return this._request(_path);
    }

    /**
     * Specify an url to receive incoming updates via an outgoing webHook.
     * This method has an [older, compatible signature][setWebHook-v0.25.0]
     * that is being deprecated.
     *
     * @param  {String} url URL where Telegram will make HTTP Post. Leave empty to
     * delete webHook.
     * @param  {Object} [options] Additional Telegram query options
     * @param  {String|stream.Stream} [options.certificate] PEM certificate key (public).
     * @return {Promise}
     * @see https://core.telegram.org/bots/api#setwebhook
     */

  }, {
    key: 'setWebHook',
    value: function setWebHook(url) {
      var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

      /* The older method signature was setWebHook(url, cert).
       * We need to ensure backwards-compatibility while maintaining
       * consistency of the method signatures throughout the library */
      var cert = void 0;
      // Note: 'options' could be an object, if a stream was provided (in place of 'cert')
      if ((typeof options === 'undefined' ? 'undefined' : _typeof(options)) !== 'object' || options instanceof stream.Stream) {
        deprecate('The method signature setWebHook(url, cert) has been deprecated since v0.25.0');
        cert = options;
        options = {}; // eslint-disable-line no-param-reassign
      } else {
        cert = options.certificate;
      }

      var opts = {
        qs: options
      };
      opts.qs.url = url;

      if (cert) {
        try {
          var sendData = this._formatSendData('certificate', cert);
          opts.formData = sendData[0];
          opts.qs.certificate = sendData[1];
        } catch (ex) {
          return Promise.reject(ex);
        }
      }

      return this._request('setWebHook', opts).then(function (resp) {
        if (!resp) {
          throw new Error(resp);
        }

        return resp;
      });
    }

    /**
     * Use this method to remove webhook integration if you decide to
     * switch back to getUpdates. Returns True on success.
     * @return {Promise}
     * @see https://core.telegram.org/bots/api#deletewebhook
     */

  }, {
    key: 'deleteWebHook',
    value: function deleteWebHook() {
      return this._request('deleteWebhook');
    }

    /**
     * Use this method to get current webhook status.
     * On success, returns a [WebhookInfo](https://core.telegram.org/bots/api#webhookinfo) object.
     * If the bot is using getUpdates, will return an object with the
     * url field empty.
     * @return {Promise}
     * @see https://core.telegram.org/bots/api#getwebhookinfo
     */

  }, {
    key: 'getWebHookInfo',
    value: function getWebHookInfo() {
      return this._request('getWebhookInfo');
    }

    /**
     * Use this method to receive incoming updates using long polling.
     * This method has an [older, compatible signature][getUpdates-v0.25.0]
     * that is being deprecated.
     *
     * @param  {Object} [options] Additional Telegram query options
     * @return {Promise}
     * @see https://core.telegram.org/bots/api#getupdates
     */

  }, {
    key: 'getUpdates',
    value: function getUpdates() {
      var form = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

      /* The older method signature was getUpdates(timeout, limit, offset).
       * We need to ensure backwards-compatibility while maintaining
       * consistency of the method signatures throughout the library */
      if ((typeof form === 'undefined' ? 'undefined' : _typeof(form)) !== 'object') {
        /* eslint-disable no-param-reassign, prefer-rest-params */
        deprecate('The method signature getUpdates(timeout, limit, offset) has been deprecated since v0.25.0');
        form = {
          timeout: arguments[0],
          limit: arguments[1],
          offset: arguments[2]
        };
        /* eslint-enable no-param-reassign, prefer-rest-params */
      }

      return this._request('getUpdates', { form: form });
    }

    /**
     * Process an update; emitting the proper events and executing regexp
     * callbacks. This method is useful should you be using a different
     * way to fetch updates, other than those provided by TelegramBot.
     * @param  {Object} update
     * @see https://core.telegram.org/bots/api#update
     */

  }, {
    key: 'processUpdate',
    value: function processUpdate(update) {
      var _this2 = this;

      debug('Process Update %j', update);
      var message = update.message;
      var editedMessage = update.edited_message;
      var channelPost = update.channel_post;
      var editedChannelPost = update.edited_channel_post;
      var inlineQuery = update.inline_query;
      var chosenInlineResult = update.chosen_inline_result;
      var callbackQuery = update.callback_query;

      if (message) {
        debug('Process Update message %j', message);
        this.emit('message', message);
        var processMessageType = function processMessageType(messageType) {
          if (message[messageType]) {
            debug('Emitting %s: %j', messageType, message);
            _this2.emit(messageType, message);
          }
        };
        TelegramBot.messageTypes.forEach(processMessageType);
        if (message.text) {
          debug('Text message');
          this._textRegexpCallbacks.some(function (reg) {
            debug('Matching %s with %s', message.text, reg.regexp);
            var result = reg.regexp.exec(message.text);
            if (!result) {
              return false;
            }
            debug('Matches %s', reg.regexp);
            reg.callback(message, result);
            // returning truthy value exits .some
            return _this2.options.onlyFirstMatch;
          });
        }
        if (message.reply_to_message) {
          // Only callbacks waiting for this message
          this._onReplyToMessages.forEach(function (reply) {
            // Message from the same chat
            if (reply.chatId === message.chat.id) {
              // Responding to that message
              if (reply.messageId === message.reply_to_message.message_id) {
                // Resolve the promise
                reply.callback(message);
              }
            }
          });
        }
      } else if (editedMessage) {
        debug('Process Update edited_message %j', editedMessage);
        this.emit('edited_message', editedMessage);
        if (editedMessage.text) {
          this.emit('edited_message_text', editedMessage);
        }
        if (editedMessage.caption) {
          this.emit('edited_message_caption', editedMessage);
        }
      } else if (channelPost) {
        debug('Process Update channel_post %j', channelPost);
        this.emit('channel_post', channelPost);
      } else if (editedChannelPost) {
        debug('Process Update edited_channel_post %j', editedChannelPost);
        this.emit('edited_channel_post', editedChannelPost);
        if (editedChannelPost.text) {
          this.emit('edited_channel_post_text', editedChannelPost);
        }
        if (editedChannelPost.caption) {
          this.emit('edited_channel_post_caption', editedChannelPost);
        }
      } else if (inlineQuery) {
        debug('Process Update inline_query %j', inlineQuery);
        this.emit('inline_query', inlineQuery);
      } else if (chosenInlineResult) {
        debug('Process Update chosen_inline_result %j', chosenInlineResult);
        this.emit('chosen_inline_result', chosenInlineResult);
      } else if (callbackQuery) {
        debug('Process Update callback_query %j', callbackQuery);
        this.emit('callback_query', callbackQuery);
      }
    }

    /**
     * Send text message.
     * @param  {Number|String} chatId Unique identifier for the message recipient
     * @param  {String} text Text of the message to be sent
     * @param  {Object} [options] Additional Telegram query options
     * @return {Promise}
     * @see https://core.telegram.org/bots/api#sendmessage
     */

  }, {
    key: 'sendMessage',
    value: function sendMessage(chatId, text) {
      var form = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

      form.chat_id = chatId;
      form.text = text;
      return this._request('sendMessage', { form: form });
    }

    /**
     * Send answers to an inline query.
     * @param  {String} inlineQueryId Unique identifier of the query
     * @param  {InlineQueryResult[]} results An array of results for the inline query
     * @param  {Object} [options] Additional Telegram query options
     * @return {Promise}
     * @see https://core.telegram.org/bots/api#answerinlinequery
     */

  }, {
    key: 'answerInlineQuery',
    value: function answerInlineQuery(inlineQueryId, results) {
      var form = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

      form.inline_query_id = inlineQueryId;
      form.results = JSON.stringify(results);
      return this._request('answerInlineQuery', { form: form });
    }

    /**
     * Forward messages of any kind.
     * @param  {Number|String} chatId     Unique identifier for the message recipient
     * @param  {Number|String} fromChatId Unique identifier for the chat where the
     * original message was sent
     * @param  {Number|String} messageId  Unique message identifier
     * @param  {Object} [options] Additional Telegram query options
     * @return {Promise}
     */

  }, {
    key: 'forwardMessage',
    value: function forwardMessage(chatId, fromChatId, messageId) {
      var form = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};

      form.chat_id = chatId;
      form.from_chat_id = fromChatId;
      form.message_id = messageId;
      return this._request('forwardMessage', { form: form });
    }

    /**
     * Send photo
     * @param  {Number|String} chatId  Unique identifier for the message recipient
     * @param  {String|stream.Stream|Buffer} photo A file path or a Stream. Can
     * also be a `file_id` previously uploaded
     * @param  {Object} [options] Additional Telegram query options
     * @return {Promise}
     * @see https://core.telegram.org/bots/api#sendphoto
     */

  }, {
    key: 'sendPhoto',
    value: function sendPhoto(chatId, photo) {
      var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

      var opts = {
        qs: options
      };
      opts.qs.chat_id = chatId;
      try {
        var sendData = this._formatSendData('photo', photo);
        opts.formData = sendData[0];
        opts.qs.photo = sendData[1];
      } catch (ex) {
        return Promise.reject(ex);
      }
      return this._request('sendPhoto', opts);
    }

    /**
     * Send audio
     * @param  {Number|String} chatId  Unique identifier for the message recipient
     * @param  {String|stream.Stream|Buffer} audio A file path, Stream or Buffer.
     * Can also be a `file_id` previously uploaded.
     * @param  {Object} [options] Additional Telegram query options
     * @return {Promise}
     * @see https://core.telegram.org/bots/api#sendaudio
     */

  }, {
    key: 'sendAudio',
    value: function sendAudio(chatId, audio) {
      var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

      var opts = {
        qs: options
      };
      opts.qs.chat_id = chatId;
      try {
        var sendData = this._formatSendData('audio', audio);
        opts.formData = sendData[0];
        opts.qs.audio = sendData[1];
      } catch (ex) {
        return Promise.reject(ex);
      }
      return this._request('sendAudio', opts);
    }

    /**
     * Send Document
     * @param  {Number|String} chatId  Unique identifier for the message recipient
     * @param  {String|stream.Stream|Buffer} doc A file path, Stream or Buffer.
     * Can also be a `file_id` previously uploaded.
     * @param  {Object} [options] Additional Telegram query options
     * @param  {Object} [fileOpts] Optional file related meta-data
     * @return {Promise}
     * @see https://core.telegram.org/bots/api#sendDocument
     */

  }, {
    key: 'sendDocument',
    value: function sendDocument(chatId, doc) {
      var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
      var fileOpts = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};

      var opts = {
        qs: options
      };
      opts.qs.chat_id = chatId;
      try {
        var sendData = this._formatSendData('document', doc);
        opts.formData = sendData[0];
        opts.qs.document = sendData[1];
      } catch (ex) {
        return Promise.reject(ex);
      }
      if (opts.formData && Object.keys(fileOpts).length) {
        opts.formData.document.options = fileOpts;
      }
      return this._request('sendDocument', opts);
    }

    /**
     * Send .webp stickers.
     * @param  {Number|String} chatId  Unique identifier for the message recipient
     * @param  {String|stream.Stream|Buffer} sticker A file path, Stream or Buffer.
     * Can also be a `file_id` previously uploaded. Stickers are WebP format files.
     * @param  {Object} [options] Additional Telegram query options
     * @return {Promise}
     * @see https://core.telegram.org/bots/api#sendsticker
     */

  }, {
    key: 'sendSticker',
    value: function sendSticker(chatId, sticker) {
      var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

      var opts = {
        qs: options
      };
      opts.qs.chat_id = chatId;
      try {
        var sendData = this._formatSendData('sticker', sticker);
        opts.formData = sendData[0];
        opts.qs.sticker = sendData[1];
      } catch (ex) {
        return Promise.reject(ex);
      }
      return this._request('sendSticker', opts);
    }

    /**
     * Use this method to send video files, Telegram clients support mp4 videos (other formats may be sent as Document).
     * @param  {Number|String} chatId  Unique identifier for the message recipient
     * @param  {String|stream.Stream|Buffer} video A file path or Stream.
     * Can also be a `file_id` previously uploaded.
     * @param  {Object} [options] Additional Telegram query options
     * @return {Promise}
     * @see https://core.telegram.org/bots/api#sendvideo
     */

  }, {
    key: 'sendVideo',
    value: function sendVideo(chatId, video) {
      var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

      var opts = {
        qs: options
      };
      opts.qs.chat_id = chatId;
      try {
        var sendData = this._formatSendData('video', video);
        opts.formData = sendData[0];
        opts.qs.video = sendData[1];
      } catch (ex) {
        return Promise.reject(ex);
      }
      return this._request('sendVideo', opts);
    }

    /**
     * Send voice
     * @param  {Number|String} chatId  Unique identifier for the message recipient
     * @param  {String|stream.Stream|Buffer} voice A file path, Stream or Buffer.
     * Can also be a `file_id` previously uploaded.
     * @param  {Object} [options] Additional Telegram query options
     * @return {Promise}
     * @see https://core.telegram.org/bots/api#sendvoice
     */

  }, {
    key: 'sendVoice',
    value: function sendVoice(chatId, voice) {
      var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

      var opts = {
        qs: options
      };
      opts.qs.chat_id = chatId;
      try {
        var sendData = this._formatSendData('voice', voice);
        opts.formData = sendData[0];
        opts.qs.voice = sendData[1];
      } catch (ex) {
        return Promise.reject(ex);
      }
      return this._request('sendVoice', opts);
    }

    /**
     * Send chat action.
     * `typing` for text messages,
     * `upload_photo` for photos, `record_video` or `upload_video` for videos,
     * `record_audio` or `upload_audio` for audio files, `upload_document` for general files,
     * `find_location` for location data.
     *
     * @param  {Number|String} chatId  Unique identifier for the message recipient
     * @param  {String} action Type of action to broadcast.
     * @return {Promise}
     * @see https://core.telegram.org/bots/api#sendchataction
     */

  }, {
    key: 'sendChatAction',
    value: function sendChatAction(chatId, action) {
      var form = {
        action: action,
        chat_id: chatId
      };
      return this._request('sendChatAction', { form: form });
    }

    /**
     * Use this method to kick a user from a group or a supergroup.
     * In the case of supergroups, the user will not be able to return
     * to the group on their own using invite links, etc., unless unbanned
     * first. The bot must be an administrator in the group for this to work.
     * Returns True on success.
     *
     * @param  {Number|String} chatId  Unique identifier for the target group or username of the target supergroup
     * @param  {String} userId  Unique identifier of the target user
     * @return {Promise}
     * @see https://core.telegram.org/bots/api#kickchatmember
     */

  }, {
    key: 'kickChatMember',
    value: function kickChatMember(chatId, userId) {
      var form = {
        chat_id: chatId,
        user_id: userId
      };
      return this._request('kickChatMember', { form: form });
    }

    /**
     * Use this method to unban a previously kicked user in a supergroup.
     * The user will not return to the group automatically, but will be
     * able to join via link, etc. The bot must be an administrator in
     * the group for this to work. Returns True on success.
     *
     * @param  {Number|String} chatId  Unique identifier for the target group or username of the target supergroup
     * @param  {String} userId  Unique identifier of the target user
     * @return {Promise}
     * @see https://core.telegram.org/bots/api#unbanchatmember
     */

  }, {
    key: 'unbanChatMember',
    value: function unbanChatMember(chatId, userId) {
      var form = {
        chat_id: chatId,
        user_id: userId
      };
      return this._request('unbanChatMember', { form: form });
    }

    /**
     * Use this method to send answers to callback queries sent from
     * inline keyboards. The answer will be displayed to the user as
     * a notification at the top of the chat screen or as an alert.
     * On success, True is returned.
     *
     * @param  {Number|String} callbackQueryId  Unique identifier for the query to be answered
     * @param  {String} text  Text of the notification. If not specified, nothing will be shown to the user
     * @param  {Boolean} showAlert  Whether to show an alert or a notification at the top of the screen
     * @param  {Object} [options] Additional Telegram query options
     * @return {Promise}
     * @see https://core.telegram.org/bots/api#answercallbackquery
     */

  }, {
    key: 'answerCallbackQuery',
    value: function answerCallbackQuery(callbackQueryId, text, showAlert) {
      var form = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};

      form.callback_query_id = callbackQueryId;
      form.text = text;
      form.show_alert = showAlert;
      return this._request('answerCallbackQuery', { form: form });
    }

    /**
     * Use this method to edit text messages sent by the bot or via
     * the bot (for inline bots). On success, the edited Message is
     * returned.
     *
     * Note that you must provide one of chat_id, message_id, or
     * inline_message_id in your request.
     *
     * @param  {String} text  New text of the message
     * @param  {Object} [options] Additional Telegram query options (provide either one of chat_id, message_id, or inline_message_id here)
     * @return {Promise}
     * @see https://core.telegram.org/bots/api#editmessagetext
     */

  }, {
    key: 'editMessageText',
    value: function editMessageText(text) {
      var form = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

      form.text = text;
      return this._request('editMessageText', { form: form });
    }

    /**
     * Use this method to edit captions of messages sent by the
     * bot or via the bot (for inline bots). On success, the
     * edited Message is returned.
     *
     * Note that you must provide one of chat_id, message_id, or
     * inline_message_id in your request.
     *
     * @param  {String} caption  New caption of the message
     * @param  {Object} [options] Additional Telegram query options (provide either one of chat_id, message_id, or inline_message_id here)
     * @return {Promise}
     * @see https://core.telegram.org/bots/api#editmessagecaption
     */

  }, {
    key: 'editMessageCaption',
    value: function editMessageCaption(caption) {
      var form = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

      form.caption = caption;
      return this._request('editMessageCaption', { form: form });
    }

    /**
     * Use this method to edit only the reply markup of messages
     * sent by the bot or via the bot (for inline bots).
     * On success, the edited Message is returned.
     *
     * Note that you must provide one of chat_id, message_id, or
     * inline_message_id in your request.
     *
     * @param  {Object} replyMarkup  A JSON-serialized object for an inline keyboard.
     * @param  {Object} [options] Additional Telegram query options (provide either one of chat_id, message_id, or inline_message_id here)
     * @return {Promise}
     * @see https://core.telegram.org/bots/api#editmessagetext
     */

  }, {
    key: 'editMessageReplyMarkup',
    value: function editMessageReplyMarkup(replyMarkup) {
      var form = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

      form.reply_markup = replyMarkup;
      return this._request('editMessageReplyMarkup', { form: form });
    }

    /**
     * Use this method to get a list of profile pictures for a user.
     * Returns a [UserProfilePhotos](https://core.telegram.org/bots/api#userprofilephotos) object.
     * This method has an [older, compatible signature][getUserProfilePhotos-v0.25.0]
     * that is being deprecated.
     *
     * @param  {Number|String} userId  Unique identifier of the target user
     * @param  {Object} [options] Additional Telegram query options
     * @return {Promise}
     * @see https://core.telegram.org/bots/api#getuserprofilephotos
     */

  }, {
    key: 'getUserProfilePhotos',
    value: function getUserProfilePhotos(userId) {
      var form = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

      /* The older method signature was getUserProfilePhotos(userId, offset, limit).
       * We need to ensure backwards-compatibility while maintaining
       * consistency of the method signatures throughout the library */
      if ((typeof form === 'undefined' ? 'undefined' : _typeof(form)) !== 'object') {
        /* eslint-disable no-param-reassign, prefer-rest-params */
        deprecate('The method signature getUserProfilePhotos(userId, offset, limit) has been deprecated since v0.25.0');
        form = {
          offset: arguments[1],
          limit: arguments[2]
        };
        /* eslint-enable no-param-reassign, prefer-rest-params */
      }
      form.user_id = userId;
      return this._request('getUserProfilePhotos', { form: form });
    }

    /**
     * Send location.
     * Use this method to send point on the map.
     *
     * @param  {Number|String} chatId  Unique identifier for the message recipient
     * @param  {Float} latitude Latitude of location
     * @param  {Float} longitude Longitude of location
     * @param  {Object} [options] Additional Telegram query options
     * @return {Promise}
     * @see https://core.telegram.org/bots/api#sendlocation
     */

  }, {
    key: 'sendLocation',
    value: function sendLocation(chatId, latitude, longitude) {
      var form = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};

      form.chat_id = chatId;
      form.latitude = latitude;
      form.longitude = longitude;
      return this._request('sendLocation', { form: form });
    }

    /**
     * Send venue.
     * Use this method to send information about a venue.
     *
     * @param  {Number|String} chatId  Unique identifier for the message recipient
     * @param  {Float} latitude Latitude of location
     * @param  {Float} longitude Longitude of location
     * @param  {String} title Name of the venue
     * @param  {String} address Address of the venue
     * @param  {Object} [options] Additional Telegram query options
     * @return {Promise}
     * @see https://core.telegram.org/bots/api#sendvenue
     */

  }, {
    key: 'sendVenue',
    value: function sendVenue(chatId, latitude, longitude, title, address) {
      var form = arguments.length > 5 && arguments[5] !== undefined ? arguments[5] : {};

      form.chat_id = chatId;
      form.latitude = latitude;
      form.longitude = longitude;
      form.title = title;
      form.address = address;
      return this._request('sendVenue', { form: form });
    }

    /**
     * Send contact.
     * Use this method to send phone contacts.
     *
     * @param  {Number|String} chatId  Unique identifier for the message recipient
     * @param  {String} phoneNumber Contact's phone number
     * @param  {String} firstName Contact's first name
     * @param  {Object} [options] Additional Telegram query options
     * @return {Promise}
     * @see https://core.telegram.org/bots/api#sendcontact
     */

  }, {
    key: 'sendContact',
    value: function sendContact(chatId, phoneNumber, firstName) {
      var form = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};

      form.chat_id = chatId;
      form.phone_number = phoneNumber;
      form.first_name = firstName;
      return this._request('sendContact', { form: form });
    }

    /**
     * Get file.
     * Use this method to get basic info about a file and prepare it for downloading.
     * Attention: link will be valid for 1 hour.
     *
     * @param  {String} fileId  File identifier to get info about
     * @return {Promise}
     * @see https://core.telegram.org/bots/api#getfile
     */

  }, {
    key: 'getFile',
    value: function getFile(fileId) {
      var form = { file_id: fileId };
      return this._request('getFile', { form: form });
    }

    /**
     * Get link for file.
     * Use this method to get link for file for subsequent use.
     * Attention: link will be valid for 1 hour.
     *
     * This method is a sugar extension of the (getFile)[#getfilefileid] method,
     * which returns just path to file on remote server (you will have to manually build full uri after that).
     *
     * @param  {String} fileId  File identifier to get info about
     * @return {Promise} promise Promise which will have *fileURI* in resolve callback
     * @see https://core.telegram.org/bots/api#getfile
     */

  }, {
    key: 'getFileLink',
    value: function getFileLink(fileId) {
      var _this3 = this;

      return this.getFile(fileId).then(function (resp) {
        return _this3.options.baseApiUrl + '/file/bot' + _this3.token + '/' + resp.file_path;
      });
    }

    /**
     * Downloads file in the specified folder.
     * This is just a sugar for (getFile)[#getfilefiled] method
     *
     * @param  {String} fileId  File identifier to get info about
     * @param  {String} downloadDir Absolute path to the folder in which file will be saved
     * @return {Promise} promise Promise, which will have *filePath* of downloaded file in resolve callback
     */

  }, {
    key: 'downloadFile',
    value: function downloadFile(fileId, downloadDir) {
      return this.getFileLink(fileId).then(function (fileURI) {
        var fileName = fileURI.slice(fileURI.lastIndexOf('/') + 1);
        // TODO: Ensure fileName doesn't contains slashes
        var filePath = downloadDir + '/' + fileName;

        // properly handles errors and closes all streams
        return Promise.fromCallback(function (next) {
          pump(streamedRequest({ uri: fileURI }), fs.createWriteStream(filePath), next);
        }).return(filePath);
      });
    }

    /**
     * Register a RegExp to test against an incomming text message.
     * @param  {RegExp}   regexp       RegExp to be executed with `exec`.
     * @param  {Function} callback     Callback will be called with 2 parameters,
     * the `msg` and the result of executing `regexp.exec` on message text.
     */

  }, {
    key: 'onText',
    value: function onText(regexp, callback) {
      this._textRegexpCallbacks.push({ regexp: regexp, callback: callback });
    }

    /**
     * Register a reply to wait for a message response.
     * @param  {Number|String}   chatId       The chat id where the message cames from.
     * @param  {Number|String}   messageId    The message id to be replied.
     * @param  {Function} callback     Callback will be called with the reply
     * message.
     */

  }, {
    key: 'onReplyToMessage',
    value: function onReplyToMessage(chatId, messageId, callback) {
      this._onReplyToMessages.push({
        chatId: chatId,
        messageId: messageId,
        callback: callback
      });
    }

    /**
     * Use this method to get up to date information about the chat
     * (current name of the user for one-on-one conversations, current
     * username of a user, group or channel, etc.).
     * @param  {Number|String} chatId Unique identifier for the target chat or username of the target supergroup or channel
     * @return {Promise}
     * @see https://core.telegram.org/bots/api#getchat
     */

  }, {
    key: 'getChat',
    value: function getChat(chatId) {
      var form = {
        chat_id: chatId
      };
      return this._request('getChat', { form: form });
    }

    /**
     * Returns the administrators in a chat in form of an Array of `ChatMember` objects.
     * @param  {Number|String} chatId  Unique identifier for the target group or username of the target supergroup
     * @return {Promise}
     * @see https://core.telegram.org/bots/api#getchatadministrators
     */

  }, {
    key: 'getChatAdministrators',
    value: function getChatAdministrators(chatId) {
      var form = {
        chat_id: chatId
      };
      return this._request('getChatAdministrators', { form: form });
    }

    /**
     * Use this method to get the number of members in a chat.
     * @param  {Number|String} chatId  Unique identifier for the target group or username of the target supergroup
     * @return {Promise}
     * @see https://core.telegram.org/bots/api#getchatmemberscount
     */

  }, {
    key: 'getChatMembersCount',
    value: function getChatMembersCount(chatId) {
      var form = {
        chat_id: chatId
      };
      return this._request('getChatMembersCount', { form: form });
    }

    /**
     * Use this method to get information about a member of a chat.
     * @param  {Number|String} chatId  Unique identifier for the target group or username of the target supergroup
     * @param  {String} userId  Unique identifier of the target user
     * @return {Promise}
     * @see https://core.telegram.org/bots/api#getchatmember
     */

  }, {
    key: 'getChatMember',
    value: function getChatMember(chatId, userId) {
      var form = {
        chat_id: chatId,
        user_id: userId
      };
      return this._request('getChatMember', { form: form });
    }

    /**
     * Leave a group, supergroup or channel.
     * @param  {Number|String} chatId Unique identifier for the target group or username of the target supergroup (in the format @supergroupusername)
     * @return {Promise}
     * @see https://core.telegram.org/bots/api#leavechat
     */

  }, {
    key: 'leaveChat',
    value: function leaveChat(chatId) {
      var form = {
        chat_id: chatId
      };
      return this._request('leaveChat', { form: form });
    }

    /**
     * Use this method to send a game.
     * @param  {Number|String} chatId Unique identifier for the message recipient
     * @param  {String} gameShortName name of the game to be sent.
     * @param  {Object} [options] Additional Telegram query options
     * @return {Promise}
     * @see https://core.telegram.org/bots/api#sendgame
     */

  }, {
    key: 'sendGame',
    value: function sendGame(chatId, gameShortName) {
      var form = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

      form.chat_id = chatId;
      form.game_short_name = gameShortName;
      return this._request('sendGame', { form: form });
    }

    /**
     * Use this method to set the score of the specified user in a game.
     * @param  {String} userId  Unique identifier of the target user
     * @param  {Number} score New score value.
     * @param  {Object} [options] Additional Telegram query options
     * @return {Promise}
     * @see https://core.telegram.org/bots/api#setgamescore
     */

  }, {
    key: 'setGameScore',
    value: function setGameScore(userId, score) {
      var form = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

      form.user_id = userId;
      form.score = score;
      return this._request('setGameScore', { form: form });
    }

    /**
     * Use this method to get data for high score table.
     * @param  {String} userId  Unique identifier of the target user
     * @param  {Object} [options] Additional Telegram query options
     * @return {Promise}
     * @see https://core.telegram.org/bots/api#getgamehighscores
     */

  }, {
    key: 'getGameHighScores',
    value: function getGameHighScores(userId) {
      var form = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

      form.user_id = userId;
      return this._request('getGameHighScores', { form: form });
    }
  }]);

  return TelegramBot;
}(EventEmitter);

module.exports = TelegramBot;