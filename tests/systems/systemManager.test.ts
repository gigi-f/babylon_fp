import { describe, it, expect, beforeEach } from "vitest";
import { SystemManager, ISystem } from "../../src/systems/SystemManager";
import { createMockScene } from "../helpers/mockScene";

describe("SystemManager", () => {
  let systemManager: SystemManager;
  let scene: any;

  beforeEach(() => {
    scene = createMockScene();
    systemManager = new SystemManager(scene as any);
  });

  describe("register", () => {
    it("should register a system without update method", () => {
      const system: ISystem = {};
      systemManager.register("test", system);

      expect(systemManager.has("test")).toBe(true);
      expect(systemManager.get("test")).toBe(system);
    });

    it("should register a system with update method", () => {
      const system: ISystem = {
        update: (deltaSeconds: number) => {},
      };
      systemManager.register("test", system);

      expect(systemManager.has("test")).toBe(true);
      expect(systemManager.get("test")).toBe(system);
    });

    it("should replace existing system when registering with same name", () => {
      const system1: ISystem = {};
      const system2: ISystem = {};

      systemManager.register("test", system1);
      systemManager.register("test", system2);

      expect(systemManager.get("test")).toBe(system2);
      expect(systemManager.getSystemCount()).toBe(1);
    });

    it("should handle registering multiple systems", () => {
      const system1: ISystem = {};
      const system2: ISystem = {};
      const system3: ISystem = {};

      systemManager.register("sys1", system1);
      systemManager.register("sys2", system2);
      systemManager.register("sys3", system3);

      expect(systemManager.getSystemCount()).toBe(3);
      expect(systemManager.getSystemNames()).toEqual(["sys1", "sys2", "sys3"]);
    });
  });

  describe("get", () => {
    it("should return undefined for non-existent system", () => {
      expect(systemManager.get("nonexistent")).toBeUndefined();
    });

    it("should return correct system", () => {
      const system: ISystem = {};
      systemManager.register("test", system);

      expect(systemManager.get("test")).toBe(system);
    });
  });

  describe("has", () => {
    it("should return false for non-existent system", () => {
      expect(systemManager.has("nonexistent")).toBe(false);
    });

    it("should return true for existing system", () => {
      const system: ISystem = {};
      systemManager.register("test", system);

      expect(systemManager.has("test")).toBe(true);
    });
  });

  describe("unregister", () => {
    it("should remove system from registry", () => {
      const system: ISystem = {};
      systemManager.register("test", system);

      systemManager.unregister("test");

      expect(systemManager.has("test")).toBe(false);
    });

    it("should call dispose if system has dispose method", () => {
      let disposed = false;
      const system: ISystem = {
        dispose: () => {
          disposed = true;
        },
      };
      systemManager.register("test", system);

      systemManager.unregister("test");

      expect(disposed).toBe(true);
    });

    it("should handle dispose errors gracefully", () => {
      const system: ISystem = {
        dispose: () => {
          throw new Error("Dispose error");
        },
      };
      systemManager.register("test", system);

      // Should not throw
      expect(() => systemManager.unregister("test")).not.toThrow();
      expect(systemManager.has("test")).toBe(false);
    });

    it("should do nothing when unregistering non-existent system", () => {
      expect(() => systemManager.unregister("nonexistent")).not.toThrow();
    });
  });

  describe("update", () => {
    it("should call update on all systems with update method", () => {
      const updates: number[] = [];

      const system1: ISystem = {
        update: (deltaSeconds) => updates.push(deltaSeconds),
      };
      const system2: ISystem = {
        update: (deltaSeconds) => updates.push(deltaSeconds),
      };
      const system3: ISystem = {}; // no update method

      systemManager.register("sys1", system1);
      systemManager.register("sys2", system2);
      systemManager.register("sys3", system3);

      systemManager.update(0.016);

      expect(updates).toEqual([0.016, 0.016]);
    });

    it("should handle update errors gracefully", () => {
      const updates: number[] = [];

      const system1: ISystem = {
        update: (deltaSeconds) => updates.push(deltaSeconds),
      };
      const system2: ISystem = {
        update: () => {
          throw new Error("Update error");
        },
      };
      const system3: ISystem = {
        update: (deltaSeconds) => updates.push(deltaSeconds),
      };

      systemManager.register("sys1", system1);
      systemManager.register("sys2", system2);
      systemManager.register("sys3", system3);

      // Should not throw and should continue updating other systems
      expect(() => systemManager.update(0.016)).not.toThrow();
      expect(updates).toEqual([0.016, 0.016]);
    });
  });

  describe("dispose", () => {
    it("should dispose all systems in reverse order", () => {
      const disposeOrder: string[] = [];

      const system1: ISystem = {
        dispose: () => disposeOrder.push("sys1"),
      };
      const system2: ISystem = {
        dispose: () => disposeOrder.push("sys2"),
      };
      const system3: ISystem = {
        dispose: () => disposeOrder.push("sys3"),
      };

      systemManager.register("sys1", system1);
      systemManager.register("sys2", system2);
      systemManager.register("sys3", system3);

      systemManager.dispose();

      // Should dispose in reverse order
      expect(disposeOrder).toEqual(["sys3", "sys2", "sys1"]);
    });

    it("should clear all systems after dispose", () => {
      const system: ISystem = {};
      systemManager.register("test", system);

      systemManager.dispose();

      expect(systemManager.getSystemCount()).toBe(0);
      expect(systemManager.has("test")).toBe(false);
    });

    it("should handle dispose errors without stopping", () => {
      const disposeOrder: string[] = [];

      const system1: ISystem = {
        dispose: () => disposeOrder.push("sys1"),
      };
      const system2: ISystem = {
        dispose: () => {
          disposeOrder.push("sys2");
          throw new Error("Dispose error");
        },
      };
      const system3: ISystem = {
        dispose: () => disposeOrder.push("sys3"),
      };

      systemManager.register("sys1", system1);
      systemManager.register("sys2", system2);
      systemManager.register("sys3", system3);

      expect(() => systemManager.dispose()).not.toThrow();
      expect(disposeOrder).toEqual(["sys3", "sys2", "sys1"]);
    });
  });

  describe("getSystemNames", () => {
    it("should return empty array when no systems registered", () => {
      expect(systemManager.getSystemNames()).toEqual([]);
    });

    it("should return all registered system names", () => {
      systemManager.register("sys1", {});
      systemManager.register("sys2", {});
      systemManager.register("sys3", {});

      expect(systemManager.getSystemNames()).toEqual(["sys1", "sys2", "sys3"]);
    });
  });

  describe("getSystemCount", () => {
    it("should return 0 when no systems registered", () => {
      expect(systemManager.getSystemCount()).toBe(0);
    });

    it("should return correct count", () => {
      systemManager.register("sys1", {});
      systemManager.register("sys2", {});
      systemManager.register("sys3", {});

      expect(systemManager.getSystemCount()).toBe(3);
    });

    it("should update count when systems are unregistered", () => {
      systemManager.register("sys1", {});
      systemManager.register("sys2", {});

      expect(systemManager.getSystemCount()).toBe(2);

      systemManager.unregister("sys1");

      expect(systemManager.getSystemCount()).toBe(1);
    });
  });
});
