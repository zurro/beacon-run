(() => {
  function el(tagName, options = {}){
    const node = document.createElement(tagName);

    if(options.className) node.className = options.className;
    if(options.text !== undefined) node.textContent = String(options.text);

    if(options.attrs){
      Object.entries(options.attrs).forEach(([name, value]) => {
        if(value !== undefined && value !== null){
          node.setAttribute(name, String(value));
        }
      });
    }

    if(options.children && options.children.length){
      node.append(...options.children);
    }

    return node;
  }

  function replace(node, children = []){
    node.replaceChildren(...children);
  }

  window.BeaconRunDom = { el, replace };
})();
