/**
 * Implementación eficiente de Min-Heap (Cola de Prioridad Binaria).
 * Garantiza operaciones de inserción y extracción en O(log N).
 */
export class MinHeap {
  /**
   * @param {(a: any, b: any) => number} [comparator] Función de comparación opcional. Por defecto compara la propiedad `priority` o `cost`.
   */
  constructor(comparator) {
    this.heap = [];
    this.comparator =
      comparator ||
      ((a, b) => {
        const valA = a?.priority ?? a?.cost ?? a;
        const valB = b?.priority ?? b?.cost ?? b;
        return valA - valB;
      });
  }

  /**
   * Devuelve el número de elementos en el heap.
   * @returns {number}
   */
  size() {
    return this.heap.length;
  }

  /**
   * Indica si el heap está vacío.
   * @returns {boolean}
   */
  isEmpty() {
    return this.heap.length === 0;
  }

  /**
   * Inserta un nuevo elemento en el heap.
   * @param {any} item
   */
  push(item) {
    this.heap.push(item);
    this._bubbleUp(this.heap.length - 1);
  }

  /**
   * Extrae y devuelve el elemento con menor valor de prioridad.
   * @returns {any | null}
   */
  pop() {
    if (this.isEmpty()) return null;
    if (this.heap.length === 1) return this.heap.pop();

    const top = this.heap[0];
    this.heap[0] = this.heap.pop();
    this._sinkDown(0);
    return top;
  }

  /**
   * Consulta el elemento prioritario sin extraerlo.
   * @returns {any | null}
   */
  peek() {
    return this.isEmpty() ? null : this.heap[0];
  }

  /**
   * Limpia el heap.
   */
  clear() {
    this.heap = [];
  }

  /**
   * @private
   */
  _bubbleUp(index) {
    let currentIndex = index;
    const element = this.heap[currentIndex];

    while (currentIndex > 0) {
      const parentIndex = Math.floor((currentIndex - 1) / 2);
      const parent = this.heap[parentIndex];

      if (this.comparator(element, parent) >= 0) break;

      this.heap[currentIndex] = parent;
      currentIndex = parentIndex;
    }

    this.heap[currentIndex] = element;
  }

  /**
   * @private
   */
  _sinkDown(index) {
    let currentIndex = index;
    const length = this.heap.length;
    const element = this.heap[currentIndex];

    while (true) {
      const leftChildIndex = 2 * currentIndex + 1;
      const rightChildIndex = 2 * currentIndex + 2;
      let swapIndex = null;

      if (leftChildIndex < length) {
        if (this.comparator(this.heap[leftChildIndex], element) < 0) {
          swapIndex = leftChildIndex;
        }
      }

      if (rightChildIndex < length) {
        const compareTarget =
          swapIndex === null ? element : this.heap[leftChildIndex];
        if (this.comparator(this.heap[rightChildIndex], compareTarget) < 0) {
          swapIndex = rightChildIndex;
        }
      }

      if (swapIndex === null) break;

      this.heap[currentIndex] = this.heap[swapIndex];
      currentIndex = swapIndex;
    }

    this.heap[currentIndex] = element;
  }
}
