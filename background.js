var request = require('superagent');

function deployTab(tab, options, callback) {
  injectScripts(tab, ['lib.js', 'content.js'], {
    runAt: 'document_start'
  }, function(err) {
    if (err) {
      return callback(err);
    }
    // TODO: what if options are old?
    chrome.tabs.sendMessage(tab, {
      type: 'options',
      options: options
    });
    callback(null);
  });
}

function deployTabs(tabs, options, callback) {
  var deployed = 0, total = 0, matched = 0;
  tabs.forEach(function(tab) {
    var tabHost = parseURL(tab.url).host;
    if (!options.host.test(tabHost) ||
        !options.title.test(tab.title)) return;
    matched++;
    deployTab(tab.id, options, function(err) {
      total++;
      if (err) {
        console.error(err, 'deploying scripts');
      } else {
        deployed++;
      }
      total === matched && callback(null, deployed, total);
    });
  });
  // TODO: better tick defer?
  matched || setTimeout(function() {
    callback(null, 0, 0);
  }, 0);
}

function optionsDeployTabs(tabs, callback) {
  loadOptions(function(err, options) {
    if (err) {
      return callback(err);
    }
    deployTabs(tabs, options, callback);
  });
}

function findDeployTabs(query, callback) {
  if (typeof query === 'function') {
    callback = query;
    query = {status: 'complete'};
  }
  chrome.tabs.query(query, function(tabs) {
    if (chrome.runtime.lastError) {
      return callback(chrome.runtime.lastError);
    }
    optionsDeployTabs(tabs, callback);
  });
}

chrome.runtime.onInstalled.addListener(function(details) {
  var reason = details.reason;
  findDeployTabs(function(err, count, total) {
    if (err) {
      return console.error(err, 'deploying scripts after runtime ' + reason);
    }
    console.log('deployed scripts to ' + count + '/' + total +
      ' tabs after runtime ' + reason);
 });
});

function onTab(tab) {
  if (tab.status !== 'complete') return;
  loadOptions(function(err, options) {
    if (err) return;
    var tabHost = parseURL(tab.url).host;
    if (!options.host.test(tabHost) ||
        !options.title.test(tab.title)) return;
    deployTab(tab.id, options, function(err) {
      err && console.error(err, 'injecting scripts');
    });
  });
}

chrome.tabs.onCreated.addListener(onTab);
chrome.tabs.onUpdated.addListener(function(id, info, tab) {
  return onTab(tab);
});

chrome.tabs.onReplaced.addListener(function(id) {
  chrome.tabs.get(id, function(tab) {
    if (chrome.runtime.lastError) {
      return console.error(chrome.runtime.lastError, 'getting replaced tab');
    }
    onTab(tab);
  });
});

chrome.windows.onCreated.addListener(function(window) {
  findDeployTabs({
    windowId: window.id
  }, function(err) {
    err && console.error(err, 'deploying tabs for window');
  });
});

chrome.runtime.onMessage.addListener(function(req, sender, res) {
  if (sender.id !== chrome.runtime.id) {
    return console.warn('unauthorized message from', sender);
  }
  if (req.type === 'update') {
    loadOptions(function(err, options) {
      if (err) {
        return console.error(err, 'getting options for posting update');
      }
      request.post(options.socketServer + '/' + req.name)
        .send({text: req.text})
        .set('accept', 'application/json')
        .end(function(err, res) {
          if (err) {
            // TODO: retry or something?
            return console.error(err, 'posting update');
          }
          if (!res.ok) {
            return console.error(res.status, res.body, 'posting update');
          }
        });
    });
  } else if (req.type === 'options') {
    // user updated options, redeploy content scripts
    findDeployTabs(function(err, count, total) {
      if (err) {
        return console.error('deploying tabs after options change');
      }
      console.log('deployed scripts to ' + count + '/' + total +
        ' tabs after options change');
    });
  } else {
    console.warn('unknown message type', req.type);
  }
});
