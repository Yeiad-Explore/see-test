// Answer key. Lives on the server only; the browser never receives it.
// targets = correct tap circles, in image-width units: x 0..1 from the left, y = pixels-from-top / image width, r = radius.
// Any tap inside any circle counts. No targets = the object is not in the picture.
const EXAM_TITLE = 'Visual Attention Test';
const EXAM_MINUTES = 15; // the clock starts when the student presses Start

const OBJECTS = [
  { id: 'b2', object: 'bucket', img: 'img/bucket-2.png', targets: [{ x: 0.58, y: 0.27, r: 0.12 }] },
  { id: 'w2', object: 'wrench', img: 'img/wrench-2.png' },
  { id: 'c1', object: 'cycle', img: 'img/cycle-1.png', targets: [{ x: 0.515, y: 0.252, r: 0.11 }] },
  { id: 'b1', object: 'bucket', img: 'img/bucket-1.png' },
  { id: 'w1', object: 'wrench', img: 'img/wrench-1.png', targets: [{ x: 0.37, y: 0.109, r: 0.12 }, { x: 0.36, y: 0.225, r: 0.12 }] },
  { id: 'c2', object: 'cycle', img: 'img/cycle-2.png' },
  { id: 'b3', object: 'bucket', img: 'img/bucket-3.png', targets: [{ x: 0.546, y: 0.238, r: 0.09 }] },
  { id: 'w3', object: 'wrench', img: 'img/wrench-3.png', targets: [{ x: 0.537, y: 0.38, r: 0.12 }, { x: 0.688, y: 0.4, r: 0.06 }] },
  { id: 'c3', object: 'cycle', img: 'img/cycle-3.png', targets: [{ x: 0.531, y: 0.308, r: 0.11 }] },
];

const SHAPE_IMG = 'img/shape.jpg';
// A, B, C are the hidden shapes (shape_A/B/C.png); the rest are decoys. The browser draws each id (see SHAPES in index.html).
const SHAPE_OPTIONS = ['A', 'square', 'circle', 'B', 'triangle', 'star', 'hexagon', 'C', 'cross', 'pentagon', 'oval', 'trapezoid'];
const SHAPE_ANSWER = ['A', 'B', 'C'];

module.exports = { EXAM_TITLE, EXAM_MINUTES, OBJECTS, SHAPE_IMG, SHAPE_OPTIONS, SHAPE_ANSWER };
