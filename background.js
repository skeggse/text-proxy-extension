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

function deployTabs(callback) {
  loadOptions(function(err, options) {
    if (err) {
      return callback(err);
    }
    chrome.tabs.query({
      status: 'complete'//,
      // TODO: will this work?
      //title: options.watchTitle
    }, function(tabs) {
      if (chrome.runtime.lastError) {
        return callback(chrome.runtime.lastError);
      }
      var deployed = 0, total = 0, matched = 0;
      tabs.forEach(function(tab) {
        var tabHost = parseURL(tab.url).host;
        if (!options.host.test(tabHost) ||
            !options.title.test(tab.title)) return;
        matched++;
        console.log('deploying to', tab);
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
      matched || callback(null, 0, 0);
    });
  });
}

chrome.runtime.onInstalled.addListener(function(details) {
  var reason = details.reason;
  deployTabs(function(err, count, total) {
    if (err) {
      return console.error(err, 'deploying scripts after runtime ' + reason);
    }
    console.log('deployed scripts to ' + count + '/' + total +
      ' tabs after runtime ' + reason);
 });
});

chrome.tabs.onUpdated.addListener(function(id, info, tab) {
  if (tab.status !== 'complete') return;
  loadOptions(function(err, options) {
    if (err) return;
    var tabHost = parseURL(tab.url).host;
    if (!options.host.test(tabHost) ||
        !options.title.test(tab.title)) return;
    deployTab(id, options, function(err) {
      err && console.error(err, 'injecting scripts');
    });
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
    deployTabs(function(err, count, total) {
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
