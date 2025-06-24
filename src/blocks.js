export default (editor, opts = {}) => {
  const bm = editor.BlockManager;

  bm.add('MY-BLOCK', {
    label: 'My block',
    content: { type: 'MY-COMPONENT' },
    // media: '<svg>...</svg>',
  });

  bm.add('audio-response', {
    label: 'Audio Response',
    category: 'AI',
    attributes: { class: 'fa fa-volume-up' },
    content: { type: 'audio-response-component' },
  });
}
