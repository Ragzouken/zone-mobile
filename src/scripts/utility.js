/**
 * Create an html element with the given attributes and children.
 * @template {keyof HTMLElementTagNameMap} K
 * @param {K} tagName 
 * @param {*} attributes 
 * @param  {...(Node | string)} children 
 * @returns {HTMLElementTagNameMap[K]}
 */
 function html(tagName, attributes = {}, ...children) {
    const element = /** @type {HTMLElementTagNameMap[K]} */ (document.createElement(tagName)); 
    Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, value));
    children.forEach((child) => element.append(child));
    return element;
}

/**
 * Get a child element matching CSS selector.
 * @param {string} query 
 * @param {ParentNode} element 
 * @returns {HTMLElement}
 */
 const ONE = (query, element = undefined) => (element || document).querySelector(query);

 /**
  * Get all children elements matching CSS selector.
  * @param {string} query 
  * @param {HTMLElement | Document} element 
  * @returns {HTMLElement[]}
  */
 const ALL = (query, element = undefined) => Array.from((element || document).querySelectorAll(query));

 const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
