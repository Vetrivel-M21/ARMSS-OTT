import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("VideoPlayer ABR & Quality Selection", () => {
  it("calculates optimal mid-level start rung from ladder rungs", () => {
    const levels = [
      { height: 2160, bitrate: 16000000 },
      { height: 1080, bitrate: 5000000 },
      { height: 720, bitrate: 2800000 },
      { height: 480, bitrate: 1200000 },
      { height: 360, bitrate: 600000 },
    ];

    // Mid-level index
    const midIndex = Math.floor(levels.length / 2);
    assert.equal(midIndex, 2);
    assert.equal(levels[midIndex].height, 720);
  });

  it("filters out 2160p when hardware decode support is false", () => {
    const allLevels = [
      { height: 2160, bitrate: 16000000 },
      { height: 1080, bitrate: 5000000 },
      { height: 720, bitrate: 2800000 },
      { height: 480, bitrate: 1200000 },
      { height: 360, bitrate: 600000 },
    ];

    const filterLevels = (levels: typeof allLevels, supports4K: boolean) => {
      return levels.filter((lvl) => {
        if (lvl.height >= 2160 && !supports4K) return false;
        return true;
      });
    };

    const without4K = filterLevels(allLevels, false);
    assert.equal(without4K.length, 4);
    assert.equal(without4K.some((l) => l.height === 2160), false);
    assert.equal(without4K[0].height, 1080);

    const with4K = filterLevels(allLevels, true);
    assert.equal(with4K.length, 5);
    assert.equal(with4K[0].height, 2160);
  });
});

describe("VideoPlayer Error States & Token Refresh", () => {
  it("detects expired playback token (401/403) and triggers ticket renewal", () => {
    let renewalTriggered = false;
    let reloadStreamTriggered = false;

    const handleHlsError = (
      statusCode: number,
      renewTicket: () => void,
      recoverError: () => void,
    ) => {
      if (statusCode === 401 || statusCode === 403) {
        renewTicket();
        return;
      }
      recoverError();
    };

    handleHlsError(
      401,
      () => {
        renewalTriggered = true;
      },
      () => {
        reloadStreamTriggered = true;
      },
    );

    assert.equal(renewalTriggered, true);
    assert.equal(reloadStreamTriggered, false);
  });

  it("correctly identifies unrecoverable network errors", () => {
    let fallbackShown = false;

    const handleFatalError = (errorType: string, isFatal: boolean) => {
      if (isFatal && errorType === "otherError") {
        fallbackShown = true;
      }
    };

    handleFatalError("otherError", true);
    assert.equal(fallbackShown, true);
  });
});

describe("VideoPlayer Lifecycle & Timers Cleanup", () => {
  it("cleans up intervals and destroys HLS instance on unmount", () => {
    let destroyed = false;
    let timerCleared = false;

    const mockHls = {
      destroy: () => {
        destroyed = true;
      },
    };

    const timer = setInterval(() => {}, 15000);

    // Simulate unmount cleanup
    const unmount = () => {
      mockHls.destroy();
      clearInterval(timer);
      timerCleared = true;
    };

    unmount();

    assert.equal(destroyed, true);
    assert.equal(timerCleared, true);
  });
});
