'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var debug = require('debug')('node-telegram-bot-api');
var ANOTHER_WEB_HOOK_USED = 409;

var TelegramBotPolling = function () {
  /**
   * Handles polling against the Telegram servers.
   *
   * @param  {Function} request Function used to make HTTP requests
   * @param  {Boolean|Object} options Polling options
   * @param  {Number} [options.timeout=10] Timeout in seconds for long polling
   * @param  {Number} [options.interval=300] Interval between requests in milliseconds
   * @param  {Function} callback Function for processing a new update
   * @see https://core.telegram.org/bots/api#getupdates
   */
  function TelegramBotPolling(request) {
    var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    var callback = arguments[2];

    _classCallCheck(this, TelegramBotPolling);

    /* eslint-disable no-param-reassign */
    if (typeof options === 'function') {
      callback = options;
      options = {};
    } else if (typeof options === 'boolean') {
      options = {};
    }
    /* eslint-enable no-param-reassign */

    this.request = request;
    this.options = options;
    this.options.timeout = typeof options.timeout === 'number' ? options.timeout : 10;
    this.options.interval = typeof options.interval === 'number' ? options.interval : 300;
    this.callback = callback;
    this._offset = 0;
    this._lastUpdate = 0;
    this._lastRequest = null;
    this._abort = false;
    this._pollingTimeout = null;
  }

  /**
   * Start polling
   * @param  {Object} [options]
   * @param  {Object} [options.restart]
   * @return {Promise}
   */


  _createClass(TelegramBotPolling, [{
    key: 'start',
    value: function start() {
      var _this = this;

      var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

      if (this._lastRequest) {
        if (!options.restart) {
          return Promise.resolve();
        }
        return this.stop({
          cancel: true,
          reason: 'Polling restart'
        }).then(function () {
          return _this._polling();
        });
      }
      return this._polling();
    }

    /**
     * Stop polling
     * @param  {Object} [options]
     * @param  {Boolean} [options.cancel] Cancel current request
     * @param  {String} [options.reason] Reason for stopping polling
     * @return {Promise}
     */

  }, {
    key: 'stop',
    value: function stop() {
      var _this2 = this;

      var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

      if (!this._lastRequest) {
        return Promise.resolve();
      }
      var lastRequest = this._lastRequest;
      this._lastRequest = null;
      clearTimeout(this._pollingTimeout);
      if (options.cancel) {
        var reason = options.reason || 'Polling stop';
        lastRequest.cancel(reason);
        return Promise.resolve();
      }
      this._abort = true;
      return lastRequest.finally(function () {
        _this2._abort = false;
      });
    }

    /**
     * Return `true` if is polling. Otherwise, `false`.
     */

  }, {
    key: 'isPolling',
    value: function isPolling() {
      return !!this._lastRequest;
    }

    /**
     * Invokes polling (with recursion!)
     * @return {Promise} promise of the current request
     * @private
     */

  }, {
    key: '_polling',
    value: function _polling() {
      var _this3 = this;

      this._lastRequest = this._getUpdates().then(function (updates) {
        _this3._lastUpdate = Date.now();
        debug('polling data %j', updates);
        updates.forEach(function (update) {
          _this3._offset = update.update_id;
          debug('updated offset: %s', _this3._offset);
          _this3.callback(update);
        });
      }).catch(function (err) {
        debug('polling error: %s', err.message);
        throw err;
      }).finally(function () {
        if (_this3._abort) {
          debug('Polling is aborted!');
        } else {
          debug('setTimeout for %s miliseconds', _this3.options.interval);
          _this3._pollingTimeout = setTimeout(function () {
            return _this3._polling();
          }, _this3.options.interval);
        }
      });
      return this._lastRequest;
    }

    /**
     * Unset current webhook. Used when we detect that a webhook has been set
     * and we are trying to poll. Polling and WebHook are mutually exclusive.
     * @see https://core.telegram.org/bots/api#getting-updates
     * @private
     */

  }, {
    key: '_unsetWebHook',
    value: function _unsetWebHook() {
      return this.request('setWebHook');
    }

    /**
     * Retrieve updates
     */

  }, {
    key: '_getUpdates',
    value: function _getUpdates() {
      var _this4 = this;

      var opts = {
        qs: {
          offset: this._offset + 1,
          limit: this.options.limit,
          timeout: this.options.timeout
        }
      };
      debug('polling with options: %j', opts);

      return this.request('getUpdates', opts).catch(function (err) {
        if (err.response.statusCode === ANOTHER_WEB_HOOK_USED) {
          return _this4._unsetWebHook();
        }
        throw err;
      });
    }
  }]);

  return TelegramBotPolling;
}();

module.exports = TelegramBotPolling;