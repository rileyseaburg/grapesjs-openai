export default (editor, opts = {}) => {
  const domc = editor.DomComponents;

  domc.addType('html', {
    model: {
      defaults: {
        droppable: true,
        draggable: true,
        removable: true,
        copyable: true,
        content: '',
        traits: [],
      },
    },
    view: {
      events: {
        dblclick: 'onActive',
      },
    },
    isComponent: (el) => el.tagName === 'DIV',
  });
};
