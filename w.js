(function(window, document) {
  "use strict";

  var Woopra = {};

  var console = window.console;

  /*
   * Helper functions
   */

  Woopra.CONSTANTS = {
    EVENT_ENDPOINT: window.location.protocol + '//www.woopra.com/track/ce/',
    PING_ENDPOINT: window.location.protocol + '//www.woopra.com/track/x/'
  };

  Woopra.extend = function(o1, o2) {
    for (var key in o2) {
      o1[key] = o2[key];
    }
  };

  Woopra.readCookie = function(name) {
    if (name === '') {
      return '';
    }
    var c = "" + document.cookie;

    var i = c.indexOf(name);
    if (i === -1){
      return "";
    }
    var k = c.indexOf(';', i);
    if (k === -1){
      k = c.length;
    }

    return window.unescape(c.substring(i + name.length + 1, k));
  };

  Woopra.setCookie = function(k, v, exp, domain, path) {
    var cookie = [];
    cookie.push(k + '=' + v);
    cookie.push('expires=' + exp);
    cookie.push('path=' + path);
    cookie.push('domain=.' + domain);

    document.cookie = cookie.join('; ');
  };

  Woopra.getCampaignData = function(url) {
    var vars = Woopra.getUrlParams();
    var campaign = {};
    var campaignKeys = ['source', 'medium', 'content', 'campaign', 'term'];
    for (var i=0;i<campaignKeys.length;i++) {
      var key = campaignKeys[i];
      var value = vars['utm_' + key] || vars['woo_' + key];
      if (typeof value != 'undefined') {
        campaign['campaign_' + ((key=='campaign')?'name':key)] = value; 
      }
    }
    return campaign;
  };

  Woopra.getUrlParams = function(url) {
    var vars = {};
    window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, function(m,key,value) {
      vars[key] = decodeURIComponent(value.split("+").join(" "));
    });
    return vars;
  };

  Woopra.buildUrlParams = function(params, prefix) {
    if (typeof params == 'undefined') {
      return params;
    }

    prefix = prefix || '';
    var p=[];
    for (var key in params) {
      p.push(prefix + encodeURIComponent(key) + '=' + encodeURIComponent(params[key]));
    }
    console.log(params, p.join('&'));
    return p.join('&');
  };

  Woopra.randomString = function(){
    var chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    var s = '';
    for (var i = 0; i < 12; i++) {
      var rnum = Math.floor(Math.random() * chars.length);
      s += chars.substring(rnum, rnum + 1);
    }
    return s;
  };

  Woopra.loadScript = function(url, callback) {
    var ssc,
        script = document.createElement('script');

    script.type = 'text/javascript';
    script.src = url;
    script.async = true;

    if (typeof script.onreadystatechange != 'undefined') {
      script.onreadystatechange = function() {
        if (this.readyState === 'complete'|| this.readyState === 'loaded') {
          if (callback) {
            callback();
          }
          Woopra.removeScript(script);
        }
      };
    } else {
      script.onload = function(){
        if (callback) {
          callback();
        }
        Woopra.removeScript(script);
      };
    }


    ssc = document.getElementsByTagName('script')[0];
    ssc.parentNode.insertBefore(script, ssc);
  };

  Woopra.removeScript = function(script) {
    script.parentNode.removeChild(script);
  };

  Woopra.getHost = function() {
    return window.location.host.replace('www.','');
  };

  Woopra.endsWith = function(str, suffix) {
    //console.log('endsWidth', str, suffix);
    return str.indexOf(suffix, str.length - suffix.length) !== -1;
  };


  var Tracker = function(instanceName) {
    this.visitorData = {};
    this.visitData = {};
    this.options = {};
    this.instanceName = instanceName;
    this.idle = 0;
    this.cookie = '';
    this._loaded = false;
  };

  Tracker.prototype = {
    init: function(instanceName) {
      this._setOptions();
      this._processQueue('config');
      this._setupCookie();
      this._loaded = true;
      this._processQueue();
    },

    /**
     * Processes the tracker queue in case user tries to push events
     * before tracker is ready.
     */
    _processQueue: function(type) {
      var i,
          action,
          events,
          _wpt = window._wpt[this.instanceName];

      if (_wpt && _wpt._e) {
        events = _wpt._e;
        for (i = 0; i < events.length; i++) {
          action = events[i];
          if (typeof action !== 'undefined' && this[action[0]] &&
            (typeof type === 'undefined' || type === action[0])) {
            this[action[0]].apply(this, Array.prototype.slice.call(action, 1));
          }
        }
      }
    },

    /**
     * Sets the initial options
     */
    _setOptions: function() {
      var exp = new Date();

      // Set default options
      exp.setDate(exp.getDate()+365);
      this.config({
        domain : Woopra.getHost(),
        cookie_name : 'wooTracker',
        cookie_domain : null,
        cookie_path : '/',
        cookie_expire : exp,
        ping : true,
        ping_interval : 12000,
        idle_timeout : 300000,
        download_pause : 200,
        outgoing_pause : 400,
        download_tracking : true,
        outgoing_tracking : true,
        ignore_query_url: true
      });
    },

    /**
     * Sets up the tracking cookie
     */
    _setupCookie: function() {
      // Setup cookie
      this.cookie = Woopra.readCookie(this.config('cookie_name'));
      if (this.cookie && this.cookie.length > 0) {
      }
      else {
        this.cookie = Woopra.randomString();
      }

      if (this.config('cookie_domain') === null) {
        if (Woopra.endsWith(window.location.host, '.' + this.config('domain'))) {
          this.config('cookie_domain', this.config('domain'));
        } else {
          this.config('cookie_domain', Woopra.getHost());
        }
      }
      Woopra.setCookie(
        this.config('cookie_name'),
        this.cookie,
        this.config('cookie_exp'),
        this.config('cookie_domain'),
        this.config('cookie_path')
      );
    },

    /**
     * Sets/gets values from dataStore depending on arguments passed
     *
     * @param dataStore Object The tracker property to read/write
     * @param key String/Object Returns property object if key and value is undefined,
     *      acts as a getter if only `key` is defined and a string, and
     *      acts as a setter if `key` and `value` are defined OR if `key` is an object. 
     */
    _dataSetter: function(dataStore, key, value) {
      var i;

      if (typeof dataStore === 'undefined') {
        return dataStore;
      }

      if (typeof value === 'undefined') {
        if (typeof key === 'string') {
          return dataStore[key];
        }
        if (typeof key === 'object') {
          for (i in key) {
            dataStore[i] = key[i];
            //this._dataSetter(dataStore, i, key[i]);
          }
        }
      }
      else {
        dataStore[key] = value;
      }

      return this;
    },

    /**
     *
     _push: function() {
     },

     /**
      * Sets configuration options
      */
     config: function(key, value) {
       return this._dataSetter(this.options, key, value);
     },

     /**
      * Use to attach custom visit data that doesn't stick to visitor
      * ** Not in use yet
      */
     visit: function(key, value) {
       return this._dataSetter(this.visitData, key, value);
     },

     /**
      * Attach custom visitor data
      */
     identify: function(key, value) {
       return this._dataSetter(this.visitorData, key, value);
     },

     /**
      *
      */
     track: function(name, options) {
       var event = {};

     },

     call: function() {
     },


     _track: function(name, options) {
       var a = arguments;

       var event = {};
       var callback;
       // Load campaign params (load first to allow overrides)
       Woopra.extend(event, Woopra.getCampaignData());

       // Track default: pageview
       if (a.length === 0) {
         event.name = 'pv',
         event.url = this.getPageURL();
         event.title = this.getPageTitle();
       }
       // Track custom events
       if (a.length == 1) {
         if (typeof a[0] == 'string') {
           event.name = a[0];
         }
         if (typeof a[0] == 'object') {
           Woopra.extend(event, a[0]);	
         }
       }
       // Track custom events in format of name,object
       if (a.length >= 2) {
         event.name = a[0];
         Woopra.extend(event, a[1]);
       }

       // Extract callback
       if (typeof event.hitCallback == 'function') {
         callback = event.hitCallback;
         delete event.hitCallback;
       }

       var endpoint = Woopra.CONSTANTS.EVENT_ENDPOINT;
       var random = 'ra=' + Woopra.randomString();
       var coData = Woopra.buildUrlParams(this.getOptionParams());
       var cvData = Woopra.buildUrlParams(this.visitorData, 'cv_');
       var ceData = Woopra.buildUrlParams(event, 'ce_');

       var query = '?' + [random, coData, cvData, ceData].join("&");
       console.log(query);

       var scriptUrl = endpoint + query;
       Woopra.loadScript(scriptUrl, callback);

       this.startPing();
     },

     startPing: function() {
       if (typeof this.pingInterval == 'undefined') {
         window.clearInterval(this.pingInterval);
         delete this.pingInterval;
       }
       var self = this;
       this.pingInterval = window.setInterval(function() {
         self.ping();
       }, this.config('ping_interval'));
     },

     ping: function() {
       var endpoint = Woopra.CONSTANTS.PING_ENDPOINT;
       var random = 'ra=' + Woopra.randomString();
       var coData = Woopra.buildUrlParams(this.getOptionParams());
       var cvData = Woopra.buildUrlParams(this.visitorData, 'cv_');
       //var ceData = Woopra.buildUrlParams(this.event, 'ce_');
     },

     push: function() {
       console.log('push', arguments);
       return this;
     },

     getPageURL: function() {
       if (this.options.ignore_query_url) {
         return window.location.pathname;
       } else {
         return window.location.pathname + window.location.search;
       }
     },

     getPageTitle: function() {
       return (document.getElementsByTagName('title').length === 0) ? '' : document.getElementsByTagName('title')[0].innerHTML;
     },

     getOptionParams: function() {
       var o = {
         alias: this.config('domain'),
         cookie: Woopra.readCookie(this.config('cookie_name')),
         meta: Woopra.readCookie('wooMeta') || '',
         screen: window.screen.width + 'x' + window.screen.height,
         language: window.navigator.browserLanguage || window.navigator.language || "",
         referer: document.referrer,
         idle: '' + parseInt(this.idle/1000, 10),
         vs: 'w'
       };
       /*
        if(t.vs==2){
          r['vs']='w';
          t.vs=0;
        }else{
          if(t.idle==0){
            r['vs']='r';
          }else{
            r['vs']='i';
          }
          }*/
         return o;

       }
     };


     //Woopra.Tracker = Tracker;
     var _public = {
       Tracker: Tracker
     };

     // Initialize instances & preloaded settings/events
     if (typeof window._wpt !== 'undefined') {
       for (var name in window._wpt) {
         cosnole.log(name);
         var instance = new Tracker(name);
         instance.init();
         window[name]=instance;
       }
     }

     window.Woopra = _public || {};

     if (typeof window.exports !== 'undefined') {
       window.exports.Woopra = _public;
     }

   })(window, document);
