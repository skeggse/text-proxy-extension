// from http://james.padolsey.com/javascript/parsing-urls-with-the-dom/
function parseURL(url) {
  var a = document.createElement('a');
  a.href = url;
  return {
    source: url,
    protocol: a.protocol.replace(':',''),
    host: a.host, // modified
    hostname: a.hostname,
    port: a.port,
    query: a.search,
    params: (function() {
      var ret = {},
        seg = a.search.replace(/^\?/,'').split('&'),
        len = seg.length, i = 0, s;
      for (;i<len;i++) {
        if (!seg[i]) { continue; }
        s = seg[i].split('=');
        ret[s[0]] = s[1];
      }
      return ret;
    })(),
    file: (a.pathname.match(/\/([^\/?#]+)$/i) || [,''])[1],
    hash: a.hash.replace('#',''),
    path: a.pathname.replace(/^([^\/])/,'/$1'),
    relative: (a.href.match(/tps?:\/\/[^\/]+(.+)/) || [,''])[1],
    segments: a.pathname.replace(/^\//,'').split('/')
  };
}

function loadOptions(callback) {
  chrome.storage.sync.get({
    socketServer: '',
    watchName: '',
    watchHost: '',
    watchTitle: '0',
    watchSelector: ''
  }, function(data) {
    var options = readOptions(data);
    options
      ? callback(null, options)
      : callback(new Error('no options configured'));
  });
}

function readOptions(data) {
  if (!data.socketServer ||
      !data.watchName ||
      !data.watchHost ||
       data.watchTitle.length <= 1 ||
      !data.watchSelector) return;
  var flags = (+data.watchTitle.slice(-1)) ? '' : 'i';
  var host = new RegExp(data.watchHost, 'i');
  var title = new RegExp(data.watchTitle.slice(0, -1), flags);
  return {
    socketServer: data.socketServer,
    name: data.watchName,
    host: host,
    title: title,
    selector: data.watchSelector
  };
}

function extend(obj) {
  obj || (obj = {});
  for (var i = 1, n = arguments.length; i < n; i++) {
    var src = arguments[i];
    for (var key in src) {
      obj[key] = src[key];
    }
  }
  return obj;
}

function injectScripts(tab, scripts, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  } else if (!options) {
    options = {};
  }
  if (!Array.isArray(scripts)) {
    throw new TypeError('expected scripts array');
  }
  (function inject(index) {
    if (scripts.length <= index) {
      return callback(null);
    }
    var script = scripts[index];
    if (typeof script === 'string') {
      script = {file: script};
    }
    var details = extend({}, options, script);
    chrome.tabs.executeScript(tab, details, function() {
      if (chrome.runtime.lastError) {
        return callback(chrome.runtime.lastError);
      }
      inject(index + 1);
    });
  })(0);
}
