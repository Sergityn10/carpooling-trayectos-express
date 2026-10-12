import { describe, it, beforeEach } from "node:test";
import { strict as assert } from "node:assert";
import { MinHeap } from "../../app/services/routing/routing-engine.js";

describe("MinHeap - Cola de Prioridad para A*", () => {
  let heap;

  beforeEach(() => {
    heap = new MinHeap();
  });

  describe("Operaciones Básicas", () => {
    it("push/pop mantiene orden de prioridad mínima", () => {
      heap.push({ id: "a", priority: 10 });
      heap.push({ id: "b", priority: 5 });
      heap.push({ id: "c", priority: 15 });
      heap.push({ id: "d", priority: 1 });

      assert.equal(heap.pop().id, "d"); // 1
      assert.equal(heap.pop().id, "b"); // 5
      assert.equal(heap.pop().id, "a"); // 10
      assert.equal(heap.pop().id, "c"); // 15
      assert.ok(heap.isEmpty());
    });

    it("pop en heap vacío devuelve null", () => {
      assert.equal(heap.pop(), null);
    });

    it("peek devuelve mínimo sin remover", () => {
      heap.push({ id: "a", priority: 10 });
      heap.push({ id: "b", priority: 5 });

      assert.equal(heap.peek().id, "b");
      assert.equal(heap.size(), 2); // No removido
    });

    it("size() devuelve cantidad correcta", () => {
      assert.equal(heap.size(), 0);
      heap.push({ id: "a", priority: 1 });
      assert.equal(heap.size(), 1);
      heap.push({ id: "b", priority: 2 });
      assert.equal(heap.size(), 2);
      heap.pop();
      assert.equal(heap.size(), 1);
    });

    it("isEmpty() correcto", () => {
      assert.ok(heap.isEmpty());
      heap.push({ id: "a", priority: 1 });
      assert.ok(!heap.isEmpty());
      heap.pop();
      assert.ok(heap.isEmpty());
    });
  });

  describe("Estabilidad y Casos Edge", () => {
    it("maneja prioridades iguales (orden no garantizado en binary heap)", () => {
      heap.push({ id: "first", priority: 5 });
      heap.push({ id: "second", priority: 5 });
      heap.push({ id: "third", priority: 5 });

      // En un binary heap no se garantiza orden FIFO para prioridades iguales
      // Solo verificamos que salen todos con prioridad 5
      const popped = [];
      while (!heap.isEmpty()) {
        popped.push(heap.pop());
      }
      assert.equal(popped.length, 3);
      popped.forEach(item => assert.equal(item.priority, 5));
    });

    it("maneja prioridades negativas", () => {
      heap.push({ id: "neg", priority: -10 });
      heap.push({ id: "pos", priority: 10 });
      heap.push({ id: "zero", priority: 0 });

      assert.equal(heap.pop().id, "neg");
      assert.equal(heap.pop().id, "zero");
      assert.equal(heap.pop().id, "pos");
    });

    it("maneja números flotantes", () => {
      heap.push({ id: "a", priority: 1.5 });
      heap.push({ id: "b", priority: 1.1 });
      heap.push({ id: "c", priority: 1.9 });

      assert.equal(heap.pop().id, "b");
      assert.equal(heap.pop().id, "a");
      assert.equal(heap.pop().id, "c");
    });

    it("clear() vacía el heap", () => {
      heap.push({ id: "a", priority: 1 });
      heap.push({ id: "b", priority: 2 });
      heap.clear();
      assert.ok(heap.isEmpty());
      assert.equal(heap.size(), 0);
    });
  });

  describe("Rendimiento Básico", () => {
    it("1000 inserciones/extracciones en tiempo razonable", () => {
      const start = Date.now();
      const N = 1000;

      for (let i = N; i > 0; i--) {
        heap.push({ id: i, priority: i });
      }
      for (let i = 1; i <= N; i++) {
        assert.equal(heap.pop().id, i);
      }

      const elapsed = Date.now() - start;
      assert.ok(elapsed < 100, `Tardó ${elapsed}ms, esperado < 100ms`);
    });
  });
});