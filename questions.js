// Answer key. Lives on the server only; the browser never receives it.
// targets = correct tap circles, in image-width units: x 0..1 from the left, y = pixels-from-top / image width, r = radius.
// Any tap inside any circle counts. No targets = the object is not in the picture.
const EXAM_TITLE = 'Visual Attention Test';

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

// Shape questions: each shows a drawing and the student taps the red shape hidden in it. Same three red options every time (shuffled per student).
const SHAPES = [
  { id: 's1', img: 'img/shape-1.png', answer: 'A' },
  { id: 's2', img: 'img/shape-2.png', answer: 'B' },
  { id: 's3', img: 'img/shape-3.png', answer: 'C' },
];
const SHAPE_OPTIONS = [
  { id: 'A', img: 'img/red-a.png', name: 'diamond' },
  { id: 'B', img: 'img/red-b.png', name: 'flag' },
  { id: 'C', img: 'img/red-c.png', name: 'slanted box' },
];

module.exports = { EXAM_TITLE, OBJECTS, SHAPES, SHAPE_OPTIONS };
