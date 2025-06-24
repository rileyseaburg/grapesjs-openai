export default (editor, opts = {}) => {
  const bm = editor.BlockManager;


  bm.add('audio-response', {
    label: 'Audio Response',
    category: 'AI',
    attributes: { class: 'fa fa-volume-up' },
    content: { type: 'audio-response-component' },
  });
}
