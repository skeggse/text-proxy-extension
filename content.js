var $ = document.querySelector.bind(document);

var Observer = window.MutationObserver || window.WebkitMutationObserver;

var observer = new Observer(onMutate);

var options = null;

chrome.runtime.onMessage.addListener(function(req, sender, res) {
  if (sender.id !== chrome.runtime.id) {
    return console.warn('unauthorized message from', sender);
  }
  if (req.type === 'options') {
    var prev = !!options;
    options = req.options;
    prev
      ? observer.disconnect()
      : onMutate();
    // TODO: check if page still valid
    observer.observe($(options.selector), {
      characterData: true,
      childList: true,
      subtree: true
    });
  }
});

function onMutate(changes) {
  if (!options) return;
  // TODO: supposedly for memory management, should we do this?
  changes && observer.takeRecords();
  chrome.runtime.sendMessage(chrome.runtime.id, {
    type: 'update',
    name: options.name,
    text: $(options.selector).textContent
  });
}
