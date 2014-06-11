var $ = document.querySelector.bind(document);
var timeout = null;

var options = {
  save: function() {
    // TODO: validation
    var sensitive = $('#watch-title-sensitive').checked ? 1 : 0;
    chrome.storage.sync.set({
      socketServer: $('#socket-server').value,
      watchName: $('#watch-name').value,
      watchHost: $('#watch-host').value,
      watchTitle: $('#watch-title').value + sensitive,
      watchSelector: $('#watch-selector').value
    }, function() {
      options.status('Options saved.');
      chrome.runtime.sendMessage(chrome.runtime.id, {
        type: 'options'
      });
    });
  },
  restore: function() {
    // TODO: loadOptions?
    chrome.storage.sync.get({
      socketServer: '',
      watchName: '',
      watchHost: '',
      watchTitle: '0',
      watchSelector: ''
    }, function(data) {
      $('#socket-server').value = data.socketServer;
      $('#watch-name').value = data.watchName;
      $('#watch-host').value = data.watchHost;
      $('#watch-title').value = data.watchTitle.slice(0, -1);
      $('#watch-title-sensitive').checked = !!+data.watchTitle.slice(-1);
      $('#watch-selector').value = data.watchSelector;
    });
  },
  status: function(status, time) {
    $('#status').textContent = status;
    timeout && clearTimeout(timeout);
    timeout = setTimeout(function() {
      $('#status').textContent = '';
    }, time || 750);
  }
};

$('#save').addEventListener('click', options.save);
document.addEventListener('DOMContentLoaded', options.restore);
